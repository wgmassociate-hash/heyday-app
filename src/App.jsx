import { useState, useCallback } from 'react'
import AdSlot from './components/AdSlot'
import InputStep from './components/InputStep'
import LoadingStep from './components/LoadingStep'
import ResultStep from './components/ResultStep'
import { analyzeChat } from './utils/anonymize'

const STEPS = {
  INPUT: 'input',
  LOADING: 'loading',
  RESULT: 'result',
}

export default function App() {
  const [step, setStep] = useState(STEPS.INPUT)
  const [chatText, setChatText] = useState('')
  const [result, setResult] = useState(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const lineCount = chatText.trim().split('\n').filter(Boolean).length
  const isValid = lineCount >= 3

  const transitionTo = useCallback((nextStep) => {
    setIsTransitioning(true)
    setTimeout(() => {
      setStep(nextStep)
      setIsTransitioning(false)
    }, 280)
  }, [])

  const handleSubmit = async () => {
    if (!isValid) return
    transitionTo(STEPS.LOADING)

    try {
      const data = await analyzeChat(chatText)
      setResult(data)
      transitionTo(STEPS.RESULT)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('[analyze]', err)
      transitionTo(STEPS.INPUT)
      alert(`분석 중 오류: ${err?.message || '알 수 없는 오류'}`)
    }
  }

  const handleReset = () => {
    setChatText('')
    setResult(null)
    transitionTo(STEPS.INPUT)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-violet-50/30">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <span className="font-bold text-gray-800 text-sm md:text-base">
              heydaystar
            </span>
          </div>
          {step === STEPS.RESULT && (
            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              새 분석
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-10">
        <AdSlot variant="banner" className="mb-8" />

        <div className={isTransitioning ? 'animate-fade-out' : ''}>
          {step === STEPS.INPUT && (
            <InputStep
              chatText={chatText}
              onChange={setChatText}
              onSubmit={handleSubmit}
              isValid={isValid}
            />
          )}
          {step === STEPS.LOADING && <LoadingStep />}
          {step === STEPS.RESULT && result && (
            <ResultStep result={result} onReset={handleReset} />
          )}
        </div>
      </main>
    </div>
  )
}
