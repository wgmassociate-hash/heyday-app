// Phase 1 — Score Engine invariant fixtures
// (docs/implementation_review_v2.md §8, docs/implementation_plan_v2.md §19.2).
//
// Core 4's weights are product heuristics, not measured facts (weights.ts's
// header comment), so these tests don't assert exact numbers. They assert
// the properties the plan requires the design to hold no matter how the
// weights get tuned later: monotonicity, length-invariance, saturation, and
// "no evidence -> no score contribution".
import { describe, expect, test } from 'vitest'
import type { CodeFeatures } from '../features/types.js'
import type { ValidatedSignal } from '../signals/types.js'
import { validateSignals } from '../signals/evidenceValidator.js'
import type { EnrichedMessage } from '../messageModel/types.js'
import { computeIndividualScore } from './core4.js'
import { runScoreEngine } from './scoreEngine.js'
import { saturatedContribution } from './mathUtils.js'
import { INTEREST_SIGNAL_CONFIG, RECIPROCITY_SIGNAL_CONFIG } from './weights.js'

function makeCodeFeatures(overrides: Partial<CodeFeatures> = {}): CodeFeatures {
  return {
    speakerIds: ['personA', 'personB'],
    messageCountBySpeaker: { personA: 100, personB: 100 },
    turnInitiationCounts: { personA: 10, personB: 10 },
    replyGapStatsBySpeaker: {
      personA: { avgMinutes: 5, sampleCount: 10 },
      personB: { avgMinutes: 5, sampleCount: 10 },
    },
    emojiRatioBySpeaker: { personA: 0.1, personB: 0.1 },
    questionMessageCountBySpeaker: { personA: 20, personB: 20 },
    topicHits: [],
    sessionCount: 5,
    restartOpportunityCount: 10,
    ...overrides,
  }
}

let idCounter = 0
function makeSignal(overrides: Partial<ValidatedSignal> = {}): ValidatedSignal {
  idCounter += 1
  return {
    signalType: 'follow_up_question',
    category: 'interest',
    direction: 'positive',
    actorSpeakerId: 'personA',
    targetSpeakerId: 'personB',
    messageIds: [`msg_${idCounter}`],
    reason: 'test fixture',
    chunkId: 'chunk_0',
    ...overrides,
  }
}

function repeat(n: number, factory: () => ValidatedSignal): ValidatedSignal[] {
  return Array.from({ length: n }, () => factory())
}

