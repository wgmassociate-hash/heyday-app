import { describe, expect, test } from 'vitest'
import { anonymizeChatText } from './parseChat.js'
import { scrubResultNames } from './scrubResult.js'
import { redactContactInfo } from './privacyRedaction.js'

/**
 * Regression test for the exact redaction pipeline analyzeChat() (Phase 0,
 * docs/implementation_plan_v2.md §6.2/§6.3) applies before a network request
 * is ever made — without needing to mock fetch. This is the gap
 * analysis_v1.md §4.3-3 flagged: 1.0 only anonymized the leading
 * "speaker :" position, leaving real names inside message bodies untouched.
 */
describe('pre-request redaction pipeline (Phase 0)', () => {
  test('redacts real names mentioned inside message bodies, not just the speaker line', () => {
    // "나" already present as one speaker (the common real-world shape once
    // the user has been through SelfSpeakerPick, or a kakao export that
    // already uses the device owner's own label) — the other party's real
    // name should be scrubbed everywhere, including inside message bodies.
    const raw = [
      '2024년 6월 20일 오후 9:30, 박지호 : 야 ㅋㅋ 오늘 솔랭 ㄱㄱ?',
      '2024년 6월 20일 오후 9:31, 나 : ㅇㅋ 근데 박지호가 어제 그랬잖아',
    ].join('\n')

    const { anonymizedText, nameMap } = anonymizeChatText(raw)
    const redacted = redactContactInfo(scrubResultNames(anonymizedText, nameMap))

    expect(redacted).not.toContain('박지호')
    expect(redacted).toContain('나')
    expect(redacted).toContain('상대방')
  })

  test('also strips a phone number/email that leaked into a message body', () => {
    const raw = [
      '2024년 6월 20일 오후 9:30, 김민준 : 010-1234-5678로 연락해',
      '2024년 6월 20일 오후 9:31, 박지호 : ㅇㅋ jun@example.com 으로도 보낼게',
    ].join('\n')

    const { anonymizedText, nameMap } = anonymizeChatText(raw)
    const redacted = redactContactInfo(scrubResultNames(anonymizedText, nameMap))

    expect(redacted).not.toMatch(/010-1234-5678/)
    expect(redacted).not.toMatch(/jun@example\.com/)
    expect(redacted).toContain('[전화번호]')
    expect(redacted).toContain('[이메일]')
  })
})
