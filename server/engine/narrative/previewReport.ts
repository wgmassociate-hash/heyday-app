// Phase 2.4 — Rich Free Preview / Reward Layer composer. Combines every
// module in this directory (directAnswer, relationshipStatus, metricCopy,
// patternDetector, keySceneSelector) plus two new sections written here
// (psychologicalInterpretation, aiSummary) into one PreviewReport. Everything
// is a deterministic function of fields the Score Engine already computed —
// no new LLM call (spec §11: "이번 Phase에서는 추가 LLM 호출을 우선 만들지
// 마라"), no Score Engine change (spec §1).
import { INTENT_OPTIONS } from '../../../shared/intentOptions.js'
import type { AnalysisIntent } from '../intent/types.js'
import type { PreviewReport, PreviewScoreResult } from '../pipeline/types.js'
import type { ValidatedReciprocityPair } from '../signals/reciprocityTypes.js'
import type { ValidatedSignal } from '../signals/types.js'
import { interestLeader, buildDirectAnswer } from './directAnswer.js'
import type { MessageLookup } from './keySceneSelector.js'
import { selectKeyScenes } from './keySceneSelector.js'
import { initiationSentence, intimacyCaption, interestCaption, reciprocityCaption } from './metricCopy.js'
import { buildRelationshipPatterns } from './patternDetector.js'
import { buildRelationshipStatus } from './relationshipStatus.js'
import { bucketize, gapBetween } from './scoreBuckets.js'

/** Intents whose top Evidence priority is 'romance' (topSignal.ts's
 * INTENT_CATEGORY_PRIORITY) — the only intents where a "선택한 질문과 실제
 * 분위기가 다르다" mismatch notice makes sense to surface at all (spec §15's
 * own example is exactly this: romantic_interest against a friend sample). */
const ROMANTIC_FRAME_INTENTS: AnalysisIntent[] = ['romantic_interest', 'conversation_meaning', 'relationship_definition']
const MISMATCH_ROMANCE_CEILING = 25

const INTENT_LABEL_BY_VALUE = new Map(INTENT_OPTIONS.map((opt) => [opt.value, opt.label]))

function buildPsychologicalInterpretation(score: PreviewScoreResult, validatedSignals: ValidatedSignal[]): string {
  const reciprocity = score.core4Preview.reciprocity
  const leader = interestLeader(score.core4Preview)

  const flowSentence =
    reciprocity.score !== null && reciprocity.confidence !== 'insufficient' && reciprocity.score >= 50
      ? '현재 대화에서는 두 사람 모두 대화를 끊기보다 이어가는 흐름이 보여요.'
      : '현재 대화에서는 아직 대화를 적극적으로 이어가는 흐름이 강하다고 보기는 어려워요.'

  const emotionalCount = validatedSignals.filter(
    (s) => s.direction === 'positive' && ['self_disclosure', 'vulnerable_emotion_share'].includes(s.signalType),
  ).length
  const playfulCount = validatedSignals.filter(
    (s) => s.direction === 'positive' && ['playful_teasing_or_nickname', 'shared_context_reference', 'daily_life_share'].includes(s.signalType),
  ).length

  let styleSentence: string
  if (emotionalCount === 0 && playfulCount === 0) {
    styleSentence = '다만 아직 친밀감을 표현하는 방식이 뚜렷하게 드러나지는 않았어요.'
  } else if (emotionalCount >= playfulCount) {
    styleSentence = '다만 친밀감을 표현하는 방식은 장난보다 감정이나 자기 이야기를 나누는 쪽에 가까워요.'
  } else {
    styleSentence = '다만 친밀감을 표현하는 방식은 직접적인 감정 표현보다 공동 관심사나 편한 반응에 가까워요.'
  }

  const leaderSentence =
    leader === '나'
      ? '그 안에서 당신이 상대의 말에 반응하거나 대화를 다시 이어가는 행동이 조금 더 보여요.'
      : leader === '상대방'
        ? '그 안에서 상대가 먼저 반응하거나 대화를 이어가려는 행동이 조금 더 보여요.'
        : '그 안에서 두 사람이 비슷한 정도로 반응을 주고받고 있어요.'

  return `${flowSentence} ${styleSentence}\n\n${leaderSentence}`
}

