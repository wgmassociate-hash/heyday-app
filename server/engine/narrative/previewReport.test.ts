// Phase 2.4 — Rich Free Preview / Reward Layer tests (spec §22).
import { describe, expect, test } from 'vitest'
import type { Core4Result, IndividualScore, RomanceResult } from '../score/types.js'
import type { PreviewScoreResult } from '../pipeline/types.js'
import type { AnalysisIntent } from '../intent/types.js'
import type { ValidatedSignal } from '../signals/types.js'
import type { ValidatedReciprocityPair } from '../signals/reciprocityTypes.js'
import type { MessageLookup } from './keySceneSelector.js'
import { buildPreviewReport } from './previewReport.js'

function score(value: number | null, confidence: IndividualScore['confidence'] = 'high'): IndividualScore {
  return { score: value, confidence }
}

function core4(overrides: Partial<Core4Result> = {}): Core4Result {
  return {
    interest: { bySpeaker: { 나: score(50), 상대방: score(50) } },
    intimacy: { bySpeaker: { 나: score(50), 상대방: score(50) } },
    conversationInitiationRatio: { ratioBySpeaker: { 나: 0.5, 상대방: 0.5 } },
    reciprocity: { score: 60, confidence: 'high', bySpeaker: { 나: score(60), 상대방: score(60) } },
    ...overrides,
  }
}

function romance(value: number, overrides: Partial<RomanceResult> = {}): RomanceResult {
  return { score: value, positiveCount: 0, ambiguousCount: 0, distancingCount: 0, ...overrides }
}

function previewScore(overrides: Partial<PreviewScoreResult> = {}): PreviewScoreResult {
  return {
    recentConversationTemperature: score(60),
    recentRomanceSignal: romance(20),
    initiativeRatioPreview: { ratioBySpeaker: { 나: 0.5, 상대방: 0.5 } },
    core4Preview: core4(),
    windowMessageCount: 50,
    recentRelationshipPosition: { label: 'still_forming' },
    windowLabel: '최근 2주',
    confidenceLabel: 'recent_window',
    scoreEngineVersion: 'test',
    ...overrides,
  }
}

function sig(overrides: Partial<ValidatedSignal>): ValidatedSignal {
  return {
    signalType: 'follow_up_question',
    category: 'interest',
    direction: 'positive',
    actorSpeakerId: '나',
    targetSpeakerId: '상대방',
    messageIds: ['m1'],
    reason: '테스트 신호',
    chunkId: 'chunk_0',
    ...overrides,
  }
}

function pair(overrides: Partial<ValidatedReciprocityPair>): ValidatedReciprocityPair {
  return {
    pairType: 'question_response',
    initiatorSpeakerId: '나',
    responderSpeakerId: '상대방',
    triggerMessageIds: ['m1'],
    responseMessageIds: ['m2'],
    reason: '테스트 페어',
    chunkId: 'chunk_0',
    ...overrides,
  }
}

function messages(entries: Array<[string, string, string]> = [['m1', '나', '지난번 그거 어떻게 됐어?']]): MessageLookup {
  const map: MessageLookup = new Map()
  for (const [id, speakerId, text] of entries) map.set(id, { speakerId, text })
  return map
}

describe('buildPreviewReport — directAnswer (item 1)', () => {
  test('romantic_interest produces a direct answer to that question', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore(),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.directAnswer.length).toBeGreaterThan(0)
  })

  test('every intent produces a non-empty direct answer', () => {
    const intents: AnalysisIntent[] = [
      'romantic_interest',
      'relationship_change',
      'imbalance',
      'conversation_meaning',
      'relationship_definition',
      'friendship_change',
    ]
    const answers = intents.map(
      (intent) =>
        buildPreviewReport({
          intent,
          score: previewScore(),
          validatedSignals: [],
          reciprocityPairs: [],
          messages: messages(),
        }).report.directAnswer,
    )
    for (const answer of answers) expect(answer.length).toBeGreaterThan(0)
  })
})

describe('buildPreviewReport — relationship status (item 2)', () => {
  test('insufficient_data position -> the "적은 단서" label', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore({ recentConversationTemperature: score(null, 'insufficient'), recentRelationshipPosition: { label: 'insufficient_data' } }),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.relationshipStatus).toBe('아직 관계 단서가 적어요')
  })
})

