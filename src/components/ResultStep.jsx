import AdSlot from './AdSlot'
import AffectionTrendChart from './AffectionTrendChart'
import CriticalMomentBubbles from './CriticalMomentBubbles'
import DeepMetricsPanel from './DeepMetricsPanel'
import ShareQuotaPanel from './ShareQuotaPanel'
import ResultShareActions from './ResultShareActions'

const PLATFORM_LABEL = {
  kakao: { label: '카카오톡', icon: '💬' },
  line: { label: 'LINE', icon: '🟢' },
  sms: { label: '문자', icon: '📱' },
  generic: { label: '메신저', icon: '💬' },
}

const RELATION_BADGE = {
  romantic: { bg: 'bg-brand-100', text: 'text-brand-700', icon: '💕', label: '썸·연애' },
  friendship: { bg: 'bg-sky-100', text: 'text-sky-700', icon: '🤝', label: '친구' },
  work: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '💼', label: '학교·업무' },
  family: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '👨‍👩‍👧', label: '가족' },
  ambiguous: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '💬', label: '관계 미정' },
}

function ScoreBar({ score, label }) {
  const color =
    score >= 80 ? 'from-emerald-400 to-emerald-500' :
    score >= 60 ? 'from-brand-400 to-brand-500' :
    'from-amber-400 to-amber-500'

  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="font-bold text-gray-800">{score}점</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
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
      <div className="flex h-12 rounded-2xl overflow-hidden shadow-inner">
        <div
          className="bg-gradient-to-r from-brand-400 to-brand-500 flex items-center justify-center text-white text-sm font-bold transition-all duration-1000"
          style={{ width: `${personA}%` }}
        >
          {personA >= 18 && `${personA}%`}
        </div>
        <div
          className="bg-gradient-to-r from-violet-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold transition-all duration-1000"
          style={{ width: `${personB}%` }}
        >
          {personB >= 18 && `${personB}%`}
        </div>
      </div>
      <div className="flex justify-between text-sm font-semibold">
        <span className="flex items-center gap-2 text-brand-600">
          <span className="w-3 h-3 rounded-full bg-brand-500" />
          {personALabel}
        </span>
        <span className="flex items-center gap-2 text-violet-600">
          {personBLabel}
          <span className="w-3 h-3 rounded-full bg-violet-500" />
        </span>
      </div>
    </div>
  )
}

function verdictLabel(score) {
  if (score >= 80) return '호감 확실 🔥'
  if (score >= 65) return '가능성 있음 ✨'
  if (score >= 50) return '애매함 🤔'
  return '관심 낮음 💤'
}

