// Phase 1.2 — Confidence, redesigned again (Missing Evidence & Calibration
// audit finding #2). Phase 1.1 already separated Confidence from Score, but
// still gated it on `evidenceCount === 0 -> low`. That's wrong: a metric
// with abundant opportunity and genuinely zero observed behavior should be
// able to report "low score, high confidence" (we looked hard and found
// nothing) — not have its confidence dragged down just because the count
// happened to be zero. This version drops evidenceCount from the inputs
// entirely; confidence is now a pure function of how much *chance* there was
// to observe something (opportunity, message count, session count), never
// of what was actually found.
export type Confidence = 'insufficient' | 'low' | 'medium' | 'high'

export interface ConfidenceInputs {
  /** The opportunity denominator actually used for this score (averaged
   * across signalTypes/pairTypes if more than one contributed). */
  opportunity: number
  /** Total messages in the conversation (both speakers). */
  messageCount: number
  /** Distinct sessions the conversation spans. */
  sessionCount: number
}

/** Tunable placeholders — not backed by real usage data yet, same caveat as
 * score/weights.ts's fixed weights.
 *
 * MIN_JUDGEABLE_OPPORTUNITY is now a load-bearing constant beyond confidence
 * tiering: opportunity below this makes the metric return `score: null`
 * altogether (audit finding #1 — "score=null → 해당 metric을 판단할
 * opportunity 자체가 부족하거나 존재하지 않는 경우"). It reuses Phase 1.1's
 * old (removed) rate-floor value of 5, now for the right purpose: deciding
 * whether to report a number at all, not shrinking the number itself. */
export const MIN_JUDGEABLE_OPPORTUNITY = 5
/** Exported so score/reciprocity.ts's directional confidence (which needs a
 * second axis — pairType coverage — alongside these) can reuse the exact
 * same thresholds instead of drifting from them. */
export const HIGH_OPPORTUNITY = 15
export const HIGH_MESSAGE_COUNT = 40
export const HIGH_SESSION_COUNT = 2

export function computeConfidence(inputs: ConfidenceInputs): Confidence {
  if (inputs.opportunity < MIN_JUDGEABLE_OPPORTUNITY) return 'insufficient'
  const strong =
    inputs.opportunity >= HIGH_OPPORTUNITY &&
    inputs.messageCount >= HIGH_MESSAGE_COUNT &&
    inputs.sessionCount >= HIGH_SESSION_COUNT
  if (strong) return 'high'
  const medium = inputs.opportunity >= HIGH_OPPORTUNITY || (inputs.messageCount >= HIGH_MESSAGE_COUNT && inputs.sessionCount >= HIGH_SESSION_COUNT)
  return medium ? 'medium' : 'low'
}

const CONFIDENCE_RANK: Record<Confidence, number> = { insufficient: -1, low: 0, medium: 1, high: 2 }

/** The less-reliable of two confidences — used wherever a combined metric
 * (e.g. mutual Interest, overall Reciprocity, Temperature) needs a single
 * confidence derived from more than one component. */
export function weakerConfidence(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b
}