describe('length invariance (§19.2 #9)', () => {
  test('same rate, 10x conversation length -> ~same Interest score', () => {
    const small = computeIndividualScore(
      repeat(2, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      { actorMessageCount: 100, targetMessageCount: 20, restartOpportunityCount: 10, pairOpportunityCount: 20 },
      INTEREST_SIGNAL_CONFIG,
    )
    const large = computeIndividualScore(
      repeat(20, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      { actorMessageCount: 1000, targetMessageCount: 200, restartOpportunityCount: 100, pairOpportunityCount: 200 },
      INTEREST_SIGNAL_CONFIG,
    )
    expect(Math.abs(small.score - large.score)).toBeLessThan(3)
  })
})

describe('saturation (§19.2 #10)', () => {
  test('contribution never exceeds weight, and is concave in rate', () => {
    const weight = 100
    const at0 = saturatedContribution(0, weight)
    const atHalf = saturatedContribution(0.5, weight)
    const atFull = saturatedContribution(1, weight)
    expect(atFull).toBeLessThanOrEqual(weight)
    expect(atFull - atHalf).toBeLessThan(atHalf - at0)
  })

  test('extreme repetition of one signalType does not blow past its weight share', () => {
    const result = computeIndividualScore(
      repeat(500, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      { actorMessageCount: 100, targetMessageCount: 20, restartOpportunityCount: 10, pairOpportunityCount: 20 },
      INTEREST_SIGNAL_CONFIG,
    )
    // follow_up_question is 25 of 100 total weight -> its full saturation
    // caps this signalType's share at 25/100 = 25 points, not near 100.
    expect(result.score).toBeLessThan(40)
  })
})

describe('rate vs. raw count (§19.2 #11)', () => {
  test('same count, denser opportunity -> higher score', () => {
    const sparse = computeIndividualScore(
      repeat(5, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      { actorMessageCount: 100, targetMessageCount: 100, restartOpportunityCount: 10, pairOpportunityCount: 20 },
      INTEREST_SIGNAL_CONFIG,
    )
    const dense = computeIndividualScore(
      repeat(5, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      { actorMessageCount: 100, targetMessageCount: 20, restartOpportunityCount: 10, pairOpportunityCount: 20 },
      INTEREST_SIGNAL_CONFIG,
    )
    expect(dense.score).toBeGreaterThan(sparse.score)
  })
})

describe('Interest monotonicity (review §8 #1)', () => {
  test('adding more follow-up/remembered-detail signals never decreases Interest', () => {
    const opportunities = { actorMessageCount: 100, targetMessageCount: 100, restartOpportunityCount: 10, pairOpportunityCount: 20 }
    const fewer = computeIndividualScore(
      repeat(2, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      opportunities,
      INTEREST_SIGNAL_CONFIG,
    )
    const more = computeIndividualScore(
      [
        ...repeat(2, () => makeSignal({ signalType: 'follow_up_question' })),
        ...repeat(3, () => makeSignal({ signalType: 'remembers_past_detail' })),
      ],
      'personA',
      opportunities,
      INTEREST_SIGNAL_CONFIG,
    )
    expect(more.score).toBeGreaterThanOrEqual(fewer.score)
  })
})

describe('Reciprocity one-sidedness (review §8 #2, #12)', () => {
  test('only one side reciprocating does not push Reciprocity up', () => {
    const codeFeatures = makeCodeFeatures()
    const oneSided = runScoreEngine({
      codeFeatures,
      validatedSignals: repeat(10, () =>
        makeSignal({ signalType: 'question_answered_or_reciprocated', category: 'reciprocity', actorSpeakerId: 'personA', targetSpeakerId: 'personB' }),
      ),
    })
    const balanced = runScoreEngine({
      codeFeatures,
      validatedSignals: [
        ...repeat(10, () => makeSignal({ signalType: 'question_answered_or_reciprocated', category: 'reciprocity', actorSpeakerId: 'personA', targetSpeakerId: 'personB' })),
        ...repeat(10, () => makeSignal({ signalType: 'question_answered_or_reciprocated', category: 'reciprocity', actorSpeakerId: 'personB', targetSpeakerId: 'personA' })),
      ],
    })
    expect(oneSided.core4.reciprocity.score).toBeLessThan(balanced.core4.reciprocity.score)
  })

  test('neither side reciprocating scores 0, not a false "perfectly balanced" high score', () => {
    const result = runScoreEngine({ codeFeatures: makeCodeFeatures(), validatedSignals: [] })
    expect(result.core4.reciprocity.score).toBe(0)
  })
})

describe('Intimacy monotonicity (review §8 #3)', () => {
  test('more mutual self-disclosure never lowers Intimacy for either side', () => {
    const codeFeatures = makeCodeFeatures()
    const fewer = runScoreEngine({
      codeFeatures,
      validatedSignals: [
        ...repeat(2, () => makeSignal({ signalType: 'self_disclosure', category: 'intimacy', actorSpeakerId: 'personA' })),
        ...repeat(2, () => makeSignal({ signalType: 'self_disclosure', category: 'intimacy', actorSpeakerId: 'personB' })),
      ],
    })
    const more = runScoreEngine({
      codeFeatures,
      validatedSignals: [
        ...repeat(6, () => makeSignal({ signalType: 'self_disclosure', category: 'intimacy', actorSpeakerId: 'personA' })),
        ...repeat(6, () => makeSignal({ signalType: 'self_disclosure', category: 'intimacy', actorSpeakerId: 'personB' })),
      ],
    })
    expect(more.core4.intimacy.bySpeaker.personA.score).toBeGreaterThanOrEqual(fewer.core4.intimacy.bySpeaker.personA.score)
    expect(more.core4.intimacy.bySpeaker.personB.score).toBeGreaterThanOrEqual(fewer.core4.intimacy.bySpeaker.personB.score)
  })
})

describe('Initiative ratio (review §8 #4)', () => {
  test('one side starting/reviving the conversation far more shifts the ratio toward them', () => {
    const result = runScoreEngine({
      codeFeatures: makeCodeFeatures({ turnInitiationCounts: { personA: 18, personB: 2 } }),
      validatedSignals: [],
    })
    expect(result.core4.initiative.ratioBySpeaker.personA).toBeGreaterThan(0.8)
    expect(result.core4.initiative.ratioBySpeaker.personB).toBeLessThan(0.2)
  })

  test('no turn-initiation evidence at all splits the ratio evenly, not toward either side', () => {
    const result = runScoreEngine({
      codeFeatures: makeCodeFeatures({ turnInitiationCounts: { personA: 0, personB: 0 } }),
      validatedSignals: [],
    })
    expect(result.core4.initiative.ratioBySpeaker.personA).toBe(0.5)
    expect(result.core4.initiative.ratioBySpeaker.personB).toBe(0.5)
  })
})

describe('Romantic Signal (review §8 #5, #6)', () => {
  test('a long, ordinary friend conversation with zero romance signals scores 0', () => {
    const result = runScoreEngine({
      codeFeatures: makeCodeFeatures({ messageCountBySpeaker: { personA: 800, personB: 800 } }),
      validatedSignals: repeat(30, () => makeSignal({ signalType: 'follow_up_question', category: 'interest' })),
    })
    expect(result.romance.score).toBe(0)
  })

  test('explicit positive romance signals raise Romantic Signal above a friend baseline', () => {
    const codeFeatures = makeCodeFeatures()
    const friendBaseline = runScoreEngine({
      codeFeatures,
      validatedSignals: repeat(10, () => makeSignal({ signalType: 'follow_up_question', category: 'interest' })),
    })
    const withFlirting = runScoreEngine({
      codeFeatures,
      validatedSignals: [
        ...repeat(10, () => makeSignal({ signalType: 'follow_up_question', category: 'interest' })),
        ...repeat(8, () => makeSignal({ signalType: 'direct_flirting', category: 'romance', direction: 'positive' })),
      ],
    })
    expect(withFlirting.romance.score).toBeGreaterThan(friendBaseline.romance.score)
  })

  test('distancing signals pull Romantic Signal down, never negative', () => {
    const codeFeatures = makeCodeFeatures()
    const result = runScoreEngine({
      codeFeatures,
      validatedSignals: repeat(20, () => makeSignal({ signalType: 'avoids_meeting', category: 'distancing', direction: 'negative' })),
    })
    expect(result.romance.score).toBe(0)
  })
})

describe('Evidence Validator: rejected signals contribute nothing (review §8 #8)', () => {
  const messages: EnrichedMessage[] = [
    { id: 'msg_1', speakerId: 'personA', timestamp: null, date: null, text: 'hi', sourceType: 'txt' },
    { id: 'msg_2', speakerId: 'personB', timestamp: null, date: null, text: 'hello', sourceType: 'txt' },
  ]

  test('a signal citing a nonexistent messageId is rejected, not validated', () => {
    const { validated, rejected } = validateSignals(
      [
        {
          signalType: 'follow_up_question',
          category: 'interest',
          direction: 'positive',
          actorSpeakerId: 'personA',
          targetSpeakerId: 'personB',
          messageIds: ['msg_does_not_exist'],
          reason: 'fabricated',
        },
      ],
      messages,
      'chunk_0',
    )
    expect(validated).toHaveLength(0)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toBe('unknown_message_id')
  })

  test('score computed over only the validated set matches score computed as if the rejected signal never existed', () => {
    const opportunities = { actorMessageCount: 100, targetMessageCount: 100, restartOpportunityCount: 10, pairOpportunityCount: 20 }
    // Use messageIds that actually resolve against `messages` so these count
    // as valid evidence — only the extra fabricated-id signal should be
    // rejected by validateSignals().
    const goodSignals = () => makeSignal({ signalType: 'follow_up_question', messageIds: ['msg_1'] })
    const withoutRejected = computeIndividualScore(repeat(3, goodSignals), 'personA', opportunities, INTEREST_SIGNAL_CONFIG)

    const rawWithBadSignal = [
      ...repeat(3, goodSignals),
      { signalType: 'follow_up_question', category: 'interest' as const, direction: 'positive' as const, actorSpeakerId: 'personA', targetSpeakerId: 'personB', messageIds: ['nope'], reason: 'bad' },
    ]
    const { validated } = validateSignals(rawWithBadSignal, messages, 'chunk_0')
    const withRejectedFilteredOut = computeIndividualScore(validated, 'personA', opportunities, INTEREST_SIGNAL_CONFIG)

    expect(withRejectedFilteredOut.score).toBe(withoutRejected.score)
  })
})

describe('opportunity floor guards against tiny denominators (§9.3 MIN_OPPORTUNITY_FLOOR)', () => {
  test('a very short conversation does not produce a runaway or NaN rate', () => {
    const result = computeIndividualScore(
      repeat(3, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      { actorMessageCount: 2, targetMessageCount: 1, restartOpportunityCount: 1, pairOpportunityCount: 1 },
      INTEREST_SIGNAL_CONFIG,
    )
    expect(Number.isFinite(result.score)).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

describe('no signals at all -> zero score, low confidence', () => {
  test('computeIndividualScore with an empty signal list', () => {
    const result = computeIndividualScore(
      [],
      'personA',
      { actorMessageCount: 100, targetMessageCount: 100, restartOpportunityCount: 10, pairOpportunityCount: 20 },
      RECIPROCITY_SIGNAL_CONFIG,
    )
    expect(result.score).toBe(0)
    expect(result.confidence).toBe('low')
  })
})
