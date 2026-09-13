// Phase 1.1 — shared score math (Score Calibration pass).
// Kept in one place because core4.ts, reciprocity.ts, and romance.ts all need
// the same opportunity-rate + saturation primitives.

/** Only guards against division by zero — does NOT suppress rate for small
 * opportunity counts anymore (Phase 1 used a floor of 5 for that; Phase 1.1
 * removes it per audit finding: "데이터가 적다는 이유로 Score 자체를 낮추지
 * 않는다". Data-thinness is now represented by confidence.ts, not by
 * distorting the rate itself). */
export const MIN_OPPORTUNITY_DIVISOR = 1

/** Rate roughly this far into [0,1] already captures most of a signalType's
 * weight; further repetition keeps adding less. Tunable — see
 * score/scoreEngine.invariant.test.ts's saturation invariants. */
export const SATURATION_TAU = 0.5

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** count/opportunity as a 0..1 rate — same ratio at any conversation length
 * yields the same rate. Opportunity is floored at 1 only to avoid NaN/Infinity
 * when it is exactly 0; it no longer floors at a larger "reliable minimum" —
 * see MIN_OPPORTUNITY_DIVISOR's comment. */
export function rateFor(count: number, opportunity: number): number {
  const denom = Math.max(opportunity, MIN_OPPORTUNITY_DIVISOR)
  return clamp(count / denom, 0, 1)
}

/**
 * Phase 1.1 fix: the previous `weight * (1 - exp(-rate/tau))` tops out at
 * `weight * (1 - exp(-1/tau))` when rate=1 — for tau=0.5 that's ~86.5% of
 * `weight`, so a metric where every signalType is fully saturated still
 * couldn't reach 100. Dividing by that same ceiling renormalizes the curve
 * so S(0)=0 and S(1)=1 exactly, while staying monotonic and concave on
 * [0,1] (verified by score/scoreEngine.invariant.test.ts).
 */
export function saturatedContribution(rate: number, weight: number): number {
  const ceiling = 1 - Math.exp(-1 / SATURATION_TAU)
  return (weight * (1 - Math.exp(-rate / SATURATION_TAU))) / ceiling
}

/** Weights toward the lower of the two inputs — used so "one side does all
 * the work" can't be mistaken for a healthy mutual score. */
export function harmonicMean(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0
  return (2 * a * b) / (a + b)
}
