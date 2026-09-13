// Phase 1 — Parser Adapter (docs/implementation_plan_v2.md §7).
//
// parseChat.js is not modified. This is the single point where server/engine/**
// crosses into legacy 1.0 JS (see parseChat.d.ts for the typed boundary).
// Callers must pass text that has already been through the privacy pipeline
// (docs/implementation_plan_v2.md §6) — speaker anonymization + body-text
// redaction — since this module does no anonymization of its own.
import { getConversationMeta, parseMessages } from './parseChatShim.js'
import type { ConversationMeta, RawParsedMessage } from './parseChatShim.js'
import type { Message } from './types.js'

export interface ToStandardMessagesOptions {
  sourceType: Message['sourceType']
}

export interface StandardMessageModel {
  messages: Message[]
  meta: ConversationMeta
}

function toMessage(raw: RawParsedMessage, sourceType: Message['sourceType']): Message {
  return {
    id: `msg_${raw.index}`,
    speakerId: raw.speaker,
    timestamp: raw.timestamp || null,
    date: raw.dateLabel || null,
    text: raw.content,
    sourceType,
  }
}

/** Runs the 1.0 parser and lifts its output into the Standard Message Model. */
export function toStandardMessages(
  text: string,
  options: ToStandardMessagesOptions,
): StandardMessageModel {
  const raw = parseMessages(text)
  const meta = getConversationMeta(raw)
  return {
    messages: raw.map((m) => toMessage(m, options.sourceType)),
    meta,
  }
}
