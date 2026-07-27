import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Maximize2, Pencil, RotateCcw, X } from 'lucide-react'
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
import { syncDynamicGroupToReceiver } from '../services/dynamicArtReceiverSync.ts'
import { playUiSound } from '../services/uiFeedback.ts'
import DynamicAnimationPreview, {
  DYNAMIC_ANIMATION_PREVIEWS,
  getDynamicAnimationPreview
} from './DynamicAnimationPreview.tsx'

type ControlTab = 'motion' | 'animation' | 'transform' | 'copy'
type GestureMode = 'none' | 'drag' | 'pinch'
type BackgroundIntervalUnit = 'seconds' | 'minutes'

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
const HORIZONTAL_WAVE_CYCLES = 7
const HORIZONTAL_STAGE_MARGIN = 260
const LAYER_TOUCH_HOLD_MS = 180
const LAYER_MOUSE_DRAG_THRESHOLD = 6
const LAYER_TOUCH_SCROLL_THRESHOLD = 18
const LAYER_AUTO_SCROLL_EDGE = 52
const LAYER_AUTO_SCROLL_MAX_SPEED = 14
const MAX_IMAGE_PREVIEW_SCALE = 5

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
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

const getTrackLabel = (track: DynamicMoveTrack) => {
  if (track === 'top') return '上'
  if (track === 'bottom') return '下'
  return '中'
}

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

const motionOptions: { id: DynamicMoveMode; label: string; icon: string }[] = [
  { id: 'none', label: '停止', icon: 'none' },
  { id: 'verticalWave', label: '上下', icon: 'wave' },
  { id: 'left', label: '左移', icon: 'left' },
  { id: 'right', label: '右移', icon: 'right' },
  { id: 'orbit', label: '360回環', icon: 'orbit' },
  { id: 'random', label: '隨機', icon: 'random' }
]

const trackOptions: { id: DynamicMoveTrack; label: string }[] = [
  { id: 'top', label: '上' },
  { id: 'middle', label: '中' },
  { id: 'bottom', label: '下' }
]

const copyFieldOptions: { id: DynamicCopyField; label: string }[] = [
  { id: 'motion', label: '移動方式' },
  { id: 'animation', label: '動畫' },
  { id: 'size', label: '大小' },
  { id: 'deform', label: '變形' }
]

const ALL_COPY_FIELDS = copyFieldOptions.map((option) => option.id)

const getInitialItemId = (items: DynamicItem[], itemId = '') => {
  if (itemId && items.some((item) => item.id === itemId)) return itemId
  return items[0]?.id ?? ''
}

const getItemTrack = (item: DynamicItem) => item.moveTrack ?? getTrack(item.position.y)
const getItemMoveSpeed = (item: DynamicItem) => clamp(item.moveSpeed ?? DEFAULT_MOVE_SPEED, 0, 100)
const getItemFlipX = (item: DynamicItem) => item.flipX ?? false
const getItemFlipY = (item: DynamicItem) => item.flipY ?? false

const getTrackBounds = (track: DynamicMoveTrack) => {
  if (track === 'top') return { start: 0, end: 1 / 3 }
  if (track === 'bottom') return { start: 2 / 3, end: 1 }
  return { start: 1 / 3, end: 2 / 3 }
}

const getMoveDuration = (speed: number, baseSeconds = 5.5) => {
  const ratio = clamp(speed, 1, 100) / 100
  return lerp(baseSeconds * 1.55, baseSeconds * 0.46, ratio)
}

const getPositiveDimension = (value?: number) => (
  Number.isFinite(value) && value && value > 0 ? value : undefined
)