describe('buildPreviewReport — patterns (item 3, tests #3/#4/#5)', () => {
  test('produces between 2 and 4 patterns even with zero signals (guaranteed fallbacks)', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore(),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.patterns.length).toBeGreaterThanOrEqual(2)
    expect(report.patterns.length).toBeLessThanOrEqual(4)
  })

  test('a memory-detail signal produces the memory pattern (grounded in real evidence)', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore(),
      validatedSignals: [sig({ signalType: 'remembers_past_detail', category: 'interest' })],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.patterns.some((p) => p.key === 'memory')).toBe(true)
  })

  test('never contains two patterns with identical text (dedup)', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore(),
      validatedSignals: [sig({ signalType: 'remembers_past_detail' }), sig({ signalType: 'follows_up_on_plan' })],
      reciprocityPairs: [],
      messages: messages(),
    })
    const texts = report.patterns.map((p) => p.text)
    expect(new Set(texts).size).toBe(texts.length)
  })

  test('does not fabricate a pattern with no backing signal (no romance pattern without any romance-category signal)', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore({ recentRomanceSignal: romance(0) }),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.patterns.some((p) => p.key === 'romance')).toBe(false)
  })

  test('a real plan_response reciprocity pair produces the "실제 약속으로 이어지는" expansion pattern instead of its no-expansion fallback', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore(),
      validatedSignals: [],
      reciprocityPairs: [pair({ pairType: 'plan_response' })],
      messages: messages(),
    })
    const expansion = report.patterns.find((p) => p.key === 'expansion')
    expect(expansion?.text).toContain('실제 약속이나 다음 행동')
  })
})

describe('buildPreviewReport — key scenes (item 4, tests #7/#8)', () => {
  test('returns at most 2 scenes', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore(),
      validatedSignals: [
        sig({ signalType: 'remembers_past_detail', category: 'interest', messageIds: ['m1'] }),
        sig({ signalType: 'self_disclosure', category: 'intimacy', messageIds: ['m2'] }),
        sig({ signalType: 'follows_up_on_plan', category: 'interest', messageIds: ['m1'] }),
      ],
      reciprocityPairs: [],
      messages: messages([
        ['m1', '나', '지난번 그거 어떻게 됐어?'],
        ['m2', '상대방', '나 요즘 좀 힘들어'],
      ]),
    })
    expect(report.keyScenes.length).toBeLessThanOrEqual(2)
  })

  test('prefers two scenes with different signalTypes over repeating one', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore(),
      validatedSignals: [
        sig({ signalType: 'remembers_past_detail', category: 'interest', messageIds: ['m1'] }),
        sig({ signalType: 'self_disclosure', category: 'intimacy', messageIds: ['m2'] }),
      ],
      reciprocityPairs: [],
      messages: messages([
        ['m1', '나', '지난번 그거 어떻게 됐어?'],
        ['m2', '상대방', '나 요즘 좀 힘들어'],
      ]),
    })
    if (report.keyScenes.length === 2) {
      expect(report.keyScenes[0].signalType).not.toBe(report.keyScenes[1].signalType)
    }
  })

  test('each scene carries the actual anonymized excerpt, not just the reason paraphrase', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore(),
      validatedSignals: [sig({ signalType: 'remembers_past_detail', messageIds: ['m1'], reason: '기억하고 다시 물어봄' })],
      reciprocityPairs: [],
      messages: messages([['m1', '나', '지난번 그거 어떻게 됐어?']]),
    })
    expect(report.keyScenes[0].excerpt).toBe('지난번 그거 어떻게 됐어?')
    expect(report.keyScenes[0].excerpts).toEqual([{ speakerId: '나', text: '지난번 그거 어떻게 됐어?' }])
    expect(report.keyScenes[0].title).toBe('지나간 말을 기억해 다시 꺼낸 순간')
    expect(report.keyScenes[0].cueLabel).toBe('관심의 단서')
  })

  test('shows up to three linked messages so a scene is not stripped of its context', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore(),
      validatedSignals: [sig({ signalType: 'includes_partner_in_future', category: 'intimacy', messageIds: ['m1', 'm2', 'm3', 'm4'] })],
      reciprocityPairs: [],
      messages: messages([
        ['m1', '상대방', '연휴 때 시간 괜찮아?'],
        ['m2', '나', '응 아직 별일 없어'],
        ['m3', '상대방', '그럼 커피 한잔하자'],
        ['m4', '나', '좋아'],
      ]),
    })
    expect(report.keyScenes[0].excerpts).toEqual([
      { speakerId: '상대방', text: '연휴 때 시간 괜찮아?' },
      { speakerId: '나', text: '응 아직 별일 없어' },
      { speakerId: '상대방', text: '그럼 커피 한잔하자' },
    ])
    expect(report.keyScenes[0].excerpts).toHaveLength(3)
  })
})

