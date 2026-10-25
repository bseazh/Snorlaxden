import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { AIGenerations } from './collections/AIGenerations'
import { AuditLogs } from './collections/AuditLogs'
import { Media } from './collections/Media'
import { FAQItems } from './collections/FAQItems'
import { Posts } from './collections/Posts'
import { Projects } from './collections/Projects'
import { Resources } from './collections/Resources'
import { Tags } from './collections/Tags'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Tags, Posts, Projects, Resources, FAQItems, AIGenerations, AuditLogs],
  globals: [SiteSettings],
  bodyParser: {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [],
})
