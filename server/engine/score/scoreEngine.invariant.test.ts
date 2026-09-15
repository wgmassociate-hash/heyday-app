// Phase 1 / 1.1 / 1.2 — Score Engine invariant fixtures.
// Weights are product heuristics, not measured facts (weights.ts's header
// comment), so these tests don't assert exact numbers. They assert the
// properties the design is required to hold no matter how the weights get
// tuned later: monotonicity, length-invariance, saturation reaching 100,
// score=null vs score=0 separation, confidence independent of evidenceCount,
// and real pair-based Reciprocity behavior.
import { describe, expect, test } from 'vitest'
import type { CodeFeatures } from '../features/types.js'
import type { EnrichedMessage } from '../messageModel/types.js'
import type { ValidatedReciprocityPair } from '../signals/reciprocityTypes.js'
import type { ValidatedSignal } from '../signals/types.js'
import { validateReciprocityPairs, validateSignals } from '../signals/evidenceValidator.js'
import { computeConfidence } from './confidence.js'
import { computeIndividualScore } from './core4.js'
import { saturatedContribution } from './mathUtils.js'
import { computePairOpportunity, computeReciprocity } from './reciprocity.js'
import { runScoreEngine } from './scoreEngine.js'
import type { IndividualScore } from './types.js'
import { INTEREST_SIGNAL_CONFIG, RECIPROCITY_PAIR_CONFIG } from './weights.js'
import { SignalExtractionResponseSchema } from '../signals/schema.js'

/** Asserts a metric is judgeable and returns its numeric score — a null
 * here means a fixture is wrong (accidentally landed in the 'insufficient'
 * regime), which this surfaces as a loud test failure instead of a silent
 * `null` flowing into arithmetic. */
function requireScore(metric: IndividualScore): number {
  if (metric.score === null) throw new Error(`expected a judgeable score, got null (confidence: ${metric.confidence})`)
  return metric.score
}

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
    planProposalMessageCountBySpeaker: { personA: 5, personB: 5 },
    turnAlternationRate: 0.5,
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

let pairCounter = 0
function makePair(overrides: Partial<ValidatedReciprocityPair> = {}): ValidatedReciprocityPair {
  pairCounter += 1
  return {
    pairType: 'question_response',
    initiatorSpeakerId: 'personB',
    responderSpeakerId: 'personA',
    triggerMessageIds: [`trig_${pairCounter}`],
    responseMessageIds: [`resp_${pairCounter}`],
    reason: 'test fixture',
    chunkId: 'chunk_0',
    ...overrides,
  }
}

function repeat<T>(n: number, factory: () => T): T[] {
  return Array.from({ length: n }, () => factory())
}

