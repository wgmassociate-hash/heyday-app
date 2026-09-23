// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { loadGoogleAnalytics, trackEvent } from './analytics.js'

afterEach(() => {
  document.head.querySelectorAll('script[data-ga-measurement-id]').forEach((node) => node.remove())
  delete window.dataLayer
  delete window.gtag
  vi.unstubAllEnvs()
})

describe('analytics', () => {
  test('does nothing when the GA measurement id is not configured', () => {
    loadGoogleAnalytics()
    trackEvent('analysis_started', { source_type: 'text' })

    expect(document.querySelector('script[data-ga-measurement-id]')).toBeNull()
    expect(window.dataLayer).toBeUndefined()
  })

  test('loads the Google tag only once and sends allowlisted event data', () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123')

    loadGoogleAnalytics()
    loadGoogleAnalytics()
    trackEvent('analysis_started', {
      source_type: 'text',
      conversation: 'private message must never be sent',
    })

    expect(document.querySelectorAll('script[data-ga-measurement-id]')).toHaveLength(1)
    const eventArgs = Array.from(window.dataLayer.at(-1))
    expect(eventArgs).toEqual(['event', 'analysis_started', { source_type: 'text' }])
  })

  test('ignores unknown event names', () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123')
    loadGoogleAnalytics()
    const before = window.dataLayer.length

    trackEvent('send_chat_text', { conversation: 'private' })

    expect(window.dataLayer).toHaveLength(before)
  })
})
