import config from '@payload-config'
import { getPayload } from 'payload'

import { generateArticleCover, getImageCandidateStorage, parseCandidates, selectCandidate } from '@/modules/ai-images'

const payload = await getPayload({ config })
const users = await payload.find({ collection: 'users', limit: 1, overrideAccess: true, sort: 'createdAt', where: { role: { equals: 'admin' } } })
const user = users.docs[0]
if (!user) throw new Error('No administrator exists.')
const sources = await payload.find({
  collection: 'source-materials', depth: 0, limit: 1, overrideAccess: true,
  where: { and: [{ author: { equals: user.id } }, { title: { equals: '数字花园固定人物参考图' } }] },
})
const reference = sources.docs[0]
if (!reference) throw new Error('Character reference is not imported.')

async function cleanupStaleSmokeRecords() {
  const stalePosts = await payload.find({ collection: 'posts', depth: 0, limit: 100, overrideAccess: true, where: { slug: { contains: 'issue010-smoke-' } } })
  for (const post of stalePosts.docs) {
    const coverId = post.cover && typeof post.cover === 'object' ? post.cover.id : post.cover
    await payload.delete({ collection: 'posts', id: post.id, overrideAccess: true })
    if (coverId) await payload.delete({ collection: 'media', id: coverId, overrideAccess: true }).catch(() => undefined)
  }
}

await cleanupStaleSmokeRecords()

const stamp = Date.now()
let postId: number | string | undefined
let generationId: number | string | undefined
let mediaId: number | string | undefined
try {
  const post = await payload.create({
    collection: 'posts', draft: true, overrideAccess: true,
    data: {
      author: user.id,
      content: { root: { children: [], direction: null, format: '', indent: 0, type: 'root', version: 1 } },
      contentType: 'knowledge', reviewState: 'editing', slug: `issue010-smoke-${stamp}`,
      summary: '生产验收：通过固定人物参考图生成数字花园文章封面，确认私有候选图、幂等和人工选用链路。',
      title: 'ISSUE-010 生产验收草稿',
    },
  })
  postId = post.id
  const input = {
    aspectRatio: '16:9' as const, count: 1, postId: post.id, referenceMaterialId: reference.id,
    stylePreset: 'character-editorial' as const,
    visualGoal: '同一位灰棕长发成年女孩在安静书桌前整理知识卡片，体现持续学习、知识连接与数字花园。',
  }
  const generated = await generateArticleCover(payload, user, input, {})
  generationId = generated.generationId
  if (generated.status !== 'succeeded' || generated.candidates.length !== 1) throw new Error('Image generation did not succeed.')
  const replay = await generateArticleCover(payload, user, input, {})
  if (replay.generationId !== generationId) throw new Error('Idempotency check failed.')
  const record = await payload.findByID({ collection: 'ai-image-generations', depth: 0, id: generationId, overrideAccess: true })
  if (record.generationCallCount !== 1 || (record.usage as { inputImages?: number } | undefined)?.inputImages !== 1) throw new Error('Usage or reference-image check failed.')
  const selected = await selectCandidate(payload, user, generationId, generated.candidates[0].id, {})
  mediaId = selected.mediaId
  const [draft, media] = await Promise.all([
    payload.findByID({ collection: 'posts', draft: true, id: post.id, overrideAccess: true }),
    payload.findByID({ collection: 'media', id: mediaId, overrideAccess: true }),
  ])
  const coverId = draft.cover && typeof draft.cover === 'object' ? draft.cover.id : draft.cover
  if (draft._status !== 'draft' || String(coverId) !== String(mediaId) || media.visibility !== 'private' || !media.aiGenerated) throw new Error('Draft binding verification failed.')
  console.log(JSON.stringify({ candidateCount: generated.candidates.length, generationCallCount: record.generationCallCount, inputImages: 1, selected: true, status: 'passed' }))
} finally {
  if (generationId) {
    const record = await payload.findByID({ collection: 'ai-image-generations', depth: 0, id: generationId, overrideAccess: true }).catch(() => null)
    if (record) {
      for (const candidate of parseCandidates(record.candidates)) await getImageCandidateStorage(candidate.storageDriver).delete(candidate.storageKey).catch(() => undefined)
    }
  }
  if (generationId) await payload.delete({ collection: 'ai-image-generations', id: generationId, overrideAccess: true }).catch(() => undefined)
  if (postId) await payload.delete({ collection: 'posts', id: postId, overrideAccess: true }).catch(() => undefined)
  if (mediaId) await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true }).catch(() => undefined)
}
