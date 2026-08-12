import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  FlipHorizontal2,
  FlipVertical2,
  Maximize2,
  Move,
  MousePointerClick,
  Pencil,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Shuffle,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  MAX_DYNAMIC_ITEMS_PER_GROUP,
  addDynamicItem,
  calculateGridIndex,
  copyDynamicItemSettings,
  DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS,
  DEFAULT_DYNAMIC_BACKGROUND_INTERVAL_MS,
  deleteDynamicBackgrounds,
  deleteDynamicItem,
  deleteDynamicItems,
  getDynamicMoveTrackCenter,
  getDynamicMoveTrackFromPosition,
  MAX_DYNAMIC_BACKGROUND_INTERVAL_MS,
  MAX_DYNAMIC_APPEAR_INTERVAL_MS,
  MIN_DYNAMIC_BACKGROUND_INTERVAL_MS,
  MIN_DYNAMIC_APPEAR_INTERVAL_MS,
  reorderDynamicBackgrounds,
  reorderDynamicItems,
  setActiveDynamicBackground,
  setDynamicBackground,
  updateDynamicBackgroundPlayback,
  updateDynamicGroupAppearMode,
  updateDynamicItemMeta,
  upsertDynamicGroup,
  type DynamicAppearMode,
  type DynamicBackground,
  type DynamicBackgroundPlayMode,
  type DynamicCopyField,
  type DynamicGroup,
  type DynamicItem,
  type DynamicMoveMode,
  type DynamicMoveTrack
} from '../services/dynamicArtStorage.ts'
import { sendDynamicEvent, uploadUnityAsset } from '../services/unityBridge.ts'
import {
  syncDynamicGroupToReceiver,
  type SyncStatus
} from '../services/dynamicArtReceiverSync.ts'
import { playUiSound } from '../services/uiFeedback.ts'
import DynamicAnimationPreview, {
  getDynamicAnimationPreview
} from './DynamicAnimationPreview.tsx'
import DynamicStageItemAnimation from './DynamicStageItemAnimation.tsx'
import WalkAnimationCanvas from './WalkAnimationCanvas.tsx'
import UnityAnimationCanvas from './UnityAnimationCanvas.tsx'
import IntervalWheel from './IntervalWheel.tsx'
import {
  DYNAMIC_ANIMATION_IDS,
  getDynamicAnimationMode,
  getDynamicClickAnimationIds,
  resolveDynamicAnimationId,
  type DynamicAnimationMode
} from '../../desktop-runtime/renderer/dynamic-animation-catalog.js'
import {
  UNITY_EXTRA_ANIMATION_MAX_ID,
  UNITY_EXTRA_ANIMATION_MIN_ID
} from '../../desktop-runtime/renderer/unity-animation-core.js'

type ControlTab = 'motion' | 'animation' | 'transform' | 'copy'
type GestureMode = 'none' | 'drag' | 'pinch'
type BackgroundIntervalUnit = 'seconds' | 'minutes'
type PreviewPanelMode = 'object' | 'layers' | 'collapsed'

interface PreviewPanelSnapshot {
  mode: PreviewPanelMode
  activeTab: ControlTab
  selectedItemId: string
}

interface Point {
  x: number
  y: number
}

interface MediaSize {
  width: number
  height: number
}

interface LayerDragState {
  itemId: string
  orderedIds: string[]
  originalGroup: DynamicGroup
  pointerId: number
  pointerType: string
  sourceElement: HTMLElement
  sourceRect: { width: number; height: number }
  pointerOffset: Point
  startPoint: Point
  lastPoint: Point
  active: boolean
  changed: boolean
}

interface LayerDragPreview {
  itemId: string
  x: number
  y: number
  width: number
  height: number
}

interface LayerDropHint {
  itemId: string
  placement: 'before' | 'after'
}

interface BackgroundDragState {
  backgroundId: string
  orderedIds: string[]
  originalGroup: DynamicGroup
  pointerId: number
  pointerType: string
  sourceElement: HTMLElement
  sourceRect: { width: number; height: number }
  pointerOffset: Point
  startPoint: Point
  lastPoint: Point
  active: boolean
  changed: boolean
}

interface BackgroundDragPreview {
  backgroundId: string
  x: number
  y: number
  width: number
  height: number
}

interface BackgroundDropHint {
  backgroundId: string
  placement: 'before' | 'after'
}

interface ImagePreviewTransform {
  scale: number
  x: number
  y: number
}

interface ImagePreviewGesture {
  mode: 'pan' | 'pinch'
  startTransform: ImagePreviewTransform
  startPoint?: Point
  startCenter?: Point
  startDistance?: number
}

interface DynamicControlPageProps {
  group: DynamicGroup
  wsIp: string
  dynamicPort: number
  onBack: () => void
  onGroupChange: (group: DynamicGroup) => void
  initialItemId?: string
}

const MIN_ITEM_SCALE = 0.1
const MAX_ITEM_SCALE = 3
const DEFAULT_MOVE_SPEED = 50
const RUNTIME_STAGE_WIDTH = 1920
const RUNTIME_STAGE_HEIGHT = 1080
const RUNTIME_ITEM_MAX_SIZE = 380
const RUNTIME_ITEM_MIN_SIZE = 120
const DEFAULT_ITEM_NATURAL_WIDTH = 360
const DEFAULT_ITEM_NATURAL_HEIGHT = 260
const DEFAULT_STAGE_PREVIEW_WIDTH = 960
const DEFAULT_STAGE_PREVIEW_HEIGHT = 540
const VERTICAL_TRACK_EDGE_PADDING_RATIO = 28 / DEFAULT_STAGE_PREVIEW_HEIGHT
const VERTICAL_OUT_PADDING_RATIO = Math.max(0.22, 120 / DEFAULT_STAGE_PREVIEW_HEIGHT)
const HORIZONTAL_WAVE_CYCLES = 7
const HORIZONTAL_STAGE_MARGIN = 260
const HORIZONTAL_KEYFRAMES_PER_WAVE = 20
const LAYER_TOUCH_HOLD_MS = 180
const LAYER_MOUSE_DRAG_THRESHOLD = 6
const LAYER_TOUCH_SCROLL_THRESHOLD = 18
const LAYER_AUTO_SCROLL_EDGE = 52
const LAYER_AUTO_SCROLL_MAX_SPEED = 14
const MAX_IMAGE_PREVIEW_SCALE = 5
const MIN_STAGE_ITEM_TOUCH_SIZE = 64
const STAGE_ITEM_TOUCH_PADDING = 14
const MIN_STAGE_ITEM_COMPOSITOR_SIZE = 32
const ANIMATION_SWIPE_THRESHOLD = 42
const FIRST_SELECTABLE_ANIMATION_ID = DYNAMIC_ANIMATION_IDS[0] ?? 1
const LAST_SELECTABLE_ANIMATION_ID = DYNAMIC_ANIMATION_IDS[DYNAMIC_ANIMATION_IDS.length - 1] ?? 17
const RANDOM_PREVIEW_MOTION_MODES: DynamicMoveMode[] = [
  'verticalWave',
  'left',
  'right',
  'orbit'
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const hashString = (value: string) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}
const mixHash = (value: number) => {
  let mixed = value | 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d)
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b)
  return (mixed ^ (mixed >>> 16)) >>> 0
}
const getDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const getAngle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI
const getBackgroundIntervalUnit = (intervalMs: number): BackgroundIntervalUnit => (
  intervalMs >= 60000 ? 'minutes' : 'seconds'
)
const formatBackgroundInterval = (intervalMs: number, unit: BackgroundIntervalUnit) => {
  const value = intervalMs / (unit === 'minutes' ? 60000 : 1000)
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}
const lerp = (from: number, to: number, ratio: number) => from + (to - from) * ratio
const normalizeRotation = (value: number) => {
  let nextValue = value % 360
  if (nextValue > 180) nextValue -= 360
  if (nextValue <= -180) nextValue += 360
  return nextValue
}

const getTrack = (y: number) => getDynamicMoveTrackFromPosition(y)

const getBackgrounds = (nextGroup: DynamicGroup) => {
  if (nextGroup.backgrounds?.length) return nextGroup.backgrounds
  return nextGroup.background ? [nextGroup.background] : []
}

const toBackgroundPayload = (background?: DynamicBackground) => (
  background
    ? {
        assetId: background.id,
        name: background.name,
        mediaType: background.type,
        mimeType: background.mimeType
      }
    : null
)

const motionOptions: { id: DynamicMoveMode; labelKey: string; icon: string }[] = [
  { id: 'none', labelKey: 'control.motionNone', icon: 'none' },
  { id: 'verticalWave', labelKey: 'control.motionVertical', icon: 'wave' },
  { id: 'left', labelKey: 'control.motionLeft', icon: 'left' },
  { id: 'right', labelKey: 'control.motionRight', icon: 'right' },
  { id: 'orbit', labelKey: 'control.motionOrbit', icon: 'orbit' },
  { id: 'random', labelKey: 'control.motionRandom', icon: 'random' }
]

const trackOptions: { id: DynamicMoveTrack; labelKey: string }[] = [
  { id: 'top', labelKey: 'control.trackTop' },
  { id: 'middle', labelKey: 'control.trackMiddle' },
  { id: 'bottom', labelKey: 'control.trackBottom' }
]

const copyFieldOptions: { id: DynamicCopyField; labelKey: string }[] = [
  { id: 'motion', labelKey: 'control.motion' },
  { id: 'animation', labelKey: 'control.animation' },
  { id: 'size', labelKey: 'control.size' },
  { id: 'deform', labelKey: 'control.deform' }
]

const ALL_COPY_FIELDS = copyFieldOptions.map((option) => option.id)

const propertyTabOptions = [
  { id: 'motion' as const, labelKey: 'control.motion', shortLabelKey: 'control.motionShort', icon: Move },
  { id: 'animation' as const, labelKey: 'control.animation', shortLabelKey: 'control.animationShort', icon: Sparkles },
  { id: 'transform' as const, labelKey: 'control.deform', shortLabelKey: 'control.deformShort', icon: SlidersHorizontal },
  { id: 'copy' as const, labelKey: 'control.copyProperties', shortLabelKey: 'control.copyPropertiesShort', icon: RotateCw }
]

const getInitialItemId = (items: DynamicItem[], itemId = '') => {
  if (itemId && items.some((item) => item.id === itemId)) return itemId
  return items[0]?.id ?? ''
}

const getItemTrack = (item: DynamicItem) => item.moveTrack ?? getTrack(item.position.y)
const getItemMoveSpeed = (item: DynamicItem) => clamp(item.moveSpeed ?? DEFAULT_MOVE_SPEED, 0, 100)
const getItemFlipX = (item: DynamicItem) => item.flipX ?? false
const getItemFlipY = (item: DynamicItem) => item.flipY ?? false
const getResolvedPreviewAnimationId = (
  item: DynamicItem,
  groupId: string,
  replayId: number
) => resolveDynamicAnimationId(
  getDynamicAnimationMode(item),
  item.animationId,
  DYNAMIC_ANIMATION_IDS,
  `${groupId}:${item.id}:${replayId}`
)
const resolvePreviewMotionMode = (
  item: DynamicItem,
  groupId: string,
  replayId: number
): DynamicMoveMode => {
  if (item.moveMode !== 'random') return item.moveMode
  const modeIndex = mixHash(hashString(`${groupId}:${item.id}:${replayId}`)) % RANDOM_PREVIEW_MOTION_MODES.length
  return RANDOM_PREVIEW_MOTION_MODES[modeIndex]
}

const getTrackBounds = (track: DynamicMoveTrack) => {
  if (track === 'top') return { start: 0, end: 1 / 3 }
  if (track === 'bottom') return { start: 2 / 3, end: 1 }
  return { start: 1 / 3, end: 2 / 3 }
}

const getVerticalWaveOffsets = (item: DynamicItem, stageHeight: number) => {
  const safeStageHeight = stageHeight || DEFAULT_STAGE_PREVIEW_HEIGHT
  const amplitudeRatio = clamp(Number(item.movePercent ?? 50), 0, 100) / 100
  const localRatio = Math.min(amplitudeRatio / 0.5, 1)
  const fullRatio = Math.max((amplitudeRatio - 0.5) / 0.5, 0)
  const positionYValue = Number(item.position?.y ?? 0.5)
  const positionY = Number.isFinite(positionYValue) ? positionYValue : 0.5
  const { start: trackStart, end: trackEnd } = getTrackBounds(getItemTrack(item))
  const trackEdgePadding = safeStageHeight * VERTICAL_TRACK_EDGE_PADDING_RATIO
  const outPadding = safeStageHeight * VERTICAL_OUT_PADDING_RATIO
  const localUpLimit = Math.max((positionY - trackStart) * safeStageHeight - trackEdgePadding, 0)
  const localDownLimit = Math.max((trackEnd - positionY) * safeStageHeight - trackEdgePadding, 0)
  const localWaveUp = -localUpLimit * localRatio
  const localWaveDown = localDownLimit * localRatio
  const fullWaveUp = -(positionY * safeStageHeight + outPadding)
  const fullWaveDown = (1 - positionY) * safeStageHeight + outPadding

  return {
    localUpLimit,
    localDownLimit,
    waveUp: Math.round(lerp(localWaveUp, fullWaveUp, fullRatio)),
    waveDown: Math.round(lerp(localWaveDown, fullWaveDown, fullRatio))
  }
}

const getMoveDuration = (speed: number, baseSeconds = 5.5) => {
  const ratio = clamp(speed, 1, 100) / 100
  return lerp(baseSeconds * 1.55, baseSeconds * 0.46, ratio)
}

const getHorizontalMotionPoint = (
  moveMode: DynamicMoveMode,
  timelineProgress: number,
  movePercent: number,
  stageSize: { width: number; height: number }
) => {
  const stageWidth = stageSize.width || DEFAULT_STAGE_PREVIEW_WIDTH
  const stageHeight = stageSize.height || DEFAULT_STAGE_PREVIEW_HEIGHT
  const margin = stageWidth * HORIZONTAL_STAGE_MARGIN / RUNTIME_STAGE_WIDTH
  const travel = stageWidth + margin * 2
  const pathProgress = moveMode === 'left' ? 1 - timelineProgress : timelineProgress
  const amplitude = clamp(movePercent, 0, 100) / 100 * stageHeight * 0.5

  return {
    x: -margin + travel * pathProgress,
    y: Math.sin(pathProgress * Math.PI * 2 * HORIZONTAL_WAVE_CYCLES) * amplitude
  }
}

const formatHorizontalMotionTransform = (point: Point) => (
  `translate(-50%, -50%) translate3d(${point.x.toFixed(3)}px, ${point.y.toFixed(3)}px, 0)`
)

const buildHorizontalMotionKeyframes = (
  item: DynamicItem,
  motionMode: DynamicMoveMode,
  stageSize: { width: number; height: number }
): Keyframe[] => {
  const frameCount = HORIZONTAL_WAVE_CYCLES * HORIZONTAL_KEYFRAMES_PER_WAVE
  return Array.from({ length: frameCount + 1 }, (_, index) => {
    const offset = index / frameCount
    return {
      offset,
      transform: formatHorizontalMotionTransform(
        getHorizontalMotionPoint(motionMode, offset, item.movePercent, stageSize)
      )
    }
  })
}

interface DynamicStageMotionProps {
  item: DynamicItem
  motionMode: DynamicMoveMode
  stageSize: { width: number; height: number }
  appearDelayMs: number
  replayId: number
  style: React.CSSProperties
  children: React.ReactNode
}

interface HorizontalAnimationState {
  animation: Animation | null
  currentTime: number | null
}

interface DynamicStageAppearanceProps {
  previewing: boolean
  ready: boolean
  appearDelayMs: number
  replayId: number
  children: React.ReactNode
}

const DynamicStageAppearance: React.FC<DynamicStageAppearanceProps> = ({
  previewing,
  ready,
  appearDelayMs,
  replayId,
  children
}) => {
  const elementRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = elementRef.current
    if (!element) return undefined

    element.getAnimations().forEach((animation) => animation.cancel())

    if (!previewing) {
      element.style.removeProperty('opacity')
      element.style.removeProperty('transform')
      return undefined
    }

    if (!ready) {
      element.style.opacity = '0'
      element.style.transform = 'scale(0.96)'
      return undefined
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const animation = element.animate([
      { opacity: 0, transform: reduceMotion ? 'scale(1)' : 'scale(0.96)' },
      { opacity: 1, transform: 'scale(1)' }
    ], {
      duration: reduceMotion ? 140 : 420,
      delay: appearDelayMs,
      easing: 'ease',
      fill: 'both'
    })

    return () => animation.cancel()
  }, [appearDelayMs, previewing, ready, replayId])

  return (
    <div ref={elementRef} className="dynamic-stage-item-appear">
      {children}
    </div>
  )
}

interface DynamicStageMediaProps {
  src: string
  name: string
  mediaId: string
  animationId: number
  previewMode: boolean
  replayId: number
  active: boolean
  copyPulse: boolean
  onImageLoad: (mediaId: string, image: HTMLImageElement) => void
  onImageError: (mediaId: string) => void
}

const addImageRetryToken = (src: string, token: number) => (
  token > 0 ? `${src}${src.includes('#') ? '&' : '#'}magicfloor-retry=${token}` : src
)

const DynamicStageMedia: React.FC<DynamicStageMediaProps> = ({
  src,
  name,
  mediaId,
  animationId,
  previewMode,
  replayId,
  active,
  copyPulse,
  onImageLoad,
  onImageError
}) => {
  const { t } = useTranslation()
  const imageRef = useRef<HTMLImageElement>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [animatedCanvasReady, setAnimatedCanvasReady] = useState(false)
  const walkActive = previewMode && animationId === 9
  const unityActive = previewMode
    && animationId >= UNITY_EXTRA_ANIMATION_MIN_ID
    && animationId <= UNITY_EXTRA_ANIMATION_MAX_ID
  const canvasAnimationActive = walkActive || unityActive

  useEffect(() => {
    setRetryToken(0)
  }, [src])

  useEffect(() => {
    setAnimatedCanvasReady(false)
  }, [animationId, replayId, src, canvasAnimationActive])

  useLayoutEffect(() => {
    const image = imageRef.current
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      onImageLoad(mediaId, image)
    }
  }, [mediaId, onImageLoad, retryToken])

  const handleImageError = () => {
    if (retryToken === 0) {
      setRetryToken(Date.now())
      return
    }
    onImageError(mediaId)
  }

  return (
    <div className="dynamic-stage-item-media-stack">
      <img
        ref={imageRef}
        src={addImageRetryToken(src, retryToken)}
        alt={name}
        draggable={false}
        decoding="async"
        onLoad={(event) => onImageLoad(mediaId, event.currentTarget)}
        onError={handleImageError}
        className={`dynamic-stage-item-visual ${active ? 'active' : ''} ${copyPulse ? 'copy-pulse' : ''} ${canvasAnimationActive && animatedCanvasReady ? 'walk-source-hidden' : ''}`}
      />
      {walkActive && (
        <WalkAnimationCanvas
          src={src}
          ariaLabel={t('animation.namedWalk', { name })}
          replayKey={replayId}
          onFirstFrame={() => setAnimatedCanvasReady(true)}
          className={`dynamic-stage-item-visual dynamic-stage-item-walk ${animatedCanvasReady ? 'is-ready' : ''}`}
        />
      )}
      {unityActive && (
        <UnityAnimationCanvas
          src={src}
          animationId={animationId}
          ariaLabel={t('animation.namedPreview', {
            name,
            animation: t(getDynamicAnimationPreview(animationId).labelKey)
          })}
          replayKey={replayId}
          overscanX={1.55}
          overscanY={1.72}
          onFirstFrame={() => setAnimatedCanvasReady(true)}
          className={`dynamic-stage-item-visual dynamic-stage-item-unity ${animatedCanvasReady ? 'is-ready' : ''}`}
        />
      )}
    </div>
  )
}

