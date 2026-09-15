import { anonymizeChatText } from './parseChat.js'
import { scrubResultNames } from './scrubResult.js'
import { redactContactInfo } from './privacyRedaction.js'
import { getAnonymizationChanges } from './speakerLabels.js'

/**
 * Phase 2.1 — Privacy Review (Product UX Calibration items 6/7/8).
 *
 * Runs the exact same anonymization/redaction steps previewApi.js's
 * analyzePreview() used to run silently right before the network call
 * (anonymizeChatText -> body-wide name scrub -> phone/email redaction), but
 * as a standalone step the UI can show the user *before* anything is sent —
 * "AI에는 이렇게 전달됩니다" needs to describe the text that will actually be
 * sent, not a re-derived approximation of it.
 *
 * @param {string} rawText
 * @returns {{
 *   anonymizedText: string,
 *   nameMap: Record<string, string>,
 *   nameChanges: [string, string][],
 *   phoneRedacted: boolean,
 *   emailRedacted: boolean,
 * }}
 */
export function buildPrivacyPreview(rawText) {
  const { anonymizedText, nameMap } = anonymizeChatText(rawText)
  const bodyScrubbed = scrubResultNames(anonymizedText, nameMap)
  const fullyRedacted = redactContactInfo(bodyScrubbed)

  return {
    anonymizedText: fullyRedacted,
    nameMap,
    nameChanges: getAnonymizationChanges(nameMap),
    phoneRedacted: /\[전화번호\]/.test(fullyRedacted),
    emailRedacted: /\[이메일\]/.test(fullyRedacted),
  }
}
