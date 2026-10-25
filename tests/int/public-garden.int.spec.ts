import { createHash } from 'node:crypto'
import { access, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { exportPublicGarden, PublicGardenError, type PublicGardenAuditEvent } from '@/modules/public-garden'

const temporaryDirectories: string[] = []
const publicNote = (title: string, body: string) => `---\ntitle: ${title}\npublish: true\nvisibility: public\n---\n\n# ${title}\n\n${body}\n`
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const digest = (value: Uint8Array) => createHash('sha256').update(value).digest('hex')

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'snorlaxden-garden-'))
  temporaryDirectories.push(root)
  const sourceRoot = path.join(root, 'vault')
  const outputDirectory = path.join(root, 'public-garden')
  await mkdir(path.join(sourceRoot, 'Public'), { recursive: true })
  await mkdir(path.join(sourceRoot, 'Private'), { recursive: true })
  await mkdir(path.join(sourceRoot, 'Assets'), { recursive: true })
  return { outputDirectory, root, sourceRoot }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

describe('ISSUE-007 public garden exporter', () => {
  it('T007 exports only explicitly public notes and licensed attachments with a checksum manifest', async () => {
    const { outputDirectory, sourceRoot } = await fixture()
    await writeFile(path.join(sourceRoot, 'Public/index.md'), publicNote('公开首页', '查看 [[second|第二页]]。\n\n![[../Assets/owned.png|本人图片]]').replace('visibility: public', 'visibility: public\nprivate_note: 不得导出'))
    await writeFile(path.join(sourceRoot, 'Public/second.md'), publicNote('第二页', '公开内容。'))
    await writeFile(path.join(sourceRoot, 'Assets/owned.png'), png)
    const events: PublicGardenAuditEvent[] = []

    const manifest = await exportPublicGarden({
      audit: (event) => { events.push(event) },
      config: {
        version: 1,
        notes: [
          { source: 'Public/index.md', output: 'index.md' },
          { source: 'Public/second.md', output: 'notes/second.md' },
        ],
        attachments: [{
          authorization: 'owned', output: 'assets/owned.png', sha256: digest(png), source: 'Assets/owned.png',
        }],
      },
      now: new Date('2026-10-25T00:00:00.000Z'),
      outputDirectory,
      sourceRoot,
    })

    const exported = await readFile(path.join(outputDirectory, 'index.md'), 'utf8')
    expect(exported).toContain('[第二页](./notes/second.md)')
    expect(exported).toContain('![本人图片](./assets/owned.png)')
    expect(exported).not.toContain('private_note')
    expect(exported).not.toContain('不得导出')
    expect(manifest.notes).toHaveLength(2)
    expect(manifest.attachments[0]).toMatchObject({ authorization: 'owned', referencedBy: ['index.md'], sha256: digest(png) })
    const persistedManifest = await readFile(path.join(outputDirectory, 'manifest.json'), 'utf8')
    expect(JSON.parse(persistedManifest)).toEqual(manifest)
    expect(persistedManifest).not.toContain('Public/index.md')
    expect(persistedManifest).not.toContain('Assets/owned.png')
    expect(events).toEqual([expect.objectContaining({ action: 'public-garden.exported', outcome: 'success' })])
  })

  it('T008 removes private note identities and blocks unlicensed private attachments without replacing the last good export', async () => {
    const { outputDirectory, sourceRoot } = await fixture()
    await writeFile(path.join(sourceRoot, 'Private/medical-secret.md'), '# PRIVATE PATIENT DATA')
    await writeFile(path.join(sourceRoot, 'Private/secret.pdf'), '%PDF-1.7\nPRIVATE PDF')
    await writeFile(path.join(sourceRoot, 'Public/index.md'), publicNote('公开首页', '相关记录：[[../Private/medical-secret|绝密病例]]。'))
    const baseConfig = { attachments: [], notes: [{ output: 'index.md', source: 'Public/index.md' }], version: 1 as const }
    await exportPublicGarden({ config: baseConfig, outputDirectory, sourceRoot })
    const sanitized = await readFile(path.join(outputDirectory, 'index.md'), 'utf8')
    expect(sanitized).toContain('[非公开笔记]')
    expect(sanitized).not.toContain('medical-secret')
    expect(sanitized).not.toContain('绝密病例')
    expect((await readdir(outputDirectory, { recursive: true })).join('\n')).not.toContain('secret.pdf')

    await writeFile(path.join(sourceRoot, 'Public/index.md'), publicNote('公开首页', '附件：![[../Private/secret.pdf]]'))
    const events: PublicGardenAuditEvent[] = []
    await expect(exportPublicGarden({ audit: (event) => { events.push(event) }, config: baseConfig, outputDirectory, sourceRoot }))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED_ATTACHMENT' })
    expect(await readFile(path.join(outputDirectory, 'index.md'), 'utf8')).toEqual(sanitized)
    expect(events.at(-1)).toMatchObject({ action: 'public-garden.export_rejected', outcome: 'failure' })
  })

  it('T010 rejects traversal and symlinks', async () => {
    const { outputDirectory, root, sourceRoot } = await fixture()
    await writeFile(path.join(root, 'outside.md'), publicNote('越界', '不可公开'))
    await symlink(path.join(root, 'outside.md'), path.join(sourceRoot, 'Public/link.md'))

    await expect(exportPublicGarden({
      config: { attachments: [], notes: [{ output: 'link.md', source: 'Public/link.md' }], version: 1 },
      outputDirectory,
      sourceRoot,
    })).rejects.toMatchObject({ code: 'SYMLINK_REJECTED' })

    await expect(exportPublicGarden({
      config: { attachments: [], notes: [{ output: 'outside.md', source: '../outside.md' }], version: 1 },
      outputDirectory,
      sourceRoot,
    })).rejects.toBeInstanceOf(PublicGardenError)
  })

  it('removes withdrawn notes and orphaned attachments through a clean atomic replacement', async () => {
    const { outputDirectory, sourceRoot } = await fixture()
    await writeFile(path.join(sourceRoot, 'Public/keep.md'), publicNote('保留', '保留内容'))
    await writeFile(path.join(sourceRoot, 'Public/withdraw.md'), publicNote('撤回', '旧内容'))
    await writeFile(path.join(sourceRoot, 'Assets/owned.png'), png)
    await exportPublicGarden({
      config: {
        attachments: [{ authorization: 'owned', output: 'assets/owned.png', sha256: digest(png), source: 'Assets/owned.png' }],
        notes: [{ output: 'keep.md', source: 'Public/keep.md' }, { output: 'withdraw.md', source: 'Public/withdraw.md' }],
        version: 1,
      },
      outputDirectory,
      sourceRoot,
    })

    const manifest = await exportPublicGarden({
      config: { attachments: [], notes: [{ output: 'keep.md', source: 'Public/keep.md' }], version: 1 },
      outputDirectory,
      sourceRoot,
    })
    await expect(access(path.join(outputDirectory, 'withdraw.md'))).rejects.toThrow()
    await expect(access(path.join(outputDirectory, 'assets/owned.png'))).rejects.toThrow()
    expect(manifest.removedEntries).toBeGreaterThanOrEqual(3)
  })
})
