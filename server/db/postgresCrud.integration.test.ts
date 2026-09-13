// Phase 0.5 — real-Postgres integration test. Skipped automatically when no
// DATABASE_URL is set (e.g. this sandbox, or any dev machine without Docker
// running) so it never blocks `npm test`. Run it for real with:
//
//   DATABASE_URL=postgresql://heydaystar:heydaystar_dev@localhost:5432/heydaystar_kakao_analyzer npm test -- postgresCrud.integration
//
// (after `docker compose up -d` and `npm run db:migrate:deploy`).
import { afterAll, describe, expect, test } from 'vitest'
import { runPostgresCrudCheck } from './postgresCrudCheck.js'

const hasDatabase = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDatabase)('Postgres CRUD (requires a real DATABASE_URL)', () => {
  let prisma: import('./prisma/client/index.js').PrismaClient

  afterAll(async () => {
    await prisma?.$disconnect()
  })

  test('DeviceQuota create/read/update and AnalysisUsageLog create/read succeed with synthetic data', async () => {
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const { PrismaClient } = await import('./prisma/client/index.js')
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 })
    prisma = new PrismaClient({ adapter })

    const steps = await runPostgresCrudCheck(prisma)
    expect(steps.every((s) => s.ok)).toBe(true)
    expect(steps.map((s) => s.name)).toEqual([
      'DeviceQuota.create',
      'DeviceQuota.read',
      'DeviceQuota.update',
      'AnalysisUsageLog.create',
      'AnalysisUsageLog.read',
      'cleanup',
    ])
  })
})

if (!hasDatabase) {
  // Vitest requires at least one non-skipped assertion per file to avoid a
  // "no tests found" warning being mistaken for a real failure.
  test.skip('(skipped: set DATABASE_URL to run the real Postgres CRUD check)', () => {})
}
