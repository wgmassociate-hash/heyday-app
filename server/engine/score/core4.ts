// Phase 1 / 1.1 — Core 4: Interest, Intimacy (Reciprocity now lives in
// reciprocity.ts; conversationInitiationRatio lives in
// features/codeFeatureExtractor.ts's turnInitiationCounts — see weights.ts's
// header comment for why it has no LLM-weighted signalType table here).
// docs/implementation_plan_v2.md §9, §9.5.
//
// No LLM SDK import allowed in this directory — enforced by
// server/engine/importBoundary.test.ts (§10.2).
import { computeOpportunities } from '../features/codeFeatureExtractor.js'
import type { CodeFeatures, OpportunityCounts } from '../features/types.js'
import type { ValidatedReciprocityPair } from '../signals/reciprocityTypes.js'
import type { ValidatedSignal } from '../signals/types.js'
import { computeConfidence } from './confidence.js'
import { rateFor, saturatedContribution } from './mathUtils.js'
import { computeReciprocity } from './reciprocity.js'
import type { ConversationInitiationRatioResult, Core4Result, IndividualScore } from './types.js'
import { INTEREST_SIGNAL_CONFIG, INTIMACY_SIGNAL_CONFIG, type SignalTypeConfig } from './weights.js'

/**
 * Weighted opportunity-rate score for one actor, given the signalType
 * config for one Core4 dimension. Pure function.
 *
 * Phase 1.1: no rate-suppressing floor on the opportunity denominator
 * (mathUtils.ts's rateFor still just guards against divide-by-zero).
 * Phase 1.2 (audit findings #1/#2): confidence no longer requires
 * evidenceCount > 0 (a real, well-supported zero is possible), and when the
 * opportunity itself is too small to judge (confidence.ts's
 * MIN_JUDGEABLE_OPPORTUNITY), `score` is `null` rather than a technically-
 * computed-but-unreliable number.
 */
export function computeIndividualScore(
  signals: ValidatedSignal[],
  actorSpeakerId: string,
  opportunities: OpportunityCounts,
  config: SignalTypeConfig[],
  sessionCount: number,
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
  let opportunitySum = 0
  for (const cfg of config) {
    const count = byType.get(cfg.signalType)?.length ?? 0
    const opportunity = opportunities[cfg.opportunityKind]
    const rate = rateFor(count, opportunity)
    total += saturatedContribution(rate, cfg.weight)
    weightSum += cfg.weight
    opportunitySum += opportunity
  }

  const avgOpportunity = config.length > 0 ? opportunitySum / config.length : 0
  const messageCount = opportunities.actorMessageCount + opportunities.targetMessageCount
  const confidence = computeConfidence({ opportunity: avgOpportunity, messageCount, sessionCount })

  if (confidence === 'insufficient') return { score: null, confidence }

  const score = weightSum > 0 ? Math.round((total / weightSum) * 100) : 0
  return { score, confidence }
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
      [speakerA]: computeIndividualScore(
        signals,
        speakerA,
        computeOpportunities(codeFeatures, speakerA, speakerB),
        config,
        codeFeatures.sessionCount,
      ),
      [speakerB]: computeIndividualScore(
        signals,
        speakerB,
        computeOpportunities(codeFeatures, speakerB, speakerA),
        config,
        codeFeatures.sessionCount,
      ),
    },
  }
}

/** docs/prd_v2.md §8.2: InitiativeRatio_X = Point_X / (Point_A + Point_B).
 * "Point" here is turnInitiationCounts (starts + revivals) — purely code,
 * no LLM signal (weights.ts header explains why).
 *
 * Phase 1.1 rename (audit finding #4): this measures who starts/revives the
 * *conversation*, not a broader "Relationship Initiative" — renamed to
 * conversationInitiationRatio so a richer Initiative concept can be added in
 * Phase 2 without colliding with this field's narrower, already-shipped
 * meaning. */
function computeConversationInitiationRatio(
  codeFeatures: CodeFeatures,
  speakerA: string,
  speakerB: string,
): ConversationInitiationRatioResult {
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

/** Degenerate result for the (out-of-scope-for-MVP) case of fewer than 2
 * speakers — Core4/Temperature assume exactly one pair (docs/prd_v2.md §2.1).
 * No data at all is exactly the `score: null` / 'insufficient' case. */
function emptyCore4(speakerIds: string[]): Core4Result {
  const insufficient: IndividualScore = { score: null, confidence: 'insufficient' }
  const bySpeaker = Object.fromEntries(speakerIds.map((id) => [id, insufficient]))
  const ratioBySpeaker = Object.fromEntries(
    speakerIds.map((id) => [id, speakerIds.length > 0 ? 1 / speakerIds.length : 0]),
  )
  return {
    interest: { bySpeaker },
    intimacy: { bySpeaker },
    conversationInitiationRatio: { ratioBySpeaker },
    reciprocity: { ...insufficient, bySpeaker },
  }
}

export function computeCore4(input: {
  codeFeatures: CodeFeatures
  validatedSignals: ValidatedSignal[]
  reciprocityPairs: ValidatedReciprocityPair[]
}): Core4Result {
  const { codeFeatures, validatedSignals, reciprocityPairs } = input
  const [speakerA, speakerB] = codeFeatures.speakerIds
  if (!speakerA || !speakerB) return emptyCore4(codeFeatures.speakerIds)

  return {
    interest: computePairMetric(validatedSignals, speakerA, speakerB, codeFeatures, INTEREST_SIGNAL_CONFIG),
    intimacy: computePairMetric(validatedSignals, speakerA, speakerB, codeFeatures, INTIMACY_SIGNAL_CONFIG),
    conversationInitiationRatio: computeConversationInitiationRatio(codeFeatures, speakerA, speakerB),
    reciprocity: computeReciprocity(reciprocityPairs, speakerA, speakerB, codeFeatures, validatedSignals),
  }
}
