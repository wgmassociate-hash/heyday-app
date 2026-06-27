import { useEffect, useState } from 'react'
import AdSlot from './AdSlot'

const RELATION_PREVIEW = {
  romantic: { icon: '💕', ring: 'from-brand-400 to-brand-600', vibe: '썸 냄새 남…' },
  friendship: { icon: '🤝', ring: 'from-sky-400 to-sky-600', vibe: '친구 vibe' },
  work: { icon: '💼', ring: 'from-amber-400 to-amber-600', vibe: '업무/학교 톤' },
  family: { icon: '👨‍👩‍👧', ring: 'from-emerald-400 to-emerald-600', vibe: '가족/지인' },
  ambiguous: { icon: '💬', ring: 'from-gray-400 to-gray-600', vibe: '관계 파악 중' },
}

const ANALYSIS_STAGES = [
  { at: 0, emoji: '📖', label: '대화 훑어보는 중' },
  { at: 18, emoji: '😂', label: 'ㅋㅋㅋ·ㅎㅎ 세는 중' },
  { at: 35, emoji: '⏱️', label: '답장 속도 재는 중' },
  { at: 52, emoji: '💘', label: '썸 신호 찾는 중' },
  { at: 68, emoji: '🔮', label: '호감도 계산 중' },
  { at: 85, emoji: '✍️', label: '리포트 쓰는 중' },
]

const LOADING_QUIPS = [
  '「뭐해?」 몇 번 나왔는지 세는 중…',
  '읽씹 있는지 없는지 엄청 자세히 봄 👀',
  '밀당 레벨 측정 중… 스탯 올라가는 중?',
  '설레는 순간 타임라인 짜는 중 ✨',
  '「ㅋㅋㅋ」랑 「ㅎㅎ」 비율 계산 중',
  '먼저 연락한 쪽 누군지 판별 중 🎯',
  'AI도 살짝 설레는 중… (아님)',
  '카톡 밀당학 과제 제출 직전 📚',
  '상대 마음 온도계 돌리는 중 🌡️',
  '「ㅇㅇ」만 보낸 적 있으면 감점…',
  '하트 이모티콘 숨어있는지 찾는 중 💕',
  '잠만~ 진짜 거의 다 됐어!!',
]

const FLOATING_EMOJI = ['💬', '✨', '💕', '📱']

function stageStatus(progress, at) {
  if (progress >= at + 14) return 'done'
  if (progress >= at) return 'active'
  return 'pending'
}

