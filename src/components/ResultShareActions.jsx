import { useState } from 'react'
import { saveResultImage, shareResultImage } from '../utils/shareResultImage.js'

export default function ResultShareActions({
  exportRef,
  totalScore,
  onShareSuccess,
  fileName = totalScore === undefined ? 'heydaystar-카톡관계분석-요약.png' : `heydaystar-호감도${totalScore}.png`,
  shareTitle = 'heydaystar 카톡 관계 분석',
  shareText = totalScore === undefined
    ? '카톡 대화로 관계의 흐름을 읽어봤어. 너도 heydaystar에서 분석해봐!'
    : `카톡 호감도 ${totalScore}점 💕 나도 heydaystar로 분석해봐!`,
  heading = '📸 결과 저장 · 공유',
  description = '분석 요약을 이미지로 저장하거나 친구에게 공유할 수 있어요.',
  saveLabel = '📥 결과 이미지 저장',
  shareLabel = '💬 카톡으로 공유하기',
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const handleSave = async () => {
    setBusy(true)
    setMessage('')
    try {
      await saveResultImage(exportRef.current, fileName)
      setMessage('📥 갤러리/다운로드 폴더에 저장됐어!')
    } catch (err) {
      setMessage(err?.message || '저장 실패 — 다시 시도해줘')
    } finally {
      setBusy(false)
    }
  }

  const handleKakaoShare = async () => {
    setBusy(true)
    setMessage('')
    try {
      const mode = await shareResultImage(exportRef.current, { fileName, title: shareTitle, text: shareText })
      if (mode === 'shared') {
        setMessage('💬 공유 완료! 카톡에서 골라서 보내줘')
        onShareSuccess?.()
      } else {
        setMessage('📥 이미지 저장됨 → 카톡에서 사진 보내기로 공유해줘')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setMessage(err?.message || '공유 실패 — 저장 버튼을 써줘')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-violet-50/60 p-4 md:p-5">
      <p className="text-sm font-black text-gray-800 mb-1 text-center">{heading}</p>
      <p className="text-xs text-gray-500 mb-4 text-center leading-relaxed">
        {description}
        <br />
        <span className="text-gray-400">(광고·대화 원문·이름은 포함 안 됨)</span>
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleSave}
          className="flex-1 py-3.5 px-4 rounded-xl bg-white border-2 border-brand-200 text-sm font-black text-brand-700 hover:bg-brand-50 disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {busy ? '만드는 중…' : saveLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleKakaoShare}
          className="flex-1 py-3.5 px-4 rounded-xl bg-[#FEE500] border-2 border-[#F0D800] text-sm font-black text-[#3C1E1E] hover:brightness-95 disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {busy ? '만드는 중…' : shareLabel}
        </button>
      </div>

      {message && (
        <p className="mt-3 text-xs font-bold text-center text-emerald-600">{message}</p>
      )}
    </div>
  )
}
