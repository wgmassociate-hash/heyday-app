import { describe, expect, test } from 'vitest'
import { buildPrivacyPreview } from './privacyPreview.js'

const SAMPLE_TEXT = [
  '2024. 6. 1. 오후 3:00, 김민수 : 안녕! 내 번호는 010-1234-5678이야',
  '2024. 6. 1. 오후 3:01, 나 : ㅎㅎ 알겠어',
  '2024. 6. 1. 오후 3:02, 김민수 : 이메일도 보내줄게 abc@example.com',
].join('\n')

describe('buildPrivacyPreview (Phase 2.1 items 6/7/8)', () => {
  test('shows which real name was anonymized and to what label', () => {
    const result = buildPrivacyPreview(SAMPLE_TEXT)
    expect(result.nameChanges).toEqual([['김민수', '상대방']])
    expect(result.anonymizedText).not.toContain('김민수')
    expect(result.anonymizedText).toContain('상대방')
  })

  test('flags phone number redaction and removes the raw number from the AI-bound text', () => {
    const result = buildPrivacyPreview(SAMPLE_TEXT)
    expect(result.phoneRedacted).toBe(true)
    expect(result.anonymizedText).not.toContain('010-1234-5678')
    expect(result.anonymizedText).toContain('[전화번호]')
  })

  test('flags email redaction and removes the raw address from the AI-bound text', () => {
    const result = buildPrivacyPreview(SAMPLE_TEXT)
    expect(result.emailRedacted).toBe(true)
    expect(result.anonymizedText).not.toContain('abc@example.com')
    expect(result.anonymizedText).toContain('[이메일]')
  })

  test('does not flag phone/email redaction when none were present', () => {
    const text = '2024. 6. 1. 오후 3:00, 김민수 : 안녕\n2024. 6. 1. 오후 3:01, 나 : ㅎㅎ 안녕'
    const result = buildPrivacyPreview(text)
    expect(result.phoneRedacted).toBe(false)
    expect(result.emailRedacted).toBe(false)
  })

  test('an already-anonymized conversation reports no further name changes', () => {
    const text = '2024. 6. 1. 오후 3:00, 상대방 : 안녕\n2024. 6. 1. 오후 3:01, 나 : ㅎㅎ 안녕'
    const result = buildPrivacyPreview(text)
    expect(result.nameChanges).toEqual([])
  })
})
