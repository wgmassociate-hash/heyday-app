// Phase 1 — message chunking for the LLM Signal Extractor
// (docs/implementation_review_v2.md §3 "메시지당 의미분석 1회").
//
// This is deliberately separate from the Preview-window selection logic
// ("최근 충분한 대화 구간", docs/implementation_plan_v2.md §13.2) — that's a
// Stage1/Stage2 cost-allocation decision for Phase 2's pipeline. This module
// just answers "how do we split N messages into LLM-sized chunks" for
// whichever subset of messages a caller decides to run through the
// extractor.
import type { EnrichedMessage } from '../messageModel/types.js'

export interface Chunk {
  id: string
  messages: EnrichedMessage[]
}

/** Messages per chunk. Tunable — not yet measured against real token counts
 * (docs/implementation_plan_v2.md §8.3 says v2 must measure its own
 * max_tokens rather than copy v1's, and chunk size is the other half of that
 * budget). */
export const DEFAULT_CHUNK_SIZE = 60

/** A small overlap keeps a signal that spans a chunk boundary (e.g. a
 * question in one chunk answered in the next) from being invisible to
 * either call. Evidence Validator's mergeDuplicates() collapses any signal
 * detected identically in both chunks. */
export const DEFAULT_CHUNK_OVERLAP = 5

export function buildChunkPlan(
  messages: EnrichedMessage[],
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP,
): Chunk[] {
  if (messages.length === 0) return []
  if (chunkSize <= overlap) {
    throw new Error('buildChunkPlan: chunkSize must be greater than overlap')
  }

  const chunks: Chunk[] = []
  let start = 0
  let index = 0
  while (start < messages.length) {
    const end = Math.min(start + chunkSize, messages.length)
    chunks.push({ id: `chunk_${index}`, messages: messages.slice(start, end) })
    index += 1
    if (end >= messages.length) break
    start = end - overlap
  }
  return chunks
}
