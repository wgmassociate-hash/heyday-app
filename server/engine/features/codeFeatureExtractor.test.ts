// Phase 1 — Code Feature Extractor unit tests (docs/implementation_plan_v2.md §8.2).
import { describe, expect, test } from 'vitest'
import type { EnrichedMessage } from '../messageModel/types.js'
import { computeOpportunities, extractCodeFeatures } from './codeFeatureExtractor.js'

function msg(overrides: Partial<EnrichedMessage> & Pick<EnrichedMessage, 'id' | 'speakerId' | 'text'>): EnrichedMessage {
  return {
    timestamp: null,
    date: null,
    sourceType: 'txt',
    ...overrides,
  }
}

describe('extractCodeFeatures', () => {
  test('counts messages, emoji ratio, and question-like messages per speaker', () => {
    const messages: EnrichedMessage[] = [
      msg({ id: 'm0', speakerId: 'A', text: '안녕 😊', isConversationStart: true }),
      msg({ id: 'm1', speakerId: 'B', text: '뭐해?' }),
      msg({ id: 'm2', speakerId: 'A', text: '그냥 있어' }),
      msg({ id: 'm3', speakerId: 'B', text: '오 진짜? 나도야' }),
    ]
    const features = extractCodeFeatures(messages)

    expect(features.speakerIds).toEqual(['A', 'B'])
    expect(features.messageCountBySpeaker).toEqual({ A: 2, B: 2 })
    expect(features.emojiRatioBySpeaker.A).toBeCloseTo(0.5)
    expect(features.emojiRatioBySpeaker.B).toBe(0)
    expect(features.questionMessageCountBySpeaker).toEqual({ A: 0, B: 2 })
  })

  test('turnInitiationCounts credits both conversation-start and conversation-restart messages', () => {
    const messages: EnrichedMessage[] = [
      msg({ id: 'm0', speakerId: 'A', text: 'hi', isConversationStart: true }),
      msg({ id: 'm1', speakerId: 'B', text: 'hello' }),
      msg({ id: 'm2', speakerId: 'A', text: 'back after a while', isConversationRestart: true }),
    ]
    const features = extractCodeFeatures(messages)
    expect(features.turnInitiationCounts).toEqual({ A: 2, B: 0 })
  })

  test('restartOpportunityCount excludes the very first message even if flagged as a start', () => {
    const messages: EnrichedMessage[] = [
      msg({ id: 'm0', speakerId: 'A', text: 'hi', isConversationStart: true }),
      msg({ id: 'm1', speakerId: 'B', text: 'restart after a gap', isConversationRestart: true }),
    ]
    const features = extractCodeFeatures(messages)
    expect(features.restartOpportunityCount).toBe(1)
  })

  test('sessionCount reflects the number of distinct sessionIds present', () => {
    const messages: EnrichedMessage[] = [
      msg({ id: 'm0', speakerId: 'A', text: 'hi', sessionId: 'session_0' }),
      msg({ id: 'm1', speakerId: 'B', text: 'hi', sessionId: 'session_0' }),
      msg({ id: 'm2', speakerId: 'A', text: 'later', sessionId: 'session_1' }),
    ]
    expect(extractCodeFeatures(messages).sessionCount).toBe(2)
  })

  test('computeOpportunities reads message counts symmetrically for either direction', () => {
    const messages: EnrichedMessage[] = [
      msg({ id: 'm0', speakerId: 'A', text: 'q1?' }),
      msg({ id: 'm1', speakerId: 'A', text: 'q2?' }),
      msg({ id: 'm2', speakerId: 'B', text: 'a1' }),
    ]
    const features = extractCodeFeatures(messages)
    const aTowardB = computeOpportunities(features, 'A', 'B')
    const bTowardA = computeOpportunities(features, 'B', 'A')

    expect(aTowardB.actorMessageCount).toBe(2)
    expect(aTowardB.targetMessageCount).toBe(1)
    expect(bTowardA.actorMessageCount).toBe(1)
    expect(bTowardA.targetMessageCount).toBe(2)
    // Phase 1.1: OpportunityCounts no longer carries pairOpportunityCount —
    // Reciprocity computes its own per-pairType opportunity (score/reciprocity.ts).
    expect(aTowardB).not.toHaveProperty('pairOpportunityCount')
  })

  test('planProposalMessageCountBySpeaker counts plan/meetup-proposal-like messages', () => {
    const messages: EnrichedMessage[] = [
      msg({ id: 'm0', speakerId: 'A', text: '오늘 저녁에 만나자!' }),
      msg({ id: 'm1', speakerId: 'B', text: '좋아 몇 시에 볼래?' }),
      msg({ id: 'm2', speakerId: 'A', text: '그냥 일상 얘기' }),
    ]
    const features = extractCodeFeatures(messages)
    expect(features.planProposalMessageCountBySpeaker.A).toBe(1)
    expect(features.planProposalMessageCountBySpeaker.B).toBe(1)
  })

  test('turnAlternationRate is 1.0 for perfectly alternating speakers', () => {
    const messages: EnrichedMessage[] = [
      msg({ id: 'm0', speakerId: 'A', text: 'a' }),
      msg({ id: 'm1', speakerId: 'B', text: 'b' }),
      msg({ id: 'm2', speakerId: 'A', text: 'a' }),
      msg({ id: 'm3', speakerId: 'B', text: 'b' }),
    ]
    expect(extractCodeFeatures(messages).turnAlternationRate).toBe(1)
  })

  test('turnAlternationRate is 0 when one speaker sends every message in one block', () => {
    const messages: EnrichedMessage[] = [
      msg({ id: 'm0', speakerId: 'A', text: 'a1' }),
      msg({ id: 'm1', speakerId: 'A', text: 'a2' }),
      msg({ id: 'm2', speakerId: 'A', text: 'a3' }),
    ]
    expect(extractCodeFeatures(messages).turnAlternationRate).toBe(0)
  })

  test('turnAlternationRate does not change just because the same pattern repeats over a longer conversation', () => {
    const short: EnrichedMessage[] = Array.from({ length: 10 }, (_, i) =>
      msg({ id: `m${i}`, speakerId: i % 2 === 0 ? 'A' : 'B', text: 'x' }),
    )
    const long: EnrichedMessage[] = Array.from({ length: 200 }, (_, i) =>
      msg({ id: `m${i}`, speakerId: i % 2 === 0 ? 'A' : 'B', text: 'x' }),
    )
    expect(extractCodeFeatures(short).turnAlternationRate).toBe(extractCodeFeatures(long).turnAlternationRate)
  })
})
