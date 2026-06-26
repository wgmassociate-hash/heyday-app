const TREND_ICON = { up: '↑', down: '↓', stable: '→' }
const TREND_COLOR = { up: 'text-emerald-500', down: 'text-rose-400', stable: 'text-gray-400' }

export default function AffectionTrendChart({ timeline, scoreLabel = '호감도' }) {
  if (!timeline?.length) return null

  const W = 320
  const H = 140
  const pad = { t: 20, r: 16, b: 28, l: 32 }
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

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <span>📈</span> {scoreLabel} 추이 — 과거 vs 현재
          </h3>
          <p className="text-xs text-gray-500 mt-1">대화 타임라인별 관계 온도 변화</p>
        </div>
        <div className={`text-right ${delta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
          <p className="text-lg font-black">{delta >= 0 ? '+' : ''}{delta}</p>
          <p className="text-[10px] font-medium uppercase tracking-wide">vs 초반</p>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[160px]" aria-hidden="true">
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((v) => {
          const y = pad.t + innerH - (v / 100) * innerH
          return (
            <g key={v}>
              <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="8" fill="#9ca3af">{v}</text>
            </g>
          )
        })}
        <path d={areaPath} fill="url(#trendGrad)" />
        <path d={linePath} fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="white" stroke="#ec4899" strokeWidth="2" />
            <circle cx={p.x} cy={p.y} r="2.5" fill="#ec4899" />
          </g>
        ))}
      </svg>

      <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
        {timeline.map((t, i) => (
          <div key={i} className="flex-shrink-0 min-w-[72px] text-center">
            <p className={`text-xs font-bold ${TREND_COLOR[t.trend]}`}>
              {TREND_ICON[t.trend]} {t.score}
            </p>
            <p className="text-[10px] text-gray-500 truncate">{t.period}</p>
          </div>
        ))}
      </div>

      {timeline[timeline.length - 1]?.insight && (
        <p className="mt-3 text-xs text-gray-600 bg-brand-50 rounded-lg px-3 py-2 border border-brand-100">
          💡 {timeline[timeline.length - 1].insight}
        </p>
      )}
    </div>
  )
}
