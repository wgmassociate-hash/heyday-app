import { describe, expect, test } from 'vitest'
import { getPreviewAnalyzability, isPreviewLowSufficiency } from './previewSufficiency.js'

function score(value, confidence) {
  return { score: value, confidence }
}

function buildPreview(overrides = {}) {
  const core4 = {
    interest: { bySpeaker: { 나: score(70, 'high'), 상대방: score(65, 'high') } },
    intimacy: { bySpeaker: { 나: score(60, 'high'), 상대방: score(55, 'high') } },
    reciprocity: { score: 70, confidence: 'high', bySpeaker: {} },
    ...overrides.core4,
  }
  return {
    recentConversationTemperature: score(65, 'high'),
    core4Preview: core4,
    ...overrides.preview,
  }
}

describe('getPreviewAnalyzability (Phase 2.2 item 2)', () => {
  test('temperature score === null -> truly_insufficient, regardless of Core4 confidences', () => {
    const preview = buildPreview({ preview: { recentConversationTemperature: score(null, 'insufficient') } })
    expect(getPreviewAnalyzability(preview)).toBe('truly_insufficient')
  })

  test('temperature computed, but most Core4 metrics are low/insufficient -> limited_but_analyzable', () => {
    const preview = buildPreview({
      preview: { recentConversationTemperature: score(19, 'low') },
      core4: {
        interest: { bySpeaker: { 나: score(9, 'low'), 상대방: score(7, 'low') } },
        intimacy: { bySpeaker: { 나: score(6, 'low'), 상대방: score(null, 'insufficient') } },
        reciprocity: { score: 0, confidence: 'low', bySpeaker: {} },
      },
    })
    expect(getPreviewAnalyzability(preview)).toBe('limited_but_analyzable')
  })

  test('temperature computed and most Core4 metrics are medium/high -> normal', () => {
    const preview = buildPreview()
    expect(getPreviewAnalyzability(preview)).toBe('normal')
  })
})

describe('isPreviewLowSufficiency (Phase 2.1, unchanged)', () => {
  test('mostly weak confidences -> true', () => {
    const preview = buildPreview({
      core4: {
        interest: { bySpeaker: { 나: score(9, 'low'), 상대방: score(null, 'insufficient') } },
        intimacy: { bySpeaker: { 나: score(6, 'low'), 상대방: score(6, 'low') } },
        reciprocity: { score: 0, confidence: 'low', bySpeaker: {} },
      },
    })
    expect(isPreviewLowSufficiency(preview)).toBe(true)
  })

  test('mostly strong confidences -> false', () => {
    expect(isPreviewLowSufficiency(buildPreview())).toBe(false)
  })
})
