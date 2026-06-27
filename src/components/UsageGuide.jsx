const STEPS = [
  { icon: '1️⃣', label: '대화 올리기' },
  { icon: '2️⃣', label: '본인 선택' },
  { icon: '3️⃣', label: '결과 보기' },
]

export default function UsageGuide({ activeStep = 1 }) {
  return (
    <div className="flex justify-center gap-1.5 sm:gap-2 mb-5" aria-label="이용 순서">
      {STEPS.map((step, i) => {
        const stepNum = i + 1
        const isActive = stepNum === activeStep
        const isDone = stepNum < activeStep
        return (
          <div
            key={step.label}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-2xl border text-xs sm:text-sm font-bold transition-colors ${
              isActive
                ? 'bg-brand-50 border-brand-300 text-brand-800 shadow-sm'
                : isDone
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white border-gray-100 text-gray-400'
            }`}
          >
            <span aria-hidden="true">{isDone ? '✅' : step.icon}</span>
            <span>{step.label}</span>
          </div>
        )
      })}
    </div>
  )
}
