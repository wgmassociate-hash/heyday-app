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
import type { Confidence, Core4Result, ConversationInitiationRatioResult, IndividualScore, RelationshipPosition, RomanceResult } from '../score/types.js'
import type { ValidatedSignal } from '../signals/types.js'
import type { AnalysisIntent } from '../intent/types.js'
import type { PaywallTeaser } from '../narrative/paywallTeaser.js'
import type { KeyScene } from '../narrative/keySceneSelector.js'
import type { RelationshipPattern } from '../narrative/patternDetector.js'

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
  /** Phase 2.1 item 9 — "분석 범위" needs to say *how much* was read, not just
   * a fuzzy time span. Count of the (deduplicated) messages inside the
   * Preview window (chunkPlan.ts's `windowMessages.length`), never the full
   * conversation's message count. */
  windowMessageCount: number
  /** Phase 2.1 item 9 — Position was already computed by score/position.ts
   * but Phase 2 never threaded it out to the Preview result, so it was
   * invisible in the UI. Named with the same "recent"-qualified convention as
   * every other Preview field (§12.4): this is the position implied by the
   * *window*, not a claim about the whole relationship. */
  recentRelationshipPosition: RelationshipPosition
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

/** A single Core4 metric's already-computed score paired with a one-line,
 * deterministic interpretation of it (server/engine/narrative/metricCopy.ts)
 * — Phase 2.4 item 5. `caption` is null exactly when `score` is null (nothing
 * to interpret yet). */
export interface MetricNote {
  score: number | null
  confidence: Confidence
  caption: string | null
}

/** Phase 2.4 item 15 — surfaced only when the user's selected Intent implies
 * a romantic frame but the Score Engine's own numbers don't back it up. The
 * CTA re-renders `PreviewPipelineResult.alternateReport` client-side — no
 * second API/LLM call, no Core score recomputation (see previewReport.ts's
 * buildAlternateReport). */
export interface MismatchNotice {
  message: string
  ctaLabel: string
}

/** Phase 2.4 — "Rich Free Preview / Reward Layer". Everything here is
 * deterministically derived from fields already on `PreviewScoreResult`
 * (plus the same `validatedSignals`/`reciprocityPairs` the Score Engine
 * already consumed) — no new LLM call, no new score. See
 * server/engine/narrative/previewReport.ts for the composer. */
export interface PreviewReport {
  /** Item 3 — answers the user's selected Intent question directly, before
   * any number is shown. */
  directAnswer: string
  /** Item 4 — one of a fixed set of relationship-agnostic stage labels
   * (server/engine/narrative/relationshipStatus.ts). */
  relationshipStatus: string
  interestNotes: Record<string, MetricNote>
  intimacyNotes: Record<string, MetricNote>
  reciprocityNote: MetricNote
  /** Item 6 — "누가 먼저 대화를 열었나", not a broader relationship-initiative
   * claim (see metricCopy.ts's INITIATION_METRIC_LABEL comment). */
  initiationSentence: string
  /** Item 8 — 2 to 4 evidence-grounded observations
   * (server/engine/narrative/patternDetector.ts). */
  patterns: RelationshipPattern[]
  /** Item 9 — 1-2 short paragraphs, observation-then-interpretation order,
   * never stronger than "상대가 당신을 좋아합니다"-style certainty. */
  psychologicalInterpretation: string
  /** Item 10 — 2-3 short paragraphs summarizing what was read. */
  aiSummary: string
  /** Item 12 — up to 2 scenes, each with its actual anonymized excerpt
   * (server/engine/narrative/keySceneSelector.ts). */
  keyScenes: KeyScene[]
  /** Item 13 — one "나 vs 상대" comparison line. */
  comparisonLine: string
  /** Item 14 — 1-2 short, non-prescriptive tips. */
  tips: string[]
  mismatch: MismatchNotice | null
}

export interface PreviewPipelineResult {
  preview: PreviewScoreResult
  narrative: PreviewNarrative
  /** Phase 2.4's rich report — see PreviewReport's own doc comment. */
  report: PreviewReport
  /** Present only when `report.mismatch` is set — the SAME report rebuilt
   * through a different Intent lens (previewReport.ts's buildAlternateReport),
   * for the mismatch CTA's "다른 관점으로 다시 보기" to render locally. */
  alternateReport: PreviewReport | null
  /** The single Evidence signal surfaced for free (PRD §20.2 "결정적 Signal
   * 1개") — null only when the preview window produced zero validated
   * signals at all. */
  topSignal: ValidatedSignal | null
  /** Phase 2.1 item 5 — code-templated "남은 질문" teasers built from this
   * same Preview's own numbers (server/engine/narrative/paywallTeaser.ts).
   * Always 2-3 entries, never a claim about Paid Deep results that don't
   * exist yet. */
  paywallTeasers: PaywallTeaser[]
  analysisMode: AnalysisMode
  intent: AnalysisIntent
  /** Chunk ids the Preview stage already ran through the LLM — Stage 2 (Phase
   * 3) must exclude these when it processes "the rest" (§16.1's "이미 수행한
   * 분석을 중복 호출하지 않는다"). */
  processedChunkIds: string[]
  usage: { inputTokens: number; outputTokens: number }
  conversationMeta: { spanDays: number; totalMessageCount: number }
}
