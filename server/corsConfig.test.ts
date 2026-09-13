import { afterEach, describe, expect, test } from 'vitest'
import { corsOriginCallback, getAllowedOrigins } from './corsConfig.js'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

function setEnv(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

/** Promise wrapper around the (err, allow) callback style. */
function checkOrigin(origin: string | undefined): Promise<boolean> {
  return new Promise((resolve, reject) => {
    corsOriginCallback(origin, (err, allow) => (err ? reject(err) : resolve(Boolean(allow))))
  })
}

describe('getAllowedOrigins (Phase 0.5 CORS allowlist)', () => {
  test('development always includes the Vite dev server origin', () => {
    setEnv({ NODE_ENV: 'development', ALLOWED_ORIGINS: undefined })
    expect(getAllowedOrigins()).toContain('http://localhost:5173')
  })

  test('production only includes explicitly configured origins, not the dev origin', () => {
    setEnv({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://app.heydaystar.co.kr' })
    const allowed = getAllowedOrigins()
    expect(allowed).toContain('https://app.heydaystar.co.kr')
    expect(allowed).not.toContain('http://localhost:5173')
  })

  test('production with nothing configured allows no cross-origin requests', () => {
    setEnv({ NODE_ENV: 'production', ALLOWED_ORIGINS: undefined })
    expect(getAllowedOrigins()).toEqual([])
  })
})

describe('corsOriginCallback', () => {
  test('same-origin requests (no Origin header) are always allowed', async () => {
    setEnv({ NODE_ENV: 'production', ALLOWED_ORIGINS: '' })
    await expect(checkOrigin(undefined)).resolves.toBe(true)
  })

  test('an allowed origin is accepted', async () => {
    setEnv({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://app.heydaystar.co.kr' })
    await expect(checkOrigin('https://app.heydaystar.co.kr')).resolves.toBe(true)
  })

  test('a disallowed origin is rejected (no CORS header, not a thrown error)', async () => {
    setEnv({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://app.heydaystar.co.kr' })
    await expect(checkOrigin('https://evil.example.com')).resolves.toBe(false)
  })

  test('the dev origin is rejected once NODE_ENV=production', async () => {
    setEnv({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://app.heydaystar.co.kr' })
    await expect(checkOrigin('http://localhost:5173')).resolves.toBe(false)
  })
})
