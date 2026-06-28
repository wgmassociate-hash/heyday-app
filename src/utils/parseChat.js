import {
  parseDateTime,
  parseDateHeader,
  applyDateContext,
  formatSpanLabel,
  weekKey,
  DAY_MS,
} from './dateUtils.js'
import {
  isAlreadyAnonymized,
  isPseudoSpeaker,
  isAnonymizedOtherLabel,
  buildAnonymizationMap,
  applySpeakerAnonymization,
  preprocessOcrSpeakers,
  normalizeLegacyAnonLabels,
  SELF_SPEAKER_LABEL,
} from './speakerLabels.js'

const SYSTEM_SENDERS = new Set([
  '알 수 없음', '카카오톡', '시스템', 'Unknown',
  '보낸 사람', '받는 사람',
])

/** @typedef {'kakao'|'line'|'sms'|'generic'} Platform */

const LINE_PATTERNS = [
  {
    platform: 'kakao',
    regex: /^(\d{4}년\s+\d{1,2}월\s+\d{1,2}일\s+(?:오전|오후)\s+\d{1,2}:\d{2}),?\s*(.+?)\s*[:：]\s*(.*)$/,
    speaker: 2, content: 3, timestamp: 1,
  },
  {
    platform: 'kakao',
    regex: /^(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*(?:오전|오후)\s+\d{1,2}:\d{2}),?\s*(.+?)\s*[:：]\s*(.*)$/,
    speaker: 2, content: 3, timestamp: 1,
  },
  {
    platform: 'kakao',
    regex: /^\[(.+?)\]\s+\[((?:오전|오후)\s+\d{1,2}:\d{2})\]\s*(.*)$/,
    speaker: 1, content: 3, timestamp: 2,
  },
  {
    platform: 'line',
    regex: /^\[(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})\]\s*(.+?)\s*[:：]\s*(.*)$/,
    speaker: 2, content: 3, timestamp: 1,
  },
  {
    platform: 'line',
    regex: /^(\d{4}\/\d{1,2}\/\d{1,2}(?:\([月火水木金土日]\))?)\s+(\d{1,2}:\d{2})\s+(.+?)\s{2,}(.+)$/,
    speaker: 3, content: 4, timestamp: 0, timestampTime: 2,
    combineTs: (m) => `${m[1]} ${m[2]}`,
  },
  {
    platform: 'line',
    regex: /^(\d{4}\.\d{1,2}\.\d{1,2})\s+(\d{1,2}:\d{2})\s+(.+?)\s*[:：]?\s*(.+)$/,
    speaker: 3, content: 4, timestamp: 0, timestampTime: 2,
    combineTs: (m) => `${m[1]} ${m[2]}`,
  },
  {
    platform: 'sms',
    regex: /^(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]\s*(.+?)\s*[:：]\s*(.*)$/,
    speaker: 2, content: 3, timestamp: 1,
  },
  {
    platform: 'sms',
    regex: /^(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?),?\s*(.+?)\s*[:：]\s*(.*)$/,
    speaker: 2, content: 3, timestamp: 1,
  },
  {
    platform: 'sms',
    regex: /^(\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[-–—]\s*(.+?)\s*[:：]\s*(.*)$/,
    speaker: 2, content: 3, timestamp: 1,
  },
  {
    platform: 'generic',
    regex: /^(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}),?\s*(.+?)\s*[:：]\s*(.*)$/,
    speaker: 2, content: 3, timestamp: 1,
  },
  {
    platform: 'kakao',
    regex: /^\[(.+?)\]\s+(\d{4}년\s+\d{1,2}월\s+\d{1,2}일\s+(?:오전|오후)\s+\d{1,2}:\d{2})\s*[-–—]?\s*(.*)$/,
    speaker: 1, content: 3, timestamp: 2,
  },
  {
    platform: 'line',
    regex: /^(\d{1,2}:\d{2})\s+(.+?)\s{2,}(.+)$/,
    speaker: 2, content: 3, timestamp: 1, needsDateContext: true,
  },
  {
    platform: 'generic',
    regex: /^(나|상대방(?:[A-Z])?|사용자(?:[A-Z])?)\s*[:：]\s*(.*)$/,
    speaker: 1, content: 2, timestamp: null,
  },
  {
    platform: 'generic',
    regex: /^\[(상대방[A-Z]|사용자[A-Z]|인물[A-Z])\]\s*[:：]\s*(.*)$/,
    speaker: 1, content: 2, timestamp: null,
  },
  {
    platform: 'generic',
    regex: /^(?!(?:\d{4}년|\d{4}\.|\d{4}[-/]|\[|\s*$))(.+?)\s*[:：]\s*(.+)$/,
    speaker: 1, content: 2, timestamp: null,
  },
]

