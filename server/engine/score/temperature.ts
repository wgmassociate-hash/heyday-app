// Phase 1 / 1.1 / 1.2 — Relationship Temperature (docs/prd_v2.md §9).
// Signature intentionally has no `conversationInitiationRatio`/`romance`
// parameter — the PRD forbids folding either into Temperature (§9.3 "금지":
// Initiative/Romantic Signal을 관계온도에 직접 합산하지 않음), and the type
// signature below is what makes that a compile error to violate, not just a
// convention (docs/implementation_plan_v2.md §12.3).
import type { CodeFeatures } from '../features/types.js'
import { computeConfidence, weakerConfidence } from './confidence.js'
import { clamp, harmonicMean } from './mathUtils.js'
import type { Core4Result, IndividualScore } from './types.js'

const WEIGHTS = {
  mutualInterest: 0.4,
  mutualIntimacy: 0.25,
  reciprocity: 0.25,
  interactionEnergy: 0.1,
} as const

/**
 * Phase 1.2 (audit finding #4): Temperature is built out of 4 weighted
 * components, any of which can now be `null` (insufficient data). A null
 * component is dropped and the remaining weights are renormalized — it is
 * NOT treated as a 0, which would silently drag Temperature down just
 * because one component happened to lack evidence. If too little of the
 * total weight survives, Temperature itself becomes null/'insufficient'
 * rather than reporting a number built on a sliver of the intended formula.
 */
const MIN_TEMPERATURE_WEIGHT_COVERAGE = 0.5

/** Mutual Interest/Intimacy: null if EITHER side is null (a mutual measure
 * can't be judged from just one side, docs/implementation_plan_v2.md audit
 * finding #4). A real 0 on one side still combines normally via harmonicMean
 * (which already returns 0 when either input is 0). */
function combineMutual(a: IndividualScore, b: IndividualScore): IndividualScore {
  if (a.score === null || b.score === null) return { score: null, confidence: 'insufficient' }
  return { score: harmonicMean(a.score, b.score), confidence: weakerConfidence(a.confidence, b.confidence) }
}

/**
 * Phase 1.1 formula (ParticipationBalance × 0.5 + TurnTakingRate × 0.5, both
 * length-independent ratios) is unchanged. Phase 1.2 adds: if there isn't
 * even enough total conversation to judge a turn-taking pattern from
 * (opportunity = total messages), this is null/'insufficient' too, same as
 * every other component — it no longer unconditionally reports a number.
 */
function computeInteractionEnergy(codeFeatures: CodeFeatures, speakerA: string, speakerB: string): IndividualScore {
  const countA = codeFeatures.messageCountBySpeaker[speakerA] ?? 0
  const countB = codeFeatures.messageCountBySpeaker[speakerB] ?? 0
  const totalMessages = countA + countB

  const confidence = computeConfidence({ opportunity: totalMessages, messageCount: totalMessages, sessionCount: codeFeatures.sessionCount })
  if (confidence === 'insufficient') return { score: null, confidence }

  const participationBalance = totalMessages > 0 ? clamp((2 * Math.min(countA, countB)) / totalMessages, 0, 1) : 0
  const turnTakingRate = clamp(codeFeatures.turnAlternationRate, 0, 1)
  const score = clamp(Math.round((participationBalance * 0.5 + turnTakingRate * 0.5) * 100), 0, 100)
  return { score, confidence }
}

export function computeTemperature(
  core4: Core4Result,
  codeFeatures: CodeFeatures,
  speakerA: string,
  speakerB: string,
): IndividualScore {
  const mutualInterest = combineMutual(
    core4.interest.bySpeaker[speakerA] ?? { score: null, confidence: 'insufficient' },
    core4.interest.bySpeaker[speakerB] ?? { score: null, confidence: 'insufficient' },
  )
  const mutualIntimacy = combineMutual(
    core4.intimacy.bySpeaker[speakerA] ?? { score: null, confidence: 'insufficient' },
    core4.intimacy.bySpeaker[speakerB] ?? { score: null, confidence: 'insufficient' },
  )
  const reciprocity: IndividualScore = { score: core4.reciprocity.score, confidence: core4.reciprocity.confidence }
  const interactionEnergy = computeInteractionEnergy(codeFeatures, speakerA, speakerB)

  const components: Array<{ score: number | null; confidence: IndividualScore['confidence']; weight: number }> = [
    { ...mutualInterest, weight: WEIGHTS.mutualInterest },
    { ...mutualIntimacy, weight: WEIGHTS.mutualIntimacy },
    { ...reciprocity, weight: WEIGHTS.reciprocity },
    { ...interactionEnergy, weight: WEIGHTS.interactionEnergy },
  ]

  const available = components.filter(
    (c): c is { score: number; confidence: IndividualScore['confidence']; weight: number } => c.score !== null,
  )
  const availableWeight = available.reduce((sum, c) => sum + c.weight, 0)

  if (availableWeight < MIN_TEMPERATURE_WEIGHT_COVERAGE) {
    return { score: null, confidence: 'insufficient' }
  }

  const weightedSum = available.reduce((sum, c) => sum + c.score * c.weight, 0)
  const temperature = Math.round(clamp(weightedSum / availableWeight, 0, 100))
  const confidence = available.map((c) => c.confidence).reduce(weakerConfidence)

  return { score: temperature, confidence }
}
