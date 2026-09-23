import { useState, useCallback, useEffect, useRef } from 'react'
import IntentStep from './components/IntentStep'
import InputStep from './components/InputStep'
import PrivacyReviewStep from './components/PrivacyReviewStep'
import LoadingStep from './components/LoadingStep'
import PreviewResultStep from './components/PreviewResultStep'
import QuotaBadge from './components/QuotaBadge'
import { analyzePreview } from './utils/previewApi.js'
import { fetchQuota } from './utils/quotaApi.js'
import { buildPrivacyPreview } from './utils/privacyPreview.js'
import { trackEvent } from './utils/analytics.js'

const STEPS = {
  INTENT: 'intent',
  INPUT: 'input',
  PRIVACY_REVIEW: 'privacy_review',
  LOADING: 'loading',
  RESULT: 'result',
}

function phaseForProgress(progress) {
  if (progress >= 88) return '🎉 거의 다 됐어 진짜!!'
  if (progress >= 68) return '✍️ 리포트 쓰는 중…'
  if (progress >= 52) return '💘 썸 신호 찾는 중…'
  if (progress >= 35) return '⏱️ 답장 속도 재는 중…'
  if (progress >= 18) return '😂 ㅋㅋㅋ 세는 중…'
  return '📖 대화 읽는 중…'
}

