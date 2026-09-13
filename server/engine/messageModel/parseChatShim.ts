// Phase 1 — typed boundary for src/utils/parseChat.js (docs/implementation_plan_v2.md §5.1).
//
// parseChat.js is intentionally left as untyped, unmodified 1.0 JS (allowJs +
// checkJs:false, tsconfig.json). This is the ONLY point where server/engine/**
// crosses into legacy JS — everything downstream of this file works with the
// hand-written types below instead of whatever TypeScript would infer from
// the untyped implementation.
//
// Note on the original design: docs/implementation_plan_v2.md §5.1 sketches
// this boundary as an ambient `declare module '*/parseChat.js'` file. In
// practice, TypeScript resolves a relative specifier to the real .js file
// (allowJs) before it considers a wildcard ambient module, so that approach
// silently has no effect — verified here by running `tsc --noEmit`, which
// reported the ambient members as missing. A cast-based shim (below) is the
// approach that actually enforces the boundary.
import {
  getConversationMeta as rawGetConversationMeta,
  parseMessages as rawParseMessages,
} from '../../../src/utils/parseChat.js'

export type ChatPlatform = 'kakao' | 'line' | 'sms' | 'generic'

/** Shape verified against parseChat.js:167-177 buildMessage() + :213-314 parseMessages(). */
export interface RawParsedMessage {
  speaker: string
  rawSpeaker: string
  content: string
  platform: ChatPlatform
  timestamp: string
  dateMs: number | null
  dateLabel: string
  index: number
}

/** Shape verified against parseChat.js:332-357 getConversationMeta(). */
export interface ConversationMeta {
  platform: ChatPlatform
  spanDays: number
  spanLabel: string
  dateRange: { start: string; end: string } | null
}

export const parseMessages: (text: string) => RawParsedMessage[] =
  rawParseMessages as unknown as (text: string) => RawParsedMessage[]

export const getConversationMeta: (
  textOrMessages: string | RawParsedMessage[],
) => ConversationMeta = rawGetConversationMeta as unknown as (
  textOrMessages: string | RawParsedMessage[],
) => ConversationMeta
