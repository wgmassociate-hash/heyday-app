export default function PrivacyBadge() {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-3 text-left mb-3">
      <p className="text-sm font-bold text-gray-700 mb-2">
        🔒 대화 내용은 이렇게 처리해요
      </p>
      <ul className="text-xs text-gray-600 space-y-1 leading-relaxed list-disc pl-4">
        <li>이름·연락처 등은 가능한 범위에서 가린 뒤 분석해요.</li>
        <li>원본 대화 파일·스크린샷은 분석 후 보관하지 않아요.</li>
        <li>분석 전 AI에 전달될 내용을 직접 확인할 수 있어요.</li>
        <li>이용 통계에는 대화 내용이나 이름을 전송하지 않아요.</li>
      </ul>
      <p className="text-xs text-gray-500 leading-relaxed mt-2">
        일부 개인정보는 가림 처리 후에도 남을 수 있어요.
      </p>
    </div>
  )
}
