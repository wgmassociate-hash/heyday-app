import PrivacyBadge from './PrivacyBadge'
import SeoContent from './SeoContent'
import UsageGuide from './UsageGuide'
import MobileImportPanel from './MobileImportPanel'
import SelfSpeakerPick from './SelfSpeakerPick'
import ShareQuotaPanel from './ShareQuotaPanel'
import { extractSpeakerNames } from '../utils/parseChat.js'
import { isAlreadyAnonymized, textHasSelfSpeaker, needsSelfSpeakerSelection } from '../utils/speakerLabels.js'

export default function InputStep({
  chatText,
  onChange,
  onSubmit,
  isValid,
  quota,
  onQuotaUpdate,
  shareHighlight = false,
  sharePanelRef,
}) {
  const speakers = chatText.trim() ? extractSpeakerNames(chatText) : []
  const hasText = chatText.trim().length > 0
  const anonymized = isAlreadyAnonymized(chatText)
  const needsSelfPick = needsSelfSpeakerSelection(chatText)
  const quotaBlocked = quota && !quota.canAnalyze
  const canAnalyze = isValid && !needsSelfPick && !quotaBlocked

  const guideStep = !hasText ? 1 : needsSelfPick ? 2 : isValid && !quotaBlocked ? 3 : 1

  const buttonLabel = quotaBlocked
    ? '🥲 오늘 횟수 다 썼어'
    : needsSelfPick
      ? '👆 위에서 본인 먼저 선택'
      : !hasText
        ? '① 대화를 먼저 올려줘'
        : !isValid
          ? '대화가 너무 짧아 (3줄 이상)'
          : '🔥 호감도 분석 시작'

  return (
    <div className="animate-fade-in">
      <section className="text-center mb-6">
        <p className="text-4xl mb-3" aria-hidden="true">💬💕</p>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight mb-2">
          카톡 올리면
          <span className="text-brand-500"> 썸·호감도</span> 알려줘
        </h1>
        <p className="text-gray-500 text-sm">
          캡처 찍거나 · 붙여넣기만 하면 끝
        </p>
        {quota && !quota.disabled && (
          <p className="text-[11px] text-gray-400 mt-2">
            하루 기본 {quota.baseDaily}회 · 공유하면 최대 {quota.dailyCap}회
          </p>
        )}
      </section>

      <div className="max-w-xl mx-auto">
        <UsageGuide activeStep={guideStep} />

        <div className="flex justify-center mb-4">
          <PrivacyBadge />
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 md:p-5 mb-4">
          <MobileImportPanel
            chatText={chatText}
            onChange={onChange}
            onQuotaUpdate={onQuotaUpdate}
            onQuotaBlocked={() => onQuotaUpdate?.()}
          />

          {anonymized && textHasSelfSpeaker(chatText) && (
            <p className="mt-3 text-xs text-emerald-600 font-semibold text-center">✅ 이름 가림 완료</p>
          )}
          {needsSelfPick && (
            <p className="mt-3 text-xs text-amber-700 font-bold text-center">② 아래에서 너는 누구인지 골라줘</p>
          )}
          {!anonymized && hasText && speakers.length > 0 && !needsSelfPick && (
            <p className="mt-3 text-xs text-emerald-600 font-semibold text-center">✅ {speakers.length}명 대화 감지</p>
          )}

          <SelfSpeakerPick chatText={chatText} onAssign={onChange} />
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canAnalyze && !quotaBlocked}
          className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg transition-all duration-200 active:scale-[0.98] ${
            quotaBlocked
              ? 'bg-amber-100 text-amber-800 border-2 border-amber-200 hover:bg-amber-50'
              : 'bg-gradient-to-r from-brand-500 to-violet-500 text-white shadow-brand-200/80 hover:from-brand-600 hover:to-violet-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none'
          } ${!canAnalyze && !quotaBlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {buttonLabel}
        </button>
        {canAnalyze && (
          <p className="text-center text-xs text-gray-400 mt-2">
            저장 안 함 · 캡처 OCR도 1회 · 보통 30초
          </p>
        )}
        {!canAnalyze && !needsSelfPick && !quotaBlocked && (
          <p className="text-center text-xs text-gray-400 mt-2">
            {hasText ? '대화 길이를 확인해줘' : '위에서 캡처 또는 붙여넣기를 선택해줘'}
          </p>
        )}

        {quotaBlocked && (
          <div ref={sharePanelRef} className="mt-4">
            <ShareQuotaPanel
              quota={quota}
              onSuccess={onQuotaUpdate}
              highlight={shareHighlight}
              showWhen="blocked-only"
            />
            <p className="text-center text-xs text-amber-600 font-semibold mt-2">
              공유하면 오늘 1번 더 분석할 수 있어
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-500 mt-4">
          <a
            href="https://www.heydaystar.co.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-gray-300 hover:text-brand-600"
          >
            연애·심리 글 읽기 → heydaystar 블로그
          </a>
        </p>
      </div>

      <SeoContent />
    </div>
  )
}
