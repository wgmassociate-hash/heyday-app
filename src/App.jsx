import { useState, useCallback, useEffect, useRef } from 'react'
import AdSlot from './components/AdSlot'
import InputStep from './components/InputStep'
import LoadingStep from './components/LoadingStep'
import ResultStep from './components/ResultStep'
import QuotaBadge from './components/QuotaBadge'
import { analyzeChat, anonymizeChatText } from './utils/anonymize'
import { scrubResultNames } from './utils/scrubResult.js'
import { fetchQuota, claimShareBonus } from './utils/quotaApi.js'

const STEPS = {
  INPUT: 'input',
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
  const [step, setStep] = useState(STEPS.INPUT)
  const [chatText, setChatText] = useState('')
  const [result, setResult] = useState(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [loadingState, setLoadingState] = useState(null)
  const [quota, setQuota] = useState(null)
  const [shareHighlight, setShareHighlight] = useState(false)
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

  const handleShareBonus = useCallback(async () => {
    const result = await claimShareBonus()
    if (result.quota) setQuota(result.quota)
  }, [])

  const transitionTo = useCallback((nextStep) => {
    setIsTransitioning(true)
    setTimeout(() => {
      setStep(nextStep)
      setIsTransitioning(false)
    }, 280)
  }, [])

  const handleSubmit = async () => {
    if (!isValid) return

    if (quota && !quota.canAnalyze) {
      setShareHighlight(true)
      setTimeout(() => {
        sharePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      return
    }

    const { anonymizedText, nameMap } = anonymizeChatText(chatText)
    const { analyzeLocally } = await import('./utils/analyzeLocal.js')
    const preview = scrubResultNames(analyzeLocally(anonymizedText, nameMap), nameMap)

    setLoadingState({
      preview,
      progress: 22,
      phase: '패턴 분석 OK · AI 분석 중...',
    })
    transitionTo(STEPS.LOADING)

    const progressTimer = setInterval(() => {
      setLoadingState((prev) => {
        if (!prev || prev.progress >= 92) return prev
        const next = Math.min(92, prev.progress + 4)
        return { ...prev, progress: next, phase: phaseForProgress(next) }
      })
    }, 1800)

    try {
      const data = await analyzeChat(chatText)
      clearInterval(progressTimer)
      if (data.quota) setQuota(data.quota)
      else await refreshQuota()
      setLoadingState((prev) =>
        prev ? { ...prev, progress: 100, phase: '분석 완료!' } : null,
      )
      setResult(data)
      setShareHighlight(false)
      transitionTo(STEPS.RESULT)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      clearInterval(progressTimer)
      console.error('[analyze]', err)
      if (err?.code === 'QUOTA_EXCEEDED') {
        if (err.quota) setQuota(err.quota)
        setShareHighlight(true)
        transitionTo(STEPS.INPUT)
        setTimeout(() => {
          sharePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 350)
        return
      }
      transitionTo(STEPS.INPUT)
      alert(`분석 중 오류: ${err?.message || '알 수 없는 오류'}`)
    } finally {
      setTimeout(() => setLoadingState(null), 400)
    }
  }

  const handleReset = () => {
    setChatText('')
    setResult(null)
    setLoadingState(null)
    setShareHighlight(false)
    transitionTo(STEPS.INPUT)
    refreshQuota()
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
        <AdSlot variant="banner" className="mb-6" />

        <div className={isTransitioning ? 'animate-fade-out' : ''}>
          {step === STEPS.INPUT && (
            <InputStep
              chatText={chatText}
              onChange={setChatText}
              onSubmit={handleSubmit}
              isValid={isValid}
              quota={quota}
              onQuotaUpdate={handleQuotaUpdate}
              shareHighlight={shareHighlight}
              sharePanelRef={sharePanelRef}
            />
          )}
          {step === STEPS.LOADING && (
            <LoadingStep
              preview={loadingState?.preview}
              progress={loadingState?.progress ?? 0}
              phase={loadingState?.phase ?? ''}
            />
          )}
          {step === STEPS.RESULT && result && (
            <ResultStep
              result={result}
              onReset={handleReset}
              quota={quota}
              onQuotaUpdate={handleQuotaUpdate}
              onShareBonus={handleShareBonus}
            />
          )}
        </div>
      </main>
    </div>
  )
}
