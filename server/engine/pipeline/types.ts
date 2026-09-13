// Phase 2 — Free Preview pipeline types (docs/implementation_plan_v2.md §12.4,
// §16.2).
//
// §12.4's original sketch flattened Temperature/Romance down to plain
// numbers (`recentConversationTemperature: number`). That sketch predates
// Phase 1.2's Missing-Evidence redesign (§25), which turned every metric into
// an `IndividualScore` (`score: number | null` + independent `confidence`) so
// "not enough opportunity to judge" (null) is never confused with "judged and
// found nothing" (a real 0). Flattening that back to a bare number here would
// throw away exactly the distinction §25 was built to preserve, so this type
// carries the full IndividualScore/RomanceResult/Core4Result shapes through
// instead — the field *names* are still kept Preview-specific per §12.4's
// core design goal (never let a Preview number silently masquerade as the
// Paid "관계온도").
import type { Core4Result, ConversationInitiationRatioResult, IndividualScore, RomanceResult } from '../score/types.js'
import type { ValidatedSignal } from '../signals/types.js'
import type { AnalysisIntent } from '../intent/types.js'

export type AnalysisMode = 'snapshot' | 'standard' | 'deep'

/** §12.4: Preview's result type is intentionally distinct from (eventual)
 * Paid's — no shared field names — so UI/API code can't accidentally treat a
 * "최근 대화 온도" as "관계온도" (a mixup that would be a silent, wrong claim
 * about the whole relationship from a partial read). */
export interface PreviewScoreResult {
  recentConversationTemperature: IndividualScore
  recentRomanceSignal: RomanceResult
  initiativeRatioPreview: ConversationInitiationRatioResult
  core4Preview: Core4Result
  /** Human-readable span of the window actually analyzed, e.g. "최근 3주" or
   * "최근 대화 전체" — always non-empty, always surfaced to the user
   * (docs/implementation_plan_v2.md §13.2, §15.4). */
  windowLabel: string
  confidenceLabel: 'recent_window'
  scoreEngineVersion: string
}

export interface PreviewNarrative {
  firstVerdict: string
  summaryOneLine: string
}

export interface PreviewPipelineResult {
  preview: PreviewScoreResult
  narrative: PreviewNarrative
  /** The single Evidence signal surfaced for free (PRD §20.2 "결정적 Signal
   * 1개") — null only when the preview window produced zero validated
   * signals at all. */
  topSignal: ValidatedSignal | null
  analysisMode: AnalysisMode
  intent: AnalysisIntent
  /** Chunk ids the Preview stage already ran through the LLM — Stage 2 (Phase
   * 3) must exclude these when it processes "the rest" (§16.1's "이미 수행한
   * 분석을 중복 호출하지 않는다"). */
  processedChunkIds: string[]
  usage: { inputTokens: number; outputTokens: number }
  conversationMeta: { spanDays: number; totalMessageCount: number }
}
