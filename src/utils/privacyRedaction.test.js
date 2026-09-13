import { describe, expect, test } from 'vitest'
import { redactContactInfo } from './privacyRedaction.js'

describe('redactContactInfo (Phase 0)', () => {
  test('redacts a standard Korean mobile number', () => {
    expect(redactContactInfo('연락처는 010-1234-5678 이야')).toBe('연락처는 [전화번호] 이야')
  })

  test('redacts a mobile number without dashes', () => {
    expect(redactContactInfo('01012345678로 전화해')).toBe('[전화번호]로 전화해')
  })

  test('redacts an email address', () => {
    expect(redactContactInfo('메일은 jun.dev@example.co.kr 로 보내줘')).toBe(
      '메일은 [이메일] 로 보내줘',
    )
  })

  test('redacts both phone and email in the same message', () => {
    expect(redactContactInfo('010-1111-2222 이나 a@b.com 으로 연락줘')).toBe(
      '[전화번호] 이나 [이메일] 으로 연락줘',
    )
  })

  test('leaves ordinary Korean chat text untouched', () => {
    const text = '나 : 오늘 뭐해?\n상대방 : 그냥 집 ㅎㅎ'
    expect(redactContactInfo(text)).toBe(text)
  })

  test('is a no-op on non-string input', () => {
    expect(redactContactInfo(null)).toBe(null)
    expect(redactContactInfo(undefined)).toBe(undefined)
  })
})
