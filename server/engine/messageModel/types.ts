// Phase 1 — Standard Message Model (docs/prd_v2.md §6, docs/implementation_plan_v2.md §7).
export interface Message {
  id: string
  speakerId: string
  timestamp: string | null
  date: string | null
  text: string
  sourceType: 'txt' | 'screenshot'
  sessionId?: string
}

export interface EnrichedMessage extends Message {
  normalizedText?: string
  responseToMessageId?: string | null
  responseDelaySec?: number | null
  isConversationStart?: boolean
  isConversationRestart?: boolean
  isConversationEnd?: boolean
}