export default function App() {
  const [step, setStep] = useState(STEPS.INTENT)
  const [intent, setIntent] = useState(null)
  const [chatText, setChatText] = useState('')
  const [sourceType, setSourceType] = useState('screenshot') // matches MobileImportPanel's default tab
  const [privacyPreview, setPrivacyPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [loadingState, setLoadingState] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quota, setQuota] = useState(null)
  const [shareHighlight, setShareHighlight] = useState(false)
  const [refiningInput, setRefiningInput] = useState(false)
  const sharePanelRef = useRef(null)

  const lineCount = chatText.trim().split('\n').filter(Boolean).length
  const isValid = lineCount >= 3

  const refreshQuota = useCallback(async () => {
    const q = await fetchQuota()
    if (q) setQuota(q)
  }, [])

  useEffect(() => {
    refreshQuota()
  }, [refreshQuota])

  const handleQuotaUpdate = useCallback((next) => {
    if (next) setQuota(next)
    else refreshQuota()
  }, [refreshQuota])

  const transitionTo = useCallback((nextStep) => {
    setIsTransitioning(true)
    setTimeout(() => {
      setStep(nextStep)
      setIsTransitioning(false)
    }, 280)
  }, [])

  const handleIntentSelect = (nextIntent) => {
    trackEvent('intent_selected', { intent: nextIntent })
    setIntent(nextIntent)
    transitionTo(STEPS.INPUT)
  }

  // Phase 2.1 — Privacy Review (item 6/7): submitting from InputStep no
  // longer starts analysis directly. It first computes what will actually be
  // sent (anonymized/redacted, same pipeline analyzePreview() used to run
  // silently) and shows it for confirmation — quota is still checked here so
  // a blocked user sees the share panel instead of an empty review screen.
  const handleGoToPrivacyReview = () => {
    if (!isValid || !intent) return

    if (quota && !quota.canAnalyze) {
      setShareHighlight(true)
      setTimeout(() => {
        sharePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      return
    }

    setPrivacyPreview(buildPrivacyPreview(chatText))
    trackEvent('privacy_review_opened', { source_type: sourceType })
    transitionTo(STEPS.PRIVACY_REVIEW)
  }

  const handleBackFromPrivacyReview = () => {
    transitionTo(STEPS.INPUT)
  }

  const handleConfirmPrivacyReview = async () => {
    // Guards against a double-click firing two /api/preview requests (each
    // consuming a quota unit) before transitionTo's 280ms delay unmounts
    // this screen's confirm button.
    if (!privacyPreview || !intent || isSubmitting) return
    setIsSubmitting(true)
    trackEvent('analysis_started', { source_type: sourceType, intent })

    setLoadingState({ progress: 22, phase: '패턴 분석 OK · AI 분석 중...' })
    transitionTo(STEPS.LOADING)

    const progressTimer = setInterval(() => {
      setLoadingState((prev) => {
        if (!prev || prev.progress >= 92) return prev
        const next = Math.min(92, prev.progress + 4)
        return { ...prev, progress: next, phase: phaseForProgress(next) }
      })
    }, 1800)

    try {
      const data = await analyzePreview({
        anonymizedText: privacyPreview.anonymizedText,
        nameMap: privacyPreview.nameMap,
        intent,
      })
      clearInterval(progressTimer)
      if (data.quota) setQuota(data.quota)
      else await refreshQuota()
      setLoadingState((prev) =>
        prev ? { ...prev, progress: 100, phase: '분석 완료!' } : null,
      )
      setResult(data)
      setRefiningInput(false)
      trackEvent('analysis_completed', { source_type: sourceType, intent })
      setShareHighlight(false)
      transitionTo(STEPS.RESULT)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      clearInterval(progressTimer)
      console.error('[preview]', err)
      if (err?.code === 'QUOTA_EXCEEDED') {
        trackEvent('analysis_failed', { reason: 'quota_exceeded', source_type: sourceType })
        if (err.quota) setQuota(err.quota)
        setShareHighlight(true)
        transitionTo(STEPS.INPUT)
        setTimeout(() => {
          sharePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 350)
        return
      }
      trackEvent('analysis_failed', { reason: 'request_error', source_type: sourceType })
      transitionTo(STEPS.INPUT)
      alert(`분석 중 오류: ${err?.message || '알 수 없는 오류'}`)
    } finally {
      setTimeout(() => setLoadingState(null), 400)
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    trackEvent('analysis_reset')
    setIntent(null)
    setChatText('')
    setPrivacyPreview(null)
    setResult(null)
    setLoadingState(null)
    setShareHighlight(false)
    setRefiningInput(false)
    transitionTo(STEPS.INTENT)
    refreshQuota()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Phase 2.1 — Sufficiency CTA (item 2): "대화 더 추가하기" goes back to
  // InputStep with the existing chatText/intent intact (unlike handleReset)
  // so the user can paste more conversation instead of starting over.
  const handleAddMoreConversation = () => {
    setRefiningInput(true)
    setSourceType('text')
    transitionTo(STEPS.INPUT)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-violet-50/40">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-pink-100/80">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">💕</span>
            <span className="font-black text-gray-800 text-base truncate">
              heydaystar
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <QuotaBadge quota={quota} />
            {step === STEPS.RESULT && (
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-brand-600 hover:text-brand-700 font-bold"
              >
                ↩ 다시
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 md:py-8">
        {/* Ad placement restructure — the always-mounted top banner (shown on
         * every step regardless of content) was removed here. Ads now live
         * only where there's real content to justify them: Loading (1) and
         * Result (3), inside their own step components. */}
        <div className={isTransitioning ? 'animate-fade-out' : ''}>
          {step === STEPS.INTENT && <IntentStep onSelect={handleIntentSelect} />}
          {step === STEPS.INPUT && (
            <InputStep
              chatText={chatText}
              onChange={setChatText}
              onSubmit={handleGoToPrivacyReview}
              isValid={isValid}
              quota={quota}
              onQuotaUpdate={handleQuotaUpdate}
              shareHighlight={shareHighlight}
              sharePanelRef={sharePanelRef}
              refiningInput={refiningInput}
              sourceType={sourceType}
              onSourceTypeChange={(nextSourceType) => {
                setSourceType(nextSourceType)
                trackEvent('input_method_selected', { source_type: nextSourceType })
              }}
            />
          )}
          {step === STEPS.PRIVACY_REVIEW && privacyPreview && (
            <PrivacyReviewStep
              privacyPreview={privacyPreview}
              sourceType={sourceType}
              onConfirm={handleConfirmPrivacyReview}
              onBack={handleBackFromPrivacyReview}
              isSubmitting={isSubmitting}
            />
          )}
          {step === STEPS.LOADING && (
            <LoadingStep
              progress={loadingState?.progress ?? 0}
              phase={loadingState?.phase ?? ''}
            />
          )}
          {step === STEPS.RESULT && result && (
            <PreviewResultStep result={result} onReset={handleReset} onAddMoreConversation={handleAddMoreConversation} />
          )}
        </div>
      </main>
    </div>
  )
}
