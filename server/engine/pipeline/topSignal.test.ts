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

  // Phase 2.1 — Evidence Salience Ranking (Product UX Calibration item 3B):
  // within the winning category, a meaningful/relationally-distinctive
  // signal should be surfaced over a mundane/generic one, not whichever
  // happened to come first in the array.
  describe('salience ranking within a category', () => {
    test('a remembered detail outranks a generic follow-up question', () => {
      const generic = signal({ category: 'interest', signalType: 'follow_up_question' })
      const meaningful = signal({ category: 'interest', signalType: 'remembers_past_detail' })
      // Array order deliberately puts the mundane one first — order must not decide the winner.
      const picked = selectTopSignal('relationship_change', [generic, meaningful])
      expect(picked).toBe(meaningful)
    })

    test('a mundane romance signal does not beat a more meaningful one in the same category', () => {
      const mundane = signal({ category: 'romance', signalType: 'mentions_being_hungry_then_suggests_dinner' })
      const meaningful = signal({ category: 'romance', signalType: 'wants_to_meet_alone' })
      const picked = selectTopSignal('romantic_interest', [mundane, meaningful])
      // Neither signalType is in the fixed catalogue, so both fall back to the
      // same default score — this asserts the tie doesn't regress to "first
      // in array wins" silently changing meaning; it stays deterministic.
      expect(picked).toBe(mundane)
    })

    test('weak (single-message, low-salience) evidence never outranks strong (multi-message, high-salience) evidence', () => {
      const weak = signal({ category: 'intimacy', signalType: 'daily_life_share', messageIds: ['msg_0'] })
      const strong = signal({
        category: 'intimacy',
        signalType: 'vulnerable_emotion_share',
        messageIds: ['msg_0', 'msg_1', 'msg_2'],
      })
      expect(selectTopSignal('friendship_change', [weak, strong])).toBe(strong)
      // Order-independence: same result with the array reversed.
      expect(selectTopSignal('friendship_change', [strong, weak])).toBe(strong)
    })
  })

  test('evidence selection differs by intent even when the same signals are available (docs/prd_v2.md §4)', () => {
    const interest = signal({ category: 'interest', signalType: 'follow_up_question' })
    const intimacy = signal({ category: 'intimacy', signalType: 'self_disclosure' })
    const forRomantic = selectTopSignal('romantic_interest', [interest, intimacy])
    const forFriendship = selectTopSignal('friendship_change', [interest, intimacy])
    expect(forRomantic).toBe(interest) // romantic_interest prefers interest over intimacy (no romance candidate here)
    expect(forFriendship).toBe(intimacy) // friendship_change prefers intimacy first
  })
})
