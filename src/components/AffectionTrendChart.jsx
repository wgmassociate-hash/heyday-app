const TREND_ICON = { up: '↑', down: '↓', stable: '→' }
const TREND_COLOR = { up: 'text-emerald-500', down: 'text-rose-400', stable: 'text-gray-400' }

export default function AffectionTrendChart({ timeline, scoreLabel = '호감도', compact = false }) {
  if (!timeline?.length) return null

  const W = 320
  const H = 120
  const pad = { t: 16, r: 12, b: 24, l: 28 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  const points = timeline.map((t, i) => ({
    x: pad.l + (i / Math.max(timeline.length - 1, 1)) * innerW,
    y: pad.t + innerH - (t.score / 100) * innerH,
    ...t,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${pad.t + innerH} L ${points[0].x} ${pad.t + innerH} Z`

  const first = timeline[0].score
  const last = timeline[timeline.length - 1].score
  const delta = last - first

  const chart = (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">{scoreLabel} 흐름</p>
        <p className={`text-sm font-black ${delta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
          {delta >= 0 ? '+' : ''}{delta} vs 처음
        </p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[140px]" aria-hidden="true">
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((v) => {
          const y = pad.t + innerH - (v / 100) * innerH
          return (
            <line key={v} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f3f4f6" strokeWidth="1" />
          )
        })}
        <path d={areaPath} fill="url(#trendGrad)" />
        <path d={linePath} fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#ec4899" stroke="white" strokeWidth="2" />
        ))}
      </svg>

      <div className="flex gap-2 mt-2 overflow-x-auto">
        {timeline.map((t, i) => (
          <div key={i} className="flex-shrink-0 text-center min-w-[56px]">
            <p className={`text-xs font-bold ${TREND_COLOR[t.trend]}`}>
              {TREND_ICON[t.trend]} {t.score}
            </p>
          </div>
        ))}
      </div>
    </>
  )

  if (compact) return chart

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
      <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
        <span>📈</span> {scoreLabel} 변화
      </h3>
      {chart}
    </div>
  )
}
