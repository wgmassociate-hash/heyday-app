import AdSlot from './AdSlot'

export default function LoadingStep() {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center min-h-[420px] py-12">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full border-4 border-brand-100 border-t-brand-500 animate-spin" />
        <span className="absolute inset-0 flex items-center justify-center text-2xl">💕</span>
      </div>

      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">
        AI가 대화를 분석하고 있어요
      </h2>
      <p className="text-gray-500 text-sm md:text-base mb-2 animate-pulse-soft">
        호감도 · 밀당 · 주도권 패턴을 읽는 중...
      </p>
        <p className="text-gray-400 text-xs mb-10">
          Claude AI가 대화 맥락을 분석 중 · 서버에 원본 저장 안 함
        </p>

      <AdSlot variant="rectangle" className="mb-6" />
      <AdSlot variant="leaderboard" />
    </div>
  )
}
