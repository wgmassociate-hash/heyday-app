export const SELF_SPEAKER_LABEL = '나'

/** 1:1 상대방 단일 라벨 */
export const OTHER_SINGLE_LABEL = '상대방'

/** OCR·카톡 본인 — 반드시 「나」로만 표기 (「상대방」은 상대 전용) */
export const SELF_SPEAKER_ALIASES = new Set(['나', '내', '본인', 'Me', 'me'])

export const OTHER_PSEUDO_SPEAKERS = new Set(['상대', '상대방', '타인'])

const LEGACY_OTHER_LABEL = '사용자'
const LEGACY_OTHER_PATTERN = /^사용자([A-Z])?$/
const LEGACY_PERSON_PATTERN = /^인물([A-Z])$/

/** @param {number} index 0-based @param {number} totalOthers */
export function anonymousSpeakerLabel(index, totalOthers = 1) {
  if (totalOthers === 1) return OTHER_SINGLE_LABEL
  return `상대방${String.fromCharCode(65 + index)}`
}

export function isLegacyOtherLabel(name) {
  const n = String(name || '').trim()
  if (n === LEGACY_OTHER_LABEL) return true
  return LEGACY_OTHER_PATTERN.test(n) || LEGACY_PERSON_PATTERN.test(n)
}

export function isAnonymizedOtherLabel(name) {
  const n = String(name || '').trim()
  if (n === OTHER_SINGLE_LABEL) return true
  if (/^상대방[A-Z]$/.test(n)) return true
  return isLegacyOtherLabel(n)
}

/** @param {string} label */
export function normalizeSpeakerDisplayLabel(label) {
  const n = String(label || '').trim()
  if (!n) return n
  if (n === LEGACY_OTHER_LABEL || n === '상대') return OTHER_SINGLE_LABEL
  const legacyUser = n.match(/^사용자([A-Z])$/)
  if (legacyUser) return `상대방${legacyUser[1]}`
  const legacyPerson = n.match(/^인물([A-Z])$/)
  if (legacyPerson) return `상대방${legacyPerson[1]}`
  return n
}

/** AI 리포트 등에 남은 구 라벨을 상대방으로 통일 */
export function normalizeReportCopy(text) {
  if (typeof text !== 'string' || !text) return text
  return text
    .replace(/사용자([A-Z])/g, '상대방$1')
    .replace(/인물([A-Z])/g, '상대방$1')
    .replace(/(?<![가-힣A-Z])사용자(?=[가는을를와과이]|[^A-Za-z]|$)/g, '상대방')
}

export function isSelfSpeaker(name) {
  const n = String(name || '').trim()
  if (n === SELF_SPEAKER_LABEL) return true
  if (isAnonymizedOtherLabel(n)) return false
  return SELF_SPEAKER_ALIASES.has(n)
}

export function isOtherPseudoSpeaker(name) {
  return OTHER_PSEUDO_SPEAKERS.has(String(name || '').trim())
}

export function isPseudoSpeaker(name) {
  return isSelfSpeaker(name) || isOtherPseudoSpeaker(name)
}

