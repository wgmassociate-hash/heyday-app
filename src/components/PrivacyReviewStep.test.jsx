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

describe('PrivacyBadge', () => {
  test('shows the compact privacy summary without paid-report copy', () => {
    render(<PrivacyBadge />)
    expect(screen.getByText('🔒 대화 내용은 이렇게 처리해요')).toBeTruthy()
    expect(screen.getByText(/원본 대화 파일·스크린샷은 분석 후 보관하지 않아요/)).toBeTruthy()
    expect(screen.getByText(/분석 전 AI에 전달될 내용을 직접 확인/)).toBeTruthy()
    expect(screen.getByText(/일부 개인정보는 완전히 제거되지 않을 수 있으며/)).toBeTruthy()
    expect(screen.queryByText(/유료 리포트/)).toBeNull()
  })
})
