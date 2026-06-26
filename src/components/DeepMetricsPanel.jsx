function GaugeRing({ score, label, sublabel, color = 'brand' }) {
  const colors = {
    brand: { stroke: '#ec4899', bg: 'text-brand-600' },
    violet: { stroke: '#8b5cf6', bg: 'text-violet-600' },
  }
  const c = colors[color] ?? colors.brand
  const r = 32
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={c.stroke} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-black ${c.bg}`}>{score}</span>
        </div>
      </div>
      <p className="text-[11px] font-bold text-gray-600 mt-1.5 text-center">{label}</p>
      {sublabel && <p className="text-[10px] text-gray-400">{sublabel}</p>}
    </div>
  )
}

export default function DeepMetricsPanel({ deepMetrics, compact = false }) {
  if (!deepMetrics) return null

  const { textMirroring, replySpeedAsymmetry } = deepMetrics

  const body = (
    <>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <GaugeRing score={textMirroring.score} label="말투 따라하기" color="brand" />
        <GaugeRing score={replySpeedAsymmetry.asymmetryScore} label="답장 격차" sublabel={replySpeedAsymmetry.gapRatio} color="violet" />
      </div>

      {textMirroring.interpretation && (
        <p className="text-xs text-gray-600 leading-relaxed mb-3">{textMirroring.interpretation}</p>
      )}
      {replySpeedAsymmetry.interpretation && (
        <p className="text-xs text-gray-600 leading-relaxed">{replySpeedAsymmetry.interpretation}</p>
      )}
    </>
  )

  if (compact) return body

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span>🔬</span> 심층 지표
      </h3>
      {body}
    </div>
  )
}
