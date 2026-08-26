import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import titleMaskUrl from '../../圆角矩形.png'
import {
  bubbleShapeCommandsToSvgPath,
  getBubbleShapeDefinition,
  getBubbleShapeDirection,
  normalizeBubbleColor
} from '../../desktop-runtime/renderer/bubble-shape-catalog.js'
import './DynamicBubbleEditor.css'

export type DynamicBubbleType = 'dialogue' | 'thought' | 'title'
export type DynamicBubbleRevealMode = 'all' | 'typewriter'
export type DynamicBubbleStyleId =
  | 'dialogue-rounded-left'
  | 'dialogue-rounded-right'
  | 'dialogue-soft-left'
  | 'dialogue-soft-right'
  | 'dialogue-comic-left'
  | 'dialogue-comic-right'
  | 'thought-cloud-left'
  | 'thought-cloud-right'
  | 'title-rounded'
  | 'title-pill'
  | 'title-ticket'
  | 'title-underline'
  | 'title-none'

export type DynamicBubblePaletteId = 'ink' | 'ocean' | 'coral' | 'sun' | 'violet'
export type DynamicBubbleTitleMaskId = 'rounded' | 'pill' | 'ticket' | 'underline' | 'none'

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
  surfaceColor: string
  outlineColor: string
  titleMaskId?: DynamicBubbleTitleMaskId
  paletteId: DynamicBubblePaletteId
  maskColor: string
  maskOpacity: number
  widthPx: number
  heightPx: number
  image?: DynamicBubbleImageDraft
}

export interface DynamicBubbleVisualProps {
  bubble: DynamicBubbleDraft
  animate?: boolean
  playbackKey?: string | number
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

const BUBBLE_TITLE_ACCENTS: Record<DynamicBubblePaletteId, string> = {
  ink: '#263a3b',
  ocean: '#0c8fa4',
  coral: '#dd6859',
  sun: '#c88722',
  violet: '#7567b4'
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

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
  const isStandaloneTitle = bubble.bubbleType === 'title'
  const hasLegacyTitle = !isStandaloneTitle && bubble.title.trim().length > 0
  const hasText = bubble.bodyText.trim().length > 0
  const hasImage = bubble.bubbleType === 'thought' && Boolean(bubble.image?.url)
  const shapeDefinition = getBubbleShapeDefinition(bubble.styleId)
  const shapeDirection = getBubbleShapeDirection(bubble.styleId)
  const shapePath = useMemo(
    () => bubbleShapeCommandsToSvgPath(shapeDefinition.bodyCommands),
    [shapeDefinition]
  )
  const shapeViewBox = shapeDefinition.viewBox
  const shapeContentRect = shapeDefinition.contentRect
  const surfaceColor = normalizeBubbleColor(bubble.surfaceColor, shapeDefinition.defaultSurfaceColor)
  const outlineColor = normalizeBubbleColor(bubble.outlineColor, shapeDefinition.defaultOutlineColor)
  const styleBaseId = bubble.styleId.replace(/-(left|right)$/, '')
  const titleMaskId = bubble.titleMaskId ?? 'rounded'
  const maskColor = bubble.maskColor ?? BUBBLE_TITLE_ACCENTS[bubble.paletteId]
  const maskOpacity = clamp(bubble.maskOpacity ?? 0.92, 0, 1)
  const fontSizeRatio = (bubble.fontSizePx / bubble.widthPx) * 100
  const outlineWidthRatio = (shapeDefinition.defaultOutlineWidth / bubble.widthPx) * 100
  const safeContentWidthPx = shapeContentRect.width * (bubble.widthPx / shapeViewBox.width)
  const contentPaddingPx = clamp(
    Math.max(bubble.fontSizePx * 0.36, safeContentWidthPx * 0.025),
    12,
    64
  )
  const visualStyle = {
    '--dynamic-bubble-aspect': `${bubble.widthPx} / ${bubble.heightPx}`,
    '--dynamic-bubble-font-size': `${fontSizeRatio}cqw`,
    '--dynamic-bubble-title-mask': `url("${titleMaskUrl}")`,
    '--dynamic-bubble-title-accent': BUBBLE_TITLE_ACCENTS[bubble.paletteId],
    '--dynamic-bubble-mask-color': maskColor,
    '--dynamic-bubble-mask-opacity': maskOpacity,
    '--dynamic-bubble-safe-left': `${((shapeContentRect.x - shapeViewBox.x) / shapeViewBox.width) * 100}%`,
    '--dynamic-bubble-safe-top': `${((shapeContentRect.y - shapeViewBox.y) / shapeViewBox.height) * 100}%`,
    '--dynamic-bubble-safe-width': `${(shapeContentRect.width / shapeViewBox.width) * 100}%`,
    '--dynamic-bubble-safe-height': `${(shapeContentRect.height / shapeViewBox.height) * 100}%`,
    '--dynamic-bubble-surface-color': surfaceColor,
    '--dynamic-bubble-outline-color': outlineColor,
    '--dynamic-bubble-outline-width': `${outlineWidthRatio}cqw`,
    '--dynamic-bubble-content-padding': `${(contentPaddingPx / bubble.widthPx) * 100}cqw`,
    color: bubble.textColor
  } as CSSProperties

  return (
    <article
      className={`dynamic-bubble-visual is-${bubble.bubbleType} style-${styleBaseId} style-${bubble.styleId} direction-${shapeDirection} title-mask-${titleMaskId} palette-${bubble.paletteId} ${hasImage ? 'has-image' : ''} ${hasImage && hasText ? 'has-image-and-text' : ''} ${className}`.trim()}
      style={visualStyle}
      aria-label={ariaLabel ?? [bubble.title, bubble.bodyText, bubble.image?.name].filter(Boolean).join('，')}
    >
      {isStandaloneTitle ? (
        <div className="dynamic-bubble-standalone-title" aria-hidden="true">
          {bubble.styleId !== 'title-none' && (
            <span className="dynamic-bubble-standalone-mask" />
          )}
          {hasText && (
            <p className="dynamic-bubble-standalone-text">
              {visibleBodyText}
              {shouldAnimate && visibleCharacterCount < bodyGraphemes.length && (
                <span className="dynamic-bubble-caret" aria-hidden="true" />
              )}
            </p>
          )}
        </div>
      ) : (
        <>
          <svg
            className="dynamic-bubble-shape"
            viewBox={`${shapeViewBox.x} ${shapeViewBox.y} ${shapeViewBox.width} ${shapeViewBox.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <g>
              <path className="dynamic-bubble-shape-body" d={shapePath} />
              {shapeDefinition.decorations.map((decoration, index) => (
                <circle
                  key={`${decoration.cx}-${decoration.cy}-${index}`}
                  className="dynamic-bubble-shape-decoration"
                  cx={decoration.cx}
                  cy={decoration.cy}
                  r={decoration.radius}
                />
              ))}
            </g>
          </svg>
          <div className="dynamic-bubble-surface" aria-hidden="true">
            {hasLegacyTitle && (
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
        </>
      )}
    </article>
  )
}

export default DynamicBubbleVisual