describe('length invariance', () => {
  test('same rate, 10x conversation length -> ~same Interest score', () => {
    const small = computeIndividualScore(
      repeat(2, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      { actorMessageCount: 100, targetMessageCount: 20, restartOpportunityCount: 10 },
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    const large = computeIndividualScore(
      repeat(20, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      { actorMessageCount: 1000, targetMessageCount: 200, restartOpportunityCount: 100 },
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    expect(Math.abs(requireScore(small) - requireScore(large))).toBeLessThan(3)
  })
})

describe('saturation (normalized, Phase 1.1 fix)', () => {
  test('S(0) = 0, S(1) = weight exactly, monotonic and concave on [0,1]', () => {
    const weight = 100
    const at0 = saturatedContribution(0, weight)
    const atHalf = saturatedContribution(0.5, weight)
    const atFull = saturatedContribution(1, weight)
    expect(at0).toBe(0)
    expect(atFull).toBeCloseTo(weight, 6)
    expect(atHalf).toBeGreaterThan(at0)
    expect(atFull).toBeGreaterThan(atHalf)
    expect(atFull - atHalf).toBeLessThan(atHalf - at0)
  })

  test('every signalType at rate=1 -> metric reaches exactly 100', () => {
    const opportunities = { actorMessageCount: 100, targetMessageCount: 10, restartOpportunityCount: 10 }
    const signals = INTEREST_SIGNAL_CONFIG.flatMap((cfg) => repeat(10, () => makeSignal({ signalType: cfg.signalType })))
    const result = computeIndividualScore(signals, 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 5)
    expect(result.score).toBe(100)
  })
})

describe('score=null vs score=0 (Phase 1.2 audit finding #1)', () => {
  test('opportunity below the judgeable threshold -> score is null, confidence insufficient (not a distorted number)', () => {
    const result = computeIndividualScore(
      [makeSignal({ signalType: 'follow_up_question' })],
      'personA',
      { actorMessageCount: 100, targetMessageCount: 1, restartOpportunityCount: 10 },
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    expect(result.score).toBeNull()
    expect(result.confidence).toBe('insufficient')
  })

  test('opportunity at the judgeable threshold with rate=1, but only ONE signalType observed -> capped by the diversity floor, not a per-type weight share (Phase 2.3 supersedes the old per-signalType-weight-share design)', () => {
    // Superseded invariant (removed, Phase 2.3): this used to assert the
    // score equals exactly follow_up_question's own weight share (25/100),
    // which was a direct consequence of the old per-signalType weighted-sum
    // design this revision replaced (docs decision, scoring model comparison
    // A/B/C/D) — that design is what let the score sit at a fixed, low
    // ceiling regardless of the shape of the rest of the config table, and
    // is not a product requirement in its own right. The pooled
    // density+diversity model still bounds a single-signalType showing well
    // below the maximum (see 'a single signalType repeated...' below); this
    // fixture's exact 50 comes from message-family density fully saturating
    // (100) but the diversity multiplier for one distinct type capping it at
    // DIVERSITY_FLOOR=0.4 (55), weighted 90/10 against the restart family's
    // untouched 0.
    const result = computeIndividualScore(
      repeat(5, () => makeSignal({ signalType: 'follow_up_question' })), // count=5=opportunity -> rate=1
      'personA',
      { actorMessageCount: 100, targetMessageCount: 5, restartOpportunityCount: 10 },
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    expect(result.confidence).not.toBe('insufficient')
    expect(result.score).toBe(50)
  })

  test('within the judgeable range, a larger opportunity (lower rate) scores strictly lower', () => {
    const smallOpportunity = computeIndividualScore(
      [makeSignal({ signalType: 'follow_up_question' })],
      'personA',
      { actorMessageCount: 100, targetMessageCount: 5, restartOpportunityCount: 10 },
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    const largeOpportunity = computeIndividualScore(
      [makeSignal({ signalType: 'follow_up_question' })],
      'personA',
      { actorMessageCount: 100, targetMessageCount: 100, restartOpportunityCount: 10 },
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    expect(requireScore(smallOpportunity)).toBeGreaterThan(requireScore(largeOpportunity))
  })

  test('ample opportunity, zero evidence -> score 0 (a real zero), not null', () => {
    const result = computeIndividualScore(
      [],
      'personA',
      { actorMessageCount: 100, targetMessageCount: 100, restartOpportunityCount: 10 },
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    expect(result.score).toBe(0)
    expect(result.confidence).not.toBe('insufficient')
    expect(Number.isFinite(result.score)).toBe(true)
  })

  test('zero evidence with ample opportunity/message/session coverage can still reach medium/high confidence (audit finding #2)', () => {
    const result = computeIndividualScore(
      [], // no signals at all
      'personA',
      { actorMessageCount: 200, targetMessageCount: 200, restartOpportunityCount: 50 },
      INTEREST_SIGNAL_CONFIG,
      5, // sessionCount
    )
    expect(result.score).toBe(0)
    expect(['medium', 'high']).toContain(result.confidence)
  })
})

describe('Interest monotonicity', () => {
  test('adding more follow-up/remembered-detail signals never decreases Interest', () => {
    const opportunities = { actorMessageCount: 100, targetMessageCount: 100, restartOpportunityCount: 10 }
    const fewer = computeIndividualScore(
      repeat(2, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      opportunities,
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    const more = computeIndividualScore(
      [
        ...repeat(2, () => makeSignal({ signalType: 'follow_up_question' })),
        ...repeat(3, () => makeSignal({ signalType: 'remembers_past_detail' })),
      ],
      'personA',
      opportunities,
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    expect(requireScore(more)).toBeGreaterThanOrEqual(requireScore(fewer))
  })
})

describe('Intimacy monotonicity', () => {
  test('more mutual self-disclosure never lowers Intimacy for either side', () => {
    const codeFeatures = makeCodeFeatures()
    const fewer = runScoreEngine({
      codeFeatures,
      reciprocityPairs: [],
      validatedSignals: [
        ...repeat(2, () => makeSignal({ signalType: 'self_disclosure', category: 'intimacy', actorSpeakerId: 'personA' })),
        ...repeat(2, () => makeSignal({ signalType: 'self_disclosure', category: 'intimacy', actorSpeakerId: 'personB' })),
      ],
    })
    const more = runScoreEngine({
      codeFeatures,
      reciprocityPairs: [],
      validatedSignals: [
        ...repeat(6, () => makeSignal({ signalType: 'self_disclosure', category: 'intimacy', actorSpeakerId: 'personA' })),
        ...repeat(6, () => makeSignal({ signalType: 'self_disclosure', category: 'intimacy', actorSpeakerId: 'personB' })),
      ],
    })
    expect(requireScore(more.core4.intimacy.bySpeaker.personA)).toBeGreaterThanOrEqual(
      requireScore(fewer.core4.intimacy.bySpeaker.personA),
    )
    expect(requireScore(more.core4.intimacy.bySpeaker.personB)).toBeGreaterThanOrEqual(
      requireScore(fewer.core4.intimacy.bySpeaker.personB),
    )
  })
})

describe('conversationInitiationRatio (renamed from Initiative, audit finding #4)', () => {
  test('one side starting/reviving the conversation far more shifts the ratio toward them', () => {
    const result = runScoreEngine({
      codeFeatures: makeCodeFeatures({ turnInitiationCounts: { personA: 18, personB: 2 } }),
      validatedSignals: [],
      reciprocityPairs: [],
    })
    expect(result.core4.conversationInitiationRatio.ratioBySpeaker.personA).toBeGreaterThan(0.8)
    expect(result.core4.conversationInitiationRatio.ratioBySpeaker.personB).toBeLessThan(0.2)
  })

  test('no turn-initiation evidence at all splits the ratio evenly, not toward either side', () => {
    const result = runScoreEngine({
      codeFeatures: makeCodeFeatures({ turnInitiationCounts: { personA: 0, personB: 0 } }),
      validatedSignals: [],
      reciprocityPairs: [],
    })
    expect(result.core4.conversationInitiationRatio.ratioBySpeaker.personA).toBe(0.5)
    expect(result.core4.conversationInitiationRatio.ratioBySpeaker.personB).toBe(0.5)
  })
})

describe('Romantic Signal', () => {
  test('a long, ordinary friend conversation with zero romance signals scores 0', () => {
    const result = runScoreEngine({
      codeFeatures: makeCodeFeatures({ messageCountBySpeaker: { personA: 800, personB: 800 } }),
      validatedSignals: repeat(30, () => makeSignal({ signalType: 'follow_up_question', category: 'interest' })),
      reciprocityPairs: [],
    })
    expect(result.romance.score).toBe(0)
  })

  test('explicit positive romance signals raise Romantic Signal above a friend baseline', () => {
    const codeFeatures = makeCodeFeatures()
    const friendBaseline = runScoreEngine({
      codeFeatures,
      validatedSignals: repeat(10, () => makeSignal({ signalType: 'follow_up_question', category: 'interest' })),
      reciprocityPairs: [],
    })
    const withFlirting = runScoreEngine({
      codeFeatures,
      validatedSignals: [
        ...repeat(10, () => makeSignal({ signalType: 'follow_up_question', category: 'interest' })),
        ...repeat(8, () => makeSignal({ signalType: 'direct_flirting', category: 'romance', direction: 'positive' })),
      ],
      reciprocityPairs: [],
    })
    expect(withFlirting.romance.score).toBeGreaterThan(friendBaseline.romance.score)
  })
})

describe('Evidence Validator: rejected signals contribute nothing', () => {
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
    const opportunities = { actorMessageCount: 100, targetMessageCount: 100, restartOpportunityCount: 10 }
    const goodSignals = () => makeSignal({ signalType: 'follow_up_question', messageIds: ['msg_1'] })
    const withoutRejected = computeIndividualScore(repeat(3, goodSignals), 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 5)

    const rawWithBadSignal = [
      ...repeat(3, goodSignals),
      { signalType: 'follow_up_question', category: 'interest' as const, direction: 'positive' as const, actorSpeakerId: 'personA', targetSpeakerId: 'personB', messageIds: ['nope'], reason: 'bad' },
    ]
    const { validated } = validateSignals(rawWithBadSignal, messages, 'chunk_0')
    const withRejectedFilteredOut = computeIndividualScore(validated, 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 5)

    expect(withRejectedFilteredOut.score).toBe(withoutRejected.score)
  })
})

// ---------------------------------------------------------------------------
// Phase 1.1 / 1.2 — Reciprocity Pair invariants
// ---------------------------------------------------------------------------

describe('Reciprocity: real pair tracking, not raw question volume', () => {
  test('question_response opportunity is driven only by the initiator\'s question count, unaffected by self-disclosure signals', () => {
    const codeFeatures = makeCodeFeatures({ questionMessageCountBySpeaker: { personA: 0, personB: 7 } })
    const opp = computePairOpportunity('question_response', codeFeatures, [], 'personB')
    expect(opp).toBe(7)
  })

  test("self_disclosure's reciprocity denominator (mutual_disclosure) is unaffected by '?' count", () => {
    const validatedSignals: ValidatedSignal[] = repeat(4, () =>
      makeSignal({ signalType: 'self_disclosure', category: 'intimacy', actorSpeakerId: 'personB' }),
    )
    const lowQuestions = makeCodeFeatures({ questionMessageCountBySpeaker: { personA: 0, personB: 1 } })
    const highQuestions = makeCodeFeatures({ questionMessageCountBySpeaker: { personA: 0, personB: 500 } })

    const oppLow = computePairOpportunity('mutual_disclosure', lowQuestions, validatedSignals, 'personB')
    const oppHigh = computePairOpportunity('mutual_disclosure', highQuestions, validatedSignals, 'personB')
    expect(oppLow).toBe(4)
    expect(oppHigh).toBe(4)
  })

  test('topic_expansion is excluded from the scoring config (audit finding #5)', () => {
    expect(RECIPROCITY_PAIR_CONFIG.some((cfg) => cfg.pairType === 'topic_expansion')).toBe(false)
  })

  test('RECIPROCITY_PAIR_CONFIG (5 pairTypes, topic_expansion excluded) weights sum to 100', () => {
    const sum = RECIPROCITY_PAIR_CONFIG.reduce((total, cfg) => total + cfg.weight, 0)
    expect(sum).toBe(100)
  })

  test('a valid question_response pair scores above zero for the responder', () => {
    // avgOpportunity across the 5 scored pairTypes for initiator=personB must
    // itself clear MIN_JUDGEABLE_OPPORTUNITY (question_response + plan_response
    // are the only two with nonzero opportunity here; the other 3 are 0 since
    // no intimacy signals were supplied) — bumped well above the threshold.
    const codeFeatures = makeCodeFeatures({
      questionMessageCountBySpeaker: { personA: 0, personB: 25 },
      planProposalMessageCountBySpeaker: { personA: 0, personB: 25 },
    })
    const pairs = repeat(3, () => makePair({ pairType: 'question_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA' }))
    const result = computeReciprocity(pairs, 'personA', 'personB', codeFeatures, [])
    expect(requireScore(result.bySpeaker.personA)).toBeGreaterThan(0)
  })

  test('one-sided pairs (only A responds, B never does) does not inflate overall Reciprocity', () => {
    const codeFeatures = makeCodeFeatures({
      questionMessageCountBySpeaker: { personA: 25, personB: 25 },
      planProposalMessageCountBySpeaker: { personA: 25, personB: 25 },
    })
    const oneSided = computeReciprocity(
      repeat(5, () => makePair({ pairType: 'question_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA' })),
      'personA',
      'personB',
      codeFeatures,
      [],
    )
    const balanced = computeReciprocity(
      [
        ...repeat(5, () => makePair({ pairType: 'question_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA' })),
        ...repeat(5, () => makePair({ pairType: 'question_response', initiatorSpeakerId: 'personA', responderSpeakerId: 'personB' })),
      ],
      'personA',
      'personB',
      codeFeatures,
      [],
    )
    expect(requireScore(oneSided)).toBeLessThan(requireScore(balanced))
  })

  test('one direction with opportunity below the judgeable threshold is null/"insufficient", not a forced 0 that reads as bad reciprocity', () => {
    // personA never sends any message at all — personB "responding to
    // personA" has zero opportunity of every pairType.
    const codeFeatures = makeCodeFeatures({
      messageCountBySpeaker: { personA: 0, personB: 50 },
      questionMessageCountBySpeaker: { personA: 0, personB: 10 },
      planProposalMessageCountBySpeaker: { personA: 0, personB: 0 },
    })
    const result = computeReciprocity([], 'personA', 'personB', codeFeatures, [])
    // personB "responding to personA" (initiator=personA) has zero opportunity.
    expect(result.bySpeaker.personB.score).toBeNull()
    expect(result.bySpeaker.personB.confidence).toBe('insufficient')
    // The overall result can't be judged either, since one direction can't be.
    expect(result.score).toBeNull()
    expect(result.confidence).toBe('insufficient')
  })

  test('opportunity is judgeable but zero pairs occurred -> score 0, not null (real zero)', () => {
    const codeFeatures = makeCodeFeatures({ questionMessageCountBySpeaker: { personA: 20, personB: 20 } })
    const result = computeReciprocity([], 'personA', 'personB', codeFeatures, [])
    expect(result.bySpeaker.personA.score).toBe(0)
    expect(result.bySpeaker.personA.confidence).not.toBe('insufficient')
    expect(result.score).toBe(0)
  })

  test('overall Reciprocity is deterministic — same pairs in, same result out, twice', () => {
    const codeFeatures = makeCodeFeatures()
    const pairs = repeat(4, () => makePair({ pairType: 'question_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA' }))
    const a = computeReciprocity(pairs, 'personA', 'personB', codeFeatures, [])
    const b = computeReciprocity(pairs, 'personA', 'personB', codeFeatures, [])
    expect(a).toEqual(b)
  })
})

// ---------------------------------------------------------------------------
// Phase 1.3 — Reciprocity Pair-Type Coverage Audit
//
// Bug found: a pairType with opportunity=0 still had its full weight counted
// in the score denominator, so a conversation where only question_response
// (weight 34) ever had any opportunity — answered perfectly every time —
// could never score above ~34, because the other 4 pairTypes' combined
// weight (66) sat in the denominator contributing 0 to the numerator, acting
// like "unobserved = failed" for dimensions that were never observable.
// Fixed in reciprocity.ts: opportunity=0 excludes a pairType from BOTH the
// numerator and the weight denominator; confidence now uses totalOpportunity
// (summed over available pairTypes) and pairTypeCoverage (available weight /
// full weight) as two separate axes instead of one flattened average.
// ---------------------------------------------------------------------------

describe('Reciprocity Pair-Type Coverage Audit (Phase 1.3)', () => {
  test('question_response opportunity alone, answered every time -> score is NOT capped near its own weight share (34)', () => {
    const codeFeatures = makeCodeFeatures({
      messageCountBySpeaker: { personA: 100, personB: 100 },
      questionMessageCountBySpeaker: { personA: 0, personB: 20 },
      planProposalMessageCountBySpeaker: { personA: 0, personB: 0 },
    })
    // personA responds to every one of personB's 20 questions.
    const pairs = repeat(20, () => makePair({ pairType: 'question_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA' }))
    const result = computeReciprocity(pairs, 'personA', 'personB', codeFeatures, [])
    expect(requireScore(result.bySpeaker.personA)).toBe(100)
  })

  test('opportunity-less pairTypes never dilute the score — adding unrelated (non-triggering) signals does not change it', () => {
    const codeFeatures = makeCodeFeatures({
      questionMessageCountBySpeaker: { personA: 0, personB: 20 },
      planProposalMessageCountBySpeaker: { personA: 0, personB: 0 },
    })
    const pairs = repeat(10, () => makePair({ pairType: 'question_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA' }))

    const withoutNoise = computeReciprocity(pairs, 'personA', 'personB', codeFeatures, [])
    const withNoise = computeReciprocity(pairs, 'personA', 'personB', codeFeatures, [
      // Unrelated to every reciprocity pairType's opportunity computation —
      // an Interest-category signal doesn't feed mutual_disclosure,
      // emotional_empathy, or joke_reciprocation's trigger counts.
      ...repeat(50, () => makeSignal({ signalType: 'follow_up_question', category: 'interest', actorSpeakerId: 'personB' })),
    ])

    expect(requireScore(withNoise.bySpeaker.personA)).toBe(requireScore(withoutNoise.bySpeaker.personA))
  })

  test('opportunity exists but zero responses occurred -> that pairType is a real 0, dragging the average down (not excluded)', () => {
    const codeFeatures = makeCodeFeatures({
      questionMessageCountBySpeaker: { personA: 0, personB: 20 },
      planProposalMessageCountBySpeaker: { personA: 0, personB: 0 },
    })
    // personB also self-discloses 10 times (mutual_disclosure opportunity),
    // but personA never once reciprocates that specific pairType.
    const validatedSignals = repeat(10, () => makeSignal({ signalType: 'self_disclosure', category: 'intimacy', actorSpeakerId: 'personB' }))
    const pairs = repeat(20, () => makePair({ pairType: 'question_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA' }))

    const result = computeReciprocity(pairs, 'personA', 'personB', codeFeatures, validatedSignals)
    // question_response alone would score 100 (previous test) — the
    // available-but-unanswered mutual_disclosure opportunity must pull this
    // below 100, proving it's counted as a real 0 rather than excluded.
    expect(requireScore(result.bySpeaker.personA)).toBeLessThan(100)
    expect(requireScore(result.bySpeaker.personA)).toBeGreaterThan(0)
  })

  test('abundant total opportunity concentrated in a single pairType (narrow coverage) does not reach high confidence', () => {
    const codeFeatures = makeCodeFeatures({
      messageCountBySpeaker: { personA: 200, personB: 200 },
      questionMessageCountBySpeaker: { personA: 0, personB: 100 },
      planProposalMessageCountBySpeaker: { personA: 0, personB: 0 },
      sessionCount: 10,
    })
    const pairs = repeat(50, () => makePair({ pairType: 'question_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA' }))
    const result = computeReciprocity(pairs, 'personA', 'personB', codeFeatures, [])
    expect(result.bySpeaker.personA.confidence).not.toBe('insufficient')
    expect(result.bySpeaker.personA.confidence).not.toBe('high')
  })

  test('broad coverage across several pairTypes with ample message/session data can reach high confidence', () => {
    const codeFeatures = makeCodeFeatures({
      messageCountBySpeaker: { personA: 200, personB: 200 },
      questionMessageCountBySpeaker: { personA: 0, personB: 30 },
      planProposalMessageCountBySpeaker: { personA: 0, personB: 20 },
      sessionCount: 10,
    })
    const validatedSignals = [
      ...repeat(15, () => makeSignal({ signalType: 'self_disclosure', category: 'intimacy', actorSpeakerId: 'personB' })),
      ...repeat(15, () => makeSignal({ signalType: 'vulnerable_emotion_share', category: 'intimacy', actorSpeakerId: 'personB' })),
    ]
    const pairs = [
      ...repeat(20, () => makePair({ pairType: 'question_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA' })),
      ...repeat(12, () => makePair({ pairType: 'mutual_disclosure', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA' })),
      ...repeat(12, () => makePair({ pairType: 'emotional_empathy', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA' })),
      ...repeat(15, () => makePair({ pairType: 'plan_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA' })),
    ]
    const result = computeReciprocity(pairs, 'personA', 'personB', codeFeatures, validatedSignals)
    expect(result.bySpeaker.personA.confidence).toBe('high')
  })

  test('every pairType at opportunity=0 -> null score, insufficient confidence', () => {
    const codeFeatures = makeCodeFeatures({
      questionMessageCountBySpeaker: { personA: 0, personB: 0 },
      planProposalMessageCountBySpeaker: { personA: 0, personB: 0 },
    })
    const result = computeReciprocity([], 'personA', 'personB', codeFeatures, [])
    expect(result.bySpeaker.personA.score).toBeNull()
    expect(result.bySpeaker.personA.confidence).toBe('insufficient')
    expect(result.score).toBeNull()
    expect(result.confidence).toBe('insufficient')
  })
})

describe('Reciprocity Pair Validator', () => {
  const messages: EnrichedMessage[] = [
    { id: 'm0', speakerId: 'personB', timestamp: null, date: null, text: '뭐해?', sourceType: 'txt', sessionId: 's0' },
    { id: 'm1', speakerId: 'personA', timestamp: null, date: null, text: '그냥 있어', sourceType: 'txt', sessionId: 's0' },
    { id: 'm2', speakerId: 'personA', timestamp: null, date: null, text: '너는?', sourceType: 'txt', sessionId: 's1' },
  ]

  test('accepts a well-formed pair (trigger before response, different speakers, same session)', () => {
    const { validated, rejected } = validateReciprocityPairs(
      [{ pairType: 'question_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA', triggerMessageIds: ['m0'], responseMessageIds: ['m1'], reason: 'x' }],
      messages,
      'chunk_0',
    )
    expect(validated).toHaveLength(1)
    expect(rejected).toHaveLength(0)
  })

  test('invalid trigger/response ordering (response before trigger) is rejected', () => {
    const { rejected } = validateReciprocityPairs(
      [{ pairType: 'question_response', initiatorSpeakerId: 'personA', responderSpeakerId: 'personB', triggerMessageIds: ['m1'], responseMessageIds: ['m0'], reason: 'x' }],
      messages,
      'chunk_0',
    )
    expect(rejected[0]?.reason).toBe('invalid_order')
  })

  test('same speaker as both initiator and responder is rejected', () => {
    const { rejected } = validateReciprocityPairs(
      [{ pairType: 'question_response', initiatorSpeakerId: 'personA', responderSpeakerId: 'personA', triggerMessageIds: ['m1'], responseMessageIds: ['m2'], reason: 'x' }],
      messages,
      'chunk_0',
    )
    expect(rejected[0]?.reason).toBe('same_speaker')
  })

  test('a response across a session boundary is rejected as out_of_range', () => {
    const { rejected } = validateReciprocityPairs(
      [{ pairType: 'question_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA', triggerMessageIds: ['m0'], responseMessageIds: ['m2'], reason: 'x' }],
      messages,
      'chunk_0',
    )
    expect(rejected[0]?.reason).toBe('out_of_range')
  })

  test('a nonexistent messageId is rejected', () => {
    const { rejected } = validateReciprocityPairs(
      [{ pairType: 'question_response', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA', triggerMessageIds: ['ghost'], responseMessageIds: ['m1'], reason: 'x' }],
      messages,
      'chunk_0',
    )
    expect(rejected[0]?.reason).toBe('unknown_message_id')
  })

  test('topic_expansion pairs are still accepted by the validator (evidence-only, not scored)', () => {
    const { validated } = validateReciprocityPairs(
      [{ pairType: 'topic_expansion', initiatorSpeakerId: 'personB', responderSpeakerId: 'personA', triggerMessageIds: ['m0'], responseMessageIds: ['m1'], reason: 'x' }],
      messages,
      'chunk_0',
    )
    expect(validated).toHaveLength(1)
  })
})

describe('Interaction Energy / Temperature (audit finding #5)', () => {
  test('message count alone does not raise Temperature\'s score when the alternation pattern is unchanged', () => {
    const shortConvo = makeCodeFeatures({
      messageCountBySpeaker: { personA: 10, personB: 10 },
      turnAlternationRate: 0.5,
      sessionCount: 2,
    })
    const longConvo = makeCodeFeatures({
      messageCountBySpeaker: { personA: 500, personB: 500 },
      turnAlternationRate: 0.5,
      sessionCount: 2,
    })
    const shortResult = runScoreEngine({ codeFeatures: shortConvo, validatedSignals: [], reciprocityPairs: [] })
    const longResult = runScoreEngine({ codeFeatures: longConvo, validatedSignals: [], reciprocityPairs: [] })
    expect(requireScore(shortResult.temperature)).toBe(requireScore(longResult.temperature))
  })

  test('session count alone does not raise Temperature\'s score (removed from the InteractionEnergy formula entirely)', () => {
    const fewSessions = makeCodeFeatures({ sessionCount: 1, turnAlternationRate: 0.5 })
    const manySessions = makeCodeFeatures({ sessionCount: 50, turnAlternationRate: 0.5 })
    const a = runScoreEngine({ codeFeatures: fewSessions, validatedSignals: [], reciprocityPairs: [] })
    const b = runScoreEngine({ codeFeatures: manySessions, validatedSignals: [], reciprocityPairs: [] })
    expect(requireScore(a.temperature)).toBe(requireScore(b.temperature))
  })

  test('higher turnAlternationRate raises Temperature via InteractionEnergy, holding everything else fixed', () => {
    const lowAlternation = makeCodeFeatures({ turnAlternationRate: 0.1 })
    const highAlternation = makeCodeFeatures({ turnAlternationRate: 0.9 })
    const a = runScoreEngine({ codeFeatures: lowAlternation, validatedSignals: [], reciprocityPairs: [] })
    const b = runScoreEngine({ codeFeatures: highAlternation, validatedSignals: [], reciprocityPairs: [] })
    expect(requireScore(b.temperature)).toBeGreaterThan(requireScore(a.temperature))
  })
})

describe('Temperature missing-metric handling (Phase 1.2 audit finding #4)', () => {
  test('a metric that is null on one side makes the mutual (harmonic-mean) component null, dropping it from Temperature rather than treating it as 0', () => {
    // An extremely short conversation (2 messages each side, one session) —
    // every component's opportunity (target message count for Interest,
    // actor message count for Intimacy, pairType triggers for Reciprocity,
    // total messages for InteractionEnergy) falls below
    // MIN_JUDGEABLE_OPPORTUNITY, so all 4 Temperature components end up
    // null. availableWeight=0 < MIN_TEMPERATURE_WEIGHT_COVERAGE -> Temperature null.
    const codeFeatures = makeCodeFeatures({
      messageCountBySpeaker: { personA: 2, personB: 2 },
      turnInitiationCounts: { personA: 1, personB: 1 },
      questionMessageCountBySpeaker: { personA: 0, personB: 0 },
      planProposalMessageCountBySpeaker: { personA: 0, personB: 0 },
      restartOpportunityCount: 1,
      sessionCount: 1,
    })
    const result = runScoreEngine({ codeFeatures, validatedSignals: [], reciprocityPairs: [] })
    expect(result.core4.interest.bySpeaker.personA.score).toBeNull()
    expect(result.core4.intimacy.bySpeaker.personA.score).toBeNull()
    expect(result.core4.reciprocity.score).toBeNull()
    expect(result.temperature.score).toBeNull()
    expect(result.temperature.confidence).toBe('insufficient')
  })

  test('with enough coverage, Temperature renormalizes over the available components instead of returning null', () => {
    // Ample data on both sides -> all 4 components judgeable -> full coverage.
    const codeFeatures = makeCodeFeatures()
    const result = runScoreEngine({
      codeFeatures,
      validatedSignals: repeat(5, () => makeSignal({ signalType: 'self_disclosure', category: 'intimacy', actorSpeakerId: 'personA' })),
      reciprocityPairs: [],
    })
    expect(result.temperature.score).not.toBeNull()
  })
})

describe('no signals at all -> zero score, not-insufficient confidence', () => {
  test('computeIndividualScore with an empty signal list but ample opportunity', () => {
    const result = computeIndividualScore(
      [],
      'personA',
      { actorMessageCount: 100, targetMessageCount: 100, restartOpportunityCount: 10 },
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    expect(result.score).toBe(0)
    expect(result.confidence).not.toBe('insufficient')
  })
})

describe('computeConfidence (Phase 1.2 redesign, audit finding #2 — no evidenceCount input at all)', () => {
  test('opportunity below the judgeable threshold is always insufficient, regardless of how large message/session count are', () => {
    expect(computeConfidence({ opportunity: 2, messageCount: 1000, sessionCount: 50 })).toBe('insufficient')
  })

  test('opportunity just above the threshold, but message/session count small -> low', () => {
    expect(computeConfidence({ opportunity: 6, messageCount: 10, sessionCount: 1 })).toBe('low')
  })

  test('everything comfortably large is high', () => {
    expect(computeConfidence({ opportunity: 50, messageCount: 200, sessionCount: 5 })).toBe('high')
  })
})

// ---------------------------------------------------------------------------
// Phase 2.2 — Short Conversation Result Calibration
// ---------------------------------------------------------------------------

describe('Core4 opportunity-less signalType exclusion (mirrors Reciprocity Phase 1.3)', () => {
  test('a signalType with zero opportunity (e.g. no restart points in a single-session window) does not dilute the score', () => {
    const opportunitiesWithRestarts = { actorMessageCount: 100, targetMessageCount: 20, restartOpportunityCount: 10 }
    const opportunitiesNoRestarts = { actorMessageCount: 100, targetMessageCount: 20, restartOpportunityCount: 0 }
    const signals = repeat(10, () => makeSignal({ signalType: 'follow_up_question' }))

    const withRestartOpportunity = computeIndividualScore(signals, 'personA', opportunitiesWithRestarts, INTEREST_SIGNAL_CONFIG, 5)
    const withoutRestartOpportunity = computeIndividualScore(signals, 'personA', opportunitiesNoRestarts, INTEREST_SIGNAL_CONFIG, 5)

    // revives_conversation (opportunity=0) is excluded from the denominator
    // entirely once there's no restart opportunity at all, instead of sitting
    // there contributing 0 to the numerator while still counting its full
    // weight against the score — so follow_up_question's saturated
    // contribution alone reaches a strictly higher share of the (now smaller)
    // weight total.
    expect(requireScore(withoutRestartOpportunity)).toBeGreaterThan(requireScore(withRestartOpportunity))
  })

  test('every signalType still at rate=1 -> exactly 100 even with the exclusion fix in place (boundary unchanged)', () => {
    const opportunities = { actorMessageCount: 100, targetMessageCount: 10, restartOpportunityCount: 10 }
    const signals = INTEREST_SIGNAL_CONFIG.flatMap((cfg) => repeat(10, () => makeSignal({ signalType: cfg.signalType })))
    const result = computeIndividualScore(signals, 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 5)
    expect(result.score).toBe(100)
  })
})

describe('Core4 does not compress a real, LLM-validated conversation into single digits (item 8: no floor added)', () => {
  test('several distinct validated Interest signalTypes together clear a single-digit score, without any score floor (zero evidence still scores exactly 0)', () => {
    const opportunities = { actorMessageCount: 32, targetMessageCount: 16, restartOpportunityCount: 6 }
    const modestButReal = computeIndividualScore(
      [
        ...repeat(1, () => makeSignal({ signalType: 'follow_up_question' })),
        ...repeat(1, () => makeSignal({ signalType: 'remembers_past_detail' })),
        ...repeat(1, () => makeSignal({ signalType: 'checks_on_feelings' })),
      ],
      'personA',
      opportunities,
      INTEREST_SIGNAL_CONFIG,
      4,
    )
    expect(requireScore(modestButReal)).toBeGreaterThan(10)

    // No floor: an actor with the exact same opportunity but zero validated
    // signals still scores exactly 0, never bumped toward modestButReal's range.
    const noEvidence = computeIndividualScore([], 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 4)
    expect(noEvidence.score).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Phase 2.3 — Interest/Intimacy Scoring Model Revision (Pooled Density +
// Diversity, replacing the per-signalType weighted-sum design entirely — see
// pooledSignalScore.ts's header for the full diagnosis and the A/B/C/D
// comparison that led here). These are the product invariants approved for
// this revision, replacing the old "each signalType contributes its own
// exact weight share" invariant (superseded above).
// ---------------------------------------------------------------------------

describe('Phase 2.3 — pooled density + diversity product invariants', () => {
  test('1. zero validated signals -> score is exactly 0 (never a floor)', () => {
    const opportunities = { actorMessageCount: 40, targetMessageCount: 40, restartOpportunityCount: 10 }
    const result = computeIndividualScore([], 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 5)
    expect(result.score).toBe(0)
    expect(result.confidence).not.toBe('insufficient')
  })

  test('2. opportunity below the judgeable threshold -> score is null (unchanged confidence gate)', () => {
    const result = computeIndividualScore(
      repeat(3, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      { actorMessageCount: 100, targetMessageCount: 1, restartOpportunityCount: 1 },
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    expect(result.score).toBeNull()
    expect(result.confidence).toBe('insufficient')
  })

  test('3. identical input twice -> identical score (deterministic, no randomness anywhere in scoring)', () => {
    const opportunities = { actorMessageCount: 40, targetMessageCount: 40, restartOpportunityCount: 10 }
    const signals = [
      ...repeat(3, () => makeSignal({ signalType: 'follow_up_question' })),
      ...repeat(2, () => makeSignal({ signalType: 'remembers_past_detail' })),
    ]
    const a = computeIndividualScore(signals, 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 5)
    const b = computeIndividualScore(signals, 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 5)
    expect(a).toEqual(b)
  })

  test('4. a single signalType repeated at maximum rate never reaches 90-100 (diversity floor caps it)', () => {
    const opportunities = { actorMessageCount: 40, targetMessageCount: 20, restartOpportunityCount: 10 }
    const signals = repeat(40, () => makeSignal({ signalType: 'follow_up_question' })) // count >> opportunity, rate clamps to 1
    const result = computeIndividualScore(signals, 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 5)
    expect(requireScore(result)).toBeLessThan(90)
  })

  test('5. several distinct signalTypes score higher than one signalType repeated the same total number of times', () => {
    const opportunities = { actorMessageCount: 40, targetMessageCount: 20, restartOpportunityCount: 10 }
    const oneType = repeat(12, () => makeSignal({ signalType: 'follow_up_question' }))
    const fourTypes = [
      ...repeat(3, () => makeSignal({ signalType: 'follow_up_question' })),
      ...repeat(3, () => makeSignal({ signalType: 'remembers_past_detail' })),
      ...repeat(3, () => makeSignal({ signalType: 'checks_on_feelings' })),
      ...repeat(3, () => makeSignal({ signalType: 'specific_interest_expression' })),
    ]
    const single = computeIndividualScore(oneType, 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 5)
    const multi = computeIndividualScore(fourTypes, 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 5)
    expect(requireScore(multi)).toBeGreaterThan(requireScore(single))
  })

  test('6. 3-4 distinct signalTypes at a strong (not saturated-to-1) rate reaches 70-90+, a realistically reachable state', () => {
    const opportunities = { actorMessageCount: 40, targetMessageCount: 20, restartOpportunityCount: 10 }
    const signals = [
      ...repeat(4, () => makeSignal({ signalType: 'follow_up_question' })),
      ...repeat(4, () => makeSignal({ signalType: 'remembers_past_detail' })),
      ...repeat(4, () => makeSignal({ signalType: 'checks_on_feelings' })),
      ...repeat(4, () => makeSignal({ signalType: 'specific_interest_expression' })),
    ] // 16 signals / 20 target messages = 0.8 rate, 4 distinct types
    const result = computeIndividualScore(signals, 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 5)
    expect(requireScore(result)).toBeGreaterThanOrEqual(70)
  })

  test('7. short conversation with exactly one real signal does not score an inflated number', () => {
    const opportunities = { actorMessageCount: 5, targetMessageCount: 5, restartOpportunityCount: 5 }
    const result = computeIndividualScore(
      [makeSignal({ signalType: 'follow_up_question' })],
      'personA',
      opportunities,
      INTEREST_SIGNAL_CONFIG,
      2,
    )
    expect(requireScore(result)).toBeLessThan(40)
  })

  test('8. an unavailable opportunity family (0 opportunity) is excluded from both numerator and denominator, never dragging the score down', () => {
    const withRestartOpportunity = computeIndividualScore(
      repeat(10, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      { actorMessageCount: 100, targetMessageCount: 20, restartOpportunityCount: 10 },
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    const withoutRestartOpportunity = computeIndividualScore(
      repeat(10, () => makeSignal({ signalType: 'follow_up_question' })),
      'personA',
      { actorMessageCount: 100, targetMessageCount: 20, restartOpportunityCount: 0 },
      INTEREST_SIGNAL_CONFIG,
      5,
    )
    expect(requireScore(withoutRestartOpportunity)).toBeGreaterThan(requireScore(withRestartOpportunity))
  })

  test('9. the restart-based family (revives_conversation) and the message-based family never share a denominator — spamming one cannot inflate the other', () => {
    const opportunities = { actorMessageCount: 100, targetMessageCount: 100, restartOpportunityCount: 100 }
    const onlyRevives = repeat(50, () => makeSignal({ signalType: 'revives_conversation' }))
    const result = computeIndividualScore(onlyRevives, 'personA', opportunities, INTEREST_SIGNAL_CONFIG, 5)
    // The message-based family (90/100 of the weight) has zero of its own 6
    // signalTypes present, so it must stay at 0 regardless of how saturated
    // the unrelated restart family is — capping the overall score far below
    // what a genuinely message-family-saturated conversation would reach.
    expect(requireScore(result)).toBeLessThan(15)
  })

  test('10. LLM structured-output schema still has no numeric score/probability field (unaffected by this scoring model revision)', () => {
    // Re-affirms schema.test.ts's existing (more thorough, walks the full
    // zod shape) coverage in this revision's own invariant list per docs
    // decision item 7 #10 — the scoring model change here never touched
    // signals/schema.ts, only how already-extracted signals are aggregated.
    const shape = SignalExtractionResponseSchema.shape
    expect(Object.keys(shape)).toEqual(['relationType', 'signals', 'reciprocityPairs'])
  })
})

describe('Temperature null when one side dominates almost the entire conversation (truly_insufficient trigger)', () => {
  test('one speaker sends nearly all messages -> mutual Interest/Intimacy and Temperature are null, not a distorted low number', () => {
    const codeFeatures = makeCodeFeatures({
      messageCountBySpeaker: { personA: 48, personB: 2 },
      turnInitiationCounts: { personA: 20, personB: 1 },
      questionMessageCountBySpeaker: { personA: 10, personB: 0 },
      planProposalMessageCountBySpeaker: { personA: 0, personB: 0 },
      restartOpportunityCount: 3,
      sessionCount: 1,
    })
    const result = runScoreEngine({ codeFeatures, validatedSignals: [], reciprocityPairs: [] })
    // personB's opportunity as a *target*/*actor* (2 messages) is below
    // MIN_JUDGEABLE_OPPORTUNITY, so personA's Interest-toward-personB and
    // personB's own Interest/Intimacy are null -> combineMutual nulls out
    // mutual Interest/Intimacy -> Temperature drops below its minimum
    // component-weight coverage and is null too (previewSufficiency.js's
    // getPreviewAnalyzability then reports this as 'truly_insufficient').
    expect(result.temperature.score).toBeNull()
    expect(result.temperature.confidence).toBe('insufficient')
  })
})
