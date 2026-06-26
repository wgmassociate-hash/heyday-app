/** @typedef {{ dateMs: number, dateLabel: string, timeLabel: string, fullLabel: string }} ParsedDateTime */

const DAY_MS = 86400000

const MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/**
 * @param {number} y
 * @param {number} mo 1-12
 * @param {number} d
 * @param {number} h 0-23
 * @param {number} min
 */
function toMs(y, mo, d, h, min) {
  return new Date(y, mo - 1, d, h, min, 0, 0).getTime()
}

/**
 * @param {string} ts
 * @returns {ParsedDateTime | null}
 */
export function parseDateTime(ts) {
  if (!ts?.trim()) return null
  const s = ts.trim()

  // 2024년 6월 20일 오후 7:12
  let m = s.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)?\s*(\d{1,2}):(\d{2})/)
  if (m) {
    let h = +m[5]
    const min = +m[6]
    if (m[4] === '오후' && h < 12) h += 12
    if (m[4] === '오전' && h === 12) h = 0
    return make(+m[1], +m[2], +m[3], h, min)
  }

  // 2024. 6. 20. 오후 7:12 / 2024.06.20 19:12
  m = s.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(?:(오전|오후)\s*)?(\d{1,2}):(\d{2})/)
  if (m) {
    let h = +m[5]
    const min = +m[6]
    if (m[4] === '오후' && h < 12) h += 12
    if (m[4] === '오전' && h === 12) h = 0
    if (!m[4] && h < 12 && /오후|PM/i.test(s)) h += 12
    return make(+m[1], +m[2], +m[3], h, min)
  }

  // 2024-06-20 19:12(:03)? / 2024/06/20 19:12
  m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\([月火水木金土日]\))?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    return make(+m[1], +m[2], +m[3], +m[4], +m[5])
  }

  // 6/20/24 7:12 PM
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/)
  if (m) {
    let y = +m[3]
    if (y < 100) y += 2000
    let h = +m[4]
    const min = +m[5]
    if (m[6]?.toUpperCase() === 'PM' && h < 12) h += 12
    if (m[6]?.toUpperCase() === 'AM' && h === 12) h = 0
    return make(y, +m[1], +m[2], h, min)
  }

  // Jun 20, 2024 at 7:12 PM
  m = s.match(/([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (m) {
    const mo = MONTH_MAP[m[1].toLowerCase().slice(0, 3)]
    if (mo == null) return null
    let h = +m[4]
    const min = +m[5]
    if (m[6]?.toUpperCase() === 'PM' && h < 12) h += 12
    if (m[6]?.toUpperCase() === 'AM' && h === 12) h = 0
    return make(+m[3], mo + 1, +m[2], h, min)
  }

  // 오후 7:12 only (날짜 컨텍스트 필요)
  m = s.match(/^(?:오전|오후)\s*(\d{1,2}):(\d{2})$/)
  if (m) {
    let h = +m[1]
    const min = +m[2]
    if (/오후/.test(s) && h < 12) h += 12
    if (/오전/.test(s) && h === 12) h = 0
    return { partial: true, h, min }
  }

  // 19:12 only
  m = s.match(/^(\d{1,2}):(\d{2})$/)
  if (m) return { partial: true, h: +m[1], min: +m[2] }

  return null
}

/**
 * @param {number} y
 * @param {number} mo
 * @param {number} d
 * @param {number} h
 * @param {number} min
 */
function make(y, mo, d, h, min) {
  const dateMs = toMs(y, mo, d, h, min)
  const dateLabel = `${mo}/${d}`
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 || 12
  const timeLabel = `${ampm} ${h12}:${String(min).padStart(2, '0')}`
  return {
    dateMs,
    dateLabel: `${y}.${mo}.${d}.`,
    timeLabel,
    fullLabel: `${mo}/${d} ${timeLabel}`,
  }
}

/**
 * 날짜 헤더 줄에서 날짜만 추출 (메시지 줄과 구분)
 * @param {string} line
 */
export function parseDateHeader(line) {
  const trimmed = line.trim()

  // 카카오: --------------- 2024년 6월 21일 금요일 ---------------
  const kakaoSep = trimmed.match(
    /^-{2,}\s*(\d{4}년\s+\d{1,2}월\s+\d{1,2}일(?:\s+[월화수목금토일]요일)?)\s*-{2,}$/,
  )
  if (kakaoSep) {
    const m = kakaoSep[1].match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/)
    if (m) return headerDate(+m[1], +m[2], +m[3])
  }

  // 날짜만 단독으로 있는 줄 (메시지 없음)
  const koreanOnly = trimmed.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(?:\s+[월화수목금토일]요일)?\s*$/)
  if (koreanOnly) return headerDate(+koreanOnly[1], +koreanOnly[2], +koreanOnly[3])

  const slashOnly = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\([月火水木金土日]\))?\s*$/)
  if (slashOnly) return headerDate(+slashOnly[1], +slashOnly[2], +slashOnly[3])

  const dotOnly = trimmed.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*$/)
  if (dotOnly) return headerDate(+dotOnly[1], +dotOnly[2], +dotOnly[3])

  return null
}

function headerDate(y, mo, d) {
  return {
    y, mo, d,
    dateMs: new Date(y, mo - 1, d, 0, 0, 0, 0).getTime(),
    label: `${mo}/${d}`,
  }
}

/**
 * @param {{ partial?: boolean, h?: number, min?: number } | ParsedDateTime} partial
 * @param {{ y: number, mo: number, d: number }} ctx
 */
export function applyDateContext(partial, ctx) {
  if (!partial?.partial || !ctx) return null
  return make(ctx.y, ctx.mo, ctx.d, partial.h ?? 0, partial.min ?? 0)
}

/**
 * @param {number} ms
 */
export function formatSpanLabel(ms) {
  const days = Math.max(1, Math.round(ms / DAY_MS))
  if (days < 7) return `${days}일`
  const weeks = Math.floor(days / 7)
  const rem = days % 7
  if (weeks < 4) return rem ? `${weeks}주 ${rem}일` : `${weeks}주`
  const months = Math.floor(days / 30)
  const remD = days % 30
  return remD ? `약 ${months}개월 ${remD}일` : `약 ${months}개월`
}

/**
 * @param {number} dateMs
 */
export function weekKey(dateMs) {
  const d = new Date(dateMs)
  const start = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - start) / DAY_MS + start.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

export { DAY_MS }
