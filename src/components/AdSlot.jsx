import { useEffect, useRef } from 'react'
import { getAdSenseConfig, isAdSenseConfigured } from '../utils/adsense.js'

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
}

export default function AdSlot({ variant = 'banner', className = '' }) {
  const config = VARIANTS[variant] ?? VARIANTS.banner
  const { client, slots } = getAdSenseConfig()
  const slotId = slots[variant] || slots.banner
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
            <p className="text-sm text-gray-300 mt-1">{config.label} 광고 영역</p>
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
