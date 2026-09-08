import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Play, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  buildDynamicAppearanceTimeline,
  getDynamicBackgroundAppearanceForGroup,
  getDynamicPlaybackItemsForBackground,
  sampleDynamicAppearanceTimeline,
  type DynamicAppearanceSchedule
} from '../../desktop-runtime/renderer/advanced-appearance-timeline.js'
import { sampleMotionPath } from '../../desktop-runtime/renderer/dynamic-motion-path-core.js'
import {
  getTargetMotionDurationMs,
  sampleTargetMotionProgress,
  sampleTargetMotionState
} from '../../desktop-runtime/renderer/target-motion-core.js'
import {
  isDynamicBubbleItem,
  isDynamicMediaItem,
  type DynamicGroup,
  type DynamicItem
} from '../services/dynamicArtStorage.ts'
import DynamicBubbleVisual from './DynamicBubbleVisual.tsx'
import { toDynamicBubbleDraft } from './DynamicItemThumbnail.tsx'
import { RIGHT_LOGO_URL } from './BrandLogo.tsx'
import './PublicCasePreviewPage.css'

interface PublicCasePreviewPageProps {
  group: DynamicGroup
  onBack: () => void
}

interface MediaSize {
  width: number
  height: number
}

const RUNTIME_STAGE_WIDTH = 1920
const RUNTIME_STAGE_HEIGHT = 1080
const RUNTIME_ITEM_MAX_SIZE = 380
const RUNTIME_ITEM_MIN_SIZE = 120
const DEFAULT_ITEM_WIDTH = 360
const DEFAULT_ITEM_HEIGHT = 260

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const getItemTrack = (item: DynamicItem) => {
  if (item.moveTrack === 'top' || item.moveTrack === 'middle' || item.moveTrack === 'bottom') {
    return item.moveTrack
  }
  if (item.position.y < 0.34) return 'top'
  if (item.position.y > 0.66) return 'bottom'
  return 'middle'
}

const getTargetPosition = (
  item: DynamicItem,
  elapsedMs: number,
  schedule: DynamicAppearanceSchedule | undefined
) => {
  const target = item.targetMode === 'target' ? item.targetPosition : undefined
  if (!target || !schedule || elapsedMs < schedule.activeStartMs) return item.position

  const moveDurationMs = getTargetMotionDurationMs(item.moveSpeed, 3.8)
  const targetElapsedMs = Math.max(0, elapsedMs - schedule.activeStartMs)
  const progress = sampleTargetMotionProgress(targetElapsedMs, moveDurationMs, item.targetLoop === true)
  if (item.motionPath) {
    const offset = sampleMotionPath(item.motionPath, progress)
    return {
      x: item.position.x + offset.x,
      y: item.position.y + offset.y
    }
  }
  return {
    x: item.position.x + (target.x - item.position.x) * progress,
    y: item.position.y + (target.y - item.position.y) * progress
  }
}

const isItemHiddenAfterTarget = (
  item: DynamicItem,
  elapsedMs: number,
  schedule: DynamicAppearanceSchedule | undefined
) => {
  if (
    !schedule
    || item.targetMode !== 'target'
    || item.targetLoop === true
    || item.hideAfterTarget !== true
    || (!item.targetPosition && !item.motionPath)
  ) return false
  const moveDurationMs = getTargetMotionDurationMs(item.moveSpeed, 3.8)
  return sampleTargetMotionState(
    Math.max(0, elapsedMs - schedule.activeStartMs),
    moveDurationMs,
    { hideAfterTarget: true, settleMs: 80 }
  ).hidden
}

const getEntranceTransform = (
  item: DynamicItem,
  schedule: DynamicAppearanceSchedule | undefined,
  elapsedMs: number,
  stageSize: MediaSize,
  itemSize: MediaSize,
  appearAnimation: 'none' | 'drop' | 'trackSlide'
) => {
  if (!schedule || schedule.entranceDurationMs <= 0) return 'none'
  const progress = clamp(
    (elapsedMs - schedule.entranceStartMs) / schedule.entranceDurationMs,
    0,
    1
  )
  const eased = progress * progress * (3 - 2 * progress)
  if (appearAnimation === 'drop') {
    const offsetY = -(item.position.y * stageSize.height + itemSize.height * Math.abs(item.scale || 1) / 2 + 36)
    return `translate3d(0, ${Math.round(offsetY * (1 - eased))}px, 0)`
  }
  if (appearAnimation === 'trackSlide') {
    const fromRight = getItemTrack(item) === 'middle'
    const offsetX = fromRight
      ? (1 - item.position.x) * stageSize.width + itemSize.width * Math.abs(item.scale || 1) / 2 + 36
      : -(item.position.x * stageSize.width + itemSize.width * Math.abs(item.scale || 1) / 2 + 36)
    return `translate3d(${Math.round(offsetX * (1 - eased))}px, 0, 0)`
  }
  return `scale(${(0.96 + 0.04 * eased).toFixed(4)})`
}