export default function ResultStep({ result, onReset, quota, onQuotaUpdate, onShareBonus }) {
  const {
    totalScore,
    relationTag,
    relationType = 'ambiguous',
    detectedTopics = [],
    scoreLabel = '호감도',
    reportTitle = '대화 분석 리포트',
    solutionTitle = '이렇게 해봐',
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
      <div className="text-center mb-6">
        <p className="text-sm text-gray-500 mb-1">
          분석 완료 ✨ · {messageCount}개 메시지
          {source === 'claude' && <span className="ml-1 text-violet-500 font-semibold">· AI</span>}
          {analysisMeta?.truncated && (
            <span className="ml-1 text-gray-400">· 최근 {analysisMeta.analyzedMessages}개</span>
          )}
        </p>
        <h2 className="text-2xl md:text-3xl font-black text-gray-900">{reportTitle}</h2>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-5">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
          {badge.icon} {badge.label}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
          {platformInfo.icon} {platformInfo.label}
        </span>
        {conversationMeta?.spanDays > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
            📅 {conversationMeta.spanLabel}
          </span>
        )}
      </div>

      {detectedTopics.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {detectedTopics.map((topic) => (
            <span key={topic} className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
              #{topic}
            </span>
          ))}
        </div>
      )}

      {/* Hero score */}
      <div className="bg-white rounded-3xl shadow-lg shadow-brand-100/50 border border-brand-100 p-8 mb-6 text-center">
        <p className="text-sm font-bold text-brand-600 mb-3">{verdictLabel(totalScore)}</p>
        <div className={`inline-flex items-center justify-center w-36 h-36 rounded-full bg-gradient-to-br ${scoreRing} text-white shadow-xl mb-4`}>
          <div>
            <p className="text-5xl font-black">{totalScore}</p>
            <p className="text-xs text-white/90 font-semibold mt-0.5">{scoreLabel}</p>
          </div>
        </div>
        <span className="inline-block px-5 py-2 rounded-full bg-brand-100 text-brand-700 font-bold text-sm">
          {relationTag}
        </span>
      </div>

      <ResultShareActions
        result={{
          totalScore,
          relationTag,
          scoreLabel,
          aiSummary,
          psychologySummary,
          dominance,
          dominanceDetail,
          metrics,
          deepMetrics,
          criticalMoments,
          solution,
          solutionTitle,
          detectedTopics,
        }}
        onShareSuccess={onShareBonus}
      />

      {psychologySummary && (
        <div className="bg-gradient-to-br from-violet-900 to-brand-900 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <h3 className="font-black mb-2 flex items-center gap-2 text-violet-200">
            <span>🧬</span> 관계 심리 분석
          </h3>
          <p className="text-sm md:text-base leading-relaxed text-violet-50/95 whitespace-pre-line">{psychologySummary}</p>
        </div>
      )}

      <AdSlot variant="leaderboard" className="mb-6" />

      <div className="mb-6">
        <AffectionTrendChart timeline={affectionTimeline} scoreLabel={scoreLabel.replace(' 점수', '')} />
      </div>

      <div className="mb-6">
        <DeepMetricsPanel deepMetrics={deepMetrics} />
      </div>

      <div className="mb-6">
        <CriticalMomentBubbles moments={criticalMoments} />
      </div>

      <AdSlot variant="rectangle" className="mb-6" />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h3 className="font-black text-gray-800 mb-1 flex items-center gap-2">
          <span>⚖️</span> 누가 더 리드?
        </h3>
        <p className="text-brand-600 font-semibold text-sm mb-4 whitespace-pre-line">{dominance}</p>
        <DominanceGraph detail={dominanceDetail} />
      </div>

      {metrics && Object.keys(metrics).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 space-y-5">
          <h3 className="font-black text-gray-800">📊 세부 점수</h3>
          {Object.values(metrics).map((m) => (
            <ScoreBar key={m.label} score={m.score} label={m.label} />
          ))}
        </div>
      )}

      <div className="bg-gradient-to-br from-brand-50 to-violet-50 rounded-2xl border border-brand-100 p-6 mb-6">
        <h3 className="font-black text-gray-800 mb-3 flex items-center gap-2">
          <span>🤖</span> AI 대화 요약
        </h3>
        <p className="text-gray-700 leading-relaxed text-sm md:text-base whitespace-pre-line">{aiSummary}</p>
      </div>

      {solution && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h3 className="font-black text-gray-800 mb-3 flex items-center gap-2">
            <span>💡</span> {solutionTitle}
          </h3>
          <p className="text-gray-700 leading-relaxed text-sm md:text-base whitespace-pre-line">{solution}</p>
        </div>
      )}

      <AdSlot variant="banner" className="mb-6" />

      <div className="mb-6">
        <ShareQuotaPanel
          quota={quota}
          onSuccess={onQuotaUpdate}
          variant="compact"
        />
      </div>

      <div className="text-center pb-8">
        <button
          type="button"
          onClick={onReset}
          className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-gray-900 text-white font-bold text-base hover:bg-gray-800 transition-colors"
        >
          🔄 다른 카톡 분석하기
        </button>
      </div>
    </div>
  )
}
