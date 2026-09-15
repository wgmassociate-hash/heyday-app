// V2 Production Closing — IP-level cost backstop for the three Anthropic-
// calling routes (/api/preview, /api/ocr-screenshots, /api/analyze).
//
// Why this exists: per-device daily quota (server/quota.js) is keyed by the
// client-supplied `X-Device-Id` header (server/quota.js's parseDeviceId), and
// the frontend generates that id with crypto.randomUUID() stored in
// localStorage (src/utils/deviceId.js) — nothing server-side ties it to a
// stable identity. A script calling the API directly can send a fresh random
// device id on every request and the per-device quota never engages, so
// nothing else in this codebase bounds how many paid Anthropic calls one
// source can trigger. This is a separate, independent gate — it does not
// replace or alter device quota (server/quota.js is untouched), and it is
// NOT controlled by RATE_LIMIT_DISABLED (that flag's meaning stays exactly
// "disable the per-device daily quota"; overloading it here would make it
// mean two different things depending on context, which is what the closing
// review explicitly asked to avoid).
//
// Deliberately a small in-memory fixed-window counter, not a new dependency:
// this only needs to survive one process's uptime on Render's free/single-
// instance plan, and a restart clearing it is an acceptable (Rare, and
// fail-open toward legitimate users) tradeoff for staying simple.
export interface IpRateLimitConfig {
  windowMs: number
  max: number
}

interface WindowState {
  count: number
  windowStart: number
}

const buckets = new Map<string, WindowState>()

/** Generous by design (item in the Production Closing review: "정상 사용자
 * UX를 방해하지 않을 정도로 여유 있게"). 40 requests / 10 minutes per IP
 * across all three costly routes combined still lets a shared office/school
 * Wi-Fi IP with several concurrent legitimate users through comfortably,
 * while capping a device-id-rotation script's sustained throughput to at
 * most ~4 requests/minute long-term instead of "as fast as the network
 * allows". Overridable via env for an operator who measures real traffic and
 * wants to tune it, but the hardcoded default is what protects production
 * even if nobody sets the env vars at all. */
const DEFAULT_WINDOW_MS = 10 * 60 * 1000
const DEFAULT_MAX = 40

export function getIpRateLimitConfig(): IpRateLimitConfig {
  const windowMs = Number(process.env.IP_RATE_LIMIT_WINDOW_MS)
  const max = Number(process.env.IP_RATE_LIMIT_MAX)
  return {
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : DEFAULT_WINDOW_MS,
    max: Number.isFinite(max) && max > 0 ? max : DEFAULT_MAX,
  }
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

/** Pure fixed-window counter, kept separate from the Express middleware below
 * so it's directly unit-testable with injected timestamps instead of having
 * to fake real wall-clock delays or spin up an HTTP server. */
export function checkIpRateLimit(key: string, now: number, config: IpRateLimitConfig): RateLimitResult {
  const state = buckets.get(key)
  if (!state || now - state.windowStart >= config.windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true, retryAfterMs: 0 }
  }
  if (state.count < config.max) {
    state.count += 1
    return { allowed: true, retryAfterMs: 0 }
  }
  return { allowed: false, retryAfterMs: config.windowMs - (now - state.windowStart) }
}

/** Test-only: clears all counters between test cases. */
export function _resetIpRateLimitForTests() {
  buckets.clear()
}

/** Express middleware factory. Keyed by `req.ip` — server/index.js sets
 * `trust proxy` so this reads Render's X-Forwarded-For correctly instead of
 * collapsing every visitor onto the proxy's own address. Rejects with 429 and
 * a generic Korean message only; never logs or echoes back request body
 * (no conversation text, names, or evidence ever reach this module). */
export function ipRateLimitMiddleware(config: IpRateLimitConfig = getIpRateLimitConfig()) {
  return (req: { ip?: string }, res: any, next: () => void) => {
    const key = req.ip || 'unknown'
    const result = checkIpRateLimit(key, Date.now(), config)
    if (!result.allowed) {
      res.set('Retry-After', String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))))
      res.status(429).json({
        error: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.',
        code: 'RATE_LIMITED',
      })
      return
    }
    next()
  }
}
