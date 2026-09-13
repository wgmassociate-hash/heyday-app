// Phase 1.1 / 1.2 — Reciprocity, redesigned around real interaction pairs.
//
// Phase 1 mechanism (removed): two independent opportunity-rate scores
// computed from `category: "reciprocity"` RelationshipSignal counts, sharing
// one denominator (the other side's question-mark count) across all 6
// signalTypes, combined with `balance × rawAvg`. Audited as "not real pair
// tracking" — a signal never had to reference what it was a response *to*.
//
// Phase 1.1: replaced with ValidatedReciprocityPair — an explicit trigger/
// response link, opportunity computed per pairType.
//
// Phase 1.2 (Missing Evidence & Calibration, audit findings #3/#5):
//  - A direction with too little trigger opportunity to judge is `score:
//    null, confidence: 'insufficient'` — not a forced 0. Overall Reciprocity
//    is only computed as a harmonic mean when BOTH directions are judgeable;
//    otherwise it's null/'insufficient' too.
//  - `topic_expansion` is excluded from scoring (still extracted/validated
//    for evidence) — its opportunity denominator (initiator's total message
//    count) is a poor proxy for "introduced a new topic". See weights.ts.
//
// Phase 1.3 (Pair-Type Coverage Audit, this pass):
//  - Fixed a bug where a pairType with opportunity=0 still counted its full
//    weight in the score denominator — a conversation where only
//    question_response (weight 34) ever had any opportunity, answered
//    perfectly every time, could never score above ~34 (its own weight share
//    of the full 100), because the other 4 pairTypes' combined weight (66)
//    sat in the denominator contributing 0 to the numerator, silently acting
//    like "unobserved = failed" for dimensions that were never observable at
//    all. Fixed: a pairType with opportunity=0 is excluded from BOTH the
//    numerator and the weight denominator ("unavailable"), not scored as 0.
//  - Directional confidence no longer averages opportunity across all 5
//    pairTypes uniformly (that average could be dragged low by pairTypes
//    that were never available, understating how much real signal actually
//    existed in the pairTypes that were). It now uses totalOpportunity
//    (summed over available pairTypes only) and pairTypeCoverage (the
//    fraction of the full weight table that was available at all) as two
//    separate axes — narrow-but-deep coverage (one pairType, lots of
//    opportunity) reaches 'medium' but not 'high'; broad coverage across
//    several pairTypes plus ample message/session data can reach 'high'.
//
// No LLM SDK import allowed in this directory — enforced by
// server/engine/importBoundary.test.ts (§10.2).
import type { CodeFeatures } from '../features/types.js'
import type { ReciprocityPairType, ValidatedReciprocityPair } from '../signals/reciprocityTypes.js'
import type { ValidatedSignal } from '../signals/types.js'
import { HIGH_MESSAGE_COUNT, HIGH_OPPORTUNITY, HIGH_SESSION_COUNT, weakerConfidence } from './confidence.js'
import type { Confidence } from './confidence.js'
import { harmonicMean, rateFor, saturatedContribution } from './mathUtils.js'
import type { ReciprocityResult } from './types.js'
import { RECIPROCITY_PAIR_CONFIG } from './weights.js'

/** A pairType needs at least half the full weight table's worth of *other*
 * available pairTypes alongside it (in weight terms) before narrow-but-deep
 * data in just one or two pairTypes is treated as broadly representative.
 * Tunable placeholder, same spirit as confidence.ts's thresholds. */
const HIGH_PAIRTYPE_COVERAGE = 0.5

/**
 * Directional Reciprocity confidence has two axes general Interest/Intimacy
 * confidence doesn't need: how much opportunity existed where it existed at
 * all (`totalOpportunity`), and how much of the full 5-pairType weight table
 * that covers (`pairTypeCoverage`). A single pairType with abundant
 * opportunity (e.g. question_response=20, everything else unavailable) is
 * real, judgeable data — but it's narrow, so it caps at 'medium', never
 * 'high', regardless of how much message/session data backs it.
 */
function computeDirectionalConfidence(inputs: {
  totalOpportunity: number
  pairTypeCoverage: number
  messageCount: number
  sessionCount: number
}): Confidence {
  const broadCoverage = inputs.pairTypeCoverage >= HIGH_PAIRTYPE_COVERAGE
  const strong =
    broadCoverage &&
    inputs.totalOpportunity >= HIGH_OPPORTUNITY &&
    inputs.messageCount >= HIGH_MESSAGE_COUNT &&
    inputs.sessionCount >= HIGH_SESSION_COUNT
  if (strong) return 'high'
  const medium =
    inputs.totalOpportunity >= HIGH_OPPORTUNITY ||
    (inputs.messageCount >= HIGH_MESSAGE_COUNT && inputs.sessionCount >= HIGH_SESSION_COUNT)
  return medium ? 'medium' : 'low'
}

/**
 * The real trigger opportunity for one pairType, counted from `initiatorSpeakerId`'s
 * side. Where an intimacy signalType already captures "the initiator did the
 * triggering behavior" (self_disclosure, vulnerable_emotion_share,
 * playful_teasing_or_nickname), that LLM-detected count IS the opportunity —
 * not a borrowed, unrelated proxy. Where no such signalType exists yet
 * (question_response, plan_response), a Code-only structural proxy is used
 * instead. `topic_expansion` is handled here too (for completeness / future
 * evidence use) even though it's excluded from RECIPROCITY_PAIR_CONFIG's
 * scoring loop — see weights.ts's comment for why.
 */
