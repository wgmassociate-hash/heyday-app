import { useState } from 'react'
import { claimShareBonus, getShareUrl, SHARE_MESSAGE } from '../utils/quotaApi.js'

/**
 * @param {'any' | 'blocked-only' | 'blocked-or-low'} showWhen
 * - blocked-only: 횟수 소진 시에만 (입력 화면)
 * - blocked-or-low: 소진 또는 1회 남음 (결과 화면)
 */
export default function ShareQuotaPanel({
  quota,
  onSuccess,
  highlight = false,
  variant = 'card',
  showWhen = 'any',
}) {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  if (!quota || quota.disabled) return null

  const canEarn = quota.canEarnShareBonus
  const empty = !quota.canAnalyze
  const low = quota.remaining <= 1

  if (showWhen === 'blocked-only' && !empty) return null
  if (showWhen === 'blocked-or-low' && !empty && !low) return null
  if (!canEarn && !empty) return null

  const finishShare = async () => {
    setBusy(true)
    setFeedback('')
    try {
      const result = await claimShareBonus()
      if (result.ok && result.quota) {
        setFeedback(`🎉 +1회 추가! 지금 ${result.quota.remaining}번 남았어`)
        onSuccess?.(result.quota)
      } else {
        setFeedback(result.error || '보너스를 받을 수 없어요')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleNativeShare = async () => {
    setBusy(true)
    setFeedback('')
    try {
      const url = getShareUrl()
      if (navigator.share) {
        await navigator.share({
          title: 'heydaystar 카톡 분석',
          text: SHARE_MESSAGE,
          url,
        })
      } else {
        await navigator.clipboard.writeText(`${SHARE_MESSAGE}\n${url}`)
        setFeedback('링크 복사됨! 친구한테 보내봐 📋')
      }
      await finishShare()
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setFeedback('공유가 취소됐거나 실패했어')
      }
      setBusy(false)
    }
  }

  const handleCopyLink = async () => {
    setBusy(true)
    setFeedback('')
    try {
      const url = getShareUrl()
      await navigator.clipboard.writeText(`${SHARE_MESSAGE}\n${url}`)
      setFeedback('링크 복사됨! 카톡에 붙여넣기 📋')
      await finishShare()
    } catch {
      setFeedback('복사 실패 — 링크를 길게 눌러 복사해줘')
      setBusy(false)
    }
  }

  const wrapperClass =
    variant === 'compact'
      ? 'rounded-2xl border border-violet-100 bg-violet-50/60 p-3'
      : `rounded-2xl border-2 p-4 ${
          highlight || empty
            ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-pink-50 shadow-sm'
            : 'border-violet-100 bg-violet-50/50'
        }`

  return (
    <div className={wrapperClass}>
      <p className="text-sm font-black text-gray-800 mb-1">
        {empty ? '🥲 오늘 AI 분석 다 썼어' : '⚡ 1번 더 하려면 공유해줘'}
      </p>
      <p className="text-xs text-gray-600 mb-3 leading-relaxed">
        {empty ? (
          <>
            친구한테 공유하면 <strong>+1회</strong> (오늘 최대 +{quota.shareBonusMax}, 합계{' '}
            {quota.dailyCap}회)
          </>
        ) : (
          <>
            지금 <strong>{quota.remaining}회</strong> 남음 · 공유하면 <strong>+1회</strong> 더 (
            보너스 {quota.shareBonusRemaining}번 가능)
          </>
        )}
      </p>

      {canEarn ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleNativeShare}
            className="flex-1 min-w-[140px] py-2.5 px-4 rounded-xl bg-violet-600 text-white text-sm font-black hover:bg-violet-700 disabled:opacity-50 active:scale-[0.98]"
          >
            {busy ? '처리 중…' : '📤 친구에게 공유'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleCopyLink}
            className="py-2.5 px-4 rounded-xl bg-white border border-violet-200 text-sm font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            🔗 링크 복사
          </button>
        </div>
      ) : (
        <p className="text-xs font-bold text-amber-700">
          오늘 공유 보너스는 다 받았어 (최대 {quota.dailyCap}회). 내일 0시에 리셋!
        </p>
      )}

      {feedback && (
        <p className="mt-2 text-xs font-bold text-emerald-600 text-center">{feedback}</p>
      )}

      {empty && !canEarn && (
        <p className="mt-2 text-[11px] text-gray-500 text-center">
          내일 다시 {quota.baseDaily}번 기본 제공돼 🌙
        </p>
      )}
    </div>
  )
}
