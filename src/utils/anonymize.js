import { anonymizeChatText } from './parseChat.js'
import { scrubResultNames } from './scrubResult.js'

export { extractSpeakerNames, anonymizeChatText } from './parseChat.js'

/**
 * API 전송용 — 익명화된 텍스트만 전송합니다.
 */
export async function analyzeChat(rawText) {
  const { anonymizedText, nameMap } = anonymizeChatText(rawText)

  const runLocal = async (reason) => {
    console.warn('[analyze] 로컬 분석 폴백:', reason)
    const { analyzeLocally } = await import('./analyzeLocal.js')
    const result = analyzeLocally(anonymizedText, nameMap)
    return scrubResultNames({ ...result, source: 'local', fallbackReason: reason }, nameMap)
  }

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: anonymizedText, nameMap }),
    })

    let data
    try {
      data = await response.json()
    } catch {
      return runLocal('API 서버 응답을 읽을 수 없습니다.')
    }

    if (response.ok) {
      return scrubResultNames(data, nameMap)
    }

    return runLocal(data?.error || `API 오류 (HTTP ${response.status})`)
  } catch (err) {
    return runLocal(err?.message || 'API 서버에 연결할 수 없습니다')
  }
}
