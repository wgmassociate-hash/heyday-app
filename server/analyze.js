import Anthropic from '@anthropic-ai/sdk'
import { ANALYSIS_SYSTEM_PROMPT } from '../src/utils/apiPrompt.js'
import { enrichResult } from '../shared/enrichResult.js'
import { truncateChatForAnalysis } from '../shared/truncateForAnalysis.js'

const DEFAULT_MODEL = 'claude-haiku-4-5'

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

function countMessages(text) {
  return text.split('\n').filter((l) => l.trim() && /:\s*.+/.test(l.trim())).length
}

/**
 * @param {string} anonymizedText
 */
export async function analyzeWithClaude(anonymizedText) {
  const client = getClient()
  const { text: apiText, truncated, totalMessages, analyzedMessages } =
    truncateChatForAnalysis(anonymizedText)

  const truncationNote = truncated
    ? `\n(참고: 전체 ${totalMessages}개 메시지 중 최근 ${analyzedMessages}개 구간을 분석합니다.)\n`
    : ''

  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    max_tokens: 2048,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `아래는 카카오톡 대화입니다. 「나」=본인, 「사용자」/사용자A=익명화된 상대방. JSON만 반환하세요.${truncationNote}\n\n---\n${apiText}\n---`,
      },
    ],
  })

  const block = message.content.find((b) => b.type === 'text')
  if (!block?.text) throw new Error('Claude 응답이 비어 있습니다')

  const parsed = extractJson(block.text)
  const result = enrichResult(parsed, countMessages(anonymizedText))
  if (truncated) {
    result.analysisMeta = { truncated: true, totalMessages, analyzedMessages }
  }
  return result
}
