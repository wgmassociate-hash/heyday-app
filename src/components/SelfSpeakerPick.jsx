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
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 relative z-10">
      <p className="text-xs font-semibold text-amber-900 mb-1">
        {isRealNames
          ? 'txt·PC 붙여넣기에는 본인 카톡 이름이 그대로 나옵니다.'
          : '본인 메시지가 「나」로 표시되지 않았어요.'}
      </p>
      <p className="text-xs text-amber-800 mb-2">아래에서 본인을 선택해 주세요.</p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => handlePick(label)}
            className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
          >
            {label} → 나
          </button>
        ))}
      </div>
    </div>
  )
}
