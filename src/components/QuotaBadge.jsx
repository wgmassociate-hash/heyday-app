export default function QuotaBadge({ quota, className = '' }) {
  if (!quota || quota.disabled) return null

  const { remaining, maxAllowed, usedToday } = quota
  const low = remaining <= 1
  const empty = remaining <= 0

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
        empty
          ? 'bg-amber-50 border-amber-200 text-amber-800'
          : low
            ? 'bg-violet-50 border-violet-200 text-violet-800'
            : 'bg-white border-pink-100 text-gray-700'
      } ${className}`}
      title={`오늘 ${usedToday}/${maxAllowed}회 사용`}
    >
      <span aria-hidden="true">🎫</span>
      <span>
        {empty ? '오늘 횟수 소진' : `오늘 ${remaining}회 남음`}
      </span>
      {usedToday > 0 && (
        <span className="text-[10px] font-semibold opacity-60">
          ({usedToday}회 사용)
        </span>
      )}
    </div>
  )
}