const DynamicStageMotion: React.FC<DynamicStageMotionProps> = ({
  item,
  motionMode,
  stageSize,
  appearDelayMs,
  replayId,
  style,
  children
}) => {
  const elementRef = useRef<HTMLDivElement>(null)
  const animationStateRef = useRef<HorizontalAnimationState>({ animation: null, currentTime: null })
  const isHorizontalMotion = motionMode === 'left' || motionMode === 'right'

  useLayoutEffect(() => {
    const element = elementRef.current
    const previousState = animationStateRef.current
    const retainedCurrentTime = previousState.currentTime
    previousState.animation?.cancel()

    if (!element || !isHorizontalMotion || stageSize.width <= 0 || stageSize.height <= 0) {
      animationStateRef.current = { animation: null, currentTime: null }
      return undefined
    }

    const duration = getMoveDuration(getItemMoveSpeed(item), 8.5) * 1000
    const animation = element.animate(buildHorizontalMotionKeyframes(item, motionMode, stageSize), {
      duration,
      delay: appearDelayMs,
      iterations: Infinity,
      easing: 'linear',
      fill: 'both'
    })

    if (retainedCurrentTime !== null) {
      animation.currentTime = retainedCurrentTime
    }
    animationStateRef.current = { animation, currentTime: null }

    return () => {
      const currentTime = animation.currentTime
      animationStateRef.current = {
        animation: null,
        currentTime: typeof currentTime === 'number' ? currentTime : null
      }
      animation.cancel()
    }
  }, [appearDelayMs, isHorizontalMotion, item.id, item.movePercent, item.moveSpeed, motionMode, replayId, stageSize.height, stageSize.width])

  return (
    <div
      ref={elementRef}
      data-dynamic-item-id={item.id}
      className={`dynamic-stage-item-motion move-${motionMode} ${isHorizontalMotion ? 'composed-horizontal-motion' : ''}`}
      style={style}
    >
      {children}
    </div>
  )
}

const getPositiveDimension = (value?: number) => (
  Number.isFinite(value) && value && value > 0 ? value : undefined
)

const getDynamicItemPreviewSize = (
  item: DynamicItem,
  cachedSize: MediaSize | undefined,
  stageSize: { width: number; height: number }
) => {
  const cachedWidth = getPositiveDimension(cachedSize?.width)
  const cachedHeight = getPositiveDimension(cachedSize?.height)
  const mediaWidth = getPositiveDimension(item.media.width)
  const mediaHeight = getPositiveDimension(item.media.height)
  const hasCachedSize = Boolean(cachedWidth && cachedHeight)
  const hasMediaSize = Boolean(mediaWidth && mediaHeight)
  const naturalWidth = hasCachedSize
    ? cachedWidth!
    : hasMediaSize
      ? mediaWidth!
      : DEFAULT_ITEM_NATURAL_WIDTH
  const naturalHeight = hasCachedSize
    ? cachedHeight!
    : hasMediaSize
      ? mediaHeight!
      : DEFAULT_ITEM_NATURAL_HEIGHT
  const naturalMax = Math.max(naturalWidth, naturalHeight)
  let runtimeRatio = RUNTIME_ITEM_MAX_SIZE / naturalMax

  if (naturalMax < RUNTIME_ITEM_MIN_SIZE) {
    runtimeRatio = RUNTIME_ITEM_MIN_SIZE / naturalMax
  } else {
    runtimeRatio = Math.min(runtimeRatio, 1)
  }

  const stageWidth = stageSize.width || DEFAULT_STAGE_PREVIEW_WIDTH
  const stageHeight = stageSize.height || DEFAULT_STAGE_PREVIEW_HEIGHT
  const stageRatio = Math.min(stageWidth / RUNTIME_STAGE_WIDTH, stageHeight / RUNTIME_STAGE_HEIGHT)

  return {
    width: Math.max(1, naturalWidth * runtimeRatio * stageRatio),
    height: Math.max(1, naturalHeight * runtimeRatio * stageRatio)
  }
}

const isPointInsideDynamicItem = (
  item: DynamicItem,
  itemSize: MediaSize,
  stageRect: DOMRect,
  clientPoint: Point
) => {
  const scale = Number.isFinite(item.scale) ? Math.max(Math.abs(item.scale), MIN_ITEM_SCALE) : 1
  const hitWidth = Math.max(
    MIN_STAGE_ITEM_TOUCH_SIZE,
    itemSize.width * scale + STAGE_ITEM_TOUCH_PADDING * 2
  )
  const hitHeight = Math.max(
    MIN_STAGE_ITEM_TOUCH_SIZE,
    itemSize.height * scale + STAGE_ITEM_TOUCH_PADDING * 2
  )
  const centerX = stageRect.left + item.position.x * stageRect.width
  const centerY = stageRect.top + item.position.y * stageRect.height
  const deltaX = clientPoint.x - centerX
  const deltaY = clientPoint.y - centerY
  const rotation = item.rotation * Math.PI / 180
  const localX = deltaX * Math.cos(rotation) + deltaY * Math.sin(rotation)
  const localY = -deltaX * Math.sin(rotation) + deltaY * Math.cos(rotation)

  return Math.abs(localX) <= hitWidth / 2 && Math.abs(localY) <= hitHeight / 2
}

const getMotionPreviewStyle = (
  item: DynamicItem,
  motionMode: DynamicMoveMode,
  isManipulating: boolean,
  stageSize: { width: number; height: number }
): React.CSSProperties => {
  const stageWidth = stageSize.width || DEFAULT_STAGE_PREVIEW_WIDTH
  const stageHeight = stageSize.height || DEFAULT_STAGE_PREVIEW_HEIGHT
  const isLoopMove = !isManipulating && (motionMode === 'left' || motionMode === 'right')
  const amplitudeRatio = clamp(Number(item.movePercent ?? 50), 0, 100) / 100
  const localRatio = Math.min(amplitudeRatio / 0.5, 1)
  const fullRatio = Math.max((amplitudeRatio - 0.5) / 0.5, 0)
  const { localUpLimit, localDownLimit, waveUp, waveDown } = getVerticalWaveOffsets(item, stageHeight)
  const randomX = Math.round(amplitudeRatio * stageWidth * 0.18)
  const randomY = Math.round(amplitudeRatio * stageHeight * 0.24)
  const horizontalStartPoint = isLoopMove
    ? getHorizontalMotionPoint(motionMode, 0, item.movePercent, { width: stageWidth, height: stageHeight })
    : null
  const localOrbitY = Math.max(Math.min(localUpLimit, localDownLimit) * localRatio, 0)
  const localOrbitX = Math.min(stageWidth * 0.28, Math.max(stageWidth * 0.08 * localRatio, localOrbitY * 2.2))
  const fullOrbitY = Math.max(item.position.y, 1 - item.position.y) * stageHeight
  const edgeAwareOrbitX = Math.max(Math.min(item.position.x, 1 - item.position.x) * stageWidth + stageWidth * 0.18, stageWidth * 0.28)
  const fullOrbitX = Math.min(stageWidth * 0.6, edgeAwareOrbitX, Math.max(stageWidth * 0.3, fullOrbitY * 1.35))
  const orbitX = Math.round(lerp(localOrbitX, fullOrbitX, fullRatio))
  const orbitY = Math.round(lerp(localOrbitY, fullOrbitY, fullRatio))
  const orbitX92 = Math.round(orbitX * 0.924)
  const orbitX71 = Math.round(orbitX * 0.707)
  const orbitX38 = Math.round(orbitX * 0.383)
  const orbitY92 = Math.round(orbitY * 0.924)
  const orbitY71 = Math.round(orbitY * 0.707)
  const orbitY38 = Math.round(orbitY * 0.383)
  const orbitFrontScale = 1 + amplitudeRatio * 0.24
  const orbitBackScale = Math.max(0.76, 1 - amplitudeRatio * 0.22)
  const moveDuration = getMoveDuration(getItemMoveSpeed(item), isLoopMove ? 8.5 : 5.5)

  return {
    left: isLoopMove ? '0px' : `${item.position.x * 100}%`,
    top: isLoopMove
      ? `${clamp(item.position.y, -0.2, 1.2) * 100}%`
      : `${item.position.y * 100}%`,
    transform: horizontalStartPoint ? formatHorizontalMotionTransform(horizontalStartPoint) : undefined,
    zIndex: 10 + item.order,
    '--move-duration': `${moveDuration}s`,
    '--move-ratio': String(amplitudeRatio),
    '--move-wave-down': `${waveDown}px`,
    '--move-wave-up': `${waveUp}px`,
    '--move-random-x': `${randomX}px`,
    '--move-random-x-small': `${Math.round(randomX * 0.34)}px`,
    '--move-random-x-negative': `${-randomX}px`,
    '--move-random-x-mid-negative': `${-Math.round(randomX * 0.55)}px`,
    '--move-random-y': `${randomY}px`,
    '--move-random-y-soft': `${Math.round(randomY * 0.7)}px`,
    '--move-random-y-negative': `${-randomY}px`,
    '--move-random-y-small-negative': `${-Math.round(randomY * 0.42)}px`,
    '--move-random-y-soft-negative': `${-Math.round(randomY * 0.72)}px`,
    '--move-orbit-x': `${orbitX}px`,
    '--move-orbit-x-negative': `${-orbitX}px`,
    '--move-orbit-x-92': `${orbitX92}px`,
    '--move-orbit-x-71': `${orbitX71}px`,
    '--move-orbit-x-38': `${orbitX38}px`,
    '--move-orbit-x-negative-92': `${-orbitX92}px`,
    '--move-orbit-x-negative-71': `${-orbitX71}px`,
    '--move-orbit-x-negative-38': `${-orbitX38}px`,
    '--move-orbit-y-front': `${orbitY}px`,
    '--move-orbit-y-back': `${-orbitY}px`,
    '--move-orbit-y-front-92': `${orbitY92}px`,
    '--move-orbit-y-front-71': `${orbitY71}px`,
    '--move-orbit-y-front-38': `${orbitY38}px`,
    '--move-orbit-y-back-92': `${-orbitY92}px`,
    '--move-orbit-y-back-71': `${-orbitY71}px`,
    '--move-orbit-y-back-38': `${-orbitY38}px`,
    '--move-orbit-scale-front': orbitFrontScale.toFixed(3),
    '--move-orbit-scale-mid-front': (1 + amplitudeRatio * 0.12).toFixed(3),
    '--move-orbit-scale-back': orbitBackScale.toFixed(3),
    '--move-orbit-scale-mid-back': Math.max(0.84, 1 - amplitudeRatio * 0.11).toFixed(3)
  } as React.CSSProperties
}