function buildAiSummary(score: PreviewScoreResult, relationshipStatus: string): string {
  const { windowLabel, windowMessageCount } = score
  const temperature = score.recentConversationTemperature.score
  const romanceBucket = bucketize(score.recentRomanceSignal.score)

  const moodSentence =
    temperature === null
      ? `${windowLabel} ${windowMessageCount}개 메시지만으로는 대화 분위기를 판단하기엔 아직 근거가 부족해요.`
      : bucketize(temperature) === 'high'
        ? `${windowLabel} ${windowMessageCount}개 메시지를 보면, 두 사람의 대화는 끊기기보다는 자연스럽게 이어지는 편이에요.`
        : bucketize(temperature) === 'medium'
          ? `${windowLabel} ${windowMessageCount}개 메시지를 보면, 대화는 무리 없이 이어지는 편이에요.`
          : `${windowLabel} ${windowMessageCount}개 메시지를 보면, 대화 자체는 비교적 잔잔한 편이에요.`

  const signalSentence =
    romanceBucket === 'high'
      ? '그 안에서 호감을 짐작하게 하는 표현도 여러 번 확인됐어요.'
      : romanceBucket === 'medium'
        ? '그 안에서 호감을 짐작하게 하는 표현이 간간이 확인됐어요.'
        : '다만 이 범위에서 적극적으로 관계를 진전시키려는 행동은 많지 않았어요.'

  const conclusionSentence = `따라서 현재 관계는 '${relationshipStatus}'에 가까운 단계로 보여요.`

  return `${moodSentence} ${signalSentence}\n\n${conclusionSentence}`
}

function buildComparisonLine(score: PreviewScoreResult): string {
  const core4 = score.core4Preview
  const interestGap = gapBetween(core4.interest.bySpeaker['나']?.score ?? null, core4.interest.bySpeaker['상대방']?.score ?? null)
  const intimacyGap = gapBetween(core4.intimacy.bySpeaker['나']?.score ?? null, core4.intimacy.bySpeaker['상대방']?.score ?? null)
  const GAP_THRESHOLD = 15

  const interestLeaderSide =
    interestGap !== null && interestGap >= GAP_THRESHOLD
      ? (core4.interest.bySpeaker['나']!.score! > core4.interest.bySpeaker['상대방']!.score! ? '나' : '상대방')
      : null
  const intimacyLeaderSide =
    intimacyGap !== null && intimacyGap >= GAP_THRESHOLD
      ? (core4.intimacy.bySpeaker['나']!.score! > core4.intimacy.bySpeaker['상대방']!.score! ? '나' : '상대방')
      : null

  if (!interestLeaderSide && !intimacyLeaderSide) {
    return '현재 대화 범위에서 보이는 방향만 참고해주세요.'
  }

  if (interestLeaderSide && intimacyLeaderSide && interestLeaderSide !== intimacyLeaderSide) {
    const intimacySubject = intimacyLeaderSide === '상대방' ? '상대방이' : '당신이'
    const interestSubject = interestLeaderSide === '나' ? '당신 쪽이' : '상대방 쪽이'
    return `친밀한 반응은 ${intimacySubject} 더 많이 보이지만, 관심을 표현하는 행동은 ${interestSubject} 조금 더 많이 보여요.`
  }

  if (intimacyLeaderSide) {
    return intimacyLeaderSide === '나'
      ? '두 사람의 관심 표현은 비슷하지만, 친밀한 반응은 당신 쪽에서 더 많이 나타났어요.'
      : '두 사람의 관심 표현은 비슷하지만, 친밀한 반응은 상대방 쪽에서 더 많이 나타났어요.'
  }

  return interestLeaderSide === '나'
    ? '두 사람의 친밀감은 비슷하지만, 관심 표현은 당신 쪽에서 더 많이 나타났어요.'
    : '두 사람의 친밀감은 비슷하지만, 관심 표현은 상대방 쪽에서 더 많이 나타났어요.'
}

function buildTips(score: PreviewScoreResult): string[] {
  const tips: string[] = []
  const ratio = score.core4Preview.conversationInitiationRatio.ratioBySpeaker
  const otherInitiates = (ratio['상대방'] ?? 0.5) - (ratio['나'] ?? 0.5) >= 0.15
  const romanceBucket = bucketize(score.recentRomanceSignal.score)
  const reciprocity = score.core4Preview.reciprocity

  if (otherInitiates) {
    tips.push('상대가 먼저 대화를 열었을 때는 그 주제에 답한 뒤, 관련된 짧은 질문을 하나 덧붙여보세요. 상대가 자기 이야기를 더 보태거나 다시 질문한다면 지금처럼 대화를 이어가도 좋아요.')
  } else {
    tips.push('먼저 연락할 때는 최근에 함께 이야기했던 일이나 관심사 하나를 골라 가볍게 꺼내보세요. “지난번에 말한 그거 어떻게 됐어?”처럼 답하기 쉬운 질문이면 부담 없이 대화를 시작하기 좋아요.')
  }

  if (romanceBucket !== 'high') {
    tips.push('지금은 관계를 바로 확인하기보다 공통 관심사를 이어가며 반응을 살펴보는 편이 자연스러워요. 상대가 먼저 화제를 확장하거나 다음 대화를 이어오면 조금 더 표현해보고, 짧은 답이 반복되면 잠시 템포를 늦춰보세요.')
  } else if (reciprocity.score === null || reciprocity.confidence === 'insufficient') {
    tips.push('호감으로 읽힐 표현은 있지만 서로 비슷하게 대화를 이어가는지는 아직 근거가 부족해요. 바로 결론을 내리기보다 가벼운 질문을 건넨 뒤, 상대도 질문하거나 새 화제를 꺼내는지 한두 번 더 살펴보세요.')
  } else if (reciprocity.score < 50) {
    tips.push('호감으로 읽힐 표현은 있지만 대화가 한쪽으로 흐르는 순간도 보여요. 상대의 말에서 한 가지를 짚어 반응하고 질문은 하나만 건네본 뒤, 상대도 질문이나 새 화제로 돌아오는지 확인해보세요.')
  } else {
    tips.push('현재의 편안한 흐름을 유지하면서 작은 다음 약속을 제안해볼 수 있어요. “다음에 같이 가볼래?”처럼 거절해도 부담 없는 표현을 쓰고, 상대가 날짜나 장소를 구체화하는지 살펴보세요.')
  }

  return tips
}

