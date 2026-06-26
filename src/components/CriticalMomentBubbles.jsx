import { MOMENT_TYPE_LABELS } from '../../shared/normalizeAnalysis.js'

const STYLE = {
  brand: 'border-brand-200 bg-brand-50',
  amber: 'border-amber-200 bg-amber-50',
  rose: 'border-rose-200 bg-rose-50',
  slate: 'border-slate-200 bg-slate-50',
  violet: 'border-violet-200 bg-violet-50',
  sky: 'border-sky-200 bg-sky-50',
  emerald: 'border-emerald-200 bg-emerald-50',
}

const BADGE = {
  brand: 'bg-brand-100 text-brand-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
  slate: 'bg-slate-100 text-slate-600',
  violet: 'bg-violet-100 text-violet-700',
  sky: 'bg-sky-100 text-sky-700',
  emerald: 'bg-emerald-100 text-emerald-700',
}

function Bubble({ moment, align }) {
  const meta = MOMENT_TYPE_LABELS[moment.momentType] ?? MOMENT_TYPE_LABELS.warmth
  const style = STYLE[meta.color] ?? STYLE.rose
  const badge = BADGE[meta.color] ?? BADGE.rose

  return (
    <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] md:max-w-[75%] ${align === 'right' ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-600">{moment.speaker}</span>
          {moment.timestamp && (
            <span className="text-[10px] text-gray-400">{moment.timestamp}</span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge}`}>
            {meta.icon} {meta.label}
          </span>
          <span className="text-[10px] text-gray-400">임팩트 {moment.impactScore}/10</span>
        </div>

        <div className={`relative px-4 py-3 rounded-2xl border-2 shadow-sm ${style} ${
          align === 'right' ? 'rounded-tr-sm' : 'rounded-tl-sm'
        }`}>
          <p className="text-sm md:text-base text-gray-800 font-medium leading-relaxed">
            "{moment.quote}"
          </p>
        </div>

        <div className="px-1">
          <p className="text-xs text-gray-600 leading-relaxed">
            🧠 {moment.psychologicalInsight}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function CriticalMomentBubbles({ moments }) {
  if (!moments?.length) return null

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
      <div className="mb-5">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span>💬</span> 소름 돋는 카톡 순간
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          관계가 바뀐 핵심 대화 + 해석
        </p>
      </div>

      <div className="space-y-6">
        {moments.map((m, i) => (
          <Bubble key={i} moment={m} align={i % 2 === 0 ? 'left' : 'right'} />
        ))}
      </div>
    </div>
  )
}
