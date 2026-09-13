import AdSlot from './AdSlot'

/** Phase 2 — Free Preview result (docs/prd_v2.md §20.2, docs/implementation_plan_v2.md
 * §12.4). Renders `recentConversationTemperature`/`recentRomanceSignal` — the
 * Preview-scoped numbers — never a field named like the (future, Paid-only)
 * "관계온도"/"연애시그널" without the "최근" qualifier, so this component
 * can't accidentally imply it read the whole conversation. */

function ScoreBar({ score, label, confidence }) {
  const value = score ?? 0
  const color =
    value >= 70 ? 'from-emerald-400 to-emerald-500' :
    value >= 40 ? 'from-brand-400 to-brand-500' :
    'from-amber-400 to-amber-500'

  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="font-bold text-gray-800">
          {score === null ? '판단 보류' : `${score}점`}
          {confidence && score !== null && (
            <span className="ml-1 text-[11px] font-normal text-gray-400">
              ({confidence === 'high' ? '신뢰도 높음' : confidence === 'medium' ? '신뢰도 보통' : '신뢰도 낮음'})
            </span>
          )}
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`}
          style={{ width: `${score === null ? 0 : value}%` }}
        />
      </div>
    </div>
  )
}

function orderedSpeakerEntries(bySpeaker) {
  return Object.entries(bySpeaker).sort(([a], [b]) => (a === '나' ? -1 : b === '나' ? 1 : 0))
}

function InitiativeRatio({ ratioBySpeaker }) {
  const entries = orderedSpeakerEntries(ratioBySpeaker)
  return (
    <div className="space-y-2">
      <div className="flex h-10 rounded-2xl overflow-hidden shadow-inner">
        {entries.map(([speakerId, ratio], i) => (
          <div
            key={speakerId}
            className={`flex items-center justify-center text-white text-xs font-bold transition-all duration-1000 ${
              i === 0 ? 'bg-gradient-to-r from-brand-400 to-brand-500' : 'bg-gradient-to-r from-violet-400 to-violet-500'
            }`}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          >
            {ratio >= 0.16 && `${Math.round(ratio * 100)}%`}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs font-semibold text-gray-600">
        {entries.map(([speakerId]) => (
          <span key={speakerId}>{speakerId}</span>
        ))}
      </div>
    </div>
  )
}

function Core4Section({ core4 }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-700 mb-2">💬 관심도</p>
        <div className="space-y-2">
          {orderedSpeakerEntries(core4.interest.bySpeaker).map(([speakerId, s]) => (
            <ScoreBar key={speakerId} score={s.score} confidence={s.confidence} label={speakerId} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-700 mb-2">🫶 친밀도</p>
        <div className="space-y-2">
          {orderedSpeakerEntries(core4.intimacy.bySpeaker).map(([speakerId, s]) => (
            <ScoreBar key={speakerId} score={s.score} confidence={s.confidence} label={speakerId} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-700 mb-2">🔁 상호성</p>
        <ScoreBar score={core4.reciprocity.score} confidence={core4.reciprocity.confidence} label="서로 주고받는 정도" />
      </div>
    </div>
  )
}

const LOCKED_FEATURES = [
  '결정적 카톡 전체 (지금은 1개만 무료 공개)',
  '관심·거리두기 Signal 전체 근거',
  '관계 변화 추이 · 결정적 순간',
  '나 vs 상대 상세 비교',
  'AI Deep Narrative · 지금 어떻게 행동할지',
]

export default function PreviewResultStep({ result, onReset }) {
  const { preview, narrative, topSignal } = result
  const temperature = preview.recentConversationTemperature
  const romance = preview.recentRomanceSignal

  return (
    <div className="animate-fade-in max-w-xl mx-auto">
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4 text-center">
        <p className="text-xs font-bold text-brand-500 mb-2">{preview.windowLabel} · 무료 미리보기</p>
        <p className="text-lg font-black text-gray-900 leading-snug">{narrative.firstVerdict}</p>
      </section>

      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4 space-y-5">
        <ScoreBar score={temperature.score} confidence={temperature.confidence} label={`🌡️ ${preview.windowLabel} 온도`} />
        <ScoreBar score={romance.score} label="💘 연애 시그널" />
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">⚖️ 누가 더 관계를 움직였나</p>
          <InitiativeRatio ratioBySpeaker={preview.initiativeRatioPreview.ratioBySpeaker} />
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
        <p className="text-sm font-bold text-gray-700 mb-3">Core 4</p>
        <Core4Section core4={preview.core4Preview} />
      </section>

      {topSignal && (
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
          <p className="text-sm font-bold text-gray-700 mb-2">👀 결정적 카톡 1개 (무료 공개)</p>
          <p className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-700 leading-relaxed">
            {topSignal.reason}
          </p>
        </section>
      )}

      <section className="rounded-3xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-5 mb-4">
        <p className="text-sm font-black text-brand-700 mb-3">🔒 전체 리포트에서 더 볼 수 있어요</p>
        <ul className="space-y-1.5 mb-4">
          {LOCKED_FEATURES.map((feature) => (
            <li key={feature} className="text-xs text-gray-500 flex items-start gap-1.5">
              <span aria-hidden="true">·</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled
          className="w-full py-3 rounded-2xl font-black text-sm bg-gray-200 text-gray-400 cursor-not-allowed"
        >
          전체 리포트 보기 (준비 중)
        </button>
      </section>

      <AdSlot variant="banner" className="mb-4" />

      <button
        type="button"
        onClick={onReset}
        className="w-full py-3 rounded-2xl font-bold text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
      >
        ↩ 다른 대화 분석하기
      </button>
    </div>
  )
}
