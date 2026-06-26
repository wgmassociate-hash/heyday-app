/**
 * OCR 세그먼트를 사용자 지정 순서대로 합치고, 스크린샷 겹침 구간 중복 줄을 제거합니다.
 * @param {{ index?: number, text: string }[]} segments
 */
export function mergeOcrSegments(segments) {
  const sorted = [...segments].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  const out = []

  for (const seg of sorted) {
    const lines = String(seg.text || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    for (const line of lines) {
      const key = line.replace(/\s+/g, ' ')
      if (out.length >= 1 && out[out.length - 1] === key) continue
      if (out.length >= 2 && out.slice(-6).includes(key)) continue
      out.push(key)
    }
  }

  return out.join('\n')
}
