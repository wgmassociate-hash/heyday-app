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

// Phase 2.1 — Evidence Salience Ranking (Product UX Calibration item 3B).
// A category winning the intent-priority round (above) used to just take
// "first positive, else first neutral, else whatever's there" within that
// category — so a mundane, generic signal ("상대가 배고프다고 함") could beat
// a much more relationship-meaningful one ("지난달 얘기했던 걸 기억하고
// 다시 물어봄") purely by array order. This table encodes which *kind* of
// behavior is a better free-preview story, independent of Score Engine's
// weights.ts (that table optimizes for aggregate score contribution, not
// "best single anecdote to show for free" — the two goals diverge, e.g. a
// routine follow_up_question scores well but is a weak anecdote next to a
// remembered detail from weeks ago). Values are ordinal, not measured.
const SIGNAL_SALIENCE_SCORE: Record<string, number> = {
  // interest catalogue (server/engine/score/weights.ts INTEREST_SIGNAL_CONFIG)
  remembers_past_detail: 95,
  follows_up_on_plan: 90,
  checks_on_feelings: 85,
  specific_interest_expression: 75,
  revives_conversation: 55,
  follow_up_question: 50,
  expands_topic: 35,
  // intimacy catalogue (INTIMACY_SIGNAL_CONFIG)
  includes_partner_in_future: 80,
  self_disclosure: 68,
  vulnerable_emotion_share: 68,
  shared_context_reference: 60,
  playful_teasing_or_nickname: 55,
  daily_life_share: 45,
}

/** romance/distancing signalTypes are free-form (LLM-invented snake_case,
 * no fixed catalogue — signals/prompt.ts) so they can't be looked up above.
 * Mid-table by design: a real romance signal shouldn't be buried under every
 * catalogued interest/intimacy entry just for lacking a table row, but a
 * generic one also shouldn't outrank a genuinely distinctive, catalogued
 * behavior within the same category. */
const DEFAULT_SALIENCE_SCORE = 62

/** Exported for narrative/keySceneSelector.ts (Phase 2.4 item 12): the free
 * "핵심 장면" section reuses this exact salience ranking to pick a *second*
 * scene distinct from selectTopSignal's pick, rather than inventing a
 * separate notion of "interesting" for the same underlying signals. */
export function rankBySalience(signals: ValidatedSignal[]): ValidatedSignal[] {
  return [...signals].sort((a, b) => salienceScore(b) - salienceScore(a))
}

function salienceScore(signal: ValidatedSignal): number {
  const base = SIGNAL_SALIENCE_SCORE[signal.signalType] ?? DEFAULT_SALIENCE_SCORE
  // "여러 messageId가 연결된 context인지" — a signal grounded in more than one
  // message is a fuller little story, not just a single line. Capped small so
  // it can only break ties between similar-salience signals, never flip a
  // clearly-more-meaningful single-message signal below a clearly-mundane
  // multi-message one.
  const contextBreadthBonus = Math.min(signal.messageIds.length, 3) - 1
  return base + contextBreadthBonus
}

function pickBestOfCategory(candidates: ValidatedSignal[]): ValidatedSignal {
  const positives = candidates.filter((s) => s.direction === 'positive')
  const neutrals = candidates.filter((s) => s.direction === 'neutral')
  const pool = positives.length > 0 ? positives : neutrals.length > 0 ? neutrals : candidates
  return [...pool].sort((a, b) => salienceScore(b) - salienceScore(a))[0]
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
