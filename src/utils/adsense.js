/** @returns {{ client: string, slots: Record<string, string> }} */
export function getAdSenseConfig() {
  return {
    client: String(import.meta.env.VITE_ADSENSE_CLIENT || '').trim(),
    slots: {
      banner: String(import.meta.env.VITE_ADSENSE_SLOT_BANNER || '').trim(),
      rectangle: String(import.meta.env.VITE_ADSENSE_SLOT_RECTANGLE || '').trim(),
      leaderboard: String(import.meta.env.VITE_ADSENSE_SLOT_LEADERBOARD || '').trim(),
      loading: String(
        import.meta.env.VITE_ADSENSE_SLOT_LOADING ||
        import.meta.env.VITE_ADSENSE_SLOT_RECTANGLE ||
        '',
      ).trim(),
      // Ad placement restructure (Loading + Result 중심): each Result section
      // gets its own slot id so performance can be measured per-position —
      // deliberately NOT falling back to the shared banner slot (see
      // getSlotId below), unlike the legacy variants above.
      resultTop: String(import.meta.env.VITE_ADSENSE_SLOT_RESULT_TOP || '').trim(),
      resultMiddle: String(import.meta.env.VITE_ADSENSE_SLOT_RESULT_MIDDLE || '').trim(),
      resultBottom: String(import.meta.env.VITE_ADSENSE_SLOT_RESULT_BOTTOM || '').trim(),
    },
  }
}

const NO_BANNER_FALLBACK_VARIANTS = new Set(['resultTop', 'resultMiddle', 'resultBottom'])

/** Resolves which slot id a variant actually uses. Legacy variants fall back
 * to the shared banner slot when unset (original behavior); the Result
 * Top/Middle/Bottom variants never do, so an environment with only
 * VITE_ADSENSE_SLOT_BANNER configured can't silently reuse that one slot id
 * across all three Result placements and defeat the point of splitting them. */
export function getSlotId(variant, slots) {
  const resolved = slots ?? getAdSenseConfig().slots
  if (NO_BANNER_FALLBACK_VARIANTS.has(variant)) return resolved[variant] || ''
  return resolved[variant] || resolved.banner
}

export function isAdSenseConfigured(variant = 'banner') {
  const { client, slots } = getAdSenseConfig()
  const slot = getSlotId(variant, slots)
  return Boolean(client && slot)
}

export function loadAdSenseScript() {
  const { client } = getAdSenseConfig()
  if (!client) return
  if (document.querySelector('script[data-adsense-client]')) return

  const script = document.createElement('script')
  script.async = true
  script.dataset.adsenseClient = client
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
  script.crossOrigin = 'anonymous'
  document.head.appendChild(script)
}