const getGroupBackgrounds = (group: DynamicGroup) => (
  group.backgrounds?.length
    ? group.backgrounds
    : group.background
      ? [group.background]
      : []
)

const getPositiveDimension = (value?: number) => (
  Number.isFinite(value) && value && value > 0 ? value : undefined
)

const getItemPreviewSize = (
  item: DynamicItem,
  cachedSize: MediaSize | undefined,
  stageSize: MediaSize
) => {
  const stageRatio = Math.min(
    (stageSize.width || 960) / RUNTIME_STAGE_WIDTH,
    (stageSize.height || 540) / RUNTIME_STAGE_HEIGHT
  )
  if (isDynamicBubbleItem(item)) {
    return {
      width: Math.max(1, item.bubble.widthPx * stageRatio),
      height: Math.max(1, item.bubble.heightPx * stageRatio)
    }
  }

  const width = getPositiveDimension(cachedSize?.width)
    ?? getPositiveDimension(item.media.width)
    ?? DEFAULT_ITEM_WIDTH
  const height = getPositiveDimension(cachedSize?.height)
    ?? getPositiveDimension(item.media.height)
    ?? DEFAULT_ITEM_HEIGHT
  const naturalMax = Math.max(width, height)
  const runtimeRatio = naturalMax < RUNTIME_ITEM_MIN_SIZE
    ? RUNTIME_ITEM_MIN_SIZE / naturalMax
    : Math.min(RUNTIME_ITEM_MAX_SIZE / naturalMax, 1)
  return {
    width: Math.max(1, width * runtimeRatio * stageRatio),
    height: Math.max(1, height * runtimeRatio * stageRatio)
  }
}

