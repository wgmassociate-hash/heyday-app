// Phase 1 — EnrichedMessage (docs/prd_v2.md §6, docs/implementation_plan_v2.md §7).
//
// Gap-based response/session logic is a fresh port of the same idea used by
// src/utils/deepAnalysisLocal.js's calcReplyAsymmetry() (line ~87-113: only
// count a gap as a "reply" when the speaker changed and the gap is positive
// and below a sanity ceiling). Message intentionally has no numeric dateMs
// field (Standard Message Model, docs/prd_v2.md §6), so this operates on the
// RawParsedMessage[] the Message[] was built from, in parallel by index.
import type { RawParsedMessage } from './parseChatShim.js'
import type { EnrichedMessage, Message } from './types.js'

/** A gap at least this long (minutes) counts as "the conversation had gone
 * quiet enough that resuming it is a meaningful action" — the shared
 * structural threshold behind both Interest's "재개" signal and Initiative's
 * restart/start opportunity (docs/implementation_plan_v2.md §9.2, §9.5).
 * Tunable — not backed by real usage data yet. */
export const RESTART_GAP_MINUTES = 30

/** A gap at least this long counts as a genuinely new conversation/session
 * rather than a lull within one. Must be > RESTART_GAP_MINUTES. Tunable. */
export const SESSION_GAP_MINUTES = 240

/** Same sanity ceiling as deepAnalysisLocal.js's calcReplyAsymmetry (14 days
 * in minutes) — gaps beyond this are treated as "unknown" for reply-delay
 * purposes rather than as a real (and wildly outlying) response time. */
const MAX_SANE_GAP_MINUTES = 14 * 24 * 60

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

function gapMinutesBetween(prevMs: number | null, currMs: number | null): number | null {
  if (prevMs == null || currMs == null) return null
  const gap = (currMs - prevMs) / 60000
  return gap >= 0 ? gap : null
}

/**
 * Enriches Standard Messages with response-timing and session-structure
 * fields. `raw` must be the exact RawParsedMessage[] that `messages` was
 * built from (same order, same length) — see toStandardMessages.ts.
 */
export function enrichMessages(messages: Message[], raw: RawParsedMessage[]): EnrichedMessage[] {
  if (messages.length !== raw.length) {
    throw new Error('enrichMessages: messages/raw length mismatch')
  }

  const enriched: EnrichedMessage[] = messages.map((message) => ({
    ...message,
    normalizedText: normalizeText(message.text),
  }))

  let sessionIndex = 0
  for (let i = 0; i < enriched.length; i++) {
    const curr = enriched[i]
    const prev: EnrichedMessage | null = i > 0 ? enriched[i - 1] : null
    const gapMinutes = i > 0 ? gapMinutesBetween(raw[i - 1].dateMs, raw[i].dateMs) : null

    const isNewSession = i === 0 || (gapMinutes != null && gapMinutes >= SESSION_GAP_MINUTES)
    if (isNewSession && i > 0) sessionIndex += 1
    curr.sessionId = `session_${sessionIndex}`
    curr.isConversationStart = isNewSession
    curr.isConversationRestart =
      !isNewSession && gapMinutes != null && gapMinutes >= RESTART_GAP_MINUTES

    if (
      prev &&
      prev.speakerId !== curr.speakerId &&
      gapMinutes != null &&
      gapMinutes <= MAX_SANE_GAP_MINUTES
    ) {
      curr.responseToMessageId = prev.id
      curr.responseDelaySec = Math.round(gapMinutes * 60)
    } else {
      curr.responseToMessageId = null
      curr.responseDelaySec = null
    }
  }

  for (let i = 0; i < enriched.length; i++) {
    const next: EnrichedMessage | undefined = enriched[i + 1]
    enriched[i].isConversationEnd = !next || next.isConversationStart === true
  }

  return enriched
}
