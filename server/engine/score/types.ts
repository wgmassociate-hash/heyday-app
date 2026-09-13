// Phase 1 / 1.1 / 1.2 — Score Engine types (docs/implementation_plan_v2.md §9, §12.2).
import type { CodeFeatures } from '../features/types.js'
import type { ValidatedReciprocityPair } from '../signals/reciprocityTypes.js'
import type { ValidatedSignal } from '../signals/types.js'
import type { Confidence } from './confidence.js'

export type { Confidence } from './confidence.js'

/**
 * The generic shape of every scored metric in this engine, after Phase 1.2's
 * Missing Evidence & Calibration pass (audit finding #1). Two distinct
 * "nothing to report" states are no longer conflated:
 *
 *  - `score: 0` — the opportunity to observe this behavior existed, and it
 *    simply wasn't observed. A real, meaningful zero.
 *  - `score: null` — there wasn't enough opportunity to judge this metric at
 *    all (confidence is always 'insufficient' in this case). Not a claim
 *    about the relationship, just "we can't tell from this data."
 *
 * `confidence` is computed independently of `score` (confidence.ts takes no
 * evidence-count input) and is never multiplied into it.
 */
export interface IndividualScore {
  score: number | null
  confidence: Confidence
}

/** A metric computed per-speaker (Interest, Intimacy). */
export interface PairMetric {
  bySpeaker: Record<string, IndividualScore>
}

/** Phase 1.1 rename (audit finding #4): the old name "Initiative" implied a
 * broader Relationship Initiative concept than what this actually measures —
 * a ratio of who starts/revives the conversation more, from Code alone. Kept
 * separate on purpose so a richer Relationship Initiative can be added later
 * without redefining this field's meaning out from under it. */
export interface ConversationInitiationRatioResult {
  /** Ratio 0..1 per speaker, summing to 1 (or 0.5/0.5 with no evidence). */
  ratioBySpeaker: Record<string, number>
}

export interface ReciprocityResult extends IndividualScore {
  bySpeaker: Record<string, IndividualScore>
}

export interface Core4Result {
  interest: PairMetric
  intimacy: PairMetric
  conversationInitiationRatio: ConversationInitiationRatioResult
  reciprocity: ReciprocityResult
}

export interface RomanceResult {
  score: number
  positiveCount: number
  ambiguousCount: number
  distancingCount: number
}

export type RelationshipPositionLabel =
  | 'warming_up_toward_romance'
  | 'close_friendship'
  | 'unstable_attraction'
  | 'still_forming'
  /** Phase 1.2: Temperature itself was null (insufficient data) — Position
   * can't be judged either. Distinct from 'still_forming', which is a real
   * judgment ("low temperature, low romance"), not a data gap. */
  | 'insufficient_data'

export interface RelationshipPosition {
  label: RelationshipPositionLabel
}

export interface CoreScoreResult {
  core4: Core4Result
  /** Phase 1.2: Temperature is now an IndividualScore, not a plain number —
   * it can be null when too few of its 4 weighted components have real data
   * (score/temperature.ts's MIN_TEMPERATURE_WEIGHT_COVERAGE). */
  temperature: IndividualScore
  romance: RomanceResult
  position: RelationshipPosition
  scoreEngineVersion: string
}

export interface ScoreEngineInput {
  codeFeatures: CodeFeatures
  validatedSignals: ValidatedSignal[]
  reciprocityPairs: ValidatedReciprocityPair[]
}
