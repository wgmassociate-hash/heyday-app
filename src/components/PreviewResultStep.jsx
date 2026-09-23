import { useState } from 'react'
import AdSlot from './AdSlot'
import { INTENT_OPTIONS } from '../../shared/intentOptions.js'
import { getPreviewAnalyzability } from '../utils/previewSufficiency.js'

/** Phase 2 — Free Preview result (docs/prd_v2.md §20.2, docs/implementation_plan_v2.md
 * §12.4). Renders `recentConversationTemperature`/`recentRomanceSignal` — the
 * Preview-scoped numbers — never a field named like the (future, Paid-only)
 * "관계온도"/"연애시그널" without the "최근" qualifier, so this component
 * can't accidentally imply it read the whole conversation.
 *
 * Phase 2.1 — Product UX Calibration pass: confidence-aware number display
 * (item 1), a sufficiency notice (item 2), a renamed/de-hyped Evidence label
 * (item 3A), a dynamic Paywall teaser built from this same result's own
 * metrics (item 5), and a reordered section layout (item 9).
 *
 * Phase 2.4 — Rich Free Preview / Reward Layer: renders `result.report`
 * (server/engine/narrative/previewReport.ts) — direct answer, relationship
 * status, per-metric interpretation, 2-4 relationship patterns, a
 * psychological-interpretation paragraph, an AI conversation summary, up to 2
 * key scenes with real excerpts, a 나 vs 상대 comparison line, tips, and an
 * Intent-mismatch reframe CTA. All of it reads fields the pipeline already
 * computed — no new API calls here, no engine threshold changes.
 */

const INTENT_LABEL_BY_VALUE = Object.fromEntries(INTENT_OPTIONS.map((opt) => [opt.value, opt.label]))

/** Phase 2.2 (Short Conversation Result Calibration) item 1 — confidence now
 * controls *how strongly a number is interpreted*, not whether it's shown at
 * all. Only `score === null` (the engine's "not enough opportunity to judge
 * this metric" state, confidence.ts's MIN_JUDGEABLE_OPPORTUNITY) hides the
 * number — every judgeable score, including `low` confidence, is displayed,
 * softened by a caption instead of hidden behind "판단할 대화가 부족해요"
 * (Phase 2.1's version conflated "low confidence" with "no data", which is
 * what produced a screen repeating that line for every metric even when the
 * engine had a real number for most of them). */
const CONFIDENCE_CAPTION = {
  high: '비교적 뚜렷해요',
  medium: '어느 정도 단서가 있어요',
  low: '아직 참고용이에요',
}

