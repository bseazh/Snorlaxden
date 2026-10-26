import COS from 'cos-nodejs-sdk-v5'
import dotenv from 'dotenv'

dotenv.config({ path: process.env.SNORLAXDEN_ENV_FILE || '.env' })

export function cosClient() {
  const Bucket = process.env.COS_BUCKET
  const Region = process.env.COS_REGION
  const SecretId = process.env.COS_SECRET_ID
  const SecretKey = process.env.COS_SECRET_KEY
  if (!Bucket || !Region || !SecretId || !SecretKey) throw new Error('COS_CONFIGURATION_MISSING')
  return {
    Bucket,
    client: new COS({ Protocol: 'https:', SecretId, SecretKey, StrictSsl: true, Timeout: 15_000 }),
    Region,
  }
}

export function safeFailure(label) {
  console.error(label)
  process.exitCode = 1
}
