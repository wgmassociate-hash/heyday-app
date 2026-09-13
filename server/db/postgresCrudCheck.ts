// Phase 0.5 — synthetic (non-user) CRUD verification against a real Postgres.
// Shared by the CLI script (server/db/verifyPostgres.ts) and the vitest
// integration test (server/db/postgresCrud.integration.test.ts) so both stay
// in sync. No real conversation/user data is used or required — only
// throwaway rows keyed by a random id, cleaned up at the end regardless of
// outcome.
import type { PrismaClient } from './prisma/client/index.js'

export interface CrudCheckStep {
  name: string
  ok: boolean
  detail?: string
}

/**
 * Runs create/read/update for DeviceQuota and create/read for
 * AnalysisUsageLog against the given Prisma client, then deletes both rows.
 * Throws on the first failed assertion; the caller decides how to report it.
 */
export async function runPostgresCrudCheck(prisma: PrismaClient): Promise<CrudCheckStep[]> {
  const steps: CrudCheckStep[] = []
  const testDeviceId = `__phase0_5_verify__${Date.now()}_${Math.random().toString(36).slice(2)}`
  const testDate = '2000-01-01' // deliberately not "today" — synthetic, never collides with real quota data

  try {
    // --- DeviceQuota: create ---
    await prisma.deviceQuota.create({
      data: { deviceId: testDeviceId, date: testDate, used: 1, shareBonus: 0, lastShareAt: 0n },
    })
    steps.push({ name: 'DeviceQuota.create', ok: true })

    // --- DeviceQuota: read ---
    const created = await prisma.deviceQuota.findUnique({ where: { deviceId: testDeviceId } })
    if (!created || created.used !== 1 || created.date !== testDate) {
      throw new Error(`DeviceQuota.read mismatch: ${JSON.stringify(created)}`)
    }
    steps.push({ name: 'DeviceQuota.read', ok: true })

    // --- DeviceQuota: update ---
    await prisma.deviceQuota.update({
      where: { deviceId: testDeviceId },
      data: { used: 2, shareBonus: 1, lastShareAt: 123456789n },
    })
    const updated = await prisma.deviceQuota.findUnique({ where: { deviceId: testDeviceId } })
    if (!updated || updated.used !== 2 || updated.shareBonus !== 1 || updated.lastShareAt !== 123456789n) {
      throw new Error(`DeviceQuota.update mismatch: ${JSON.stringify(updated)}`)
    }
    steps.push({ name: 'DeviceQuota.update', ok: true })

    // --- AnalysisUsageLog: create ---
    const log = await prisma.analysisUsageLog.create({
      data: {
        deviceId: testDeviceId,
        callSite: 'analyze',
        model: 'synthetic-test-model',
        inputTokens: 10,
        outputTokens: 20,
        costEstimate: 0.001,
        durationMs: 5,
        success: true,
        errorMessage: null,
      },
    })
    steps.push({ name: 'AnalysisUsageLog.create', ok: true })

    // --- AnalysisUsageLog: read ---
    const readBack = await prisma.analysisUsageLog.findUnique({ where: { id: log.id } })
    if (!readBack || readBack.inputTokens !== 10 || readBack.outputTokens !== 20) {
      throw new Error(`AnalysisUsageLog.read mismatch: ${JSON.stringify(readBack)}`)
    }
    steps.push({ name: 'AnalysisUsageLog.read', ok: true })

    // --- cleanup ---
    await prisma.analysisUsageLog.delete({ where: { id: log.id } })
    await prisma.deviceQuota.delete({ where: { deviceId: testDeviceId } })
    steps.push({ name: 'cleanup', ok: true })

    return steps
  } catch (err) {
    // Best-effort cleanup even on failure, so a failed run doesn't leave
    // synthetic rows behind.
    await prisma.deviceQuota.deleteMany({ where: { deviceId: testDeviceId } }).catch(() => {})
    await prisma.analysisUsageLog.deleteMany({ where: { deviceId: testDeviceId } }).catch(() => {})
    steps.push({ name: 'FAILED', ok: false, detail: err instanceof Error ? err.message : String(err) })
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), { steps })
  }
}
