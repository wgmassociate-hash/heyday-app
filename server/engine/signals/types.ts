// Phase 1 — Signal types (docs/prd_v2.md §13, docs/implementation_review_v2.md §2).
//
// RelationshipSignal (raw LLM output) deliberately has NO numeric field —
// not even the `strength: 1|2|3` the PRD originally proposed. The Decision
// Memo (implementation_review_v2.md §2) removed it: "LLM이 최종 점수를 직접
// 만들지 않더라도 strength가 Score에 곱해지면 사실상 LLM이 점수를 조정하는
// 구조가 된다." Every number in the final score comes from Score Engine
// code (server/engine/score/**), never from this type.
export type SignalCategory = 'interest' | 'intimacy' | 'reciprocity' | 'romance' | 'distancing'
export type SignalDirection = 'positive' | 'neutral' | 'negative'

export interface RelationshipSignal {
  signalType: string
  category: SignalCategory
  direction: SignalDirection
  actorSpeakerId: string
  targetSpeakerId?: string
  messageIds: string[]
  reason: string
}

/** A RelationshipSignal that passed evidenceValidator.ts's checks (§11):
 * messageIds resolve to real messages, actor/target speakerIds are valid,
 * and it isn't a duplicate of another validated signal. Only ValidatedSignal
 * may reach Score Engine — enforced by scoreEngine.ts's input type, not just
 * by convention (§10.1). */
export interface ValidatedSignal extends RelationshipSignal {
  /** Which chunk this signal was extracted from — used to merge Stage1/Stage2
   * signal sets without re-processing the same chunk twice (§11, §16.3). */
  chunkId: string
}