// PC 카톡 드래그: 날짜·시간만 있는 줄
const DATETIME_ONLY = /^(\d{4}년\s+\d{1,2}월\s+\d{1,2}일\s+(?:오전|오후)\s+\d{1,2}:\d{2}),?\s*$/
// PC 카톡: 날짜+이름만 (메시지는 다음 줄)
const DATETIME_NAME_ONLY = /^(\d{4}년\s+\d{1,2}월\s+\d{1,2}일\s+(?:오전|오후)\s+\d{1,2}:\d{2}),?\s*(.+?)\s*:\s*$/
const DATETIME_SPEAKER_ONLY = /^(\d{4}년\s+\d{1,2}월\s+\d{1,2}일\s+(?:오전|오후)\s+\d{1,2}:\d{2}),?\s*(.+?)\s*$/
// [이름] [오후 3:21] 헤더만
const BRACKET_HEADER_ONLY = /^\[(.+?)\]\s+\[((?:오전|오후)\s+\d{1,2}:\d{2})\]\s*$/
// 이름: (메시지 없음, 다음 줄)
const SPEAKER_COLON_ONLY = /^(?!(?:\d{4}년|\d{4}\.|\d{4}[-/]|\[))(.+?)\s*[:：]\s*$/

function isValidSpeaker(name) {
  if (!name) return false
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 25) return false
  if (SYSTEM_SENDERS.has(trimmed)) return false
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return false
  if (/^\d+$/.test(trimmed)) return false
  if (/^\+?\d{2,3}-?\d{8,}$/.test(trimmed)) return false
  return true
}

/** 실명·닉네임 + OCR 라벨 + 익명화된 나/상대방A */
function isRecognizedSpeaker(name) {
  const n = String(name || '').trim()
  if (n === SELF_SPEAKER_LABEL) return true
  if (isAnonymizedOtherLabel(n)) return true
  if (isPseudoSpeaker(n)) return true
  if (/^\[(?:상대방|사용자|인물)[A-Z]?\]$/.test(n)) return true
  return isValidSpeaker(n)
}

function extractColonBasedSpeakers(text) {
  const speakers = []
  const seen = new Set()
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || parseDateHeader(line)) continue
    if (DATETIME_ONLY.test(line)) continue
    const m = line.match(/^(.{1,25}?)\s*[:：]\s*.+/)
    if (!m) continue
    const name = m[1].trim()
    if (!isRecognizedSpeaker(name)) continue
    if (!seen.has(name)) {
      seen.add(name)
      speakers.push(name)
    }
  }
  return speakers
}

function attachDateTime(tsRaw, dateCtx) {
  let dt = tsRaw ? parseDateTime(tsRaw) : null
  if (dt?.partial && dateCtx) dt = applyDateContext(dt, dateCtx)
  return {
    timestamp: tsRaw || '',
    dateMs: dt?.dateMs ?? null,
    dateLabel: dt?.dateLabel ?? dateCtx?.label ?? '',
  }
}

function buildMessage(speaker, content, tsRaw, dateCtx, platform) {
  if (!isRecognizedSpeaker(speaker) || !content?.trim()) return null
  const dates = attachDateTime(tsRaw, dateCtx)
  return {
    speaker: speaker.trim(),
    rawSpeaker: speaker.trim(),
    content: content.trim(),
    platform,
    ...dates,
  }
}

