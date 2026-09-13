/**
 * Phase 0 addition (docs/implementation_plan_v2.md §6.3). Deliberately kept
 * separate from src/utils/speakerLabels.js — that file is a verified 1.0
 * asset and is not modified as part of 2.0 work.
 *
 * Pattern-based only, not full entity recognition: catches the common
 * "010-1234-5678" / "user@example.com" shapes, not every possible format.
 * This limitation is disclosed to the user in PrivacyBadge.jsx.
 */

const PHONE_RE = /(?:\+?82[-\s]?)?0?1[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

/**
 * @param {string} text
 */
export function redactContactInfo(text) {
  if (typeof text !== 'string' || !text) return text
  return text.replace(EMAIL_RE, '[이메일]').replace(PHONE_RE, '[전화번호]')
}
