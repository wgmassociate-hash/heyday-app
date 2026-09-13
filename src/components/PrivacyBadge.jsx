// 개인정보 고지 문구는 docs/implementation_plan_v2.md §6.1에서 확정된 공식 텍스트를
// 그대로 반영한다 — 실제 데이터 흐름(스크린샷 원본 처리, 이름/전화번호/이메일 스크러빙
// 한계, 유료 리포트 보관기간)과 정확히 일치해야 하며, 임의로 표현을 순화하지 않는다.
export default function PrivacyBadge() {
  return (
    <div className="max-w-md mx-auto rounded-2xl bg-emerald-50/90 border border-emerald-100 px-4 py-3.5 text-left mb-4">
      <p className="text-sm font-black text-emerald-800 mb-2 flex items-center gap-1.5">
        <span aria-hidden="true">🔒</span>
        안심하고 써도 돼
      </p>
      <ul className="text-xs text-emerald-800/85 space-y-1.5 leading-relaxed">
        <li>
          업로드한 대화 파일과 캡처는 분석을 위해 서버 및 AI 처리 서비스로 전송됩니다.{' '}
          <strong>원본 파일은 분석 후 보관하지 않습니다.</strong>
        </li>
        <li>
          <strong>이름·전화번호·이메일 등 일부 개인정보를 가리지만</strong> 모든 개인정보가
          완전히 제거된다고 보장할 수는 없습니다.
        </li>
        <li>
          유료 리포트는 익명화된 분석 결과와 필요한 일부 대화 발췌가{' '}
          <strong>최대 30일</strong> 보관될 수 있습니다.
        </li>
      </ul>
    </div>
  )
}
