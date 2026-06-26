export default function PrivacyBadge() {
  return (
    <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-emerald-50 border border-emerald-200/80 shadow-sm">
      <svg
        className="w-5 h-5 text-emerald-600 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
      <p className="text-sm text-emerald-800 leading-snug">
        <span className="font-semibold">개인정보 보호</span>
        <span className="text-emerald-600 mx-1">·</span>
        서버에 대화 내용이 절대 저장되지 않으며, 브라우저 내에서 즉시 익명화되어 안전합니다
      </p>
    </div>
  )
}
