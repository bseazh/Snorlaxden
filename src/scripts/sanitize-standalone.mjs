import { lstat, readdir, rm } from 'node:fs/promises'
import path from 'node:path'

const standaloneRoot = path.resolve('.next/standalone')
const rootStat = await lstat(standaloneRoot).catch(() => null)
if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) {
  throw new Error('Standalone output is missing or unsafe.')
}

function isSensitiveName(name) {
  return name === '.secrets' || name === '.env' || name.startsWith('.env.')
}

async function sanitize(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (isSensitiveName(entry.name)) {
      await rm(target, { force: true, recursive: true })
      continue
    }
    if (entry.isDirectory() && !entry.isSymbolicLink()) await sanitize(target)
  }
}

async function findSensitive(directory, relative = '') {
  const found = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const childRelative = path.join(relative, entry.name)
    if (isSensitiveName(entry.name)) found.push(childRelative)
    else if (entry.isDirectory() && !entry.isSymbolicLink()) found.push(...await findSensitive(path.join(directory, entry.name), childRelative))
  }
  return found
}

await sanitize(standaloneRoot)
const remaining = await findSensitive(standaloneRoot)
if (remaining.length) throw new Error(`Sensitive files remain in standalone output: ${remaining.join(', ')}`)
console.log('Standalone secret scan passed.')
