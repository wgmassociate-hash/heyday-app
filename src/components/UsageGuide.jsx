const STEPS = [
  {
    num: 1,
    icon: '📲',
    title: '대화 가져오기',
    desc: '카톡 스크린샷, txt 파일, PC에서 드래그·붙여넣기',
  },
  {
    num: 2,
    icon: '🔒',
    title: '확인 · 익명화',
    desc: '본인 「나」, 1:1 상대 「사용자」로 자동 변환',
  },
  {
    num: 3,
    icon: '✨',
    title: 'AI 분석 결과',
    desc: '호감도, 밀당, 답장 패턴, 관계 심리 리포트',
  },
]

const RESULT_ITEMS = [
  '💕 상대의 호감도·관심도',
  '⚖️ 밀당·주도권 누가 잡고 있는지',
  '⏱️ 답장 속도·대화 온도 변화',
  '🧠 심리 분석 & 핵심 순간',
]

export default function UsageGuide() {
  return (
    <div className="mb-8 space-y-5">
      <div className="rounded-2xl border border-brand-100 bg-white/80 shadow-sm p-5 md:p-6">
        <p className="text-center text-gray-700 text-sm md:text-base leading-relaxed max-w-lg mx-auto">
          <strong className="text-gray-900">카카오톡 대화</strong>를 올려주시면 AI가
          <strong className="text-brand-600"> 연애·관계 심리</strong> 관점에서 분석해 드립니다.
          <span className="block mt-1 text-gray-500 text-xs md:text-sm">
            썸·연애·친구·직장 등 대화 맥락에 맞게 해석합니다.
          </span>
        </p>
      </div>

      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STEPS.map((step) => (
          <li
            key={step.num}
            className="relative rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-brand-500 text-white text-[10px] font-bold">
              {step.num}단계
            </span>
            <div className="flex items-start gap-3 pt-1">
              <span className="text-2xl shrink-0" aria-hidden="true">
                {step.icon}
              </span>
              <div>
                <p className="font-bold text-gray-800 text-sm">{step.title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-xl bg-gradient-to-r from-brand-50 to-violet-50 border border-brand-100/80 px-4 py-3">
        <p className="text-xs font-semibold text-gray-700 mb-2">분석하면 이런 결과를 받아요</p>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {RESULT_ITEMS.map((item) => (
            <li key={item} className="text-xs text-gray-600">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