function parseLine(line, dateCtx = null, pendingTs = null) {
  const trimmed = line.trim()
  if (!trimmed) return null

  const tsDefault = pendingTs || null

  for (const pattern of LINE_PATTERNS) {
    const match = trimmed.match(pattern.regex)
    if (!match) continue

    const name = (match[pattern.speaker]?.trim() ?? '')
    const body = match[pattern.content]?.trim() ?? ''
    let tsRaw = pattern.combineTs
      ? pattern.combineTs(match)
      : pattern.timestamp != null
        ? match[pattern.timestamp]?.trim()
        : tsDefault

    if (pattern.needsDateContext && dateCtx && tsRaw) {
      tsRaw = `${dateCtx.y}-${dateCtx.mo}-${dateCtx.d} ${tsRaw}`
    }

    if (!isRecognizedSpeaker(name) || !body) continue

    return buildMessage(name, body, tsRaw, dateCtx, pattern.platform)
  }

  return null
}

/**
 * PC 카톡 드래그 등 멀티라인 형식 포함 파싱
 * @param {string} text
 */
export function parseMessages(text) {
  const messages = []
  let dateCtx = null
  let pendingTs = null
  /** @type {{ speaker: string, tsRaw: string, platform: string } | null} */
  let pendingSpeaker = null
  let idx = 0

  const flushPending = (contentLine) => {
    if (!pendingSpeaker) return false
    const msg = buildMessage(
      pendingSpeaker.speaker,
      contentLine,
      pendingSpeaker.tsRaw,
      dateCtx,
      pendingSpeaker.platform,
    )
    pendingSpeaker = null
    if (msg) {
      messages.push({ ...msg, index: idx++ })
      return true
    }
    return false
  }

  for (const rawLine of text.split('\n')) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    const header = parseDateHeader(trimmed)
    if (header) {
      dateCtx = header
      pendingSpeaker = null
      pendingTs = null
      continue
    }

    if (/^-{3,}/.test(trimmed)) continue

    // 날짜·시간 단독 줄 (PC 드래그)
    if (DATETIME_ONLY.test(trimmed)) {
      pendingTs = trimmed.replace(/,\s*$/, '')
      pendingSpeaker = null
      continue
    }

    const dtNameColon = trimmed.match(DATETIME_NAME_ONLY)
    if (dtNameColon && isRecognizedSpeaker(dtNameColon[2])) {
      pendingSpeaker = { speaker: dtNameColon[2], tsRaw: dtNameColon[1], platform: 'kakao' }
      continue
    }

    const dtSpeaker = trimmed.match(DATETIME_SPEAKER_ONLY)
    if (dtSpeaker && isRecognizedSpeaker(dtSpeaker[2]) && !trimmed.includes(' : ')) {
      pendingSpeaker = { speaker: dtSpeaker[2], tsRaw: dtSpeaker[1], platform: 'kakao' }
      continue
    }

    const bracketHdr = trimmed.match(BRACKET_HEADER_ONLY)
    if (bracketHdr && isRecognizedSpeaker(bracketHdr[1])) {
      pendingSpeaker = {
        speaker: bracketHdr[1],
        tsRaw: `${dateCtx ? `${dateCtx.y}년 ${dateCtx.mo}월 ${dateCtx.d}일 ` : ''}${bracketHdr[2]}`,
        platform: 'kakao',
      }
      continue
    }

    const spColon = trimmed.match(SPEAKER_COLON_ONLY)
    if (spColon && isRecognizedSpeaker(spColon[2])) {
      pendingSpeaker = {
        speaker: spColon[2],
        tsRaw: pendingTs || '',
        platform: 'kakao',
      }
      continue
    }

    // PC 드래그: 날짜 줄 다음 이름만 (콜론·메시지 없음) — 짧은 닉네임만
    const looksLikeNickname = /^[\uAC00-\uD7A3a-zA-Z0-9_.]{1,12}$/.test(trimmed)
    if (pendingTs && !pendingSpeaker && looksLikeNickname && isValidSpeaker(trimmed)) {
      pendingSpeaker = { speaker: trimmed, tsRaw: pendingTs, platform: 'kakao' }
      continue
    }

    const parsed = parseLine(trimmed, dateCtx, pendingTs)
    if (parsed) {
      pendingSpeaker = null
      pendingTs = null
      messages.push({ ...parsed, index: idx++ })
      continue
    }

    // 이전 줄에서 이름만 있고, 이번 줄이 메시지 본문
    if (flushPending(trimmed)) {
      pendingTs = null
      continue
    }
  }

  return messages
}

