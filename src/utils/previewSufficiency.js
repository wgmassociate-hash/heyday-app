/**
 * Phase 2.1 — Analysis Sufficiency (Product UX Calibration item 2).
 *
 * Pure UI-level judgment on top of the Score Engine's already-computed
 * `confidence` values (server/engine/score/confidence.ts) — this does NOT
 * retune any engine threshold, it only decides whether the *result screen*
 * should lead with a "there isn't much to go on yet" notice instead of
 * presenting a full report as if the data were rich.
 *
 * @param {import('../../server/engine/pipeline/types.js').PreviewScoreResult} preview
 * @returns {boolean} true when most of the core metrics are 'insufficient' or 'low'
 */
export function isPreviewLowSufficiency(preview) {
  const core4 = preview.core4Preview
  const confidences = [
    preview.recentConversationTemperature.confidence,
    ...Object.values(core4.interest.bySpeaker).map((s) => s.confidence),
    ...Object.values(core4.intimacy.bySpeaker).map((s) => s.confidence),
    core4.reciprocity.confidence,
  ]

  const weakCount = confidences.filter((c) => c === 'insufficient' || c === 'low').length
  return weakCount >= Math.ceil(confidences.length / 2)
}

/**
 * Phase 2.2 (Short Conversation Result Calibration) — splits "there isn't
 * much to go on" into two product-meaningful states instead of one. Phase
 * 2.1 only had isPreviewLowSufficiency() (weak vs not-weak), which the result
 * screen used to decide whether to show a sufficiency notice — but nothing
 * separated "we genuinely couldn't analyze this" from "we analyzed it, it's
 * just a short/early conversation so the read is provisional". Both used to
 * look the same in the UI (numbers hidden, "단서가 부족해요"), which is what
 * produced the "그럼 이 서비스가 뭘 분석한 거야?" complaint for perfectly
 * normal short conversations.
 *
 * - 'truly_insufficient': Temperature itself is null — i.e.
 *   temperature.ts's MIN_TEMPERATURE_WEIGHT_COVERAGE gate already decided
 *   less than half of Temperature's 4 weighted components (mutual Interest,
 *   mutual Intimacy, Reciprocity, InteractionEnergy) could be judged at all.
 *   This already covers every case in the product spec (near-empty parse,
 *   one-sided "conversation", almost no real exchange) without this file
 *   reinventing its own message-count/turn-count thresholds — reusing an
 *   already-computed, already-tested engine gate is simpler and more
 *   consistent than adding a second, competing definition of "too little
 *   data" here.
 * - 'limited_but_analyzable': Temperature computed a real number, but most
 *   of Core4 is still 'insufficient'/'low' confidence (isPreviewLowSufficiency
 *   above) — a short-but-real conversation. Numbers ARE shown, softened as
 *   provisional (PreviewResultStep.jsx's ScoreBar).
 * - 'normal': not weak by isPreviewLowSufficiency's count — the existing
 *   Phase 2.1 "plenty to go on" path, unchanged.
 *
 * @param {import('../../server/engine/pipeline/types.js').PreviewScoreResult} preview
 * @returns {'truly_insufficient' | 'limited_but_analyzable' | 'normal'}
 */
export function getPreviewAnalyzability(preview) {
  if (preview.recentConversationTemperature.score === null) return 'truly_insufficient'
  return isPreviewLowSufficiency(preview) ? 'limited_but_analyzable' : 'normal'
}
