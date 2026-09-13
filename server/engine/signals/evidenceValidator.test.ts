// Phase 1 — Evidence Validator unit tests (docs/implementation_plan_v2.md §11, §19.3).
import { describe, expect, test } from 'vitest'
import type { EnrichedMessage } from '../messageModel/types.js'
import type { RelationshipSignal } from './types.js'
import { mergeDuplicates, validateSignals } from './evidenceValidator.js'

const messages: EnrichedMessage[] = [
  { id: 'msg_0', speakerId: 'personA', timestamp: null, date: null, text: '안녕', sourceType: 'txt' },
  { id: 'msg_1', speakerId: 'personB', timestamp: null, date: null, text: '안녕하세요', sourceType: 'txt' },
]

function baseSignal(overrides: Partial<RelationshipSignal> = {}): RelationshipSignal {
  return {
    signalType: 'follow_up_question',
    category: 'interest',
    direction: 'positive',
    actorSpeakerId: 'personA',
    targetSpeakerId: 'personB',
    messageIds: ['msg_0'],
    reason: 'test',
    ...overrides,
  }
}

describe('validateSignals', () => {
  test('accepts a signal whose messageIds and speakers all resolve', () => {
    const { validated, rejected } = validateSignals([baseSignal()], messages, 'chunk_0')
    expect(validated).toHaveLength(1)
    expect(validated[0].chunkId).toBe('chunk_0')
    expect(rejected).toHaveLength(0)
  })

  test('rejects an empty messageIds array', () => {
    const { validated, rejected } = validateSignals([baseSignal({ messageIds: [] })], messages, 'chunk_0')
    expect(validated).toHaveLength(0)
    expect(rejected[0].reason).toBe('empty_message_ids')
  })

  test('rejects a signal citing a messageId that does not exist', () => {
    const { rejected } = validateSignals([baseSignal({ messageIds: ['msg_999'] })], messages, 'chunk_0')
    expect(rejected[0].reason).toBe('unknown_message_id')
  })

  test('rejects an unknown actorSpeakerId', () => {
    const { rejected } = validateSignals([baseSignal({ actorSpeakerId: 'ghost' })], messages, 'chunk_0')
    expect(rejected[0].reason).toBe('unknown_actor_speaker')
  })

  test('rejects an unknown targetSpeakerId', () => {
    const { rejected } = validateSignals([baseSignal({ targetSpeakerId: 'ghost' })], messages, 'chunk_0')
    expect(rejected[0].reason).toBe('unknown_target_speaker')
  })

  test('rejects actor === target', () => {
    const { rejected } = validateSignals(
      [baseSignal({ actorSpeakerId: 'personA', targetSpeakerId: 'personA' })],
      messages,
      'chunk_0',
    )
    expect(rejected[0].reason).toBe('actor_equals_target')
  })

  test('an empty-string targetSpeakerId (self-directed signal) is accepted, not rejected', () => {
    const { validated, rejected } = validateSignals([baseSignal({ targetSpeakerId: '' })], messages, 'chunk_0')
    expect(validated).toHaveLength(1)
    expect(rejected).toHaveLength(0)
  })
})

describe('mergeDuplicates', () => {
  test('collapses an identical signal re-extracted from an overlapping chunk', () => {
    const signalInChunk0 = { ...baseSignal(), chunkId: 'chunk_0' }
    const sameSignalInChunk1 = { ...baseSignal(), chunkId: 'chunk_1' }
    const merged = mergeDuplicates([signalInChunk0, sameSignalInChunk1])
    expect(merged).toHaveLength(1)
  })

  test('keeps signals that differ in signalType, actor, or messageIds', () => {
    const a = { ...baseSignal(), chunkId: 'chunk_0' }
    const b = { ...baseSignal({ signalType: 'remembers_past_detail' }), chunkId: 'chunk_0' }
    const c = { ...baseSignal({ messageIds: ['msg_1'] }), chunkId: 'chunk_0' }
    const merged = mergeDuplicates([a, b, c])
    expect(merged).toHaveLength(3)
  })
})
