import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ANALYSIS_SYSTEM_PROMPT } from '../src/utils/apiPrompt.js'
import { enrichResult } from '../shared/enrichResult.js'
import { truncateChatForAnalysis } from '../shared/truncateForAnalysis.js'
import { AnalysisResponseSchema } from './analyzeSchema.ts'
import { getUsageLogRepository } from './db/repositories/usageLogRepository.ts'
import { estimateCostUsd } from './db/pricing.ts'

const DEFAULT_MODEL = 'claude-sonnet-4-6'

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다')
  return new Anthropic({ apiKey })
}

/** Fallback for the (expected-rare) case where structured output parsing fails
 * but the model still returned recognizable JSON as plain text. Kept only as
 * a safety net — see docs/implementation_plan_v2.md §20 Phase 0. */
function extractJsonFallback(text) {
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
 * @param {string} [deviceId]
 */
export async function analyzeWithClaude(anonymizedText, deviceId) {
  const client = getClient()
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL
  const { text: apiText, truncated, totalMessages, analyzedMessages } =
    truncateChatForAnalysis(anonymizedText)

  const truncationNote = truncated
    ? `\n(참고: 전체 ${totalMessages}개 메시지 중 최근 ${analyzedMessages}개 구간을 분석합니다.)\n`
    : ''

  const userContent = `아래는 카카오톡 대화입니다. 「나」=본인, 「상대방」/상대방A=익명화된 상대.
각 텍스트 필드(aiSummary, psychologySummary, solution, interpretation 등)는 **짧게 쓰지 말고** 프롬프트에 적힌 최소 문장 수를 지키세요. JSON만 반환하세요.${truncationNote}\n\n---\n${apiText}\n---`

  // apiPrompt.js asks for a lot of required, multi-sentence Korean fields —
  // 4096 tokens was empirically observed to truncate the structured-output
  // JSON mid-string during Phase 0 live testing (docs/implementation_plan_v2.md
  // §20 Phase 0 record). Raised so the *first* attempt has room to finish.
  const MAX_OUTPUT_TOKENS = 8192

  const startedAt = Date.now()
  let usage = null
  let success = false
  let errorMessage = null

  try {
    let message
    try {
      message = await client.messages.parse({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
        output_config: { format: zodOutputFormat(AnalysisResponseSchema) },
      })
      usage = message.usage
    } catch (parseErr) {
      // Structured output failed to parse (e.g. truncated JSON) even after
      // raising max_tokens — fall back to 1.0's original unconstrained call +
      // regex extraction once, rather than failing the whole request outright.
      console.warn('[analyze] structured output 실패, 레거시 방식으로 재시도:', parseErr?.message)
      message = await client.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      })
      usage = message.usage
    }

    let parsed = message.parsed_output
    if (!parsed) {
      const block = message.content.find((b) => b.type === 'text')
      if (!block?.text) throw new Error('Claude 응답이 비어 있습니다')
      parsed = extractJsonFallback(block.text)
    }

    const result = enrichResult(parsed, countMessages(anonymizedText))
    if (truncated) {
      result.analysisMeta = { truncated: true, totalMessages, analyzedMessages }
    }
    success = true
    return result
  } catch (err) {
    errorMessage = err?.message || String(err)
    throw err
  } finally {
    void getUsageLogRepository()
      .record({
        deviceId: deviceId ?? null,
        callSite: 'analyze',
        model,
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
        costEstimate: usage ? estimateCostUsd(model, usage.input_tokens, usage.output_tokens) : 0,
        durationMs: Date.now() - startedAt,
        success,
        errorMessage,
      })
      .catch((logErr) => console.warn('[usage-log]', logErr?.message || logErr))
  }
}
