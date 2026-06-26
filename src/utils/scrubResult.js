/**
 * Claude/로컬 분석 결과 JSON에서 실명을 [인물A] 등으로 재치환
 * @param {object} result
 * @param {Record<string, string>} nameMap  { "민수": "[인물A]", ... }
 */
export function scrubResultNames(result, nameMap) {
  if (!result || !nameMap || Object.keys(nameMap).length === 0) return result

  const names = Object.keys(nameMap).sort((a, b) => b.length - a.length)

  const scrub = (str) => {
    if (typeof str !== 'string') return str
    let out = str
    for (const name of names) {
      out = out.split(name).join(nameMap[name])
    }
    return out
  }

  const walk = (obj) => {
    if (typeof obj === 'string') return scrub(obj)
    if (Array.isArray(obj)) return obj.map(walk)
    if (obj && typeof obj === 'object') {
      const next = {}
      for (const [k, v] of Object.entries(obj)) next[k] = walk(v)
      return next
    }
    return obj
  }

  return walk(result)
}

/**
 * @param {string} text
 * @param {Record<string, string>} nameMap
 */
export function scrubText(text, nameMap) {
  return scrubResultNames({ t: text }, nameMap).t
}
