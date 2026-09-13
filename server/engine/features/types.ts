// Phase 1 / 1.1 — Code Feature Extractor output types (docs/implementation_plan_v2.md §8.2, §9.2).
export interface ReplyGapStat {
  avgMinutes: number | null
  sampleCount: number
}

export interface TopicHit {
  id: string
  label: string
  count: number
}

/** Denominators for Interest/Intimacy's opportunity-rate calculation (§9.2,
 * §9.3). Always scoped to one (actor, target) direction of a pair.
 * Phase 1.1: `pairOpportunityCount` removed — Reciprocity no longer goes
 * through this generic wrapper (score/reciprocity.ts computes a distinct
 * opportunity per pairType instead, see computePairOpportunity()). */
export interface OpportunityCounts {
  actorMessageCount: number
  targetMessageCount: number
  restartOpportunityCount: number
}

/** Everything Code computes from Message[] alone — no LLM involved (§8.2). */
export interface CodeFeatures {
  speakerIds: string[]
  messageCountBySpeaker: Record<string, number>
  turnInitiationCounts: Record<string, number>
  replyGapStatsBySpeaker: Record<string, ReplyGapStat>
  emojiRatioBySpeaker: Record<string, number>
  /** Messages that look like they're prompting a response (contain '?'/'？').
   * Code-only proxy used as the `question_response` pairType's trigger
   * opportunity (score/reciprocity.ts) — NOT shared as a denominator for any
   * other pairType (Phase 1.1 audit finding: the old design used this one
   * count for all 6 reciprocity signalTypes, which is what's being fixed). */
  questionMessageCountBySpeaker: Record<string, number>
  /** Messages that look like a plan/meetup proposal (regex proxy, same kind
   * of heuristic as questionMessageCountBySpeaker). Used as the
   * `plan_response` pairType's trigger opportunity. */
  planProposalMessageCountBySpeaker: Record<string, number>
  /** Fraction of adjacent message pairs where the speaker changed — 1.0 means
   * perfectly alternating turns, 0 means each side talks in one uninterrupted
   * block. Length-independent (a ratio, not a count) — used by
   * score/temperature.ts's InteractionEnergy so longer conversations don't
   * automatically score higher just for having more messages. */
  turnAlternationRate: number
  topicHits: TopicHit[]
  /** Distinct EnrichedMessage.sessionId count — a confidence input
   * (score/confidence.ts), no longer a Score input (Phase 1.1 removed
   * sessionCount from InteractionEnergy's formula). */
  sessionCount: number
  /** Conversation-level count of gap points >= enrich.ts's RESTART_GAP_MINUTES
   * (i.e. every point where resuming the conversation was a meaningful,
   * observable action) — shared across both directions of a pair. */
  restartOpportunityCount: number
}
