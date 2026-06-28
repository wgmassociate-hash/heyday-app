const STORAGE_KEY = 'heydaystar_device_id'

export function getDeviceId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    return `guest-${Math.random().toString(36).slice(2, 12)}`
  }
}

/** @param {Record<string, string>} [extra] */
export function apiHeaders(extra = {}) {
  return {
    'X-Device-Id': getDeviceId(),
    ...extra,
  }
}
