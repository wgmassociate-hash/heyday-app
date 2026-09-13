// Phase 1.2 — Calibration Scenario Fixtures (audit item #6).
//
// scoreEngine.invariant.test.ts checks mathematical properties in isolation
// (saturation shape, floor removal, null propagation). This file instead
// builds five whole synthetic *relationships* and checks that the engine's
// output is ordered the way a person would expect it to be — never an exact
// hard-coded score, since the weights themselves are unvalidated heuristics
// (weights.ts's header comment). Over-fitting to specific numbers here would
// just lock in today's arbitrary weights as if they were correct.
import { describe, expect, test } from 'vitest'
import type { CodeFeatures } from '../features/types.js'
import type { ReciprocityPairType, ValidatedReciprocityPair } from '../signals/reciprocityTypes.js'
import type { SignalCategory, SignalDirection, ValidatedSignal } from '../signals/types.js'
import { runScoreEngine } from './scoreEngine.js'
import type { CoreScoreResult, IndividualScore } from './types.js'

function requireScore(metric: IndividualScore): number {
  if (metric.score === null) throw new Error(`expected a judgeable score, got null (confidence: ${metric.confidence})`)
  return metric.score
}

function baseCodeFeatures(overrides: Partial<CodeFeatures> = {}): CodeFeatures {
  return {
    speakerIds: ['personA', 'personB'],
    messageCountBySpeaker: { personA: 100, personB: 100 },
    turnInitiationCounts: { personA: 10, personB: 10 },
    replyGapStatsBySpeaker: {
      personA: { avgMinutes: 8, sampleCount: 20 },
      personB: { avgMinutes: 8, sampleCount: 20 },
    },
    emojiRatioBySpeaker: { personA: 0.1, personB: 0.1 },
    questionMessageCountBySpeaker: { personA: 20, personB: 20 },
    planProposalMessageCountBySpeaker: { personA: 8, personB: 8 },
    turnAlternationRate: 0.5,
    topicHits: [],
    sessionCount: 5,
    restartOpportunityCount: 12,
    ...overrides,
  }
}

let signalSeq = 0
function signal(
  signalType: string,
  category: SignalCategory,
  actorSpeakerId: string,
  targetSpeakerId = '',
  direction: SignalDirection = 'positive',
): ValidatedSignal {
  signalSeq += 1
  return {
    signalType,
    category,
    direction,
    actorSpeakerId,
    targetSpeakerId,
    messageIds: [`msg_${signalSeq}`],
    reason: 'scenario fixture',
    chunkId: 'chunk_0',
  }
}

let pairSeq = 0
function pair(
  pairType: ReciprocityPairType,
  initiatorSpeakerId: string,
  responderSpeakerId: string,
): ValidatedReciprocityPair {
  pairSeq += 1
  return {
    pairType,
    initiatorSpeakerId,
    responderSpeakerId,
    triggerMessageIds: [`trig_${pairSeq}`],
    responseMessageIds: [`resp_${pairSeq}`],
    reason: 'scenario fixture',
    chunkId: 'chunk_0',
  }
}

function repeat<T>(n: number, factory: () => T): T[] {
  return Array.from({ length: n }, () => factory())
}

// ---------------------------------------------------------------------------
// Scenario A — both sides mutually active: interest, self-disclosure, and
// reciprocated exchanges in both directions.
// ---------------------------------------------------------------------------
function scenarioA(): CoreScoreResult {
  const codeFeatures = baseCodeFeatures({
    messageCountBySpeaker: { personA: 180, personB: 170 },
    turnInitiationCounts: { personA: 11, personB: 9 },
    questionMessageCountBySpeaker: { personA: 30, personB: 28 },
    planProposalMessageCountBySpeaker: { personA: 10, personB: 9 },
    turnAlternationRate: 0.8,
    sessionCount: 8,
  })
  const validatedSignals: ValidatedSignal[] = [
    ...repeat(8, () => signal('follow_up_question', 'interest', 'personA', 'personB')),
    ...repeat(8, () => signal('follow_up_question', 'interest', 'personB', 'personA')),
    ...repeat(5, () => signal('remembers_past_detail', 'interest', 'personA', 'personB')),
    ...repeat(5, () => signal('remembers_past_detail', 'interest', 'personB', 'personA')),
    ...repeat(6, () => signal('self_disclosure', 'intimacy', 'personA')),
    ...repeat(6, () => signal('self_disclosure', 'intimacy', 'personB')),
    ...repeat(4, () => signal('vulnerable_emotion_share', 'intimacy', 'personA')),
    ...repeat(4, () => signal('vulnerable_emotion_share', 'intimacy', 'personB')),
  ]
  const reciprocityPairs: ValidatedReciprocityPair[] = [
    ...repeat(6, () => pair('question_response', 'personB', 'personA')),
    ...repeat(6, () => pair('question_response', 'personA', 'personB')),
    ...repeat(4, () => pair('mutual_disclosure', 'personB', 'personA')),
    ...repeat(4, () => pair('mutual_disclosure', 'personA', 'personB')),
    ...repeat(3, () => pair('emotional_empathy', 'personB', 'personA')),
    ...repeat(3, () => pair('emotional_empathy', 'personA', 'personB')),
  ]
  return runScoreEngine({ codeFeatures, validatedSignals, reciprocityPairs })
}

