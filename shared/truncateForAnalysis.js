import { parseMessages } from '../src/utils/parseChat.js'

export const ANALYSIS_MAX_MESSAGES = 350
export const ANALYSIS_MAX_CHARS = 14000

function formatMessage(m) {
  if (m.timestamp) return `${m.timestamp}, ${m.speaker} : ${m.content}`
  return `${m.speaker} : ${m.content}`
}

/**
 * API 전송용 대화 축소 — 최근 메시지 위주, 토큰·응답 시간 절감
 * @param {string} text
 */
export function truncateChatForAnalysis(text) {
  const trimmed = text.trim()
  const messages = parseMessages(trimmed)

  if (messages.length === 0) {
    if (trimmed.length <= ANALYSIS_MAX_CHARS) {
      return { text: trimmed, truncated: false, totalMessages: 0, analyzedMessages: 0 }
    }
    return {
      text: trimmed.slice(-ANALYSIS_MAX_CHARS),
      truncated: true,
      totalMessages: null,
      analyzedMessages: null,
    }
  }

  const totalMessages = messages.length
  let selected = messages

  if (messages.length > ANALYSIS_MAX_MESSAGES) {
    selected = messages.slice(-ANALYSIS_MAX_MESSAGES)
  }

  let formatted = selected.map(formatMessage).join('\n')

  while (formatted.length > ANALYSIS_MAX_CHARS && selected.length > 30) {
    selected = selected.slice(Math.ceil(selected.length * 0.15))
    formatted = selected.map(formatMessage).join('\n')
  }

  if (formatted.length > ANALYSIS_MAX_CHARS) {
    formatted = formatted.slice(-ANALYSIS_MAX_CHARS)
  }

  return {
    text: formatted,
    truncated: totalMessages > selected.length,
    totalMessages,
    analyzedMessages: selected.length,
  }
}
