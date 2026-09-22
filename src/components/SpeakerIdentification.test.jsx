// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import InputStep from './InputStep.jsx'
import SelfSpeakerPick from './SelfSpeakerPick.jsx'

afterEach(cleanup)

describe('speaker identification UI', () => {
  test('shows only the two real names for the production HH:MM format', () => {
    const chatText = [
      '21:35 신정근 어디냐?',
      '21:37 전찬형 집에서 씻으려고',
      '00:27 전찬형 우울해서',
    ].join('\n')

    render(<SelfSpeakerPick chatText={chatText} onAssign={vi.fn()} />)

    expect(screen.getByRole('button', { name: '신정근' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '전찬형' })).toBeTruthy()
    for (const invalid of ['21', '00', '01', '10']) {
      expect(screen.queryByRole('button', { name: invalid })).toBeNull()
    }
  })

  test('shows a clear fallback and blocks analysis when two speakers are not recognized', () => {
    const chatText = '21: 잘못된 후보\n00: 잘못된 후보\n01: 잘못된 후보'
    render(
      <InputStep
        chatText={chatText}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        isValid
        quota={null}
        onQuotaUpdate={vi.fn()}
        sourceType="text"
        onSourceTypeChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain('대화 상대를 정확히 인식하지 못했어요.')
    expect(screen.getByRole('button', { name: '입력 형식을 다시 확인해줘' }).disabled).toBe(true)
  })
})
