// Phase 2 — Analysis Intent (docs/prd_v2.md §4, docs/implementation_plan_v2.md
// §20 Phase 2).
//
// Deliberate second JS/TS boundary crossing: §5.1 originally described
// exactly one crossing point (parseChatShim.ts, for the legacy parser).
// Intent is pure, logic-free data that must stay identical across the
// frontend, the /api/preview route, and this engine — re-typing it by hand
// here instead of importing shared/intentOptions.js would create two sources
// of truth that can silently drift (e.g. a new Intent value added to the UI
// but never taught to the engine's priority table). Importing the plain data
// array below pulls in no legacy business logic, only string literals, so it
// doesn't reopen the concern §5.1 was actually guarding against.
import { INTENT_VALUES } from '../../../shared/intentOptions.js'

export type AnalysisIntent = (typeof INTENT_VALUES)[number]

export const ANALYSIS_INTENTS = INTENT_VALUES as AnalysisIntent[]

export function isAnalysisIntent(value: unknown): value is AnalysisIntent {
  return typeof value === 'string' && (ANALYSIS_INTENTS as string[]).includes(value)
}
