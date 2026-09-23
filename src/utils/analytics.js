const SAFE_EVENT_NAMES = new Set([
  'intent_selected',
  'input_method_selected',
  'privacy_review_opened',
  'analysis_started',
  'analysis_completed',
  'analysis_failed',
  'ocr_started',
  'ocr_completed',
  'ocr_failed',
  'analysis_reset',
])

const SAFE_PARAM_NAMES = new Set(['intent', 'source_type', 'reason', 'image_count'])

export function getAnalyticsMeasurementId() {
  return String(import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim()
}

function ensureGtag() {
  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments)
  }
}

export function loadGoogleAnalytics() {
  const measurementId = getAnalyticsMeasurementId()
  if (!measurementId || typeof document === 'undefined') return

  ensureGtag()

  if (!document.querySelector('script[data-ga-measurement-id]')) {
    const script = document.createElement('script')
    script.async = true
    script.dataset.gaMeasurementId = measurementId
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
    document.head.appendChild(script)
  }

  window.gtag('js', new Date())
  window.gtag('config', measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })
}

export function trackEvent(name, params = {}) {
  if (!SAFE_EVENT_NAMES.has(name) || !getAnalyticsMeasurementId() || typeof window === 'undefined') return

  ensureGtag()
  const safeParams = Object.fromEntries(
    Object.entries(params).filter(([key]) => SAFE_PARAM_NAMES.has(key)),
  )
  window.gtag('event', name, safeParams)
}
