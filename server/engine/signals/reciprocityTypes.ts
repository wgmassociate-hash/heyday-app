// Phase 1.1 — Reciprocity Pair (Score Calibration audit finding #3).
// Replaces the old mechanism of independent `category: "reciprocity"`
// RelationshipSignal entries (audited as "two independent opportunity-rate
// scores + a balance multiplier", not real interaction tracking). A
// ReciprocityPair instead requires the LLM to point at BOTH the triggering
// message(s) from one speaker AND the responding message(s) from the other —
// an actual claimed cause-and-effect link, which evidenceValidator.ts then
// checks for real (message existence, distinct speakers, time order,
// adjacency).
export type ReciprocityPairType =
  | 'question_response'
  | 'mutual_disclosure'
  | 'emotional_empathy'
  | 'joke_reciprocation'
  | 'plan_response'
  | 'topic_expansion'

export interface ReciprocityPair {
  pairType: ReciprocityPairType
  /** The speaker whose message(s) triggered the exchange. */
  initiatorSpeakerId: string
  /** The speaker whose message(s) responded to the trigger. */
  responderSpeakerId: string
  triggerMessageIds: string[]
  responseMessageIds: string[]
  reason: string
}

/** A ReciprocityPair that passed evidenceValidator.ts's checks (message
 * existence, distinct speakers, trigger-before-response ordering, and
 * same-session/adjacent-turn range). Only these reach score/reciprocity.ts. */
export interface ValidatedReciprocityPair extends ReciprocityPair {
  chunkId: string
}
