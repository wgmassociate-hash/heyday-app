/** Phase 2.1 — Privacy Review (Product UX Calibration items 6/7/8).
 *
 * Sits between InputStep and LoadingStep: shows exactly what will be sent to
 * the relationship-analysis LLM (already anonymized/redacted, never the raw
 * text) and requires an explicit confirmation before analysis runs. Never
 * gated behind payment (item 7) — this screen has no quota/paywall checks of
 * its own.
 */
export default function PrivacyReviewStep({ privacyPreview, sourceType, onConfirm, onBack, isSubmitting = false }) {
  const { anonymizedText, nameChanges, phoneRedacted, emailRedacted } = privacyPreview
  const lines = anonymizedText.split('\n').filter((line) => line.trim())
  const previewLines = lines.slice(0, 5)
  const hasMore = lines.length > previewLines.length

  return (
    <div className="animate-fade-in max-w-xl mx-auto">
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
        <p className="text-lg font-black text-gray-900 mb-1">🔍 AI에 전달되기 전, 이렇게 처리돼요</p>
        <p className="text-sm text-gray-500 leading-relaxed mb-4">
          이름·전화번호·이메일 등 식별정보를 가능한 범위에서 가린 뒤 관계 분석에 사용합니다.
          다만 모든 개인정보가 완전히 제거된다고 보장할 수는 없습니다.
        </p>

        {sourceType === 'screenshot' && (
          <p className="text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5 mb-4 leading-relaxed">
            📸 캡처 이미지는 문자 추출을 위해 서버/AI 처리 서비스로 일시 전송될 수 있으며, 원본 이미지는 보관하지 않습니다.
          </p>
        )}

        {nameChanges.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-700 mb-2">이렇게 이름을 가렸어요</p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
              {nameChanges.map(([from, to]) => (
                <li key={from} className="text-xs text-gray-600 flex items-center gap-1.5">
                  <span className="font-semibold">{from}</span>
                  <span aria-hidden="true">→</span>
                  <span className="font-semibold text-emerald-700">{to}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(phoneRedacted || emailRedacted) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {phoneRedacted && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
                ☎️ 전화번호 가림
              </span>
            )}
            {emailRedacted && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
                ✉️ 이메일 가림
              </span>
            )}
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-gray-700 mb-2">AI 관계 분석에는 이렇게 전달돼요 (일부만 표시)</p>
          <div className="bg-gray-50 rounded-2xl p-3 text-xs text-gray-600 leading-relaxed space-y-1 max-h-40 overflow-y-auto">
            {previewLines.map((line, i) => (
              <p key={i} className="break-words">{line}</p>
            ))}
            {hasMore && <p className="text-gray-400">…</p>}
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 py-3 rounded-2xl font-bold text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ↩ 돌아가서 수정
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className="flex-1 py-3 rounded-2xl font-black text-sm bg-gradient-to-r from-brand-500 to-violet-500 text-white shadow-lg shadow-brand-200/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '분석 시작하는 중…' : '이대로 분석 시작'}
        </button>
      </div>
    </div>
  )
}