function buildMetricNote(
  score: number | null,
  confidence: PreviewReport['reciprocityNote']['confidence'],
  caption: string | null,
) {
  return { score, confidence, caption: score === null ? null : caption }
}

interface BuildPreviewReportInput {
  intent: AnalysisIntent
  score: PreviewScoreResult
  validatedSignals: ValidatedSignal[]
  reciprocityPairs: ValidatedReciprocityPair[]
  messages: MessageLookup
}

/** The one function that turns a fixed Intent lens into a full PreviewReport
 * — used both for the user's actual selected intent AND (unchanged, just a
 * different `intent` argument) for the mismatch CTA's alternate lens below,
 * so there is exactly one code path to keep correct. */
function composeReport(input: BuildPreviewReportInput): PreviewReport {
  const { intent, score, validatedSignals, reciprocityPairs, messages } = input
  const core4 = score.core4Preview

  const interestNotes: PreviewReport['interestNotes'] = {}
  for (const [speakerId, note] of Object.entries(core4.interest.bySpeaker)) {
    interestNotes[speakerId] = buildMetricNote(note.score, note.confidence, interestCaption(note.score))
  }
  const intimacyNotes: PreviewReport['intimacyNotes'] = {}
  for (const [speakerId, note] of Object.entries(core4.intimacy.bySpeaker)) {
    intimacyNotes[speakerId] = buildMetricNote(note.score, note.confidence, intimacyCaption(note.score))
  }
  const reciprocityNote = buildMetricNote(core4.reciprocity.score, core4.reciprocity.confidence, reciprocityCaption(core4.reciprocity.score))

  const relationshipStatus = buildRelationshipStatus(
    score.recentRelationshipPosition,
    score.recentRomanceSignal,
    gapBetween(core4.interest.bySpeaker['나']?.score ?? null, core4.interest.bySpeaker['상대방']?.score ?? null),
  )

  return {
    directAnswer: buildDirectAnswer(intent, score),
    relationshipStatus,
    interestNotes,
    intimacyNotes,
    reciprocityNote,
    initiationSentence: initiationSentence(core4.conversationInitiationRatio.ratioBySpeaker),
    patterns: buildRelationshipPatterns({
      validatedSignals,
      reciprocityPairs,
      core4Preview: core4,
      recentRomanceSignal: score.recentRomanceSignal,
    }),
    psychologicalInterpretation: buildPsychologicalInterpretation(score, validatedSignals),
    aiSummary: buildAiSummary(score, relationshipStatus),
    keyScenes: selectKeyScenes(intent, validatedSignals, messages),
    comparisonLine: buildComparisonLine(score),
    tips: buildTips(score),
    mismatch: null,
  }
}

function detectMismatch(intent: AnalysisIntent, score: PreviewScoreResult): boolean {
  if (!ROMANTIC_FRAME_INTENTS.includes(intent)) return false
  if (score.recentConversationTemperature.score === null) return false
  return score.recentRomanceSignal.score < MISMATCH_ROMANCE_CEILING
}

export function buildPreviewReport(input: BuildPreviewReportInput): { report: PreviewReport; alternateReport: PreviewReport | null } {
  const report = composeReport(input)

  if (!detectMismatch(input.intent, input.score)) {
    return { report, alternateReport: null }
  }

  const intentLabel = INTENT_LABEL_BY_VALUE.get(input.intent) ?? '선택한 질문'
  report.mismatch = {
    message: `'${intentLabel}'를 기준으로 분석했지만, 현재 대화에서는 연애적 탐색보다는 친구·공동 관심사 중심의 상호작용이 더 강하게 보여요.`,
    ctaLabel: '친구 관계 관점으로 다시 보기',
  }

  // Same scores, same evidence — only the Intent lens passed to composeReport
  // changes, which only affects directAnswer (buildDirectAnswer.js). No
  // second LLM/API call, no Core score recomputation (spec §15/§22 #12/#13).
  const alternateReport = composeReport({ ...input, intent: 'friendship_change' })
  return { report, alternateReport }
}
