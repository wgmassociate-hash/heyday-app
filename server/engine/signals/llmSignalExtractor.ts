// Phase 1 — LLM Signal Extractor (docs/implementation_plan_v2.md §8.3, §15.1).
//
// Explicitly does NOT inherit v1's `max_tokens: 8192` or its legacy-regex
// parse-failure fallback (server/analyze.js) — see §8.3's "비상속 원칙".
// This schema is small and bounded (max 60 signals, short fields), so it
// needs its own measured budget rather than v1's number; a parse failure
// here means the chunk contributes zero signals, on purpose (§11's "Evidence
// 없는 Signal은 Score에 반영하지 않는다" extends to "no evidence extracted
// at all" — that's a valid, honest outcome, not an error to paper over).
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { EnrichedMessage } from '../messageModel/types.js'
import type { ReciprocityPair } from './reciprocityTypes.js'
import type { Chunk } from './chunker.js'
import { buildSignalExtractionSystemPrompt } from './prompt.js'
import { SignalExtractionResponseSchema } from './schema.js'
import type { RelationshipSignal } from './types.js'

export interface ChunkExtractionUsage {
  inputTokens: number
  outputTokens: number
}

export interface ChunkExtractionResult {
  chunkId: string
  relationType: string
  signals: RelationshipSignal[]
  reciprocityPairs: ReciprocityPair[]
  usage: ChunkExtractionUsage | null
  error: string | null
}

export interface LlmSignalExtractorOptions {
  model?: string
  maxOutputTokens?: number
  /** Injectable for tests — avoids real network calls / API key requirement. */
  client?: Pick<Anthropic, 'messages'>
}

const DEFAULT_MODEL = 'claude-sonnet-4-6'

/** Provisional — chunker.ts's DEFAULT_CHUNK_SIZE (60 messages) x this
 * schema's field sizes hasn't been measured against real output yet. Revisit
 * with real usage data before Phase 2 wires this into a paid path
 * (docs/implementation_plan_v2.md §8.3). */
const DEFAULT_MAX_OUTPUT_TOKENS = 4096

function getClient(existing?: Pick<Anthropic, 'messages'>): Pick<Anthropic, 'messages'> {
  if (existing) return existing
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다')
  return new Anthropic({ apiKey })
}

function renderChunkText(messages: EnrichedMessage[]): string {
  return messages.map((m) => `[${m.id}] ${m.speakerId}: ${m.text}`).join('\n')
}

export async function extractSignalsForChunk(
  chunk: Chunk,
  options: LlmSignalExtractorOptions = {},
): Promise<ChunkExtractionResult> {
  const model = options.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL
  const maxTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS

  const userContent = `다음은 카카오톡 대화의 일부입니다. 각 줄은 "[메시지id] 화자: 내용" 형식입니다.\n\n${renderChunkText(chunk.messages)}`

  try {
    const client = getClient(options.client)
    const message = await client.messages.parse({
      model,
      max_tokens: maxTokens,
      system: buildSignalExtractionSystemPrompt(),
      messages: [{ role: 'user', content: userContent }],
      output_config: { format: zodOutputFormat(SignalExtractionResponseSchema) },
    })

    const parsed = message.parsed_output
    if (!parsed) throw new Error('구조화 출력이 비어 있습니다')

    return {
      chunkId: chunk.id,
      relationType: parsed.relationType,
      signals: parsed.signals,
      reciprocityPairs: parsed.reciprocityPairs,
      usage: message.usage
        ? { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }
        : null,
      error: null,
    }
  } catch (err) {
    return {
      chunkId: chunk.id,
      relationType: 'ambiguous',
      signals: [],
      reciprocityPairs: [],
      usage: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function extractSignalsForChunks(
  chunks: Chunk[],
  options: LlmSignalExtractorOptions = {},
): Promise<ChunkExtractionResult[]> {
  return Promise.all(chunks.map((chunk) => extractSignalsForChunk(chunk, options)))
}