export default function LoadingStep({ preview, progress = 0, phase = '' }) {
  const [quipIndex, setQuipIndex] = useState(0)
  const relation = RELATION_PREVIEW[preview?.relationType] ?? RELATION_PREVIEW.ambiguous
  const scoreRing =
    preview?.totalScore >= 80 ? 'from-emerald-400 to-emerald-600' :
    preview?.totalScore >= 60 ? relation.ring :
    'from-amber-400 to-amber-600'

  useEffect(() => {
    const id = setInterval(() => {
      setQuipIndex((i) => (i + 1) % LOADING_QUIPS.length)
    }, 2800)
    return () => clearInterval(id)
  }, [])

  const activeStage = [...ANALYSIS_STAGES].reverse().find((s) => progress >= s.at) ?? ANALYSIS_STAGES[0]

  return (
    <div className="animate-fade-in flex flex-col items-center py-8 max-w-md mx-auto relative overflow-hidden">
      {FLOATING_EMOJI.map((emoji, i) => (
        <span
          key={emoji}
          aria-hidden="true"
          className="absolute text-lg opacity-20 pointer-events-none animate-float"
          style={{
            top: `${12 + i * 18}%`,
            left: i % 2 === 0 ? `${8 + i * 4}%` : 'auto',
            right: i % 2 === 1 ? `${6 + i * 3}%` : 'auto',
            animationDelay: `${i * 0.6}s`,
          }}
        >
          {emoji}
        </span>
      ))}

      <div className="text-center mb-5 relative z-10">
        <p className="text-2xl mb-1 animate-bounce-gentle" aria-hidden="true">👀💕</p>
        <h2 className="text-lg font-black text-gray-800">잠깐만! 분석 중…</h2>
        <p className="text-xs text-gray-400 mt-1">카톡을 AI가 열심히 읽고 있어</p>
      </div>

      {preview ? (
        <div className="w-full mb-5 text-center relative z-10">
          <p className="text-sm font-black text-brand-600 mb-2 animate-pop-in">
            ⚡ 1차 점수 나왔어!!
          </p>
          <div className="bg-white rounded-3xl border-2 border-brand-100 shadow-md p-5 animate-shimmer">
            <div className="relative w-[4.5rem] h-[4.5rem] mx-auto mb-2">
              <div
                className={`w-[4.5rem] h-[4.5rem] rounded-full bg-gradient-to-br ${scoreRing} flex items-center justify-center shadow-lg animate-bounce-gentle`}
              >
                <span className="text-3xl font-black text-white">{preview.totalScore}</span>
              </div>
              <span className="absolute -bottom-1 -right-2 text-xl animate-wiggle">{relation.icon}</span>
            </div>
            <p className="font-black text-gray-800">{preview.relationTag}</p>
            <p className="text-[11px] text-brand-500 font-semibold mt-0.5">{relation.vibe}</p>
            <p className="text-[10px] text-gray-400 mt-2">
              지금은 예비 점수 · AI가 더 디테일하게 다듬는 중
            </p>
          </div>
        </div>
      ) : (
        <div className="relative mb-5 z-10">
          <div className="w-16 h-16 rounded-full border-4 border-brand-100 border-t-brand-500 animate-spin" />
          <span className="absolute inset-0 flex items-center justify-center text-2xl animate-bounce-gentle">💕</span>
        </div>
      )}

      <div className="w-full mb-4 relative z-10 rounded-2xl bg-white/80 border border-pink-100 p-3 shadow-sm">
        <p className="text-[11px] font-bold text-gray-500 mb-2">🔍 지금 하는 일</p>
        <ul className="space-y-2">
          {ANALYSIS_STAGES.map((stage) => {
            const status = stageStatus(progress, stage.at)
            return (
              <li
                key={stage.label}
                className={`flex items-center gap-2 text-xs font-bold transition-all duration-500 ${
                  status === 'done'
                    ? 'text-emerald-600'
                    : status === 'active'
                      ? 'text-brand-700 scale-[1.02]'
                      : 'text-gray-300'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-sm ${
                    status === 'done'
                      ? 'bg-emerald-100 animate-pop-in'
                      : status === 'active'
                        ? 'bg-brand-100 animate-wiggle'
                        : 'bg-gray-100'
                  }`}
                >
                  {status === 'done' ? '✅' : stage.emoji}
                </span>
                <span className={status === 'active' ? 'animate-pulse-soft' : ''}>{stage.label}</span>
                {status === 'active' && (
                  <span className="ml-auto text-[10px] text-brand-400 font-black">ing</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="w-full mb-4 relative z-10">
        <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
          <span>{phase || activeStage.label}</span>
          <span className="text-brand-600">{Math.round(progress)}%</span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden border border-pink-50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 via-violet-400 to-violet-500 transition-all duration-700 relative"
            style={{ width: `${progress}%` }}
          >
            {progress > 8 && (
              <span
                className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px]"
                aria-hidden="true"
              >
                {progress >= 85 ? '🎉' : '💨'}
              </span>
            )}
          </div>
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-2">
          솔직히 30초쯤? 🙏 조금만 기다려줘
        </p>
      </div>

      <div
        key={quipIndex}
        className="w-full mb-5 px-4 py-3 rounded-2xl bg-gradient-to-br from-violet-50 to-pink-50 border border-violet-100 relative z-10 animate-fade-in"
      >
        <p className="text-[10px] font-bold text-violet-400 mb-1">💭 AI 속마음</p>
        <p className="text-sm font-bold text-gray-700 text-center leading-snug">
          {LOADING_QUIPS[quipIndex]}
        </p>
      </div>

      <AdSlot variant="rectangle" className="mb-2 relative z-10" />
    </div>
  )
}