// ---------------------------------------------------------------------------
// Scenario B — one-sided: A reaches out a lot, B responds minimally.
// ---------------------------------------------------------------------------
function scenarioB(): CoreScoreResult {
  const codeFeatures = baseCodeFeatures({
    messageCountBySpeaker: { personA: 160, personB: 60 },
    turnInitiationCounts: { personA: 18, personB: 2 },
    // personB's opportunity numbers are kept well above
    // MIN_JUDGEABLE_OPPORTUNITY (so "A responds to B" is judgeable, not
    // insufficient) while the actual reciprocityPairs count below stays low
    // — opportunity and evidence are independent, and this scenario is
    // about low evidence relative to real opportunity, not "no data".
    questionMessageCountBySpeaker: { personA: 30, personB: 20 },
    planProposalMessageCountBySpeaker: { personA: 10, personB: 8 },
    turnAlternationRate: 0.2,
    sessionCount: 4,
  })
  const validatedSignals: ValidatedSignal[] = [
    ...repeat(10, () => signal('follow_up_question', 'interest', 'personA', 'personB')),
    ...repeat(8, () => signal('checks_on_feelings', 'interest', 'personA', 'personB')),
    ...repeat(6, () => signal('self_disclosure', 'intimacy', 'personA')),
    // personB barely reciprocates in kind, but produces just enough of its
    // own trigger-type behavior to make "A responds to B" judgeable at all.
    ...repeat(1, () => signal('self_disclosure', 'intimacy', 'personB')),
    ...repeat(2, () => signal('vulnerable_emotion_share', 'intimacy', 'personB')),
  ]
  const reciprocityPairs: ValidatedReciprocityPair[] = [
    // personB responds to only a couple of personA's many triggers.
    ...repeat(2, () => pair('question_response', 'personA', 'personB')),
    // personA still responds attentively to the few things personB does say.
    ...repeat(2, () => pair('question_response', 'personB', 'personA')),
  ]
  return runScoreEngine({ codeFeatures, validatedSignals, reciprocityPairs })
}

// ---------------------------------------------------------------------------
// Scenario C — close friendship: high intimacy/reciprocity, but no romance
// signals at all.
// ---------------------------------------------------------------------------
function scenarioC(): CoreScoreResult {
  // Kept deliberately smaller than A/B's message counts: Interest's
  // opportunity denominator is the *other side's* total message count, so a
  // fixed number of interest signals saturates faster in a more modest-sized
  // conversation — this is length-invariance (score/mathUtils.ts) working as
  // intended, not a special case for this fixture.
  const codeFeatures = baseCodeFeatures({
    messageCountBySpeaker: { personA: 70, personB: 65 },
    turnInitiationCounts: { personA: 10, personB: 10 },
    questionMessageCountBySpeaker: { personA: 32, personB: 30 },
    planProposalMessageCountBySpeaker: { personA: 12, personB: 12 },
    turnAlternationRate: 0.85,
    sessionCount: 10,
  })
  // Covers every Interest/Intimacy signalType (not just a couple) with
  // counts large enough, relative to their opportunity denominators, to
  // approach saturation — a fixture using only 2-3 of the 7/6 available
  // signalTypes leaves most of the weight table at a permanent 0 contribution
  // no matter how "close" the friendship is, which understates a real dataset.
  const validatedSignals: ValidatedSignal[] = [
    ...repeat(40, () => signal('follow_up_question', 'interest', 'personA', 'personB')),
    ...repeat(40, () => signal('follow_up_question', 'interest', 'personB', 'personA')),
    ...repeat(35, () => signal('remembers_past_detail', 'interest', 'personA', 'personB')),
    ...repeat(35, () => signal('remembers_past_detail', 'interest', 'personB', 'personA')),
    ...repeat(30, () => signal('checks_on_feelings', 'interest', 'personA', 'personB')),
    ...repeat(30, () => signal('checks_on_feelings', 'interest', 'personB', 'personA')),
    ...repeat(30, () => signal('expands_topic', 'interest', 'personA', 'personB')),
    ...repeat(30, () => signal('expands_topic', 'interest', 'personB', 'personA')),
    ...repeat(8, () => signal('revives_conversation', 'interest', 'personA', 'personB')),
    ...repeat(8, () => signal('revives_conversation', 'interest', 'personB', 'personA')),
    ...repeat(25, () => signal('specific_interest_expression', 'interest', 'personA', 'personB')),
    ...repeat(25, () => signal('specific_interest_expression', 'interest', 'personB', 'personA')),
    ...repeat(15, () => signal('follows_up_on_plan', 'interest', 'personA', 'personB')),
    ...repeat(15, () => signal('follows_up_on_plan', 'interest', 'personB', 'personA')),
    ...repeat(40, () => signal('self_disclosure', 'intimacy', 'personA')),
    ...repeat(40, () => signal('self_disclosure', 'intimacy', 'personB')),
    ...repeat(30, () => signal('vulnerable_emotion_share', 'intimacy', 'personA')),
    ...repeat(30, () => signal('vulnerable_emotion_share', 'intimacy', 'personB')),
    ...repeat(25, () => signal('daily_life_share', 'intimacy', 'personA')),
    ...repeat(25, () => signal('daily_life_share', 'intimacy', 'personB')),
    ...repeat(35, () => signal('shared_context_reference', 'intimacy', 'personA')),
    ...repeat(35, () => signal('shared_context_reference', 'intimacy', 'personB')),
    ...repeat(20, () => signal('playful_teasing_or_nickname', 'intimacy', 'personA')),
    ...repeat(20, () => signal('playful_teasing_or_nickname', 'intimacy', 'personB')),
    ...repeat(25, () => signal('includes_partner_in_future', 'intimacy', 'personA')),
    ...repeat(25, () => signal('includes_partner_in_future', 'intimacy', 'personB')),
    // No `category: 'romance'` signals anywhere in this fixture.
  ]
  const reciprocityPairs: ValidatedReciprocityPair[] = [
    ...repeat(15, () => pair('question_response', 'personB', 'personA')),
    ...repeat(15, () => pair('question_response', 'personA', 'personB')),
    ...repeat(12, () => pair('mutual_disclosure', 'personB', 'personA')),
    ...repeat(12, () => pair('mutual_disclosure', 'personA', 'personB')),
  ]
  return runScoreEngine({ codeFeatures, validatedSignals, reciprocityPairs })
}