const getDynamicItemPreviewSize = (
  item: DynamicItem,
  cachedSize: MediaSize | undefined,
  stageSize: { width: number; height: number }
) => {
  const naturalWidth = getPositiveDimension(item.media.width)
    ?? cachedSize?.width
    ?? DEFAULT_ITEM_NATURAL_WIDTH
  const naturalHeight = getPositiveDimension(item.media.height)
    ?? cachedSize?.height
    ?? DEFAULT_ITEM_NATURAL_HEIGHT
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

const getMotionPreviewStyle = (
  item: DynamicItem,
  isManipulating: boolean,
  stageSize: { width: number; height: number }
): React.CSSProperties => {
  const stageWidth = stageSize.width || DEFAULT_STAGE_PREVIEW_WIDTH
  const stageHeight = stageSize.height || DEFAULT_STAGE_PREVIEW_HEIGHT
  const moveTrack = getItemTrack(item)
  const isLoopMove = !isManipulating && (item.moveMode === 'left' || item.moveMode === 'right')
  const amplitudeRatio = clamp(item.movePercent, 0, 100) / 100
  const localRatio = Math.min(amplitudeRatio / 0.5, 1)
  const fullRatio = Math.max((amplitudeRatio - 0.5) / 0.5, 0)
  const { start: trackStart, end: trackEnd } = getTrackBounds(moveTrack)
  const localUpLimit = Math.max((item.position.y - trackStart) * stageHeight - 28, 0)
  const localDownLimit = Math.max((trackEnd - item.position.y) * stageHeight - 28, 0)
  const outPadding = Math.max(stageHeight * 0.22, 120)
  const localWaveUp = -localUpLimit * localRatio
  const localWaveDown = localDownLimit * localRatio
  const fullWaveUp = -(item.position.y * stageHeight + outPadding)
  const fullWaveDown = (1 - item.position.y) * stageHeight + outPadding
  const waveUp = Math.round(lerp(localWaveUp, fullWaveUp, fullRatio))
  const waveDown = Math.round(lerp(localWaveDown, fullWaveDown, fullRatio))
  const randomX = Math.round(amplitudeRatio * stageWidth * 0.18)
  const randomY = Math.round(amplitudeRatio * stageHeight * 0.24)
  const horizontalWaveAmplitude = Math.round(stageHeight * 0.5 * amplitudeRatio)
  const horizontalWaveSoft = Math.round(horizontalWaveAmplitude * 0.707)
  const horizontalWaveUp = -horizontalWaveAmplitude
  const horizontalWaveDown = horizontalWaveAmplitude
  const horizontalMarginRatio = HORIZONTAL_STAGE_MARGIN / RUNTIME_STAGE_WIDTH
  const horizontalTravel = Math.round(stageWidth * (1 + horizontalMarginRatio * 2))
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
    left: isLoopMove
      ? `${(item.moveMode === 'left' ? 1 + horizontalMarginRatio : -horizontalMarginRatio) * 100}%`
      : `${item.position.x * 100}%`,
    top: isLoopMove
      ? `${clamp(item.position.y, -0.2, 1.2) * 100}%`
      : `${item.position.y * 100}%`,
    zIndex: 10 + item.order,
    '--move-duration': `${moveDuration}s`,
    '--move-horizontal-wave-duration': `${moveDuration / HORIZONTAL_WAVE_CYCLES}s`,
    '--move-ratio': String(amplitudeRatio),
    '--move-wave-down': `${waveDown}px`,
    '--move-wave-up': `${waveUp}px`,
    '--move-horizontal-wave-down': `${horizontalWaveDown}px`,
    '--move-horizontal-wave-up': `${horizontalWaveUp}px`,
    '--move-horizontal-wave-down-soft': `${horizontalWaveSoft}px`,
    '--move-horizontal-wave-up-soft': `${-horizontalWaveSoft}px`,
    '--move-horizontal-travel': `${horizontalTravel}px`,
    '--move-horizontal-travel-negative': `${-horizontalTravel}px`,
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
  const [copyError, setCopyError] = useState('')
  const [copyFeedbackItemId, setCopyFeedbackItemId] = useState('')
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
  const [imagePreviewTransform, setImagePreviewTransform] = useState<ImagePreviewTransform>({ scale: 1, x: 0, y: 0 })
  const [isEditingItemName, setIsEditingItemName] = useState(false)
  const [itemNameDraft, setItemNameDraft] = useState('')
  const [itemNameError, setItemNameError] = useState('')
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
  const [isAddingLayerItem, setIsAddingLayerItem] = useState(false)
  const [receiverSyncStatus, setReceiverSyncStatus] = useState('')
  const [receiverSyncError, setReceiverSyncError] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const [previewReplayId, setPreviewReplayId] = useState(0)
  const [previewBackgroundId, setPreviewBackgroundId] = useState(group.background?.id ?? '')

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
        animationId: item.animationId,
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

  useEffect(() => {
    latestGroupRef.current = group
  }, [group])

  useEffect(() => {
    setPreviewMode(false)
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
    setIsCopying(false)
    setCopyError('')
    setCopiedSourceItemId('')
    setSelectedCopyFields([...ALL_COPY_FIELDS])
    setIsImagePreviewOpen(false)
    setImagePreviewTransform({ scale: 1, x: 0, y: 0 })
    setIsEditingItemName(false)
    setItemNameDraft('')
    setItemNameError('')
    setIsSavingItemName(false)
    setSelectedLayerItemIds([])
    setSelectedBackgroundIds([])
    setPreviewBackgroundId(group.background?.id ?? '')
  }, [group.id])

  useEffect(() => {
    setCopyConfirmOpen(false)
    setCopyError('')
    setCopiedSourceItemId((currentId) => currentId === selectedItemId ? '' : currentId)
    setIsImagePreviewOpen(false)
    setImagePreviewTransform({ scale: 1, x: 0, y: 0 })
    imagePreviewPointersRef.current.clear()
    imagePreviewGestureRef.current = null
    setIsEditingItemName(false)
    setItemNameError('')
    setItemNameDraft(latestGroupRef.current.items.find((item) => item.id === selectedItemId)?.name ?? '')
  }, [selectedItemId])

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
    if (!isImagePreviewOpen && !copyConfirmOpen) return undefined
    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isImagePreviewOpen) {
        setIsImagePreviewOpen(false)
        setImagePreviewTransform({ scale: 1, x: 0, y: 0 })
        window.requestAnimationFrame(() => propertyThumbnailButtonRef.current?.focus({ preventScroll: true }))
        return
      }
      if (isCopying) return
      setCopyConfirmOpen(false)
      setCopyError('')
      window.requestAnimationFrame(() => copyReturnFocusRef.current?.focus({ preventScroll: true }))
    }
    window.addEventListener('keydown', handleModalKeyDown)
    return () => window.removeEventListener('keydown', handleModalKeyDown)
  }, [copyConfirmOpen, isCopying, isImagePreviewOpen])

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

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined

    const updateStageSize = () => {
      const rect = stage.getBoundingClientRect()
      setStageSize({ width: rect.width, height: rect.height })
    }

    updateStageSize()

    if (!window.ResizeObserver) {
      window.addEventListener('resize', updateStageSize)
      return () => window.removeEventListener('resize', updateStageSize)
    }

    const observer = new ResizeObserver(updateStageSize)
    observer.observe(stage)
    return () => observer.disconnect()
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

    setReceiverSyncError('')
    void syncDynamicGroupToReceiver({
      group,
      ip: wsIp,
      port: dynamicPort,
      onStatus: (status) => {
        if (!cancelled) setReceiverSyncStatus(status.label)
      }
    })
      .then((synced) => {
        if (cancelled || !synced) return
        setReceiverSyncStatus('作品檔案已同步')
        clearTimer = window.setTimeout(() => {
          setReceiverSyncStatus('')
        }, 1600)
      })
      .catch(() => {
        if (cancelled) return
        setReceiverSyncStatus('')
        setReceiverSyncError('作品檔案同步失敗，請確認藝術畫廊已開啟。')
        clearTimer = window.setTimeout(() => {
          setReceiverSyncError('')
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

    setSelectedItemId(itemId)
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
      replayId: options.replayId ?? previewReplayIdRef.current
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
    const replayId = enabled ? nextPreviewReplayId() : previewReplayIdRef.current
    setPreviewMode(enabled)
    if (enabled) {
      setToolOpen(false)
      setBackgroundPanelOpen(false)
      setAppearPanelOpen(false)
      setCopyConfirmOpen(false)
      setManipulatingItemId('')
    } else {
      setRightPanelCollapsed(false)
    }

    sendPreviewModeState(enabled, { replayId })
  }

  const handleStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (previewMode) {
      event.preventDefault()
      return
    }

    const target = event.target as HTMLElement
    const itemElement = target.closest<HTMLElement>('[data-dynamic-item-id]')
    const itemId = itemElement?.dataset.dynamicItemId ?? gestureItemIdRef.current
    if (!itemId) {
      setToolOpen(false)
      setBackgroundPanelOpen(false)
      setAppearPanelOpen(false)
      setRightPanelCollapsed(false)
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    if (itemElement && pointersRef.current.size === 0) {
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
      window.alert('每個作品檔案最多可建立 30 張圖片。')
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

  const handleItemImageLoad = (
    mediaId: string,
    event: React.SyntheticEvent<HTMLImageElement>
  ) => {
    const image = event.currentTarget
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
  }

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

  const commitBackgroundIntervalDraft = () => {
    const draftValue = Number(backgroundIntervalDraft)
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

    const confirmed = window.confirm('確定要刪除選取的背景？')
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
    const confirmed = window.confirm('確定要刪除此圖片？')
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

    const confirmed = window.confirm(`確定要刪除選取的 ${selectedLayerItemIds.length} 個物件？`)
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

  const handleAnimationSelect = (animationId: number) => {
    if (!selectedItem) return

    updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      animationId
    }), { persist: true, emit: false })
    sendDynamicEvent(wsIp, dynamicPort, 'ItemAnimation', {
      groupId: group.id,
      itemId: selectedItem.id,
      animationId
    })
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
    setItemNameError('')
    setIsEditingItemName(true)
  }

  const cancelItemNameEdit = () => {
    setItemNameDraft(selectedItem?.name ?? '')
    setItemNameError('')
    setIsEditingItemName(false)
  }

  const saveItemName = async () => {
    if (!selectedItem || isSavingItemName) return
    const nextName = itemNameDraft.trim()
    if (!nextName) {
      setItemNameError('名稱不能留空')
      propertyNameInputRef.current?.focus({ preventScroll: true })
      return
    }
    if (nextName === selectedItem.name) {
      cancelItemNameEdit()
      return
    }

    setIsSavingItemName(true)
    setItemNameError('')
    try {
      clearPendingTransformPersist()
      upsertDynamicGroup(latestGroupRef.current)
      const nextGroup = await updateDynamicItemMeta(group.id, selectedItem.id, { name: nextName })
      const updatedItem = nextGroup?.items.find((item) => item.id === selectedItem.id)
      if (!nextGroup || !updatedItem) {
        setItemNameError('無法儲存名稱，請重試')
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
      setItemNameError('無法儲存名稱，請重試')
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
    setCopyError('')
    setCopyConfirmOpen(true)
  }

  const closeCopyConfirm = () => {
    if (isCopying) return
    setCopyConfirmOpen(false)
    setCopyError('')
    window.requestAnimationFrame(() => copyReturnFocusRef.current?.focus({ preventScroll: true }))
  }

  const handleCopyConfirm = async () => {
    if (!selectedItem || !copySourceItem || selectedCopyFields.length === 0 || isCopying) return

    const targetItemId = selectedItem.id
    const sourceItemId = copySourceItem.id
    const copyFields = [...selectedCopyFields]
    setIsCopying(true)
    setCopyError('')
    try {
      const nextGroup = await copyDynamicItemSettings(
        group.id,
        targetItemId,
        sourceItemId,
        copyFields,
        latestGroupRef.current
      )
      if (!nextGroup) {
        setCopyError('無法複製屬性，請確認來源物件仍然存在。')
        return
      }

      latestGroupRef.current = nextGroup
      onGroupChange(nextGroup)
      const protocolFields = copyFields.flatMap((field) => {
        if (field === 'motion') return ['moveMode', 'movePercent', 'moveSpeed', 'moveTrack']
        if (field === 'animation') return ['animationId']
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
            animationId: copiedItem.animationId
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
      setCopyError('無法複製屬性，請重試。')
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
              停止預覽
            </button>
          </div>
        ) : (
          <>
            <div className="topbar-title-row">
              <button type="button" className="ipad-button ghost-button" onClick={onBack}>
                返回
              </button>
              <div className="min-w-0">
                <p className="eyebrow">作品檔案</p>
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
                出現設定
              </button>
              <button
                type="button"
                className={`ipad-button secondary-button control-action-button background-action ${backgroundPanelOpen ? 'active-action' : ''}`}
                onClick={() => backgroundPanelOpen ? closeBackgroundEditor() : openBackgroundEditor()}
                aria-expanded={backgroundPanelOpen}
                aria-haspopup="dialog"
              >
                編輯背景
              </button>
              <button
                type="button"
                className="ipad-button preview-action primary-button success-button"
                onClick={() => setPreviewModeEnabled(true)}
              >
                預覽
              </button>
            </div>
          </>
        )}
      </header>

      {(receiverSyncStatus || receiverSyncError) && (
        <div className={`status-toast ${receiverSyncError ? 'error' : 'success'}`}>
          {receiverSyncError || receiverSyncStatus}
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
                <span>請新增或選擇背景</span>
              </div>
            )}

            {sortedItems.map((item, index) => {
              const isManipulating = manipulatingItemId === item.id
              const isAmplitudeStatic = item.moveMode !== 'left' && item.moveMode !== 'right' && item.movePercent <= 0
              const shouldPlayMotion = previewMode && !isManipulating && !isAmplitudeStatic
              const motionMode = shouldPlayMotion ? item.moveMode : 'none'
              const appearDelayMs = previewMode && group.appearMode === 'sequence' ? index * appearIntervalMs : 0
              const itemPreviewSize = getDynamicItemPreviewSize(item, itemImageSizes[item.media.id], stageSize)
              return (
                <div
                  key={`${item.id}-${previewMode ? previewReplayId : 'edit'}`}
                  data-dynamic-item-id={item.id}
                  className={`dynamic-stage-item-motion move-${motionMode} ${isManipulating ? 'is-manipulating' : ''}`}
                  style={{
                    ...getMotionPreviewStyle(item, !shouldPlayMotion, stageSize),
                    width: `${itemPreviewSize.width}px`,
                    height: `${itemPreviewSize.height}px`,
                    '--motion-delay': `${appearDelayMs}ms`
                  } as React.CSSProperties}
                >
                  <div className="dynamic-stage-item-wave">
                    <div
                      className={`dynamic-stage-item-appear ${previewMode ? 'previewing' : ''}`}
                      style={{ '--appear-delay': `${appearDelayMs}ms` } as React.CSSProperties}
                    >
                      <img
                        src={item.media.url}
                        alt={item.name}
                        draggable={false}
                        onLoad={(event) => handleItemImageLoad(item.media.id, event)}
                        className={`dynamic-stage-item-visual ${!previewMode && selectedItem?.id === item.id ? 'active' : ''} ${copyFeedbackItemId === item.id ? 'copy-pulse' : ''}`}
                        style={{
                          transform: `rotate(${item.rotation}deg) scale(${getItemFlipX(item) ? -item.scale : item.scale}, ${getItemFlipY(item) ? -item.scale : item.scale})`
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
            </div>
          </div>

        {rightPanelMode === 'layers' && (
          <aside
            className="dynamic-layer-panel"
            aria-label="圖層"
            style={stageSize.height > 0 ? { height: `${stageSize.height}px` } : undefined}
          >
            <div className="dynamic-layer-header">
              <div>
                <p className="eyebrow">舞台結構</p>
                <h2>圖層 <span>{group.items.length}/{MAX_DYNAMIC_ITEMS_PER_GROUP}</span></h2>
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
                aria-label="新增物件"
                title="新增物件"
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
                aria-label="收起圖層"
                title="收起圖層"
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
                <strong>全選</strong>
              </label>
              <span className="dynamic-layer-selected-count">已選 {selectedLayerItemIds.length}</span>
              <button
                type="button"
                className="dynamic-layer-bulk-delete danger-inline-button"
                disabled={selectedLayerItemIds.length === 0}
                onClick={handleLayerBulkDelete}
              >
                刪除
              </button>
            </div>

            <div
              ref={layerListRef}
              className={`dynamic-layer-list ${draggedLayerItemId ? 'is-reordering' : ''}`}
            >
              {layerItems.map((item) => {
                const motionLabel = motionOptions.find((option) => option.id === item.moveMode)?.label ?? '停止'
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
                      aria-label={`選取 ${item.name}`}
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
                        <small>{motionLabel} · 動畫 {item.animationId}</small>
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
                        aria-label={`開啟 ${item.name} 的物件屬性`}
                        title="物件屬性"
                      >
                        屬性
                      </button>
                      <button
                        type="button"
                        className="dynamic-layer-delete-button"
                        onClick={() => handleItemDelete(item.id)}
                        aria-label={`刪除 ${item.name}`}
                        title="刪除物件"
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
            aria-label="展開圖層"
            title="展開圖層"
          >
            圖層
          </button>
        )}

        {rightPanelMode === 'object' && selectedItem && (
          <aside
            className="dynamic-tool-panel side-right dynamic-property-overlay-panel"
            aria-label="物件屬性"
            style={stageSize.height > 0 ? { height: `${stageSize.height}px` } : undefined}
          >
            <div className={`dynamic-tool-header ${isEditingItemName ? 'is-renaming' : ''}`}>
              <div className="dynamic-tool-title">
                <button
                  ref={propertyThumbnailButtonRef}
                  type="button"
                  className="dynamic-property-thumbnail-button"
                  onClick={openImagePreview}
                  aria-label={`預覽 ${selectedItem.name}`}
                  title="預覽圖片"
                >
                  <img src={selectedItem.media.url} alt="" draggable={false} />
                  <span className="dynamic-property-thumbnail-icon" aria-hidden="true">
                    <Maximize2 size={14} strokeWidth={2.4} />
                  </span>
                </button>
                <div className="dynamic-property-title-copy">
                  <p className="eyebrow">物件屬性</p>
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
                          if (itemNameError) setItemNameError('')
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
                        aria-label="物件名稱"
                        aria-invalid={Boolean(itemNameError)}
                        aria-describedby={itemNameError ? 'dynamic-item-name-error' : undefined}
                      />
                      <button
                        type="button"
                        className="dynamic-property-name-action cancel"
                        onClick={cancelItemNameEdit}
                        disabled={isSavingItemName}
                        aria-label="取消修改名稱"
                        title="取消"
                      >
                        <X size={15} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        className="dynamic-property-name-action confirm"
                        onClick={() => void saveItemName()}
                        disabled={isSavingItemName || !itemNameDraft.trim()}
                        aria-label="儲存物件名稱"
                        title="儲存"
                      >
                        <Check size={15} strokeWidth={2.7} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="dynamic-property-name-button"
                      onClick={startItemNameEdit}
                      aria-label={`修改物件名稱：${selectedItem.name}`}
                      title="修改名稱"
                    >
                      <span>{selectedItem.name}</span>
                      <Pencil size={13} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  )}
                  {itemNameError && (
                    <span id="dynamic-item-name-error" className="dynamic-property-name-error" role="alert">
                      {itemNameError}
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
                  setItemNameError('')
                }}
                aria-label="返回圖層"
                title="返回圖層"
              >
                ×
              </button>
            </div>

            <div className="tool-tabs dynamic-tool-tabs">
              {[
                { id: 'motion', label: '移動方式' },
                { id: 'animation', label: '動畫' },
                { id: 'transform', label: '變形' },
                { id: 'copy', label: '屬性複製' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`tool-tab ${visibleActiveTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id as ControlTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {visibleActiveTab === 'motion' && (
              <div className="dynamic-tool-body">
                <div className="motion-button-row">
                  {motionOptions.map((motion) => (
                    <button
                      key={motion.id}
                      type="button"
                      className={`motion-mode-button ${selectedItem.moveMode === motion.id ? 'active' : ''}`}
                      onClick={() => handleMotionChange(motion.id)}
                    >
                      <span className={`motion-icon motion-icon-${motion.icon}`} />
                      <strong>{motion.label}</strong>
                    </button>
                  ))}
                </div>
                <label className="dynamic-percent-control">
                  <span>幅度 {selectedItem.movePercent}% · 軌道 {getTrackLabel(activeTrack)}</span>
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
                  <span>速度 {selectedMoveSpeed}%</span>
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
                <div className="dynamic-track-selector" aria-label="軌道選擇">
                  <span>軌道</span>
                  <div className="dynamic-track-buttons">
                    {trackOptions.map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        className={activeTrack === track.id ? 'active' : ''}
                        onClick={() => handleMoveTrackChange(track.id)}
                      >
                        {track.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {visibleActiveTab === 'animation' && (
              <div className="dynamic-tool-body compact">
                <div className="animation-grid dynamic-animation-grid">
                  {DYNAMIC_ANIMATION_PREVIEWS.map((animation) => (
                    <button
                      key={animation.id}
                      type="button"
                      className={`animation-tile ${selectedItem.animationId === animation.id ? 'active' : ''}`}
                      onClick={() => handleAnimationSelect(animation.id)}
                    >
                      <span className={`animation-tile-icon animation-tile-icon-${animation.className}`} aria-hidden="true">
                        <span />
                      </span>
                      <span>{animation.shortLabel}</span>
                    </button>
                  ))}
                </div>
                <div className="dynamic-animation-preview">
                  <DynamicAnimationPreview animationId={selectedItem.animationId} />
                  <strong>{getDynamicAnimationPreview(selectedItem.animationId).label}</strong>
                </div>
              </div>
            )}

            {visibleActiveTab === 'transform' && (
              <div className="dynamic-tool-body compact">
                <div className="dynamic-transform-readout dynamic-transform-readout-clean">
                  <span>
                    <small>縮放</small>
                    <strong>{Math.round(selectedItem.scale * 100)}%</strong>
                  </span>
                  <span>
                    <small>旋轉</small>
                    <strong>{selectedItem.rotation.toFixed(0)}°</strong>
                  </span>
                </div>
                <div className="control-row">
                  <button type="button" className="scale-step-button" onClick={() => handleScaleNudge(-0.1)}>-</button>
                  <strong>縮放</strong>
                  <button type="button" className="scale-step-button" onClick={() => handleScaleNudge(0.1)}>+</button>
                </div>
                <div className="control-row">
                  <button type="button" className="scale-step-button" onClick={() => handleRotationNudge(-5)}>-</button>
                  <strong>旋轉</strong>
                  <button type="button" className="scale-step-button" onClick={() => handleRotationNudge(5)}>+</button>
                </div>
                <div className="dynamic-deform-stack">
                  <label className="toggle-control wide">
                    <input
                      type="checkbox"
                      checked={getItemFlipX(selectedItem)}
                      onChange={(event) => handleDeformChange('x', event.target.checked)}
                    />
                    <span>水平翻轉</span>
                  </label>
                  <label className="toggle-control wide">
                    <input
                      type="checkbox"
                      checked={getItemFlipY(selectedItem)}
                      onChange={(event) => handleDeformChange('y', event.target.checked)}
                    />
                    <span>垂直翻轉</span>
                  </label>
                </div>
              </div>
            )}

            {visibleActiveTab === 'copy' && (
              <div className="dynamic-tool-body compact">
                <div className="dynamic-copy-section-heading">
                  <span>來源物件</span>
                  <small>{Math.max(0, sortedItems.length - 1)} 個可選</small>
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
                      <img src={item.media.url} alt={item.name} />
                      <span>{item.name}</span>
                      <span className="copy-source-action" aria-hidden="true">
                        <span>→</span>
                      </span>
                    </button>
                  ))}
                  {sortedItems.length <= 1 && (
                    <span className="copy-empty">暫無其他物件可複製。</span>
                  )}
                </div>
                {copyFeedbackItemId === selectedItem.id && (
                  <div className="dynamic-copy-feedback">屬性已複製</div>
                )}
              </div>
            )}
          </aside>
        )}

        {layerDragPreview && (() => {
          const draggedItem = group.items.find((item) => item.id === layerDragPreview.itemId)
          if (!draggedItem) return null
          const motionLabel = motionOptions.find((option) => option.id === draggedItem.moveMode)?.label ?? '停止'
          return (
            <div
              className="dynamic-layer-drag-preview"
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
                <small>{motionLabel} · 動畫 {draggedItem.animationId}</small>
              </span>
            </div>
          )
        })()}

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
                <small>{draggedBackground.type === 'video' ? '影片背景' : '圖片背景'}</small>
              </span>
            </div>
          )
        })(), document.body)}

        {!previewMode && appearPanelOpen && (
          <aside className="dynamic-appear-popover" aria-label="出現設定">
            <div className="drawer-heading">
              <div>
                <p className="eyebrow">舞台</p>
                <h2>出現設定</h2>
              </div>
              <button type="button" className="mini-action-button" onClick={() => setAppearPanelOpen(false)}>
                關閉
              </button>
            </div>
            <div className="dynamic-mode-segmented">
              <button
                type="button"
                className={group.appearMode === 'sequence' ? 'active' : ''}
                onClick={() => setAppearMode('sequence')}
              >
                逐個出現
              </button>
              <button
                type="button"
                className={group.appearMode === 'all' ? 'active' : ''}
                onClick={() => setAppearMode('all')}
              >
                全部出現
              </button>
            </div>
            <label className={`dynamic-percent-control ${group.appearMode === 'all' ? 'disabled' : ''}`}>
              <span>間隔 {appearIntervalSeconds}s</span>
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
            <p className="dynamic-appear-order-note">依圖層順序播放</p>
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
                <p className="eyebrow">舞台背景</p>
                <h2 id="background-editor-title">編輯背景 <span>{backgrounds.length} 個素材</span></h2>
              </div>
              <button
                type="button"
                className="dynamic-panel-close"
                onClick={closeBackgroundEditor}
                aria-label="關閉編輯背景"
                title="關閉"
              >
                ×
              </button>
            </div>

            <div className={`dynamic-background-playback ${group.backgroundPlayMode === 'fixed' ? 'fixed-mode' : ''}`}>
              <div className="dynamic-mode-segmented" aria-label="背景切換方式">
                {([
                  ['fixed', '固定背景'],
                  ['random', '隨機切換'],
                  ['sequence', '逐個切換']
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={group.backgroundPlayMode === mode ? 'active' : ''}
                    onClick={() => setBackgroundPlayback(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {group.backgroundPlayMode !== 'fixed' && (
                <label className="dynamic-interval-input">
                  <span>切換間隔</span>
                  <span className="dynamic-interval-fields">
                    <input
                      type="number"
                      min={backgroundIntervalUnit === 'minutes' ? 0.02 : 1}
                      max={backgroundIntervalUnit === 'minutes' ? 10 : 600}
                      step={backgroundIntervalUnit === 'minutes' ? 0.5 : 1}
                      inputMode="decimal"
                      value={backgroundIntervalDraft}
                      onChange={(event) => setBackgroundIntervalDraft(event.target.value)}
                      onBlur={commitBackgroundIntervalDraft}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                        if (event.key === 'Escape') {
                          setBackgroundIntervalDraft(formatBackgroundInterval(backgroundIntervalMs, backgroundIntervalUnit))
                          event.currentTarget.blur()
                        }
                      }}
                      aria-label="背景切換間隔"
                    />
                    <select
                      value={backgroundIntervalUnit}
                      onChange={(event) => handleBackgroundIntervalUnitChange(event.target.value as BackgroundIntervalUnit)}
                      aria-label="背景切換間隔單位"
                    >
                      <option value="seconds">秒</option>
                      <option value="minutes">分鐘</option>
                    </select>
                  </span>
                </label>
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
                <strong>全選</strong>
              </label>
              <span>按住卡片拖拽可調整播放順序</span>
              <strong>已選 {selectedBackgroundIds.length}</strong>
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
                    aria-label={`選取 ${background.name}`}
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
                      <small>{background.type === 'video' ? '影片背景' : '圖片背景'}</small>
                    </span>
                  </button>
                </article>
              ))}
              {backgrounds.length === 0 && (
                <div className="background-empty-state">尚未加入背景</div>
              )}
            </div>

            <div className="background-drawer-actions dynamic-background-modal-actions">
              <button
                type="button"
                className="ipad-button danger-button"
                disabled={selectedBackgroundIds.length === 0}
                onClick={handleBackgroundDelete}
              >
                刪除選取
              </button>
              <button
                type="button"
                className="ipad-button primary-button"
                onClick={() => backgroundInputRef.current?.click()}
              >
                新增背景
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
                <p className="eyebrow">物件預覽</p>
                <h2 id="dynamic-image-preview-title">{selectedItem.name}</h2>
              </div>
              <div className="dynamic-image-preview-tools">
                <span aria-live="polite">{Math.round(imagePreviewTransform.scale * 100)}%</span>
                <button
                  type="button"
                  className="dynamic-image-preview-tool"
                  onClick={resetImagePreview}
                  disabled={imagePreviewTransform.scale === 1 && imagePreviewTransform.x === 0 && imagePreviewTransform.y === 0}
                  aria-label="重設圖片預覽"
                  title="重設預覽"
                >
                  <RotateCcw size={18} strokeWidth={2.2} />
                </button>
                <button
                  ref={imagePreviewCloseButtonRef}
                  type="button"
                  className="dynamic-panel-close"
                  onClick={closeImagePreview}
                  aria-label="關閉圖片預覽"
                  title="關閉"
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
            aria-label="取消複製"
          />
          <section className="dynamic-copy-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="copy-confirm-title">
            <div className="dynamic-copy-confirm-heading">
              <div>
                <p className="eyebrow">屬性複製</p>
                <h2 id="copy-confirm-title">確認複製屬性</h2>
              </div>
              <button
                ref={copyConfirmCloseButtonRef}
                type="button"
                className="dynamic-panel-close"
                onClick={closeCopyConfirm}
                disabled={isCopying}
                aria-label="關閉"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="dynamic-copy-route">
              <div className="dynamic-copy-route-item">
                <img src={copySourceItem.media.url} alt={copySourceItem.name} />
                <span>來源</span>
                <strong>{copySourceItem.name}</strong>
              </div>
              <span className="dynamic-copy-route-arrow" aria-hidden="true">→</span>
              <div className="dynamic-copy-route-item target">
                <img src={selectedItem.media.url} alt={selectedItem.name} />
                <span>目標</span>
                <strong>{selectedItem.name}</strong>
              </div>
            </div>

            <div className="dynamic-copy-confirm-selection">
              <div className="dynamic-copy-section-heading copy-options-heading">
                <span>複製內容</span>
                <button
                  type="button"
                  className="dynamic-copy-select-all"
                  onClick={() => setSelectedCopyFields(
                    selectedCopyFields.length === ALL_COPY_FIELDS.length ? [] : [...ALL_COPY_FIELDS]
                  )}
                  disabled={isCopying}
                >
                  {selectedCopyFields.length === ALL_COPY_FIELDS.length ? '全部取消' : '全選'}
                </button>
              </div>
              <div className="dynamic-copy-options dynamic-copy-modal-options" aria-label="複製內容">
                {copyFieldOptions.map((option) => (
                  <label key={option.id} className="dynamic-copy-option">
                    <input
                      type="checkbox"
                      checked={selectedCopyFields.includes(option.id)}
                      onChange={() => toggleCopyField(option.id)}
                      disabled={isCopying}
                    />
                    <span className="dynamic-copy-checkbox" aria-hidden="true" />
                    <strong>{option.label}</strong>
                  </label>
                ))}
              </div>
            </div>

            <p className="dynamic-copy-confirm-note">目標物件所選的屬性將被取代，其他屬性維持不變。</p>
            {copyError && <p className="dynamic-copy-error" role="alert">{copyError}</p>}
            <div className="dynamic-copy-confirm-actions">
              <button
                type="button"
                className="ipad-button secondary-button"
                onClick={closeCopyConfirm}
                disabled={isCopying}
              >
                取消
              </button>
              <button
                type="button"
                className="ipad-button primary-button"
                onClick={() => void handleCopyConfirm()}
                disabled={selectedCopyFields.length === 0 || isCopying}
              >
                {isCopying ? '正在複製...' : '確認複製'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default DynamicControlPage
