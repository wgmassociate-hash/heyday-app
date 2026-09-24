// @vitest-environment jsdom
import { describe, expect, test, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import PreviewResultStep, { ScoreBar } from './PreviewResultStep.jsx'

afterEach(() => {
  cleanup()
})

function score(value, confidence) {
  return { score: value, confidence }
}

function buildResult(overrides = {}) {
  const core4 = {
    interest: { bySpeaker: { 나: score(70, 'high'), 상대방: score(65, 'high') } },
    intimacy: { bySpeaker: { 나: score(60, 'high'), 상대방: score(55, 'high') } },
    conversationInitiationRatio: { ratioBySpeaker: { 나: 0.6, 상대방: 0.4 } },
    reciprocity: { score: 70, confidence: 'high', bySpeaker: {} },
    ...overrides.core4,
  }

  return {
    preview: {
      recentConversationTemperature: score(65, 'high'),
      recentRomanceSignal: { score: 40, positiveCount: 1, ambiguousCount: 0, distancingCount: 0 },
      initiativeRatioPreview: { ratioBySpeaker: { 나: 0.6, 상대방: 0.4 } },
      core4Preview: core4,
      windowMessageCount: 52,
      recentRelationshipPosition: { label: 'warming_up_toward_romance' },
      windowLabel: '최근 2주',
      confidenceLabel: 'recent_window',
      scoreEngineVersion: 'test',
      ...overrides.preview,
    },
    narrative: { firstVerdict: '테스트 판정 문장입니다', summaryOneLine: '요약' },
    topSignal: { reason: '상대의 말에 이어 단둘이 식사하는 행동을 제안했습니다', signalType: 'x', category: 'romance' },
    ...overrides.result,
  }
}

describe('ScoreBar (Phase 2.2 item 1 — confidence controls interpretation, not visibility)', () => {
  test('score === null hides the number, regardless of confidence label', () => {
    render(<ScoreBar score={null} confidence="insufficient" label="관심도" />)
    expect(screen.getByText('판단할 단서가 아직 없어요')).toBeTruthy()
    expect(screen.queryByText(/점$/)).toBeNull()
  })

  test('low confidence still shows the number, softened as "참고용" (item 6)', () => {
    render(<ScoreBar score={12} confidence="low" label="관심도" />)
    expect(screen.getByText('12점')).toBeTruthy()
    expect(screen.getByText('아직 참고용이에요')).toBeTruthy()
  })

  test('medium confidence shows the number with its own caption (item 7)', () => {
    render(<ScoreBar score={55} confidence="medium" label="관심도" />)
    expect(screen.getByText('55점')).toBeTruthy()
    expect(screen.getByText('어느 정도 단서가 있어요')).toBeTruthy()
  })

  test('high confidence shows the number even when the score itself is low (low score != low confidence, item 7)', () => {
    render(<ScoreBar score={3} confidence="high" label="관심도" />)
    expect(screen.getByText('3점')).toBeTruthy()
    expect(screen.getByText('비교적 뚜렷해요')).toBeTruthy()
  })
})

describe('PreviewResultStep (Phase 2.1 items 2/3/5/9)', () => {
  test('renders the highlighted scene heading instead of "결정적 카톡" for the free Evidence', () => {
    render(<PreviewResultStep result={buildResult()} onReset={() => {}} onAddMoreConversation={() => {}} />)
    expect(screen.getByText('✨ 대화 속, 그냥 지나치기 아까운 순간')).toBeTruthy()
    expect(screen.queryByText(/결정적 카톡/)).toBeNull()
  })

  test('renders a key scene with its title, cue, linked excerpts, and interpretation', () => {
    const result = buildResult({
      result: {
        report: {
          keyScenes: [{
            title: '앞으로의 장면에 상대를 넣은 순간',
            cueLabel: '친밀감의 단서',
            excerpts: [
              { speakerId: '상대방', text: '연휴 때 시간 괜찮아?' },
              { speakerId: '나', text: '응 아직 별일 없어' },
            ],
            speakerId: '상대방',
            excerpt: '연휴 때 시간 괜찮아?',
            interpretation: '앞으로의 계획 속에 상대를 자연스럽게 포함했어요.',
            signalType: 'includes_partner_in_future',
            category: 'intimacy',
          }],
        },
      },
    })
    render(<PreviewResultStep result={result} onReset={() => {}} onAddMoreConversation={() => {}} />)
    expect(screen.getByText('앞으로의 장면에 상대를 넣은 순간')).toBeTruthy()
    expect(screen.getByText('친밀감의 단서')).toBeTruthy()
    expect(screen.getByText('“연휴 때 시간 괜찮아?”')).toBeTruthy()
    expect(screen.getByText('“응 아직 별일 없어”')).toBeTruthy()
    expect(screen.getByText('AI가 주목한 이유')).toBeTruthy()
    expect(screen.getByText('앞으로의 계획 속에 상대를 자연스럽게 포함했어요.')).toBeTruthy()
  })

  test('shows the analysis scope with message count', () => {
    render(<PreviewResultStep result={buildResult()} onReset={() => {}} onAddMoreConversation={() => {}} />)
    expect(screen.getByText(/최근 2주.*52개 메시지 기준/)).toBeTruthy()
  })

  test('shows the relationship position label', () => {
    render(<PreviewResultStep result={buildResult()} onReset={() => {}} onAddMoreConversation={() => {}} />)
    expect(screen.getByText('가까워지는 썸 같아요')).toBeTruthy()
  })

  test('hides deferred paid-report teasers in the current free-product UI', () => {
    render(<PreviewResultStep result={buildResult()} onReset={() => {}} onAddMoreConversation={() => {}} />)
    expect(screen.queryByText('🤔 아직 남은 질문')).toBeNull()
    expect(screen.queryByText(/전체 리포트 보기/)).toBeNull()
    expect(screen.queryByText(/전체 대화 기준 종합 분석/)).toBeNull()
  })
})

describe('PreviewResultStep analyzability states (Phase 2.2 items 1/2/4/5/6/7)', () => {
  test('truly_insufficient (temperature null): numbers are hidden, one clear notice replaces the whole Core4 breakdown', () => {
    const insufficientResult = buildResult({
      preview: { recentConversationTemperature: score(null, 'insufficient') },
      core4: {
        interest: { bySpeaker: { 나: score(null, 'insufficient'), 상대방: score(null, 'insufficient') } },
        intimacy: { bySpeaker: { 나: score(null, 'insufficient'), 상대방: score(null, 'insufficient') } },
        reciprocity: { score: null, confidence: 'insufficient', bySpeaker: {} },
      },
    })
    render(<PreviewResultStep result={insufficientResult} onReset={() => {}} onAddMoreConversation={() => {}} />)
    expect(screen.getByText('아직 분석할 수 있는 관계 단서가 부족해요.')).toBeTruthy()
    expect(screen.getByText('입력 보완해서 다시 분석하기')).toBeTruthy()
    expect(screen.getByText(/새 결과가 현재 결과를 대체하며 분석 1회가 사용돼요/)).toBeTruthy()
    // The Core4 breakdown (and its repeated "판단할 단서가 아직 없어요" bars) must not render at all.
    expect(screen.queryByText('Core 4')).toBeNull()
    expect(screen.queryByText('판단할 단서가 아직 없어요')).toBeNull()
  })

  test('limited_but_analyzable (temperature real, low confidence elsewhere): numbers ARE shown with softened "잠정 분석" copy, not the strong insufficiency notice', () => {
    const limitedResult = buildResult({
      preview: { recentConversationTemperature: score(19, 'low') },
      core4: {
        interest: { bySpeaker: { 나: score(9, 'low'), 상대방: score(7, 'low') } },
        intimacy: { bySpeaker: { 나: score(6, 'low'), 상대방: score(6, 'low') } },
        reciprocity: { score: 0, confidence: 'low', bySpeaker: {} },
      },
    })
    render(<PreviewResultStep result={limitedResult} onReset={() => {}} onAddMoreConversation={() => {}} />)
    expect(screen.getByText('짧은 대화 기준 잠정 분석이에요.')).toBeTruthy()
    expect(screen.getByText('현재 결과는 짧은 대화를 기준으로 한 참고용 분석이에요.')).toBeTruthy()
    expect(screen.queryByText('입력 보완해서 다시 분석하기')).toBeNull()
    expect(screen.queryByText('아직 분석할 수 있는 관계 단서가 부족해요.')).toBeNull()
    // Real (if modest) numbers are shown, not hidden — this is the exact bug being fixed.
    expect(screen.getByText('9점')).toBeTruthy()
    expect(screen.getByText('7점')).toBeTruthy()
    expect(screen.getByText('0점')).toBeTruthy()
    // At least one clue (topSignal) still renders alongside the numbers (item 5).
    expect(screen.getByText('✨ 대화 속, 그냥 지나치기 아까운 순간')).toBeTruthy()
  })

  test('normal (mostly medium/high confidence): no sufficiency notice at all', () => {
    render(<PreviewResultStep result={buildResult()} onReset={() => {}} onAddMoreConversation={() => {}} />)
    expect(screen.queryByText('짧은 대화 기준 잠정 분석이에요.')).toBeNull()
    expect(screen.queryByText('아직 분석할 수 있는 관계 단서가 부족해요.')).toBeNull()
  })
})