// ---------------------------------------------------------------------------
// Scenario D — extremely sparse conversation: too little data to judge.
// ---------------------------------------------------------------------------
function scenarioD(): CoreScoreResult {
  const codeFeatures = baseCodeFeatures({
    messageCountBySpeaker: { personA: 2, personB: 2 },
    turnInitiationCounts: { personA: 1, personB: 1 },
    questionMessageCountBySpeaker: { personA: 0, personB: 0 },
    planProposalMessageCountBySpeaker: { personA: 0, personB: 0 },
    restartOpportunityCount: 1,
    sessionCount: 1,
  })
  return runScoreEngine({ codeFeatures, validatedSignals: [], reciprocityPairs: [] })
}

// ---------------------------------------------------------------------------
// Scenario E — plenty of opportunity, but almost no interest/reciprocity was
// ever observed. A real, well-supported low score — not a data gap.
// ---------------------------------------------------------------------------
function scenarioE(): CoreScoreResult {
  const codeFeatures = baseCodeFeatures({
    messageCountBySpeaker: { personA: 200, personB: 200 },
    questionMessageCountBySpeaker: { personA: 25, personB: 25 },
    planProposalMessageCountBySpeaker: { personA: 10, personB: 10 },
    sessionCount: 6,
  })
  return runScoreEngine({ codeFeatures, validatedSignals: [], reciprocityPairs: [] })
}

describe('Calibration Scenario Fixtures (ordinal checks, no hard-coded scores)', () => {
  test('A (mutual, active relationship) has higher Reciprocity than B (one-sided)', () => {
    const a = scenarioA()
    const b = scenarioB()
    expect(requireScore(a.core4.reciprocity)).toBeGreaterThan(requireScore(b.core4.reciprocity))
  })

  test('A has higher Relationship Temperature than B', () => {
    const a = scenarioA()
    const b = scenarioB()
    expect(requireScore(a.temperature)).toBeGreaterThan(requireScore(b.temperature))
  })

  test('D (very sparse data) is insufficient, not a low score', () => {
    const d = scenarioD()
    expect(d.temperature.score).toBeNull()
    expect(d.temperature.confidence).toBe('insufficient')
  })

  test('E (ample opportunity, near-zero observed behavior) is a real low score with sufficient confidence, not insufficient', () => {
    const e = scenarioE()
    expect(e.temperature.score).not.toBeNull()
    expect(e.temperature.confidence).not.toBe('insufficient')
    // Real "low", not merely "not null" — sanity bound so this doesn't
    // silently start passing if scoring logic regresses toward a high value.
    expect(requireScore(e.temperature)).toBeLessThan(40)
  })

  test('C (high-temperature friendship) has Temperature and Romantic Signal moving independently: high Temperature does not imply high Romance', () => {
    const c = scenarioC()
    expect(requireScore(c.temperature)).toBeGreaterThan(50)
    expect(c.romance.score).toBe(0)
  })

  test('D and E are both judgement-relevant but distinct: D cannot be scored, E can and is low', () => {
    const d = scenarioD()
    const e = scenarioE()
    expect(d.temperature.score).toBeNull()
    expect(e.temperature.score).not.toBeNull()
  })
})
