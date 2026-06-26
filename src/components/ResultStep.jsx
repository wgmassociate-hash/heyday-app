import AdSlot from './AdSlot'
import AffectionTrendChart from './AffectionTrendChart'
import CriticalMomentBubbles from './CriticalMomentBubbles'
import DeepMetricsPanel from './DeepMetricsPanel'

const PLATFORM_LABEL = {
  kakao: { label: '카카오톡', icon: '💬' },
  line: { label: 'LINE', icon: '🟢' },
  sms: { label: '문자/SMS', icon: '📱' },
  generic: { label: '메신저', icon: '💬' },
}

const RELATION_BADGE = {
  romantic: { bg: 'bg-brand-100', text: 'text-brand-700', icon: '💕' },
  friendship: { bg: 'bg-sky-100', text: 'text-sky-700', icon: '🤝' },
  work: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '💼' },
  family: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '👨‍👩‍👧' },
  ambiguous: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '💬' },
}

function ScoreBar({ score, label }) {
  const color =
    score >= 80 ? 'from-emerald-400 to-emerald-500' :
    score >= 60 ? 'from-brand-400 to-brand-500' :
    'from-amber-400 to-amber-500'

  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800">{score}점</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

function DominanceGraph({ detail }) {
  const { personA, personB, personALabel, personBLabel } = detail

  return (
    <div className="space-y-4">
      <div className="flex h-10 rounded-xl overflow-hidden shadow-inner">
        <div
          className="bg-gradient-to-r from-brand-400 to-brand-500 flex items-center justify-center text-white text-xs font-semibold transition-all duration-1000"
          style={{ width: `${personA}%` }}
        >
          {personA >= 20 && `${personA}%`}
        </div>
        <div
          className="bg-gradient-to-r from-violet-400 to-violet-500 flex items-center justify-center text-white text-xs font-semibold transition-all duration-1000"
          style={{ width: `${personB}%` }}
        >
          {personB >= 20 && `${personB}%`}
        </div>
      </div>
      <div className="flex justify-between text-sm">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-brand-500" />
          <span className="text-gray-700 font-medium">{personALabel}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-gray-700 font-medium">{personBLabel}</span>
          <span className="w-3 h-3 rounded-full bg-violet-500" />
        </span>
      </div>
    </div>
  )
}

export default function ResultStep({ result, onReset }) {
  const {
    totalScore,
    relationTag,
    relationType = 'ambiguous',
    detectedTopics = [],
    scoreLabel = '대화 점수',
    reportTitle = '대화 분석 리포트',
    solutionTitle = '소통 개선 제안',
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
    conversationMeta,
    analysisMeta,
  } = result

  const badge = RELATION_BADGE[relationType] ?? RELATION_BADGE.ambiguous
  const platformInfo = PLATFORM_LABEL[conversationMeta?.platform] ?? PLATFORM_LABEL.generic

  const scoreRing =
    totalScore >= 80 ? 'from-emerald-400 to-emerald-600' :
    totalScore >= 60 ? 'from-brand-400 to-brand-600' :
    'from-amber-400 to-amber-600'

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-sm text-gray-500 mb-2">
          심층 분석 완료 ✨ · {messageCount}개 메시지
          {source === 'claude' && <span className="ml-2 text-violet-500 font-medium">· Claude AI</span>}
          {source === 'local' && <span className="ml-2 text-gray-400">· 로컬 분석</span>}
          {analysisMeta?.truncated && (
            <span className="ml-2 text-gray-400">
              · 최근 {analysisMeta.analyzedMessages}개 구간 AI 분석
            </span>
          )}
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{reportTitle}</h2>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
          {badge.icon}{' '}
          {relationType === 'romantic' ? '연애·호감 관계' :
           relationType === 'friendship' ? '친구·지인 관계' :
           relationType === 'work' ? '업무·협업 관계' :
           relationType === 'family' ? '가족·지인 관계' : '관계 유형 미분류'}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
          {platformInfo.icon} {platformInfo.label}
        </span>
        {conversationMeta?.spanDays > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
            📅 {conversationMeta.spanLabel}
            {conversationMeta.dateRange && (
              <span className="text-indigo-400">
                ({conversationMeta.dateRange.start}~{conversationMeta.dateRange.end})
              </span>
            )}
          </span>
        )}
      </div>

      {/* removed duplicate badge block below */}

      {detectedTopics.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {detectedTopics.map((topic) => (
            <span key={topic} className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium">
              #{topic}
            </span>
          ))}
        </div>
      )}

      {/* Hero score */}
      <div className="bg-white rounded-3xl shadow-lg shadow-brand-100/50 border border-brand-100 p-8 mb-6 text-center">
        <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br ${scoreRing} text-white shadow-xl mb-4`}>
          <div>
            <p className="text-4xl font-black text-white">{totalScore}</p>
            <p className="text-xs text-white/80 font-medium">{scoreLabel}</p>
          </div>
        </div>
        <span className="inline-block px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 font-semibold text-sm">
          {relationTag}
        </span>
      </div>

      {/* Psychology summary — deep layer */}
      {psychologySummary && (
        <div className="bg-gradient-to-br from-violet-900 to-brand-900 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <h3 className="font-bold mb-2 flex items-center gap-2 text-violet-200">
            <span>🧬</span> 심리학적 관계 역학
          </h3>
          <p className="text-sm md:text-base leading-relaxed text-violet-50/95">{psychologySummary}</p>
        </div>
      )}

      <AdSlot variant="leaderboard" className="mb-6" />

      {/* Trend chart */}
      <div className="mb-6">
        <AffectionTrendChart timeline={affectionTimeline} scoreLabel={scoreLabel.replace(' 점수', '')} />
      </div>

      {/* Deep metrics */}
      <div className="mb-6">
        <DeepMetricsPanel deepMetrics={deepMetrics} />
      </div>

      {/* Critical moments — speech bubbles */}
      <div className="mb-6">
        <CriticalMomentBubbles moments={criticalMoments} />
      </div>

      <AdSlot variant="rectangle" className="mb-6" />

      {/* Dominance */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
          <span>⚖️</span> 대화 주도권 분석
        </h3>
        <p className="text-brand-600 font-medium text-sm mb-4">{dominance}</p>
        <DominanceGraph detail={dominanceDetail} />
      </div>

      {metrics && Object.keys(metrics).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 space-y-4">
          <h3 className="font-bold text-gray-800 mb-2">📊 세부 지표</h3>
          {Object.values(metrics).map((m) => (
            <ScoreBar key={m.label} score={m.score} label={m.label} />
          ))}
        </div>
      )}

      {/* AI Summary */}
      <div className="bg-gradient-to-br from-brand-50 to-violet-50 rounded-2xl border border-brand-100 p-6 mb-6">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>🤖</span> AI 대화 요약 리포트
        </h3>
        <p className="text-gray-700 leading-relaxed text-sm md:text-base">{aiSummary}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>💡</span> {solutionTitle}
        </h3>
        <p className="text-gray-700 leading-relaxed text-sm md:text-base whitespace-pre-line">{solution}</p>
      </div>

      <AdSlot variant="banner" className="mb-8" />

      <div className="text-center pb-8">
        <button
          type="button"
          onClick={onReset}
          className="px-8 py-3 rounded-full border-2 border-brand-300 text-brand-600 font-semibold hover:bg-brand-50 transition-colors duration-200"
        >
          ↩ 다른 대화 분석하기
        </button>
      </div>
    </div>
  )
}
