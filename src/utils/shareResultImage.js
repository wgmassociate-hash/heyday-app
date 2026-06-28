const W = 1080
const PAD = 48
const INNER_X = 96
const CONTENT_W = W - INNER_X * 2
const APP_URL = 'https://app.heydaystar.co.kr'

function verdictLabel(score) {
  if (score >= 80) return '호감 확실 🔥'
  if (score >= 65) return '가능성 있음 ✨'
  if (score >= 50) return '애매함 🤔'
  return '관심 낮음 💤'
}

function scoreColors(score) {
  if (score >= 80) return ['#34d399', '#059669']
  if (score >= 60) return ['#f472b6', '#db2777']
  return ['#fbbf24', '#d97706']
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

/** @param {number} lineHeight */
function wrapLines(ctx, text, maxWidth, maxLines = 4, lineHeight = 38) {
  if (!text) return { lines: [], height: 0, lineHeight }

  const chunks = String(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .flatMap((p) => p.trim())
    .filter(Boolean)

  const lines = []
  for (const chunk of chunks) {
    let line = ''
    for (const ch of chunk) {
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = ch
        if (lines.length >= maxLines) break
      } else {
        line = test
      }
    }
    if (lines.length >= maxLines) break
    if (line) lines.push(line)
    if (lines.length >= maxLines) break
  }

  if (lines.length === maxLines) {
    const joined = chunks.join('')
    if (joined.length > lines.join('').length + 2) {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/…$/, '')}…`
    }
  }

  return { lines, height: lines.length * lineHeight, lineHeight }
}

function drawSectionTitle(ctx, title, y) {
  ctx.textAlign = 'left'
  ctx.fillStyle = '#111827'
  ctx.font = '800 30px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillText(title, INNER_X, y)
  return y + 44
}

function drawBodyBlock(ctx, text, y, maxLines = 5, fontSize = 26, color = '#374151') {
  ctx.font = `500 ${fontSize}px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
  ctx.fillStyle = color
  const { lines, height, lineHeight } = wrapLines(ctx, text, CONTENT_W, maxLines, fontSize + 12)
  let cy = y
  for (const line of lines) {
    ctx.fillText(line, INNER_X, cy)
    cy += lineHeight
  }
  return y + height + 16
}

function drawTintedBlock(ctx, y, h, fill = '#faf5ff', stroke = '#ede9fe') {
  roundRect(ctx, INNER_X, y, CONTENT_W, h, 20)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawMetricBar(ctx, x, y, width, label, score) {
  roundRect(ctx, x, y, width, 56, 14)
  ctx.fillStyle = '#f9fafb'
  ctx.fill()

  ctx.fillStyle = '#374151'
  ctx.font = '600 26px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(label, x + 20, y + 30)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#111827'
  ctx.fillText(`${score}점`, x + width - 20, y + 30)

  roundRect(ctx, x + 20, y + 38, width - 40, 10, 5)
  ctx.fillStyle = '#e5e7eb'
  ctx.fill()

  const barW = Math.max(10, ((width - 40) * score) / 100)
  roundRect(ctx, x + 20, y + 38, barW, 10, 5)
  const grad = ctx.createLinearGradient(x, 0, x + width, 0)
  grad.addColorStop(0, '#f472b6')
  grad.addColorStop(1, '#8b5cf6')
  ctx.fillStyle = grad
  ctx.fill()
}

function drawDominanceBar(ctx, y, detail) {
  const barY = y + 8
  const barH = 44
  roundRect(ctx, INNER_X, barY, CONTENT_W, barH, 16)
  ctx.fillStyle = '#f3f4f6'
  ctx.fill()

  const aW = (CONTENT_W * detail.personA) / 100
  roundRect(ctx, INNER_X, barY, aW, barH, 16)
  const grad = ctx.createLinearGradient(INNER_X, 0, INNER_X + CONTENT_W, 0)
  grad.addColorStop(0, '#f472b6')
  grad.addColorStop(1, '#8b5cf6')
  ctx.fillStyle = grad
  ctx.fill()

  ctx.font = '700 22px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  if (detail.personA >= 22) ctx.fillText(`${detail.personA}%`, INNER_X + aW / 2, barY + 30)
  if (detail.personB >= 22) {
    ctx.fillText(`${detail.personB}%`, INNER_X + aW + (CONTENT_W - aW) / 2, barY + 30)
  }

  ctx.textAlign = 'left'
  ctx.font = '600 24px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillStyle = '#4b5563'
  ctx.fillText(
    `${detail.personALabel} ${detail.personA}%  ·  ${detail.personBLabel} ${detail.personB}%`,
    INNER_X,
    barY + barH + 36,
  )
  return barY + barH + 52
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} result
 * @returns {number} bottom y
 */
function paintShareCard(ctx, result) {
  const {
    totalScore = 0,
    relationTag = '관계 분석',
    scoreLabel = '호감도',
    aiSummary = '',
    psychologySummary = '',
    dominance = '',
    dominanceDetail,
    metrics = {},
    deepMetrics,
    criticalMoments = [],
    solution = '',
    solutionTitle = '이렇게 해봐',
    detectedTopics = [],
  } = result

  const cardH = 3600
  const bg = ctx.createLinearGradient(0, 0, W, cardH)
  bg.addColorStop(0, '#fdf2f8')
  bg.addColorStop(0.35, '#ffffff')
  bg.addColorStop(1, '#f5f3ff')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, cardH)

  roundRect(ctx, PAD, PAD, W - PAD * 2, cardH - PAD * 2, 36)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(236, 72, 153, 0.12)'
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 8
  ctx.fill()
  ctx.shadowColor = 'transparent'

  let y = 110

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ec4899'
  ctx.font = '800 34px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillText('💕 heydaystar', W / 2, y)
  y += 42
  ctx.fillStyle = '#6b7280'
  ctx.font = '600 26px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillText('카톡 밀당 · 호감도 AI 분석 리포트', W / 2, y)
  y += 56

  const [c1, c2] = scoreColors(totalScore)
  const cx = W / 2
  const ringR = 100
  const cy = y + ringR
  const ringGrad = ctx.createLinearGradient(cx - ringR, cy - ringR, cx + ringR, cy + ringR)
  ringGrad.addColorStop(0, c1)
  ringGrad.addColorStop(1, c2)
  ctx.beginPath()
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
  ctx.fillStyle = ringGrad
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = '900 88px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillText(String(totalScore), cx, cy + 20)
  ctx.font = '700 24px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillText(scoreLabel, cx, cy + 52)
  y = cy + ringR + 36

  ctx.fillStyle = '#db2777'
  ctx.font = '800 30px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillText(verdictLabel(totalScore), cx, y)
  y += 36

  roundRect(ctx, INNER_X + 80, y, CONTENT_W - 160, 58, 18)
  ctx.fillStyle = '#fce7f3'
  ctx.fill()
  ctx.fillStyle = '#be185d'
  ctx.font = '800 28px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillText(relationTag, cx, y + 38)
  y += 78

  if (detectedTopics.length > 0) {
    ctx.textAlign = 'center'
    ctx.font = '600 22px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
    ctx.fillStyle = '#6b7280'
    const tags = detectedTopics.slice(0, 5).map((t) => `#${t}`).join('  ')
    ctx.fillText(tags, W / 2, y)
    y += 40
  }

  const metricList = Object.values(metrics)
  if (metricList.length > 0) {
    y = drawSectionTitle(ctx, '📊 세부 점수', y)
    for (const m of metricList) {
      drawMetricBar(ctx, INNER_X, y, CONTENT_W, m.label, m.score)
      y += 72
    }
    y += 8
  }

  if (dominanceDetail || dominance) {
    y = drawSectionTitle(ctx, '⚖️ 대화 주도권', y)
    y = drawBodyBlock(ctx, dominance, y, 3, 25, '#4b5563')
    if (dominanceDetail) y = drawDominanceBar(ctx, y, dominanceDetail)
    y += 12
  }

  if (deepMetrics) {
    y = drawSectionTitle(ctx, '🧬 심층 패턴', y)
    const tm = deepMetrics.textMirroring
    const rsa = deepMetrics.replySpeedAsymmetry
    if (tm) {
      ctx.font = '700 24px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
      ctx.fillStyle = '#7c3aed'
      ctx.textAlign = 'left'
      ctx.fillText(`미러링 ${tm.score}점`, INNER_X, y)
      y += 32
      y = drawBodyBlock(ctx, tm.interpretation, y, 3, 24, '#4b5563')
    }
    if (rsa) {
      ctx.font = '700 24px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
      ctx.fillStyle = '#7c3aed'
      ctx.fillText(`답장 속도 · ${rsa.gapRatio || '비율'} (${rsa.fasterSide} 더 빠름)`, INNER_X, y)
      y += 32
      y = drawBodyBlock(ctx, rsa.interpretation, y, 3, 24, '#4b5563')
    }
    y += 8
  }

  if (psychologySummary) {
    const blockTop = y
    y = drawSectionTitle(ctx, '🧠 관계 심리 분석', y)
    y = drawBodyBlock(ctx, psychologySummary, y, 7, 25, '#374151')
    ctx.save()
    ctx.globalCompositeOperation = 'destination-over'
    drawTintedBlock(ctx, blockTop - 8, y - blockTop + 12, '#faf5ff', '#ede9fe')
    ctx.restore()
    y += 20
  }

  if (aiSummary) {
    y = drawSectionTitle(ctx, '🤖 AI 대화 요약', y)
    y = drawBodyBlock(ctx, aiSummary, y, 6, 25, '#374151')
    y += 8
  }

  const moments = criticalMoments.slice(0, 2)
  if (moments.length > 0) {
    y = drawSectionTitle(ctx, '💬 핵심 순간', y)
    for (const m of moments) {
      const quote = m.quote ? `「${String(m.quote).slice(0, 48)}${m.quote.length > 48 ? '…' : ''}」` : ''
      const blockTop = y
      if (quote) {
        ctx.font = '600 24px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
        ctx.fillStyle = '#db2777'
        ctx.textAlign = 'left'
        const { lines } = wrapLines(ctx, quote, CONTENT_W - 32, 2, 34)
        let qy = y + 28
        for (const line of lines) {
          ctx.fillText(line, INNER_X + 16, qy)
          qy += 34
        }
        y = qy + 8
      }
      y = drawBodyBlock(ctx, m.psychologicalInsight || m.insight || '', y, 3, 23, '#4b5563')
      ctx.save()
      ctx.globalCompositeOperation = 'destination-over'
      drawTintedBlock(ctx, blockTop, y - blockTop + 12, '#fff1f2', '#fecdd3')
      ctx.restore()
      y += 20
    }
  }

  if (solution) {
    y = drawSectionTitle(ctx, `💡 ${solutionTitle}`, y)
    y = drawBodyBlock(ctx, solution, y, 6, 24, '#374151')
    y += 8
  }

  roundRect(ctx, INNER_X, y + 8, CONTENT_W, 82, 18)
  const ctaGrad = ctx.createLinearGradient(INNER_X, 0, INNER_X + CONTENT_W, 0)
  ctaGrad.addColorStop(0, '#ec4899')
  ctaGrad.addColorStop(1, '#8b5cf6')
  ctx.fillStyle = ctaGrad
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 28px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillText('나도 분석하기 👉 app.heydaystar.co.kr', W / 2, y + 58)

  y += 110
  ctx.fillStyle = '#9ca3af'
  ctx.font = '500 20px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillText('대화 원문·이름은 저장되지 않아요 · heydaystar', W / 2, y)

  return y + 40
}

/**
 * @param {object} result
 * @returns {HTMLCanvasElement}
 */
export function renderResultShareCard(result) {
  const scratch = document.createElement('canvas')
  scratch.width = W
  scratch.height = 3600
  const scratchCtx = scratch.getContext('2d')
  const bottomY = paintShareCard(scratchCtx, result)

  const finalH = Math.max(1400, Math.min(3600, bottomY + PAD))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = finalH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(scratch, 0, 0, W, finalH, 0, 0, W, finalH)
  return canvas
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('이미지 생성 실패'))),
      'image/png',
      0.92,
    )
  })
}

/** @param {object} result */
export async function createResultShareBlob(result) {
  const canvas = renderResultShareCard(result)
  return canvasToBlob(canvas)
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

/**
 * @returns {'shared' | 'downloaded'}
 */
export async function shareResultImage(result) {
  const blob = await createResultShareBlob(result)
  const file = new File([blob], `heydaystar-호감도${result.totalScore}.png`, { type: 'image/png' })
  const shareText = `카톡 호감도 ${result.totalScore}점 💕 나도 heydaystar로 분석해봐!`

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

  downloadShareBlob(blob, result.totalScore)
  return 'downloaded'
}

export async function saveResultImage(result) {
  const blob = await createResultShareBlob(result)
  downloadShareBlob(blob, result.totalScore)
  return blob
}