export function detectPlatform(text) {
  const sample = text.slice(0, 3000)
  const scores = { kakao: 0, line: 0, sms: 0, generic: 0 }
  for (const line of sample.split('\n').slice(0, 40)) {
    for (const p of LINE_PATTERNS) {
      if (p.regex.test(line.trim())) scores[p.platform] += 1
    }
    if (DATETIME_ONLY.test(line.trim())) scores.kakao += 1
  }
  if (/카카오톡|kakao/i.test(sample)) scores.kakao += 3
  if (/LINE|라인/i.test(sample)) scores.line += 3
  if (/SMS|MMS|문자/i.test(sample)) scores.sms += 3
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  return best[1] > 0 ? /** @type {Platform} */ (best[0]) : 'generic'
}

export function getConversationMeta(textOrMessages) {
  const messages = Array.isArray(textOrMessages)
    ? textOrMessages
    : parseMessages(textOrMessages)
  const text = Array.isArray(textOrMessages) ? '' : textOrMessages
  const platform = text ? detectPlatform(text) : (messages[0]?.platform || 'generic')
  const dated = messages.filter((m) => m.dateMs)

  if (dated.length === 0) {
    return { platform, spanDays: 0, spanLabel: '날짜 정보 없음', dateRange: null }
  }

  const minMs = Math.min(...dated.map((m) => m.dateMs))
  const maxMs = Math.max(...dated.map((m) => m.dateMs))
  const spanMs = maxMs - minMs

  return {
    platform,
    spanDays: Math.max(1, Math.round(spanMs / DAY_MS) + 1),
    spanLabel: formatSpanLabel(spanMs),
    dateRange: {
      start: dated.find((m) => m.dateMs === minMs)?.dateLabel || '',
      end: dated.find((m) => m.dateMs === maxMs)?.dateLabel || '',
    },
  }
}

export function groupBySpeaker(messages) {
  const groups = {}
  for (const { speaker, content } of messages) {
    if (!groups[speaker]) groups[speaker] = { count: 0, chars: 0, contents: [] }
    groups[speaker].count += 1
    groups[speaker].chars += content.length
    groups[speaker].contents.push(content)
  }
  return groups
}

export function parseTimestampMinutes(ts) {
  const dt = parseDateTime(ts)
  if (!dt || dt.partial) return null
  const d = new Date(dt.dateMs)
  return d.getHours() * 60 + d.getMinutes()
}

export function extractSpeakerNames(text) {
  const normalized = normalizeLegacyAnonLabels(text)
  if (isAlreadyAnonymized(normalized)) {
    const parsed = collectSpeakersInOrder(normalized)
    if (parsed.length > 0) return parsed
    return extractColonBasedSpeakers(normalized)
  }
  const fromParser = collectSpeakersInOrder(normalized)
  if (fromParser.length > 0) return fromParser
  return extractColonBasedSpeakers(normalized)
}

function collectSpeakersInOrder(text) {
  const messages = parseMessages(text)
  if (messages.length === 0) return []
  const seen = new Set()
  const ordered = []
  for (const { speaker } of messages) {
    if (!seen.has(speaker)) {
      seen.add(speaker)
      ordered.push(speaker)
    }
  }
  return ordered
}

export function anonymizeChatText(text, options = {}) {
  const selfSpeakerName = options.selfSpeakerName
    ? String(options.selfSpeakerName).trim()
    : null
  const preprocessed = preprocessOcrSpeakers(normalizeLegacyAnonLabels((text || '').trim()))
  const trimmed = preprocessed.trim()
  if (!trimmed) {
    return { anonymizedText: text || '', nameMap: {}, parsedCount: 0 }
  }
  if (isAlreadyAnonymized(trimmed) && !selfSpeakerName) {
    return { anonymizedText: trimmed, nameMap: {}, parsedCount: parseMessages(trimmed).length }
  }

  const messages = parseMessages(trimmed)
  let speakers = collectSpeakersInOrder(trimmed)
  if (speakers.length === 0) {
    speakers = extractColonBasedSpeakers(trimmed)
  }
  if (speakers.length === 0) {
    return { anonymizedText: trimmed, nameMap: {}, parsedCount: messages.length }
  }

  const nameMap = buildAnonymizationMap(speakers, selfSpeakerName)
  const anonymizedText = applySpeakerAnonymization(trimmed, nameMap)

  return { anonymizedText, nameMap, parsedCount: messages.length || speakers.length }
}

export { detectPlatform as detectChatPlatform }
