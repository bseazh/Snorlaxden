import type { ImageAspectRatio, ImageStylePreset } from '../domain'

export const articleCoverPromptVersion = 'article-cover-character-v1'

const styleDescriptions: Record<ImageStylePreset, string> = {
  'character-editorial': '现代编辑插画，精致彩色日系半写实轻Q数码手绘，干净、克制、适合个人知识网站',
  'warm-story': '温暖自然光、柔和叙事感、低饱和手绘质感，安静而有人情味',
  'tech-garden': '知识节点与数字花园意象，灰蓝和奶油白配色，结构清晰但不出现可读文字',
}

export function buildArticleCoverPrompt(input: {
  title: string
  summary: string
  visualGoal: string
  stylePreset: ImageStylePreset
  aspectRatio: ImageAspectRatio
}) {
  return [
    'Use case: illustration-story.',
    'Asset type: article cover for a personal digital garden.',
    `Article title context: ${input.title}.`,
    `Article summary context: ${input.summary}.`,
    `Primary visual request: ${input.visualGoal}.`,
    'Input image role: character identity and visual-style reference only; do not copy its collage layout, text, logos, accessories, pose, or background.',
    'Subject: the same adult Asian woman, clear oval face, calm almond eyes, long soft ash-brown hair, cool and composed exterior with subtle playful warmth; consistent identity; subtly chibi 5–6.5-head proportions, never childlike.',
    `Style/medium: ${styleDescriptions[input.stylePreset]}. Clearly a polished hand-drawn digital illustration, not a photograph and not a 3D render.`,
    `Composition: ${input.aspectRatio} landscape-ready cover composition, one character only, readable silhouette, useful breathing room for HTML title overlay; do not render the title inside the image.`,
    'Color palette: charcoal, warm gray, light beige, tea brown, cream skin pink, restrained gray-blue accents.',
    'Constraints: preserve face, hair color and adult age from the reference; natural hands; original unbranded clothing; no fake event evidence.',
    'Avoid: all readable text, typography, watermark, logo, trademark, collage, black cat, black mascot, animal companion, extra person, distorted hands, photorealism, plastic skin, oversized childlike eyes.',
  ].join('\n')
}

