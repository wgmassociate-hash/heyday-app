// Phase 0.5 — replaces the wide-open `cors()` (analysis_v1.md §4.13: "CORS
// 전면 허용 — 오리진 제한 없음") with an allowlist. Requests carrying no
// Origin header (same-origin browser navigation, curl, server-to-server,
// most native webviews) are always allowed — CORS only governs cross-origin
// browser fetches, so this preserves same-origin behavior exactly.
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

/** Origins allowed to make cross-origin requests, given the current env. */
export function getAllowedOrigins(): string[] {
  const configured = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (process.env.NODE_ENV === 'production') return configured
  // Development: Vite's dev server origin is always allowed, in addition to
  // anything explicitly configured (e.g. a staging origin).
  return [...DEV_ORIGINS, ...configured]
}

/**
 * `cors` package origin callback. `callback(null, false)` (not an Error) is
 * the correct way to reject: the `cors` middleware then omits the
 * Access-Control-Allow-Origin header and calls next() normally — the actual
 * route still runs, but a real browser's same-origin policy blocks the
 * frontend JS from reading the response. It does not itself produce a 403.
 */
export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  if (!origin) return callback(null, true) // same-origin / non-browser request
  callback(null, getAllowedOrigins().includes(origin))
}
