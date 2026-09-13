// Phase 0 — structured-output schema for server/ocrScreenshots.js, replacing
// the same regex-based extractJson() pattern as server/analyzeSchema.ts.
import { z } from 'zod'

export const OcrResponseSchema = z.object({
  segments: z.array(
    z.object({
      index: z.number().optional(),
      text: z.string().optional(),
    }),
  ),
})

export type OcrResponse = z.infer<typeof OcrResponseSchema>
