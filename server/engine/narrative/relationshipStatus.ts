// Phase 2.4 item 4 — Relationship Status/Stage copy. Deliberately does not
// assume a romantic relationship (spec: "연애 관계를 전제로 하지 마라") — every
// label is phrased so it reads fine whether the two people turn out to be
// dating, friends, or still strangers-ish. Pure function of already-computed
// position/romance/interestGap — no new score, no LLM call.
import type { RelationshipPosition, RomanceResult } from '../score/types.js'
import { bucketize } from './scoreBuckets.js'

const ROMANCE_PRESENT_THRESHOLD = 30
/** Same gap threshold paywallTeaser.ts uses for "이 정도면 진짜 차이" — reused
 * here so "한쪽의 관심 표현이 더 뚜렷해요" doesn't fire on noise-level gaps. */
const INTEREST_GAP_THRESHOLD = 20

export function buildRelationshipStatus(
  position: RelationshipPosition,
  romance: RomanceResult,
  interestGap: number | null,
): string {
  if (position.label === 'insufficient_data') return '아직 관계 단서가 적어요'

  if (position.label === 'warming_up_toward_romance') return '서로 가까워지는 흐름이 보여요'

  if (position.label === 'close_friendship') {
    return romance.score >= ROMANCE_PRESENT_THRESHOLD ? '친밀감은 있지만 연애 신호는 약해요' : '편하게 대화하는 사이예요'
  }

  if (position.label === 'unstable_attraction') {
    return interestGap !== null && interestGap >= INTEREST_GAP_THRESHOLD
      ? '한쪽의 관심 표현이 더 뚜렷해요'
      : '관심을 탐색하는 단계로 보여요'
  }

  // still_forming
  return bucketize(romance.score) === 'low' ? '아직 관계의 방향이 뚜렷하지 않아요' : '관심을 탐색하는 단계로 보여요'
}
