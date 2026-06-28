import { QUOTA_BASE_DAILY, QUOTA_DAILY_CAP, QUOTA_SHARE_BONUS_MAX } from '../../shared/quotaConfig.js'
import { apiHeaders, getDeviceId } from './deviceId.js'

export { QUOTA_BASE_DAILY, QUOTA_DAILY_CAP, QUOTA_SHARE_BONUS_MAX }

export const SHARE_MESSAGE = '카톡만 올리면 썸·호감도 알려주는 AI 💕 heydaystar'

export function getShareUrl() {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'https://app.heydaystar.co.kr'
  return `${base}/?ref=${getDeviceId().slice(0, 8)}`
}

export async function fetchQuota() {
  try {
    const res = await fetch('/api/quota', { headers: apiHeaders() })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function claimShareBonus() {
  const res = await fetch('/api/quota/share', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
  })
  const data = await res.json().catch(() => ({}))
  return {
    ok: res.ok && data?.ok,
    quota: data?.quota ?? null,
    error: data?.error || null,
  }
}