function hasAnonymizedOtherInText(text) {
  const t = text || ''
  return (
    /(?:^|\n)상대방(?:[A-Z])?\s*[:：]/m.test(t) ||
    /,\s*상대방(?:[A-Z])?\s*[:：]/.test(t) ||
    /\[(상대방(?:[A-Z])?)\]\s+\[(?:오전|오후)/.test(t) ||
    /(?:^|\n)사용자(?:[A-Z])?\s*[:：]/m.test(t) ||
    /,\s*사용자(?:[A-Z])?\s*[:：]/.test(t) ||
    /\[(사용자(?:[A-Z])?)\]\s+\[(?:오전|오후)/.test(t)
  )
}

export function isAlreadyAnonymized(text) {
  const t = text || ''
  const hasSelf = textHasSelfSpeaker(t)
  const hasOther = hasAnonymizedOtherInText(t)
  if (hasSelf && hasOther) return true
  if (hasOther && !hasRawSpeakerNames(t)) return true
  if (/(?:^|\n)\[(?:상대방|사용자)[A-Z]?\]\s*[:：]/.test(t)) return true
  return false
}

function hasRawSpeakerNames(text) {
  return extractRawColonSpeakers(text).some((s) => !isSelfSpeaker(s) && !isAnonymizedOtherLabel(s) && !isOtherPseudoSpeaker(s))
}

/** 한 줄에서 발화者 이름 추출 (PC 드래그·카톡 txt·[이름] [오후 10:21] 형식) */
function extractSpeakerNameFromLine(line) {
  const trimmed = String(line || '').trim()
  if (!trimmed) return null

  const bracket = trimmed.match(/^\[(.+?)\]\s+\[(?:오전|오후)\s+\d{1,2}:\d{2}\]/)
  if (bracket) return bracket[1].trim()

  const bracketDate = trimmed.match(/^\[(.+?)\]\s+\d{4}년/)
  if (bracketDate) return bracketDate[1].trim()

  const kakaoExport = trimmed.match(
    /^\d{4}년\s+\d{1,2}월\s+\d{1,2}일\s+(?:오전|오후)\s+\d{1,2}:\d{2},\s*(.+?)\s*[:：]\s*.+/,
  )
  if (kakaoExport) return kakaoExport[1].trim()

  if (!trimmed.startsWith('[')) {
    const plain = trimmed.match(/^(.{1,30}?)\s*[:：]\s*.+/)
    if (plain && !/^\d{4}/.test(plain[1].trim())) return plain[1].trim()
  }

  return null
}

function lineHasSelfSpeakerLabel(line) {
  const name = extractSpeakerNameFromLine(line)
  return name === SELF_SPEAKER_LABEL
}

export function extractRawColonSpeakers(text) {
  const speakers = []
  const seen = new Set()
  for (const line of (text || '').split('\n')) {
    const name = extractSpeakerNameFromLine(line)
    if (!name || seen.has(name)) continue
    seen.add(name)
    speakers.push(name)
  }
  return speakers
}

export function buildAnonymizationMap(speakersOrdered, selfSpeakerName = null) {
  const selfName = selfSpeakerName ? String(selfSpeakerName).trim() : null
  const others = speakersOrdered.filter((s) => {
    const n = String(s || '').trim()
    if (selfName && n === selfName) return false
    return n && !isSelfSpeaker(n) && n !== SELF_SPEAKER_LABEL
  })
  const totalOthers = others.length

  /** @type {Record<string, string>} */
  const nameMap = {}
  let otherIndex = 0

  for (const raw of speakersOrdered) {
    const name = String(raw || '').trim()
    if (!name || nameMap[name]) continue
    if (name === SELF_SPEAKER_LABEL) continue
    if (isAnonymizedOtherLabel(name)) continue

    if (selfName && name === selfName) {
      nameMap[name] = SELF_SPEAKER_LABEL
    } else if (isSelfSpeaker(name)) {
      if (name !== SELF_SPEAKER_LABEL) nameMap[name] = SELF_SPEAKER_LABEL
    } else {
      nameMap[name] = anonymousSpeakerLabel(otherIndex++, totalOthers)
    }
  }

  return nameMap
}

export function getAnonymizationChanges(nameMap) {
  return Object.entries(nameMap).filter(([from, to]) => from !== to)
}

export function applySpeakerAnonymization(text, nameMap) {
  if (!text || !nameMap || Object.keys(nameMap).length === 0) return text

  const sorted = Object.keys(nameMap).sort((a, b) => b.length - a.length)

  return text
    .split('\n')
    .map((line) => {
      let out = line
      for (const name of sorted) {
        const target = nameMap[name]
        if (!target || target === name) continue
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        out = out.replace(new RegExp(`^\\[${escaped}\\]`), `[${target}]`)
        out = out.replace(new RegExp(`^${escaped}\\s*([:：])`), `${target} $1`)
        out = out.replace(new RegExp(`,\\s*${escaped}\\s*([:：])`), `, ${target} $1`)
      }
      return out
    })
    .join('\n')
}

/** OCR 직후: 「나」가 없고 1:1이면 상대만 상대방으로, 본인 라벨 복구 시도 */
export function preprocessOcrSpeakers(text) {
  let out = text || ''
  const speakers = extractRawColonSpeakers(out)
  const hasNa = speakers.some((s) => s === '나') || /^나\s*[:：]/m.test(out)
  if (hasNa) return out

  const nonSelf = speakers.filter((s) => !isSelfSpeaker(s) && !isOtherPseudoSpeaker(s))
  if (nonSelf.length === 1 && speakers.includes('나') === false) {
    return out
  }

  return out
}

/** 특정 발화자 라벨을 「나」로 바꾸고 1:1이면 나머지는 「상대방」 */
export function assignSelfSpeaker(text, speakerToBeSelf) {
  const from = String(speakerToBeSelf || '').trim()
  if (!from || from === SELF_SPEAKER_LABEL) return text

  const speakers = extractRawColonSpeakers(text)
  if (speakers.length === 0) return text

  const nameMap = buildAnonymizationMap(speakers, isAnonymizedOtherLabel(from) ? null : from)
  if (isAnonymizedOtherLabel(from)) {
    nameMap[from] = SELF_SPEAKER_LABEL
    const others = speakers.filter((s) => s !== from && s !== SELF_SPEAKER_LABEL)
    if (others.length === 1) {
      nameMap[others[0]] = OTHER_SINGLE_LABEL
    }
  }

  return applySpeakerAnonymization(text, nameMap)
}

export function normalizeLegacyAnonLabels(text) {
  let out = text || ''
  out = out.replace(/\[사용자([A-Z]?)\]/g, (_, l) => (l ? `상대방${l}` : '상대방'))
  out = out.replace(/\[인물([A-Z]?)\]/g, (_, l) => (l ? `상대방${l}` : '상대방'))
  out = out.replace(/(^|\n)사용자([A-Z]?)\s*([:：])/g, (_, pre, l, colon) => `${pre}상대방${l || ''} ${colon}`)
  out = out.replace(/,\s*사용자([A-Z]?)\s*([:：])/g, (_, l, colon) => `, 상대방${l || ''} ${colon}`)
  return out
}

export function textHasSelfSpeaker(text) {
  for (const line of (text || '').split('\n')) {
    if (lineHasSelfSpeakerLabel(line)) return true
  }
  return false
}

/** txt·PC 붙여넣기 — 아직 실명이 남아 있을 때 본인 후보 (중복 제거) */
export function getSelfPickCandidatesForImport(text) {
  if (textHasSelfSpeaker(text)) return []
  if (isAlreadyAnonymized(text)) return []

  const seen = new Set()
  const candidates = []
  for (const s of extractRawColonSpeakers(text)) {
    if (s === SELF_SPEAKER_LABEL) continue
    if (isOtherPseudoSpeaker(s)) continue
    if (isAnonymizedOtherLabel(s)) continue
    if (seen.has(s)) continue
    seen.add(s)
    candidates.push(s)
  }
  return candidates
}

/** 익명화됐지만 「나」 없음 → 본인 선택 (상대방A 등) */
export function getSelfPickCandidates(text) {
  if (textHasSelfSpeaker(text)) return []
  return extractRawColonSpeakers(text).filter(
    (s) => s !== SELF_SPEAKER_LABEL && (isAnonymizedOtherLabel(s) || !isSelfSpeaker(s)),
  )
}

/** txt/드래그: 실명 2명 이상이면 본인 선택 필요 */
export function needsSelfSpeakerSelection(text) {
  if (textHasSelfSpeaker(text)) return false
  if (isAlreadyAnonymized(text)) {
    return getSelfPickCandidates(text).length > 0
  }
  return getSelfPickCandidatesForImport(text).length >= 2
}
