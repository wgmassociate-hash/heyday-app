// Phase 2.4 — Rich Free Preview item 5/6/7: Core Metrics get a one-line
// interpretation (not just a bare number), and Conversation Initiation /
// Reciprocity get corrected user-facing names that match what the underlying
// metric actually measures (docs Phase 2.4 spec §5/§6/§7). Every caption is a
// deterministic function of the already-computed score — no new numbers, no
// LLM call, same code-template pattern as previewNarrative.ts/paywallTeaser.ts.
import { bucketize } from './scoreBuckets.js'

/** Item 5 — Interest caption. Never says "당신"/"상대방" itself (callers
 * already show that as the ScoreBar's own label) — just interprets the
 * number for whichever speaker it belongs to. */
export function interestCaption(score: number | null): string | null {
  if (score === null) return null
  switch (bucketize(score)) {
    case 'low':
      return '지금까지는 상대 이야기에 적극적으로 반응하는 모습이 많이 보이지는 않았어요.'
    case 'medium':
      return '현재 대화에서는 후속 질문이나 관계를 이어가는 행동이 일부 보여요.'
    case 'high':
      return '상대의 이야기를 기억하거나 먼저 챙기는 등, 관심을 표현하는 행동이 자주 보여요.'
  }
}

export function intimacyCaption(score: number | null): string | null {
  if (score === null) return null
  switch (bucketize(score)) {
    case 'low':
      return '아직은 서로 깊은 이야기보다는 가벼운 대화가 중심이에요.'
    case 'medium':
      return '장난이나 일상 공유처럼 편한 친밀감 표현이 종종 보여요.'
    case 'high':
      return '자기 이야기나 감정을 편하게 나누는 등, 친밀한 표현이 꽤 자주 보여요.'
  }
}

/** Item 7 — "서로 반응하는 정도": renamed from the old "서로 주고받는 정도"
 * because that phrasing reads like plain turn-taking (누가 몇 번 답장했나),
 * when the metric actually measures whether questions/감정/제안에 *의미 있게*
 * 반응했는지 (server/engine/score/reciprocity.ts's pairType coverage). A 0
 * here must not read as "대화를 전혀 안 주고받는다" — the low-bucket copy
 * below explicitly avoids that implication. */
export const RECIPROCITY_METRIC_LABEL = '서로 반응하는 정도'
export const RECIPROCITY_METRIC_SUBLABEL = '질문·감정·제안에 서로 의미 있게 반응하는 정도'

export function reciprocityCaption(score: number | null): string | null {
  if (score === null) return null
  switch (bucketize(score)) {
    case 'low':
      return '질문이나 감정 표현에 서로 반응하는 장면이 아직 많지는 않아요.'
    case 'medium':
      return '질문이나 감정 표현에 어느 정도 반응해주는 편이에요.'
    case 'high':
      return '질문이나 감정 표현에 서로 잘 반응해주는 편이에요.'
  }
}

/** Item 6 — renamed from "누가 더 관계를 움직였나" (implies a broader
 * relationship-initiative claim the underlying metric doesn't support — it's
 * purely code-derived turnInitiationCounts, see score/types.ts's
 * ConversationInitiationRatioResult comment) to what it actually measures. */
export const INITIATION_METRIC_LABEL = '누가 먼저 대화를 열었나'

const INITIATION_GAP_THRESHOLD = 0.15

export function initiationSentence(ratioBySpeaker: Record<string, number>): string {
  const self = ratioBySpeaker['나'] ?? 0.5
  const other = ratioBySpeaker['상대방'] ?? 0.5
  const gap = self - other
  if (Math.abs(gap) < INITIATION_GAP_THRESHOLD) {
    return '최근 대화에서는 두 사람이 비슷하게 대화를 시작하거나 다시 이어간 편이에요.'
  }
  return gap > 0
    ? '최근 대화에서는 당신이 먼저 대화를 시작하거나 다시 이어간 경우가 조금 더 많았어요.'
    : '최근 대화에서는 상대방이 먼저 대화를 시작하거나 다시 이어간 경우가 조금 더 많았어요.'
}

// Item 19 — a single low-confidence caveat ("아직 참고용이에요") already
// renders once per metric via PreviewResultStep.jsx's existing
// CONFIDENCE_CAPTION (unchanged by this Phase) — deliberately not duplicated
// here as a second, separate boilerplate line.
