import { useEffect, useRef } from 'react'
import { getAdSenseConfig, getSlotId, isAdSenseConfigured } from '../utils/adsense.js'

const VARIANTS = {
  banner: {
    wrapper: 'w-full max-w-4xl mx-auto',
    slot: 'w-full min-h-[90px] md:min-h-[100px]',
    label: '가로형 배너',
    minHeight: 90,
  },
  rectangle: {
    wrapper: 'w-full max-w-md mx-auto',
    slot: 'w-full min-h-[250px]',
    label: '사각형',
    minHeight: 250,
  },
  leaderboard: {
    wrapper: 'w-full max-w-3xl mx-auto',
    slot: 'w-full min-h-[250px]',
    label: '리더보드',
    minHeight: 250,
  },
  loading: {
    wrapper: 'w-full max-w-md mx-auto',
    slot: 'w-full min-h-[250px]',
    label: '로딩 화면',
    debugLabel: 'Loading Ad',
    minHeight: 250,
  },
  // Ad placement restructure — Result 전용 3개 슬롯. PreviewResultStep.jsx는
  // 자체 컨테이너가 max-w-xl이므로 그 폭에 맞춘다.
  resultTop: {
    wrapper: 'w-full max-w-xl mx-auto',
    slot: 'w-full min-h-[90px] md:min-h-[100px]',
    label: 'Result Top',
    debugLabel: 'Result Top Ad',
    minHeight: 90,
  },
  resultMiddle: {
    wrapper: 'w-full max-w-xl mx-auto',
    slot: 'w-full min-h-[90px] md:min-h-[100px]',
    label: 'Result Middle',
    debugLabel: 'Result Middle Ad',
    minHeight: 90,
  },
  resultBottom: {
    wrapper: 'w-full max-w-xl mx-auto',
    slot: 'w-full min-h-[90px] md:min-h-[100px]',
    label: 'Result Bottom',
    debugLabel: 'Result Bottom Ad',
    minHeight: 90,
  },
}

export default function AdSlot({ variant = 'banner', className = '' }) {
  const config = VARIANTS[variant] ?? VARIANTS.banner
  const { client, slots } = getAdSenseConfig()
  const slotId = getSlotId(variant, slots)
  const active = isAdSenseConfigured(variant)
  const pushed = useRef(false)

  useEffect(() => {
    if (!active || pushed.current) return
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
      pushed.current = true
    } catch (err) {
      console.warn('[AdSlot]', err)
    }
  }, [active, slotId])

  if (!active) {
    return (
      <div className={`${config.wrapper} ${className}`} data-export-exclude>
        <div
          className={`${config.slot} rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 flex items-center justify-center overflow-hidden`}
        >
          <div className="text-center px-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Advertisement</p>
            <p className="text-sm text-gray-300 mt-1">{config.debugLabel ?? `${config.label} 광고 영역`}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${config.wrapper} ${className}`} data-export-exclude>
      <ins
        className={`adsbygoogle block ${config.slot}`}
        style={{ display: 'block', minHeight: config.minHeight }}
        data-ad-client={client}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