export function ScoreBar({ score, label, confidence, note }) {
  if (score === null) {
    return (
      <div>
        <p className="text-sm text-gray-600 font-medium mb-1.5">{label}</p>
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs text-gray-400 font-semibold">
          판단할 단서가 아직 없어요
        </div>
      </div>
    )
  }

  const color =
    score >= 70 ? 'from-emerald-400 to-emerald-500' :
    score >= 40 ? 'from-brand-400 to-brand-500' :
    'from-amber-400 to-amber-500'

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="font-bold text-gray-800">{score}점</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`}
          style={{ width: `${score}%` }}
        />
      </div>
      {note && <p className="text-xs text-gray-500 leading-relaxed mb-1">{note}</p>}
      {confidence && CONFIDENCE_CAPTION[confidence] && (
        <p className="text-[11px] text-gray-400 font-medium">{CONFIDENCE_CAPTION[confidence]}</p>
      )}
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

function Core4Section({ core4, report }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-700 mb-2">💬 관심도</p>
        <div className="space-y-2">
          {orderedSpeakerEntries(core4.interest.bySpeaker).map(([speakerId, s]) => (
            <ScoreBar key={speakerId} score={s.score} confidence={s.confidence} label={speakerId} note={report?.interestNotes?.[speakerId]?.caption} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-700 mb-2">🫶 친밀도</p>
        <div className="space-y-2">
          {orderedSpeakerEntries(core4.intimacy.bySpeaker).map(([speakerId, s]) => (
            <ScoreBar key={speakerId} score={s.score} confidence={s.confidence} label={speakerId} note={report?.intimacyNotes?.[speakerId]?.caption} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-700 mb-2">🔁 서로 반응하는 정도</p>
        <ScoreBar
          score={core4.reciprocity.score}
          confidence={core4.reciprocity.confidence}
          label="질문·감정·제안에 서로 반응하는 정도"
          note={report?.reciprocityNote?.caption}
        />
      </div>
    </div>
  )
}

/** Item 9: Position was computed by the engine (PRD §11) but never surfaced
 * in the UI until this pass. */
const POSITION_LABELS = {
  warming_up_toward_romance: '가까워지는 썸 같아요',
  close_friendship: '친밀한 친구 사이 같아요',
  unstable_attraction: '끌림은 있지만 아직 불안정해요',
  still_forming: '아직 신호가 약해요',
  insufficient_data: '아직 판단하기엔 데이터가 부족해요',
}

/** Phase 2.2 item 2 — the ONLY place strong "단서가 부족해요" language is
 * still used, reserved for `analyzability === 'truly_insufficient'` (Temperature
 * itself came back null — see previewSufficiency.js's getPreviewAnalyzability).
 * Replaces the whole numeric breakdown with one clear message instead of
 * repeating "판단할 단서가 아직 없어요" once per ScoreBar. */
function InsufficientNotice({ onAddMoreConversation }) {
  return (
    <section className="bg-gray-50 rounded-3xl border border-gray-100 p-5 mb-4">
      <p className="text-sm font-black text-gray-700 mb-1.5">
        아직 분석할 수 있는 관계 단서가 부족해요.
      </p>
      <p className="text-xs text-gray-500 leading-relaxed mb-3">
        기존 입력에 대화를 더 붙여넣고 처음부터 다시 분석할 수 있어요.
      </p>
      <button
        type="button"
        onClick={onAddMoreConversation}
        className="w-full py-2.5 rounded-2xl font-bold text-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
      >
        입력 보완해서 다시 분석하기
      </button>
      <p className="mt-2 text-[11px] text-gray-400 text-center">
        새 결과가 현재 결과를 대체하며 분석 1회가 사용돼요.
      </p>
    </section>
  )
}

/** Phase 2.2 item 7 — `limited_but_analyzable` gets softened copy: this is a
 * real, short-but-normal conversation, not a failed analysis, so the notice
 * leads with "잠정 분석" rather than "단서가 부족해요" (which now only
 * appears for the separate truly_insufficient state above). Renders nothing
 * for 'normal'. */
function LimitedAnalysisNotice() {
  return (
    <section className="bg-amber-50/80 rounded-3xl border border-amber-100 p-5 mb-4">
      <p className="text-sm font-black text-amber-800 mb-1.5">
        짧은 대화 기준 잠정 분석이에요.
      </p>
      <p className="text-xs text-amber-700/90 leading-relaxed mb-3">
        현재 결과는 짧은 대화를 기준으로 한 참고용 분석이에요.
      </p>
    </section>
  )
}

/** Renders a paragraph string (previewReport.ts joins paragraphs with a blank
 * line) as separate <p> blocks instead of one run-on block. */
function Paragraphs({ text, className }) {
  return text.split('\n\n').filter(Boolean).map((para, i) => (
    <p key={i} className={className}>{para}</p>
  ))
}

export default function PreviewResultStep({ result, onReset, onAddMoreConversation }) {
  const { preview, narrative, topSignal, paywallTeasers = [], intent } = result
  const [showAlternateReport, setShowAlternateReport] = useState(false)
  const activeReport = showAlternateReport && result.alternateReport ? result.alternateReport : result.report
  const temperature = preview.recentConversationTemperature
  const romance = preview.recentRomanceSignal
  const position = preview.recentRelationshipPosition
  const analyzability = getPreviewAnalyzability(preview)
  const keyScenes = activeReport?.keyScenes?.length ? activeReport.keyScenes : null

  return (
    <div className="animate-fade-in max-w-xl mx-auto">
      {/* 1. 분석 범위 헤더 */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4 text-center">
        <p className="text-xs font-bold text-brand-500 mb-2">
          {preview.windowLabel}
          {preview.windowMessageCount > 0 && ` · ${preview.windowMessageCount}개 메시지 기준`}
          {' '}· 무료 미리보기
        </p>

        {/* 2. 내가 선택한 질문 + 3. 직접 답 */}
        {intent && INTENT_LABEL_BY_VALUE[intent] && (
          <p className="text-sm font-bold text-gray-500 mb-1.5">"{INTENT_LABEL_BY_VALUE[intent]}"</p>
        )}
        <p className="text-lg font-black text-gray-900 leading-snug">
          {activeReport?.directAnswer || narrative.firstVerdict}
        </p>
      </section>

      {/* 4. 현재 관계 상태 */}
      {activeReport?.relationshipStatus && (
        <p className="text-center text-sm font-bold text-violet-700 bg-violet-50 rounded-2xl py-2 px-3 mb-4">
          {activeReport.relationshipStatus}
        </p>
      )}

      {analyzability === 'truly_insufficient' ? (
        <InsufficientNotice onAddMoreConversation={onAddMoreConversation} />
      ) : (
        /* 5. 관계온도 + 연애 시그널 (Result Top 광고는 이 다음, Core 지표보다 먼저) */
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4 space-y-5">
          {position && POSITION_LABELS[position.label] && (
            <p className="text-center text-sm font-bold text-violet-700 bg-violet-50 rounded-2xl py-2 px-3">
              {POSITION_LABELS[position.label]}
            </p>
          )}
          <ScoreBar score={temperature.score} confidence={temperature.confidence} label={`🌡️ ${preview.windowLabel} 온도`} />
          <ScoreBar score={romance.score} label="💘 연애 시그널" />
        </section>
      )}

      {/* Result Top 광고 — 질문에 대한 직접 답 + 현재 관계 상태 + 관계온도/Romance를
       * 먼저 보여준 "뒤에" 나온다 (분석 결과보다 광고가 먼저 나오면 안 됨).
       * 항상 정확히 1개 렌더 — analyzability 상태와 무관. */}
      <AdSlot variant="resultTop" className="my-4" />

      {analyzability !== 'truly_insufficient' && (
        <>
          {/* 6. Core 관계지표 (숫자 + 해석) */}
          <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
            <p className="text-sm font-bold text-gray-700 mb-3">Core 4</p>
            <Core4Section core4={preview.core4Preview} report={activeReport} />
          </section>

          {/* 누가 먼저 대화를 열었나 */}
          <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
            <p className="text-sm font-bold text-gray-700 mb-2">🙋 누가 먼저 대화를 열었나</p>
            <InitiativeRatio ratioBySpeaker={preview.initiativeRatioPreview.ratioBySpeaker} />
            {activeReport?.initiationSentence && (
              <p className="text-xs text-gray-500 leading-relaxed mt-2">{activeReport.initiationSentence}</p>
            )}
          </section>

          {/* 7. 대화 충분성 안내 (필요한 경우) */}
          {analyzability === 'limited_but_analyzable' && (
            <LimitedAnalysisNotice />
          )}
        </>
      )}

      {/* 8. AI가 발견한 관계 패턴 */}
      {activeReport?.patterns?.length > 0 && (
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
          <p className="text-sm font-bold text-gray-700 mb-3">🧩 AI가 발견한 관계 패턴</p>
          <ul className="space-y-2">
            {activeReport.patterns.map((pattern) => (
              <li key={pattern.key} className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-2xl p-3">
                {pattern.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 9. 관계 심리 해석 */}
      {activeReport?.psychologicalInterpretation && (
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
          <p className="text-sm font-bold text-gray-700 mb-2">🧠 관계 심리 해석</p>
          <Paragraphs text={activeReport.psychologicalInterpretation} className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0" />
        </section>
      )}

      {/* 10. AI 대화 요약 */}
      {activeReport?.aiSummary && (
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
          <p className="text-sm font-bold text-gray-700 mb-2">📝 AI 대화 요약</p>
          <Paragraphs text={activeReport.aiSummary} className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0" />
        </section>
      )}

      {/* Result Middle 광고 — Core 지표/패턴/심리해석/AI요약까지 본 뒤,
       * 핵심 장면 이전. 긴 Rich Preview의 중간 지점. 항상 정확히 1개 렌더. */}
      <AdSlot variant="resultMiddle" className="my-4" />

      {/* 11. AI가 눈여겨본 핵심 장면 (최대 2개) */}
      {keyScenes ? (
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4 space-y-4">
          <p className="text-sm font-bold text-gray-700">👀 AI가 눈여겨본 장면</p>
          {keyScenes.map((scene, i) => (
            <div key={i}>
              <p className="text-xs font-bold text-gray-400 mb-1">{scene.speakerId}</p>
              <p className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-700 leading-relaxed mb-1.5">"{scene.excerpt}"</p>
              <p className="text-xs text-gray-500 leading-relaxed">→ {scene.interpretation}</p>
            </div>
          ))}
        </section>
      ) : (
        topSignal && (
          <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
            <p className="text-sm font-bold text-gray-700 mb-2">👀 AI가 눈여겨본 장면</p>
            <p className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-700 leading-relaxed">
              {topSignal.reason}
            </p>
          </section>
        )
      )}

      {/* 12. 나 vs 상대 */}
      {activeReport?.comparisonLine && (
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
          <p className="text-sm font-bold text-gray-700 mb-2">⚖️ 나 vs 상대</p>
          <p className="text-sm text-gray-700 leading-relaxed">{activeReport.comparisonLine}</p>
        </section>
      )}

      {/* 13. 지금 해볼 수 있는 Tip */}
      {activeReport?.tips?.length > 0 && (
        <section className="bg-emerald-50/60 rounded-3xl border border-emerald-100 p-5 mb-4">
          <p className="text-sm font-black text-emerald-800 mb-2">💡 지금 해볼 수 있는 Tip</p>
          <ul className="space-y-3">
            {activeReport.tips.map((tip, i) => (
              <li key={i} className="text-sm text-emerald-900/90 leading-relaxed">• {tip}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 14. Intent mismatch 안내 */}
      {result.report?.mismatch && (
        <section className="bg-amber-50/80 rounded-3xl border border-amber-100 p-5 mb-4">
          <p className="text-sm text-amber-800 leading-relaxed mb-3">{result.report.mismatch.message}</p>
          <button
            type="button"
            onClick={() => setShowAlternateReport((v) => !v)}
            className="w-full py-2.5 rounded-2xl font-bold text-sm bg-white border border-amber-200 text-amber-800 hover:bg-amber-50"
          >
            {showAlternateReport ? `↩ "${INTENT_LABEL_BY_VALUE[intent] || '원래 질문'}" 관점으로 돌아가기` : result.report.mismatch.ctaLabel}
          </button>
        </section>
      )}

      {/* 15-16. 아직 남은 질문 + Locked teaser */}
      {paywallTeasers.length > 0 && (
        <section className="rounded-3xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-5 mb-4">
          <p className="text-sm font-black text-brand-700 mb-3">🤔 아직 남은 질문</p>
          <ul className="space-y-3 mb-4">
            {paywallTeasers.map((teaser) => (
              <li key={teaser.question} className="text-xs">
                <p className="text-gray-700 font-medium leading-relaxed mb-1">{teaser.question}</p>
                <p className="text-brand-600 font-bold">{teaser.lockedLabel}</p>
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
      )}

      {/* Result Bottom 광고 — 장면/비교/Tip/mismatch/paywall teaser 다음, 마지막
       * 광고. "다른 대화 분석하기" 버튼과 헷갈리지 않도록 위아래 여백을 넉넉히 둔다. */}
      <AdSlot variant="resultBottom" className="mt-2 mb-8" />

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
