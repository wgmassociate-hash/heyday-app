import { scrubResultNames } from './scrubResult.js'
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
 * Phase 2.1 (Privacy Review, item 6): anonymization/redaction used to happen
 * silently inside this function right before the fetch. It's now done once,
 * earlier, by src/utils/privacyPreview.js's buildPrivacyPreview() — shown to
 * the user in PrivacyReviewStep — and the *same* already-processed text and
 * nameMap are passed in here, so what the user reviewed is exactly what gets
 * sent (not a re-derived approximation of it).
 *
 * @param {{ anonymizedText: string, nameMap: Record<string, string>, intent: string }} params
 */
export async function analyzePreview({ anonymizedText, nameMap, intent }) {
  const response = await fetch('/api/preview', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text: anonymizedText, intent }),
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
