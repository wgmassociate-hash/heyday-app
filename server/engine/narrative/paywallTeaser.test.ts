import { describe, expect, test } from 'vitest'
import { buildPaywallTeasers } from './paywallTeaser.js'
import type { Core4Result, IndividualScore, RomanceResult } from '../score/types.js'
import type { PreviewScoreResult } from '../pipeline/types.js'

function score(value: number | null, confidence: IndividualScore['confidence'] = 'high'): IndividualScore {
  return { score: value, confidence }
}

function core4(overrides: Partial<Core4Result> = {}): Core4Result {
  return {
    interest: { bySpeaker: { 나: score(50), 상대방: score(50) } },
    intimacy: { bySpeaker: { 나: score(50), 상대방: score(50) } },
    conversationInitiationRatio: { ratioBySpeaker: { 나: 0.5, 상대방: 0.5 } },
    reciprocity: { score: 70, confidence: 'high', bySpeaker: { 나: score(70), 상대방: score(70) } },
    ...overrides,
  }
}

function romance(value: number): RomanceResult {
  return { score: value, positiveCount: 0, ambiguousCount: 0, distancingCount: 0 }
}

function preview(overrides: Partial<PreviewScoreResult> = {}): PreviewScoreResult {
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

describe('buildPaywallTeasers (Phase 2.1 item 5)', () => {
  test('returns between 2 and 3 teasers for a neutral/balanced preview', () => {
    const teasers = buildPaywallTeasers(preview())
    expect(teasers.length).toBeGreaterThanOrEqual(2)
    expect(teasers.length).toBeLessThanOrEqual(3)
  })

  test('surfaces an interest-gap teaser when the two speakers diverge sharply', () => {
    const p = preview({ core4Preview: core4({ interest: { bySpeaker: { 나: score(85), 상대방: score(30) } } }) })
    const teasers = buildPaywallTeasers(p)
    expect(teasers.some((t) => t.question.includes('관심 표현 차이'))).toBe(true)
  })

  test('does not surface the interest-gap teaser when both speakers are close', () => {
    const p = preview({ core4Preview: core4({ interest: { bySpeaker: { 나: score(52), 상대방: score(48) } } }) })
    const teasers = buildPaywallTeasers(p)
    expect(teasers.some((t) => t.question.includes('관심 표현 차이'))).toBe(false)
  })

  test('surfaces a reciprocity teaser when reciprocity is low', () => {
    const p = preview({ core4Preview: core4({ reciprocity: { score: 30, confidence: 'high', bySpeaker: { 나: score(30), 상대방: score(30) } } }) })
    const teasers = buildPaywallTeasers(p)
    expect(teasers.some((t) => t.question.includes('맞춰주고 있는'))).toBe(true)
  })

  test('surfaces a romance/temperature mismatch teaser when romance is present but temperature is low', () => {
    const p = preview({ recentRomanceSignal: romance(65), recentConversationTemperature: score(30) })
    const teasers = buildPaywallTeasers(p)
    expect(teasers.some((t) => t.question.includes('가까워지지 않았을까요'))).toBe(true)
  })

  test('is deterministic and based only on the given Preview metrics (same input -> same output)', () => {
    const p = preview({ core4Preview: core4({ interest: { bySpeaker: { 나: score(90), 상대방: score(20) } } }) })
    expect(buildPaywallTeasers(p)).toEqual(buildPaywallTeasers(p))
  })

  test('never asserts a Paid result as fact — every teaser is phrased as an open question', () => {
    const scenarios = [
      preview({ core4Preview: core4({ interest: { bySpeaker: { 나: score(95), 상대방: score(10) } } }) }),
      preview({ core4Preview: core4({ reciprocity: { score: 10, confidence: 'high', bySpeaker: { 나: score(10), 상대방: score(10) } } }) }),
      preview({ recentRomanceSignal: romance(80), recentConversationTemperature: score(20) }),
      preview(),
    ]
    for (const scenario of scenarios) {
      for (const teaser of buildPaywallTeasers(scenario)) {
        expect(teaser.question.trim().endsWith('?')).toBe(true)
      }
    }
  })
})
