import { describe, expect, test } from 'vitest'
import type { ValidatedSignal } from '../signals/types.js'
import { selectTopSignal } from './topSignal.js'

function signal(overrides: Partial<ValidatedSignal>): ValidatedSignal {
  return {
    signalType: 'x',
    category: 'interest',
    direction: 'positive',
    actorSpeakerId: 'A',
    targetSpeakerId: 'B',
    messageIds: ['msg_0'],
    reason: 'r',
    chunkId: 'chunk_0',
    ...overrides,
  }
}

describe('selectTopSignal (docs/prd_v2.md §4)', () => {
  test('empty input returns null', () => {
    expect(selectTopSignal('romantic_interest', [])).toBeNull()
  })

  test('romantic_interest prefers a romance signal over interest/intimacy', () => {
    const romance = signal({ category: 'romance', signalType: 'wants_to_meet_alone' })
    const interest = signal({ category: 'interest', signalType: 'follow_up_question' })
    const picked = selectTopSignal('romantic_interest', [interest, romance])
    expect(picked).toBe(romance)
  })

  test('friendship_change prefers intimacy over interest and never picks romance first', () => {
    const romance = signal({ category: 'romance', signalType: 'wants_to_meet_alone' })
    const intimacy = signal({ category: 'intimacy', signalType: 'self_disclosure' })
    const picked = selectTopSignal('friendship_change', [romance, intimacy])
    expect(picked).toBe(intimacy)
  })

  test('within a category, a positive-direction signal beats a neutral one', () => {
    const neutral = signal({ category: 'romance', direction: 'neutral', signalType: 'a' })
    const positive = signal({ category: 'romance', direction: 'positive', signalType: 'b' })
    const picked = selectTopSignal('romantic_interest', [neutral, positive])
    expect(picked).toBe(positive)
  })

  test('falls back to distancing only when nothing else is available', () => {
    const distancing = signal({ category: 'distancing', direction: 'negative', signalType: 'avoids_meeting' })
    const picked = selectTopSignal('romantic_interest', [distancing])
    expect(picked).toBe(distancing)
  })

  test('every intent falls back gracefully when its preferred categories are absent', () => {
    const distancing = signal({ category: 'distancing', direction: 'negative', signalType: 'avoids_meeting' })
    const intents = ['romantic_interest', 'relationship_change', 'imbalance', 'conversation_meaning', 'relationship_definition', 'friendship_change'] as const
    for (const intent of intents) {
      expect(selectTopSignal(intent, [distancing])).toBe(distancing)
    }
  })
})
