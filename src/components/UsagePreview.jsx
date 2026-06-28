function MockChatCard() {
  return (
    <div
      className="w-[132px] sm:w-[148px] rounded-[1.25rem] border border-gray-200 bg-[#bacee0] shadow-md overflow-hidden shrink-0"
      aria-hidden="true"
    >
      <div className="bg-[#fee500] px-2.5 py-1.5 flex items-center gap-1.5 border-b border-black/5">
        <span className="text-[10px]">←</span>
        <span className="text-[10px] font-bold text-gray-900 truncate">친구 💬</span>
      </div>
      <div className="px-2 py-2.5 space-y-1.5 min-h-[108px]">
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-2 py-1 text-[9px] leading-snug text-gray-800 shadow-sm">
            오늘 뭐해?
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#fee500] px-2 py-1 text-[9px] leading-snug text-gray-900 shadow-sm">
            그냥 집 ㅎㅎ
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-2 py-1 text-[9px] leading-snug text-gray-800 shadow-sm">
            나중에 같이 밥 먹을래?
          </div>
        </div>
      </div>
      <p className="text-[9px] text-center text-gray-600/80 pb-2 font-semibold">캡처 예시</p>
    </div>
  )
}

function MockResultCard() {
  return (
    <div
      className="w-[132px] sm:w-[148px] rounded-[1.25rem] border border-brand-100 bg-white shadow-md overflow-hidden shrink-0"
      aria-hidden="true"
    >
      <div className="bg-gradient-to-br from-brand-50 to-violet-50 px-2.5 py-2 border-b border-brand-100">
        <p className="text-[9px] font-bold text-brand-600 text-center">호감도 분석</p>
      </div>
      <div className="px-2.5 py-3 flex flex-col items-center">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex flex-col items-center justify-center shadow-md mb-2">
          <span className="text-lg font-black leading-none">78</span>
          <span className="text-[7px] font-semibold opacity-90">점</span>
        </div>
        <span className="text-[8px] font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full mb-2">
          썸 가능성 높음
        </span>
        <div className="w-full space-y-1">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full w-[82%] bg-gradient-to-r from-brand-400 to-brand-500 rounded-full" />
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full w-[71%] bg-gradient-to-r from-violet-400 to-violet-500 rounded-full" />
          </div>
        </div>
      </div>
      <p className="text-[9px] text-center text-gray-500 pb-2 font-semibold">결과 예시</p>
    </div>
  )
}

/** @param {{ hidden?: boolean }} props */
export default function UsagePreview({ hidden = false }) {
  if (hidden) return null

  return (
    <section
      className="mb-5"
      aria-label="이용 방법: 카톡 대화를 올리면 AI가 호감도를 분석합니다"
    >
      <p className="text-center text-sm font-bold text-gray-700 mb-3">
        카톡 올리면, <span className="text-brand-600">AI가 분석해줘요</span>
      </p>

      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <MockChatCard />
        <div className="flex flex-col items-center shrink-0 text-brand-400" aria-hidden="true">
          <span className="text-lg sm:text-xl leading-none">→</span>
          <span className="text-[9px] font-bold text-brand-500 mt-0.5 hidden sm:block">AI</span>
        </div>
        <MockResultCard />
      </div>
    </section>
  )
}
