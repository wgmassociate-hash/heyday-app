// Phase 2.4 item 3 — "질문에 대한 답을 가장 먼저 준다". Deterministic,
// intent-keyed answer built from already-computed score/romance/temperature —
// never a new LLM call, never stated more strongly than the numbers support
// (spec: "결과보다 강하게 단정하지 않는다").
//
// Also reused, unchanged, as the "다른 관점으로 다시 보기" lens (item 15/21):
// calling this with 'friendship_change' regardless of the user's actual
// selected intent produces a friendship-framed answer from the exact same
// scores — no recomputation, no second API/LLM call (previewReport.ts's
// buildAlternateReport()).
import type { AnalysisIntent } from '../intent/types.js'
import type { PreviewScoreResult } from '../pipeline/types.js'
import type { Core4Result } from '../score/types.js'
import { bucketize } from './scoreBuckets.js'

const INTEREST_LEADER_GAP_THRESHOLD = 15

/** '나' | '상대방' if one clearly leads on Interest, else null (too close to
 * call — noise, not a real asymmetry). */
export function interestLeader(core4: Core4Result): '나' | '상대방' | null {
  const self = core4.interest.bySpeaker['나']?.score ?? null
  const other = core4.interest.bySpeaker['상대방']?.score ?? null
  if (self === null || other === null) return null
  if (Math.abs(self - other) < INTEREST_LEADER_GAP_THRESHOLD) return null
  return self > other ? '나' : '상대방'
}

function romanceInterestAnswer(score: PreviewScoreResult): string {
  const romance = score.recentRomanceSignal.score
  const leader = interestLeader(score.core4Preview)
  switch (bucketize(romance)) {
    case 'low':
      return (
        '이 대화만 보면 연애적 관심 신호는 강하지 않아요.' +
        (leader === '상대방'
          ? ' 다만 상대가 먼저 대화를 열거나 관계를 이어가려는 행동은 일부 확인돼요.'
          : leader === '나'
            ? ' 다만 당신이 조금 더 적극적으로 대화를 이어가는 모습이에요.'
            : ' 다만 두 사람 모두 편하게 대화를 이어가는 분위기예요.')
      )
    case 'medium':
      return (
        '관심 신호가 조금씩 보여요.' +
        (leader === '나'
          ? ' 지금은 당신 쪽 표현이 조금 더 적극적으로 나타나요.'
          : leader === '상대방'
            ? ' 지금은 상대방 쪽 표현이 조금 더 적극적으로 나타나요.'
            : ' 아직 어느 한쪽이 더 적극적이라고 보기는 어려워요.')
      )
    case 'high':
      return (
        '관심 신호는 분명히 보여요.' +
        (leader === '나'
          ? ' 다만 현재 대화에서는 당신 쪽 표현이 조금 더 적극적으로 나타나요.'
          : leader === '상대방'
            ? ' 상대방 쪽 표현도 그만큼 적극적으로 나타나요.'
            : ' 서로 비슷한 정도로 표현하고 있어요.')
      )
  }
}

function imbalanceAnswer(score: PreviewScoreResult): string {
  const leader = interestLeader(score.core4Preview)
  if (leader === '나') return '지금까지는 당신 쪽이 조금 더 적극적으로 관심을 표현하는 편이에요.'
  if (leader === '상대방') return '지금까지는 상대방 쪽이 조금 더 적극적으로 관심을 표현하는 편이에요.'
  return '지금까지는 두 사람의 관심 표현 정도가 비슷해 보여요.'
}

/** relationship_change/friendship_change both ask about a *change over
 * time*, which a single-window Preview structurally cannot answer (no
 * earlier window to compare against — that's Paid Deep's Turning Point, spec
 * §16). Being explicit about that limit here is what makes the eventual
 * paywall teaser feel earned rather than evasive. */
function noTimeComparisonAnswer(score: PreviewScoreResult): string {
  const temperature = score.recentConversationTemperature.score
  const warmthClause =
    temperature === null
      ? '아직 판단할 만큼 대화가 쌓이지 않았어요'
      : bucketize(temperature) === 'high'
        ? '대화 자체는 활발하고 편한 편이에요'
        : bucketize(temperature) === 'medium'
          ? '대화는 자연스럽게 이어지는 편이에요'
          : '대화 자체는 비교적 잔잔한 편이에요'
  return `${score.windowLabel} 하나만 보면 이전과 비교한 변화까지는 아직 알기 어려워요. 다만 지금 이 구간만 보면 ${warmthClause}.`
}

function conversationMeaningAnswer(score: PreviewScoreResult): string {
  const romanceBucket = bucketize(score.recentRomanceSignal.score)
  const temperature = score.recentConversationTemperature.score
  const warmBucket = temperature === null ? null : bucketize(temperature)
  if (romanceBucket === 'high') return '이 대화는 설렘 신호가 섞인, 꽤 적극적인 대화에 가까워 보여요.'
  if (warmBucket === 'high') return '이 대화는 연애적 신호보다는 편한 친밀함을 나누는 대화에 가까워 보여요.'
  if (romanceBucket === 'medium') return '이 대화는 약간의 호감 신호가 섞인, 서로를 탐색하는 대화로 보여요.'
  return '이 대화는 아직 서로를 탐색하는 단계의 대화로 보여요.'
}

function relationshipDefinitionAnswer(score: PreviewScoreResult): string {
  const romanceBucket = bucketize(score.recentRomanceSignal.score)
  const label = score.recentRelationshipPosition.label
  if (label === 'insufficient_data') return '지금은 관계를 정의할 만큼 단서가 쌓이지 않았어요.'
  if (label === 'warming_up_toward_romance') return '지금은 서로 가까워지고 있는 사이로 보여요.'
  if (label === 'close_friendship') {
    return romanceBucket === 'low'
      ? '지금은 연애보다는 편한 친구 사이에 가까워 보여요.'
      : '지금은 친밀하면서도 약간의 호감 신호가 섞인 사이로 보여요.'
  }
  if (label === 'unstable_attraction') return '지금은 끌림은 있지만 아직 방향이 뚜렷하지 않은 사이로 보여요.'
  return '지금은 아직 관계의 방향이 명확하게 드러나지 않은 단계예요.'
}

export function buildDirectAnswer(intent: AnalysisIntent, score: PreviewScoreResult): string {
  switch (intent) {
    case 'romantic_interest':
      return romanceInterestAnswer(score)
    case 'imbalance':
      return imbalanceAnswer(score)
    case 'relationship_change':
      return noTimeComparisonAnswer(score)
    case 'friendship_change':
      return noTimeComparisonAnswer(score)
    case 'conversation_meaning':
      return conversationMeaningAnswer(score)
    case 'relationship_definition':
      return relationshipDefinitionAnswer(score)
    default:
      return romanceInterestAnswer(score)
  }
}
