// Phase 2.3 — unit tests for the pooled density + diversity primitives
// themselves (core4.ts's tests cover the integrated Interest/Intimacy
// behavior; these isolate diversityMultiplier/computePooledDensityScore).
import { describe, expect, test } from 'vitest'
import { computePooledDensityScore, DIVERSITY_CAP, DIVERSITY_FLOOR, diversityMultiplier } from './pooledSignalScore.js'

describe('diversityMultiplier', () => {
  test('0 distinct types -> DIVERSITY_FLOOR (density is already 0 at count=0 regardless)', () => {
    expect(diversityMultiplier(0)).toBeCloseTo(DIVERSITY_FLOOR, 6)
  })

  test('1 distinct type -> above the floor but well under 1.0', () => {
    const m = diversityMultiplier(1)
    expect(m).toBeGreaterThan(DIVERSITY_FLOOR)
    expect(m).toBeLessThan(1)
  })

  test('DIVERSITY_CAP or more distinct types -> exactly 1.0 (no further diversity bonus)', () => {
    expect(diversityMultiplier(DIVERSITY_CAP)).toBeCloseTo(1, 6)
    expect(diversityMultiplier(DIVERSITY_CAP + 5)).toBeCloseTo(1, 6)
  })

  test('monotonically increasing in distinct type count', () => {
    const values = Array.from({ length: DIVERSITY_CAP + 1 }, (_, i) => diversityMultiplier(i))
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
  })
})

describe('computePooledDensityScore', () => {
  test('count=0 -> 0 regardless of diversity flag', () => {
    expect(computePooledDensityScore(0, 0, 100, true)).toBe(0)
    expect(computePooledDensityScore(0, 0, 100, false)).toBe(0)
  })

  test('rate=1 (count===opportunity), single distinct type, diversity applied -> capped at 100*diversityMultiplier(1), well under 100*DIVERSITY_FLOOR + 100*(1-DIVERSITY_FLOOR) i.e. under full', () => {
    const score = computePooledDensityScore(10, 1, 10, true)
    expect(score).toBeCloseTo(100 * diversityMultiplier(1), 6)
    expect(score).toBeLessThan(90)
  })

  test('rate=1, diversity NOT applied (single-signalType family) -> full 100, no floor cap', () => {
    const score = computePooledDensityScore(10, 1, 10, false)
    expect(score).toBeCloseTo(100, 6)
  })

  test('same rate, more distinct types (still applying diversity) -> strictly higher score', () => {
    const fewTypes = computePooledDensityScore(10, 1, 20, true)
    const manyTypes = computePooledDensityScore(10, 4, 20, true)
    expect(manyTypes).toBeGreaterThan(fewTypes)
  })

  test('opportunity=0 does not throw (guarded by rateFor, not this function\'s job to exclude — callers exclude 0-opportunity families before calling)', () => {
    expect(() => computePooledDensityScore(5, 1, 0, true)).not.toThrow()
  })
})
