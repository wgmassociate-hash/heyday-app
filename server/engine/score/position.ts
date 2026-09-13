// Phase 1 / 1.2 — Relationship Position (docs/prd_v2.md §11).
// Threshold is a placeholder ("실제 Threshold는 운영 데이터 확보 후 조정한다",
// PRD §11) — labels only, no probability-style claims per docs/prd_v2.md §35.
import type { IndividualScore, RelationshipPosition, RelationshipPositionLabel, RomanceResult } from './types.js'

const POSITION_THRESHOLD = 55

export function computeRelationshipPosition(
  temperature: IndividualScore,
  romance: RomanceResult,
): RelationshipPosition {
  if (temperature.score === null) {
    return { label: 'insufficient_data' }
  }

  const highTemperature = temperature.score >= POSITION_THRESHOLD
  const highRomance = romance.score >= POSITION_THRESHOLD

  let label: RelationshipPositionLabel
  if (highTemperature && highRomance) label = 'warming_up_toward_romance'
  else if (highTemperature && !highRomance) label = 'close_friendship'
  else if (!highTemperature && highRomance) label = 'unstable_attraction'
  else label = 'still_forming'

  return { label }
}
