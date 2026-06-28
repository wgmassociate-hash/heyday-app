import { toBlob } from 'html-to-image'

const APP_URL = 'https://app.heydaystar.co.kr'

function shouldIncludeNode(node) {
  if (!(node instanceof Element)) return true
  if (node.dataset.exportExclude !== undefined) return false
  return true
}

/** @param {HTMLElement} exportElement */
export async function captureResultExportBlob(exportElement) {
  if (!exportElement) throw new Error('저장할 결과를 찾을 수 없어요')

  await document.fonts.ready
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

  const height = exportElement.scrollHeight
  const pixelRatio = height > 8000 ? 1 : height > 5000 ? 1.25 : 2

  const blob = await toBlob(exportElement, {
    cacheBust: true,
    pixelRatio,
    backgroundColor: '#fdf2f8',
    filter: shouldIncludeNode,
  })

  if (!blob) throw new Error('이미지 생성 실패')
  return blob
}

export function downloadShareBlob(blob, score) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `heydaystar-호감도${score}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** @param {HTMLElement} exportElement @param {number} totalScore */
export async function saveResultImage(exportElement, totalScore) {
  const blob = await captureResultExportBlob(exportElement)
  downloadShareBlob(blob, totalScore)
  return blob
}

/**
 * @returns {'shared' | 'downloaded'}
 */
export async function shareResultImage(exportElement, totalScore) {
  const blob = await captureResultExportBlob(exportElement)
  const file = new File([blob], `heydaystar-호감도${totalScore}.png`, { type: 'image/png' })
  const shareText = `카톡 호감도 ${totalScore}점 💕 나도 heydaystar로 분석해봐!`

  if (navigator.share) {
    try {
      const payload = {
        title: 'heydaystar 카톡 분석 결과',
        text: shareText,
        url: APP_URL,
      }
      if (navigator.canShare?.({ files: [file] })) {
        payload.files = [file]
      }
      await navigator.share(payload)
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') throw err
    }
  }

  downloadShareBlob(blob, totalScore)
  return 'downloaded'
}
