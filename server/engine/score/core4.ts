// Phase 1 — Core 4: Interest, Intimacy, Reciprocity (Initiative lives in
// features/codeFeatureExtractor.ts's turnInitiationCounts — see weights.ts's
// header comment for why it has no LLM-weighted signalType table here).
// docs/implementation_plan_v2.md §9, §9.5.
//
// No LLM SDK import allowed in this directory — enforced by
// server/engine/importBoundary.test.ts (§10.2).
import { computeOpportunities } from '../features/codeFeatureExtractor.js'
import type { CodeFeatures, OpportunityCounts } from '../features/types.js'
import type { ValidatedSignal } from '../signals/types.js'
import { rateFor, saturatedContribution } from './mathUtils.js'
import type { Confidence, Core4Result, IndividualScore, InitiativeResult, ReciprocityResult } from './types.js'
import { INTEREST_SIGNAL_CONFIG, INTIMACY_SIGNAL_CONFIG, RECIPROCITY_SIGNAL_CONFIG, type SignalTypeConfig } from './weights.js'

function confidenceFor(signalCount: number): Confidence {
  if (signalCount < 3) return 'low'
  if (signalCount < 8) return 'medium'
  return 'high'
}

/**
 * Weighted opportunity-rate score for one actor, given the signalType
 * config for one Core4 dimension. Pure function — see
 * docs/implementation_plan_v2.md §9.3 for the exact design this implements.
 */
export function computeIndividualScore(
  signals: ValidatedSignal[],
  actorSpeakerId: string,
  opportunities: OpportunityCounts,
  config: SignalTypeConfig[],
): IndividualScore {
  const actorSignals = signals.filter((s) => s.actorSpeakerId === actorSpeakerId)
  const byType = new Map<string, ValidatedSignal[]>()
  for (const s of actorSignals) {
    const list = byType.get(s.signalType)
    if (list) list.push(s)
    else byType.set(s.signalType, [s])
  }

  let total = 0
  let weightSum = 0
  for (const cfg of config) {
    const count = byType.get(cfg.signalType)?.length ?? 0
    const opportunity = opportunities[cfg.opportunityKind]
    const rate = rateFor(count, opportunity)
    total += saturatedContribution(rate, cfg.weight)
    weightSum += cfg.weight
  }

  const score = weightSum > 0 ? Math.round((total / weightSum) * 100) : 0
  const relevantSignalCount = config.reduce(
    (sum, cfg) => sum + (byType.get(cfg.signalType)?.length ?? 0),
    0,
  )
  return { score, confidence: confidenceFor(relevantSignalCount) }
}

function computePairMetric(
  signals: ValidatedSignal[],
  speakerA: string,
  speakerB: string,
  codeFeatures: CodeFeatures,
  config: SignalTypeConfig[],
): { bySpeaker: Record<string, IndividualScore> } {
  return {
    bySpeaker: {
      [speakerA]: computeIndividualScore(signals, speakerA, computeOpportunities(codeFeatures, speakerA, speakerB), config),
      [speakerB]: computeIndividualScore(signals, speakerB, computeOpportunities(codeFeatures, speakerB, speakerA), config),
    },
  }
}

/** docs/prd_v2.md §8.2: InitiativeRatio_X = Point_X / (Point_A + Point_B).
 * "Point" here is turnInitiationCounts (starts + revivals) — purely code,
 * no LLM signal (weights.ts header explains why). */
function computeInitiative(codeFeatures: CodeFeatures, speakerA: string, speakerB: string): InitiativeResult {
  const pointA = codeFeatures.turnInitiationCounts[speakerA] ?? 0
  const pointB = codeFeatures.turnInitiationCounts[speakerB] ?? 0
  const total = pointA + pointB
  return {
    ratioBySpeaker: {
      [speakerA]: total > 0 ? pointA / total : 0.5,
      [speakerB]: total > 0 ? pointB / total : 0.5,
    },
  }
}

/**
 * docs/prd_v2.md §8.4's Reciprocity formula (`Balance × EvidenceCoverage ×
 * InteractionQuality`) is explicitly left for post-launch calibration by the
 * PRD itself ("세부 수식은 실제 데이터 테스트 후 보정한다"). Phase 1's
 * reading of it: each side's opportunity-rate reciprocation score already
 * folds in "how much evidence, how good was it" (via rate + saturation), so
 * only the Balance term is added explicitly — as a multiplier that punishes
 * one-sided reciprocation instead of averaging it away. "Both sides do
 * nothing" -> both scores are 0 -> balance's own 0/0 case is guarded to 0,
 * not a false-positive perfect balance (docs/implementation_plan_v2.md §8.4
 * "둘 다 행동하지 않음을 높은 균형으로 오판하지 않는다").
 */
function computeReciprocity(
  signals: ValidatedSignal[],
  speakerA: string,
  speakerB: string,
  codeFeatures: CodeFeatures,
): ReciprocityResult {
  const scoreA = computeIndividualScore(
    signals,
    speakerA,
    computeOpportunities(codeFeatures, speakerA, speakerB),
    RECIPROCITY_SIGNAL_CONFIG,
  )
  const scoreB = computeIndividualScore(
    signals,
    speakerB,
    computeOpportunities(codeFeatures, speakerB, speakerA),
    RECIPROCITY_SIGNAL_CONFIG,
  )

  const sum = scoreA.score + scoreB.score
  const balance = sum > 0 ? (2 * Math.min(scoreA.score, scoreB.score)) / sum : 0
  const rawAvg = sum / 2
  const score = Math.round(balance * rawAvg)

  const confidenceRank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 }
  const lowerConfidence = confidenceRank[scoreA.confidence] <= confidenceRank[scoreB.confidence]
    ? scoreA.confidence
    : scoreB.confidence

  return {
    score,
    confidence: lowerConfidence,
    bySpeaker: { [speakerA]: scoreA, [speakerB]: scoreB },
  }
}

/** Degenerate result for the (out-of-scope-for-MVP) case of fewer than 2
 * speakers — Core4/Temperature assume exactly one pair (docs/prd_v2.md §2.1). */
function emptyCore4(speakerIds: string[]): Core4Result {
  const zero: IndividualScore = { score: 0, confidence: 'low' }
  const bySpeaker = Object.fromEntries(speakerIds.map((id) => [id, zero]))
  const ratioBySpeaker = Object.fromEntries(speakerIds.map((id) => [id, speakerIds.length > 0 ? 1 / speakerIds.length : 0]))
  return {
    interest: { bySpeaker },
    intimacy: { bySpeaker },
    initiative: { ratioBySpeaker },
    reciprocity: { score: 0, confidence: 'low', bySpeaker },
  }
}

export function computeCore4(input: {
  codeFeatures: CodeFeatures
  validatedSignals: ValidatedSignal[]
}): Core4Result {
  const { codeFeatures, validatedSignals } = input
  const [speakerA, speakerB] = codeFeatures.speakerIds
  if (!speakerA || !speakerB) return emptyCore4(codeFeatures.speakerIds)

  return {
    interest: computePairMetric(validatedSignals, speakerA, speakerB, codeFeatures, INTEREST_SIGNAL_CONFIG),
    intimacy: computePairMetric(validatedSignals, speakerA, speakerB, codeFeatures, INTIMACY_SIGNAL_CONFIG),
    initiative: computeInitiative(codeFeatures, speakerA, speakerB),
    reciprocity: computeReciprocity(validatedSignals, speakerA, speakerB, codeFeatures),
  }
}
