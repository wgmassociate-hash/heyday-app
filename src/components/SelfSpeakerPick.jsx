import { applySelfSpeakerAndAnonymize } from '../utils/deliverChatText.js'
import { extractSpeakerNames } from '../utils/parseChat.js'
import {
  assignSelfSpeaker,
  getSelfPickCandidates,
  isAlreadyAnonymized,
  isAnonymizedOtherLabel,
  isOtherPseudoSpeaker,
  isSelfSpeaker,
  textHasSelfSpeaker,
} from '../utils/speakerLabels.js'

export default function SelfSpeakerPick({ chatText, onAssign }) {
  if (textHasSelfSpeaker(chatText)) return null

  const parsed = extractSpeakerNames(chatText)
  const realNames = parsed.filter(
    (s) =>
      s !== '나' &&
      !isSelfSpeaker(s) &&
      !isAnonymizedOtherLabel(s) &&
      !isOtherPseudoSpeaker(s),
  )
  const isRealNames = realNames.length >= 2 && !isAlreadyAnonymized(chatText)
  const anonCandidates = getSelfPickCandidates(chatText)
  const candidates = isRealNames ? realNames : anonCandidates

  if (candidates.length === 0) return null

  const handlePick = (name) => {
    if (isRealNames) {
      onAssign(applySelfSpeakerAndAnonymize(chatText, name))
    } else {
      onAssign(assignSelfSpeaker(chatText, name))
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-bold text-amber-900 mb-2">👆 이 중에 너는?</p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => handlePick(label)}
            className="px-4 py-2 rounded-xl bg-white border-2 border-amber-300 text-sm font-bold text-amber-800 hover:bg-amber-100 active:scale-95 transition-transform"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
