// 개인정보 고지 문구는 docs/implementation_plan_v2.md §6.1에서 확정된 공식 텍스트를
// 그대로 반영한다 — 실제 데이터 흐름(스크린샷 원본 처리, 이름/전화번호/이메일 스크러빙
// 한계, 유료 리포트 보관기간)과 정확히 일치해야 하며, 임의로 표현을 순화하지 않는다.
//
// Phase 2.1 (Product UX Calibration item 8): `sourceType`가 'screenshot'일 때는
// 캡처 원본이 OCR을 위해 서버/AI로 일시 전송된다는 사실을 별도 문장으로 명시한다 —
// "브라우저에서 익명화 후 전송"처럼 실제 흐름(Option B: server OCR)과 다른 표현을
// 쓰지 않는다.
export default function PrivacyBadge({ sourceType = 'text' }) {
  return (
    <div className="max-w-md mx-auto rounded-2xl bg-emerald-50/90 border border-emerald-100 px-4 py-3.5 text-left mb-4">
      <p className="text-sm font-black text-emerald-800 mb-2 flex items-center gap-1.5">
        <span aria-hidden="true">🔒</span>
        안심하고 써도 돼
      </p>
      <ul className="text-xs text-emerald-800/85 space-y-1.5 leading-relaxed">
        <li>
          이름·전화번호·이메일 등 식별정보를 가능한 범위에서 가린 뒤 관계 분석에 사용합니다.{' '}
          <strong>모든 개인정보가 완전히 제거된다고 보장할 수는 없습니다.</strong>
        </li>
        {sourceType === 'screenshot' ? (
          <li>
            📸 <strong>캡처 이미지는 문자 추출을 위해</strong> 서버/AI 처리 서비스로 일시
            전송될 수 있으며, <strong>원본 이미지는 보관하지 않습니다.</strong>
          </li>
        ) : (
          <li>
            업로드한 대화 파일은 분석을 위해 서버 및 AI 처리 서비스로 전송되며,{' '}
            <strong>원본 파일은 분석 후 보관하지 않습니다.</strong>
          </li>
        )}
        <li>
          <strong>분석 전에 AI에 전달될 형태를 직접 확인</strong>할 수 있어요.
        </li>
        <li>
          유료 리포트는 익명화된 분석 결과와 필요한 일부 대화 발췌가{' '}
          <strong>최대 30일</strong> 보관될 수 있습니다.
        </li>
      </ul>
    </div>
  )
}
