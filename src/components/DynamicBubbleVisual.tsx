import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import titleMaskUrl from '../../圆角矩形.png'
import './DynamicBubbleEditor.css'

export type DynamicBubbleType = 'dialogue' | 'thought'
export type DynamicBubbleRevealMode = 'all' | 'typewriter'
export type DynamicBubbleStyleId =
  | 'dialogue-rounded'
  | 'dialogue-soft'
  | 'dialogue-comic'
  | 'thought-cloud'
  | 'thought-soft'

export type DynamicBubblePaletteId = 'ink' | 'ocean' | 'coral' | 'sun' | 'violet'

export interface DynamicBubbleImageDraft {
  url: string
  name: string
  mimeType?: string
  width?: number
  height?: number
  file?: File
}

export interface DynamicBubbleDraft {
  bubbleType: DynamicBubbleType
  styleId: DynamicBubbleStyleId
  title: string
  bodyText: string
  revealMode: DynamicBubbleRevealMode
  revealIntervalMs: number
  fontSizePx: number
  textColor: string
  surfaceId?: string
  paletteId: DynamicBubblePaletteId
  widthPx: number
  heightPx: number
  image?: DynamicBubbleImageDraft
}

export interface DynamicBubbleVisualProps {
  bubble: DynamicBubbleDraft
  animate?: boolean
  playbackKey?: number
  revealDelayMs?: number
  className?: string
  ariaLabel?: string
}

interface SegmenterLike {
  segment: (value: string) => Iterable<{ segment: string }>
}

type SegmenterConstructor = new (
  locale?: string | string[],
  options?: { granularity: 'grapheme' }
) => SegmenterLike

const splitGraphemes = (value: string) => {
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter
  if (!Segmenter) return Array.from(value)
  return Array.from(new Segmenter('zh-Hans', { granularity: 'grapheme' }).segment(value), ({ segment }) => segment)
}

const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(mediaQuery.matches)
    updatePreference()
    mediaQuery.addEventListener?.('change', updatePreference)
    return () => mediaQuery.removeEventListener?.('change', updatePreference)
  }, [])

  return reducedMotion
}

const DynamicBubbleVisual: React.FC<DynamicBubbleVisualProps> = ({
  bubble,
  animate = false,
  playbackKey = 0,
  revealDelayMs = 0,
  className = '',
  ariaLabel
}) => {
  const reducedMotion = useReducedMotion()
  const revealDelayMsRef = useRef(revealDelayMs)
  revealDelayMsRef.current = revealDelayMs
  const bodyGraphemes = useMemo(() => splitGraphemes(bubble.bodyText), [bubble.bodyText])
  const shouldAnimate = animate && bubble.revealMode === 'typewriter' && !reducedMotion
  const [visibleCharacterCount, setVisibleCharacterCount] = useState(() => (
    shouldAnimate ? 0 : bodyGraphemes.length
  ))

  useEffect(() => {
    if (!shouldAnimate) {
      setVisibleCharacterCount(bodyGraphemes.length)
      return
    }

    setVisibleCharacterCount(0)
    if (bodyGraphemes.length === 0) return

    let nextCharacter = 0
    let timer = 0
    const revealNextCharacter = () => {
      nextCharacter += 1
      setVisibleCharacterCount(nextCharacter)
      if (nextCharacter < bodyGraphemes.length) {
        timer = window.setTimeout(revealNextCharacter, bubble.revealIntervalMs)
      }
    }

    timer = window.setTimeout(
      revealNextCharacter,
      Math.max(0, revealDelayMsRef.current) + Math.min(180, bubble.revealIntervalMs)
    )
    return () => window.clearTimeout(timer)
  }, [bodyGraphemes, bubble.revealIntervalMs, playbackKey, shouldAnimate])

  const visibleBodyText = bodyGraphemes.slice(0, visibleCharacterCount).join('')
  const hasTitle = bubble.title.trim().length > 0
  const hasText = bubble.bodyText.trim().length > 0
  const hasImage = bubble.bubbleType === 'thought' && Boolean(bubble.image?.url)
  const fontSizeRatio = Math.max(3.2, (bubble.fontSizePx / bubble.widthPx) * 100)
  const visualStyle = {
    '--dynamic-bubble-aspect': `${bubble.widthPx} / ${bubble.heightPx}`,
    '--dynamic-bubble-font-size': `${fontSizeRatio}cqw`,
    '--dynamic-bubble-title-mask': `url("${titleMaskUrl}")`,
    color: bubble.textColor
  } as CSSProperties

  return (
    <article
      className={`dynamic-bubble-visual is-${bubble.bubbleType} style-${bubble.styleId} palette-${bubble.paletteId} ${hasImage ? 'has-image' : ''} ${hasImage && hasText ? 'has-image-and-text' : ''} ${className}`.trim()}
      style={visualStyle}
      aria-label={ariaLabel ?? [bubble.title, bubble.bodyText, bubble.image?.name].filter(Boolean).join('，')}
    >
      <span className="dynamic-bubble-tail" aria-hidden="true" />
      <div className="dynamic-bubble-surface" aria-hidden="true">
        {hasTitle && (
          <div className="dynamic-bubble-title-row">
            <span className="dynamic-bubble-title-mask" aria-hidden="true" />
            <strong>{bubble.title}</strong>
          </div>
        )}

        <div className="dynamic-bubble-content">
          {hasImage && (
            <div className="dynamic-bubble-image-frame">
              <img src={bubble.image?.url} alt={bubble.image?.name ?? ''} />
            </div>
          )}

          {hasText && (
            <p className="dynamic-bubble-body">
              {visibleBodyText}
              {shouldAnimate && visibleCharacterCount < bodyGraphemes.length && (
                <span className="dynamic-bubble-caret" aria-hidden="true" />
              )}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

export default DynamicBubbleVisual
