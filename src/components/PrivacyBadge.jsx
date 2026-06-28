export default function PrivacyBadge() {
  return (
    <div className="max-w-md mx-auto rounded-2xl bg-emerald-50/90 border border-emerald-100 px-4 py-3.5 text-left mb-4">
      <p className="text-sm font-black text-emerald-800 mb-2 flex items-center gap-1.5">
        <span aria-hidden="true">🔒</span>
        안심하고 써도 돼
      </p>
      <ul className="text-xs text-emerald-800/85 space-y-1.5 leading-relaxed">
        <li>
          <strong>대화 내용은 서버에 저장하지 않아.</strong> 분석이 끝나면 브라우저에서만 처리돼.
        </li>
        <li>
          <strong>이름은 자동으로 가려져.</strong> 상대는 「상대방」 또는 「상대방A」처럼 익명으로만 분석돼.
        </li>
      </ul>
    </div>
  )
}
