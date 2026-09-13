// Phase 1 — Score Engine types (docs/implementation_plan_v2.md §9, §12.2).
import type { CodeFeatures } from '../features/types.js'
import type { ValidatedSignal } from '../signals/types.js'

export type Confidence = 'low' | 'medium' | 'high'

export interface IndividualScore {
  score: number
  confidence: Confidence
}

/** A metric computed per-speaker (Interest, Intimacy). */
export interface PairMetric {
  bySpeaker: Record<string, IndividualScore>
}

export interface InitiativeResult {
  /** Ratio 0..1 per speaker, summing to 1 (or 0.5/0.5 with no evidence). */
  ratioBySpeaker: Record<string, number>
}

export interface ReciprocityResult extends IndividualScore {
  bySpeaker: Record<string, IndividualScore>
}

export interface Core4Result {
  interest: PairMetric
  intimacy: PairMetric
  initiative: InitiativeResult
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

export interface RelationshipPosition {
  label: RelationshipPositionLabel
}

export interface CoreScoreResult {
  core4: Core4Result
  temperature: number
  romance: RomanceResult
  position: RelationshipPosition
  scoreEngineVersion: string
}

export interface ScoreEngineInput {
  codeFeatures: CodeFeatures
  validatedSignals: ValidatedSignal[]
}
