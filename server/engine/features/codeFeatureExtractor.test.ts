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
    // B's opportunity to reciprocate is driven by A's question-like messages.
    expect(bTowardA.pairOpportunityCount).toBe(2)
    expect(aTowardB.pairOpportunityCount).toBe(0)
  })
})
