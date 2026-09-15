import {
  QUOTA_BASE_DAILY,
  QUOTA_DAILY_CAP,
  QUOTA_SHARE_BONUS_MAX,
  QUOTA_SHARE_COOLDOWN_MS,
} from '../shared/quotaConfig.js'
// Storage moved to server/db/repositories/quotaRepository.ts (Postgres,
// Prisma-first with a graceful fallback to the original file store —
// see docs/implementation_plan_v2.md §5.3). The policy logic below
// (KST reset, share-bonus cooldown, quota math) is unchanged from 1.0;
// only the two storage calls are now async.
import { getQuotaRepository } from './db/repositories/quotaRepository.ts'

export function isQuotaDisabled() {
  return String(process.env.RATE_LIMIT_DISABLED || '').toLowerCase() === 'true'
}

/** Dev-only convenience so a developer running the app locally isn't blocked
 * by the same 3-per-day cap real users see. Distinct from RATE_LIMIT_DISABLED
 * above (which has no environment guard and is meant as a deliberate,
 * environment-agnostic testing toggle): DEV_BYPASS_QUOTA is refused outright
 * whenever NODE_ENV==='production', so leaving it set to true in a deployed
 * environment's env vars by accident can never actually bypass quota there.
 * Quota policy itself (limits, share bonus, reset timing) is untouched —
 * this only decides whether assertCanUseQuota/consumeQuota enforce it. */
export function isDevQuotaBypassed() {
  if (process.env.NODE_ENV === 'production') return false
  return String(process.env.DEV_BYPASS_QUOTA || '').toLowerCase() === 'true'
}

export function getKstDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date)
}

export function getKstMidnightResetIso() {
  const kstDate = getKstDateString()
  const [y, m, d] = kstDate.split('-').map(Number)
  const utcMs = Date.UTC(y, m - 1, d + 1, 0, 0, 0) - 9 * 60 * 60 * 1000
  return new Date(utcMs).toISOString()
}

export function buildQuotaStatus(record) {
  const maxAllowed = Math.min(QUOTA_DAILY_CAP, QUOTA_BASE_DAILY + record.shareBonus)
  const remaining = Math.max(0, maxAllowed - record.used)
  return {
    baseDaily: QUOTA_BASE_DAILY,
    shareBonusMax: QUOTA_SHARE_BONUS_MAX,
    dailyCap: QUOTA_DAILY_CAP,
    shareBonusEarned: record.shareBonus,
    shareBonusRemaining: Math.max(0, QUOTA_SHARE_BONUS_MAX - record.shareBonus),
    usedToday: record.used,
    maxAllowed,
    remaining,
    canAnalyze: remaining > 0,
    canEarnShareBonus: record.shareBonus < QUOTA_SHARE_BONUS_MAX,
    resetsAt: getKstMidnightResetIso(),
    disabled: false,
  }
}

export function getDisabledQuotaStatus() {
  return {
    baseDaily: QUOTA_BASE_DAILY,
    shareBonusMax: QUOTA_SHARE_BONUS_MAX,
    dailyCap: QUOTA_DAILY_CAP,
    shareBonusEarned: 0,
    shareBonusRemaining: QUOTA_SHARE_BONUS_MAX,
    usedToday: 0,
    maxAllowed: QUOTA_DAILY_CAP,
    remaining: QUOTA_DAILY_CAP,
    canAnalyze: true,
    canEarnShareBonus: true,
    resetsAt: getKstMidnightResetIso(),
    disabled: true,
  }
}

export async function getQuotaStatus(deviceId) {
  // Dev bypass must short-circuit here too (not just assertCanUseQuota/
  // consumeQuota below): the frontend's "오늘 횟수 소진" gate reads THIS
  // endpoint's canAnalyze, not the /api/preview response, so a device
  // already sitting at used>=maxAllowed stayed blocked in the UI even with
  // DEV_BYPASS_QUOTA=true. Reuses the same getDisabledQuotaStatus() shape
  // RATE_LIMIT_DISABLED already returns (canAnalyze:true, disabled:true) —
  // every component gating on quota.canAnalyze/.disabled already handles it.
  // Never reads or writes the stored record, so the real `used` count for
  // this device is untouched.
  if (isQuotaDisabled() || isDevQuotaBypassed()) return getDisabledQuotaStatus()
  const kstDate = getKstDateString()
  const record = await getQuotaRepository().getRecord(deviceId, kstDate)
  return buildQuotaStatus(record)
}

export async function assertCanUseQuota(deviceId) {
  if (isQuotaDisabled() || isDevQuotaBypassed()) {
    return { ok: true, status: getDisabledQuotaStatus() }
  }

  const status = await getQuotaStatus(deviceId)
  if (!status.canAnalyze) {
    return { ok: false, status, error: '오늘 AI 분석 횟수를 모두 사용했어요.' }
  }

  return { ok: true, status }
}

export async function consumeQuota(deviceId) {
  if (isQuotaDisabled() || isDevQuotaBypassed()) {
    return { ok: true, status: getDisabledQuotaStatus() }
  }

  const kstDate = getKstDateString()
  const repo = getQuotaRepository()
  const record = await repo.getRecord(deviceId, kstDate)
  const status = buildQuotaStatus(record)

  if (!status.canAnalyze) {
    return { ok: false, status, error: '오늘 AI 분석 횟수를 모두 사용했어요.' }
  }

  record.used += 1
  await repo.saveRecord(deviceId, kstDate, record)
  return { ok: true, status: buildQuotaStatus(record) }
}

export async function grantShareBonus(deviceId) {
  if (isQuotaDisabled()) {
    return { ok: true, status: getDisabledQuotaStatus() }
  }

  const kstDate = getKstDateString()
  const repo = getQuotaRepository()
  const record = await repo.getRecord(deviceId, kstDate)

  if (record.shareBonus >= QUOTA_SHARE_BONUS_MAX) {
    return {
      ok: false,
      status: buildQuotaStatus(record),
      error: '오늘 공유 보너스는 최대 3번까지예요.',
    }
  }

  const now = Date.now()
  if (record.lastShareAt && now - record.lastShareAt < QUOTA_SHARE_COOLDOWN_MS) {
    const waitSec = Math.ceil((QUOTA_SHARE_COOLDOWN_MS - (now - record.lastShareAt)) / 1000)
    return {
      ok: false,
      status: buildQuotaStatus(record),
      error: `${waitSec}초 뒤에 다시 공유해줘.`,
    }
  }

  record.shareBonus += 1
  record.lastShareAt = now
  await repo.saveRecord(deviceId, kstDate, record)
  return { ok: true, status: buildQuotaStatus(record) }
}

const DEVICE_ID_RE = /^[a-zA-Z0-9-]{8,64}$/

export function parseDeviceId(req) {
  const raw = String(req.headers['x-device-id'] || '').trim()
  if (!DEVICE_ID_RE.test(raw)) return null
  return raw
}
