import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env') })

const { asyncHandler } = await import('./asyncHandler.js')
const { analyzeWithClaude } = await import('./analyze.js')
const { extractChatFromScreenshots } = await import('./ocrScreenshots.js')
const { anonymizeChatText, getConversationMeta, parseMessages } = await import('../src/utils/parseChat.js')
const { scrubResultNames } = await import('../src/utils/scrubResult.js')

const app = express()
const PORT = process.env.PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

app.use(cors())
app.use(express.json({ limit: '12mb' }))

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: '이미지 용량이 너무 큽니다. 스크린샷을 줄이거나 장 수를 줄여 주세요.' })
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: '요청 형식이 올바르지 않습니다.' })
  }
  next(err)
})

app.use((_req, res, next) => {
  res.setTimeout(180_000)
  next()
})

/** AdSense ads.txt — Render 환경 변수 ADSENSE_PUBLISHER_ID 만 넣으면 자동 생성 */
app.get('/ads.txt', (_req, res) => {
  let pub = String(process.env.ADSENSE_PUBLISHER_ID || '').trim()
  if (!pub) {
    return res.status(404).type('text/plain').send('# ADSENSE_PUBLISHER_ID not configured\n')
  }
  pub = pub.replace(/^ca-pub-/i, 'pub-')
  if (!pub.startsWith('pub-')) pub = `pub-${pub}`
  res
    .type('text/plain')
    .send(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`)
})

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
    ocrModel: process.env.ANTHROPIC_OCR_MODEL || 'claude-haiku-4-5',
  })
})

app.post('/api/ocr-screenshots', asyncHandler(async (req, res) => {
  const { images } = req.body ?? {}

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: isProd
        ? 'API 키가 설정되지 않았습니다. Render → Environment → ANTHROPIC_API_KEY를 추가한 뒤 재배포하세요.'
        : 'API 키가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 추가하세요.',
    })
  }

  try {
    const result = await extractChatFromScreenshots(images)
    res.json(result)
  } catch (err) {
    console.error('[ocr]', err.message)
    const status = /API 키|스크린샷|이미지|잘못된/.test(err.message) ? 400 : 500
    res.status(status).json({ error: err.message || '스크린샷 OCR에 실패했습니다.' })
  }
}))

app.post('/api/analyze', asyncHandler(async (req, res) => {
  const { text, nameMap: clientNameMap } = req.body ?? {}

  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ error: '분석할 대화 텍스트가 너무 짧습니다.' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: isProd
        ? 'API 키가 설정되지 않았습니다. Render → Environment → ANTHROPIC_API_KEY를 추가한 뒤 재배포하세요.'
        : 'API 키가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 추가하세요.',
      fallback: true,
    })
  }

  try {
    const { anonymizedText, nameMap: derivedNameMap } = anonymizeChatText(text.trim())
    const nameMap =
      clientNameMap && typeof clientNameMap === 'object' && Object.keys(clientNameMap).length > 0
        ? clientNameMap
        : derivedNameMap

    if (Object.keys(nameMap).length === 0) {
      console.warn('[analyze] 발화자 추출 실패 — 카톡 내보내기 형식인지 확인하세요')
    } else if (!isProd) {
      console.log('[analyze] 익명화:', Object.entries(nameMap).map(([k, v]) => `${k}→${v}`).join(', '))
    }

    let result = await analyzeWithClaude(anonymizedText)
    result = scrubResultNames(result, nameMap)
    const meta = getConversationMeta(parseMessages(anonymizedText))
    res.json({ ...result, conversationMeta: result.conversationMeta ?? meta })
  } catch (err) {
    console.error('[analyze]', err.message)
    res.status(500).json({
      error: err.message || 'Claude API 분석 중 오류가 발생했습니다.',
      fallback: true,
    })
  }
}))

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: '이미지 용량이 너무 큽니다. 스크린샷을 줄이거나 장 수를 줄여 주세요.' })
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: '요청 형식이 올바르지 않습니다.' })
  }
  console.error('[server]', err)
  res.status(500).json({ error: err?.message || '서버 오류가 발생했습니다.' })
})

if (isProd) {
  const dist = join(__dirname, '../dist')
  app.use(express.static(dist))
  app.get(/^(?!\/api)(?!\/ads\.txt).*/, (_req, res) => {
    res.sendFile(join(dist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`API server → http://localhost:${PORT}`)
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('✅ ANTHROPIC_API_KEY 로드됨')
  } else {
    console.warn('⚠️  ANTHROPIC_API_KEY 없음 — /api/analyze는 로컬 폴백으로 동작합니다')
  }
})
