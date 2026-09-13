import { anonymizeChatText } from './parseChat.js'
import { scrubResultNames } from './scrubResult.js'
import { redactContactInfo } from './privacyRedaction.js'
import { apiHeaders } from './deviceId.js'

export { extractSpeakerNames, anonymizeChatText } from './parseChat.js'

/**
 * API 전송용 — 익명화된 텍스트만 전송합니다.
 *
 * 2.0 Phase 0: `nameMap`(실명→라벨 대응표) 자체는 더 이상 서버로 전송하지
 * 않는다(docs/implementation_plan_v2.md §6.2). 대신 이 함수가 전송 직전에
 * `anonymizedText`에 남아있을 수 있는 본문 내 실명(줄머리가 아닌 위치)과
 * 전화번호/이메일을 클라이언트에서 먼저 가린다. `nameMap`은 로컬 폴백
 * 분석과 응답 사후 스크러빙(§6.2 방어선)에만 계속 쓰인다.
 */
export async function analyzeChat(rawText) {
  const { anonymizedText, nameMap } = anonymizeChatText(rawText)
  const redactedText = redactContactInfo(scrubResultNames(anonymizedText, nameMap))

  const runLocal = async (reason) => {
    console.warn('[analyze] 로컬 분석 폴백:', reason)
    const { analyzeLocally } = await import('./analyzeLocal.js')
    const result = analyzeLocally(anonymizedText, nameMap)
    return scrubResultNames({ ...result, source: 'local', fallbackReason: reason }, nameMap)
  }

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text: redactedText }),
    })

    let data
    try {
      data = await response.json()
    } catch {
      return runLocal('API 서버 응답을 읽을 수 없습니다.')
    }

    if (response.status === 429 && data?.code === 'QUOTA_EXCEEDED') {
      const err = new Error(data.error || '오늘 AI 분석 횟수를 모두 사용했어요.')
      err.code = 'QUOTA_EXCEEDED'
      err.quota = data.quota
      throw err
    }

    if (response.ok) {
      const cleaned = scrubResultNames(data, nameMap)
      if (data.quota) cleaned.quota = data.quota
      return cleaned
    }

    return runLocal(data?.error || `API 오류 (HTTP ${response.status})`)
  } catch (err) {
    if (err?.code === 'QUOTA_EXCEEDED') throw err
    return runLocal(err?.message || 'API 서버에 연결할 수 없습니다')
  }
}
