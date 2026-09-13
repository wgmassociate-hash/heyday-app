import { INTENT_OPTIONS } from '../../shared/intentOptions.js'

/** Phase 2 — Intent selection (docs/prd_v2.md §4). Picked once, before the
 * chat is uploaded, and only ever changes which Evidence gets surfaced first
 * in the Free Preview (server/engine/pipeline/topSignal.ts) — it never
 * changes Core4/Temperature/Romance numbers. */
export default function IntentStep({ onSelect }) {
  return (
    <div className="animate-fade-in">
      <section className="text-center mb-6">
        <p className="text-4xl mb-3" aria-hidden="true">🤔</p>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight mb-2">
          지금 뭐가 <span className="text-brand-500">제일 궁금해</span>?
        </h1>
        <p className="text-gray-500 text-sm">고른 걸 기준으로 리포트를 먼저 보여줄게</p>
      </section>

      <div className="max-w-xl mx-auto grid gap-3">
        {INTENT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className="w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 text-left transition-all duration-150 hover:border-brand-200 hover:shadow-md active:scale-[0.98]"
          >
            <span className="text-2xl shrink-0" aria-hidden="true">{option.emoji}</span>
            <span className="font-bold text-gray-800">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
