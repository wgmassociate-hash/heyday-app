import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { extractSpeakerNames, parseMessages } from './parseChat.js'
import { getSelfPickCandidatesForImport } from './speakerLabels.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const productionFixture = readFileSync(
  join(REPO_ROOT, 'samples/06-time-speaker-production.txt'),
  'utf8',
)

describe('HH:MM speaker message parser regression', () => {
  test('extracts the two real speakers instead of the hour prefixes', () => {
    expect(extractSpeakerNames(productionFixture)).toEqual(['신정근', '전찬형'])
  })

  test('parses timestamp, speaker, and message from the compact format', () => {
    const messages = parseMessages('21:35 신정근 어디냐?\n21:37 전찬형 집에서 씻으려고')
    expect(messages).toMatchObject([
      { timestamp: '21:35', speaker: '신정근', content: '어디냐?' },
      { timestamp: '21:37', speaker: '전찬형', content: '집에서 씻으려고' },
    ])
  })

  test('ignores a Korean date divider as a speaker or message', () => {
    const messages = parseMessages('2026년 8월 12일 수요일\n00:27 전찬형 우울해서')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ speaker: '전찬형', content: '우울해서' })
  })

  test('deduplicates repeated messages from the same speaker', () => {
    const text = [
      '00:27 전찬형 우울해서',
      '00:27 전찬형 와인한잔',
      '00:27 전찬형 하고있다',
    ].join('\n')
    expect(extractSpeakerNames(text)).toEqual(['전찬형'])
    expect(parseMessages(text)).toHaveLength(3)
  })

  test('still allows a normal speaker name that contains a digit', () => {
    expect(parseMessages('21:35 민수2 안녕')[0]).toMatchObject({
      speaker: '민수2',
      content: '안녕',
    })
  })

  test('filters numeric, time, date, and parser-control speaker candidates', () => {
    const text = [
      '21: 잘못된 후보',
      '00: 잘못된 후보',
      '01: 잘못된 후보',
      '10: 잘못된 후보',
      '21:35: 잘못된 후보',
      '2026년 8월 12일: 잘못된 후보',
      '__speaker__: 잘못된 후보',
    ].join('\n')
    expect(getSelfPickCandidatesForImport(text)).toEqual([])
  })
})
