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
import { computePooledDensityScore } from './pooledSignalScore.js'
import { computeReciprocity } from './reciprocity.js'
import type { ConversationInitiationRatioResult, Core4Result, IndividualScore } from './types.js'
import { INTEREST_SIGNAL_CONFIG, INTIMACY_SIGNAL_CONFIG, type SignalTypeConfig } from './weights.js'

/**
 * One opportunity-sharing "family" within a Core4 dimension's signalType
 * config — every signalType in `config` that uses the same
 * `opportunityKind`. Interest has two (message-based: follow_up_question,
 * remembers_past_detail, checks_on_feelings, expands_topic,
 * specific_interest_expression, follows_up_on_plan; restart-based:
 * revives_conversation alone) because mixing targetMessageCount and
 * restartOpportunityCount into one pooled rate would conflate two denominators
 * that count fundamentally different things (docs decision item 3). Intimacy
 * has exactly one (all six signalTypes share actorMessageCount), so this
 * generalizes to a single pooled density+diversity computation for it with no
 * special-casing needed.
 */
interface SignalFamily {
  opportunityKind: SignalTypeConfig['opportunityKind']
  signalTypes: Set<string>
  /** Sum of the family's member signalTypes' weights.ts weights — used only
   * to combine multiple families back into one 0-100 score (docs decision
   * item 3: "기존 weight 기준으로 보면 message-based family=90, restart
   * family=10"), never as a per-signalType multiplier inside the pooled
   * density/diversity calculation itself (item 1: diversity is unweighted). */
  weight: number
}

function groupIntoFamilies(config: SignalTypeConfig[]): SignalFamily[] {
  const byKind = new Map<SignalTypeConfig['opportunityKind'], SignalFamily>()
  for (const cfg of config) {
    let family = byKind.get(cfg.opportunityKind)
    if (!family) {
      family = { opportunityKind: cfg.opportunityKind, signalTypes: new Set(), weight: 0 }
      byKind.set(cfg.opportunityKind, family)
    }
    family.signalTypes.add(cfg.signalType)
    family.weight += cfg.weight
  }
  return [...byKind.values()]
}

/**
 * Phase 2.3 (Interest/Intimacy Scoring Model Revision) — pooled density +
 * diversity, replacing the old per-signalType weighted-sum design entirely
 * (see pooledSignalScore.ts's header for the full diagnosis and why
 * alternatives B/D were rejected).
 *
 * Confidence is intentionally computed exactly as before (Phase 1.2/2.2,
 * unchanged): `avgOpportunity` still averages each config entry's real-time
 * opportunity, `messageCount`/`sessionCount` are unchanged inputs — this
 * revision only changes how the *score* (the numerator, once confidence
 * clears 'insufficient') is derived from validated signals, never whether a
 * metric is judgeable at all.
 *
 * Score: `config` is grouped into opportunity-sharing families (see
 * SignalFamily). Each family with real opportunity (>0) pools its own
 * validated positive signals into one density (saturated rate against the
 * family's shared opportunity) times a diversity multiplier rewarding
 * distinct signalTypes over repeating one — skipped for a single-signalType
 * family (nothing to diversify, e.g. Interest's restart family). Families
 * with zero opportunity are excluded from BOTH the numerator and the weight
 * denominator (same "unavailable component doesn't dilute the score"
 * principle already shipped in reciprocity.ts and temperature.ts), so an
 * unreachable dimension (e.g. no restart points in a single-session window)
 * can't structurally cap the score the way it used to.
 */
export function computeIndividualScore(
  signals: ValidatedSignal[],
  actorSpeakerId: string,
  opportunities: OpportunityCounts,
  config: SignalTypeConfig[],
  sessionCount: number,
): IndividualScore {
  const actorSignals = signals.filter((s) => s.actorSpeakerId === actorSpeakerId)
  const families = groupIntoFamilies(config)

  // Confidence gate — unchanged from Phase 1.2/2.2 (see docstring above).
  let opportunitySum = 0
  for (const cfg of config) opportunitySum += opportunities[cfg.opportunityKind]
  const avgOpportunity = config.length > 0 ? opportunitySum / config.length : 0
  const messageCount = opportunities.actorMessageCount + opportunities.targetMessageCount
  const confidence = computeConfidence({ opportunity: avgOpportunity, messageCount, sessionCount })
  if (confidence === 'insufficient') return { score: null, confidence }

  let weightedTotal = 0
  let availableWeight = 0
  for (const family of families) {
    const familyOpportunity = opportunities[family.opportunityKind]
    if (familyOpportunity <= 0) continue // never observable — excluded from both numerator and denominator

    const familySignals = actorSignals.filter((s) => family.signalTypes.has(s.signalType))
    const distinctTypes = new Set(familySignals.map((s) => s.signalType)).size
    const familyScore = computePooledDensityScore(
      familySignals.length,
      distinctTypes,
      familyOpportunity,
      family.signalTypes.size > 1, // diversity is meaningless for a single-signalType family
    )
    weightedTotal += familyScore * family.weight
    availableWeight += family.weight
  }

  const score = availableWeight > 0 ? Math.round(weightedTotal / availableWeight) : 0
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
