// Phase 2 completion criterion #2 (docs/implementation_plan_v2.md §20):
// "모든 Preview Narrative 문구에 windowLabel(예: '최근 3주')이 실제로 포함됨을
// 스냅샷 테스트로 확인" — this test enumerates every bucket combination
// (including the null/insufficient-data path) and asserts the label survives
// into both narrative strings every time.
import { describe, expect, test } from 'vitest'
import type { ValidatedSignal } from '../signals/types.js'
import type { PreviewScoreResult } from '../pipeline/types.js'
import { buildPreviewNarrative } from './previewNarrative.js'

const WINDOW_LABEL = '최근 3주'

function makeScore(temperature: number | null, romance: number): PreviewScoreResult {
  return {
    recentConversationTemperature: { score: temperature, confidence: temperature === null ? 'insufficient' : 'medium' },
    recentRomanceSignal: { score: romance, positiveCount: 1, ambiguousCount: 0, distancingCount: 0 },
    initiativeRatioPreview: { ratioBySpeaker: { A: 0.5, B: 0.5 } },
    core4Preview: {
      interest: { bySpeaker: {} },
      intimacy: { bySpeaker: {} },
      conversationInitiationRatio: { ratioBySpeaker: { A: 0.5, B: 0.5 } },
      reciprocity: { score: null, confidence: 'insufficient', bySpeaker: {} },
    },
    windowLabel: WINDOW_LABEL,
    confidenceLabel: 'recent_window',
    scoreEngineVersion: 'test',
  }
}

const TOP_SIGNAL: ValidatedSignal = {
  signalType: 'follow_up_question',
  category: 'interest',
  direction: 'positive',
  actorSpeakerId: 'A',
  targetSpeakerId: 'B',
  messageIds: ['msg_1'],
  reason: '상대의 최근 고민에 후속 질문을 던짐',
  chunkId: 'chunk_0',
}

const BUCKET_SAMPLE_SCORES = [10, 50, 90]

describe('buildPreviewNarrative (docs/implementation_plan_v2.md §15.4)', () => {
  test('the insufficient-data path always includes windowLabel', () => {
    const narrative = buildPreviewNarrative(makeScore(null, 50), null)
    expect(narrative.firstVerdict).toContain(WINDOW_LABEL)
    expect(narrative.summaryOneLine).toContain(WINDOW_LABEL)
  })

  for (const temperature of BUCKET_SAMPLE_SCORES) {
    for (const romance of BUCKET_SAMPLE_SCORES) {
      test(`temperature=${temperature}, romance=${romance} includes windowLabel (with and without a topSignal)`, () => {
        const score = makeScore(temperature, romance)

        const withSignal = buildPreviewNarrative(score, TOP_SIGNAL)
        expect(withSignal.firstVerdict).toContain(WINDOW_LABEL)
        expect(withSignal.summaryOneLine).toContain(WINDOW_LABEL)
        expect(withSignal.firstVerdict).toContain(TOP_SIGNAL.reason)

        const withoutSignal = buildPreviewNarrative(score, null)
        expect(withoutSignal.firstVerdict).toContain(WINDOW_LABEL)
        expect(withoutSignal.summaryOneLine).toContain(WINDOW_LABEL)
      })
    }
  }

  test('different temperature/romance buckets produce different firstVerdict copy', () => {
    const low = buildPreviewNarrative(makeScore(10, 10), null)
    const high = buildPreviewNarrative(makeScore(90, 90), null)
    expect(low.firstVerdict).not.toBe(high.firstVerdict)
  })
})