export function computePairOpportunity(
  pairType: ReciprocityPairType,
  codeFeatures: CodeFeatures,
  validatedSignals: ValidatedSignal[],
  initiatorSpeakerId: string,
): number {
  const config = RECIPROCITY_PAIR_CONFIG.find((c) => c.pairType === pairType)
  if (config?.triggerSignalType) {
    return validatedSignals.filter(
      (s) => s.signalType === config.triggerSignalType && s.actorSpeakerId === initiatorSpeakerId,
    ).length
  }

  switch (pairType) {
    case 'question_response':
      return codeFeatures.questionMessageCountBySpeaker[initiatorSpeakerId] ?? 0
    case 'plan_response':
      return codeFeatures.planProposalMessageCountBySpeaker[initiatorSpeakerId] ?? 0
    case 'topic_expansion':
      // No dedicated "introduces a new topic" signalType exists yet — falls
      // back to total message count as an upper-bound proxy. This is exactly
      // why topic_expansion is excluded from RECIPROCITY_PAIR_CONFIG's
      // scoring (weights.ts) — TODO(Phase 2+): reintroduce once a proper
      // topic-initiation trigger signal is defined.
      return codeFeatures.messageCountBySpeaker[initiatorSpeakerId] ?? 0
    default:
      return 0
  }
}

interface DirectionalReciprocityResult {
  score: number | null
  confidence: Confidence
}

function computeDirectionalReciprocity(
  pairs: ValidatedReciprocityPair[],
  responderSpeakerId: string,
  initiatorSpeakerId: string,
  codeFeatures: CodeFeatures,
  validatedSignals: ValidatedSignal[],
): DirectionalReciprocityResult {
  const responderPairs = pairs.filter(
    (p) => p.responderSpeakerId === responderSpeakerId && p.initiatorSpeakerId === initiatorSpeakerId,
  )
  const byType = new Map<ReciprocityPairType, ValidatedReciprocityPair[]>()
  for (const p of responderPairs) {
    const list = byType.get(p.pairType)
    if (list) list.push(p)
    else byType.set(p.pairType, [p])
  }

  const totalConfigWeight = RECIPROCITY_PAIR_CONFIG.reduce((sum, cfg) => sum + cfg.weight, 0)

  let total = 0
  let availableWeightSum = 0
  let totalOpportunity = 0
  for (const cfg of RECIPROCITY_PAIR_CONFIG) {
    const opportunity = computePairOpportunity(cfg.pairType, codeFeatures, validatedSignals, initiatorSpeakerId)
    // opportunity===0 -> this pairType was never observable at all for this
    // initiator. Excluded from BOTH numerator and denominator — it must not
    // silently act like "observed and failed" for a dimension that could
    // never have been observed in the first place (Phase 1.3 fix).
    if (opportunity <= 0) continue

    const count = byType.get(cfg.pairType)?.length ?? 0
    const rate = rateFor(count, opportunity)
    total += saturatedContribution(rate, cfg.weight)
    availableWeightSum += cfg.weight
    totalOpportunity += opportunity
  }

  if (availableWeightSum === 0) {
    // Every pairType had zero opportunity — nothing here is judgeable at all.
    return { score: null, confidence: 'insufficient' }
  }

  const messageCount =
    (codeFeatures.messageCountBySpeaker[responderSpeakerId] ?? 0) +
    (codeFeatures.messageCountBySpeaker[initiatorSpeakerId] ?? 0)
  const pairTypeCoverage = availableWeightSum / totalConfigWeight

  const confidence = computeDirectionalConfidence({
    totalOpportunity,
    pairTypeCoverage,
    messageCount,
    sessionCount: codeFeatures.sessionCount,
  })

  // Renormalized over only the available pairTypes — a pairType that was
  // never observable (excluded above) can no longer suppress the score by
  // sitting in the denominator contributing 0 to the numerator.
  const score = Math.round((total / availableWeightSum) * 100)
  return { score, confidence }
}

/**
 * Reciprocity_A = "how much of B's relationship-behavior did A actually
 * respond to" (and symmetrically for B). Overall Reciprocity combines the
 * two directions with harmonicMean — deterministic, and it naturally
 * produces 0 (not null) when one side has real, judgeable opportunity but
 * genuinely never reciprocates ("opportunity는 충분하지만 response pair가
 * 0개인 경우에는 score=0이 정상이다" — harmonicMean(x, 0) = 0 already).
 * If EITHER direction is null (insufficient opportunity to judge at all),
 * the overall result is null/'insufficient' too — a one-sided judgeable
 * score isn't averaged against an unjudgeable one.
 */
export function computeReciprocity(
  pairs: ValidatedReciprocityPair[],
  speakerA: string,
  speakerB: string,
  codeFeatures: CodeFeatures,
  validatedSignals: ValidatedSignal[],
): ReciprocityResult {
  const aRespondsToB = computeDirectionalReciprocity(pairs, speakerA, speakerB, codeFeatures, validatedSignals)
  const bRespondsToA = computeDirectionalReciprocity(pairs, speakerB, speakerA, codeFeatures, validatedSignals)

  const overall: { score: number | null; confidence: Confidence } =
    aRespondsToB.score === null || bRespondsToA.score === null
      ? { score: null, confidence: 'insufficient' }
      : {
          score: Math.round(harmonicMean(aRespondsToB.score, bRespondsToA.score)),
          confidence: weakerConfidence(aRespondsToB.confidence, bRespondsToA.confidence),
        }

  return {
    ...overall,
    bySpeaker: {
      [speakerA]: { score: aRespondsToB.score, confidence: aRespondsToB.confidence },
      [speakerB]: { score: bRespondsToA.score, confidence: bRespondsToA.confidence },
    },
  }
}
