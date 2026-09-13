// Phase 2 — "최근 충분한 대화 구간" window selection (docs/implementation_plan_v2.md §13.2).
//
// This is deliberately separate from chunker.ts's buildChunkPlan(), which
// just answers "how do we split N messages into LLM-sized chunks". This
// module answers a different question: of all the chunks in that plan, which
// ones does the *Preview* (Stage 1, pre-payment) stage actually pay to run
// through the LLM? Stage 2 (Phase 3) will process whatever this leaves out.
import type { EnrichedMessage } from '../messageModel/types.js'
import type { Chunk } from '../signals/chunker.js'

/** Below this many messages in the window, a Preview would be judging off too
 * little — keep expanding backward in time. Tunable, not yet measured against
 * real cost/quality data (docs/implementation_plan_v2.md §26 records that
 * measurement as an open Phase 2 to-do, not a blocker for wiring the logic). */
export const MIN_PREVIEW_MESSAGES = 40

/** Hard cost ceiling — stop expanding even if MIN_PREVIEW_MESSAGES hasn't
 * been reached yet (only possible when the whole conversation is shorter than
 * this, in which case the "window" is just the entire conversation). */
export const MAX_PREVIEW_MESSAGES = 120

export interface PreviewWindowSelection {
  /** The chunks the LLM Signal Extractor should actually run for Stage 1 —
   * still carries chunker.ts's overlap between adjacent chunks. */
  chunks: Chunk[]
  /** The same messages, flattened and de-duplicated by id (overlap removed),
   * in original conversation order — this is what Code Feature Extractor
   * should run over to get the Preview-scoped opportunity counts (§9.4). */
  windowMessages: EnrichedMessage[]
  windowLabel: string
  isEntireConversation: boolean
}

function mergeChunkMessages(chunks: Chunk[]): EnrichedMessage[] {
  const seen = new Set<string>()
  const merged: EnrichedMessage[] = []
  for (const chunk of chunks) {
    for (const message of chunk.messages) {
      if (seen.has(message.id)) continue
      seen.add(message.id)
      merged.push(message)
    }
  }
  return merged
}

function dateSpanDays(windowMessages: EnrichedMessage[], dateMsById: Map<string, number | null>): number | null {
  let min: number | null = null
  let max: number | null = null
  for (const message of windowMessages) {
    const ms = dateMsById.get(message.id)
    if (ms == null) continue
    if (min === null || ms < min) min = ms
    if (max === null || ms > max) max = ms
  }
  if (min === null || max === null) return null
  return (max - min) / (1000 * 60 * 60 * 24)
}

/** Renders the window's actual time span into the human-readable label that
 * docs/implementation_plan_v2.md §15.4 requires every Preview Narrative
 * string to include, so "최근 대화 미리보기" always states which "최근" it
 * means instead of leaving it implicit. */
function buildWindowLabel(
  windowMessages: EnrichedMessage[],
  isEntireConversation: boolean,
  dateMsById: Map<string, number | null>,
): string {
  if (isEntireConversation) return '최근 대화 전체'

  const spanDays = dateSpanDays(windowMessages, dateMsById)
  if (spanDays === null) return '최근 대화'
  if (spanDays <= 1) return '최근 대화'
  if (spanDays <= 3) return '최근 며칠'
  if (spanDays <= 10) return '최근 1주'
  if (spanDays <= 20) return '최근 2주'
  if (spanDays <= 35) return '최근 한 달'
  return `최근 ${Math.round(spanDays / 30)}개월`
}

export function selectPreviewWindow(
  fullChunkPlan: Chunk[],
  allMessages: EnrichedMessage[],
  dateMsById: Map<string, number | null>,
): PreviewWindowSelection {
  if (fullChunkPlan.length === 0) {
    return { chunks: [], windowMessages: [], windowLabel: '최근 대화', isEntireConversation: true }
  }

  const selected: Chunk[] = []
  let total = 0
  for (let i = fullChunkPlan.length - 1; i >= 0; i--) {
    selected.unshift(fullChunkPlan[i])
    total += fullChunkPlan[i].messages.length
    if (total >= MIN_PREVIEW_MESSAGES || total >= MAX_PREVIEW_MESSAGES) break
  }

  const windowMessages = mergeChunkMessages(selected)
  const isEntireConversation = windowMessages.length >= allMessages.length
  const windowLabel = buildWindowLabel(windowMessages, isEntireConversation, dateMsById)

  return { chunks: selected, windowMessages, windowLabel, isEntireConversation }
}
