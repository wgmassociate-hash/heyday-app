import { describe, expect, test } from 'vitest'
import { estimateCostUsd } from './pricing.js'

describe('estimateCostUsd (Phase 0 usage logging)', () => {
  test('computes cost for a known model from its public per-token rate', () => {
    const cost = estimateCostUsd('claude-sonnet-4-6', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(3 + 15, 6)
  })

  test('computes cost for the OCR model', () => {
    const cost = estimateCostUsd('claude-haiku-4-5', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(1 + 5, 6)
  })

  test('returns 0 for an unpriced model rather than guessing', () => {
    expect(estimateCostUsd('some-future-model', 1_000_000, 1_000_000)).toBe(0)
  })

  test('scales linearly with token counts', () => {
    const half = estimateCostUsd('claude-sonnet-4-6', 500_000, 0)
    const full = estimateCostUsd('claude-sonnet-4-6', 1_000_000, 0)
    expect(full).toBeCloseTo(half * 2, 6)
  })
})
