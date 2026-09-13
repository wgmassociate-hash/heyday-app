// Phase 2 — end-to-end sanity check for runPreviewPipeline, using an injected
// fake Anthropic client (no real network call) against one of 1.0's real
// regression fixtures, same convention as messageModel/pipeline.test.ts.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test, vi } from 'vitest'
import { toStandardMessages } from '../messageModel/toStandardMessages.js'
import { runPreviewPipeline } from './previewPipeline.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const SAMPLE_PATH = join(REPO_ROOT, 'samples/01-romantic-some.txt')
const text = readFileSync(SAMPLE_PATH, 'utf8')

const { messages: sampleMessages } = toStandardMessages(text, { sourceType: 'txt' })
const SPEAKER_A = sampleMessages[0].speakerId
const SPEAKER_B = sampleMessages.find((m) => m.speakerId !== SPEAKER_A)!.speakerId
const SOME_MESSAGE_ID = sampleMessages[0].id

/** The whole sample (32 lines) fits in one chunker.ts chunk, so
 * extractSignalsForChunks makes exactly one call — this fake only needs to
 * handle that one call. */
function makeFakeClient() {
  const parse = vi.fn(async () => ({
    parsed_output: {
      relationType: 'romantic',
      signals: [
        {
          signalType: 'follow_up_question',
          category: 'interest',
          direction: 'positive',
          actorSpeakerId: SPEAKER_A,
          targetSpeakerId: SPEAKER_B,
          messageIds: [SOME_MESSAGE_ID],
          reason: '상대의 이야기에 후속 질문을 던짐',
        },
        {
          signalType: 'wants_to_meet_alone',
          category: 'romance',
          direction: 'positive',
          actorSpeakerId: SPEAKER_B,
          targetSpeakerId: SPEAKER_A,
          messageIds: [SOME_MESSAGE_ID],
          reason: '단둘이 만나자는 제안',
        },
      ],
      reciprocityPairs: [],
    },
    usage: { input_tokens: 100, output_tokens: 40 },
  }))
  return { messages: { parse } }
}

describe('runPreviewPipeline (docs/implementation_plan_v2.md §16.2)', () => {
  test('wires Parser -> Score Engine -> Narrative end to end', async () => {
    const result = await runPreviewPipeline({
      text,
      sourceType: 'txt',
      intent: 'romantic_interest',
      llmOptions: { client: makeFakeClient() as never },
    })

    expect(result.preview.windowLabel).toBeTruthy()
    expect(result.narrative.firstVerdict).toContain(result.preview.windowLabel)
    expect(result.narrative.summaryOneLine).toContain(result.preview.windowLabel)
    expect(result.topSignal).not.toBeNull()
    expect(result.topSignal?.category).toBe('romance') // romantic_interest prioritizes romance (§4)
    expect(result.processedChunkIds.length).toBe(1)
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 40 })
    expect(result.analysisMode).toBe('snapshot') // 32-line sample is well under SNAPSHOT_MAX_MESSAGES
  })

  test('the LLM Signal Extractor is called exactly once for a small conversation (completion criterion #1)', async () => {
    const client = makeFakeClient()
    await runPreviewPipeline({ text, sourceType: 'txt', intent: 'romantic_interest', llmOptions: { client: client as never } })
    expect(client.messages.parse).toHaveBeenCalledTimes(1)
  })

  test('changing only intent does not change Core4/Temperature (completion criterion #3)', async () => {
    const resultA = await runPreviewPipeline({
      text,
      sourceType: 'txt',
      intent: 'romantic_interest',
      llmOptions: { client: makeFakeClient() as never },
    })
    const resultB = await runPreviewPipeline({
      text,
      sourceType: 'txt',
      intent: 'friendship_change',
      llmOptions: { client: makeFakeClient() as never },
    })

    expect(resultA.preview.recentConversationTemperature).toEqual(resultB.preview.recentConversationTemperature)
    expect(resultA.preview.core4Preview).toEqual(resultB.preview.core4Preview)
    expect(resultA.preview.recentRomanceSignal).toEqual(resultB.preview.recentRomanceSignal)
    // But the surfaced Evidence *is* allowed to differ by intent.
    expect(resultA.topSignal?.category).toBe('romance')
    expect(resultB.topSignal?.category).toBe('interest')
  })
})
