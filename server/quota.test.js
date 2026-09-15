// Dev-only quota bypass (local-testing convenience — see quota.js's
// isDevQuotaBypassed docstring). Does not test the quota policy itself
// (limits/share bonus/reset timing are unchanged and untested here);
// only that DEV_BYPASS_QUOTA short-circuits assertCanUseQuota/consumeQuota
// in non-production and is refused in production.
import { afterEach, describe, expect, test } from 'vitest'
import { assertCanUseQuota, consumeQuota, getKstDateString, getQuotaStatus, isDevQuotaBypassed } from './quota.js'
import { readStore, writeStore } from './quotaStore.js'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

function setEnv(env) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('isDevQuotaBypassed', () => {
  test('false by default (env var unset)', () => {
    setEnv({ NODE_ENV: 'development', DEV_BYPASS_QUOTA: undefined })
    expect(isDevQuotaBypassed()).toBe(false)
  })

  test('true when DEV_BYPASS_QUOTA=true outside production', () => {
    setEnv({ NODE_ENV: 'development', DEV_BYPASS_QUOTA: 'true' })
    expect(isDevQuotaBypassed()).toBe(true)
  })

  test('false when NODE_ENV is unset (neither development nor production) and the flag is unset', () => {
    setEnv({ NODE_ENV: undefined, DEV_BYPASS_QUOTA: undefined })
    expect(isDevQuotaBypassed()).toBe(false)
  })

  test('refused in production even when DEV_BYPASS_QUOTA=true (defends against a leftover env var in prod)', () => {
    setEnv({ NODE_ENV: 'production', DEV_BYPASS_QUOTA: 'true' })
    expect(isDevQuotaBypassed()).toBe(false)
  })

  test('a truthy-looking but non-"true" value does not bypass', () => {
    setEnv({ NODE_ENV: 'development', DEV_BYPASS_QUOTA: '1' })
    expect(isDevQuotaBypassed()).toBe(false)
  })
})

describe('assertCanUseQuota / consumeQuota with DEV_BYPASS_QUOTA active', () => {
  test('assertCanUseQuota always allows, without touching the quota repository, when bypassed', async () => {
    setEnv({ NODE_ENV: 'development', DEV_BYPASS_QUOTA: 'true' })
    const result = await assertCanUseQuota('any-device-id-does-not-need-to-be-real')
    expect(result.ok).toBe(true)
    expect(result.status.disabled).toBe(true)
  })

  test('consumeQuota always allows and never persists usage when bypassed', async () => {
    setEnv({ NODE_ENV: 'development', DEV_BYPASS_QUOTA: 'true' })
    const result = await consumeQuota('any-device-id-does-not-need-to-be-real')
    expect(result.ok).toBe(true)
    expect(result.status.disabled).toBe(true)
  })
})

describe('getQuotaStatus with DEV_BYPASS_QUOTA active', () => {
  // Regression: GET /api/quota is what the frontend's "오늘 횟수 소진" gate
  // (InputStep's quotaBlocked, QuotaBadge) actually reads — assertCanUseQuota/
  // consumeQuota bypassing /api/preview wasn't enough, because a device
  // already sitting at used>=maxAllowed stayed reported as canAnalyze:false
  // here. Forces the file-backed repository (DATABASE_URL unset) so this
  // doesn't depend on a real Postgres connection.
  const deviceId = 'quota-status-bypass-test-device'

  afterEach(() => {
    const store = readStore()
    delete store.devices[deviceId]
    writeStore(store)
  })

  test('an already-exhausted device is still reported canAnalyze:true, and its stored used count is left untouched', async () => {
    setEnv({ NODE_ENV: 'development', DATABASE_URL: undefined, RATE_LIMIT_DISABLED: undefined, DEV_BYPASS_QUOTA: undefined })
    const kstDate = getKstDateString()
    const exhausted = { date: kstDate, used: 999, shareBonus: 0, lastShareAt: 0 }
    const store = readStore()
    store.devices[deviceId] = exhausted
    writeStore(store)

    // Sanity check: without the bypass, this device is genuinely blocked.
    const before = await getQuotaStatus(deviceId)
    expect(before.canAnalyze).toBe(false)
    expect(before.remaining).toBe(0)

    setEnv({ DEV_BYPASS_QUOTA: 'true' })
    const status = await getQuotaStatus(deviceId)
    expect(status.canAnalyze).toBe(true)
    expect(status.disabled).toBe(true)

    const stored = readStore()
    expect(stored.devices[deviceId]).toEqual(exhausted)
  })

  test('production ignores DEV_BYPASS_QUOTA here too — the exhausted device stays blocked', async () => {
    setEnv({ NODE_ENV: 'production', DATABASE_URL: undefined, RATE_LIMIT_DISABLED: undefined, DEV_BYPASS_QUOTA: 'true' })
    const kstDate = getKstDateString()
    const exhausted = { date: kstDate, used: 999, shareBonus: 0, lastShareAt: 0 }
    const store = readStore()
    store.devices[deviceId] = exhausted
    writeStore(store)

    const status = await getQuotaStatus(deviceId)
    expect(status.canAnalyze).toBe(false)
    expect(status.disabled).toBe(false)
  })
})
