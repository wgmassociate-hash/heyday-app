export default function PrivacyBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-50 border border-emerald-200/80 text-sm text-emerald-800 font-medium">
      <span aria-hidden="true">🔒</span>
      저장 안 함 · 이름 자동 가림
    </div>
  )
}
