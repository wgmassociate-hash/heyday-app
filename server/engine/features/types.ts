// Phase 1 — Code Feature Extractor output types (docs/implementation_plan_v2.md §8.2, §9.2).
export interface ReplyGapStat {
  avgMinutes: number | null
  sampleCount: number
}

export interface TopicHit {
  id: string
  label: string
  count: number
}

/** Denominators for Score Engine's opportunity-rate calculation (§9.2, §9.3).
 * Always scoped to one (actor, target) direction of a pair. */
export interface OpportunityCounts {
  actorMessageCount: number
  targetMessageCount: number
  restartOpportunityCount: number
  pairOpportunityCount: number
}

/** Everything Code computes from Message[] alone — no LLM involved (§8.2). */
export interface CodeFeatures {
  speakerIds: string[]
  messageCountBySpeaker: Record<string, number>
  turnInitiationCounts: Record<string, number>
  replyGapStatsBySpeaker: Record<string, ReplyGapStat>
  emojiRatioBySpeaker: Record<string, number>
  /** Messages that look like they're prompting a response (contain '?'/'？').
   * A coarse, code-only proxy for Reciprocity's pairOpportunityCount (§9.2) —
   * not the same thing as an LLM-detected "question" signal, just its
   * structural opportunity-space approximation. */
  questionMessageCountBySpeaker: Record<string, number>
  topicHits: TopicHit[]
  /** Distinct EnrichedMessage.sessionId count — used by score/temperature.ts's
   * InteractionEnergy proxy (docs/prd_v2.md §9.3 "대화 세션 지속성"). */
  sessionCount: number
  /** Conversation-level count of gap points >= enrich.ts's RESTART_GAP_MINUTES
   * (i.e. every point where resuming the conversation was a meaningful,
   * observable action) — shared across both directions of a pair. */
  restartOpportunityCount: number
}
