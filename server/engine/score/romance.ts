// Phase 1 — Romantic Signal Layer (docs/prd_v2.md §10, docs/implementation_plan_v2.md §14.1).
// Unlike Core 4, romance/distancing signalTypes are pooled rather than
// individually weighted — every positive `category: "romance"` signal counts
// equally toward one rate, every `category: "distancing"` signal toward
// another. There is no per-actor split: romance is read as a property of the
// conversation, not attributed to one side.
import type { CodeFeatures } from '../features/types.js'
import type { ValidatedSignal } from '../signals/types.js'
import { rateFor, saturatedContribution } from './mathUtils.js'
import type { RomanceResult } from './types.js'

const MAX_CONTRIBUTION = 100

export function computeRomanceScore(signals: ValidatedSignal[], codeFeatures: CodeFeatures): RomanceResult {
  const positive = signals.filter((s) => s.category === 'romance' && s.direction === 'positive')
  const ambiguous = signals.filter((s) => s.category === 'romance' && s.direction === 'neutral')
  const distancing = signals.filter((s) => s.category === 'distancing')

  const totalMessages = Object.values(codeFeatures.messageCountBySpeaker).reduce((a, b) => a + b, 0)

  const positiveRate = rateFor(positive.length, totalMessages)
  const distancingRate = rateFor(distancing.length, totalMessages)

  const score = Math.round(
    Math.min(
      MAX_CONTRIBUTION,
      Math.max(
        0,
        saturatedContribution(positiveRate, MAX_CONTRIBUTION) -
          saturatedContribution(distancingRate, MAX_CONTRIBUTION),
      ),
    ),
  )

  return {
    score,
    positiveCount: positive.length,
    ambiguousCount: ambiguous.length,
    distancingCount: distancing.length,
  }
}
