const STEPS = [
  { icon: '📸', label: '카톡 올리기' },
  { icon: '🔒', label: '이름 가리기' },
  { icon: '✨', label: '결과 확인' },
]

export default function UsageGuide() {
  return (
    <div className="flex justify-center gap-2 sm:gap-3 mb-6">
      {STEPS.map((step, i) => (
        <div
          key={step.label}
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white border border-gray-100 shadow-sm text-sm font-semibold text-gray-700"
        >
          <span className="text-lg" aria-hidden="true">{step.icon}</span>
          <span>{step.label}</span>
          {i < STEPS.length - 1 && (
            <span className="hidden sm:inline text-gray-300 ml-1" aria-hidden="true">→</span>
          )}
        </div>
      ))}
    </div>
  )
}
