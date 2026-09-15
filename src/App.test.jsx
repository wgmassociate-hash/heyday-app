// @vitest-environment jsdom
//
// Phase 2.1 — Privacy Review gating (Product UX Calibration item 11: "Privacy
// Review를 확인해야 Preview 분석 진행"). Mocks previewApi.analyzePreview and
// quotaApi.fetchQuota (network) to drive the flow purely through the UI:
// Intent -> Input -> submit -> must land on Privacy Review, NOT Loading, and
// must NOT have called analyzePreview yet -> only after confirming there does
// the analysis call happen.
import { describe, expect, test, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import App from './App.jsx'

vi.mock('./utils/quotaApi.js', () => ({
  fetchQuota: vi.fn(async () => null),
}))

vi.mock('./utils/previewApi.js', () => ({
  analyzePreview: vi.fn(async () => ({
    preview: {
      recentConversationTemperature: { score: 60, confidence: 'high' },
      recentRomanceSignal: { score: 30, positiveCount: 0, ambiguousCount: 0, distancingCount: 0 },
      initiativeRatioPreview: { ratioBySpeaker: { 나: 0.5, 상대방: 0.5 } },
      core4Preview: {
        interest: { bySpeaker: { 나: { score: 60, confidence: 'high' }, 상대방: { score: 60, confidence: 'high' } } },
        intimacy: { bySpeaker: { 나: { score: 60, confidence: 'high' }, 상대방: { score: 60, confidence: 'high' } } },
        conversationInitiationRatio: { ratioBySpeaker: { 나: 0.5, 상대방: 0.5 } },
        reciprocity: { score: 60, confidence: 'high', bySpeaker: {} },
      },
      windowMessageCount: 4,
      recentRelationshipPosition: { label: 'still_forming' },
      windowLabel: '최근 대화',
      confidenceLabel: 'recent_window',
      scoreEngineVersion: 'test',
    },
    narrative: { firstVerdict: '테스트 판정', summaryOneLine: '요약' },
    topSignal: null,
    paywallTeasers: [],
    quota: null,
  })),
}))

import { analyzePreview } from './utils/previewApi.js'

window.scrollTo = vi.fn()

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const CHAT_TEXT = '2024. 6. 1. 오후 3:00, 상대방 : 안녕\n2024. 6. 1. 오후 3:01, 나 : ㅎㅎ 안녕\n2024. 6. 1. 오후 3:02, 상대방 : 뭐해'

async function fillChatText(container) {
  // Switch to the manual-paste tab so a plain <textarea> is available.
  fireEvent.click(screen.getByRole('tab', { name: /직접 붙여넣기/ }))
  const textarea = await waitFor(() => {
    const el = container.querySelector('#chat-input')
    if (!el) throw new Error('textarea not mounted yet')
    return el
  })
  fireEvent.change(textarea, { target: { value: CHAT_TEXT } })
}

describe('App — Privacy Review gates analysis (Phase 2.1 items 6/7/11)', () => {
  test('submitting from InputStep shows Privacy Review, not Loading, and does not call analyzePreview yet', async () => {
    const { container } = render(<App />)

    // IntentStep -> pick any intent
    fireEvent.click(screen.getAllByRole('button')[0])

    await waitFor(() => expect(container.querySelector('#chat-input, [role="tab"]')).toBeTruthy())
    await act(async () => {
      await fillChatText(container)
    })

    const submitButton = await screen.findByText('🔥 호감도 분석 시작')
    await act(async () => {
      fireEvent.click(submitButton)
      await new Promise((r) => setTimeout(r, 300)) // step transition timer
    })

    expect(await screen.findByText('🔍 AI에 전달되기 전, 이렇게 처리돼요')).toBeTruthy()
    expect(screen.queryByText('분석 완료!')).toBeNull()
    expect(analyzePreview).not.toHaveBeenCalled()
  })

  test('confirming Privacy Review runs the analysis exactly once', async () => {
    const { container } = render(<App />)
    fireEvent.click(screen.getAllByRole('button')[0])

    await waitFor(() => expect(container.querySelector('#chat-input, [role="tab"]')).toBeTruthy())
    await act(async () => {
      await fillChatText(container)
    })

    const submitButton = await screen.findByText('🔥 호감도 분석 시작')
    await act(async () => {
      fireEvent.click(submitButton)
      await new Promise((r) => setTimeout(r, 300))
    })

    const confirmButton = await screen.findByText('이대로 분석 시작')
    await act(async () => {
      fireEvent.click(confirmButton)
      await new Promise((r) => setTimeout(r, 300))
    })

    await waitFor(() => expect(analyzePreview).toHaveBeenCalledTimes(1))
    const call = analyzePreview.mock.calls[0][0]
    expect(call.intent).toBeTruthy()
    expect(call.anonymizedText).toContain('상대방')
  })
})
