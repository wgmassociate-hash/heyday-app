// Phase 2 — Intent-driven Evidence selection (docs/prd_v2.md §4 "Intent는
// Score를 바꾸는 용도가 아니라, 결과 우선순위와 Narrative 초점을 바꾸는 데
// 사용한다").
//
// This is the one place Intent actually does anything: picking which single
// validated signal becomes the free "결정적 Signal 1개" (PRD §20.2). It never
// touches score/** — Core4/Temperature/Romance are computed identically
// regardless of Intent (Phase 2 completion criterion #3).
import type { SignalCategory, ValidatedSignal } from '../signals/types.js'
import type { AnalysisIntent } from '../intent/types.js'

const INTENT_CATEGORY_PRIORITY: Record<AnalysisIntent, SignalCategory[]> = {
  romantic_interest: ['romance', 'interest', 'intimacy'],
  relationship_change: ['interest', 'intimacy', 'romance'],
  imbalance: ['interest', 'intimacy', 'romance'],
  conversation_meaning: ['romance', 'interest', 'intimacy'],
  relationship_definition: ['romance', 'intimacy', 'interest'],
  friendship_change: ['intimacy', 'interest'],
}

/** Every intent falls back to this order (deduplicated at call time) if its
 * preferred categories turn up nothing — 'distancing' is only ever a last
 * resort so a preview doesn't lead with a negative signal unless that's
 * genuinely all the conversation offered. */
const FALLBACK_CATEGORY_ORDER: SignalCategory[] = ['romance', 'interest', 'intimacy', 'distancing']

function pickBestOfCategory(candidates: ValidatedSignal[]): ValidatedSignal {
  return (
    candidates.find((s) => s.direction === 'positive') ??
    candidates.find((s) => s.direction === 'neutral') ??
    candidates[0]
  )
}

export function selectTopSignal(intent: AnalysisIntent, signals: ValidatedSignal[]): ValidatedSignal | null {
  if (signals.length === 0) return null

  const byCategory = new Map<SignalCategory, ValidatedSignal[]>()
  for (const signal of signals) {
    const list = byCategory.get(signal.category) ?? []
    list.push(signal)
    byCategory.set(signal.category, list)
  }

  const priority = [...new Set([...(INTENT_CATEGORY_PRIORITY[intent] ?? []), ...FALLBACK_CATEGORY_ORDER])]

  for (const category of priority) {
    const candidates = byCategory.get(category)
    if (candidates && candidates.length > 0) return pickBestOfCategory(candidates)
  }

  return signals[0]
}