const DynamicControlPage: React.FC<DynamicControlPageProps> = ({
  group,
  wsIp,
  dynamicPort,
  onBack,
  onGroupChange,
  initialItemId
}) => {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement>(null)
  const stageBackgroundVideoRef = useRef<HTMLVideoElement>(null)
  const backgroundInputRef = useRef<HTMLInputElement>(null)
  const layerItemInputRef = useRef<HTMLInputElement>(null)
  const layerListRef = useRef<HTMLDivElement>(null)
  const backgroundListRef = useRef<HTMLDivElement>(null)
  const latestGroupRef = useRef(group)
  const pointersRef = useRef<Map<number, Point>>(new Map())
  const gestureModeRef = useRef<GestureMode>('none')
  const gestureItemIdRef = useRef<string | null>(null)
  const dragStartRef = useRef<{ point: Point; position: Point } | null>(null)
  const pinchStartRef = useRef<{ distance: number; angle: number; scale: number; rotation: number } | null>(null)
  const lastTransformSentAtRef = useRef<Record<string, number>>({})
  const gestureMovedRef = useRef(false)
  const layerDragRef = useRef<LayerDragState | null>(null)
  const layerDragActivationTimerRef = useRef<number | null>(null)
  const layerAutoScrollFrameRef = useRef<number | null>(null)
  const layerSuppressClickRef = useRef(false)
  const backgroundDragRef = useRef<BackgroundDragState | null>(null)
  const backgroundDragActivationTimerRef = useRef<number | null>(null)
  const backgroundAutoScrollFrameRef = useRef<number | null>(null)
  const backgroundSuppressClickRef = useRef(false)
  const backgroundPointerListenersRef = useRef<{
    move: (event: PointerEvent) => void
    end: (event: PointerEvent) => void
    cancel: (event: PointerEvent) => void
  } | null>(null)
  const layerPointerListenersRef = useRef<{
    move: (event: PointerEvent) => void
    end: (event: PointerEvent) => void
    cancel: (event: PointerEvent) => void
  } | null>(null)
  const copyFeedbackTimerRef = useRef<number | null>(null)
  const previewReplayIdRef = useRef(0)
  const previewPanelSnapshotRef = useRef<PreviewPanelSnapshot | null>(null)
  const transformPersistTimerRef = useRef<number | null>(null)
  const propertyNameInputRef = useRef<HTMLInputElement>(null)
  const propertyThumbnailButtonRef = useRef<HTMLButtonElement>(null)
  const imagePreviewCloseButtonRef = useRef<HTMLButtonElement>(null)
  const imagePreviewViewportRef = useRef<HTMLDivElement>(null)
  const imagePreviewPointersRef = useRef<Map<number, Point>>(new Map())
  const imagePreviewGestureRef = useRef<ImagePreviewGesture | null>(null)
  const imagePreviewTransformRef = useRef<ImagePreviewTransform>({ scale: 1, x: 0, y: 0 })
  const copyConfirmCloseButtonRef = useRef<HTMLButtonElement>(null)
  const copyReturnFocusRef = useRef<HTMLButtonElement | null>(null)
  const clickAnimationRangeCloseButtonRef = useRef<HTMLButtonElement>(null)
  const animationSwipeStartRef = useRef<{ pointerId: number; x: number } | null>(null)

  const [selectedItemId, setSelectedItemId] = useState(() => getInitialItemId(group.items, initialItemId))
  const [toolOpen, setToolOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ControlTab>('motion')
  const [backgroundPanelOpen, setBackgroundPanelOpen] = useState(false)
  const [backgroundIntervalUnit, setBackgroundIntervalUnit] = useState<BackgroundIntervalUnit>(() => {
    const intervalMs = clamp(
      group.backgroundIntervalMs ?? DEFAULT_DYNAMIC_BACKGROUND_INTERVAL_MS,
      MIN_DYNAMIC_BACKGROUND_INTERVAL_MS,
      MAX_DYNAMIC_BACKGROUND_INTERVAL_MS
    )
    return getBackgroundIntervalUnit(intervalMs)
  })
  const [backgroundIntervalDraft, setBackgroundIntervalDraft] = useState(() => {
    const intervalMs = clamp(
      group.backgroundIntervalMs ?? DEFAULT_DYNAMIC_BACKGROUND_INTERVAL_MS,
      MIN_DYNAMIC_BACKGROUND_INTERVAL_MS,
      MAX_DYNAMIC_BACKGROUND_INTERVAL_MS
    )
    return formatBackgroundInterval(intervalMs, getBackgroundIntervalUnit(intervalMs))
  })
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [appearPanelOpen, setAppearPanelOpen] = useState(false)
  const [selectedBackgroundIds, setSelectedBackgroundIds] = useState<string[]>([])
  const [selectedLayerItemIds, setSelectedLayerItemIds] = useState<string[]>([])
  const [copiedSourceItemId, setCopiedSourceItemId] = useState('')
  const [selectedCopyFields, setSelectedCopyFields] = useState<DynamicCopyField[]>(ALL_COPY_FIELDS)
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [copyErrorKey, setCopyErrorKey] = useState('')
  const [copyFeedbackItemId, setCopyFeedbackItemId] = useState('')
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
  const [imagePreviewTransform, setImagePreviewTransform] = useState<ImagePreviewTransform>({ scale: 1, x: 0, y: 0 })
  const [isEditingItemName, setIsEditingItemName] = useState(false)
  const [itemNameDraft, setItemNameDraft] = useState('')
  const [itemNameErrorKey, setItemNameErrorKey] = useState('')
  const [isSavingItemName, setIsSavingItemName] = useState(false)
  const [draggedLayerItemId, setDraggedLayerItemId] = useState('')
  const [pressedLayerItemId, setPressedLayerItemId] = useState('')
  const [layerDragPreview, setLayerDragPreview] = useState<LayerDragPreview | null>(null)
  const [layerDropHint, setLayerDropHint] = useState<LayerDropHint | null>(null)
  const [draggedBackgroundId, setDraggedBackgroundId] = useState('')
  const [pressedBackgroundId, setPressedBackgroundId] = useState('')
  const [backgroundDragPreview, setBackgroundDragPreview] = useState<BackgroundDragPreview | null>(null)
  const [backgroundDropHint, setBackgroundDropHint] = useState<BackgroundDropHint | null>(null)
  const [manipulatingItemId, setManipulatingItemId] = useState('')
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [itemImageSizes, setItemImageSizes] = useState<Record<string, MediaSize>>({})
  const [readyItemMediaIds, setReadyItemMediaIds] = useState<Record<string, boolean>>({})
  const [isAddingLayerItem, setIsAddingLayerItem] = useState(false)
  const [receiverSyncStatus, setReceiverSyncStatus] = useState<SyncStatus | 'complete' | null>(null)
  const [receiverSyncError, setReceiverSyncError] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewReplayId, setPreviewReplayId] = useState(0)
  const [previewBackgroundId, setPreviewBackgroundId] = useState(group.background?.id ?? '')
  const [animationCursor, setAnimationCursor] = useState(FIRST_SELECTABLE_ANIMATION_ID)
  const [animationPreviewSessionId, setAnimationPreviewSessionId] = useState(0)
  const [clickAnimationRangeOpen, setClickAnimationRangeOpen] = useState(false)
  const [clickAnimationDraft, setClickAnimationDraft] = useState<number[]>([])

  const sortedItems = [...group.items].sort((a, b) => a.order - b.order)
  const layerItems = [...sortedItems].reverse()
  const selectedItem = sortedItems.find((item) => item.id === selectedItemId) ?? sortedItems[0]
  const copySourceItem = sortedItems.find((item) => item.id === copiedSourceItemId)
  const backgrounds = getBackgrounds(group)
  const backgroundIdsKey = backgrounds.map((background) => background.id).join('|')
  const displayedBackground = previewMode
    ? backgrounds.find((background) => background.id === previewBackgroundId) ?? group.background
    : group.background
  const activeTrack = selectedItem ? getItemTrack(selectedItem) : 'middle'
  const selectedMoveSpeed = selectedItem ? getItemMoveSpeed(selectedItem) : DEFAULT_MOVE_SPEED
  const appearIntervalMs = clamp(
    group.appearIntervalMs ?? DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS,
    MIN_DYNAMIC_APPEAR_INTERVAL_MS,
    MAX_DYNAMIC_APPEAR_INTERVAL_MS
  )
  const appearIntervalSeconds = (appearIntervalMs / 1000).toFixed(1)
  const backgroundIntervalMs = clamp(
    group.backgroundIntervalMs ?? DEFAULT_DYNAMIC_BACKGROUND_INTERVAL_MS,
    MIN_DYNAMIC_BACKGROUND_INTERVAL_MS,
    MAX_DYNAMIC_BACKGROUND_INTERVAL_MS
  )
  const backgroundIntervalDisplayValue = Number(backgroundIntervalDraft)
  const backgroundWheelValue = Number.isFinite(backgroundIntervalDisplayValue) && backgroundIntervalDisplayValue > 0
    ? backgroundIntervalDisplayValue
    : Number(formatBackgroundInterval(backgroundIntervalMs, backgroundIntervalUnit))
  const backgroundWheelMin = backgroundIntervalUnit === 'minutes' ? 0.02 : 1
  const backgroundWheelMax = backgroundIntervalUnit === 'minutes' ? 10 : 600
  const backgroundWheelStep = backgroundIntervalUnit === 'minutes' ? 0.5 : 1
  const allLayersSelected = group.items.length > 0 && selectedLayerItemIds.length === group.items.length
  const someLayersSelected = selectedLayerItemIds.length > 0 && !allLayersSelected
  const allBackgroundsSelected = backgrounds.length > 0 && selectedBackgroundIds.length === backgrounds.length
  const someBackgroundsSelected = selectedBackgroundIds.length > 0 && !allBackgroundsSelected
  const rightPanelMode = previewMode
    ? 'preview'
    : rightPanelCollapsed
      ? 'collapsed'
      : toolOpen && selectedItem
        ? 'object'
        : 'layers'
  const rightPanelVisible = !previewMode && rightPanelMode !== 'collapsed'
  const visibleActiveTab = activeTab
  const selectedAnimationMode = selectedItem ? getDynamicAnimationMode(selectedItem) : 'none'
  const animationPreviewId = selectedItem
    ? selectedAnimationMode === 'none'
      ? 0
      : selectedAnimationMode === 'random'
        ? resolveDynamicAnimationId(
          'random',
          selectedItem.animationId,
          DYNAMIC_ANIMATION_IDS,
          `${group.id}:${selectedItem.id}:property:${animationPreviewSessionId}`
        )
        : animationCursor
    : 0
  const selectedItemScale = selectedItem
    ? clamp(Number.isFinite(selectedItem.scale) ? selectedItem.scale : 1, MIN_ITEM_SCALE, MAX_ITEM_SCALE)
    : 1
  const selectedItemRotation = selectedItem
    ? normalizeRotation(Number.isFinite(selectedItem.rotation) ? selectedItem.rotation : 0)
    : 0

  const buildGroupStatePayload = (nextGroup: DynamicGroup) => {
    const nextBackgrounds = getBackgrounds(nextGroup)
    return {
      groupId: nextGroup.id,
      name: nextGroup.name,
      appearMode: nextGroup.appearMode,
      appearIntervalMs: nextGroup.appearIntervalMs,
      backgroundPlayMode: nextGroup.backgroundPlayMode,
      backgroundIntervalMs: nextGroup.backgroundIntervalMs,
      activeBackgroundId: nextGroup.activeBackgroundId,
      background: toBackgroundPayload(nextGroup.background),
      backgrounds: nextBackgrounds.map((background) => toBackgroundPayload(background)),
      items: nextGroup.items.map((item) => ({
        itemId: item.id,
        assetId: item.media.id,
        name: item.name,
        gridIndex: item.gridIndex,
        position: item.position,
        scale: item.scale,
        rotation: item.rotation,
        flipX: getItemFlipX(item),
        flipY: getItemFlipY(item),
        animationMode: getDynamicAnimationMode(item),
        animationId: item.animationId,
        clickAnimationIds: getDynamicClickAnimationIds(item),
        moveMode: item.moveMode,
        movePercent: item.movePercent,
        moveSpeed: getItemMoveSpeed(item),
        moveTrack: getItemTrack(item),
        order: item.order
      }))
    }
  }

  const sendGroupStateSync = (nextGroup: DynamicGroup) => {
    sendDynamicEvent(wsIp, dynamicPort, 'GroupStateSync', buildGroupStatePayload(nextGroup))
  }

  const persistCurrentGroup = () => {
    upsertDynamicGroup(latestGroupRef.current)
  }

  const clearPendingTransformPersist = () => {
    if (transformPersistTimerRef.current !== null) {
      window.clearTimeout(transformPersistTimerRef.current)
      transformPersistTimerRef.current = null
    }
  }

  const flushPendingTransformPersist = () => {
    clearPendingTransformPersist()
    persistCurrentGroup()
  }

  const scheduleTransformPersist = () => {
    if (transformPersistTimerRef.current !== null) return

    transformPersistTimerRef.current = window.setTimeout(() => {
      transformPersistTimerRef.current = null
      persistCurrentGroup()
    }, 180)
  }

  const handleControlBack = () => {
    if (transformPersistTimerRef.current !== null) {
      flushPendingTransformPersist()
    }
    onBack()
  }

  useEffect(() => {
    latestGroupRef.current = group
  }, [group])

  useEffect(() => {
    setPreviewMode(false)
    previewPanelSnapshotRef.current = null
    setToolOpen(false)
    setBackgroundPanelOpen(false)
    const intervalMs = clamp(
      group.backgroundIntervalMs ?? DEFAULT_DYNAMIC_BACKGROUND_INTERVAL_MS,
      MIN_DYNAMIC_BACKGROUND_INTERVAL_MS,
      MAX_DYNAMIC_BACKGROUND_INTERVAL_MS
    )
    const intervalUnit = getBackgroundIntervalUnit(intervalMs)
    setBackgroundIntervalUnit(intervalUnit)
    setBackgroundIntervalDraft(formatBackgroundInterval(intervalMs, intervalUnit))
    setRightPanelCollapsed(false)
    setAppearPanelOpen(false)
    setCopyConfirmOpen(false)
    setClickAnimationRangeOpen(false)
    setClickAnimationDraft([])
    setIsCopying(false)
    setCopyErrorKey('')
    setCopiedSourceItemId('')
    setSelectedCopyFields([...ALL_COPY_FIELDS])
    setIsImagePreviewOpen(false)
    setImagePreviewTransform({ scale: 1, x: 0, y: 0 })
    setIsEditingItemName(false)
    setItemNameDraft('')
    setItemNameErrorKey('')
    setIsSavingItemName(false)
    setSelectedLayerItemIds([])
    setSelectedBackgroundIds([])
    setPreviewBackgroundId(group.background?.id ?? '')
  }, [group.id])

  useEffect(() => {
    setCopyConfirmOpen(false)
    setClickAnimationRangeOpen(false)
    setClickAnimationDraft([])
    setCopyErrorKey('')
    setCopiedSourceItemId((currentId) => currentId === selectedItemId ? '' : currentId)
    setIsImagePreviewOpen(false)
    setImagePreviewTransform({ scale: 1, x: 0, y: 0 })
    imagePreviewPointersRef.current.clear()
    imagePreviewGestureRef.current = null
    setIsEditingItemName(false)
    setItemNameErrorKey('')
    setItemNameDraft(latestGroupRef.current.items.find((item) => item.id === selectedItemId)?.name ?? '')
  }, [selectedItemId])

  useEffect(() => {
    if (!selectedItem) return
    const nextCursor = selectedItem.animationId >= FIRST_SELECTABLE_ANIMATION_ID
      ? selectedItem.animationId
      : FIRST_SELECTABLE_ANIMATION_ID
    setAnimationCursor(nextCursor)
  }, [selectedItem?.id, selectedItem?.animationId])

  useEffect(() => {
    if (!isEditingItemName) return undefined
    const frame = window.requestAnimationFrame(() => {
      propertyNameInputRef.current?.focus({ preventScroll: true })
      propertyNameInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isEditingItemName])

  useEffect(() => {
    if (!isImagePreviewOpen) return undefined
    const frame = window.requestAnimationFrame(() => imagePreviewCloseButtonRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [isImagePreviewOpen])

  useEffect(() => {
    imagePreviewTransformRef.current = imagePreviewTransform
  }, [imagePreviewTransform])

  useEffect(() => {
    if (!copyConfirmOpen) return undefined
    const frame = window.requestAnimationFrame(() => copyConfirmCloseButtonRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [copyConfirmOpen])

  useEffect(() => {
    if (!clickAnimationRangeOpen) return undefined
    const frame = window.requestAnimationFrame(() => clickAnimationRangeCloseButtonRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [clickAnimationRangeOpen])

  useEffect(() => {
    if (!isImagePreviewOpen && !copyConfirmOpen && !clickAnimationRangeOpen) return undefined
    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isImagePreviewOpen) {
        setIsImagePreviewOpen(false)
        setImagePreviewTransform({ scale: 1, x: 0, y: 0 })
        window.requestAnimationFrame(() => propertyThumbnailButtonRef.current?.focus({ preventScroll: true }))
        return
      }
      if (clickAnimationRangeOpen) {
        setClickAnimationRangeOpen(false)
        setClickAnimationDraft([])
        return
      }
      if (isCopying) return
      setCopyConfirmOpen(false)
      setCopyErrorKey('')
      window.requestAnimationFrame(() => copyReturnFocusRef.current?.focus({ preventScroll: true }))
    }
    window.addEventListener('keydown', handleModalKeyDown)
    return () => window.removeEventListener('keydown', handleModalKeyDown)
  }, [clickAnimationRangeOpen, copyConfirmOpen, isCopying, isImagePreviewOpen])

  useEffect(() => {
    const video = stageBackgroundVideoRef.current
    if (!video || displayedBackground?.type !== 'video' || !displayedBackground.url) return undefined

    let cancelled = false
    const playVideo = () => {
      if (cancelled) return
      video.muted = true
      video.playsInline = true
      const playPromise = video.play()
      if (playPromise) {
        playPromise.catch(() => {
          // iPad WebView may delay autoplay until the media is ready; canplay retries below.
        })
      }
    }

    video.load()
    const retryTimer = window.setTimeout(playVideo, 60)
    video.addEventListener('loadeddata', playVideo)
    video.addEventListener('canplay', playVideo)

    return () => {
      cancelled = true
      window.clearTimeout(retryTimer)
      video.removeEventListener('loadeddata', playVideo)
      video.removeEventListener('canplay', playVideo)
    }
  }, [displayedBackground?.id, displayedBackground?.type, displayedBackground?.url])

  useEffect(() => {
    const activeId = group.background?.id ?? backgrounds[0]?.id ?? ''
    setPreviewBackgroundId(activeId)

    if (
      !previewMode
      || group.backgroundPlayMode === 'fixed'
      || backgrounds.length <= 1
    ) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setPreviewBackgroundId((currentId) => {
        const currentIndex = Math.max(0, backgrounds.findIndex((background) => background.id === currentId))
        if (group.backgroundPlayMode === 'sequence') {
          return backgrounds[(currentIndex + 1) % backgrounds.length]?.id ?? activeId
        }

        let nextIndex = currentIndex
        while (nextIndex === currentIndex && backgrounds.length > 1) {
          nextIndex = Math.floor(Math.random() * backgrounds.length)
        }
        return backgrounds[nextIndex]?.id ?? activeId
      })
    }, backgroundIntervalMs)

    return () => window.clearInterval(timer)
  }, [backgroundIdsKey, backgroundIntervalMs, group.background?.id, group.backgroundPlayMode, previewMode, previewReplayId])

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined

    const updateStageSize = (contentRect?: DOMRectReadOnly) => {
      const width = contentRect?.width ?? stage.clientWidth
      const height = contentRect?.height ?? stage.clientHeight
      if (width <= 0 || height <= 0) return

      setStageSize((currentSize) => (
        Math.abs(currentSize.width - width) < 0.5
        && Math.abs(currentSize.height - height) < 0.5
          ? currentSize
          : { width, height }
      ))
    }

    updateStageSize()
    const frame = window.requestAnimationFrame(() => updateStageSize())

    if (!window.ResizeObserver) {
      const handleWindowResize = () => updateStageSize()
      window.addEventListener('resize', handleWindowResize)
      return () => {
        window.cancelAnimationFrame(frame)
        window.removeEventListener('resize', handleWindowResize)
      }
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries.find((item) => item.target === stage)
      updateStageSize(entry?.contentRect)
    })
    observer.observe(stage)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const preventNativeScrollDuringLayerDrag = (event: TouchEvent) => {
      if (layerDragRef.current?.active || backgroundDragRef.current?.active) event.preventDefault()
    }

    document.addEventListener('touchmove', preventNativeScrollDuringLayerDrag, { passive: false, capture: true })
    return () => {
      document.removeEventListener('touchmove', preventNativeScrollDuringLayerDrag, true)
    }
  }, [])

  useEffect(() => {
    if (!selectedItemId && group.items[0]) {
      setSelectedItemId(group.items[0].id)
    }
    if (selectedItemId && !group.items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(group.items[0]?.id ?? '')
    }
  }, [group.items, selectedItemId])

  useEffect(() => {
    let cancelled = false
    let clearTimer: number | undefined

    setReceiverSyncError(false)
    setReceiverSyncStatus(null)
    void syncDynamicGroupToReceiver({
      group,
      ip: wsIp,
      port: dynamicPort,
      onStatus: (status) => {
        if (!cancelled) setReceiverSyncStatus(status)
      }
    })
      .then((synced) => {
        if (cancelled || !synced) return
        setReceiverSyncStatus('complete')
        clearTimer = window.setTimeout(() => {
          setReceiverSyncStatus(null)
        }, 1600)
      })
      .catch(() => {
        if (cancelled) return
        setReceiverSyncStatus(null)
        setReceiverSyncError(true)
        clearTimer = window.setTimeout(() => {
          setReceiverSyncError(false)
        }, 2600)
      })

    return () => {
      cancelled = true
      if (clearTimer !== undefined) window.clearTimeout(clearTimer)
    }
  }, [dynamicPort, group, wsIp])

  useEffect(() => {
    setSelectedBackgroundIds((currentIds) => {
      const validIds = new Set(getBackgrounds(group).map((background) => background.id))
      return currentIds.filter((id) => validIds.has(id))
    })
  }, [group])

  useEffect(() => {
    const validItemIds = new Set(group.items.map((item) => item.id))
    setSelectedLayerItemIds((currentIds) => currentIds.filter((id) => validItemIds.has(id)))
  }, [group.items])

  useEffect(() => {
    const validMediaIds = new Set(group.items.map((item) => item.media.id))
    setItemImageSizes((currentSizes) => {
      const nextSizes = Object.fromEntries(
        Object.entries(currentSizes).filter(([mediaId]) => validMediaIds.has(mediaId))
      )
      return Object.keys(nextSizes).length === Object.keys(currentSizes).length ? currentSizes : nextSizes
    })
  }, [group.items])

  useEffect(() => {
    sendGroupStateSync(group)
  }, [appearIntervalMs, dynamicPort, group.id, wsIp])

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current !== null) {
      window.clearTimeout(copyFeedbackTimerRef.current)
    }
    if (transformPersistTimerRef.current !== null) {
      window.clearTimeout(transformPersistTimerRef.current)
      upsertDynamicGroup(latestGroupRef.current)
    }
    if (layerDragActivationTimerRef.current !== null) {
      window.clearTimeout(layerDragActivationTimerRef.current)
    }
    if (layerAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(layerAutoScrollFrameRef.current)
    }
    if (backgroundDragActivationTimerRef.current !== null) {
      window.clearTimeout(backgroundDragActivationTimerRef.current)
    }
    if (backgroundAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(backgroundAutoScrollFrameRef.current)
    }
    const listeners = layerPointerListenersRef.current
    if (listeners) {
      window.removeEventListener('pointermove', listeners.move)
      window.removeEventListener('pointerup', listeners.end)
      window.removeEventListener('pointercancel', listeners.cancel)
      layerPointerListenersRef.current = null
    }
    const backgroundListeners = backgroundPointerListenersRef.current
    if (backgroundListeners) {
      window.removeEventListener('pointermove', backgroundListeners.move)
      window.removeEventListener('pointerup', backgroundListeners.end)
      window.removeEventListener('pointercancel', backgroundListeners.cancel)
      backgroundPointerListenersRef.current = null
    }
  }, [])

  const emitTransform = (item: DynamicItem, force = false) => {
    const now = Date.now()
    const lastSentAt = lastTransformSentAtRef.current[item.id] ?? 0
    if (!force && now - lastSentAt < 90) return

    lastTransformSentAtRef.current[item.id] = now
    sendDynamicEvent(wsIp, dynamicPort, 'ItemTransform', {
      groupId: group.id,
      itemId: item.id,
      gridIndex: item.gridIndex,
      position: item.position,
      scale: item.scale,
      rotation: item.rotation
    })
  }

  const updateItemLocal = (
    itemId: string,
    updater: (item: DynamicItem) => DynamicItem,
    options: { persist?: boolean; schedulePersist?: boolean; emit?: boolean; forceEmit?: boolean } = {}
  ) => {
    const currentGroup = latestGroupRef.current
    let changedItem: DynamicItem | undefined
    const nextGroup: DynamicGroup = {
      ...currentGroup,
      items: currentGroup.items.map((item) => {
        if (item.id !== itemId) return item
        changedItem = { ...updater(item), updatedAt: Date.now() }
        return changedItem
      }),
      updatedAt: Date.now()
    }

    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)

    if (options.persist) {
      clearPendingTransformPersist()
      upsertDynamicGroup(nextGroup)
    } else if (options.schedulePersist) {
      scheduleTransformPersist()
    }
    if (changedItem && options.emit !== false) {
      emitTransform(changedItem, options.forceEmit)
    }
    return changedItem
  }

  const selectItem = (itemId: string, openTool = false) => {
    if (previewMode) return

    const shouldRefreshPropertyPreview = (openTool && (!toolOpen || selectedItemId !== itemId))
      || (!openTool && toolOpen && selectedItemId !== itemId)
    setSelectedItemId(itemId)
    if (shouldRefreshPropertyPreview) {
      setAnimationPreviewSessionId((value) => value + 1)
    }
    if (openTool) {
      setRightPanelCollapsed(false)
      setToolOpen(true)
      setBackgroundPanelOpen(false)
      setAppearPanelOpen(false)
    }
    sendDynamicEvent(wsIp, dynamicPort, 'ItemSelect', {
      groupId: group.id,
      itemId
    })
  }

  const nextPreviewReplayId = () => {
    const nextId = previewReplayIdRef.current + 1
    previewReplayIdRef.current = nextId
    setPreviewReplayId(nextId)
    return nextId
  }

  const buildResolvedAnimationIds = (replayId: number, nextGroup = latestGroupRef.current) => (
    Object.fromEntries(nextGroup.items.map((item) => [
      item.id,
      getResolvedPreviewAnimationId(item, nextGroup.id, replayId)
    ]))
  )

  const sendPreviewModeState = (
    enabled: boolean,
    options: {
      appearMode?: DynamicAppearMode
      intervalMs?: number
      backgroundPlayMode?: DynamicBackgroundPlayMode
      backgroundIntervalMs?: number
      replayId?: number
    } = {}
  ) => {
    sendDynamicEvent(wsIp, dynamicPort, 'PreviewMode', {
      groupId: group.id,
      enabled,
      appearMode: options.appearMode ?? group.appearMode,
      intervalMs: options.intervalMs ?? appearIntervalMs,
      backgroundPlayMode: options.backgroundPlayMode ?? group.backgroundPlayMode,
      backgroundIntervalMs: options.backgroundIntervalMs ?? backgroundIntervalMs,
      replayId: options.replayId ?? previewReplayIdRef.current,
      resolvedAnimationIds: buildResolvedAnimationIds(options.replayId ?? previewReplayIdRef.current)
    })
  }

  const restartPreviewPlayback = (appearMode = group.appearMode, intervalMs = appearIntervalMs) => {
    const replayId = nextPreviewReplayId()
    sendPreviewModeState(true, {
      appearMode,
      intervalMs,
      replayId
    })
  }

  const setPreviewModeEnabled = (enabled: boolean) => {
    if (enabled) {
      if (previewMode) return
      previewPanelSnapshotRef.current = {
        mode: rightPanelCollapsed
          ? 'collapsed'
          : toolOpen && selectedItem
            ? 'object'
            : 'layers',
        activeTab,
        selectedItemId
      }
      const replayId = nextPreviewReplayId()
      setPreviewMode(true)
      setToolOpen(false)
      setBackgroundPanelOpen(false)
      setAppearPanelOpen(false)
      setCopyConfirmOpen(false)
      setClickAnimationRangeOpen(false)
      setClickAnimationDraft([])
      setIsImagePreviewOpen(false)
      setManipulatingItemId('')
      sendPreviewModeState(true, { replayId })
      return
    }

    if (!previewMode) return
    const replayId = previewReplayIdRef.current
    const snapshot = previewPanelSnapshotRef.current
    setPreviewMode(false)
    setActiveTab(snapshot?.activeTab ?? 'motion')
    setSelectedItemId(snapshot?.selectedItemId ?? selectedItemId)
    setRightPanelCollapsed(snapshot?.mode === 'collapsed')
    setToolOpen(snapshot?.mode === 'object')
    setBackgroundPanelOpen(false)
    setAppearPanelOpen(false)
    previewPanelSnapshotRef.current = null
    sendPreviewModeState(false, { replayId })
  }

  const resolveStageItemIdAtPoint = (clientPoint: Point) => {
    const stage = stageRef.current
    if (!stage) return ''

    const stageRect = stage.getBoundingClientRect()
    if (stageRect.width <= 0 || stageRect.height <= 0) return ''

    const itemsByHitPriority = [...latestGroupRef.current.items]
      .sort((first, second) => second.order - first.order)
    const selectedIndex = itemsByHitPriority.findIndex((item) => item.id === selectedItemId)
    if (selectedIndex > 0) {
      const [selected] = itemsByHitPriority.splice(selectedIndex, 1)
      itemsByHitPriority.unshift(selected)
    }

    const measuredStageSize = { width: stageRect.width, height: stageRect.height }
    const matchedItem = itemsByHitPriority.find((item) => isPointInsideDynamicItem(
      item,
      getDynamicItemPreviewSize(item, itemImageSizes[item.media.id], measuredStageSize),
      stageRect,
      clientPoint
    ))

    return matchedItem?.id ?? ''
  }

  const handleStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (previewMode) {
      event.preventDefault()
      return
    }

    const isFirstPointer = pointersRef.current.size === 0
    const itemId = isFirstPointer
      ? resolveStageItemIdAtPoint({ x: event.clientX, y: event.clientY })
      : gestureItemIdRef.current ?? ''
    if (!itemId) {
      if (isFirstPointer) {
        setToolOpen(false)
        setBackgroundPanelOpen(false)
        setAppearPanelOpen(false)
        setRightPanelCollapsed(false)
      }
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    if (isFirstPointer) {
      gestureMovedRef.current = false
      selectItem(itemId, false)
    }

    gestureItemIdRef.current = itemId
    const point = { x: event.clientX, y: event.clientY }
    pointersRef.current.set(event.pointerId, point)

    const item = latestGroupRef.current.items.find((nextItem) => nextItem.id === itemId)
    if (!item) return
    setManipulatingItemId(itemId)

    if (pointersRef.current.size === 1) {
      gestureModeRef.current = 'drag'
      dragStartRef.current = { point, position: item.position }
      pinchStartRef.current = null
      return
    }

    if (pointersRef.current.size >= 2) {
      gestureMovedRef.current = true
      const [firstPoint, secondPoint] = Array.from(pointersRef.current.values())
      gestureModeRef.current = 'pinch'
      pinchStartRef.current = {
        distance: Math.max(getDistance(firstPoint, secondPoint), 1),
        angle: getAngle(firstPoint, secondPoint),
        scale: item.scale,
        rotation: item.rotation
      }
      dragStartRef.current = null
    }
  }

  const handleStagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const itemId = gestureItemIdRef.current
    const stage = stageRef.current
    if (!itemId || !stage || !pointersRef.current.has(event.pointerId)) return

    event.preventDefault()
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (gestureModeRef.current === 'drag' && dragStartRef.current && pointersRef.current.size === 1) {
      if (Math.hypot(
        event.clientX - dragStartRef.current.point.x,
        event.clientY - dragStartRef.current.point.y
      ) > 8) {
        gestureMovedRef.current = true
      }
      const rect = stage.getBoundingClientRect()
      const dx = (event.clientX - dragStartRef.current.point.x) / rect.width
      const dy = (event.clientY - dragStartRef.current.point.y) / rect.height
      let nextTrackForMotion: DynamicMoveTrack | null = null
      const changedItem = updateItemLocal(itemId, (item) => {
        const position = {
          x: clamp(dragStartRef.current!.position.x + dx, 0, 1),
          y: clamp(dragStartRef.current!.position.y + dy, 0, 1)
        }
        const moveTrack = getTrack(position.y)
        if (moveTrack !== getItemTrack(item)) {
          nextTrackForMotion = moveTrack
        }
        return {
          ...item,
          position,
          moveTrack,
          gridIndex: calculateGridIndex(position.x, position.y)
        }
      }, { schedulePersist: true })
      if (changedItem && nextTrackForMotion) {
        sendDynamicEvent(wsIp, dynamicPort, 'ItemMotion', {
          groupId: group.id,
          itemId: changedItem.id,
          mode: changedItem.moveMode,
          percent: changedItem.movePercent,
          speed: getItemMoveSpeed(changedItem),
          track: nextTrackForMotion
        })
      }
      return
    }

    if (gestureModeRef.current === 'pinch' && pinchStartRef.current && pointersRef.current.size >= 2) {
      gestureMovedRef.current = true
      const [firstPoint, secondPoint] = Array.from(pointersRef.current.values())
      const nextDistance = Math.max(getDistance(firstPoint, secondPoint), 1)
      const nextAngle = getAngle(firstPoint, secondPoint)
      updateItemLocal(itemId, (item) => ({
        ...item,
        scale: clamp(pinchStartRef.current!.scale * (nextDistance / pinchStartRef.current!.distance), MIN_ITEM_SCALE, MAX_ITEM_SCALE),
        rotation: normalizeRotation(pinchStartRef.current!.rotation + nextAngle - pinchStartRef.current!.angle)
      }), { schedulePersist: true })
    }
  }

  const handleStagePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const itemIdAtEnd = gestureItemIdRef.current
    const shouldOpenTool = Boolean(
      itemIdAtEnd
      && pointersRef.current.size === 1
      && gestureModeRef.current === 'drag'
      && !gestureMovedRef.current
    )

    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.delete(event.pointerId)
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture can already be released by iPad WebView.
    }

    if (pointersRef.current.size === 0) {
      const itemId = gestureItemIdRef.current
      if (itemId) {
        const item = latestGroupRef.current.items.find((nextItem) => nextItem.id === itemId)
        if (item) emitTransform(item, true)
      }
      flushPendingTransformPersist()
      gestureModeRef.current = 'none'
      gestureItemIdRef.current = null
      dragStartRef.current = null
      pinchStartRef.current = null
      setManipulatingItemId('')
      gestureMovedRef.current = false
      if (shouldOpenTool && itemIdAtEnd) {
        selectItem(itemIdAtEnd, true)
      }
      return
    }

    if (pointersRef.current.size === 1) {
      const [remainingPoint] = Array.from(pointersRef.current.values())
      const item = latestGroupRef.current.items.find((nextItem) => nextItem.id === gestureItemIdRef.current)
      if (item) {
        gestureModeRef.current = 'drag'
        dragStartRef.current = {
          point: remainingPoint,
          position: item.position
        }
      }
      pinchStartRef.current = null
    }
  }

  const setAppearMode = (appearMode: DynamicAppearMode) => {
    const updatedGroup = updateDynamicGroupAppearMode(group.id, appearMode, appearIntervalMs)
    if (!updatedGroup) return

    const nextGroup = {
      ...group,
      appearMode,
      appearIntervalMs: updatedGroup.appearIntervalMs,
      updatedAt: updatedGroup.updatedAt
    }
    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
    sendDynamicEvent(wsIp, dynamicPort, 'GroupAppearMode', {
      groupId: group.id,
      mode: appearMode,
      intervalMs: updatedGroup.appearIntervalMs
    })

    if (previewMode) {
      restartPreviewPlayback(appearMode, updatedGroup.appearIntervalMs)
    }
  }

  const setAppearInterval = (value: number) => {
    const nextInterval = clamp(value, MIN_DYNAMIC_APPEAR_INTERVAL_MS, MAX_DYNAMIC_APPEAR_INTERVAL_MS)
    const updatedGroup = updateDynamicGroupAppearMode(group.id, group.appearMode, nextInterval)
    if (!updatedGroup) return

    const nextGroup = {
      ...group,
      appearIntervalMs: updatedGroup.appearIntervalMs,
      updatedAt: updatedGroup.updatedAt
    }
    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
    sendDynamicEvent(wsIp, dynamicPort, 'GroupAppearMode', {
      groupId: group.id,
      mode: group.appearMode,
      intervalMs: updatedGroup.appearIntervalMs
    })
  }

  const handleBackgroundChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const nextGroup = await setDynamicBackground(group.id, file)
    if (!nextGroup?.background) return

    uploadUnityAsset({
      ip: wsIp,
      port: dynamicPort,
      file,
      fields: {
        role: 'background',
        groupId: group.id,
        assetId: nextGroup.background.id,
        mediaType: nextGroup.background.type,
        mimeType: nextGroup.background.mimeType
      }
    })
    sendDynamicEvent(wsIp, dynamicPort, 'BackgroundSet', {
      groupId: group.id,
      assetId: nextGroup.background.id,
      name: nextGroup.background.name,
      mediaType: nextGroup.background.type,
      mimeType: nextGroup.background.mimeType
    })
    onGroupChange(nextGroup)
    setToolOpen(false)
    setBackgroundPanelOpen(true)
    setRightPanelCollapsed(false)
    setAppearPanelOpen(false)
    event.target.value = ''
  }

  const handleLayerItemChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || isAddingLayerItem) return

    const currentGroup = latestGroupRef.current
    if (currentGroup.items.length >= MAX_DYNAMIC_ITEMS_PER_GROUP) {
      window.alert(t('items.limitReached'))
      return
    }

    setIsAddingLayerItem(true)
    try {
      flushPendingTransformPersist()
      const nextGroup = await addDynamicItem(currentGroup.id, file, file.name)
      if (!nextGroup) return

      const previousItemIds = new Set(currentGroup.items.map((item) => item.id))
      const createdItem = nextGroup.items.find((item) => !previousItemIds.has(item.id))
        ?? nextGroup.items[nextGroup.items.length - 1]
      if (!createdItem) return

      uploadUnityAsset({
        ip: wsIp,
        port: dynamicPort,
        file,
        fields: {
          role: 'item',
          groupId: nextGroup.id,
          itemId: createdItem.id,
          assetId: createdItem.media.id,
          mediaType: createdItem.media.type,
          mimeType: createdItem.media.mimeType
        }
      })
      sendDynamicEvent(wsIp, dynamicPort, 'ItemCreate', {
        groupId: nextGroup.id,
        itemId: createdItem.id,
        assetId: createdItem.media.id,
        name: createdItem.name,
        order: createdItem.order,
        gridIndex: createdItem.gridIndex
      })

      latestGroupRef.current = nextGroup
      onGroupChange(nextGroup)
      setSelectedItemId(createdItem.id)
      setToolOpen(false)
      setBackgroundPanelOpen(false)
      setRightPanelCollapsed(false)
      setAppearPanelOpen(false)
    } finally {
      setIsAddingLayerItem(false)
    }
  }

  const markItemMediaReady = useCallback((mediaId: string) => {
    setReadyItemMediaIds((currentIds) => (
      currentIds[mediaId]
        ? currentIds
        : { ...currentIds, [mediaId]: true }
    ))
  }, [])

  const handleItemImageLoad = useCallback((mediaId: string, image: HTMLImageElement) => {
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (width <= 0 || height <= 0) return

    setItemImageSizes((currentSizes) => {
      const currentSize = currentSizes[mediaId]
      if (currentSize?.width === width && currentSize.height === height) return currentSizes
      return {
        ...currentSizes,
        [mediaId]: { width, height }
      }
    })

    const loadedSrc = image.currentSrc || image.src
    if (image.dataset.dynamicDecodedSrc === loadedSrc) {
      markItemMediaReady(mediaId)
      return
    }
    if (image.dataset.dynamicDecodePending === loadedSrc) return

    image.dataset.dynamicDecodePending = loadedSrc
    const finishDecode = () => {
      if ((image.currentSrc || image.src) !== loadedSrc) return
      image.dataset.dynamicDecodedSrc = loadedSrc
      delete image.dataset.dynamicDecodePending
      markItemMediaReady(mediaId)
    }

    const decodePromise = typeof image.decode === 'function'
      ? image.decode().catch(() => undefined)
      : Promise.resolve()
    void Promise.race([
      decodePromise,
      new Promise<void>((resolve) => window.setTimeout(resolve, 800))
    ]).then(finishDecode)
  }, [markItemMediaReady])

  const handleItemImageError = useCallback((mediaId: string) => {
    markItemMediaReady(mediaId)
  }, [markItemMediaReady])

  const handleBackgroundSelect = async (backgroundId: string) => {
    const nextGroup = await setActiveDynamicBackground(group.id, backgroundId)
    if (!nextGroup) return

    onGroupChange(nextGroup)
    const backgroundPayload = toBackgroundPayload(nextGroup.background)
    if (backgroundPayload) {
      sendDynamicEvent(wsIp, dynamicPort, 'BackgroundSet', {
        groupId: group.id,
        ...backgroundPayload
      })
    }
  }

  const toggleBackgroundSelection = (backgroundId: string) => {
    setSelectedBackgroundIds((currentIds) => (
      currentIds.includes(backgroundId)
        ? currentIds.filter((id) => id !== backgroundId)
        : [...currentIds, backgroundId]
    ))
  }

  const toggleAllBackgroundSelection = () => {
    setSelectedBackgroundIds(allBackgroundsSelected ? [] : backgrounds.map((background) => background.id))
  }

  const setBackgroundPlayback = (
    backgroundPlayMode: DynamicBackgroundPlayMode,
    intervalMs = backgroundIntervalMs
  ) => {
    const updatedGroup = updateDynamicBackgroundPlayback(group.id, backgroundPlayMode, intervalMs)
    if (!updatedGroup) return

    const nextGroup: DynamicGroup = {
      ...latestGroupRef.current,
      backgroundPlayMode: updatedGroup.backgroundPlayMode,
      backgroundIntervalMs: updatedGroup.backgroundIntervalMs,
      updatedAt: updatedGroup.updatedAt
    }
    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
    sendDynamicEvent(wsIp, dynamicPort, 'BackgroundPlayback', {
      groupId: group.id,
      mode: nextGroup.backgroundPlayMode,
      intervalMs: nextGroup.backgroundIntervalMs
    })
  }

  const commitBackgroundIntervalDraft = (displayValue?: number) => {
    const draftValue = displayValue ?? Number(backgroundIntervalDraft)
    if (!Number.isFinite(draftValue) || draftValue <= 0) {
      setBackgroundIntervalDraft(formatBackgroundInterval(backgroundIntervalMs, backgroundIntervalUnit))
      return
    }

    const multiplier = backgroundIntervalUnit === 'minutes' ? 60000 : 1000
    const nextIntervalMs = clamp(
      Math.round(draftValue * multiplier),
      MIN_DYNAMIC_BACKGROUND_INTERVAL_MS,
      MAX_DYNAMIC_BACKGROUND_INTERVAL_MS
    )
    setBackgroundIntervalDraft(formatBackgroundInterval(nextIntervalMs, backgroundIntervalUnit))
    if (nextIntervalMs !== backgroundIntervalMs) {
      setBackgroundPlayback(group.backgroundPlayMode, nextIntervalMs)
    }
  }

  const handleBackgroundIntervalWheelChange = (displayValue: number) => {
    const multiplier = backgroundIntervalUnit === 'minutes' ? 60000 : 1000
    const nextIntervalMs = clamp(
      Math.round(displayValue * multiplier),
      MIN_DYNAMIC_BACKGROUND_INTERVAL_MS,
      MAX_DYNAMIC_BACKGROUND_INTERVAL_MS
    )
    setBackgroundIntervalDraft(formatBackgroundInterval(nextIntervalMs, backgroundIntervalUnit))
  }

  const handleBackgroundIntervalUnitChange = (unit: BackgroundIntervalUnit) => {
    const draftValue = Number(backgroundIntervalDraft)
    const currentMultiplier = backgroundIntervalUnit === 'minutes' ? 60000 : 1000
    const draftIntervalMs = Number.isFinite(draftValue) && draftValue > 0
      ? clamp(
          Math.round(draftValue * currentMultiplier),
          MIN_DYNAMIC_BACKGROUND_INTERVAL_MS,
          MAX_DYNAMIC_BACKGROUND_INTERVAL_MS
        )
      : backgroundIntervalMs
    setBackgroundIntervalUnit(unit)
    setBackgroundIntervalDraft(formatBackgroundInterval(draftIntervalMs, unit))
  }

  const openBackgroundEditor = () => {
    const intervalUnit = getBackgroundIntervalUnit(backgroundIntervalMs)
    setBackgroundIntervalUnit(intervalUnit)
    setBackgroundIntervalDraft(formatBackgroundInterval(backgroundIntervalMs, intervalUnit))
    setToolOpen(false)
    setAppearPanelOpen(false)
    setBackgroundPanelOpen(true)
  }

  const closeBackgroundEditor = () => {
    setBackgroundPanelOpen(false)
    setSelectedBackgroundIds([])
  }

  const handleBackgroundDelete = async () => {
    if (selectedBackgroundIds.length === 0) return

    const confirmed = window.confirm(t('control.confirmDeleteBackgrounds'))
    if (!confirmed) return

    const previousActiveId = group.background?.id
    const nextGroup = await deleteDynamicBackgrounds(group.id, selectedBackgroundIds)
    if (!nextGroup) return

    sendDynamicEvent(wsIp, dynamicPort, 'BackgroundDelete', {
      groupId: group.id,
      assetIds: selectedBackgroundIds,
      nextActiveAssetId: nextGroup.background?.id ?? null
    })

    if (previousActiveId !== nextGroup.background?.id && nextGroup.background) {
      const backgroundPayload = toBackgroundPayload(nextGroup.background)
      if (backgroundPayload) {
        sendDynamicEvent(wsIp, dynamicPort, 'BackgroundSet', {
          groupId: group.id,
          ...backgroundPayload
        })
      }
    }

    setSelectedBackgroundIds([])
    onGroupChange(nextGroup)
  }

  const handleMoveTrackChange = (moveTrack: DynamicMoveTrack) => {
    if (!selectedItem) return
    if (activeTrack === moveTrack) return

    const nextY = getDynamicMoveTrackCenter(moveTrack)
    updateItemLocal(selectedItem.id, (item) => {
      const position = {
        x: item.position.x,
        y: nextY
      }
      return {
        ...item,
        position,
        moveTrack,
        gridIndex: calculateGridIndex(position.x, position.y)
      }
    }, { persist: true, forceEmit: true })
    sendDynamicEvent(wsIp, dynamicPort, 'ItemMotion', {
      groupId: group.id,
      itemId: selectedItem.id,
      mode: selectedItem.moveMode,
      percent: selectedItem.movePercent,
      speed: selectedMoveSpeed,
      track: moveTrack
    })
  }

  const handleItemDelete = async (itemId: string) => {
    const confirmed = window.confirm(t('items.confirmDelete'))
    if (!confirmed) return

    const nextGroup = await deleteDynamicItem(group.id, itemId)
    if (!nextGroup) return

    sendDynamicEvent(wsIp, dynamicPort, 'ItemDelete', {
      groupId: group.id,
      itemId
    })
    onGroupChange(nextGroup)
    if (selectedItemId === itemId) {
      setSelectedItemId(nextGroup.items[0]?.id ?? '')
      setToolOpen(false)
      setRightPanelCollapsed(false)
    }
  }

  const toggleLayerSelection = (itemId: string) => {
    setSelectedLayerItemIds((currentIds) => (
      currentIds.includes(itemId)
        ? currentIds.filter((id) => id !== itemId)
        : [...currentIds, itemId]
    ))
  }

  const toggleAllLayerSelection = () => {
    setSelectedLayerItemIds(allLayersSelected ? [] : group.items.map((item) => item.id))
  }

  const handleLayerBulkDelete = async () => {
    if (selectedLayerItemIds.length === 0) return

    const confirmed = window.confirm(t('control.confirmDeleteObjects', { count: selectedLayerItemIds.length }))
    if (!confirmed) return

    const deletedIds = [...selectedLayerItemIds]
    const nextGroup = await deleteDynamicItems(group.id, deletedIds)
    if (!nextGroup) return

    deletedIds.forEach((itemId) => {
      sendDynamicEvent(wsIp, dynamicPort, 'ItemDelete', {
        groupId: group.id,
        itemId
      })
    })
    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
    sendGroupStateSync(nextGroup)
    setSelectedLayerItemIds([])

    if (deletedIds.includes(selectedItemId)) {
      setSelectedItemId(nextGroup.items[0]?.id ?? '')
      setToolOpen(false)
      setRightPanelCollapsed(false)
    }
  }

  const handleMotionChange = (moveMode: DynamicMoveMode) => {
    if (!selectedItem) return

    updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      moveMode
    }), { persist: true, emit: false })
    sendDynamicEvent(wsIp, dynamicPort, 'ItemMotion', {
      groupId: group.id,
      itemId: selectedItem.id,
      mode: moveMode,
      percent: selectedItem.movePercent,
      speed: selectedMoveSpeed,
      track: activeTrack
    })
  }

  const handleMotionPercentChange = (value: number) => {
    if (!selectedItem) return

    updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      movePercent: value
    }), { persist: true, emit: false })
    sendDynamicEvent(wsIp, dynamicPort, 'ItemMotion', {
      groupId: group.id,
      itemId: selectedItem.id,
      mode: selectedItem.moveMode,
      percent: value,
      speed: selectedMoveSpeed,
      track: activeTrack
    })
  }

  const handleMotionSpeedChange = (value: number) => {
    if (!selectedItem) return

    const moveSpeed = clamp(value, 0, 100)
    updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      moveSpeed
    }), { persist: true, emit: false })
    sendDynamicEvent(wsIp, dynamicPort, 'ItemMotion', {
      groupId: group.id,
      itemId: selectedItem.id,
      mode: selectedItem.moveMode,
      percent: selectedItem.movePercent,
      speed: moveSpeed,
      track: activeTrack
    })
  }

  const sendItemAnimationState = (item: DynamicItem) => {
    sendDynamicEvent(wsIp, dynamicPort, 'ItemAnimation', {
      groupId: group.id,
      itemId: item.id,
      animationMode: getDynamicAnimationMode(item),
      animationId: item.animationId,
      clickAnimationIds: getDynamicClickAnimationIds(item)
    })
  }

  const handleAnimationSelect = (animationId: number) => {
    if (!selectedItem) return

    setAnimationCursor(animationId)
    setAnimationPreviewSessionId((value) => value + 1)
    const changedItem = updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      animationMode: 'fixed',
      animationId
    }), { persist: true, emit: false })
    if (changedItem) sendItemAnimationState(changedItem)
  }

  const handleAnimationModeSelect = (animationMode: DynamicAnimationMode) => {
    if (!selectedItem) return

    setAnimationPreviewSessionId((value) => value + 1)
    const changedItem = updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      animationMode,
      animationId: animationMode === 'none' ? 0 : item.animationId
    }), { persist: true, emit: false })
    if (changedItem) sendItemAnimationState(changedItem)
  }

  const moveAnimationCursor = (offset: -1 | 1) => {
    const currentIndex = DYNAMIC_ANIMATION_IDS.indexOf(animationCursor)
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + offset + DYNAMIC_ANIMATION_IDS.length) % DYNAMIC_ANIMATION_IDS.length
    handleAnimationSelect(DYNAMIC_ANIMATION_IDS[nextIndex])
  }

  const handleAnimationSwipeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    animationSwipeStartRef.current = { pointerId: event.pointerId, x: event.clientX }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleAnimationSwipeEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = animationSwipeStartRef.current
    animationSwipeStartRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!start || start.pointerId !== event.pointerId) return
    const distance = event.clientX - start.x
    if (Math.abs(distance) < ANIMATION_SWIPE_THRESHOLD) return
    moveAnimationCursor(distance < 0 ? 1 : -1)
  }

  const openClickAnimationRange = () => {
    if (!selectedItem) return
    setClickAnimationDraft(getDynamicClickAnimationIds(selectedItem))
    setClickAnimationRangeOpen(true)
  }

  const closeClickAnimationRange = () => {
    setClickAnimationRangeOpen(false)
    setClickAnimationDraft([])
  }

  const toggleClickAnimationDraft = (animationId: number) => {
    setClickAnimationDraft((currentIds) => (
      currentIds.includes(animationId)
        ? currentIds.filter((id) => id !== animationId)
        : [...currentIds, animationId].sort((first, second) => first - second)
    ))
  }

  const confirmClickAnimationRange = () => {
    if (!selectedItem || clickAnimationDraft.length === 0) return
    const changedItem = updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      clickAnimationIds: [...clickAnimationDraft]
    }), { persist: true, emit: false })
    if (changedItem) sendItemAnimationState(changedItem)
    closeClickAnimationRange()
  }

  const setConstrainedImagePreviewTransform = (nextTransform: ImagePreviewTransform) => {
    const viewport = imagePreviewViewportRef.current
    const scale = clamp(nextTransform.scale, 1, MAX_IMAGE_PREVIEW_SCALE)
    const maxX = viewport ? viewport.clientWidth * (scale - 1) / 2 : 0
    const maxY = viewport ? viewport.clientHeight * (scale - 1) / 2 : 0
    const constrained = {
      scale,
      x: scale === 1 ? 0 : clamp(nextTransform.x, -maxX, maxX),
      y: scale === 1 ? 0 : clamp(nextTransform.y, -maxY, maxY)
    }
    imagePreviewTransformRef.current = constrained
    setImagePreviewTransform(constrained)
  }

  const resetImagePreview = () => {
    imagePreviewPointersRef.current.clear()
    imagePreviewGestureRef.current = null
    setConstrainedImagePreviewTransform({ scale: 1, x: 0, y: 0 })
  }

  const openImagePreview = () => {
    if (!selectedItem) return
    resetImagePreview()
    setIsImagePreviewOpen(true)
  }

  const closeImagePreview = () => {
    setIsImagePreviewOpen(false)
    resetImagePreview()
    window.requestAnimationFrame(() => propertyThumbnailButtonRef.current?.focus({ preventScroll: true }))
  }

  const handleImagePreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    imagePreviewPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const points = [...imagePreviewPointersRef.current.values()]
    const currentTransform = imagePreviewTransformRef.current
    if (points.length >= 2) {
      imagePreviewGestureRef.current = {
        mode: 'pinch',
        startTransform: currentTransform,
        startCenter: {
          x: (points[0].x + points[1].x) / 2,
          y: (points[0].y + points[1].y) / 2
        },
        startDistance: Math.max(1, getDistance(points[0], points[1]))
      }
      return
    }

    imagePreviewGestureRef.current = {
      mode: 'pan',
      startTransform: currentTransform,
      startPoint: points[0]
    }
  }

  const handleImagePreviewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imagePreviewPointersRef.current.has(event.pointerId)) return
    imagePreviewPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const gesture = imagePreviewGestureRef.current
    const points = [...imagePreviewPointersRef.current.values()]
    if (!gesture || points.length === 0) return

    if (gesture.mode === 'pinch' && points.length >= 2 && gesture.startCenter && gesture.startDistance) {
      const center = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2
      }
      const scale = gesture.startTransform.scale * getDistance(points[0], points[1]) / gesture.startDistance
      setConstrainedImagePreviewTransform({
        scale,
        x: gesture.startTransform.x + center.x - gesture.startCenter.x,
        y: gesture.startTransform.y + center.y - gesture.startCenter.y
      })
      return
    }

    if (gesture.mode === 'pan' && points.length === 1 && gesture.startPoint) {
      setConstrainedImagePreviewTransform({
        scale: gesture.startTransform.scale,
        x: gesture.startTransform.x + points[0].x - gesture.startPoint.x,
        y: gesture.startTransform.y + points[0].y - gesture.startPoint.y
      })
    }
  }

  const handleImagePreviewPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    imagePreviewPointersRef.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const points = [...imagePreviewPointersRef.current.values()]
    if (points.length === 1) {
      imagePreviewGestureRef.current = {
        mode: 'pan',
        startTransform: imagePreviewTransformRef.current,
        startPoint: points[0]
      }
    } else {
      imagePreviewGestureRef.current = null
    }
  }

  const handleImagePreviewWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const current = imagePreviewTransformRef.current
    setConstrainedImagePreviewTransform({
      ...current,
      scale: current.scale + (event.deltaY < 0 ? 0.25 : -0.25)
    })
  }

  const startItemNameEdit = () => {
    if (!selectedItem || isSavingItemName) return
    setItemNameDraft(selectedItem.name)
    setItemNameErrorKey('')
    setIsEditingItemName(true)
  }

  const cancelItemNameEdit = () => {
    setItemNameDraft(selectedItem?.name ?? '')
    setItemNameErrorKey('')
    setIsEditingItemName(false)
  }

  const saveItemName = async () => {
    if (!selectedItem || isSavingItemName) return
    const nextName = itemNameDraft.trim()
    if (!nextName) {
      setItemNameErrorKey('control.nameRequired')
      propertyNameInputRef.current?.focus({ preventScroll: true })
      return
    }
    if (nextName === selectedItem.name) {
      cancelItemNameEdit()
      return
    }

    setIsSavingItemName(true)
    setItemNameErrorKey('')
    try {
      clearPendingTransformPersist()
      upsertDynamicGroup(latestGroupRef.current)
      const nextGroup = await updateDynamicItemMeta(group.id, selectedItem.id, { name: nextName })
      const updatedItem = nextGroup?.items.find((item) => item.id === selectedItem.id)
      if (!nextGroup || !updatedItem) {
        setItemNameErrorKey('control.nameSaveFailed')
        return
      }

      latestGroupRef.current = nextGroup
      onGroupChange(nextGroup)
      sendDynamicEvent(wsIp, dynamicPort, 'ItemUpdate', {
        groupId: group.id,
        itemId: updatedItem.id,
        assetId: updatedItem.media.id,
        name: updatedItem.name,
        mediaType: updatedItem.media.type,
        mimeType: updatedItem.media.mimeType,
        replacedAsset: false
      })
      setItemNameDraft(updatedItem.name)
      setIsEditingItemName(false)
      playUiSound('success')
    } catch {
      setItemNameErrorKey('control.nameSaveFailed')
    } finally {
      setIsSavingItemName(false)
    }
  }

  const toggleCopyField = (field: DynamicCopyField) => {
    setSelectedCopyFields((currentFields) => (
      currentFields.includes(field)
        ? currentFields.filter((currentField) => currentField !== field)
        : [...currentFields, field]
    ))
  }

  const openCopyConfirm = (sourceItemId: string, trigger: HTMLButtonElement) => {
    if (!selectedItem || sourceItemId === selectedItem.id) return
    copyReturnFocusRef.current = trigger
    setCopiedSourceItemId(sourceItemId)
    setSelectedCopyFields([...ALL_COPY_FIELDS])
    setCopyErrorKey('')
    setCopyConfirmOpen(true)
  }

  const closeCopyConfirm = () => {
    if (isCopying) return
    setCopyConfirmOpen(false)
    setCopyErrorKey('')
    window.requestAnimationFrame(() => copyReturnFocusRef.current?.focus({ preventScroll: true }))
  }

  const handleCopyConfirm = async () => {
    if (!selectedItem || !copySourceItem || selectedCopyFields.length === 0 || isCopying) return

    const targetItemId = selectedItem.id
    const sourceItemId = copySourceItem.id
    const copyFields = [...selectedCopyFields]
    setIsCopying(true)
    setCopyErrorKey('')
    try {
      const nextGroup = await copyDynamicItemSettings(
        group.id,
        targetItemId,
        sourceItemId,
        copyFields,
        latestGroupRef.current
      )
      if (!nextGroup) {
        setCopyErrorKey('control.copySourceMissing')
        return
      }

      latestGroupRef.current = nextGroup
      onGroupChange(nextGroup)
      const protocolFields = copyFields.flatMap((field) => {
        if (field === 'motion') return ['moveMode', 'movePercent', 'moveSpeed', 'moveTrack']
        if (field === 'animation') return ['animationMode', 'animationId', 'clickAnimationIds']
        if (field === 'size') return ['scale', 'rotation']
        return ['flipX', 'flipY']
      })
      sendDynamicEvent(wsIp, dynamicPort, 'ItemSettingsCopy', {
        groupId: group.id,
        targetItemId,
        sourceItemId,
        copyFields,
        fields: protocolFields
      })
      const copiedItem = nextGroup.items.find((item) => item.id === targetItemId)
      if (copiedItem) {
        if (copyFields.includes('motion') || copyFields.includes('size')) {
          emitTransform(copiedItem, true)
        }
        if (copyFields.includes('deform')) {
          sendDynamicEvent(wsIp, dynamicPort, 'ItemDeform', {
            groupId: group.id,
            itemId: copiedItem.id,
            flipX: getItemFlipX(copiedItem),
            flipY: getItemFlipY(copiedItem)
          })
        }
        if (copyFields.includes('motion')) {
          sendDynamicEvent(wsIp, dynamicPort, 'ItemMotion', {
            groupId: group.id,
            itemId: copiedItem.id,
            mode: copiedItem.moveMode,
            percent: copiedItem.movePercent,
            speed: getItemMoveSpeed(copiedItem),
            track: getItemTrack(copiedItem)
          })
        }
        if (copyFields.includes('animation')) {
          sendDynamicEvent(wsIp, dynamicPort, 'ItemAnimation', {
            groupId: group.id,
            itemId: copiedItem.id,
            animationMode: getDynamicAnimationMode(copiedItem),
            animationId: copiedItem.animationId,
            clickAnimationIds: getDynamicClickAnimationIds(copiedItem)
          })
        }
      }

      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current)
      }
      setCopyConfirmOpen(false)
      setCopyFeedbackItemId(targetItemId)
      playUiSound('success')

      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopyFeedbackItemId('')
        copyFeedbackTimerRef.current = null
      }, 1400)
    } catch {
      setCopyErrorKey('control.copyFailed')
    } finally {
      setIsCopying(false)
    }
  }

  const handleScaleNudge = (delta: number) => {
    if (!selectedItem) return
    updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      scale: clamp(Math.round((item.scale + delta) * 10) / 10, MIN_ITEM_SCALE, MAX_ITEM_SCALE)
    }), { persist: true, forceEmit: true })
  }

  const handleRotationNudge = (delta: number) => {
    if (!selectedItem) return
    updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      rotation: normalizeRotation(item.rotation + delta)
    }), { persist: true, forceEmit: true })
  }

  const handleScaleSliderChange = (value: number) => {
    if (!selectedItem) return
    updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      scale: clamp(value / 100, MIN_ITEM_SCALE, MAX_ITEM_SCALE)
    }), { schedulePersist: true })
  }

  const handleRotationSliderChange = (value: number) => {
    if (!selectedItem) return
    updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      rotation: normalizeRotation(value)
    }), { schedulePersist: true })
  }

  const handleDeformChange = (axis: 'x' | 'y', value: boolean) => {
    if (!selectedItem) return

    const changedItem = updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      flipX: axis === 'x' ? value : getItemFlipX(item),
      flipY: axis === 'y' ? value : getItemFlipY(item)
    }), { persist: true, emit: false })

    sendDynamicEvent(wsIp, dynamicPort, 'ItemDeform', {
      groupId: group.id,
      itemId: selectedItem.id,
      flipX: changedItem ? getItemFlipX(changedItem) : axis === 'x' ? value : getItemFlipX(selectedItem),
      flipY: changedItem ? getItemFlipY(changedItem) : axis === 'y' ? value : getItemFlipY(selectedItem)
    })
  }

  const applyLayerOrderLocally = (orderedIds: string[]) => {
    const orderById = new Map(
      orderedIds.map((itemId, index) => [itemId, orderedIds.length - 1 - index])
    )
    const currentGroup = latestGroupRef.current
    const nextGroup: DynamicGroup = {
      ...currentGroup,
      items: currentGroup.items.map((item) => ({
        ...item,
        order: orderById.get(item.id) ?? item.order
      })),
      updatedAt: Date.now()
    }
    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
  }

  const clearLayerDragActivationTimer = () => {
    if (layerDragActivationTimerRef.current === null) return
    window.clearTimeout(layerDragActivationTimerRef.current)
    layerDragActivationTimerRef.current = null
  }

  const stopLayerAutoScroll = () => {
    if (layerAutoScrollFrameRef.current === null) return
    window.cancelAnimationFrame(layerAutoScrollFrameRef.current)
    layerAutoScrollFrameRef.current = null
  }

  const detachLayerPointerListeners = () => {
    const listeners = layerPointerListenersRef.current
    if (!listeners) return
    window.removeEventListener('pointermove', listeners.move)
    window.removeEventListener('pointerup', listeners.end)
    window.removeEventListener('pointercancel', listeners.cancel)
    layerPointerListenersRef.current = null
  }

  const releaseLayerPointerCapture = (dragState: LayerDragState) => {
    try {
      if (dragState.sourceElement.hasPointerCapture(dragState.pointerId)) {
        dragState.sourceElement.releasePointerCapture(dragState.pointerId)
      }
    } catch {
      // Pointer capture may already be released by iPad WebView.
    }
  }

  const suppressLayerClickAfterDrag = () => {
    layerSuppressClickRef.current = true
    window.setTimeout(() => {
      layerSuppressClickRef.current = false
    }, 0)
  }

  const updateLayerDragOrderAtPoint = (clientY: number) => {
    const dragState = layerDragRef.current
    const layerList = layerListRef.current
    if (!dragState?.active || !layerList) return

    const cards = Array.from(layerList.querySelectorAll<HTMLElement>('[data-layer-item-id]'))
      .filter((card) => card.dataset.layerItemId !== dragState.itemId)
    if (cards.length === 0) {
      setLayerDropHint(null)
      return
    }

    let targetCard = cards[cards.length - 1]
    let placement: LayerDropHint['placement'] = 'after'
    for (const card of cards) {
      const rect = card.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        targetCard = card
        placement = 'before'
        break
      }
    }

    const targetItemId = targetCard.dataset.layerItemId
    if (!targetItemId) return

    setLayerDropHint((currentHint) => (
      currentHint?.itemId === targetItemId && currentHint.placement === placement
        ? currentHint
        : { itemId: targetItemId, placement }
    ))

    const nextIds = dragState.orderedIds.filter((itemId) => itemId !== dragState.itemId)
    const targetIndex = nextIds.indexOf(targetItemId)
    if (targetIndex < 0) return
    nextIds.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, dragState.itemId)

    if (nextIds.every((itemId, index) => itemId === dragState.orderedIds[index])) return

    dragState.orderedIds = nextIds
    dragState.changed = true
    applyLayerOrderLocally(nextIds)
  }

  const runLayerAutoScroll = () => {
    const dragState = layerDragRef.current
    const layerList = layerListRef.current
    if (!dragState?.active || !layerList) {
      layerAutoScrollFrameRef.current = null
      return
    }

    const rect = layerList.getBoundingClientRect()
    const distanceFromTop = dragState.lastPoint.y - rect.top
    const distanceFromBottom = rect.bottom - dragState.lastPoint.y
    let scrollDelta = 0

    if (distanceFromTop < LAYER_AUTO_SCROLL_EDGE) {
      const ratio = clamp((LAYER_AUTO_SCROLL_EDGE - distanceFromTop) / LAYER_AUTO_SCROLL_EDGE, 0, 1)
      scrollDelta = -Math.max(2, LAYER_AUTO_SCROLL_MAX_SPEED * ratio)
    } else if (distanceFromBottom < LAYER_AUTO_SCROLL_EDGE) {
      const ratio = clamp((LAYER_AUTO_SCROLL_EDGE - distanceFromBottom) / LAYER_AUTO_SCROLL_EDGE, 0, 1)
      scrollDelta = Math.max(2, LAYER_AUTO_SCROLL_MAX_SPEED * ratio)
    }

    if (scrollDelta !== 0) {
      const previousScrollTop = layerList.scrollTop
      layerList.scrollTop += scrollDelta
      if (layerList.scrollTop !== previousScrollTop) {
        updateLayerDragOrderAtPoint(dragState.lastPoint.y)
      }
    }

    layerAutoScrollFrameRef.current = window.requestAnimationFrame(runLayerAutoScroll)
  }

  const activateLayerDrag = (dragState: LayerDragState) => {
    if (layerDragRef.current !== dragState || dragState.active) return
    clearLayerDragActivationTimer()
    dragState.active = true
    layerSuppressClickRef.current = true
    try {
      dragState.sourceElement.setPointerCapture(dragState.pointerId)
    } catch {
      // iPad WebView can reject pointer capture if the touch has already ended.
    }
    setDraggedLayerItemId(dragState.itemId)
    setPressedLayerItemId('')
    setLayerDragPreview({
      itemId: dragState.itemId,
      x: dragState.lastPoint.x - dragState.pointerOffset.x,
      y: dragState.lastPoint.y - dragState.pointerOffset.y,
      width: dragState.sourceRect.width,
      height: dragState.sourceRect.height
    })
    setLayerDropHint(null)
    setToolOpen(false)
    setBackgroundPanelOpen(false)
    setAppearPanelOpen(false)
    selectItem(dragState.itemId, false)
    if (layerAutoScrollFrameRef.current === null) {
      layerAutoScrollFrameRef.current = window.requestAnimationFrame(runLayerAutoScroll)
    }
  }

  const handleLayerCardPointerDown = (event: React.PointerEvent<HTMLElement>, itemId: string) => {
    if (previewMode || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    const target = event.target as HTMLElement
    if (target.closest('.dynamic-layer-property-button, .dynamic-layer-delete-button, .dynamic-layer-select')) return

    const sourceRect = event.currentTarget.getBoundingClientRect()

    const dragState: LayerDragState = {
      itemId,
      orderedIds: layerItems.map((item) => item.id),
      originalGroup: latestGroupRef.current,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      sourceElement: event.currentTarget,
      sourceRect: { width: sourceRect.width, height: sourceRect.height },
      pointerOffset: {
        x: event.clientX - sourceRect.left,
        y: event.clientY - sourceRect.top
      },
      startPoint: { x: event.clientX, y: event.clientY },
      lastPoint: { x: event.clientX, y: event.clientY },
      active: false,
      changed: false
    }
    layerDragRef.current = dragState
    setPressedLayerItemId(itemId)
    detachLayerPointerListeners()
    const listeners = {
      move: handleLayerCardPointerMove,
      end: handleLayerCardPointerEnd,
      cancel: handleLayerCardPointerCancel
    }
    layerPointerListenersRef.current = listeners
    window.addEventListener('pointermove', listeners.move, { passive: false })
    window.addEventListener('pointerup', listeners.end)
    window.addEventListener('pointercancel', listeners.cancel)

    if (event.pointerType !== 'mouse') {
      clearLayerDragActivationTimer()
      layerDragActivationTimerRef.current = window.setTimeout(() => {
        activateLayerDrag(dragState)
      }, LAYER_TOUCH_HOLD_MS)
    }
  }

  const handleLayerCardPointerMove = (event: PointerEvent) => {
    const dragState = layerDragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    dragState.lastPoint = { x: event.clientX, y: event.clientY }
    const distance = Math.hypot(
      event.clientX - dragState.startPoint.x,
      event.clientY - dragState.startPoint.y
    )

    if (!dragState.active) {
      if (dragState.pointerType === 'mouse' && distance >= LAYER_MOUSE_DRAG_THRESHOLD) {
        activateLayerDrag(dragState)
      } else if (dragState.pointerType !== 'mouse' && distance >= LAYER_TOUCH_SCROLL_THRESHOLD) {
        clearLayerDragActivationTimer()
        layerDragRef.current = null
        setPressedLayerItemId('')
        detachLayerPointerListeners()
        return
      } else {
        return
      }
    }

    event.preventDefault()
    event.stopPropagation()
    setLayerDragPreview((currentPreview) => currentPreview
      ? {
          ...currentPreview,
          x: event.clientX - dragState.pointerOffset.x,
          y: event.clientY - dragState.pointerOffset.y
        }
      : currentPreview)
    updateLayerDragOrderAtPoint(event.clientY)
  }

  const handleLayerCardPointerEnd = (event: PointerEvent) => {
    const dragState = layerDragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    clearLayerDragActivationTimer()
    stopLayerAutoScroll()
    detachLayerPointerListeners()
    releaseLayerPointerCapture(dragState)
    layerDragRef.current = null
    setPressedLayerItemId('')

    if (!dragState.active) return

    event.preventDefault()
    event.stopPropagation()
    if (dragState.changed) {
      const nextGroup = reorderDynamicItems(
        group.id,
        dragState.orderedIds,
        latestGroupRef.current
      )
      if (nextGroup) {
        latestGroupRef.current = nextGroup
        onGroupChange(nextGroup)
        sendGroupStateSync(nextGroup)
        playUiSound('success')
      }
    }
    setDraggedLayerItemId('')
    setLayerDragPreview(null)
    setLayerDropHint(null)
    suppressLayerClickAfterDrag()
  }

  const handleLayerCardPointerCancel = (event: PointerEvent) => {
    const dragState = layerDragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    clearLayerDragActivationTimer()
    stopLayerAutoScroll()
    detachLayerPointerListeners()
    releaseLayerPointerCapture(dragState)
    layerDragRef.current = null
    setPressedLayerItemId('')

    if (dragState.active && dragState.changed) {
      latestGroupRef.current = dragState.originalGroup
      onGroupChange(dragState.originalGroup)
    }
    setDraggedLayerItemId('')
    setLayerDragPreview(null)
    setLayerDropHint(null)
    if (dragState.active) suppressLayerClickAfterDrag()
  }

  const handleLayerCardClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (!layerSuppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    layerSuppressClickRef.current = false
  }

  const applyBackgroundOrderLocally = (orderedIds: string[]) => {
    const currentGroup = latestGroupRef.current
    const currentBackgrounds = getBackgrounds(currentGroup)
    const backgroundById = new Map(currentBackgrounds.map((background) => [background.id, background]))
    const orderedBackgrounds = orderedIds
      .map((backgroundId) => backgroundById.get(backgroundId))
      .filter(Boolean) as DynamicBackground[]
    currentBackgrounds.forEach((background) => {
      if (!orderedBackgrounds.some((item) => item.id === background.id)) {
        orderedBackgrounds.push(background)
      }
    })

    const activeBackground = orderedBackgrounds.find((background) => background.id === currentGroup.activeBackgroundId)
      ?? orderedBackgrounds.find((background) => background.id === currentGroup.background?.id)
      ?? orderedBackgrounds[0]
    const nextGroup = {
      ...currentGroup,
      backgrounds: orderedBackgrounds,
      background: activeBackground,
      activeBackgroundId: activeBackground?.id,
      updatedAt: Date.now()
    }
    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
  }

  const clearBackgroundDragActivationTimer = () => {
    if (backgroundDragActivationTimerRef.current === null) return
    window.clearTimeout(backgroundDragActivationTimerRef.current)
    backgroundDragActivationTimerRef.current = null
  }

  const stopBackgroundAutoScroll = () => {
    if (backgroundAutoScrollFrameRef.current === null) return
    window.cancelAnimationFrame(backgroundAutoScrollFrameRef.current)
    backgroundAutoScrollFrameRef.current = null
  }

  const detachBackgroundPointerListeners = () => {
    const listeners = backgroundPointerListenersRef.current
    if (!listeners) return
    window.removeEventListener('pointermove', listeners.move)
    window.removeEventListener('pointerup', listeners.end)
    window.removeEventListener('pointercancel', listeners.cancel)
    backgroundPointerListenersRef.current = null
  }

  const releaseBackgroundPointerCapture = (dragState: BackgroundDragState) => {
    try {
      if (dragState.sourceElement.hasPointerCapture(dragState.pointerId)) {
        dragState.sourceElement.releasePointerCapture(dragState.pointerId)
      }
    } catch {
      // Pointer capture may already be released by iPad WebView.
    }
  }

  const suppressBackgroundClickAfterDrag = () => {
    backgroundSuppressClickRef.current = true
    window.setTimeout(() => {
      backgroundSuppressClickRef.current = false
    }, 0)
  }

  const updateBackgroundDragOrderAtPoint = (clientY: number) => {
    const dragState = backgroundDragRef.current
    const backgroundList = backgroundListRef.current
    if (!dragState?.active || !backgroundList) return

    const cards = Array.from(backgroundList.querySelectorAll<HTMLElement>('[data-background-id]'))
      .filter((card) => card.dataset.backgroundId !== dragState.backgroundId)
    if (cards.length === 0) {
      setBackgroundDropHint(null)
      return
    }

    let targetCard = cards[cards.length - 1]
    let placement: BackgroundDropHint['placement'] = 'after'
    for (const card of cards) {
      const rect = card.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        targetCard = card
        placement = 'before'
        break
      }
    }

    const targetBackgroundId = targetCard.dataset.backgroundId
    if (!targetBackgroundId) return

    setBackgroundDropHint((currentHint) => (
      currentHint?.backgroundId === targetBackgroundId && currentHint.placement === placement
        ? currentHint
        : { backgroundId: targetBackgroundId, placement }
    ))

    const nextIds = dragState.orderedIds.filter((backgroundId) => backgroundId !== dragState.backgroundId)
    const targetIndex = nextIds.indexOf(targetBackgroundId)
    if (targetIndex < 0) return
    nextIds.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, dragState.backgroundId)

    if (nextIds.every((backgroundId, index) => backgroundId === dragState.orderedIds[index])) return

    dragState.orderedIds = nextIds
    dragState.changed = true
    applyBackgroundOrderLocally(nextIds)
  }

  const runBackgroundAutoScroll = () => {
    const dragState = backgroundDragRef.current
    const backgroundList = backgroundListRef.current
    if (!dragState?.active || !backgroundList) {
      backgroundAutoScrollFrameRef.current = null
      return
    }

    const rect = backgroundList.getBoundingClientRect()
    const distanceFromTop = dragState.lastPoint.y - rect.top
    const distanceFromBottom = rect.bottom - dragState.lastPoint.y
    let scrollDelta = 0

    if (distanceFromTop < LAYER_AUTO_SCROLL_EDGE) {
      const ratio = clamp((LAYER_AUTO_SCROLL_EDGE - distanceFromTop) / LAYER_AUTO_SCROLL_EDGE, 0, 1)
      scrollDelta = -Math.max(2, LAYER_AUTO_SCROLL_MAX_SPEED * ratio)
    } else if (distanceFromBottom < LAYER_AUTO_SCROLL_EDGE) {
      const ratio = clamp((LAYER_AUTO_SCROLL_EDGE - distanceFromBottom) / LAYER_AUTO_SCROLL_EDGE, 0, 1)
      scrollDelta = Math.max(2, LAYER_AUTO_SCROLL_MAX_SPEED * ratio)
    }

    if (scrollDelta !== 0) {
      const previousScrollTop = backgroundList.scrollTop
      backgroundList.scrollTop += scrollDelta
      if (backgroundList.scrollTop !== previousScrollTop) {
        updateBackgroundDragOrderAtPoint(dragState.lastPoint.y)
      }
    }

    backgroundAutoScrollFrameRef.current = window.requestAnimationFrame(runBackgroundAutoScroll)
  }

  const activateBackgroundDrag = (dragState: BackgroundDragState) => {
    if (backgroundDragRef.current !== dragState || dragState.active) return
    clearBackgroundDragActivationTimer()
    dragState.active = true
    backgroundSuppressClickRef.current = true
    try {
      dragState.sourceElement.setPointerCapture(dragState.pointerId)
    } catch {
      // iPad WebView can reject pointer capture if the touch has already ended.
    }
    setDraggedBackgroundId(dragState.backgroundId)
    setPressedBackgroundId('')
    setBackgroundDragPreview({
      backgroundId: dragState.backgroundId,
      x: dragState.lastPoint.x - dragState.pointerOffset.x,
      y: dragState.lastPoint.y - dragState.pointerOffset.y,
      width: dragState.sourceRect.width,
      height: dragState.sourceRect.height
    })
    setBackgroundDropHint(null)
    if (backgroundAutoScrollFrameRef.current === null) {
      backgroundAutoScrollFrameRef.current = window.requestAnimationFrame(runBackgroundAutoScroll)
    }
  }

  const handleBackgroundCardPointerDown = (event: React.PointerEvent<HTMLElement>, backgroundId: string) => {
    if (previewMode || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    const target = event.target as HTMLElement
    if (target.closest('.background-check, input, .background-card-delete')) return

    const sourceRect = event.currentTarget.getBoundingClientRect()

    const dragState: BackgroundDragState = {
      backgroundId,
      orderedIds: getBackgrounds(latestGroupRef.current).map((background) => background.id),
      originalGroup: latestGroupRef.current,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      sourceElement: event.currentTarget,
      sourceRect: { width: sourceRect.width, height: sourceRect.height },
      pointerOffset: {
        x: event.clientX - sourceRect.left,
        y: event.clientY - sourceRect.top
      },
      startPoint: { x: event.clientX, y: event.clientY },
      lastPoint: { x: event.clientX, y: event.clientY },
      active: false,
      changed: false
    }
    backgroundDragRef.current = dragState
    setPressedBackgroundId(backgroundId)
    detachBackgroundPointerListeners()
    const listeners = {
      move: handleBackgroundCardPointerMove,
      end: handleBackgroundCardPointerEnd,
      cancel: handleBackgroundCardPointerCancel
    }
    backgroundPointerListenersRef.current = listeners
    window.addEventListener('pointermove', listeners.move, { passive: false })
    window.addEventListener('pointerup', listeners.end)
    window.addEventListener('pointercancel', listeners.cancel)

    if (event.pointerType !== 'mouse') {
      clearBackgroundDragActivationTimer()
      backgroundDragActivationTimerRef.current = window.setTimeout(() => {
        activateBackgroundDrag(dragState)
      }, LAYER_TOUCH_HOLD_MS)
    }
  }

  const handleBackgroundCardPointerMove = (event: PointerEvent) => {
    const dragState = backgroundDragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    dragState.lastPoint = { x: event.clientX, y: event.clientY }
    const distance = Math.hypot(
      event.clientX - dragState.startPoint.x,
      event.clientY - dragState.startPoint.y
    )

    if (!dragState.active) {
      if (dragState.pointerType === 'mouse' && distance >= LAYER_MOUSE_DRAG_THRESHOLD) {
        activateBackgroundDrag(dragState)
      } else if (dragState.pointerType !== 'mouse' && distance >= LAYER_TOUCH_SCROLL_THRESHOLD) {
        clearBackgroundDragActivationTimer()
        backgroundDragRef.current = null
        setPressedBackgroundId('')
        detachBackgroundPointerListeners()
        return
      } else {
        return
      }
    }

    event.preventDefault()
    event.stopPropagation()
    setBackgroundDragPreview((currentPreview) => currentPreview
      ? {
          ...currentPreview,
          x: event.clientX - dragState.pointerOffset.x,
          y: event.clientY - dragState.pointerOffset.y
        }
      : currentPreview)
    updateBackgroundDragOrderAtPoint(event.clientY)
  }

  const handleBackgroundCardPointerEnd = (event: PointerEvent) => {
    const dragState = backgroundDragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    clearBackgroundDragActivationTimer()
    stopBackgroundAutoScroll()
    detachBackgroundPointerListeners()
    releaseBackgroundPointerCapture(dragState)
    backgroundDragRef.current = null
    setPressedBackgroundId('')

    if (!dragState.active) return

    event.preventDefault()
    event.stopPropagation()
    if (dragState.changed) {
      const nextGroup = reorderDynamicBackgrounds(group.id, dragState.orderedIds, latestGroupRef.current)
      if (nextGroup) {
        latestGroupRef.current = nextGroup
        onGroupChange(nextGroup)
        sendGroupStateSync(nextGroup)
        playUiSound('success')
      }
    }
    setDraggedBackgroundId('')
    setBackgroundDragPreview(null)
    setBackgroundDropHint(null)
    suppressBackgroundClickAfterDrag()
  }

  const handleBackgroundCardPointerCancel = (event: PointerEvent) => {
    const dragState = backgroundDragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    clearBackgroundDragActivationTimer()
    stopBackgroundAutoScroll()
    detachBackgroundPointerListeners()
    releaseBackgroundPointerCapture(dragState)
    backgroundDragRef.current = null
    setPressedBackgroundId('')

    if (dragState.active && dragState.changed) {
      latestGroupRef.current = dragState.originalGroup
      onGroupChange(dragState.originalGroup)
    }
    setDraggedBackgroundId('')
    setBackgroundDragPreview(null)
    setBackgroundDropHint(null)
    if (dragState.active) suppressBackgroundClickAfterDrag()
  }

  const handleBackgroundCardClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (!backgroundSuppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    backgroundSuppressClickRef.current = false
  }

  const handleLayerKeyboardMove = (itemId: string, offset: -1 | 1) => {
    if (previewMode) return
    const orderedIds = layerItems.map((item) => item.id)
    const currentIndex = orderedIds.indexOf(itemId)
    const nextIndex = currentIndex + offset
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedIds.length) return

    orderedIds.splice(currentIndex, 1)
    orderedIds.splice(nextIndex, 0, itemId)
    const nextGroup = reorderDynamicItems(group.id, orderedIds, latestGroupRef.current)
    if (!nextGroup) return

    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
    sendGroupStateSync(nextGroup)
    selectItem(itemId, false)
  }

  const receiverSyncMessage = receiverSyncError
    ? t('sync.failed')
    : receiverSyncStatus === 'complete'
      ? t('sync.complete')
      : receiverSyncStatus
        ? t(`sync.${receiverSyncStatus.phase}`, {
            current: receiverSyncStatus.current ?? 0,
            total: receiverSyncStatus.total ?? 0
          })
        : ''
  const getTranslatedMotionLabel = (moveMode: DynamicMoveMode) => {
    const labelKey = motionOptions.find((option) => option.id === moveMode)?.labelKey ?? 'control.motionNone'
    return t(labelKey)
  }
  const getTranslatedTrackLabel = (track: DynamicMoveTrack) => {
    const labelKey = trackOptions.find((option) => option.id === track)?.labelKey ?? 'control.trackMiddle'
    return t(labelKey)
  }

  return (
    <main className={`ipad-screen dynamic-control-screen apple-container ${previewMode ? 'dynamic-previewing' : ''} ${backgroundPanelOpen ? 'dynamic-background-open' : ''} dynamic-right-panel-${rightPanelMode}`}>
      <header className="ipad-topbar dynamic-control-topbar">
        {previewMode ? (
          <div className="dynamic-preview-lock-actions">
            <button
              type="button"
              className="ipad-button preview-action secondary-button preview-stop-button"
              onClick={() => setPreviewModeEnabled(false)}
            >
              {t('control.stopPreview')}
            </button>
          </div>
        ) : (
          <>
            <div className="topbar-title-row">
              <button type="button" className="ipad-button ghost-button" onClick={handleControlBack}>
                {t('common.back')}
              </button>
              <div className="min-w-0">
                <p className="eyebrow">{t('groups.archive')}</p>
                <h1 className="screen-title">{group.name}</h1>
              </div>
            </div>

            <div className="dynamic-control-actions">
              <input
                ref={backgroundInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleBackgroundChange}
              />
              <input
                ref={layerItemInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLayerItemChange}
              />
              <button
                type="button"
                className={`ipad-button secondary-button control-action-button appear-action ${appearPanelOpen ? 'active-action' : ''}`}
                onClick={() => {
                  const nextOpen = !appearPanelOpen
                  setAppearPanelOpen(nextOpen)
                  if (nextOpen) {
                    setToolOpen(false)
                    setBackgroundPanelOpen(false)
                    setRightPanelCollapsed(false)
                  }
                }}
              >
                {t('control.appearanceSettings')}
              </button>
              <button
                type="button"
                className={`ipad-button secondary-button control-action-button background-action ${backgroundPanelOpen ? 'active-action' : ''}`}
                onClick={() => backgroundPanelOpen ? closeBackgroundEditor() : openBackgroundEditor()}
                aria-expanded={backgroundPanelOpen}
                aria-haspopup="dialog"
              >
                {t('control.editBackground')}
              </button>
              <button
                type="button"
                className="ipad-button preview-action primary-button success-button"
                onClick={() => setPreviewModeEnabled(true)}
              >
                {t('control.preview')}
              </button>
            </div>
          </>
        )}
      </header>

      {(receiverSyncStatus || receiverSyncError) && (
        <div className={`status-toast ${receiverSyncError ? 'error' : 'success'}`}>
          {receiverSyncMessage}
        </div>
      )}

      <section className="dynamic-control-workspace">
        <div className={`dynamic-editor-row ${previewMode ? 'preview-only' : ''} ${rightPanelVisible ? 'right-panel-open' : 'right-panel-collapsed'}`}>
          <div className="dynamic-stage-shell">
            <div
              ref={stageRef}
              className={`dynamic-stage ${activeTab === 'motion' && toolOpen ? 'show-zones' : ''}`}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerEnd}
              onPointerCancel={handleStagePointerEnd}
              onLostPointerCapture={handleStagePointerEnd}
            >
            <div className="dynamic-stage-zones" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            {displayedBackground ? (
              displayedBackground.type === 'video' ? (
                <video
                  ref={stageBackgroundVideoRef}
                  key={displayedBackground.id}
                  src={displayedBackground.url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  className="dynamic-stage-background"
                />
              ) : (
                <img src={displayedBackground.url} alt={displayedBackground.name} className="dynamic-stage-background" />
              )
            ) : (
              <div className="dynamic-empty-stage">
                <strong>16:9</strong>
                <span>{t('control.chooseBackgroundPrompt')}</span>
              </div>
            )}

            {sortedItems.map((item, index) => {
              const isManipulating = manipulatingItemId === item.id
              const resolvedMoveMode = resolvePreviewMotionMode(item, group.id, previewReplayId)
              const resolvedAnimationId = previewMode
                ? getResolvedPreviewAnimationId(item, group.id, previewReplayId)
                : 0
              const isAmplitudeStatic = resolvedMoveMode !== 'left' && resolvedMoveMode !== 'right' && item.movePercent <= 0
              const shouldPlayMotion = previewMode && !isManipulating && !isAmplitudeStatic
              const motionMode = shouldPlayMotion ? resolvedMoveMode : 'none'
              const appearDelayMs = previewMode && group.appearMode === 'sequence' ? index * appearIntervalMs : 0
              const itemPreviewSize = getDynamicItemPreviewSize(item, itemImageSizes[item.media.id], stageSize)
              const compositorSize = {
                width: Math.max(MIN_STAGE_ITEM_COMPOSITOR_SIZE, itemPreviewSize.width),
                height: Math.max(MIN_STAGE_ITEM_COMPOSITOR_SIZE, itemPreviewSize.height)
              }
              const animationCoordinateScale = Math.min(
                (stageSize.width || DEFAULT_STAGE_PREVIEW_WIDTH) / RUNTIME_STAGE_WIDTH,
                (stageSize.height || DEFAULT_STAGE_PREVIEW_HEIGHT) / RUNTIME_STAGE_HEIGHT
              )
              return (
                <DynamicStageMotion
                  key={item.id}
                  item={item}
                  motionMode={motionMode}
                  stageSize={stageSize}
                  appearDelayMs={appearDelayMs}
                  replayId={previewReplayId}
                  style={{
                    ...getMotionPreviewStyle(item, motionMode, !shouldPlayMotion, stageSize),
                    width: `${compositorSize.width}px`,
                    height: `${compositorSize.height}px`,
                    '--motion-delay': `${appearDelayMs}ms`
                  } as React.CSSProperties}
                >
                  <div className="dynamic-stage-item-wave">
                    <DynamicStageAppearance
                      previewing={previewMode}
                      ready={Boolean(readyItemMediaIds[item.media.id])}
                      appearDelayMs={appearDelayMs}
                      replayId={previewReplayId}
                    >
                      <DynamicStageItemAnimation
                        animationId={resolvedAnimationId}
                        itemId={item.id}
                        enabled={previewMode
                          && resolvedAnimationId >= 1
                          && resolvedAnimationId <= 8}
                        coordinateScale={animationCoordinateScale}
                      >
                        <div
                          className="dynamic-stage-item-user-transform"
                          style={{
                            transform: `rotate(${item.rotation}deg) scale(${getItemFlipX(item) ? -item.scale : item.scale}, ${getItemFlipY(item) ? -item.scale : item.scale})`
                          }}
                        >
                          <div
                            className="dynamic-stage-item-visual-frame"
                            style={{
                              width: `${itemPreviewSize.width}px`,
                              height: `${itemPreviewSize.height}px`
                            }}
                          >
                            <DynamicStageMedia
                              src={item.media.url}
                              name={item.name}
                              mediaId={item.media.id}
                              animationId={resolvedAnimationId}
                              previewMode={previewMode}
                              replayId={previewReplayId}
                              active={!previewMode && selectedItem?.id === item.id}
                              copyPulse={copyFeedbackItemId === item.id}
                              onImageLoad={handleItemImageLoad}
                              onImageError={handleItemImageError}
                            />
                          </div>
                        </div>
                      </DynamicStageItemAnimation>
                    </DynamicStageAppearance>
                  </div>
                </DynamicStageMotion>
              )
            })}
            </div>
          </div>

        {rightPanelMode === 'layers' && (
          <aside
            className="dynamic-layer-panel"
            aria-label={t('control.layers')}
          >
            <div className="dynamic-layer-header">
              <div>
                <p className="eyebrow">{t('control.stageStructure')}</p>
                <h2>{t('control.layers')} <span>{group.items.length}/{MAX_DYNAMIC_ITEMS_PER_GROUP}</span></h2>
              </div>
              <button
                type="button"
                className="drawer-add-item-button"
                disabled={isAddingLayerItem || group.items.length >= MAX_DYNAMIC_ITEMS_PER_GROUP}
                onClick={() => {
                  setToolOpen(false)
                  setBackgroundPanelOpen(false)
                  setRightPanelCollapsed(false)
                  setAppearPanelOpen(false)
                  layerItemInputRef.current?.click()
                }}
                aria-label={t('items.add')}
                title={t('items.add')}
              >
                +
              </button>
              <button
                type="button"
                className="dynamic-panel-collapse-button"
                onClick={() => {
                  setRightPanelCollapsed(true)
                  setToolOpen(false)
                  setBackgroundPanelOpen(false)
                  setAppearPanelOpen(false)
                }}
                aria-label={t('control.collapseLayers')}
                title={t('control.collapseLayers')}
              >
                ›
              </button>
            </div>

            <div className="dynamic-layer-bulk-toolbar">
              <label className="dynamic-layer-select-all">
                <input
                  type="checkbox"
                  checked={allLayersSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someLayersSelected
                  }}
                  onChange={toggleAllLayerSelection}
                />
                <span aria-hidden="true" />
                <strong>{t('common.selectAll')}</strong>
              </label>
              <span className="dynamic-layer-selected-count">{t('common.selectedCount', { count: selectedLayerItemIds.length })}</span>
              <button
                type="button"
                className="dynamic-layer-bulk-delete danger-inline-button"
                disabled={selectedLayerItemIds.length === 0}
                onClick={handleLayerBulkDelete}
              >
                {t('common.delete')}
              </button>
            </div>

            <div
              ref={layerListRef}
              className={`dynamic-layer-list ${draggedLayerItemId ? 'is-reordering' : ''}`}
            >
              {layerItems.map((item) => {
                const motionLabel = getTranslatedMotionLabel(item.moveMode)
                return (
                  <article
                    key={item.id}
                    data-layer-item-id={item.id}
                    className={`dynamic-layer-card ${selectedItem?.id === item.id ? 'active' : ''} ${selectedLayerItemIds.includes(item.id) ? 'is-checked' : ''} ${pressedLayerItemId === item.id ? 'is-pressed' : ''} ${draggedLayerItemId === item.id ? 'dragging' : ''} ${layerDropHint?.itemId === item.id ? `drop-${layerDropHint.placement}` : ''}`}
                    onPointerDown={(event) => handleLayerCardPointerDown(event, item.id)}
                    onClickCapture={handleLayerCardClickCapture}
                    onContextMenu={(event) => event.preventDefault()}
                    aria-grabbed={draggedLayerItemId === item.id}
                  >
                    <label
                      className="dynamic-layer-select"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={t('common.selectNamed', { name: item.name })}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLayerItemIds.includes(item.id)}
                        onChange={() => toggleLayerSelection(item.id)}
                      />
                      <span aria-hidden="true" />
                    </label>
                    <button
                      type="button"
                      className="dynamic-layer-main"
                      onClick={() => selectItem(item.id, true)}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowUp') {
                          event.preventDefault()
                          handleLayerKeyboardMove(item.id, -1)
                        } else if (event.key === 'ArrowDown') {
                          event.preventDefault()
                          handleLayerKeyboardMove(item.id, 1)
                        }
                      }}
                    >
                      <span className="dynamic-layer-order">{String(item.order + 1).padStart(2, '0')}</span>
                      <img src={item.media.url} alt={item.name} />
                      <span className="dynamic-layer-copy">
                        <strong>{item.name}</strong>
                        <small>{t('control.layerSummary', { motion: motionLabel, animation: item.animationId })}</small>
                      </span>
                    </button>
                    <div className="dynamic-layer-actions">
                      <button
                        type="button"
                        className="dynamic-layer-property-button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          selectItem(item.id, true)
                        }}
                        aria-label={t('control.openObjectProperties', { name: item.name })}
                        title={t('control.objectProperties')}
                      >
                        {t('control.properties')}
                      </button>
                      <button
                        type="button"
                        className="dynamic-layer-delete-button"
                        onClick={() => handleItemDelete(item.id)}
                        aria-label={t('control.deleteNamed', { name: item.name })}
                        title={t('items.delete')}
                      >
                        ×
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </aside>
        )}

        {rightPanelMode === 'collapsed' && (
          <button
            type="button"
            className="dynamic-right-panel-reopen"
            onClick={() => {
              setRightPanelCollapsed(false)
              setToolOpen(false)
              setBackgroundPanelOpen(false)
              setAppearPanelOpen(false)
            }}
            aria-label={t('control.expandLayers')}
            title={t('control.expandLayers')}
          >
            {t('control.layers')}
          </button>
        )}

        {rightPanelMode === 'object' && selectedItem && (
          <aside
            className="dynamic-tool-panel side-right dynamic-property-overlay-panel"
            aria-label={t('control.objectProperties')}
          >
            <div className={`dynamic-tool-header ${isEditingItemName ? 'is-renaming' : ''}`}>
              <div className="dynamic-tool-title">
                <button
                  ref={propertyThumbnailButtonRef}
                  type="button"
                  className="dynamic-property-thumbnail-button"
                  onClick={openImagePreview}
                  aria-label={t('control.previewNamed', { name: selectedItem.name })}
                  title={t('control.previewImage')}
                >
                  <img src={selectedItem.media.url} alt="" draggable={false} />
                  <span className="dynamic-property-thumbnail-icon" aria-hidden="true">
                    <Maximize2 size={14} strokeWidth={2.4} />
                  </span>
                </button>
                <div className="dynamic-property-title-copy">
                  <p className="eyebrow">{t('control.objectProperties')}</p>
                  {isEditingItemName ? (
                    <div className="dynamic-property-name-editor">
                      <input
                        ref={propertyNameInputRef}
                        type="text"
                        value={itemNameDraft}
                        maxLength={80}
                        disabled={isSavingItemName}
                        onChange={(event) => {
                          setItemNameDraft(event.target.value)
                          if (itemNameErrorKey) setItemNameErrorKey('')
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void saveItemName()
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            cancelItemNameEdit()
                          }
                        }}
                        aria-label={t('items.name')}
                        aria-invalid={Boolean(itemNameErrorKey)}
                        aria-describedby={itemNameErrorKey ? 'dynamic-item-name-error' : undefined}
                      />
                      <button
                        type="button"
                        className="dynamic-property-name-action cancel"
                        onClick={cancelItemNameEdit}
                        disabled={isSavingItemName}
                        aria-label={t('control.cancelRename')}
                        title={t('common.cancel')}
                      >
                        <X size={15} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        className="dynamic-property-name-action confirm"
                        onClick={() => void saveItemName()}
                        disabled={isSavingItemName || !itemNameDraft.trim()}
                        aria-label={t('control.saveObjectName')}
                        title={t('common.save')}
                      >
                        <Check size={15} strokeWidth={2.7} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="dynamic-property-name-button"
                      onClick={startItemNameEdit}
                      aria-label={t('control.renameNamed', { name: selectedItem.name })}
                      title={t('control.rename')}
                    >
                      <span>{selectedItem.name}</span>
                      <Pencil size={13} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  )}
                  {itemNameErrorKey && (
                    <span id="dynamic-item-name-error" className="dynamic-property-name-error" role="alert">
                      {t(itemNameErrorKey)}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="dynamic-panel-close"
                onClick={() => {
                  setToolOpen(false)
                  setBackgroundPanelOpen(false)
                  setRightPanelCollapsed(false)
                  setIsEditingItemName(false)
                  setItemNameErrorKey('')
                }}
                aria-label={t('control.backToLayers')}
                title={t('control.backToLayers')}
              >
                ×
              </button>
            </div>

            <div className="tool-tabs dynamic-tool-tabs">
              {propertyTabOptions.map(({ id, labelKey, shortLabelKey, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`tool-tab dynamic-property-tab ${visibleActiveTab === id ? 'active' : ''}`}
                  onClick={() => setActiveTab(id)}
                  aria-label={t(labelKey)}
                  title={t(labelKey)}
                  aria-current={visibleActiveTab === id ? 'page' : undefined}
                >
                  <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
                  <span>{t(shortLabelKey)}</span>
                </button>
              ))}
            </div>

            {visibleActiveTab === 'motion' && (
              <div className="dynamic-tool-body dynamic-property-body dynamic-property-motion-body">
                <div className="motion-button-row">
                  {motionOptions.map((motion) => (
                    <button
                      key={motion.id}
                      type="button"
                      className={`motion-mode-button ${selectedItem.moveMode === motion.id ? 'active' : ''}`}
                      onClick={() => handleMotionChange(motion.id)}
                    >
                      <span className={`motion-icon motion-icon-${motion.icon}`} />
                      <strong>{t(motion.labelKey)}</strong>
                    </button>
                  ))}
                </div>
                <label className="dynamic-percent-control">
                  <span>{t('control.amplitudeTrack', { percent: selectedItem.movePercent, track: getTranslatedTrackLabel(activeTrack) })}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={selectedItem.movePercent}
                    onChange={(event) => handleMotionPercentChange(Number(event.target.value))}
                    className="ipad-slider"
                  />
                </label>
                <label className="dynamic-percent-control">
                  <span>{t('control.speedPercent', { percent: selectedMoveSpeed })}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={selectedMoveSpeed}
                    onChange={(event) => handleMotionSpeedChange(Number(event.target.value))}
                    className="ipad-slider"
                  />
                </label>
                <div className="dynamic-track-selector" aria-label={t('control.trackSelection')}>
                  <span>{t('control.track')}</span>
                  <div className="dynamic-track-buttons">
                    {trackOptions.map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        className={activeTrack === track.id ? 'active' : ''}
                        onClick={() => handleMoveTrackChange(track.id)}
                      >
                        {t(track.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {visibleActiveTab === 'animation' && (
              <div className="dynamic-tool-body compact dynamic-property-body dynamic-property-animation-body dynamic-animation-tool-body">
                <section className="dynamic-animation-mode-card">
                  <div className="dynamic-property-section-heading">
                    <strong>{t('animation.mode')}</strong>
                    <span>
                      {selectedAnimationMode === 'none'
                        ? t('animation.none')
                        : selectedAnimationMode === 'random'
                          ? t('animation.random')
                          : t(getDynamicAnimationPreview(animationCursor).shortLabelKey)}
                    </span>
                  </div>
                  <div className="dynamic-animation-mode-row" aria-label={t('animation.mode')}>
                    <button
                      type="button"
                      className={`dynamic-animation-mode-button ${selectedAnimationMode === 'none' ? 'active' : ''}`}
                      onClick={() => handleAnimationModeSelect('none')}
                      aria-pressed={selectedAnimationMode === 'none'}
                    >
                      <Ban size={18} strokeWidth={2.3} aria-hidden="true" />
                      <span>{t('animation.none')}</span>
                    </button>
                    <button
                      type="button"
                      className={`dynamic-animation-mode-button random ${selectedAnimationMode === 'random' ? 'active' : ''}`}
                      onClick={() => handleAnimationModeSelect('random')}
                      aria-pressed={selectedAnimationMode === 'random'}
                    >
                      <Shuffle size={18} strokeWidth={2.3} aria-hidden="true" />
                      <span>{t('animation.random')}</span>
                    </button>
                  </div>
                </section>

                <section className="dynamic-animation-preview-card">
                  <div className="dynamic-animation-carousel-meta" aria-live="polite">
                    <strong>
                      {t(getDynamicAnimationPreview(animationPreviewId).labelKey)}
                    </strong>
                    <span>{String(animationPreviewId).padStart(2, '0')} / {String(LAST_SELECTABLE_ANIMATION_ID).padStart(2, '0')}</span>
                  </div>

                  <div className="dynamic-animation-carousel">
                    <button
                      type="button"
                      className="dynamic-animation-arrow"
                      onClick={() => moveAnimationCursor(-1)}
                      aria-label={t('animation.previous')}
                      title={t('animation.previous')}
                    >
                      <ChevronLeft size={22} strokeWidth={2.4} />
                    </button>
                    <div
                      className="dynamic-animation-carousel-card"
                      onPointerDown={handleAnimationSwipeStart}
                      onPointerUp={handleAnimationSwipeEnd}
                      onPointerCancel={() => { animationSwipeStartRef.current = null }}
                    >
                      <DynamicAnimationPreview
                        animationId={animationPreviewId}
                        replayKey={`${selectedItem.id}:${animationPreviewId}:${animationPreviewSessionId}`}
                      />
                    </div>
                    <button
                      type="button"
                      className="dynamic-animation-arrow"
                      onClick={() => moveAnimationCursor(1)}
                      aria-label={t('animation.next')}
                      title={t('animation.next')}
                    >
                      <ChevronRight size={22} strokeWidth={2.4} />
                    </button>
                  </div>

                  <div className="dynamic-animation-preview-footer">
                    <span>
                      {selectedAnimationMode === 'none'
                        ? t('animation.none')
                        : t('animation.preview', { name: t(getDynamicAnimationPreview(animationPreviewId).labelKey) })}
                    </span>
                  </div>
                </section>

                <button
                  type="button"
                  className="dynamic-click-animation-range-button"
                  onClick={openClickAnimationRange}
                  aria-haspopup="dialog"
                >
                  <MousePointerClick size={19} strokeWidth={2.2} aria-hidden="true" />
                  <span>
                    <strong>{t('animation.clickRange')}</strong>
                    <small>{t('animation.selectedCount', { count: getDynamicClickAnimationIds(selectedItem).length })}</small>
                  </span>
                  <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            )}

            {visibleActiveTab === 'transform' && (
              <div className="dynamic-tool-body compact dynamic-property-body dynamic-property-transform-body">
                <div className="dynamic-transform-readout dynamic-transform-readout-clean">
                  <span>
                    <small>{t('control.scale')}</small>
                    <strong>{Math.round(selectedItemScale * 100)}%</strong>
                  </span>
                  <span>
                    <small>{t('control.rotation')}</small>
                    <strong>{selectedItemRotation.toFixed(0)}°</strong>
                  </span>
                </div>
                <section className="dynamic-transform-control-card">
                  <div className="dynamic-transform-stepper-row">
                    <div>
                      <small>{t('control.size')}</small>
                      <strong>{t('control.scale')}</strong>
                    </div>
                    <div className="dynamic-transform-stepper">
                      <button type="button" onClick={() => handleScaleNudge(-0.1)} aria-label={t('control.scale')}>-</button>
                      <span>{Math.round(selectedItemScale * 100)}%</span>
                      <button type="button" onClick={() => handleScaleNudge(0.1)} aria-label={t('control.scale')}>+</button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={MIN_ITEM_SCALE * 100}
                    max={MAX_ITEM_SCALE * 100}
                    step="1"
                    value={Math.round(selectedItemScale * 100)}
                    onChange={(event) => handleScaleSliderChange(Number(event.target.value))}
                    onPointerUp={flushPendingTransformPersist}
                    onPointerCancel={flushPendingTransformPersist}
                    onBlur={flushPendingTransformPersist}
                    aria-label={t('control.scale')}
                    className="ipad-slider"
                  />
                  <div className="dynamic-transform-stepper-row">
                    <div>
                      <small>{t('control.rotation')}</small>
                      <strong>{t('control.rotation')}</strong>
                    </div>
                    <div className="dynamic-transform-stepper">
                      <button type="button" onClick={() => handleRotationNudge(-5)} aria-label={t('control.rotation')}>-</button>
                      <span>{selectedItemRotation.toFixed(0)}°</span>
                      <button type="button" onClick={() => handleRotationNudge(5)} aria-label={t('control.rotation')}>+</button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={selectedItemRotation}
                    onChange={(event) => handleRotationSliderChange(Number(event.target.value))}
                    onPointerUp={flushPendingTransformPersist}
                    onPointerCancel={flushPendingTransformPersist}
                    onBlur={flushPendingTransformPersist}
                    aria-label={t('control.rotation')}
                    className="ipad-slider"
                  />
                </section>
                <div className="dynamic-deform-stack">
                  <label className="toggle-control wide dynamic-deform-toggle">
                    <input
                      type="checkbox"
                      checked={getItemFlipX(selectedItem)}
                      onChange={(event) => handleDeformChange('x', event.target.checked)}
                    />
                    <span className="dynamic-deform-toggle-label">
                      <FlipHorizontal2 size={16} strokeWidth={2.2} aria-hidden="true" />
                      <strong>{t('control.flipHorizontal')}</strong>
                    </span>
                    <span className="dynamic-deform-switch" aria-hidden="true" />
                  </label>
                  <label className="toggle-control wide dynamic-deform-toggle">
                    <input
                      type="checkbox"
                      checked={getItemFlipY(selectedItem)}
                      onChange={(event) => handleDeformChange('y', event.target.checked)}
                    />
                    <span className="dynamic-deform-toggle-label">
                      <FlipVertical2 size={16} strokeWidth={2.2} aria-hidden="true" />
                      <strong>{t('control.flipVertical')}</strong>
                    </span>
                    <span className="dynamic-deform-switch" aria-hidden="true" />
                  </label>
                </div>
                <div className="dynamic-transform-live-preview" aria-label={t('control.objectPreview')}>
                  <div
                    className="dynamic-transform-live-preview-object"
                    style={{
                      transform: `rotate(${selectedItemRotation}deg) scale(${getItemFlipX(selectedItem) ? -selectedItemScale : selectedItemScale}, ${getItemFlipY(selectedItem) ? -selectedItemScale : selectedItemScale})`
                    }}
                  >
                    <img
                      src={selectedItem.media.url}
                      alt={t('control.previewNamed', { name: selectedItem.name })}
                      draggable={false}
                    />
                  </div>
                  <span>{t('control.objectPreview')}</span>
                </div>
              </div>
            )}

            {visibleActiveTab === 'copy' && (
              <div className="dynamic-tool-body compact dynamic-property-body dynamic-property-copy-body">
                <div className="dynamic-copy-section-heading">
                  <span>{t('control.sourceObject')}</span>
                  <small>{t('control.availableCount', { count: Math.max(0, sortedItems.length - 1) })}</small>
                </div>
                <div className="copy-source-list">
                  {sortedItems.filter((item) => item.id !== selectedItem.id).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`copy-source-button ${copiedSourceItemId === item.id ? 'selected' : ''}`}
                      onClick={(event) => openCopyConfirm(item.id, event.currentTarget)}
                      aria-haspopup="dialog"
                    >
                      <img src={item.media.url} alt="" draggable={false} />
                      <span className="dynamic-copy-source-copy">
                        <strong>{item.name}</strong>
                        <small>{t('control.sourceObject')}</small>
                      </span>
                      <ChevronRight className="dynamic-copy-source-chevron" size={17} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  ))}
                  {sortedItems.length <= 1 && (
                    <span className="copy-empty">{t('control.noCopySource')}</span>
                  )}
                </div>
                {copyFeedbackItemId === selectedItem.id && (
                  <div className="dynamic-copy-feedback">{t('control.propertiesCopied')}</div>
                )}
              </div>
            )}
          </aside>
        )}

        {layerDragPreview && createPortal((() => {
          const draggedItem = group.items.find((item) => item.id === layerDragPreview.itemId)
          if (!draggedItem) return null
          const motionLabel = getTranslatedMotionLabel(draggedItem.moveMode)
          return (
            <div
              className="dynamic-layer-drag-preview dynamic-control-layer-drag-preview"
              style={{
                left: `${layerDragPreview.x}px`,
                top: `${layerDragPreview.y}px`,
                width: `${layerDragPreview.width}px`,
                height: `${layerDragPreview.height}px`
              }}
              aria-hidden="true"
            >
              <img src={draggedItem.media.url} alt="" />
              <span>
                <strong>{draggedItem.name}</strong>
                <small>{t('control.layerSummary', { motion: motionLabel, animation: draggedItem.animationId })}</small>
              </span>
            </div>
          )
        })(), document.body)}

        {backgroundDragPreview && createPortal((() => {
          const draggedBackground = backgrounds.find((background) => background.id === backgroundDragPreview.backgroundId)
          if (!draggedBackground) return null
          const order = backgrounds.findIndex((background) => background.id === draggedBackground.id) + 1
          return (
            <div
              className="dynamic-background-drag-preview"
              style={{
                left: `${backgroundDragPreview.x}px`,
                top: `${backgroundDragPreview.y}px`,
                width: `${backgroundDragPreview.width}px`,
                height: `${backgroundDragPreview.height}px`
              }}
              aria-hidden="true"
            >
              <span className="background-order">{String(order).padStart(2, '0')}</span>
              {draggedBackground.type === 'video' ? (
                <video src={draggedBackground.url} muted playsInline />
              ) : (
                <img src={draggedBackground.url} alt="" />
              )}
              <span className="background-copy">
                <strong>{draggedBackground.name}</strong>
                <small>{draggedBackground.type === 'video' ? t('background.video') : t('background.image')}</small>
              </span>
            </div>
          )
        })(), document.body)}

        {!previewMode && appearPanelOpen && (
          <aside className="dynamic-appear-popover" aria-label={t('control.appearanceSettings')}>
            <div className="drawer-heading">
              <div>
                <p className="eyebrow">{t('control.stage')}</p>
                <h2>{t('control.appearanceSettings')}</h2>
              </div>
              <button type="button" className="mini-action-button" onClick={() => setAppearPanelOpen(false)}>
                {t('common.close')}
              </button>
            </div>
            <div className="dynamic-mode-segmented">
              <button
                type="button"
                className={group.appearMode === 'sequence' ? 'active' : ''}
                onClick={() => setAppearMode('sequence')}
              >
                {t('control.appearSequence')}
              </button>
              <button
                type="button"
                className={group.appearMode === 'all' ? 'active' : ''}
                onClick={() => setAppearMode('all')}
              >
                {t('control.appearAll')}
              </button>
            </div>
            <label className={`dynamic-percent-control ${group.appearMode === 'all' ? 'disabled' : ''}`}>
              <span>{t('control.intervalSeconds', { value: appearIntervalSeconds })}</span>
              <input
                type="range"
                min={MIN_DYNAMIC_APPEAR_INTERVAL_MS}
                max={MAX_DYNAMIC_APPEAR_INTERVAL_MS}
                step="100"
                value={appearIntervalMs}
                disabled={group.appearMode === 'all'}
                onChange={(event) => setAppearInterval(Number(event.target.value))}
                className="ipad-slider"
              />
            </label>
            <p className="dynamic-appear-order-note">{t('control.playInLayerOrder')}</p>
          </aside>
        )}

        </div>
      </section>

      {!previewMode && backgroundPanelOpen && (
        <div
          className="dynamic-background-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeBackgroundEditor()
          }}
        >
          <section
            className="dynamic-background-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="background-editor-title"
          >
            <div className="drawer-heading dynamic-background-modal-heading">
              <div>
                <p className="eyebrow">{t('control.stageBackground')}</p>
                <h2 id="background-editor-title">{t('control.editBackground')} <span>{t('control.assetCount', { count: backgrounds.length })}</span></h2>
              </div>
              <button
                type="button"
                className="dynamic-panel-close"
                onClick={closeBackgroundEditor}
                aria-label={t('control.closeBackgroundEditor')}
                title={t('common.close')}
              >
                ×
              </button>
            </div>

            <div className={`dynamic-background-playback ${group.backgroundPlayMode === 'fixed' ? 'fixed-mode' : ''}`}>
              <div className="dynamic-mode-segmented" aria-label={t('control.backgroundPlaybackMode')}>
                {([
                  ['fixed', 'control.backgroundFixed'],
                  ['random', 'control.backgroundRandom'],
                  ['sequence', 'control.backgroundSequence']
                ] as const).map(([mode, labelKey]) => (
                  <button
                    key={mode}
                    type="button"
                    className={group.backgroundPlayMode === mode ? 'active' : ''}
                    onClick={() => setBackgroundPlayback(mode)}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>
              {group.backgroundPlayMode !== 'fixed' && (
                <div className="dynamic-interval-input">
                  <span>{t('control.switchInterval')}</span>
                  <span className="dynamic-interval-fields">
                    <IntervalWheel
                      value={backgroundWheelValue}
                      min={backgroundWheelMin}
                      max={backgroundWheelMax}
                      step={backgroundWheelStep}
                      inputMode="decimal"
                      onChange={handleBackgroundIntervalWheelChange}
                      onCommit={commitBackgroundIntervalDraft}
                      ariaLabel={t('control.backgroundInterval')}
                    />
                    <select
                      value={backgroundIntervalUnit}
                      onChange={(event) => handleBackgroundIntervalUnitChange(event.target.value as BackgroundIntervalUnit)}
                      aria-label={t('control.backgroundIntervalUnit')}
                    >
                      <option value="seconds">{t('control.seconds')}</option>
                      <option value="minutes">{t('control.minutes')}</option>
                    </select>
                  </span>
                </div>
              )}
            </div>

            <div className="dynamic-background-modal-toolbar">
              <label className="dynamic-background-select-all">
                <input
                  type="checkbox"
                  checked={allBackgroundsSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someBackgroundsSelected
                  }}
                  onChange={toggleAllBackgroundSelection}
                />
                <span aria-hidden="true" />
                <strong>{t('common.selectAll')}</strong>
              </label>
              <span>{t('control.dragBackgroundHint')}</span>
              <strong>{t('common.selectedCount', { count: selectedBackgroundIds.length })}</strong>
            </div>

            <div
              ref={backgroundListRef}
              className={`background-library-list ${draggedBackgroundId ? 'is-reordering' : ''}`}
            >
              {backgrounds.map((background, index) => (
                <article
                  key={background.id}
                  data-background-id={background.id}
                  className={`background-library-card ${group.background?.id === background.id ? 'active' : ''} ${selectedBackgroundIds.includes(background.id) ? 'is-checked' : ''} ${pressedBackgroundId === background.id ? 'is-pressed' : ''} ${draggedBackgroundId === background.id ? 'dragging' : ''} ${backgroundDropHint?.backgroundId === background.id ? `drop-${backgroundDropHint.placement}` : ''}`}
                  onPointerDown={(event) => handleBackgroundCardPointerDown(event, background.id)}
                  onClickCapture={handleBackgroundCardClickCapture}
                  onContextMenu={(event) => event.preventDefault()}
                  aria-grabbed={draggedBackgroundId === background.id}
                >
                  <label
                    className="background-check"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={t('common.selectNamed', { name: background.name })}
                  >
                    <input
                      type="checkbox"
                      checked={selectedBackgroundIds.includes(background.id)}
                      onChange={() => toggleBackgroundSelection(background.id)}
                    />
                    <span aria-hidden="true" />
                  </label>
                  <button type="button" className="background-preview-button" onClick={() => handleBackgroundSelect(background.id)}>
                    <span className="background-order">{String(index + 1).padStart(2, '0')}</span>
                    {background.type === 'video' ? (
                      <video src={background.url} muted playsInline />
                    ) : (
                      <img src={background.url} alt={background.name} />
                    )}
                    <span className="background-copy">
                      <strong>{background.name}</strong>
                      <small>{background.type === 'video' ? t('background.video') : t('background.image')}</small>
                    </span>
                  </button>
                </article>
              ))}
              {backgrounds.length === 0 && (
                <div className="background-empty-state">{t('control.noBackgrounds')}</div>
              )}
            </div>

            <div className="background-drawer-actions dynamic-background-modal-actions">
              <button
                type="button"
                className="ipad-button danger-button"
                disabled={selectedBackgroundIds.length === 0}
                onClick={handleBackgroundDelete}
              >
                {t('control.deleteSelected')}
              </button>
              <button
                type="button"
                className="ipad-button primary-button"
                onClick={() => backgroundInputRef.current?.click()}
              >
                {t('control.addBackground')}
              </button>
            </div>
          </section>
        </div>
      )}

      {isImagePreviewOpen && selectedItem && (
        <div className="dynamic-modal-overlay dynamic-image-preview-overlay" role="presentation">
          <div className="settings-scrim" aria-hidden="true" />
          <section
            className="dynamic-image-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dynamic-image-preview-title"
          >
            <div className="dynamic-image-preview-heading">
              <div>
                <p className="eyebrow">{t('control.objectPreview')}</p>
                <h2 id="dynamic-image-preview-title">{selectedItem.name}</h2>
              </div>
              <div className="dynamic-image-preview-tools">
                <span aria-live="polite">{Math.round(imagePreviewTransform.scale * 100)}%</span>
                <button
                  type="button"
                  className="dynamic-image-preview-tool"
                  onClick={resetImagePreview}
                  disabled={imagePreviewTransform.scale === 1 && imagePreviewTransform.x === 0 && imagePreviewTransform.y === 0}
                  aria-label={t('control.resetImagePreview')}
                  title={t('control.resetPreview')}
                >
                  <RotateCcw size={18} strokeWidth={2.2} />
                </button>
                <button
                  ref={imagePreviewCloseButtonRef}
                  type="button"
                  className="dynamic-panel-close"
                  onClick={closeImagePreview}
                  aria-label={t('control.closeImagePreview')}
                  title={t('common.close')}
                >
                  <X size={19} strokeWidth={2.3} />
                </button>
              </div>
            </div>
            <div
              ref={imagePreviewViewportRef}
              className={`dynamic-image-preview-viewport ${imagePreviewTransform.scale > 1 ? 'is-zoomed' : ''}`}
              onPointerDown={handleImagePreviewPointerDown}
              onPointerMove={handleImagePreviewPointerMove}
              onPointerUp={handleImagePreviewPointerEnd}
              onPointerCancel={handleImagePreviewPointerEnd}
              onWheel={handleImagePreviewWheel}
              onDoubleClick={resetImagePreview}
              onContextMenu={(event) => event.preventDefault()}
            >
              <img
                src={selectedItem.media.url}
                alt={selectedItem.name}
                draggable={false}
                style={{
                  transform: `translate3d(${imagePreviewTransform.x}px, ${imagePreviewTransform.y}px, 0) scale(${imagePreviewTransform.scale})`
                }}
              />
            </div>
          </section>
        </div>
      )}

      {copyConfirmOpen && selectedItem && copySourceItem && (
        <div className="dynamic-modal-overlay dynamic-copy-modal-overlay" role="presentation">
          <button
            type="button"
            className="settings-scrim"
            onClick={closeCopyConfirm}
            aria-label={t('control.cancelCopy')}
          />
          <section className="dynamic-copy-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="copy-confirm-title">
            <div className="dynamic-copy-confirm-heading">
              <div>
                <p className="eyebrow">{t('control.copyProperties')}</p>
                <h2 id="copy-confirm-title">{t('control.confirmCopyProperties')}</h2>
              </div>
              <button
                ref={copyConfirmCloseButtonRef}
                type="button"
                className="dynamic-panel-close"
                onClick={closeCopyConfirm}
                disabled={isCopying}
                aria-label={t('common.close')}
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="dynamic-copy-route">
              <div className="dynamic-copy-route-item">
                <img src={copySourceItem.media.url} alt={copySourceItem.name} />
                <span>{t('control.source')}</span>
                <strong>{copySourceItem.name}</strong>
              </div>
              <span className="dynamic-copy-route-arrow" aria-hidden="true">→</span>
              <div className="dynamic-copy-route-item target">
                <img src={selectedItem.media.url} alt={selectedItem.name} />
                <span>{t('control.target')}</span>
                <strong>{selectedItem.name}</strong>
              </div>
            </div>

            <div className="dynamic-copy-confirm-selection">
              <div className="dynamic-copy-section-heading copy-options-heading">
                <span>{t('control.copyContent')}</span>
                <button
                  type="button"
                  className="dynamic-copy-select-all"
                  onClick={() => setSelectedCopyFields(
                    selectedCopyFields.length === ALL_COPY_FIELDS.length ? [] : [...ALL_COPY_FIELDS]
                  )}
                  disabled={isCopying}
                >
                  {selectedCopyFields.length === ALL_COPY_FIELDS.length ? t('common.deselectAll') : t('common.selectAll')}
                </button>
              </div>
              <div className="dynamic-copy-options dynamic-copy-modal-options" aria-label={t('control.copyContent')}>
                {copyFieldOptions.map((option) => (
                  <label key={option.id} className="dynamic-copy-option">
                    <input
                      type="checkbox"
                      checked={selectedCopyFields.includes(option.id)}
                      onChange={() => toggleCopyField(option.id)}
                      disabled={isCopying}
                    />
                    <span className="dynamic-copy-checkbox" aria-hidden="true" />
                    <strong>{t(option.labelKey)}</strong>
                  </label>
                ))}
              </div>
            </div>

            <p className="dynamic-copy-confirm-note">{t('control.copyReplaceNote')}</p>
            {copyErrorKey && <p className="dynamic-copy-error" role="alert">{t(copyErrorKey)}</p>}
            <div className="dynamic-copy-confirm-actions">
              <button
                type="button"
                className="ipad-button secondary-button"
                onClick={closeCopyConfirm}
                disabled={isCopying}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="ipad-button primary-button"
                onClick={() => void handleCopyConfirm()}
                disabled={selectedCopyFields.length === 0 || isCopying}
              >
                {isCopying ? t('control.copying') : t('control.confirmCopy')}
              </button>
            </div>
          </section>
        </div>
      )}

      {clickAnimationRangeOpen && selectedItem && (
        <div className="dynamic-modal-overlay dynamic-click-range-modal-overlay" role="presentation">
          <section
            className="dynamic-click-range-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dynamic-click-range-title"
          >
            <div className="dynamic-click-range-heading">
              <div>
                <p className="eyebrow">{t('control.objectProperties')}</p>
                <h2 id="dynamic-click-range-title">{t('animation.clickRangeTitle')}</h2>
                <p>{t('animation.clickRangeHint')}</p>
              </div>
              <button
                ref={clickAnimationRangeCloseButtonRef}
                type="button"
                className="dynamic-panel-close"
                onClick={closeClickAnimationRange}
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="dynamic-click-range-toolbar">
              <span>{t('animation.selectedCount', { count: clickAnimationDraft.length })}</span>
              <button
                type="button"
                className="dynamic-copy-select-all"
                onClick={() => setClickAnimationDraft(
                  clickAnimationDraft.length === DYNAMIC_ANIMATION_IDS.length
                    ? []
                    : [...DYNAMIC_ANIMATION_IDS]
                )}
              >
                {clickAnimationDraft.length === DYNAMIC_ANIMATION_IDS.length
                  ? t('common.deselectAll')
                  : t('common.selectAll')}
              </button>
            </div>

            <div className="dynamic-click-range-options" aria-label={t('animation.clickRangeTitle')}>
              {DYNAMIC_ANIMATION_IDS.map((animationId) => {
                const definition = getDynamicAnimationPreview(animationId)
                const checked = clickAnimationDraft.includes(animationId)
                return (
                  <label key={animationId} className={`dynamic-click-range-option ${checked ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleClickAnimationDraft(animationId)}
                    />
                    <span className="dynamic-click-range-check" aria-hidden="true">
                      {checked ? <Check size={14} strokeWidth={3} /> : null}
                    </span>
                    <span className="dynamic-click-range-number">{String(animationId).padStart(2, '0')}</span>
                    <strong>{t(definition.labelKey)}</strong>
                  </label>
                )
              })}
            </div>

            <div className="dynamic-click-range-actions">
              <button type="button" className="ipad-button secondary-button" onClick={closeClickAnimationRange}>
                {t('animation.clickRangeCancel')}
              </button>
              <button
                type="button"
                className="ipad-button primary-button"
                onClick={confirmClickAnimationRange}
                disabled={clickAnimationDraft.length === 0}
              >
                {t('animation.clickRangeConfirm')}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default DynamicControlPage
