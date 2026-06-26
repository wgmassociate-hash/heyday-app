/** Express async 라우트 — 미처리 reject 시 프로세스 종료 방지 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
