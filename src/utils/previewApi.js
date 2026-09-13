import { anonymizeChatText } from './parseChat.js'
import { scrubResultNames } from './scrubResult.js'
import { redactContactInfo } from './privacyRedaction.js'
import { apiHeaders } from './deviceId.js'

/**
 * Phase 2 — calls the new Relationship Engine's /api/preview route (v2's
 * Free Preview, docs/implementation_plan_v2.md §16.2). Unlike analyzeChat()
 * (src/utils/anonymize.js), this has no client-side local fallback: the new
 * engine's Code Feature Extractor + Score Engine has no client-side
 * equivalent to fall back to (src/utils/analyzeLocal.js is v1's old
 * raw-count heuristic, incompatible with §9's opportunity-rate design) — a
 * failure here is surfaced to the caller instead of silently degrading.
 *
 * @param {string} rawText
 * @param {string} intent
 */
export async function analyzePreview(rawText, intent) {
  const { anonymizedText, nameMap } = anonymizeChatText(rawText)
  const redactedText = redactContactInfo(scrubResultNames(anonymizedText, nameMap))

  const response = await fetch('/api/preview', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text: redactedText, intent }),
  })

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('서버 응답을 읽을 수 없습니다.')
  }

  if (response.status === 429 && data?.code === 'QUOTA_EXCEEDED') {
    const err = new Error(data.error || '오늘 AI 분석 횟수를 모두 사용했어요.')
    err.code = 'QUOTA_EXCEEDED'
    err.quota = data.quota
    throw err
  }

  if (!response.ok) {
    throw new Error(data?.error || `API 오류 (HTTP ${response.status})`)
  }

  return scrubResultNames(data, nameMap)
}
