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
  '답장 빠르면 관심 있을 확률 UP ⚡',
  'ㅋㅋㅋ 많이 쓰면 편한 사이 😊',
  '먼저 연락하는 쪽이 더 적극적 🎯',
  '읽씹은 온도 급락 💤',
]

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
    }, 3500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="animate-fade-in flex flex-col items-center justify-center min-h-[380px] py-10 max-w-md mx-auto">
      {preview ? (
        <div className="w-full mb-6 text-center">
          <p className="text-sm font-bold text-brand-600 mb-3">⚡ 1차 결과 나왔어!</p>
          <div className="bg-white rounded-3xl border border-brand-100 shadow-sm p-6">
            <div className="relative w-20 h-20 mx-auto mb-3">
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${scoreRing} flex items-center justify-center shadow-lg`}>
                <span className="text-3xl font-black text-white">{preview.totalScore}</span>
              </div>
              <span className="absolute -bottom-1 -right-1 text-lg">{relation.icon}</span>
            </div>
            <p className="font-black text-gray-800">{preview.relationTag}</p>
            <p className="text-xs text-gray-400 mt-1">AI가 더 자세히 분석 중...</p>
          </div>
        </div>
      ) : (
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-full border-4 border-brand-100 border-t-brand-500 animate-spin" />
          <span className="absolute inset-0 flex items-center justify-center text-xl">💕</span>
        </div>
      )}

      <div className="w-full mb-5">
        <div className="flex justify-between text-xs font-semibold text-gray-500 mb-2">
          <span>{phase || '분석 중...'}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-violet-500 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">잠깐만~ 20초면 돼</p>
      </div>

      <p key={tipIndex} className="text-sm text-gray-500 text-center mb-6 px-4 animate-pulse-soft">
        💡 {LOADING_TIPS[tipIndex]}
      </p>

      <AdSlot variant="rectangle" className="mb-4" />
    </div>
  )
}
