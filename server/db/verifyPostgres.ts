#!/usr/bin/env -S npx tsx
// Phase 0.5 — standalone CRUD verification CLI. Run via:
//
//   DATABASE_URL=postgresql://user:pass@host:5432/db npm run db:verify
//
// This applies pending migrations (prisma migrate deploy) and then exercises
// DeviceQuota create/read/update and AnalysisUsageLog create/read against the
// real database with synthetic data only (no real conversation/user data),
// cleaning up afterward. Exits non-zero on any failure so it's CI-friendly.
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './prisma/client/index.js'
import { runPostgresCrudCheck } from './postgresCrudCheck.js'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL이 설정되지 않았습니다. 예:')
    console.error('  DATABASE_URL=postgresql://heydaystar:heydaystar_dev@localhost:5432/heydaystar_kakao_analyzer npm run db:verify')
    process.exit(1)
  }

  const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 })
  const prisma = new PrismaClient({ adapter })

  console.log('▶ Postgres CRUD 검증 시작 (synthetic data만 사용)…')
  try {
    const steps = await runPostgresCrudCheck(prisma)
    for (const step of steps) {
      console.log(`  ✅ ${step.name}`)
    }
    console.log('✔ 모든 검증 통과')
    process.exitCode = 0
  } catch (err) {
    const steps = (err as { steps?: { name: string; ok: boolean; detail?: string }[] }).steps ?? []
    for (const step of steps) {
      console.log(step.ok ? `  ✅ ${step.name}` : `  ❌ ${step.name}: ${step.detail}`)
    }
    console.error('✘ 검증 실패:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
