import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  DatabaseUnavailableError,
  isFileFallbackAllowed,
  withFallbackPolicy,
  _resetWarnedForTests,
} from './fallbackPolicy.js'

const ORIGINAL_ENV = { ...process.env }

function setEnv(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

beforeEach(() => {
  _resetWarnedForTests()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('isFileFallbackAllowed (Phase 0.5 fallback policy)', () => {
  test('production never allows fallback, even with the flag on', () => {
    setEnv({ NODE_ENV: 'production', ALLOW_FILE_DB_FALLBACK: 'true' })
    expect(isFileFallbackAllowed()).toBe(false)
  })

  test('development allows fallback only when the flag is explicitly true', () => {
    setEnv({ NODE_ENV: 'development', ALLOW_FILE_DB_FALLBACK: 'true' })
    expect(isFileFallbackAllowed()).toBe(true)
  })

  test('development does NOT silently allow fallback when the flag is unset', () => {
    setEnv({ NODE_ENV: 'development', ALLOW_FILE_DB_FALLBACK: undefined })
    expect(isFileFallbackAllowed()).toBe(false)
  })

  test('development does not allow fallback for any other flag value', () => {
    setEnv({ NODE_ENV: 'development', ALLOW_FILE_DB_FALLBACK: 'yes' })
    expect(isFileFallbackAllowed()).toBe(false)
  })
})

describe('withFallbackPolicy', () => {
  const primaryFails = () => Promise.reject(new Error('connect ECONNREFUSED'))
  const fallbackSucceeds = () => Promise.resolve('file-result')

  test('production: primary failure throws DatabaseUnavailableError, fallback is never called', async () => {
    setEnv({ NODE_ENV: 'production', ALLOW_FILE_DB_FALLBACK: 'true' })
    const fallback = vi.fn(fallbackSucceeds)
    await expect(withFallbackPolicy('test', primaryFails, fallback)).rejects.toThrow(
      DatabaseUnavailableError,
    )
    expect(fallback).not.toHaveBeenCalled()
  })

  test('development + ALLOW_FILE_DB_FALLBACK=true: falls back on primary failure', async () => {
    setEnv({ NODE_ENV: 'development', ALLOW_FILE_DB_FALLBACK: 'true' })
    const fallback = vi.fn(fallbackSucceeds)
    await expect(withFallbackPolicy('test', primaryFails, fallback)).resolves.toBe('file-result')
    expect(fallback).toHaveBeenCalledTimes(1)
  })

  test('development without the flag: still throws, does not silently fall back', async () => {
    setEnv({ NODE_ENV: 'development', ALLOW_FILE_DB_FALLBACK: undefined })
    const fallback = vi.fn(fallbackSucceeds)
    await expect(withFallbackPolicy('test', primaryFails, fallback)).rejects.toThrow(
      DatabaseUnavailableError,
    )
    expect(fallback).not.toHaveBeenCalled()
  })

  test('primary success never touches fallback, in any environment', async () => {
    setEnv({ NODE_ENV: 'production' })
    const primary = vi.fn(() => Promise.resolve('db-result'))
    const fallback = vi.fn(fallbackSucceeds)
    await expect(withFallbackPolicy('test', primary, fallback)).resolves.toBe('db-result')
    expect(fallback).not.toHaveBeenCalled()
  })
})
