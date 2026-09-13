// Phase 2 — Data Confidence / Analysis Mode classification (docs/prd_v2.md §15).
// Purely descriptive metadata about how much the conversation actually
// supports: it's stored alongside the Preview result (for Phase 3+'s
// analysisMode-gated behavior, e.g. Trend/Turning Point only run for "deep")
// and is never itself a Score input.
import type { AnalysisMode } from './types.js'

export const SNAPSHOT_MAX_MESSAGES = 80
export const STANDARD_MAX_MESSAGES = 300
export const DEEP_MIN_SPAN_DAYS = 14

/** "여러 Session"/"충분한 세션 수" (PRD §15) aren't given exact numbers —
 * tunable placeholders, same caveat as every other threshold constant in this
 * engine (score/weights.ts, score/confidence.ts, etc.): not backed by real
 * usage data yet. */
export const STANDARD_MIN_SESSION_COUNT = 2
export const DEEP_MIN_SESSION_COUNT = 3

export interface AnalysisModeInputs {
  messageCount: number
  spanDays: number
  sessionCount: number
}

export function determineAnalysisMode(inputs: AnalysisModeInputs): AnalysisMode {
  const { messageCount, spanDays, sessionCount } = inputs

  if (
    messageCount >= STANDARD_MAX_MESSAGES &&
    spanDays >= DEEP_MIN_SPAN_DAYS &&
    sessionCount >= DEEP_MIN_SESSION_COUNT
  ) {
    return 'deep'
  }

  if (messageCount >= SNAPSHOT_MAX_MESSAGES && sessionCount >= STANDARD_MIN_SESSION_COUNT) {
    return 'standard'
  }

  return 'snapshot'
}
