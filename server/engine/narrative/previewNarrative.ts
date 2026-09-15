// Phase 2 — Preview Narrative (docs/implementation_plan_v2.md §15.4).
// Code templates only — no LLM call. `windowLabel` is threaded through every
// branch so it's structurally impossible to produce a firstVerdict/
// summaryOneLine string that omits it (§15.4's "하드코딩된 필수 요소").
import type { ValidatedSignal } from '../signals/types.js'
import type { PreviewNarrative, PreviewScoreResult } from '../pipeline/types.js'
import { bucketize, type ScoreBucket } from './scoreBuckets.js'

function evidenceClause(topSignal: ValidatedSignal | null): string {
  if (!topSignal) return ''
  const trimmed = topSignal.reason.trim()
  if (!trimmed) return ''
  return ` 예를 들어 "${trimmed}" 같은 모습이 눈에 띄었어요.`
}

interface Template {
  firstVerdict: (windowLabel: string, topSignal: ValidatedSignal | null) => string
  summaryOneLine: (topSignal: ValidatedSignal | null) => string
}

const INSUFFICIENT_TEMPLATE: Template = {
  firstVerdict: (windowLabel) =>
    `${windowLabel} 데이터만으로는 아직 확실히 판단하기 어려워요. 대화가 조금 더 쌓이면 훨씬 정확해져요.`,
  summaryOneLine: () => '판단할 근거가 아직 충분하지 않아요',
}

/** [temperatureBucket][romanceBucket]. Every cell embeds its windowLabel
 * parameter — this is what makes §15.4's "미리보기가 전체 관계를 보고 하는
 * 말로 오인되지 않도록" requirement structurally true rather than a copy
 * convention someone could forget. */
const FIRST_VERDICT_TEMPLATES: Record<ScoreBucket, Record<ScoreBucket, Template>> = {
  low: {
    low: {
      firstVerdict: (w, t) => `${w} 동안은 전반적으로 잔잔한 분위기였어요. 눈에 띄게 뜨거운 흐름은 아니었어요.${evidenceClause(t)}`,
      summaryOneLine: () => '조용한 흐름이었어요',
    },
    medium: {
      firstVerdict: (w, t) => `${w} 동안 대화 자체는 담담했지만, 애매한 신호가 조금씩 섞여 있었어요.${evidenceClause(t)}`,
      summaryOneLine: () => '잔잔한 가운데 미묘한 신호가 있었어요',
    },
    high: {
      firstVerdict: (w, t) => `${w} 동안 대화 텐션은 낮았는데도 연애 신호는 꽤 뚜렷하게 보였어요. 흥미로운 조합이에요.${evidenceClause(t)}`,
      summaryOneLine: () => '조용하지만 신호는 꽤 있었어요',
    },
  },
  medium: {
    low: {
      firstVerdict: (w, t) => `${w} 동안 자연스럽게 대화를 이어가는 사이였어요. 다만 연애 신호보다는 편안한 분위기에 가까워요.${evidenceClause(t)}`,
      summaryOneLine: () => '편안하지만 아직 설렘 쪽은 약해요',
    },
    medium: {
      firstVerdict: (w, t) => `음... 관심 없는 사람의 카톡은 아닌데? ${w} 기준으로 보면 서로 신경 쓰는 티가 나요.${evidenceClause(t)}`,
      summaryOneLine: () => '나쁘지 않은 흐름이에요',
    },
    high: {
      firstVerdict: (w, t) => `${w} 동안 오간 대화만 보면 꽤 설레는 신호가 많았어요. 분위기가 무르익고 있는 것 같아요.${evidenceClause(t)}`,
      summaryOneLine: () => '설렘 신호가 눈에 띄게 많았어요',
    },
  },
  high: {
    low: {
      firstVerdict: (w, t) => `${w} 동안 서로 정말 자주, 깊게 대화를 나눴어요. 연애보다는 편한 친밀함에 가까운 분위기예요.${evidenceClause(t)}`,
      summaryOneLine: () => '친밀하지만 연애 신호는 약해요',
    },
    medium: {
      firstVerdict: (w, t) => `${w} 동안 대화가 활발하고 친밀했어요. 그 안에 설렘 신호도 함께 섞여 있고요.${evidenceClause(t)}`,
      summaryOneLine: () => '친밀함과 설렘이 함께 보여요',
    },
    high: {
      firstVerdict: (w, t) => `${w} 동안 관심 없는 사람의 카톡은 절대 아니에요. 대화도 활발하고, 설렘 신호도 뚜렷했어요.${evidenceClause(t)}`,
      summaryOneLine: () => '뜨겁고 적극적인 흐름이었어요',
    },
  },
}

export function buildPreviewNarrative(score: PreviewScoreResult, topSignal: ValidatedSignal | null): PreviewNarrative {
  const temperatureScore = score.recentConversationTemperature.score

  if (temperatureScore === null) {
    return {
      firstVerdict: INSUFFICIENT_TEMPLATE.firstVerdict(score.windowLabel, topSignal),
      summaryOneLine: `${score.windowLabel} 기준 — ${INSUFFICIENT_TEMPLATE.summaryOneLine(topSignal)}`,
    }
  }

  const temperatureBucket = bucketize(temperatureScore)
  const romanceBucket = bucketize(score.recentRomanceSignal.score)
  const template = FIRST_VERDICT_TEMPLATES[temperatureBucket][romanceBucket]

  return {
    firstVerdict: template.firstVerdict(score.windowLabel, topSignal),
    summaryOneLine: `${score.windowLabel} 기준 — ${template.summaryOneLine(topSignal)}`,
  }
}
