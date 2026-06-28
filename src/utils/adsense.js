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
    },
  }
}

export function isAdSenseConfigured(variant = 'banner') {
  const { client, slots } = getAdSenseConfig()
  const slot = slots[variant] || slots.banner
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
