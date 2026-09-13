// Phase 1 — shared score math (docs/implementation_plan_v2.md §9.3).
// Kept in one place because both core4.ts and romance.ts need the same
// opportunity-rate + saturation primitives (the plan sketches them inline in
// core4.ts; factored out here instead so romance.ts doesn't duplicate them).

/** Below this, an opportunity denominator is treated as unreliably small
 * (e.g. a 3-message conversation) rather than let a rate blow up. Tunable. */
export const MIN_OPPORTUNITY_FLOOR = 5

/** Rate roughly this far into [0,1] already captures most of a signalType's
 * weight; further repetition keeps adding less. Tunable — see §19.2's
 * saturation invariant test for what this constant is required to satisfy. */
export const SATURATION_TAU = 0.5

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** count/opportunity as a 0..1 rate — same ratio at any conversation length
 * yields the same rate (docs/implementation_plan_v2.md §9.1 "대화 길이 왜곡"). */
export function rateFor(count: number, opportunity: number): number {
  const denom = Math.max(opportunity, MIN_OPPORTUNITY_FLOOR)
  return clamp(count / denom, 0, 1)
}

/** Saturates a rate so contribution approaches `weight` but never exceeds it,
 * with diminishing returns as rate -> 1 (docs/implementation_plan_v2.md §9.1
 * "무한 반복 왜곡"). Concave in rate: the 0.5->1.0 increase is smaller than
 * the 0->0.5 increase (verified by score/scoreEngine.invariant.test.ts). */
export function saturatedContribution(rate: number, weight: number): number {
  return weight * (1 - Math.exp(-rate / SATURATION_TAU))
}

/** Weights toward the lower of the two inputs — used so "one side does all
 * the work" can't be mistaken for a healthy mutual score (docs/prd_v2.md §9.2). */
export function harmonicMean(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0
  return (2 * a * b) / (a + b)
}
