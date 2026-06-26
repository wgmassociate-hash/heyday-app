import { useEffect, useState } from 'react'
import AdSlot from './AdSlot'

const RELATION_PREVIEW = {
  romantic: { icon: '💕', ring: 'from-brand-400 to-brand-600' },
  friendship: { icon: '🤝', ring: 'from-sky-400 to-sky-600' },
  work: { icon: '💼', ring: 'from-amber-400 to-amber-600' },
  family: { icon: '👨‍👩‍👧', ring: 'from-emerald-400 to-emerald-600' },
  ambiguous: { icon: '💬', ring: 'from-gray-400 to-gray-600' },
}

const LOADING_TIPS = [
  '답장이 빠를수록 관심·호감 신호일 수 있어요.',
  '말투·이모티콘을 따라 하면 무의식적 친밀감 표현이에요.',
  '대화 주도권은 관계에서 누가 더 적극적인지 보여줘요.',
  '「읽씹」 패턴은 관계 온도를 가장 빠르게 떨어뜨려요.',
  '최근 대화일수록 현재 관계 상태를 더 잘 반영해요.',
]

const STEPS = [
  { at: 0, label: '익명화 · 패턴 분석' },
  { at: 25, label: '호감도 · 밀당 해석' },
  { at: 55, label: '관계 역학 · 핵심 순간' },
  { at: 85, label: '리포트 생성' },
]

function activeStepLabel(progress) {
  let label = STEPS[0].label
  for (const step of STEPS) {
    if (progress >= step.at) label = step.label
  }
  return label
}

export default function LoadingStep({ preview, progress = 0, phase = '' }) {
  const [tipIndex, setTipIndex] = useState(0)
  const relation = RELATION_PREVIEW[preview?.relationType] ?? RELATION_PREVIEW.ambiguous
  const scoreRing =
    preview?.totalScore >= 80 ? 'from-emerald-400 to-emerald-600' :
    preview?.totalScore >= 60 ? relation.ring :
    'from-amber-400 to-amber-600'

  useEffect(() => {
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % LOADING_TIPS.length)
    }, 4500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="animate-fade-in flex flex-col items-center justify-center min-h-[420px] py-12">
      {preview ? (
        <div className="w-full max-w-md mb-8">
          <p className="text-center text-xs font-semibold text-brand-600 uppercase tracking-widest mb-4">
            ⚡ 1차 분석 완료 · AI 심층 분석 중
          </p>
          <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-6 text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div
                className={`w-24 h-24 rounded-full bg-gradient-to-br ${scoreRing} flex items-center justify-center shadow-lg`}
              >
                <span className="text-3xl font-black text-white">{preview.totalScore}</span>
              </div>
              <span className="absolute -bottom-1 -right-1 text-xl">{relation.icon}</span>
            </div>
            <p className="text-sm text-gray-500 mb-1">{preview.scoreLabel || '대화 점수'}</p>
            <p className="text-lg font-bold text-gray-800">{preview.relationTag}</p>
            <p className="text-xs text-gray-400 mt-2">
              아래 진행률이 100%가 되면 AI 심층 리포트가 열려요
            </p>
          </div>
        </div>
      ) : (
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-full border-4 border-brand-100 border-t-brand-500 animate-spin" />
          <span className="absolute inset-0 flex items-center justify-center text-2xl">💕</span>
        </div>
      )}

      <div className="w-full max-w-md mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>{phase || activeStepLabel(progress)}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-violet-500 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-center text-xs text-gray-400 mt-3">
          보통 15~30초 소요 · 서버에 원본 저장 안 함
        </p>
      </div>

      <div className="max-w-md w-full mb-8 px-4 py-3 rounded-xl bg-violet-50/80 border border-violet-100 text-center">
        <p className="text-xs text-violet-600 font-medium mb-1">💡 잠깐! 알고 계셨나요?</p>
        <p key={tipIndex} className="text-sm text-gray-600 leading-relaxed animate-pulse-soft">
          {LOADING_TIPS[tipIndex]}
        </p>
      </div>

      <AdSlot variant="rectangle" className="mb-6" />
      <AdSlot variant="leaderboard" />
    </div>
  )
}
