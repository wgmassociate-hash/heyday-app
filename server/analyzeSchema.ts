// Phase 0 — structured-output schema for server/analyze.js, replacing the
// regex-based extractJson() (fenced-codeblock-strip + first{..last} slice,
// analysis_v1.md §4.4/§4.5) with Anthropic's native output_config.format.
//
// Fields are REQUIRED rather than .optional(): the Anthropic API rejects
// schemas with more than 24 optional parameters total across the tree
// ("Schemas contains too many optional parameters ... limit: 24" — hit this
// live while testing Phase 0 against the real API, see docs/implementation_plan_v2.md
// §20 Phase 0 record). The system prompt already always asks for every one of
// these fields, so making them required only makes the model's existing
// behavior explicit; shared/enrichResult.js still defensively falls back for
// anything short/odd that gets through (unchanged).
import { z } from 'zod'

const DominanceDetailSchema = z.object({
  personA: z.number(),
  personB: z.number(),
  personALabel: z.string(),
  personBLabel: z.string(),
})

const TextMirroringSchema = z.object({
  score: z.number(),
  label: z.string(),
  interpretation: z.string(),
  evidence: z.array(z.string()),
})

const ReplySpeedAsymmetrySchema = z.object({
  asymmetryScore: z.number(),
  label: z.string(),
  fasterSide: z.string(),
  slowerSide: z.string(),
  gapRatio: z.string(),
  avgReplyLabel: z.string(),
  interpretation: z.string(),
})

const AffectionTimelineEntrySchema = z.object({
  period: z.string(),
  score: z.number(),
  label: z.string(),
  trend: z.string(),
  insight: z.string(),
})

const ConversationMetaSchema = z.object({
  platform: z.string(),
  spanDays: z.number(),
  spanLabel: z.string(),
  dateRange: z.object({ start: z.string(), end: z.string() }),
})

const CriticalMomentSchema = z.object({
  speaker: z.string(),
  quote: z.string(),
  timestamp: z.string(),
  momentType: z.string(),
  psychologicalInsight: z.string(),
  impactScore: z.number(),
})

export const AnalysisResponseSchema = z.object({
  totalScore: z.number(),
  relationType: z.string(),
  relationTag: z.string(),
  dominance: z.string(),
  dominanceDetail: DominanceDetailSchema,
  detectedTopics: z.array(z.string()),
  psychologySummary: z.string(),
  aiSummary: z.string(),
  solution: z.string(),
  metrics: z.record(z.string(), z.any()),
  deepMetrics: z.object({
    textMirroring: TextMirroringSchema,
    replySpeedAsymmetry: ReplySpeedAsymmetrySchema,
  }),
  affectionTimeline: z.array(AffectionTimelineEntrySchema),
  conversationMeta: ConversationMetaSchema,
  criticalMoments: z.array(CriticalMomentSchema),
})

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>
