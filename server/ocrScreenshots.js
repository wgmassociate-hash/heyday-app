import Anthropic from '@anthropic-ai/sdk'
import { OCR_SYSTEM_PROMPT } from './ocrPrompt.js'
import { mergeOcrSegments } from '../src/utils/mergeOcrText.js'

const MAX_IMAGES = 6
const MAX_B64_CHARS = 1_200_000

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다')
  return new Anthropic({ apiKey })
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  let raw = fenced ? fenced[1].trim() : text.trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) raw = raw.slice(start, end + 1)
  return JSON.parse(raw)
}

function normalizeMediaType(type) {
  const t = (type || 'image/jpeg').toLowerCase()
  if (t === 'image/jpg') return 'image/jpeg'
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(t)) return t
  return 'image/jpeg'
}

/**
 * @param {{ mediaType?: string, data: string }[]} images  base64 (no data: prefix)
 */
export async function extractChatFromScreenshots(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('스크린샷이 없습니다.')
  }
  if (images.length > MAX_IMAGES) {
    throw new Error(`스크린샷은 최대 ${MAX_IMAGES}장까지 가능합니다.`)
  }

  for (const img of images) {
    if (!img?.data || typeof img.data !== 'string') {
      throw new Error('잘못된 이미지 데이터입니다.')
    }
    if (img.data.length > MAX_B64_CHARS) {
      throw new Error('이미지 용량이 너무 큽니다. 더 작은 스크린샷을 사용해 주세요.')
    }
  }

  const client = getClient()
  const primaryModel = process.env.ANTHROPIC_OCR_MODEL || 'claude-haiku-4-5'
  const fallbackModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

  /** @type {import('@anthropic-ai/sdk').MessageParam['content']} */
  const content = [
    {
      type: 'text',
      text: `아래 ${images.length}장의 스크린샷은 사용자가 **대화 위에서 아래로** 스크롤하며 찍은 순서입니다.
각 이미지 번호에 맞게 segments JSON을 반환하세요.`,
    },
  ]

  images.forEach((img, i) => {
    content.push({
      type: 'text',
      text: `\n--- 이미지 ${i + 1} / ${images.length} ---`,
    })
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: normalizeMediaType(img.mediaType),
        data: img.data.replace(/^data:image\/\w+;base64,/, ''),
      },
    })
  })

  const request = () =>
    client.messages.create({
      model: primaryModel,
      max_tokens: 4096,
      system: OCR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

  let message
  let ocrModel = primaryModel
  try {
    message = await request()
  } catch (err) {
    const notFound = /not_found|404|model/i.test(err?.message || '')
    if (!notFound || primaryModel === fallbackModel) throw err
    console.warn(`[ocr] ${primaryModel} 실패 → ${fallbackModel} 폴백`)
    ocrModel = fallbackModel
    message = await client.messages.create({
      model: fallbackModel,
      max_tokens: 4096,
      system: OCR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })
  }

  const block = message.content.find((b) => b.type === 'text')
  if (!block?.text) throw new Error('OCR 응답이 비어 있습니다')

  let parsed
  try {
    parsed = extractJson(block.text)
  } catch {
    throw new Error('OCR 결과를 해석하지 못했습니다. 다시 시도해 주세요.')
  }

  const segments = (parsed.segments || [])
    .map((s) => ({
      index: Number(s.index) || 0,
      text: String(s.text || '').trim(),
    }))
    .filter((s) => s.text)
    .sort((a, b) => a.index - b.index)

  if (segments.length === 0) {
    throw new Error('스크린샷에서 대화를 읽지 못했습니다. 더 선명한 캡처를 사용해 주세요.')
  }

  const mergedText = mergeOcrSegments(segments)

  return {
    mergedText,
    segments,
    model: ocrModel,
    usage: message.usage,
  }
}
