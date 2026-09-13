import { describe, expect, test } from 'vitest'
import type { EnrichedMessage } from '../messageModel/types.js'
import { buildChunkPlan } from '../signals/chunker.js'
import { MAX_PREVIEW_MESSAGES, MIN_PREVIEW_MESSAGES, selectPreviewWindow } from './chunkPlan.js'

/** Builds `count` messages spread one per `stepMinutes` apart, starting from
 * a fixed epoch, alternating speakers A/B. Returns both the messages and a
 * dateMsById map, mirroring what previewPipeline.ts assembles from the
 * parser's raw output. */
function buildFixture(count: number, stepMinutes: number): { messages: EnrichedMessage[]; dateMsById: Map<string, number | null> } {
  const start = Date.UTC(2026, 0, 1)
  const messages: EnrichedMessage[] = []
  const dateMsById = new Map<string, number | null>()
  for (let i = 0; i < count; i++) {
    const id = `msg_${i}`
    const dateMs = start + i * stepMinutes * 60 * 1000
    messages.push({
      id,
      speakerId: i % 2 === 0 ? 'A' : 'B',
      timestamp: null,
      date: null,
      text: `message ${i}`,
      sourceType: 'txt',
    })
    dateMsById.set(id, dateMs)
  }
  return { messages, dateMsById }
}

describe('selectPreviewWindow (docs/implementation_plan_v2.md §13.2)', () => {
  test('a conversation shorter than MIN_PREVIEW_MESSAGES is entirely the window', () => {
    const { messages, dateMsById } = buildFixture(20, 5)
    const chunkPlan = buildChunkPlan(messages)
    const selection = selectPreviewWindow(chunkPlan, messages, dateMsById)

    expect(selection.isEntireConversation).toBe(true)
    expect(selection.windowMessages).toHaveLength(20)
    expect(selection.windowLabel).toBe('최근 대화 전체')
  })

  test('a long conversation selects a recent suffix within [MIN, MAX] messages', () => {
    const { messages, dateMsById } = buildFixture(500, 5)
    const chunkPlan = buildChunkPlan(messages)
    const selection = selectPreviewWindow(chunkPlan, messages, dateMsById)

    expect(selection.isEntireConversation).toBe(false)
    expect(selection.windowMessages.length).toBeGreaterThanOrEqual(MIN_PREVIEW_MESSAGES)
    expect(selection.windowMessages.length).toBeLessThanOrEqual(MAX_PREVIEW_MESSAGES)
    // The window must be the most recent messages, in original order.
    expect(selection.windowMessages.at(-1)?.id).toBe('msg_499')
    for (let i = 1; i < selection.windowMessages.length; i++) {
      const prevIndex = Number(selection.windowMessages[i - 1].id.replace('msg_', ''))
      const currIndex = Number(selection.windowMessages[i].id.replace('msg_', ''))
      expect(currIndex).toBeGreaterThan(prevIndex)
    }
  })

  test('windowMessages has no duplicate ids when more than one chunk is selected', () => {
    // 65 messages -> chunker produces a 60-message chunk plus a trailing
    // 10-message chunk (overlap 5) whose count alone is below
    // MIN_PREVIEW_MESSAGES, forcing selectPreviewWindow to pull in both.
    const { messages, dateMsById } = buildFixture(65, 5)
    const chunkPlan = buildChunkPlan(messages)
    const selection = selectPreviewWindow(chunkPlan, messages, dateMsById)

    expect(selection.chunks.length).toBeGreaterThanOrEqual(2)
    const ids = selection.windowMessages.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(65) // the two overlapping chunks cover the whole conversation
  })

  test('windowLabel reflects a short real span (~2 days -> "최근 며칠")', () => {
    // The selected window is exactly the last chunk (60 messages, 59 gaps)
    // whenever that chunk alone already clears MIN_PREVIEW_MESSAGES.
    const { messages, dateMsById } = buildFixture(500, 50)
    const chunkPlan = buildChunkPlan(messages)
    const selection = selectPreviewWindow(chunkPlan, messages, dateMsById)
    expect(selection.windowLabel).toBe('최근 며칠')
  })

  test('windowLabel reflects a multi-week real span (-> "최근 2주")', () => {
    const { messages, dateMsById } = buildFixture(500, 350)
    const chunkPlan = buildChunkPlan(messages)
    const selection = selectPreviewWindow(chunkPlan, messages, dateMsById)
    expect(selection.windowLabel).toBe('최근 2주')
  })

  test('empty input returns an empty, "entire conversation" window', () => {
    const selection = selectPreviewWindow([], [], new Map())
    expect(selection.chunks).toHaveLength(0)
    expect(selection.windowMessages).toHaveLength(0)
    expect(selection.isEntireConversation).toBe(true)
  })
})
