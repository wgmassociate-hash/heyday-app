// @vitest-environment jsdom
import { describe, expect, test, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import PrivacyReviewStep from './PrivacyReviewStep.jsx'
import PrivacyBadge from './PrivacyBadge.jsx'

afterEach(() => {
  cleanup()
})

const BASE_PREVIEW = {
  anonymizedText: '상대방 : 안녕\n나 : ㅎㅎ 안녕',
  nameMap: { 김민수: '상대방' },
  nameChanges: [['김민수', '상대방']],
  phoneRedacted: true,
  emailRedacted: false,
}

describe('PrivacyReviewStep (Phase 2.1 items 6/7/8)', () => {
  test('shows the anonymization changes and redaction flags', () => {
    render(<PrivacyReviewStep privacyPreview={BASE_PREVIEW} sourceType="text" onConfirm={() => {}} onBack={() => {}} />)
    expect(screen.getByText('김민수')).toBeTruthy()
    expect(screen.getByText('상대방')).toBeTruthy()
    expect(screen.getByText('☎️ 전화번호 가림')).toBeTruthy()
    expect(screen.queryByText('✉️ 이메일 가림')).toBeNull()
  })

  test('shows a preview of the text that will be sent to the AI', () => {
    render(<PrivacyReviewStep privacyPreview={BASE_PREVIEW} sourceType="text" onConfirm={() => {}} onBack={() => {}} />)
    expect(screen.getByText('상대방 : 안녕')).toBeTruthy()
  })

  test('screenshot source shows the OCR-specific privacy sentence, text source does not', () => {
    render(<PrivacyReviewStep privacyPreview={BASE_PREVIEW} sourceType="screenshot" onConfirm={() => {}} onBack={() => {}} />)
    expect(screen.getByText(/캡처 이미지는 문자 추출을 위해/)).toBeTruthy()

    cleanup()
    render(<PrivacyReviewStep privacyPreview={BASE_PREVIEW} sourceType="text" onConfirm={() => {}} onBack={() => {}} />)
    expect(screen.queryByText(/캡처 이미지는 문자 추출을 위해/)).toBeNull()
  })

  test('confirm and back buttons call their handlers', () => {
    const onConfirm = vi.fn()
    const onBack = vi.fn()
    render(<PrivacyReviewStep privacyPreview={BASE_PREVIEW} sourceType="text" onConfirm={onConfirm} onBack={onBack} />)
    fireEvent.click(screen.getByText('이대로 분석 시작'))
    fireEvent.click(screen.getByText('↩ 돌아가서 수정'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('PrivacyBadge sourceType-specific copy (Phase 2.1 item 8)', () => {
  test('screenshot sourceType mentions OCR-specific transmission, not the generic file wording', () => {
    render(<PrivacyBadge sourceType="screenshot" />)
    expect(screen.getByText(/캡처 이미지는 문자 추출을 위해/)).toBeTruthy()
  })

  test('text sourceType uses the generic file wording, not the screenshot-specific one', () => {
    render(<PrivacyBadge sourceType="text" />)
    expect(screen.queryByText(/캡처 이미지는 문자 추출을 위해/)).toBeNull()
    expect(screen.getByText(/업로드한 대화 파일은 분석을 위해/)).toBeTruthy()
  })

  test('always discloses that the AI-bound form can be checked before analysis', () => {
    render(<PrivacyBadge sourceType="text" />)
    expect(screen.getByText(/분석 전에 AI에 전달될 형태를 직접 확인/)).toBeTruthy()
  })
})
