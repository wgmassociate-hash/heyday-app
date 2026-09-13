// Phase 1 — Relationship Temperature (docs/prd_v2.md §9).
// Signature intentionally has no `initiative`/`romance` parameter — the PRD
// forbids folding either into Temperature (§9.3 "금지": Initiative/Romantic
// Signal을 관계온도에 직접 합산하지 않음), and the type signature below is
// what makes that a compile error to violate, not just a convention
// (docs/implementation_plan_v2.md §12.3).
import type { CodeFeatures } from '../features/types.js'
import { clamp, harmonicMean } from './mathUtils.js'
import type { Core4Result } from './types.js'

const WEIGHTS = {
  mutualInterest: 0.4,
  mutualIntimacy: 0.25,
  reciprocity: 0.25,
  interactionEnergy: 0.1,
} as const

/**
 * docs/prd_v2.md §9.3 lists InteractionEnergy candidates ("대화 세션
 * 지속성", "교대 발화", "일정 기간 내 상호 대화 빈도", "한쪽 독주가 아닌
 * 상호 참여") without a formula. Phase 1's first-cut reading: reward
 * balanced participation (nobody dominating the message count) and
 * conversations that recur across multiple sessions rather than being a
 * single burst. Both sub-scores and their blend are tunable placeholders.
 */
function computeInteractionEnergy(codeFeatures: CodeFeatures, speakerA: string, speakerB: string): number {
  const countA = codeFeatures.messageCountBySpeaker[speakerA] ?? 0
  const countB = codeFeatures.messageCountBySpeaker[speakerB] ?? 0
  const total = countA + countB
  const participationBalance = total > 0 ? (2 * Math.min(countA, countB)) / total : 0

  const sessionActivity = clamp(codeFeatures.sessionCount * 5, 0, 100) / 100

  return clamp(Math.round((participationBalance * 0.6 + sessionActivity * 0.4) * 100), 0, 100)
}

export function computeTemperature(
  core4: Core4Result,
  codeFeatures: CodeFeatures,
  speakerA: string,
  speakerB: string,
): number {
  const mutualInterest = harmonicMean(
    core4.interest.bySpeaker[speakerA]?.score ?? 0,
    core4.interest.bySpeaker[speakerB]?.score ?? 0,
  )
  const mutualIntimacy = harmonicMean(
    core4.intimacy.bySpeaker[speakerA]?.score ?? 0,
    core4.intimacy.bySpeaker[speakerB]?.score ?? 0,
  )
  const reciprocity = core4.reciprocity.score
  const interactionEnergy = computeInteractionEnergy(codeFeatures, speakerA, speakerB)

  const temperature =
    mutualInterest * WEIGHTS.mutualInterest +
    mutualIntimacy * WEIGHTS.mutualIntimacy +
    reciprocity * WEIGHTS.reciprocity +
    interactionEnergy * WEIGHTS.interactionEnergy

  return Math.round(clamp(temperature, 0, 100))
}
