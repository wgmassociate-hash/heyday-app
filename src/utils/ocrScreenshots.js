import { compressImageForUpload } from './compressImage.js'

export const MAX_SCREENSHOTS = 6

async function ensureApiServer() {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error('health failed')
    const data = await res.json()
    if (!data?.ok) throw new Error('health not ok')
    return data
  } catch {
    throw new Error(
      'API 서버에 연결할 수 없습니다. 터미널에서 Ctrl+C 후 npm run dev 를 실행해 주세요. (웹만 켜진 상태일 수 있습니다)',
    )
  }
}

/**
 * @param {File[]} files  사용자가 정렬한 순서
 */
export async function ocrScreenshots(files) {
  if (!files?.length) throw new Error('스크린샷을 선택해 주세요.')
  if (files.length > MAX_SCREENSHOTS) {
    throw new Error(`스크린샷은 최대 ${MAX_SCREENSHOTS}장까지 가능합니다.`)
  }

  await ensureApiServer()

  const images = await Promise.all(files.map((file) => compressImageForUpload(file)))

  const payload = JSON.stringify({
    images: images.map(({ base64, mediaType }) => ({ data: base64, mediaType })),
  })

  if (payload.length > 10 * 1024 * 1024) {
    throw new Error('이미지 용량이 너무 큽니다. 스크린샷 장 수를 줄이거나 더 작은 이미지를 사용해 주세요.')
  }

  let response
  try {
    response = await fetch('/api/ocr-screenshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(180_000),
    })
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      throw new Error('OCR 처리 시간이 초과되었습니다. 스크린샷 장 수를 줄여 다시 시도해 주세요.')
    }
    throw new Error(
      'API 서버에 연결할 수 없습니다. npm run dev 로 API·웹 서버를 함께 실행해 주세요.',
    )
  }

  const raw = await response.text()
  let data
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    if (response.status === 404) {
      throw new Error(
        'OCR API를 찾을 수 없습니다. npm run dev 로 서버를 재시작해 주세요.',
      )
    }
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new Error(
        'API 서버(localhost:3001)가 꺼져 있거나 응답하지 않습니다. npm run dev 를 실행해 주세요.',
      )
    }
    const snippet = raw?.slice(0, 120).replace(/\s+/g, ' ')
    throw new Error(
      snippet
        ? `OCR 서버 응답 오류 (HTTP ${response.status}): ${snippet}`
        : `OCR 서버 응답 오류 (HTTP ${response.status}). npm run dev 로 재시작해 보세요.`,
    )
  }

  if (!response.ok) {
    throw new Error(data?.error || `OCR 오류 (HTTP ${response.status})`)
  }

  return data
}
