// Phase 2 — /api/preview route logic (docs/implementation_plan_v2.md §16.2,
// §20 Phase 2). Mirrors server/analyze.js's shape (quota check happens in the
// route, this function does the LLM work + metadata-only usage logging) but
// calls the new Relationship Engine (server/engine/pipeline/previewPipeline.ts)
// instead of the v1 single-prompt analyzer. Free v2 results are returned to
// the browser only; they are deliberately not persisted while Paid Deep/result
// recovery remains outside the current product scope.
import { getUsageLogRepository } from './db/repositories/usageLogRepository.js'
import { estimateCostUsd } from './db/pricing.js'
import type { AnalysisIntent } from './engine/intent/types.js'
import { runPreviewPipeline } from './engine/pipeline/previewPipeline.js'
import type { PreviewNarrative, PreviewReport, PreviewScoreResult } from './engine/pipeline/types.js'
import type { ValidatedSignal } from './engine/signals/types.js'
import type { PaywallTeaser } from './engine/narrative/paywallTeaser.js'

/** Deliberately does NOT default to a smaller token budget than
 * llmSignalExtractor.ts's own DEFAULT_MAX_OUTPUT_TOKENS (4096). §26 flags a
 * lower Preview-specific budget as something to measure and introduce later,
 * but guessing a smaller number here without that measurement is actively
 * dangerous, not just "unoptimized": confirmed live against samples/01-romantic-some.txt
 * (32 messages, single chunk) that 2048 truncates the structured-output JSON
 * mid-string ("Unterminated string in JSON") — the exact failure mode
 * analysis_v1.md/§23.3 already documented for v1's original 4096 default,
 * now reproduced at an even lower ceiling. A parse failure here silently
 * yields zero signals (§8.3's "no evidence extracted at all" contract) rather
 * than an error, so this kind of regression is invisible unless someone
 * actually inspects the output — hence leaving this unset by default and
 * only overridable via ANTHROPIC_PREVIEW_MAX_OUTPUT_TOKENS once real
 * measurement (§26) justifies a specific smaller number. */
const DEFAULT_PREVIEW_MAX_OUTPUT_TOKENS: number | undefined = undefined

/** Mirrors llmSignalExtractor.ts's own DEFAULT_MODEL — used only to label the
 * usage log entry accurately when ANTHROPIC_PREVIEW_MODEL/ANTHROPIC_MODEL
 * aren't set, since `model` itself is left undefined in that case so the
 * extractor resolves its own default rather than this module guessing one. */
const FALLBACK_MODEL_LABEL = 'claude-sonnet-4-6'

export interface PreviewAnalysisResult {
  preview: PreviewScoreResult
  narrative: PreviewNarrative
  report: PreviewReport
  alternateReport: PreviewReport | null
  topSignal: ValidatedSignal | null
  paywallTeasers: PaywallTeaser[]
  analysisMode: string
  windowLabel: string
  /** Phase 2.4 item 2 — the frontend result screen needs to echo back which
   * question the user actually picked ("내가 선택한 질문") before showing
   * report.directAnswer. */
  intent: AnalysisIntent
}

export async function runPreviewAnalysis(
  anonymizedText: string,
  intent: AnalysisIntent,
  deviceId: string | null,
): Promise<PreviewAnalysisResult> {
  // Left undefined unless explicitly overridden — llmSignalExtractor.ts then
  // falls back to its own env var / measured default rather than this module
  // guessing one (see DEFAULT_PREVIEW_MAX_OUTPUT_TOKENS's comment above).
  const model = process.env.ANTHROPIC_PREVIEW_MODEL || process.env.ANTHROPIC_MODEL || undefined
  const maxOutputTokens = process.env.ANTHROPIC_PREVIEW_MAX_OUTPUT_TOKENS
    ? Number(process.env.ANTHROPIC_PREVIEW_MAX_OUTPUT_TOKENS)
    : DEFAULT_PREVIEW_MAX_OUTPUT_TOKENS

  const startedAt = Date.now()
  let inputTokens = 0
  let outputTokens = 0
  let success = false
  let errorMessage: string | null = null

  try {
    const result = await runPreviewPipeline({
      text: anonymizedText,
      sourceType: 'txt',
      intent,
      llmOptions: { model, maxOutputTokens },
    })
    inputTokens = result.usage.inputTokens
    outputTokens = result.usage.outputTokens

    success = true
    return {
      preview: result.preview,
      narrative: result.narrative,
      report: result.report,
      alternateReport: result.alternateReport,
      topSignal: result.topSignal,
      paywallTeasers: result.paywallTeasers,
      analysisMode: result.analysisMode,
      windowLabel: result.preview.windowLabel,
      intent,
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
    throw err
  } finally {
    const resolvedModelLabel = model ?? FALLBACK_MODEL_LABEL
    void getUsageLogRepository()
      .record({
        deviceId,
        callSite: 'relationship_preview',
        model: resolvedModelLabel,
        inputTokens,
        outputTokens,
        costEstimate: inputTokens || outputTokens ? estimateCostUsd(resolvedModelLabel, inputTokens, outputTokens) : 0,
        durationMs: Date.now() - startedAt,
        success,
        errorMessage,
      })
      .catch((logErr) => console.warn('[usage-log]', logErr instanceof Error ? logErr.message : logErr))
  }
}
