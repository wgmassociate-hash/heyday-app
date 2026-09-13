// Phase 2 — Stage 1 / Free Preview orchestration (docs/implementation_plan_v2.md
// §16.2). First place in this codebase that actually wires Parser -> Standard
// Message Model -> Code Feature Extractor -> "최근 충분한 구간" window ->
// LLM Signal Extractor -> Evidence Validator -> Score Engine -> Narrative
// together end to end. Stage 2 (Phase 3) will follow the same shape for "the
// rest" of the conversation.
import { extractCodeFeatures } from '../features/codeFeatureExtractor.js'
import { enrichMessages } from '../messageModel/enrich.js'
import { getConversationMeta, parseMessages } from '../messageModel/parseChatShim.js'
import { toStandardMessages } from '../messageModel/toStandardMessages.js'
import type { EnrichedMessage, Message } from '../messageModel/types.js'
import { buildPreviewNarrative } from '../narrative/previewNarrative.js'
import { runScoreEngine } from '../score/scoreEngine.js'
import { buildChunkPlan } from '../signals/chunker.js'
import { mergeDuplicates, mergeDuplicatePairs, validateReciprocityPairs, validateSignals } from '../signals/evidenceValidator.js'
import { extractSignalsForChunks } from '../signals/llmSignalExtractor.js'
import type { LlmSignalExtractorOptions } from '../signals/llmSignalExtractor.js'
import type { ValidatedReciprocityPair } from '../signals/reciprocityTypes.js'
import type { ValidatedSignal } from '../signals/types.js'
import type { AnalysisIntent } from '../intent/types.js'
import { determineAnalysisMode } from './analysisMode.js'
import { selectPreviewWindow } from './chunkPlan.js'
import { selectTopSignal } from './topSignal.js'
import type { PreviewPipelineResult, PreviewScoreResult } from './types.js'

export interface RunPreviewPipelineInput {
  /** Already privacy-scrubbed chat text (docs/implementation_plan_v2.md §6) —
   * this module does no anonymization of its own, same contract as
   * toStandardMessages.ts. */
  text: string
  sourceType: Message['sourceType']
  intent: AnalysisIntent
  /** Preview-specific model/token budget override (docs/implementation_plan_v2.md
   * §26) — left to the caller so env-based tuning doesn't require touching
   * this file. */
  llmOptions?: LlmSignalExtractorOptions
}

function buildDateMsById(enriched: EnrichedMessage[], raw: ReturnType<typeof parseMessages>): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (let i = 0; i < enriched.length; i++) {
    map.set(enriched[i].id, raw[i]?.dateMs ?? null)
  }
  return map
}

export async function runPreviewPipeline(input: RunPreviewPipelineInput): Promise<PreviewPipelineResult> {
  const raw = parseMessages(input.text)
  const { messages } = toStandardMessages(input.text, { sourceType: input.sourceType })
  const meta = getConversationMeta(raw)
  const enriched = enrichMessages(messages, raw)
  const dateMsById = buildDateMsById(enriched, raw)

  const fullCodeFeatures = extractCodeFeatures(enriched)
  const analysisMode = determineAnalysisMode({
    messageCount: enriched.length,
    spanDays: meta.spanDays,
    sessionCount: fullCodeFeatures.sessionCount,
  })

  const fullChunkPlan = buildChunkPlan(enriched)
  const { chunks: previewChunks, windowMessages, windowLabel } = selectPreviewWindow(fullChunkPlan, enriched, dateMsById)

  const extractionResults = await extractSignalsForChunks(previewChunks, input.llmOptions)

  const chunkById = new Map(previewChunks.map((chunk) => [chunk.id, chunk]))
  const validatedSignalsByChunk: ValidatedSignal[] = []
  const validatedPairsByChunk: ValidatedReciprocityPair[] = []
  let inputTokens = 0
  let outputTokens = 0

  for (const result of extractionResults) {
    const chunk = chunkById.get(result.chunkId)
    if (!chunk) continue // defensive — extractSignalsForChunks always echoes back a chunk id it was given

    const { validated: validSignals } = validateSignals(result.signals, chunk.messages, chunk.id)
    validatedSignalsByChunk.push(...validSignals)

    const { validated: validPairs } = validateReciprocityPairs(result.reciprocityPairs, chunk.messages, chunk.id)
    validatedPairsByChunk.push(...validPairs)

    if (result.usage) {
      inputTokens += result.usage.inputTokens
      outputTokens += result.usage.outputTokens
    }
  }

  const validatedSignals = mergeDuplicates(validatedSignalsByChunk)
  const reciprocityPairs = mergeDuplicatePairs(validatedPairsByChunk)

  // §9.4: Preview's opportunity denominators are scoped to the preview
  // window only, not the full conversation — this is what makes Preview and
  // (eventual) Paid numbers legitimately different, not a bug.
  const windowCodeFeatures = extractCodeFeatures(windowMessages)

  const scoreResult = runScoreEngine({
    codeFeatures: windowCodeFeatures,
    validatedSignals,
    reciprocityPairs,
  })

  const preview: PreviewScoreResult = {
    recentConversationTemperature: scoreResult.temperature,
    recentRomanceSignal: scoreResult.romance,
    initiativeRatioPreview: scoreResult.core4.conversationInitiationRatio,
    core4Preview: scoreResult.core4,
    windowLabel,
    confidenceLabel: 'recent_window',
    scoreEngineVersion: scoreResult.scoreEngineVersion,
  }

  const topSignal = selectTopSignal(input.intent, validatedSignals)
  const narrative = buildPreviewNarrative(preview, topSignal)

  return {
    preview,
    narrative,
    topSignal,
    analysisMode,
    intent: input.intent,
    processedChunkIds: previewChunks.map((chunk) => chunk.id),
    usage: { inputTokens, outputTokens },
    conversationMeta: { spanDays: meta.spanDays, totalMessageCount: enriched.length },
  }
}