const PublicCasePreviewPage: React.FC<PublicCasePreviewPageProps> = ({ group, onBack }) => {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement>(null)
  const backgrounds = useMemo(() => {
    const allBackgrounds = getGroupBackgrounds(group)
    return group.backgroundPlayMode === 'fixed' ? allBackgrounds.slice(0, 1) : allBackgrounds
  }, [group])
  const initialBackgroundIndex = Math.max(0, backgrounds.findIndex((background) => (
    background.id === group.activeBackgroundId || background.id === group.background?.id
  )))
  const [backgroundIndex, setBackgroundIndex] = useState(initialBackgroundIndex)
  const [stageSize, setStageSize] = useState<MediaSize>({ width: 960, height: 540 })
  const [mediaSizes, setMediaSizes] = useState<Record<string, MediaSize>>({})
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackEpoch, setPlaybackEpoch] = useState(0)
  const [playbackElapsedMs, setPlaybackElapsedMs] = useState(0)
  const playbackFrameRef = useRef<number | null>(null)
  const playbackStartedAtRef = useRef(0)
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  useEffect(() => {
    setIsPlaying(false)
    setPlaybackElapsedMs(0)
    setBackgroundIndex(initialBackgroundIndex)
  }, [group.id, initialBackgroundIndex])

  useEffect(() => {
    if (!isPlaying) {
      if (playbackFrameRef.current !== null) {
        window.cancelAnimationFrame(playbackFrameRef.current)
        playbackFrameRef.current = null
      }
      return undefined
    }

    playbackStartedAtRef.current = performance.now()
    const updatePlayback = (now: number) => {
      setPlaybackElapsedMs(Math.max(0, now - playbackStartedAtRef.current))
      playbackFrameRef.current = window.requestAnimationFrame(updatePlayback)
    }
    playbackFrameRef.current = window.requestAnimationFrame(updatePlayback)
    return () => {
      if (playbackFrameRef.current !== null) {
        window.cancelAnimationFrame(playbackFrameRef.current)
        playbackFrameRef.current = null
      }
    }
  }, [isPlaying, playbackEpoch])

  useEffect(() => {
    Array.from(videoRefs.current.entries()).forEach(([key, video]) => {
      if (!video.isConnected) videoRefs.current.delete(key)
    })
    videoRefs.current.forEach((video) => {
      if (isPlaying) {
        video.currentTime = 0
        void video.play().catch(() => undefined)
      } else {
        video.pause()
        video.currentTime = 0
      }
    })
  }, [isPlaying, playbackEpoch, backgroundIndex])

  useEffect(() => () => {
    if (playbackFrameRef.current !== null) window.cancelAnimationFrame(playbackFrameRef.current)
    videoRefs.current.forEach((video) => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    })
    videoRefs.current.clear()
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const updateSize = () => {
      const rect = stage.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ width: rect.width, height: rect.height })
      }
    }
    updateSize()
    const observer = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(updateSize)
    observer?.observe(stage)
    window.addEventListener('resize', updateSize)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  const activeBackground = backgrounds[backgroundIndex] ?? backgrounds[0]
  const sortedItems = useMemo(
    () => [...group.items].sort((first, second) => first.order - second.order),
    [group.items]
  )
  const visibleItems = useMemo(() => (
    activeBackground
      ? getDynamicPlaybackItemsForBackground(sortedItems, activeBackground.id)
      : sortedItems
  ).filter((item) => item.isVisible !== false), [activeBackground, sortedItems])

  const appearanceConfig = useMemo(
    () => getDynamicBackgroundAppearanceForGroup(group, activeBackground),
    [activeBackground, group]
  )

  const appearanceTimeline = useMemo(() => buildDynamicAppearanceTimeline({
    items: visibleItems,
    appearMode: appearanceConfig.appearMode,
    intervalMs: appearanceConfig.appearIntervalMs,
    appearAnimation: appearanceConfig.appearAnimation,
    backgroundId: activeBackground?.id ?? ''
  }), [activeBackground?.id, appearanceConfig, visibleItems])

  const itemHiddenAtTarget = (item: DynamicItem, schedule: DynamicAppearanceSchedule | undefined) => (
    isPlaying && isItemHiddenAfterTarget(item, playbackElapsedMs, schedule)
  )

  const setVideoRef = (key: string, video: HTMLVideoElement | null) => {
    if (video) videoRefs.current.set(key, video)
    else videoRefs.current.delete(key)
  }

  const stopPlayback = () => {
    setIsPlaying(false)
    setPlaybackElapsedMs(0)
  }

  const startPlayback = () => {
    setPlaybackElapsedMs(0)
    setPlaybackEpoch((current) => current + 1)
    setIsPlaying(true)
  }

  const togglePlayback = () => {
    if (isPlaying) stopPlayback()
    else startPlayback()
  }

  const selectRelativeBackground = (offset: number) => {
    if (backgrounds.length < 2) return
    stopPlayback()
    setBackgroundIndex((current) => (
      (current + offset + backgrounds.length) % backgrounds.length
    ))
  }

  const selectBackground = (index: number) => {
    stopPlayback()
    setBackgroundIndex(index)
  }

  const rememberMediaSize = (mediaId: string, width: number, height: number) => {
    if (width <= 0 || height <= 0) return
    setMediaSizes((current) => {
      const existing = current[mediaId]
      if (existing?.width === width && existing.height === height) return current
      return { ...current, [mediaId]: { width, height } }
    })
  }

  return (
    <main className="ipad-screen dynamic-screen public-case-preview-page apple-container">
      <header className="ipad-topbar public-case-preview-topbar">
        <div className="topbar-title-row">
          <button type="button" className="ipad-button ghost-button" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            <span>{t('common.back')}</span>
          </button>
          <div className="min-w-0">
            <p className="eyebrow">{t('groups.publicCaseType')}</p>
            <h1 className="screen-title">{group.name}</h1>
          </div>
        </div>
        <div className="public-case-preview-summary" aria-label={t('groups.publicCaseBadge')}>
          <div className="public-case-preview-summary-actions">
            <button
              type="button"
              className={`public-case-preview-play-button ${isPlaying ? 'is-playing' : ''}`}
              onClick={togglePlayback}
              disabled={!activeBackground || visibleItems.length === 0}
              aria-pressed={isPlaying}
              aria-label={t(isPlaying ? 'control.stopPreview' : 'groups.previewPublicCase')}
              title={t(isPlaying ? 'control.stopPreview' : 'groups.previewPublicCase')}
            >
              {isPlaying
                ? <Square aria-hidden="true" fill="currentColor" />
                : (
                  <>
                    <img src={RIGHT_LOGO_URL} alt="" draggable={false} />
                    <Play aria-hidden="true" fill="currentColor" />
                  </>
                )}
              <span>{t(isPlaying ? 'control.stopPreview' : 'groups.previewPublicCaseButton')}</span>
            </button>
            <span className="public-case-preview-official-badge">{t('groups.publicCaseBadge')}</span>
          </div>
          <small>{t('groups.materialSummary', {
            backgrounds: backgrounds.length,
            objects: group.items.length
          })}</small>
        </div>
      </header>

      <section className="public-case-preview-workspace">
        <div className="public-case-preview-stage-shell">
          <div
            ref={stageRef}
            className="public-case-preview-stage"
            role="img"
            aria-label={t('groups.preview', { name: group.name })}
          >
            {activeBackground ? (
              activeBackground.type === 'video' ? (
                <video
                  key={activeBackground.id}
                  src={activeBackground.url}
                  ref={(video) => setVideoRef(`background:${activeBackground.id}`, video)}
                  autoPlay={isPlaying}
                  loop
                  muted
                  playsInline
                  preload="auto"
                  className={`public-case-preview-background ${isPlaying ? 'is-playing' : ''}`}
                />
              ) : (
                <img
                  key={`${activeBackground.id}:${playbackEpoch}`}
                  src={activeBackground.url}
                  alt={activeBackground.name}
                  className={`public-case-preview-background ${isPlaying ? 'is-playing' : ''}`}
                />
              )
            ) : (
              <div className="public-case-preview-empty-stage"><strong>16:9</strong></div>
            )}

            {visibleItems.map((item) => {
              const cachedSize = isDynamicMediaItem(item) ? mediaSizes[item.media.id] : undefined
              const previewSize = getItemPreviewSize(item, cachedSize, stageSize)
              const schedule = appearanceTimeline[item.id]
              const timelineState = isPlaying
                ? sampleDynamicAppearanceTimeline(schedule, playbackElapsedMs)
                : { alpha: 1, animationElapsedMs: 0 }
              const hiddenAfterTarget = itemHiddenAtTarget(item, schedule)
              const itemPosition = isPlaying
                ? getTargetPosition(item, playbackElapsedMs, schedule)
                : item.position
              const entranceTransform = isPlaying
                ? getEntranceTransform(
                  item,
                  schedule,
                  playbackElapsedMs,
                  stageSize,
                  previewSize,
                  appearanceConfig.appearAnimation
                )
                : 'none'
              const style = {
                left: `${itemPosition.x * 100}%`,
                top: `${itemPosition.y * 100}%`,
                width: `${previewSize.width}px`,
                height: `${previewSize.height}px`,
                opacity: hiddenAfterTarget ? 0 : timelineState.alpha,
                zIndex: 10 + item.order,
                '--public-case-item-transform': `rotate(${item.rotation}deg) scale(${item.flipX ? -item.scale : item.scale}, ${item.flipY ? -item.scale : item.scale})`
              } as CSSProperties
              return (
                <div key={`${item.id}:${playbackEpoch}`} className="public-case-preview-item" style={style}>
                  <div
                    className="public-case-preview-item-appearance"
                    style={{ transform: entranceTransform }}
                  >
                  <div className="public-case-preview-item-transform">
                    {isDynamicBubbleItem(item) ? (
                      <DynamicBubbleVisual
                        bubble={toDynamicBubbleDraft(item.bubble)}
                        className="public-case-preview-bubble"
                        ariaLabel={item.name}
                      />
                    ) : item.media.type === 'video' ? (
                      <video
                        src={item.media.url}
                        ref={(video) => setVideoRef(`item:${item.id}`, video)}
                        autoPlay={isPlaying}
                        loop
                        muted
                        playsInline
                        preload="metadata"
                        aria-label={item.name}
                        onLoadedMetadata={(event) => rememberMediaSize(
                          item.media.id,
                          event.currentTarget.videoWidth,
                          event.currentTarget.videoHeight
                        )}
                      />
                    ) : (
                      <img
                        src={item.media.url}
                        alt={item.name}
                        draggable={false}
                        decoding="async"
                        onLoad={(event) => rememberMediaSize(
                          item.media.id,
                          event.currentTarget.naturalWidth,
                          event.currentTarget.naturalHeight
                        )}
                      />
                    )}
                  </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {backgrounds.length > 0 && (
          <aside className="public-case-preview-backgrounds" aria-label={t('control.quickBackgroundSwitch')}>
            <div className="public-case-preview-background-heading">
              <strong>{t('control.quickBackgroundSwitch')}</strong>
              {backgrounds.length > 1 && (
                <div>
                  <button
                    type="button"
                    onClick={() => selectRelativeBackground(-1)}
                    aria-label={t('animation.previous')}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <span>{backgroundIndex + 1} / {backgrounds.length}</span>
                  <button
                    type="button"
                    onClick={() => selectRelativeBackground(1)}
                    aria-label={t('animation.next')}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
            <div className="public-case-preview-background-list">
              {backgrounds.map((background, index) => (
                <button
                  key={background.id}
                  type="button"
                  className={index === backgroundIndex ? 'active' : ''}
                  aria-pressed={index === backgroundIndex}
                  aria-label={background.name}
                  title={background.name}
                  onClick={() => selectBackground(index)}
                >
                  {background.type === 'video' ? (
                    <video src={background.url} muted playsInline preload="metadata" />
                  ) : (
                    <img src={background.url} alt="" draggable={false} />
                  )}
                  <span>{background.name}</span>
                </button>
              ))}
            </div>
          </aside>
        )}
      </section>
    </main>
  )
}

export type { PublicCasePreviewPageProps }
export default PublicCasePreviewPage
