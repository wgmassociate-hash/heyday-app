function GaugeRing({ score, label, sublabel, color = 'brand' }) {
  const colors = {
    brand: { stroke: '#ec4899', bg: 'text-brand-600' },
    violet: { stroke: '#8b5cf6', bg: 'text-violet-600' },
  }
  const c = colors[color] ?? colors.brand
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f3f4f6" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={c.stroke} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-black ${c.bg}`}>{score}</span>
        </div>
      </div>
      <p className="text-xs font-bold text-gray-700 mt-2 text-center">{label}</p>
      {sublabel && <p className="text-[10px] text-gray-400 text-center mt-0.5">{sublabel}</p>}
    </div>
  )
}

export default function DeepMetricsPanel({ deepMetrics }) {
  if (!deepMetrics) return null

  const { textMirroring, replySpeedAsymmetry } = deepMetrics

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
      <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
        <span>🔬</span> 심층 심리 지표
      </h3>
      <p className="text-xs text-gray-500 mb-6">텍스트 미러링 · 답장 속도 비대칭성</p>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <GaugeRing score={textMirroring.score} label={textMirroring.label} color="brand" />
        <GaugeRing score={replySpeedAsymmetry.asymmetryScore} label="답장 비대칭" sublabel={replySpeedAsymmetry.gapRatio} color="violet" />
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-brand-50/80 border border-brand-100 p-4">
          <p className="text-xs font-bold text-brand-700 mb-1.5">🪞 텍스트 미러링</p>
          <p className="text-sm text-gray-700 leading-relaxed">{textMirroring.interpretation}</p>
          {textMirroring.evidence?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {textMirroring.evidence.map((e, i) => (
                <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                  <span className="text-brand-400 shrink-0">›</span>{e}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl bg-violet-50/80 border border-violet-100 p-4">
          <p className="text-xs font-bold text-violet-700 mb-1.5">⏱️ 답장 속도 비대칭성</p>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs px-2 py-1 rounded-lg bg-white border border-violet-100 text-violet-700 font-medium">
              빠름: {replySpeedAsymmetry.fasterSide}
            </span>
            <span className="text-xs px-2 py-1 rounded-lg bg-white border border-violet-100 text-gray-600">
              느림: {replySpeedAsymmetry.slowerSide}
            </span>
            <span className="text-xs px-2 py-1 rounded-lg bg-white border border-violet-100 text-gray-600">
              격차 {replySpeedAsymmetry.gapRatio}
            </span>
          </div>
          {replySpeedAsymmetry.avgReplyLabel && (
            <p className="text-xs text-violet-600 mb-1.5">{replySpeedAsymmetry.avgReplyLabel}</p>
          )}
          <p className="text-sm text-gray-700 leading-relaxed">{replySpeedAsymmetry.interpretation}</p>
        </div>
      </div>
    </div>
  )
}
