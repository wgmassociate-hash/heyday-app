// V2 Production Closing — IP-level cost backstop for /api/preview,
// /api/ocr-screenshots, /api/analyze (server/ipRateLimit.ts's file header
// explains the deviceId-rotation bypass this closes).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  _resetIpRateLimitForTests,
  checkIpRateLimit,
  getIpRateLimitConfig,
  ipRateLimitMiddleware,
} from './ipRateLimit.js'

const ORIGINAL_ENV = { ...process.env }

function setEnv(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

beforeEach(() => {
  _resetIpRateLimitForTests()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('getIpRateLimitConfig', () => {
  test('safe hardcoded default when no env vars are set — production is protected with zero setup', () => {
    setEnv({ IP_RATE_LIMIT_WINDOW_MS: undefined, IP_RATE_LIMIT_MAX: undefined })
    expect(getIpRateLimitConfig()).toEqual({ windowMs: 10 * 60 * 1000, max: 40 })
  })

  test('overridable via env', () => {
    setEnv({ IP_RATE_LIMIT_WINDOW_MS: '60000', IP_RATE_LIMIT_MAX: '5' })
    expect(getIpRateLimitConfig()).toEqual({ windowMs: 60000, max: 5 })
  })

  test('falls back to defaults on garbage env values instead of NaN/0', () => {
    setEnv({ IP_RATE_LIMIT_WINDOW_MS: 'not-a-number', IP_RATE_LIMIT_MAX: '-5' })
    expect(getIpRateLimitConfig()).toEqual({ windowMs: 10 * 60 * 1000, max: 40 })
  })
})

describe('checkIpRateLimit (pure fixed-window counter)', () => {
  const config = { windowMs: 1000, max: 3 }

  test('allows up to `max` requests inside one window', () => {
    const now = 0
    expect(checkIpRateLimit('1.2.3.4', now, config).allowed).toBe(true)
    expect(checkIpRateLimit('1.2.3.4', now + 10, config).allowed).toBe(true)
    expect(checkIpRateLimit('1.2.3.4', now + 20, config).allowed).toBe(true)
  })

  test('rejects the (max+1)th request within the same window, with a positive retryAfterMs', () => {
    const now = 0
    checkIpRateLimit('1.2.3.4', now, config)
    checkIpRateLimit('1.2.3.4', now + 10, config)
    checkIpRateLimit('1.2.3.4', now + 20, config)
    const blocked = checkIpRateLimit('1.2.3.4', now + 30, config)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  test('resets once the window elapses', () => {
    checkIpRateLimit('1.2.3.4', 0, config)
    checkIpRateLimit('1.2.3.4', 10, config)
    checkIpRateLimit('1.2.3.4', 20, config)
    expect(checkIpRateLimit('1.2.3.4', 30, config).allowed).toBe(false)

    // Past windowMs (1000) from the window's start (0) — a fresh window opens.
    expect(checkIpRateLimit('1.2.3.4', 1001, config).allowed).toBe(true)
  })

  test('different keys (IPs) are tracked independently', () => {
    checkIpRateLimit('1.1.1.1', 0, config)
    checkIpRateLimit('1.1.1.1', 0, config)
    checkIpRateLimit('1.1.1.1', 0, config)
    expect(checkIpRateLimit('1.1.1.1', 0, config).allowed).toBe(false)
    // A different IP has its own, untouched budget.
    expect(checkIpRateLimit('2.2.2.2', 0, config).allowed).toBe(true)
  })
})

describe('ipRateLimitMiddleware', () => {
  function fakeRes() {
    return {
      statusCode: null as number | null,
      headers: {} as Record<string, string>,
      body: null as unknown,
      set(name: string, value: string) {
        this.headers[name] = value
      },
      status(code: number) {
        this.statusCode = code
        return this
      },
      json(payload: unknown) {
        this.body = payload
        return this
      },
    }
  }

  test('calls next() and never touches the response when under the limit', () => {
    const middleware = ipRateLimitMiddleware({ windowMs: 1000, max: 2 })
    const next = vi.fn()
    const res = fakeRes()
    middleware({ ip: '9.9.9.9' }, res, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBeNull()
  })

  test('responds 429 with Retry-After and a generic message, and does not call next(), once over the limit', () => {
    const middleware = ipRateLimitMiddleware({ windowMs: 1000, max: 1 })
    const req = { ip: '9.9.9.9' }

    const first = fakeRes()
    middleware(req, first, vi.fn())

    const next = vi.fn()
    const res = fakeRes()
    middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ error: expect.any(String), code: 'RATE_LIMITED' })
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0)
  })

  test('never includes request body/conversation content in its response', () => {
    const middleware = ipRateLimitMiddleware({ windowMs: 1000, max: 1 })
    const req = { ip: '9.9.9.9' }
    middleware(req, fakeRes(), vi.fn())
    const res = fakeRes()
    middleware(req, res, vi.fn())
    expect(JSON.stringify(res.body)).not.toMatch(/나 :|상대|카톡/)
  })
})
