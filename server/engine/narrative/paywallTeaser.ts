// Phase 2.1 — Product UX Calibration item 5: Paywall Teaser redesign.
//
// The old Preview locked-section was a static feature list ("결정적 카톡
// 전체", "관계 변화 추이" ...) — it describes what the product does, not why
// *this* user's own Preview result makes them want to see more. This module
// builds 2-3 short "남은 질문" teasers from the Preview's own already-computed
// numbers, code-templated (no LLM call, same pattern as previewNarrative.ts).
//
// Hard constraint: Paid Deep has NOT run yet at Preview time (§16.1 — Stage 2
// only runs after payment). Every teaser is phrased as an open question about
// what the *rest* of the conversation might show, never as a claim about a
// Paid result that doesn't exist yet ("전체 분석에서 이렇게 나왔어요" is
// forbidden; "이게 전체 대화에서도 그럴까요?" is the shape every template uses).
import type { PreviewScoreResult } from '../pipeline/types.js'

export interface PaywallTeaser {
  question: string
  lockedLabel: string
}

const INTEREST_GAP_THRESHOLD = 20
const LOW_RECIPROCITY_THRESHOLD = 50
const ROMANCE_PRESENT_THRESHOLD = 40
const LOW_TEMPERATURE_THRESHOLD = 50

/** PRD §8.1 example: "얘 나한테 관심 있어?" — Interest is tracked per speaker,
 * so a large gap between them is the single most tangible "something's
 * asymmetric here" fact the Preview already knows, without asserting who's
 * "right" about it. */
function interestGapTeaser(preview: PreviewScoreResult): PaywallTeaser | null {
  const scores = Object.values(preview.core4Preview.interest.bySpeaker)
    .map((s) => s.score)
    .filter((s): s is number => s !== null)
  if (scores.length < 2) return null
  const gap = Math.max(...scores) - Math.min(...scores)
  if (gap < INTEREST_GAP_THRESHOLD) return null
  return {
    question: '둘의 관심 표현 차이는 최근 대화에서만 나타난 걸까요?',
    lockedLabel: '🔒 전체 대화에서 패턴 확인',
  }
}

function reciprocityTeaser(preview: PreviewScoreResult): PaywallTeaser | null {
  const score = preview.core4Preview.reciprocity.score
  if (score === null || score >= LOW_RECIPROCITY_THRESHOLD) return null
  return {
    question: '대화는 이어지지만, 한쪽이 더 많이 맞춰주고 있는 걸까요?',
    lockedLabel: '🔒 전체 상호작용 분석',
  }
}

function romanceTemperatureMismatchTeaser(preview: PreviewScoreResult): PaywallTeaser | null {
  const romance = preview.recentRomanceSignal.score
  const temperature = preview.recentConversationTemperature.score
  if (romance < ROMANCE_PRESENT_THRESHOLD) return null
  if (temperature === null || temperature >= LOW_TEMPERATURE_THRESHOLD) return null
  return {
    question: '호감 신호는 있는데, 왜 관계는 아직 가까워지지 않았을까요?',
    lockedLabel: '🔒 관심 신호와 거리두기 신호 전체 비교',
  }
}

/** Always-available filler — used only to pad the list up to 2 items when
 * fewer than 2 of the metric-driven teasers above triggered. Still phrased as
 * an open question about the unseen rest of the conversation, never as a
 * claim about it (windowLabel keeps the "지금 본 건 일부일 뿐" framing
 * explicit — same structural discipline as previewNarrative.ts §15.4). */
function fallbackTeasers(preview: PreviewScoreResult): PaywallTeaser[] {
  return [
    {
      question: `${preview.windowLabel}만으로 이 관계를 다 설명할 수 있을까요?`,
      lockedLabel: '🔒 전체 대화 기준 종합 분석',
    },
    {
      question: '지금 보인 신호는 시간이 지나며 어떻게 바뀌어 왔을까요?',
      lockedLabel: '🔒 관계 변화와 결정적 순간',
    },
  ]
}

const MIN_TEASERS = 2
const MAX_TEASERS = 3

export function buildPaywallTeasers(preview: PreviewScoreResult): PaywallTeaser[] {
  const candidates = [interestGapTeaser(preview), reciprocityTeaser(preview), romanceTemperatureMismatchTeaser(preview)].filter(
    (t): t is PaywallTeaser => t !== null,
  )

  for (const fallback of fallbackTeasers(preview)) {
    if (candidates.length >= MIN_TEASERS) break
    candidates.push(fallback)
  }

  return candidates.slice(0, MAX_TEASERS)
}
