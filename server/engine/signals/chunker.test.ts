// Phase 1 — chunker unit tests (docs/implementation_review_v2.md §3).
import { describe, expect, test } from 'vitest'
import type { EnrichedMessage } from '../messageModel/types.js'
import { buildChunkPlan } from './chunker.js'

function makeMessages(n: number): EnrichedMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `msg_${i}`,
    speakerId: i % 2 === 0 ? 'personA' : 'personB',
    timestamp: null,
    date: null,
    text: `message ${i}`,
    sourceType: 'txt' as const,
  }))
}

describe('buildChunkPlan', () => {
  test('returns nothing for an empty conversation', () => {
    expect(buildChunkPlan([])).toEqual([])
  })

  test('a conversation shorter than one chunk is a single chunk', () => {
    const chunks = buildChunkPlan(makeMessages(10), 60, 5)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].messages).toHaveLength(10)
  })

  test('splits a long conversation into overlapping chunks covering every message', () => {
    const messages = makeMessages(140)
    const chunks = buildChunkPlan(messages, 60, 5)
    expect(chunks.length).toBeGreaterThan(1)

    const covered = new Set<string>()
    for (const chunk of chunks) {
      for (const m of chunk.messages) covered.add(m.id)
    }
    expect(covered.size).toBe(messages.length)

    // consecutive chunks overlap by exactly `overlap` messages
    for (let i = 1; i < chunks.length; i++) {
      const prevIds = chunks[i - 1].messages.map((m) => m.id)
      const currIds = chunks[i].messages.map((m) => m.id)
      const overlap = prevIds.filter((id) => currIds.includes(id))
      expect(overlap.length).toBe(5)
    }
  })

  test('rejects a chunkSize that is not larger than the overlap', () => {
    expect(() => buildChunkPlan(makeMessages(10), 5, 5)).toThrow()
  })
})
