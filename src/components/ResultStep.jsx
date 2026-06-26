import AdSlot from './AdSlot'
import AffectionTrendChart from './AffectionTrendChart'
import CriticalMomentBubbles from './CriticalMomentBubbles'
import DeepMetricsPanel from './DeepMetricsPanel'

const RELATION_EMOJI = {
  romantic: '💕',
  friendship: '🤝',
  work: '💼',
  family: '👨‍👩‍👧',
  ambiguous: '💬',
}

const METRIC_EMOJI = {
  '답장 속도': '⚡',
  '이모티콘': '😊',
  '이모티콘 사용': '😊',
  '대화 주도': '🎯',
  '주도성': '🎯',
  '호감 표현': '💕',
  '애정 표현': '💕',
}

function Collapsible({ title, emoji, children, defaultOpen = false }) {
  return (
    <details
      open={defaultOpen}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group"
    >
      <summary className="cursor-pointer list-none px-5 py-4 font-bold text-gray-800 flex items-center justify-between hover:bg-gray-50/80">
        <span className="flex items-center gap-2">
          <span>{emoji}</span> {title}
        </span>
        <span className="text-gray-300 text-sm group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="px-5 pb-5 border-t border-gray-50">{children}</div>
    </details>
  )
}

function DominanceGraph({ detail }) {
  const { personA, personB, personALabel, personBLabel } = detail

  return (
    <div className="space-y-3">
      <div className="flex h-12 rounded-2xl overflow-hidden shadow-inner text-white text-sm font-bold">
        <div
          className="bg-gradient-to-r from-brand-400 to-brand-500 flex items-center justify-center transition-all duration-1000"
          style={{ width: `${personA}%` }}
        >
          {personA >= 18 && `${personA}%`}
        </div>
        <div
          className="bg-gradient-to-r from-violet-400 to-violet-500 flex items-center justify-center transition-all duration-1000"
          style={{ width: `${personB}%` }}
        >
          {personB >= 18 && `${personB}%`}
        </div>
      </div>
      <div className="flex justify-between text-sm font-semibold">
        <span className="text-brand-600">{personALabel}</span>
        <span className="text-violet-600">{personBLabel}</span>
      </div>
    </div>
  )
}

export default function ResultStep({ result, onReset }) {
  const {
    totalScore,
    relationTag,
    relationType = 'ambiguous',
    dominance,
    dominanceDetail,
    psychologySummary,
    aiSummary,
    solution,
    metrics,
    deepMetrics,
    affectionTimeline = [],
    criticalMoments = [],
    messageCount,
    source,
    analysisMeta,
  } = result

  const scoreRing =
    totalScore >= 80 ? 'from-emerald-400 to-emerald-500 shadow-emerald-200/60' :
    totalScore >= 60 ? 'from-brand-400 to-brand-500 shadow-brand-200/60' :
    'from-amber-400 to-amber-500 shadow-amber-200/60'

  const verdict =
    totalScore >= 80 ? '호감 확실 🔥' :
    totalScore >= 65 ? '가능성 있음 ✨' :
    totalScore >= 50 ? '애매함 🤔' :
    '관심 낮음 💤'

  return (
    <div className="animate-fade-in max-w-xl mx-auto">
      {/* Hero */}
      <div className={`rounded-3xl bg-gradient-to-br ${scoreRing} shadow-xl p-8 mb-5 text-center text-white`}>
        <p className="text-sm font-semibold opacity-90 mb-1">{verdict}</p>
        <p className="text-6xl font-black mb-1">{totalScore}</p>
        <p className="text-sm opacity-90 mb-4">호감도 점수</p>
        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/20 backdrop-blur text-sm font-bold">
          {RELATION_EMOJI[relationType] || '💬'} {relationTag}
        </span>
        {aiSummary && (
          <p className="mt-5 text-sm leading-relaxed opacity-95 line-clamp-3">{aiSummary}</p>
        )}
      </div>

      {/* Quick metrics */}
      {metrics && Object.keys(metrics).length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-5">
          {Object.values(metrics).map((m) => (
            <div
              key={m.label}
              className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm"
            >
              <p className="text-2xl mb-1">{METRIC_EMOJI[m.label] || '📊'}</p>
              <p className="text-2xl font-black text-gray-900">{m.score}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Dominance — always visible, simple */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <h3 className="font-black text-gray-800 mb-1 flex items-center gap-2">
          ⚖️ 누가 더 리드?
        </h3>
        <p className="text-brand-600 font-semibold text-sm mb-4">{dominance}</p>
        <DominanceGraph detail={dominanceDetail} />
      </div>

      <AdSlot variant="rectangle" className="mb-5" />

      {/* Collapsible details */}
      <div className="space-y-3 mb-6">
        {solution && (
          <Collapsible title="이렇게 해봐" emoji="💡" defaultOpen>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{solution}</p>
          </Collapsible>
        )}

        {criticalMoments?.length > 0 && (
          <Collapsible title="핵심 카톡 순간" emoji="💬">
            <CriticalMomentBubbles moments={criticalMoments} compact />
          </Collapsible>
        )}

        {affectionTimeline?.length > 0 && (
          <Collapsible title="호감도 변화" emoji="📈">
            <AffectionTrendChart timeline={affectionTimeline} scoreLabel="호감도" compact />
          </Collapsible>
        )}

        {(psychologySummary || deepMetrics) && (
          <Collapsible title="심층 분석" emoji="🧠">
            {psychologySummary && (
              <p className="text-sm text-gray-700 leading-relaxed mb-4">{psychologySummary}</p>
            )}
            <DeepMetricsPanel deepMetrics={deepMetrics} compact />
          </Collapsible>
        )}
      </div>

      <p className="text-center text-[11px] text-gray-400 mb-6">
        {messageCount}개 메시지 분석
        {source === 'claude' && ' · AI'}
        {analysisMeta?.truncated && ` · 최근 ${analysisMeta.analyzedMessages}개`}
      </p>

      <AdSlot variant="banner" className="mb-6" />

      <div className="text-center pb-8">
        <button
          type="button"
          onClick={onReset}
          className="w-full py-4 rounded-2xl bg-gray-900 text-white font-bold text-base hover:bg-gray-800 transition-colors"
        >
          🔄 다른 카톡 분석하기
        </button>
      </div>
    </div>
  )
}
