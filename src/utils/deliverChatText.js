import { anonymizeChatText } from './parseChat.js'
import {
  needsSelfSpeakerSelection,
  textHasSelfSpeaker,
} from './speakerLabels.js'

/**
 * txt·클립보드 등 텍스트 불러오기
 * - 「나」가 있으면 즉시 익명화
 * - 실명 2명 이상이면 원문 유지 → 2단계에서 본인 선택
 */
export function deliverChatText(rawText, onTextLoaded) {
  const trimmed = (rawText || '').trim()
  if (!trimmed) return

  if (textHasSelfSpeaker(trimmed) || !needsSelfSpeakerSelection(trimmed)) {
    onTextLoaded(anonymizeChatText(trimmed).anonymizedText)
    return
  }

  onTextLoaded(trimmed)
}

/** 본인 카톡 이름 선택 후 익명화 */
export function applySelfSpeakerAndAnonymize(rawText, selfSpeakerName) {
  return anonymizeChatText(rawText, { selfSpeakerName }).anonymizedText
}
