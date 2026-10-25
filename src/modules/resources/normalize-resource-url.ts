import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

import { ResourceError } from './domain'

export type NormalizedResourceURL = {
  canonicalUrl: string
  externalId?: string
  platform: 'bilibili' | 'youtube' | 'wechat_channels' | 'web'
  sourceKey: string
}

const TRACKING_PARAMETERS = new Set([
  'fbclid', 'from', 'gclid', 'igshid', 'share_medium', 'share_plat', 'share_session_id',
  'share_source', 'spm_id_from', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source',
  'utm_term', 'vd_source', 'feature', 'si',
])

function isPrivateIPv4(hostname: string) {
  const octets = hostname.split('.').map(Number)
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b] = octets
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168)
}

function isPrivateIPv6(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === '::' || host === '::1') return true
  if (host.startsWith('fc') || host.startsWith('fd') || /^fe[89ab]/.test(host)) return true
  const mapped = host.match(/^(?:0*:){6}(\d+\.\d+\.\d+\.\d+)$/)
  return Boolean(mapped?.[1] && isPrivateIPv4(mapped[1]))
}

function assertSafeHostname(rawHostname: string) {
  const hostname = rawHostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new ResourceError('UNSAFE_URL', '不能保存本机或局域网地址。')
  }
  if (hostname === 'metadata.google.internal' || hostname === 'metadata.google') {
    throw new ResourceError('UNSAFE_URL', '不能保存云服务元数据地址。')
  }
  const kind = isIP(hostname)
  if ((kind === 4 && isPrivateIPv4(hostname)) || (kind === 6 && isPrivateIPv6(hostname))) {
    throw new ResourceError('UNSAFE_URL', '不能保存环回、内网或链路本地地址。')
  }
}

function cleanParameters(url: URL) {
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETERS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key)
  }
  url.searchParams.sort()
  url.hash = ''
}

function youtubeId(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0]
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') return url.searchParams.get('v') || undefined
    const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{6,})/)
    return match?.[1]
  }
}

function bilibiliId(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host !== 'bilibili.com' && !host.endsWith('.bilibili.com')) return undefined
  return url.pathname.match(/\/video\/(BV[A-Za-z0-9]+)/i)?.[1]
}

export function normalizeResourceURL(input: string): NormalizedResourceURL {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new ResourceError('UNSAFE_URL', '请输入完整的 http 或 https URL。')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ResourceError('UNSAFE_URL', '仅允许 http 或 https URL。')
  if (url.username || url.password) throw new ResourceError('UNSAFE_URL', 'URL 不能包含账号或密码。')
  assertSafeHostname(url.hostname)
  cleanParameters(url)

  const youtube = youtubeId(url)
  if (youtube && /^[A-Za-z0-9_-]{6,}$/.test(youtube)) {
    const canonicalUrl = `https://www.youtube.com/watch?v=${youtube}`
    return { canonicalUrl, externalId: youtube, platform: 'youtube', sourceKey: `youtube:${youtube}` }
  }

  const bilibili = bilibiliId(url)
  if (bilibili) {
    const externalId = `BV${bilibili.slice(2)}`
    const canonicalUrl = `https://www.bilibili.com/video/${externalId}`
    return { canonicalUrl, externalId, platform: 'bilibili', sourceKey: `bilibili:${externalId.toLowerCase()}` }
  }

  url.hostname = url.hostname.toLowerCase()
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  const canonicalUrl = url.toString()
  const platform = /(^|\.)channels\.weixin\.qq\.com$/i.test(url.hostname) ? 'wechat_channels' : 'web'
  const digest = createHash('sha256').update(canonicalUrl).digest('hex')
  return { canonicalUrl, platform, sourceKey: `url:${digest}` }
}

