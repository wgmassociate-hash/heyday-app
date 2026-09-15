// Phase 0.5 — DB fallback policy. Replaces the "always silently fall back to
// the file store on any Postgres error" behavior from the first Phase 0 pass,
// which is unsafe in production: a Postgres outage would have silently reset
// quota/usage state to empty defaults instead of surfacing as an error.
//
// Policy:
//   - DATABASE_URL unset, NODE_ENV!=production
//                                   → use the file store directly (1.0
//                                     compatibility path — this is not a
//                                     "failure", it's "no DB configured").
//   - DATABASE_URL unset, NODE_ENV=production
//                                   → ALWAYS throw DatabaseUnavailableError.
//                                     Production Closing hard guard (V2): an
//                                     operator forgetting to set DATABASE_URL
//                                     must never silently degrade to Render's
//                                     ephemeral filesystem (wiped on every
//                                     restart/redeploy) — that's exactly the
//                                     failure mode the Postgres migration was
//                                     built to eliminate, so "not configured"
//                                     gets treated identically to "configured
//                                     but unreachable" in production.
//   - DATABASE_URL set, call fails, NODE_ENV=production
//                                   → ALWAYS throw DatabaseUnavailableError.
//                                     File fallback is never allowed in prod,
//                                     regardless of ALLOW_FILE_DB_FALLBACK.
//   - DATABASE_URL set, call fails, NODE_ENV!=production
//                                   → fall back to file store ONLY if
//                                     ALLOW_FILE_DB_FALLBACK=true is set
//                                     explicitly; otherwise also throw.
export class DatabaseUnavailableError extends Error {
  cause?: unknown

  constructor(cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`Postgres 연결/쿼리에 실패했고, 이 환경에서는 파일 폴백이 허용되지 않습니다: ${detail}`)
    this.name = 'DatabaseUnavailableError'
    this.cause = cause
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/** True only when a developer has explicitly opted into silent file fallback. */
export function isFileFallbackAllowed(): boolean {
  if (isProduction()) return false
  return String(process.env.ALLOW_FILE_DB_FALLBACK || '').toLowerCase() === 'true'
}

/** True when this environment may use the on-disk file store as a repository
 * backend for the "DATABASE_URL isn't set at all" case. Only ever true
 * outside production — see the file-header note on why production must
 * treat "unconfigured" exactly like "configured but unreachable". */
export function isFileStoreAllowedWhenUnconfigured(): boolean {
  return !isProduction()
}

/** Builds the same DatabaseUnavailableError a failed Postgres call would
 * throw, for the "DATABASE_URL isn't set at all, and this is production"
 * case — so every caller (route handlers, error middleware) that already
 * checks `isDatabaseUnavailable(err)` handles this identically to a real
 * outage (503, code: DATABASE_UNAVAILABLE) without a separate code path. */
export function unconfiguredDatabaseError(context: string): DatabaseUnavailableError {
  return new DatabaseUnavailableError(
    new Error(`[${context}] DATABASE_URL이 설정되지 않았습니다`),
  )
}

let warned = false
function warnFallbackOnce(context: string, err: unknown) {
  if (warned) return
  warned = true
  const detail = err instanceof Error ? err.message : String(err)
  console.warn(
    `[${context}] Postgres 실패, ALLOW_FILE_DB_FALLBACK=true(개발 전용)라 파일 저장으로 폴백합니다: ${detail}`,
  )
}

/**
 * Runs `primary()` (a Postgres operation). On failure, either falls back to
 * `fallback()` (file store) — only when explicitly allowed — or rethrows as
 * DatabaseUnavailableError so callers never silently lose quota/usage state.
 */
export async function withFallbackPolicy<T>(
  context: string,
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await primary()
  } catch (err) {
    if (isFileFallbackAllowed()) {
      warnFallbackOnce(context, err)
      return fallback()
    }
    throw new DatabaseUnavailableError(err)
  }
}

/** Test-only: reset the "already warned once" latch between test cases. */
export function _resetWarnedForTests() {
  warned = false
}
