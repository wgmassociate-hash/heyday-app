import { describe, expect, test } from 'vitest'
import { determineAnalysisMode } from './analysisMode.js'

describe('determineAnalysisMode (docs/prd_v2.md §15)', () => {
  test('short conversation is snapshot', () => {
    expect(determineAnalysisMode({ messageCount: 30, spanDays: 1, sessionCount: 1 })).toBe('snapshot')
  })

  test('medium conversation with multiple sessions is standard', () => {
    expect(determineAnalysisMode({ messageCount: 150, spanDays: 5, sessionCount: 2 })).toBe('standard')
  })

  test('long conversation without enough span stays standard, not deep', () => {
    expect(determineAnalysisMode({ messageCount: 400, spanDays: 3, sessionCount: 5 })).toBe('standard')
  })

  test('long conversation with only one session falls all the way to snapshot (standard also needs "여러 Session")', () => {
    expect(determineAnalysisMode({ messageCount: 400, spanDays: 20, sessionCount: 1 })).toBe('snapshot')
  })

  test('long, wide-spanning, multi-session conversation is deep', () => {
    expect(determineAnalysisMode({ messageCount: 400, spanDays: 20, sessionCount: 3 })).toBe('deep')
  })

  test('many messages but only one session is still just standard (needs "여러 Session")', () => {
    expect(determineAnalysisMode({ messageCount: 90, spanDays: 10, sessionCount: 1 })).toBe('snapshot')
  })
})
