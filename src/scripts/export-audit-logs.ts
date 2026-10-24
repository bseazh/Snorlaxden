import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import config from '@payload-config'
import { getPayload } from 'payload'

const payload = await getPayload({ config })
const outputDirectory = path.resolve(process.cwd(), 'logs/runtime')
const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const outputPath = path.join(outputDirectory, `audit-${timestamp}.jsonl`)
const records: unknown[] = []
let page = 1

while (true) {
  const result = await payload.find({
    collection: 'audit-logs',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    page,
    sort: 'createdAt',
  })
  records.push(...result.docs)
  if (!result.hasNextPage) break
  page += 1
}

await mkdir(outputDirectory, { recursive: true })
await writeFile(outputPath, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`, { encoding: 'utf8', mode: 0o600 })
payload.logger.info(`Exported ${records.length} audit records to ${outputPath}`)
process.exit(0)
