// Phase 2.3 (Interest/Intimacy Scoring Model Revision) — Pooled Density +
// Diversity.
//
// Replaces core4.ts's old per-signalType weighted-sum design. That design
// scored each signalType against its own independent saturation curve, then
// divided by a FIXED weight-sum (100) that assumed a genuinely high-interest
// conversation would exercise most of the 6-7 catalogued behaviors at once —
// real conversations normally show only 1-3 of them, so the aggregate
// compressed into single digits even when the LLM had validated plenty of
// real signal (see docs trace: samples/01-04 scored Interest/Intimacy 3-20
// while Reciprocity/Romance, which pool rather than split, scored 40-70 on
// the *identical* validated signals). Two structural alternatives were
// simulated against a frozen extraction fixture (A: current, B: pooling with
// no diversity term, C: pooling + diversity, D: family-level opportunity
// renormalization only) — see the Phase 2.3 write-up for the comparison
// table. C was the only one that satisfied every product invariant:
//   - B alone lets ONE repeated signalType reach the literal maximum (100) —
//     no way to tell "asks lots of follow-up questions" apart from "shows
//     interest through many different kinds of behavior". Rejected.
//   - D (family-level opportunity exclusion, no structural change otherwise)
//     does not fix the compression at all — it only helps the rare case
//     where opportunity itself is near-zero, which isn't what was compressing
//     samples/01-04 (their opportunities were already comfortably large).
//     Rejected as insufficient on its own.
//
// This module is the C implementation: pool validated positive signals for a
// metric (or one opportunity-sharing family within a metric — see core4.ts's
// two Interest families) into one observed count, saturate that as a density
// against the shared opportunity, then apply a diversity multiplier that
// rewards being expressed through *multiple distinct* signalTypes over
// repeating one. Diversity is deliberately UNWEIGHTED by signalType
// importance (docs decision item 1: "diversity는 행동의 중요도가 아니라
// 여러 방식으로 표현되고 있는가를 나타내는 축") — weighting it would
// silently reintroduce the old "some behaviors matter more" table this
// redesign is explicitly moving away from for the density/diversity axes.
import { rateFor, saturatedContribution } from './mathUtils.js'

/** How many distinct signalTypes it takes before the diversity multiplier
 * stops increasing — deliberately less than the full 6-7-entry catalogue
 * (weights.ts), since a real conversation rarely exercises all of them at
 * once and design goal was "3-4 clear behaviors -> strong, not maximal,
 * score". MVP heuristic, not backed by measured data — same caveat as every
 * other tunable constant in this engine (weights.ts, confidence.ts). */
export const DIVERSITY_CAP = 4

/** The floor a single repeated signalType's diversity multiplier can never
 * fall below or exceed while alone — i.e. one behavior type, no matter how
 * often it repeats, caps out at DIVERSITY_FLOOR of the density curve's value
 * (with SATURATION_TAU's ceiling, a single fully-saturated type reaches
 * `100 * DIVERSITY_FLOOR` = 40, comfortably under the "should not reach
 * 90-100 from one behavior type" requirement). MVP heuristic. */
export const DIVERSITY_FLOOR = 0.4

/**
 * 0..1 multiplier: DIVERSITY_FLOOR when only one distinct signalType has
 * been observed, rising linearly to 1.0 at DIVERSITY_CAP or more distinct
 * types. Exported standalone (rather than folded into
 * computePooledDensityScore) so a family with only one possible signalType
 * (e.g. Interest's restart-based family — see core4.ts) can skip it
 * entirely instead of getting an unearnable, meaningless diversity penalty.
 */
export function diversityMultiplier(distinctSignalTypeCount: number): number {
  const ratio = Math.min(distinctSignalTypeCount / DIVERSITY_CAP, 1)
  return DIVERSITY_FLOOR + (1 - DIVERSITY_FLOOR) * ratio
}

/**
 * Pooled density (validated positive signal count against the shared
 * opportunity, saturated via the engine's one SATURATION_TAU policy — no
 * per-family/per-metric tau override) times the diversity multiplier above.
 * Pure function, 0..100. `applyDiversity=false` is for a family with only one
 * possible signalType (nothing to diversify — see diversityMultiplier's
 * comment); density alone is already 0 when count=0, so no separate
 * zero-signal branch is needed here.
 */
export function computePooledDensityScore(
  count: number,
  distinctSignalTypeCount: number,
  opportunity: number,
  applyDiversity: boolean,
): number {
  const rate = rateFor(count, opportunity)
  const density = saturatedContribution(rate, 100)
  return applyDiversity ? density * diversityMultiplier(distinctSignalTypeCount) : density
}
