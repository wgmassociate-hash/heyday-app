// Phase 1 — LLM Signal Extractor unit tests, using an injected fake client
// (no real API key / network call, matching docs/implementation_plan_v2.md
// §19.5's approach of testing against a mock rather than a real provider).
import { describe, expect, test, vi } from 'vitest'
import type { Chunk } from './chunker.js'
import { extractSignalsForChunk, extractSignalsForChunks } from './llmSignalExtractor.js'

function makeChunk(id: string): Chunk {
  return {
    id,
    messages: [
      { id: 'msg_0', speakerId: 'personA', timestamp: null, date: null, text: '오늘 뭐해?', sourceType: 'txt' },
      { id: 'msg_1', speakerId: 'personB', timestamp: null, date: null, text: '그냥 집에 있어', sourceType: 'txt' },
    ],
  }
}

describe('extractSignalsForChunk', () => {
  test('does not inherit v1\'s max_tokens: 8192 default (§8.3 non-inheritance)', async () => {
    const parse = vi.fn(async (params: { max_tokens: number }) => {
      expect(params.max_tokens).not.toBe(8192)
      return { parsed_output: { relationType: 'friendship', signals: [] }, usage: { input_tokens: 1, output_tokens: 1 } }
    })
    await extractSignalsForChunk(makeChunk('chunk_0'), { client: { messages: { parse } } as never })
    expect(parse).toHaveBeenCalledTimes(1)
  })

  test('returns the parsed signals and usage on success', async () => {
    const signal = {
      signalType: 'follow_up_question',
      category: 'interest' as const,
      direction: 'positive' as const,
      actorSpeakerId: 'personA',
      targetSpeakerId: 'personB',
      messageIds: ['msg_0'],
      reason: '상대에게 안부를 물음',
    }
    const parse = vi.fn(async () => ({
      parsed_output: { relationType: 'friendship', signals: [signal] },
      usage: { input_tokens: 42, output_tokens: 7 },
    }))
    const result = await extractSignalsForChunk(makeChunk('chunk_0'), { client: { messages: { parse } } as never })
    expect(result.error).toBeNull()
    expect(result.signals).toEqual([signal])
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 7 })
  })

  test('a parse failure yields zero signals, not a thrown error or a regex-salvage attempt', async () => {
    const parse = vi.fn(async () => {
      throw new Error('structured output failed')
    })
    const result = await extractSignalsForChunk(makeChunk('chunk_0'), { client: { messages: { parse } } as never })
    expect(result.signals).toEqual([])
    expect(result.error).toBe('structured output failed')
  })

  test('an empty parsed_output also yields zero signals rather than throwing', async () => {
    const parse = vi.fn(async () => ({ parsed_output: null, usage: null }))
    const result = await extractSignalsForChunk(makeChunk('chunk_0'), { client: { messages: { parse } } as never })
    expect(result.signals).toEqual([])
    expect(result.error).not.toBeNull()
  })
})

describe('extractSignalsForChunks', () => {
  test('runs every chunk and preserves chunkId on each result', async () => {
    const parse = vi.fn(async () => ({
      parsed_output: { relationType: 'friendship', signals: [] },
      usage: { input_tokens: 1, output_tokens: 1 },
    }))
    const results = await extractSignalsForChunks(
      [makeChunk('chunk_0'), makeChunk('chunk_1')],
      { client: { messages: { parse } } as never },
    )
    expect(results.map((r) => r.chunkId)).toEqual(['chunk_0', 'chunk_1'])
    expect(parse).toHaveBeenCalledTimes(2)
  })
})
