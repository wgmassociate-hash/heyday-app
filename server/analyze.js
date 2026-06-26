import Anthropic from '@anthropic-ai/sdk'
import { ANALYSIS_SYSTEM_PROMPT } from '../src/utils/apiPrompt.js'
import { enrichResult } from '../shared/enrichResult.js'

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
  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `아래는 카카오톡 대화입니다. 「나」=본인, 「사용자」/사용자A=익명화된 상대방. JSON만 반환하세요.\n\n---\n${anonymizedText}\n---`,
      },
    ],
  })

  const block = message.content.find((b) => b.type === 'text')
  if (!block?.text) throw new Error('Claude 응답이 비어 있습니다')

  const parsed = extractJson(block.text)
  return enrichResult(parsed, countMessages(anonymizedText))
}