describe('buildPreviewReport — comparison line (item 5, test #9)', () => {
  test('falls back to the low-confidence-only line when there is no meaningful gap', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore(),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.comparisonLine).toBe('현재 대화 범위에서 보이는 방향만 참고해주세요.')
  })

  test('surfaces an interest-gap comparison when one speaker clearly leads', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore({ core4Preview: core4({ interest: { bySpeaker: { 나: score(85), 상대방: score(30) } } }) }),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.comparisonLine).toContain('관심 표현은 당신 쪽에서 더 많이 나타났어요')
  })
})

describe('buildPreviewReport — tips (item 6, test #10)', () => {
  test('produces two concrete tips grounded in the actual result', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore({ core4Preview: core4({ conversationInitiationRatio: { ratioBySpeaker: { 나: 0.2, 상대방: 0.8 } } }) }),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.tips).toHaveLength(2)
    expect(report.tips[0]).toContain('상대가 먼저')
    expect(report.tips[0]).toContain('짧은 질문을 하나')
    expect(report.tips[1]).toContain('짧은 답이 반복되면')
  })

  test('gives an easy opener when the other person does not initiate more often', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore(),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.tips).toHaveLength(2)
    expect(report.tips[0]).toContain('지난번에 말한 그거 어떻게 됐어?')
  })

  test('uses reciprocity to qualify the next step when romance signals are high', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore({
        recentRomanceSignal: romance(80),
        core4Preview: core4({ reciprocity: { score: 35, confidence: 'high', bySpeaker: { 나: score(60), 상대방: score(30) } } }),
      }),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.tips).toHaveLength(2)
    expect(report.tips[1]).toContain('대화가 한쪽으로 흐르는')
    expect(report.tips[1]).toContain('상대도 질문이나 새 화제로 돌아오는지')
  })

  test('does not suggest a meetup when reciprocity evidence is insufficient', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore({
        recentRomanceSignal: romance(80),
        core4Preview: core4({ reciprocity: { score: null, confidence: 'insufficient', bySpeaker: { 나: score(null, 'insufficient'), 상대방: score(null, 'insufficient') } } }),
      }),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.tips[1]).toContain('아직 근거가 부족해요')
    expect(report.tips[1]).not.toContain('같이 가볼래')
  })
})

describe('buildPreviewReport — mismatch (item 7, tests #11/#12/#13)', () => {
  test('romantic_interest against a low-romance, real-temperature (friend-like) result -> mismatch notice', () => {
    const { report, alternateReport } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore({ recentRomanceSignal: romance(0), recentConversationTemperature: score(55) }),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.mismatch).not.toBeNull()
    expect(report.mismatch?.ctaLabel).toBe('친구 관계 관점으로 다시 보기')
    expect(alternateReport).not.toBeNull()
  })

  test('no mismatch when romance is genuinely present', () => {
    const { report, alternateReport } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore({ recentRomanceSignal: romance(60), recentConversationTemperature: score(55) }),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.mismatch).toBeNull()
    expect(alternateReport).toBeNull()
  })

  test('the alternate (mismatch) report requires no extra signals/messages input — same scores, different lens only', () => {
    const input = {
      intent: 'romantic_interest' as const,
      score: previewScore({ recentRomanceSignal: romance(0), recentConversationTemperature: score(55) }),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    }
    const first = buildPreviewReport(input)
    const second = buildPreviewReport(input)
    expect(first.alternateReport).toEqual(second.alternateReport)
    // Core score input is identical between the two calls — this IS the
    // "Core score 불변" guarantee at the report layer (score/** itself is
    // untouched by this whole module, so there is nothing here that could
    // have changed it).
    expect(input.score).toEqual(previewScore({ recentRomanceSignal: romance(0), recentConversationTemperature: score(55) }))
  })
})

describe('buildPreviewReport — metric notes carry no fabricated caption for null scores', () => {
  test('a null Interest score has a null caption, not a guessed one', () => {
    const { report } = buildPreviewReport({
      intent: 'romantic_interest',
      score: previewScore({ core4Preview: core4({ interest: { bySpeaker: { 나: score(null, 'insufficient'), 상대방: score(null, 'insufficient') } } }) }),
      validatedSignals: [],
      reciprocityPairs: [],
      messages: messages(),
    })
    expect(report.interestNotes['나'].caption).toBeNull()
  })
})
