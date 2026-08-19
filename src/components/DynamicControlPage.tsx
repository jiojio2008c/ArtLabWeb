import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  FlipHorizontal2,
  FlipVertical2,
  ImageIcon,
  Link2,
  LockKeyhole,
  Maximize2,
  MessageCircleMore,
  Music2,
  Move,
  MousePointerClick,
  Pencil,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Shuffle,
  Target,
  Trash2,
  Upload,
  Unlink2,
  Volume2,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  MAX_DYNAMIC_ITEMS_PER_GROUP,
  addDynamicBubble,
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
  isDynamicBubbleItem,
  isDynamicMediaItem,
  normalizeDynamicAudioFile,
  MAX_DYNAMIC_BACKGROUND_INTERVAL_MS,
  MAX_DYNAMIC_APPEAR_INTERVAL_MS,
  MIN_DYNAMIC_BACKGROUND_INTERVAL_MS,
  MIN_DYNAMIC_APPEAR_INTERVAL_MS,
  addDynamicAudio,
  deleteDynamicAudio,
  reorderDynamicBackgrounds,
  reorderDynamicItems,
  setActiveDynamicBackground,
  setDynamicBackground,
  setDynamicBackgroundTransition,
  setDynamicBackgroundBgm,
  updateDynamicAdvancedPlayback,
  updateDynamicBackgroundPlayback,
  updateDynamicGroupAppearMode,
  updateDynamicItemMeta,
  updateDynamicBubble,
  updateDynamicItem,
  upsertDynamicGroup,
  type DynamicAppearAnimation,
  type DynamicAppearMode,
  type DynamicAudioMedia,
  type DynamicBackground,
  type DynamicBackgroundPlayMode,
  type DynamicBackgroundTransition,
  type DynamicBubbleInput,
  type DynamicCopyField,
  type DynamicGroup,
  type DynamicItem,
  type DynamicItemAudioTrigger,
  type DynamicLinkedAppearance,
  type DynamicLinkedAppearanceMode,
  type DynamicMoveMode,
  type DynamicMoveTrack,
  type DynamicTargetMode
} from '../services/dynamicArtStorage.ts'
import { sendDynamicEvent, uploadUnityAsset } from '../services/unityBridge.ts'
import {
  buildGroupSyncPayload,
  syncDynamicGroupToReceiver,
  type SyncStatus
} from '../services/dynamicArtReceiverSync.ts'
import {
  playBackgroundTransitionSound,
  playUiSound,
  stopBackgroundTransitionSound
} from '../services/uiFeedback.ts'
import { sampleTargetMotionProgress } from '../services/dynamicTargetMotion.ts'
import {
  DYNAMIC_CREATION_FLOW_STEPS,
  convertDynamicPlaybackOrderToLayerOrder,
  getDynamicCreationFlowSummary,
  type DynamicAppearanceRelationTreeNode,
  type DynamicCreationFlowExperience,
  type DynamicCreationFlowSession,
  type DynamicCreationFlowStepId
} from '../services/dynamicCreationFlowCore.js'
import {
  loadDynamicCreationFlowSession,
  saveDynamicCreationFlowSession
} from '../services/dynamicCreationFlowStorage.ts'
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
import {
  buildDynamicAppearanceTimeline,
  getDynamicPlaybackItemsForBackground,
  sampleDynamicAppearanceTimeline,
  synchronizeDynamicLinkedBackgrounds,
  wouldCreateDynamicLinkedAppearanceCycle,
  type DynamicAppearanceSchedule
} from '../../desktop-runtime/renderer/advanced-appearance-timeline.js'
import { getDynamicBackgroundPlaybackStartIndex } from '../../desktop-runtime/renderer/background-playback-core.js'
import DynamicCreationFlowPanel, {
  type DynamicCreationFlowBackground,
  type DynamicCreationFlowIssue,
  type DynamicCreationFlowItem
} from './dynamicFlow/DynamicCreationFlowPanel.tsx'
import DynamicBubbleEditor, {
  type DynamicBubbleEditorSubmitValue
} from './DynamicBubbleEditor.tsx'
import DynamicBubbleVisual from './DynamicBubbleVisual.tsx'
import DynamicItemThumbnail, { toDynamicBubbleDraft } from './DynamicItemThumbnail.tsx'

type ControlTab = 'motion' | 'animation' | 'transform' | 'audio' | 'background' | 'copy'
type GestureMode = 'none' | 'drag' | 'pinch'
type BackgroundIntervalUnit = 'seconds' | 'minutes'
type PreviewPanelMode = 'object' | 'layers' | 'collapsed'
type DynamicFlowDetailSection = '' | 'background' | 'audio'

interface PreviewPanelSnapshot {
  mode: PreviewPanelMode
  activeTab: ControlTab
  selectedItemId: string
}

interface TargetEditSnapshot {
  itemId: string
  moveMode: DynamicMoveMode
  targetMode: DynamicTargetMode
  targetLoop: boolean
  targetPosition?: Point
}

interface DynamicItemPlaybackEpoch {
  key: string
  startedAt: number
  schedule: DynamicAppearanceSchedule
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
  advancedFeaturesEnabled: boolean
  onBack: () => void
  onGroupChange: (group: DynamicGroup) => void
  initialItemId?: string
  initialExperience?: DynamicCreationFlowExperience
  transitionPreparing?: boolean
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
const PREVIEW_FADE_APPEAR_DURATION_MS = 420
const PREVIEW_DROP_APPEAR_DURATION_MS = 620
const PREVIEW_TRACK_APPEAR_DURATION_MS = 560
const TARGET_ARRIVAL_SETTLE_MS = 80
const PREVIEW_BGM_VOLUME = 0.72
const PREVIEW_BGM_DUCK_VOLUME = 0.22
const PREVIEW_BGM_TRANSITION_DUCK_VOLUME = 0.1
const PREVIEW_BGM_FADE_MS = 380
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
const getRandomBackgroundIndexForCycle = (
  groupId: string,
  replayId: number,
  backgrounds: DynamicBackground[],
  activeIndex: number,
  cycle: number
) => {
  if (backgrounds.length <= 1 || cycle <= 0) return activeIndex

  const key = `${groupId}:${replayId}:${activeIndex}:${backgrounds.map((background) => background.id).join(',')}`
  let nextIndex = activeIndex
  for (let nextCycle = 1; nextCycle <= cycle; nextCycle += 1) {
    const offset = 1 + (hashString(`${key}:${nextCycle}`) % (backgrounds.length - 1))
    nextIndex = (nextIndex + offset) % backgrounds.length
  }
  return nextIndex
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
        mimeType: background.mimeType,
        bgmAudioId: background.bgmAudioId,
        backgroundTransition: background.backgroundTransition ?? 'none'
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

const basicCopyFieldOptions: { id: DynamicCopyField; labelKey: string }[] = [
  { id: 'motion', labelKey: 'control.motion' },
  { id: 'animation', labelKey: 'control.animation' },
  { id: 'size', labelKey: 'control.size' },
  { id: 'deform', labelKey: 'control.deform' }
]

const advancedCopyFieldOptions: { id: DynamicCopyField; labelKey: string }[] = [
  ...basicCopyFieldOptions,
  { id: 'audio', labelKey: 'control.objectAudio' },
  { id: 'background', labelKey: 'control.objectBackground' },
  { id: 'linkage', labelKey: 'control.objectLinkage' }
]

const BASIC_COPY_FIELDS = basicCopyFieldOptions.map((option) => option.id)
const ADVANCED_COPY_FIELDS = advancedCopyFieldOptions.map((option) => option.id)

const buildVisibleLayerRelationTree = (
  relationTree: DynamicAppearanceRelationTreeNode[],
  visibleItems: DynamicItem[]
): DynamicAppearanceRelationTreeNode[] => {
  const visibleItemIds = new Set(visibleItems.map((item) => item.id))
  const layerIndexByItemId = new Map(visibleItems.map((item, index) => [item.id, index]))
  const compareByLayer = (
    first: DynamicAppearanceRelationTreeNode,
    second: DynamicAppearanceRelationTreeNode
  ) => (layerIndexByItemId.get(first.itemId) ?? Number.MAX_SAFE_INTEGER)
    - (layerIndexByItemId.get(second.itemId) ?? Number.MAX_SAFE_INTEGER)

  const filterNodes = (nodes: DynamicAppearanceRelationTreeNode[]): DynamicAppearanceRelationTreeNode[] => (
    nodes.flatMap((node) => {
      const children = filterNodes(node.children).sort(compareByLayer)
      if (!visibleItemIds.has(node.itemId)) return children
      return [{ ...node, children }]
    }).sort(compareByLayer)
  )

  return filterNodes(relationTree)
}

const getRelationTreeAncestorIds = (
  nodes: DynamicAppearanceRelationTreeNode[],
  targetItemId: string,
  ancestorIds: string[] = []
): string[] => {
  for (const node of nodes) {
    if (node.itemId === targetItemId) return ancestorIds
    const childAncestorIds = getRelationTreeAncestorIds(
      node.children,
      targetItemId,
      [...ancestorIds, node.itemId]
    )
    if (childAncestorIds.length > 0) return childAncestorIds
  }
  return []
}

const getRelationTreeParentIds = (nodes: DynamicAppearanceRelationTreeNode[]): string[] => (
  nodes.flatMap((node) => [
    ...(node.children.length > 0 ? [node.itemId] : []),
    ...getRelationTreeParentIds(node.children)
  ])
)

const propertyTabOptions = [
  { id: 'motion' as const, labelKey: 'control.motion', shortLabelKey: 'control.motionShort', icon: Move },
  { id: 'animation' as const, labelKey: 'control.animation', shortLabelKey: 'control.animationShort', icon: Sparkles },
  { id: 'transform' as const, labelKey: 'control.deform', shortLabelKey: 'control.deformShort', icon: SlidersHorizontal },
  { id: 'audio' as const, labelKey: 'control.objectAudio', shortLabelKey: 'control.objectAudioShort', icon: Volume2 },
  { id: 'background' as const, labelKey: 'control.objectBackground', shortLabelKey: 'control.objectBackgroundShort', icon: ImageIcon },
  { id: 'copy' as const, labelKey: 'control.copyProperties', shortLabelKey: 'control.copyPropertiesShort', icon: Copy }
]

const basicPropertyTabIds: ControlTab[] = ['motion', 'animation', 'transform', 'copy']
const advancedPropertyTabIds: ControlTab[] = ['motion', 'animation', 'transform', 'audio', 'background', 'copy']

const appearAnimationOptions: { id: DynamicAppearAnimation; labelKey: string }[] = [
  { id: 'none', labelKey: 'control.appearAnimationNone' },
  { id: 'drop', labelKey: 'control.appearAnimationDrop' },
  { id: 'trackSlide', labelKey: 'control.appearAnimationTrackSlide' }
]

const backgroundTransitionOptions: { id: DynamicBackgroundTransition; labelKey: string }[] = [
  { id: 'none', labelKey: 'control.backgroundTransitionNone' },
  { id: 'curtain', labelKey: 'control.backgroundTransitionCurtain' },
  { id: 'cameraFlash', labelKey: 'control.backgroundTransitionCamera' },
  { id: 'shadowPlay', labelKey: 'control.backgroundTransitionShadow' }
]

const itemAudioTriggerOptions: { id: DynamicItemAudioTrigger; labelKey: string }[] = [
  { id: 'appearance', labelKey: 'control.audioOnAppearance' },
  { id: 'appearanceDelay', labelKey: 'control.audioAfterDelay' },
  { id: 'targetArrival', labelKey: 'control.audioOnArrival' }
]

const getInitialItemId = (items: DynamicItem[], preferredItemId = '', restoredItemId = '') => {
  if (preferredItemId && items.some((item) => item.id === preferredItemId)) return preferredItemId
  if (restoredItemId && items.some((item) => item.id === restoredItemId)) return restoredItemId
  return items[0]?.id ?? ''
}

const getStoredItemMediaSizes = (items: DynamicItem[]) => items.reduce<Record<string, MediaSize>>((sizes, item) => {
  if (!isDynamicMediaItem(item)) return sizes
  const width = Number(item.media.width ?? 0)
  const height = Number(item.media.height ?? 0)
  if (width > 0 && height > 0) sizes[item.media.id] = { width, height }
  return sizes
}, {})

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
  schedule?: DynamicAppearanceSchedule
  epochStartedAt?: number
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
  appearAnimation: DynamicAppearAnimation
  track: DynamicMoveTrack
  item: DynamicItem
  itemSize: MediaSize
  stageSize: { width: number; height: number }
  replayId: number
  schedule?: DynamicAppearanceSchedule
  epochStartedAt?: number
  children: React.ReactNode
}

interface DynamicStageTargetProps {
  previewing: boolean
  ready: boolean
  enabled: boolean
  loop: boolean
  editing: boolean
  item: DynamicItem
  targetPosition?: Point
  stageSize: { width: number; height: number }
  appearDelayMs: number
  appearAnimation: DynamicAppearAnimation
  replayId: number
  schedule?: DynamicAppearanceSchedule
  epochStartedAt?: number
  onArrival?: (itemId: string) => void
  editingLabel?: string
  editingDescriptionId?: string
  onEditingKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
  children: React.ReactNode
}

const getAppearanceDurationMs = (appearAnimation: DynamicAppearAnimation) => {
  if (appearAnimation === 'drop') return PREVIEW_DROP_APPEAR_DURATION_MS
  if (appearAnimation === 'trackSlide') return PREVIEW_TRACK_APPEAR_DURATION_MS
  return PREVIEW_FADE_APPEAR_DURATION_MS
}

const getBackgroundTransitionTiming = (transition: DynamicBackgroundTransition) => {
  if (transition === 'curtain') return { closeMs: 520, openMs: 680 }
  if (transition === 'cameraFlash') return { closeMs: 150, openMs: 330 }
  if (transition === 'shadowPlay') return { closeMs: 650, openMs: 750 }
  return { closeMs: 0, openMs: 0 }
}

const formatAudioDuration = (durationMs?: number) => {
  if (!durationMs || durationMs <= 0) return ''
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const readAudioDurationMs = (file: File) => new Promise<number | undefined>((resolve) => {
  const objectUrl = URL.createObjectURL(file)
  const audio = new Audio()
  let settled = false
  const finish = (durationMs?: number) => {
    if (settled) return
    settled = true
    window.clearTimeout(timeout)
    audio.removeAttribute('src')
    audio.load()
    URL.revokeObjectURL(objectUrl)
    resolve(durationMs)
  }
  const timeout = window.setTimeout(() => finish(), 4000)
  audio.preload = 'metadata'
  audio.onloadedmetadata = () => {
    const duration = Number(audio.duration)
    finish(Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) : undefined)
  }
  audio.onerror = () => finish()
  audio.src = objectUrl
})

const DynamicStageAppearance: React.FC<DynamicStageAppearanceProps> = ({
  previewing,
  ready,
  appearDelayMs,
  appearAnimation,
  track,
  item,
  itemSize,
  stageSize,
  replayId,
  schedule,
  epochStartedAt,
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
    const elapsedMs = epochStartedAt === undefined ? 0 : Math.max(0, performance.now() - epochStartedAt)
    const resolvedDelayMs = schedule
      ? Math.max(0, schedule.entranceStartMs - elapsedMs)
      : appearDelayMs
    const resolvedAnimation = schedule?.appearAnimation ?? appearAnimation
    const resolvedDuration = schedule?.entranceDurationMs ?? getAppearanceDurationMs(appearAnimation)

    if (schedule?.kind === 'hideAfter') {
      const hideStartMs = schedule.hideStartMs ?? 0
      const hideCompleteMs = schedule.hideCompleteMs ?? hideStartMs
      if (elapsedMs >= hideCompleteMs) {
        element.style.opacity = '0'
        element.style.transform = 'none'
        return undefined
      }

      element.style.opacity = '1'
      element.style.transform = 'none'
      const animation = element.animate([
        { opacity: 1 },
        { opacity: 0 }
      ], {
        duration: reduceMotion ? 140 : Math.max(1, hideCompleteMs - hideStartMs),
        delay: Math.max(0, hideStartMs - elapsedMs),
        easing: 'ease',
        fill: 'both'
      })
      return () => animation.cancel()
    }

    if (schedule && elapsedMs >= schedule.appearanceCompleteMs) {
      element.style.opacity = '1'
      element.style.transform = 'none'
      return undefined
    }

    const stageWidth = stageSize.width || DEFAULT_STAGE_PREVIEW_WIDTH
    const stageHeight = stageSize.height || DEFAULT_STAGE_PREVIEW_HEIGHT
    const scaledHalfWidth = itemSize.width * Math.max(Math.abs(item.scale), MIN_ITEM_SCALE) / 2
    const scaledHalfHeight = itemSize.height * Math.max(Math.abs(item.scale), MIN_ITEM_SCALE) / 2
    let fromTransform = 'scale(0.96)'
    let duration = PREVIEW_FADE_APPEAR_DURATION_MS
    let easing = 'ease'

    if (resolvedAnimation === 'drop') {
      const offsetY = -(item.position.y * stageHeight + scaledHalfHeight + 36)
      fromTransform = `translate3d(0, ${offsetY}px, 0)`
      duration = PREVIEW_DROP_APPEAR_DURATION_MS
      easing = 'cubic-bezier(0.18, 0.82, 0.22, 1)'
    } else if (resolvedAnimation === 'trackSlide') {
      const fromRight = track === 'middle'
      const offsetX = fromRight
        ? (1 - item.position.x) * stageWidth + scaledHalfWidth + 36
        : -(item.position.x * stageWidth + scaledHalfWidth + 36)
      fromTransform = `translate3d(${offsetX}px, 0, 0)`
      duration = PREVIEW_TRACK_APPEAR_DURATION_MS
      easing = 'cubic-bezier(0.2, 0.78, 0.22, 1)'
    }

    const animation = element.animate([
      { opacity: 0, transform: reduceMotion ? 'none' : fromTransform },
      { opacity: 1, transform: 'none' }
    ], {
      duration: reduceMotion ? 140 : Math.max(1, resolvedDuration || duration),
      delay: resolvedDelayMs,
      easing,
      fill: 'both'
    })

    return () => animation.cancel()
  }, [appearAnimation, appearDelayMs, epochStartedAt, item.position.x, item.position.y, item.scale, itemSize.height, itemSize.width, previewing, ready, replayId, schedule, stageSize.height, stageSize.width, track])

  return (
    <div ref={elementRef} className="dynamic-stage-item-appear">
      {children}
    </div>
  )
}

const DynamicStageTarget: React.FC<DynamicStageTargetProps> = ({
  previewing,
  ready,
  enabled,
  loop,
  editing,
  item,
  targetPosition,
  stageSize,
  appearDelayMs,
  appearAnimation,
  replayId,
  schedule,
  epochStartedAt,
  onArrival,
  editingLabel,
  editingDescriptionId,
  onEditingKeyDown,
  children
}) => {
  const elementRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!editing) return undefined
    const frame = window.requestAnimationFrame(() => {
      elementRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editing])

  useLayoutEffect(() => {
    const element = elementRef.current
    if (!element) return undefined

    element.getAnimations().forEach((animation) => animation.cancel())
    const stageWidth = stageSize.width || DEFAULT_STAGE_PREVIEW_WIDTH
    const stageHeight = stageSize.height || DEFAULT_STAGE_PREVIEW_HEIGHT
    const position = targetPosition ?? item.position
    const offsetX = (position.x - item.position.x) * stageWidth
    const offsetY = (position.y - item.position.y) * stageHeight

    if (editing) {
      element.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`
      return undefined
    }

    if (!previewing || !ready || !enabled || !targetPosition) {
      element.style.removeProperty('transform')
      return undefined
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduceMotion ? 180 : getMoveDuration(getItemMoveSpeed(item), 3.8) * 1000
    const elapsedMs = epochStartedAt === undefined ? 0 : Math.max(0, performance.now() - epochStartedAt)
    const targetStartMs = schedule?.activeStartMs
      ?? (appearDelayMs + (reduceMotion ? 140 : getAppearanceDurationMs(appearAnimation)))
    const targetElapsedMs = Math.max(0, elapsedMs - targetStartMs)
    const delay = Math.max(0, targetStartMs - elapsedMs)
    let cancelled = false
    let arrivalTimer: number | undefined
    let animation: Animation

    if (reduceMotion) {
      const progress = clamp(targetElapsedMs / Math.max(1, duration), 0, 1)
      const remainingDuration = Math.max(1, duration - targetElapsedMs)
      animation = element.animate([
        { transform: `translate3d(${offsetX * progress}px, ${offsetY * progress}px, 0)` },
        { transform: `translate3d(${offsetX}px, ${offsetY}px, 0)` }
      ], {
        duration: remainingDuration,
        delay,
        easing: 'cubic-bezier(0.22, 0.72, 0.2, 1)',
        fill: 'both'
      })
    } else {
      const animationDuration = loop ? duration * 2 : duration
      const sampleCount = 32
      const keyframes = Array.from({ length: sampleCount + 1 }, (_, index) => {
        const offset = index / sampleCount
        const progress = sampleTargetMotionProgress(animationDuration * offset, duration, loop)
        return {
          offset,
          transform: `translate3d(${offsetX * progress}px, ${offsetY * progress}px, 0)`
        }
      })
      animation = element.animate(keyframes, {
        duration: animationDuration,
        delay,
        iterations: loop ? Infinity : 1,
        easing: 'linear',
        fill: 'both'
      })
      if (targetElapsedMs > 0) {
        animation.currentTime = loop
          ? targetElapsedMs % animationDuration
          : Math.min(targetElapsedMs, animationDuration)
      }
    }

    const arrivalDelay = Math.max(0, targetStartMs + duration + TARGET_ARRIVAL_SETTLE_MS - elapsedMs)
    arrivalTimer = window.setTimeout(() => {
      if (!cancelled) onArrival?.(item.id)
    }, arrivalDelay)

    return () => {
      cancelled = true
      if (arrivalTimer !== undefined) window.clearTimeout(arrivalTimer)
      animation.cancel()
    }
  }, [appearAnimation, appearDelayMs, editing, enabled, epochStartedAt, item.id, item.moveSpeed, item.position.x, item.position.y, loop, onArrival, previewing, ready, replayId, schedule, stageSize.height, stageSize.width, targetPosition?.x, targetPosition?.y])

  return (
    <div
      ref={elementRef}
      className={`dynamic-stage-item-target ${editing ? 'is-editing' : ''}`}
      tabIndex={editing ? 0 : undefined}
      role={editing ? 'group' : undefined}
      aria-label={editing ? editingLabel : undefined}
      aria-describedby={editing ? editingDescriptionId : undefined}
      aria-keyshortcuts={editing
        ? 'ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight Enter Escape'
        : undefined}
      onKeyDown={editing ? onEditingKeyDown : undefined}
    >
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
  playbackKey?: string
  animationStartedAtMs?: number
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
  playbackKey,
  animationStartedAtMs,
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
  }, [animationId, playbackKey, replayId, src, canvasAnimationActive])

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
          replayKey={playbackKey ?? replayId}
          startedAtMs={animationStartedAtMs}
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
          replayKey={playbackKey ?? replayId}
          startedAtMs={animationStartedAtMs}
          overscanX={1.55}
          overscanY={1.72}
          forceLoop
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
  schedule,
  epochStartedAt,
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
    const elapsedMs = epochStartedAt === undefined ? 0 : Math.max(0, performance.now() - epochStartedAt)
    const motionStartMs = schedule?.activeStartMs ?? appearDelayMs
    const motionElapsedMs = Math.max(0, elapsedMs - motionStartMs)
    const motionDelayMs = Math.max(0, motionStartMs - elapsedMs)
    const animation = element.animate(buildHorizontalMotionKeyframes(item, motionMode, stageSize), {
      duration,
      delay: motionDelayMs,
      iterations: Infinity,
      easing: 'linear',
      fill: 'both'
    })

    if (schedule && motionElapsedMs > 0) {
      animation.currentTime = motionElapsedMs % duration
    } else if (retainedCurrentTime !== null) {
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
  }, [appearDelayMs, epochStartedAt, isHorizontalMotion, item.id, item.movePercent, item.moveSpeed, motionMode, replayId, schedule, stageSize.height, stageSize.width])

  return (
    <div
      ref={elementRef}
      data-dynamic-item-id={item.id}
      data-dynamic-track={getItemTrack(item)}
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
  const stageWidth = stageSize.width || DEFAULT_STAGE_PREVIEW_WIDTH
  const stageHeight = stageSize.height || DEFAULT_STAGE_PREVIEW_HEIGHT
  const stageRatio = Math.min(stageWidth / RUNTIME_STAGE_WIDTH, stageHeight / RUNTIME_STAGE_HEIGHT)

  if (isDynamicBubbleItem(item)) {
    return {
      width: Math.max(1, item.bubble.widthPx * stageRatio),
      height: Math.max(1, item.bubble.heightPx * stageRatio)
    }
  }

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
    '--move-orbit-y-back-38': `${-orbitY38}px`
  } as React.CSSProperties
}

const DynamicControlPage: React.FC<DynamicControlPageProps> = ({
  group,
  wsIp,
  dynamicPort,
  advancedFeaturesEnabled,
  onBack,
  onGroupChange,
  initialItemId,
  initialExperience = 'free',
  transitionPreparing = false
}) => {
  const { t } = useTranslation()
  const supportedCopyFieldOptions = advancedFeaturesEnabled ? advancedCopyFieldOptions : basicCopyFieldOptions
  const supportedCopyFields = advancedFeaturesEnabled ? ADVANCED_COPY_FIELDS : BASIC_COPY_FIELDS
  const stageRef = useRef<HTMLDivElement>(null)
  const stageBackgroundVideoRef = useRef<HTMLVideoElement>(null)
  const backgroundInputRef = useRef<HTMLInputElement>(null)
  const layerItemInputRef = useRef<HTMLInputElement>(null)
  const itemAudioInputRef = useRef<HTMLInputElement>(null)
  const backgroundAudioInputRef = useRef<HTMLInputElement>(null)
  const flowAudioInputRef = useRef<HTMLInputElement>(null)
  const addItemButtonRef = useRef<HTMLButtonElement>(null)
  const targetSetButtonRef = useRef<HTMLButtonElement>(null)
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null)
  const bgmAudioRef = useRef<{ id: string; element: HTMLAudioElement } | null>(null)
  const bgmFadeFrameRef = useRef<number | null>(null)
  const bgmFadingAudioRefs = useRef<Set<HTMLAudioElement>>(new Set())
  const bgmPlaybackEpochRef = useRef(0)
  const backgroundTransitionAudioActiveRef = useRef(false)
  const objectAudioRefs = useRef<Set<HTMLAudioElement>>(new Set())
  const objectAudioTimersRef = useRef<Map<string, number>>(new Map())
  const objectAudioEpochKeysRef = useRef<Map<string, string>>(new Map())
  const objectAudioSessionKeyRef = useRef('')
  const targetArrivalKeysRef = useRef<Set<string>>(new Set())
  const bgmDuckCountRef = useRef(0)
  const backgroundCycleTimerRef = useRef<number | null>(null)
  const backgroundTransitionTimersRef = useRef<number[]>([])
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
  const audioFileErrorTimerRef = useRef<number | null>(null)
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
  const linkEditorCloseButtonRef = useRef<HTMLButtonElement>(null)
  const animationSwipeStartRef = useRef<{ pointerId: number; x: number } | null>(null)
  const targetEditSnapshotRef = useRef<TargetEditSnapshot | null>(null)
  const itemPlaybackSessionRef = useRef('')
  const itemPlaybackContextRef = useRef('')
  const itemPlaybackEpochCounterRef = useRef(0)
  const itemPlaybackEpochsRef = useRef<Record<string, DynamicItemPlaybackEpoch>>({})

  const [flowSession, setFlowSession] = useState(() => loadDynamicCreationFlowSession(group.id, {
    itemIds: group.items.map((item) => item.id),
    defaultExperience: initialExperience
  }))
  const [flowDetailSection, setFlowDetailSection] = useState<DynamicFlowDetailSection>('')
  const [pendingFlowLinkSourceId, setPendingFlowLinkSourceId] = useState('')
  const [pendingFlowLinkTargetId, setPendingFlowLinkTargetId] = useState('')
  const [selectedItemId, setSelectedItemId] = useState(() => (
    getInitialItemId(group.items, initialItemId, flowSession.selectedItemId)
  ))
  const [toolOpen, setToolOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ControlTab>('motion')
  const [backgroundPanelOpen, setBackgroundPanelOpen] = useState(false)
  const [addItemMenuOpen, setAddItemMenuOpen] = useState(false)
  const [bubbleEditorOpen, setBubbleEditorOpen] = useState(false)
  const [editingBubbleItemId, setEditingBubbleItemId] = useState('')
  const [isSavingBubble, setIsSavingBubble] = useState(false)
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
  const [collapsedLayerItemIds, setCollapsedLayerItemIds] = useState<Set<string>>(() => new Set())
  const [copiedSourceItemId, setCopiedSourceItemId] = useState('')
  const [selectedCopyFields, setSelectedCopyFields] = useState<DynamicCopyField[]>(() => [...supportedCopyFields])
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
  const [itemImageSizes, setItemImageSizes] = useState<Record<string, MediaSize>>(() => getStoredItemMediaSizes(group.items))
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
  const [linkEditorOpen, setLinkEditorOpen] = useState(false)
  const [editingLinkTargetItemId, setEditingLinkTargetItemId] = useState('')
  const [pendingLinkTargetItemId, setPendingLinkTargetItemId] = useState('')
  const [pendingLinkedAppearanceMode, setPendingLinkedAppearanceMode] = useState<DynamicLinkedAppearanceMode>('showAfter')
  const [pendingLinkDelaySeconds, setPendingLinkDelaySeconds] = useState(0)
  const [linkageErrorKey, setLinkageErrorKey] = useState('')
  const [targetEditingItemId, setTargetEditingItemId] = useState('')
  const [targetDraftPosition, setTargetDraftPosition] = useState<Point | null>(null)
  const [targetDraftLoop, setTargetDraftLoop] = useState(false)
  const [previewingAudioId, setPreviewingAudioId] = useState('')
  const [isAddingAudio, setIsAddingAudio] = useState(false)
  const [audioFileErrorKey, setAudioFileErrorKey] = useState('')
  const [backgroundBgmDraftAudioId, setBackgroundBgmDraftAudioId] = useState('')
  const [backgroundTransitionDraft, setBackgroundTransitionDraft] = useState<DynamicBackgroundTransition>('none')
  const [itemPlaybackEpochs, setItemPlaybackEpochs] = useState<Record<string, DynamicItemPlaybackEpoch>>({})
  const [backgroundTransitionState, setBackgroundTransitionState] = useState<{
    type: DynamicBackgroundTransition
    phase: 'closing' | 'opening'
    key: number
  } | null>(null)
  const savedEditorExperience = flowSession.experience
  const editorExperience: DynamicCreationFlowExperience = advancedFeaturesEnabled
    ? savedEditorExperience
    : 'free'
  const flowStep = flowSession.step
  const copyFieldOptions = editorExperience === 'flow'
    ? supportedCopyFieldOptions.filter((option) => option.id !== 'linkage')
    : supportedCopyFieldOptions
  const allCopyFields = copyFieldOptions.map((option) => option.id)

  const updateFlowSession = useCallback((patch: Partial<DynamicCreationFlowSession>) => {
    setFlowSession((currentSession) => saveDynamicCreationFlowSession({
      ...currentSession,
      ...patch,
      groupId: group.id
    }, {
      itemIds: latestGroupRef.current.items.map((item) => item.id),
      defaultExperience: initialExperience
    }))
  }, [group.id, initialExperience])

  const clearTargetEditing = useCallback(() => {
    const stage = stageRef.current
    if (stage) {
      pointersRef.current.forEach((_point, pointerId) => {
        try {
          if (stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId)
        } catch {
          // iPad WebView can release pointer capture before React receives cleanup.
        }
      })
    }
    targetEditSnapshotRef.current = null
    setTargetEditingItemId('')
    setTargetDraftPosition(null)
    setTargetDraftLoop(false)
    setManipulatingItemId('')
    pointersRef.current.clear()
    gestureModeRef.current = 'none'
    gestureItemIdRef.current = null
    dragStartRef.current = null
    pinchStartRef.current = null
    gestureMovedRef.current = false
  }, [])

  const backgroundSynchronizedItems = synchronizeDynamicLinkedBackgrounds(group.items)
  const sortedItems = [...backgroundSynchronizedItems].sort((a, b) => a.order - b.order)
  const allLayerItems = [...sortedItems].reverse()
  const copySourceItem = sortedItems.find((item) => item.id === copiedSourceItemId)
  const backgrounds = getBackgrounds(group)
  const backgroundIdsKey = backgrounds.map((background) => background.id).join('|')
  const displayedBackground = previewMode
    ? backgrounds.find((background) => background.id === previewBackgroundId) ?? group.background
    : group.background
  const displayedBackgroundId = displayedBackground?.id ?? ''
  const backgroundScopeActive = advancedFeaturesEnabled
    && Boolean(displayedBackgroundId)
  const flowStageShowsAllItems = editorExperience === 'flow'
    && !previewMode
    && (
      flowStep === 'objects'
      || flowStep === 'layout'
      || flowStep === 'appearance'
    )
  const displayedItems = backgroundScopeActive && !flowStageShowsAllItems
    ? getDynamicPlaybackItemsForBackground(sortedItems, displayedBackgroundId)
    : sortedItems
  const displayedItemIdsKey = displayedItems.map((item) => item.id).join('|')
  const layerItems = [...displayedItems].reverse()
  const selectableItems = editorExperience === 'flow' && !previewMode
    ? sortedItems
    : displayedItems
  const selectedItem = selectableItems.find((item) => item.id === selectedItemId) ?? selectableItems[0]
  const editingBubbleItemCandidate = editingBubbleItemId
    ? sortedItems.find((item) => item.id === editingBubbleItemId)
    : undefined
  const editingBubbleItem = editingBubbleItemCandidate && isDynamicBubbleItem(editingBubbleItemCandidate)
    ? editingBubbleItemCandidate
    : undefined
  const displayedItemsAudioKey = displayedItems.map((item) => [
    item.id,
    item.audioId ?? '',
    item.audioTrigger ?? 'appearance',
    item.audioDelayMs ?? 0
  ].join(':')).join('|')
  const displayedItemsTimelineKey = displayedItems.map((item) => [
    item.id,
    item.linkedAppearance?.triggerItemId ?? '',
    item.linkedAppearance?.mode ?? '',
    item.linkedAppearance?.delayMs ?? 0
  ].join(':')).join('|')
  const displayedAppearAnimation = advancedFeaturesEnabled
    ? group.appearAnimation ?? 'none'
    : 'none'
  const activeTrack = selectedItem ? getItemTrack(selectedItem) : 'middle'
  const selectedTargetActive = Boolean(
    selectedItem?.targetMode === 'target' && selectedItem.targetPosition
  )
  const targetEditorOpen = Boolean(
    selectedItem && targetEditingItemId === selectedItem.id
  )
  const selectedTargetForControls = selectedTargetActive || targetEditorOpen
  const selectedMoveSpeed = selectedItem ? getItemMoveSpeed(selectedItem) : DEFAULT_MOVE_SPEED
  const appearIntervalMs = clamp(
    group.appearIntervalMs ?? DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS,
    MIN_DYNAMIC_APPEAR_INTERVAL_MS,
    MAX_DYNAMIC_APPEAR_INTERVAL_MS
  )
  const appearIntervalSeconds = (appearIntervalMs / 1000).toFixed(1)
  const baseAppearanceTimeline = useMemo(() => buildDynamicAppearanceTimeline({
    items: displayedItems,
    appearMode: group.appearMode,
    intervalMs: appearIntervalMs,
    appearAnimation: displayedAppearAnimation
  }), [appearIntervalMs, displayedAppearAnimation, displayedItemsTimelineKey, group.appearMode])
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
  const allLayersSelected = layerItems.length > 0 && selectedLayerItemIds.length === layerItems.length
  const someLayersSelected = selectedLayerItemIds.length > 0 && !allLayersSelected
  const allBackgroundsSelected = backgrounds.length > 0 && selectedBackgroundIds.length === backgrounds.length
  const someBackgroundsSelected = selectedBackgroundIds.length > 0 && !allBackgroundsSelected
  const flowCustomPanelVisible = editorExperience === 'flow' && (
    flowStep === 'appearance'
    || flowStep === 'review'
    || (flowStep === 'backgrounds' && flowDetailSection !== 'background')
    || (flowStep === 'audio' && flowDetailSection !== 'audio')
  )
  const rightPanelMode = previewMode
    ? 'preview'
    : flowCustomPanelVisible
      ? 'flow'
    : rightPanelCollapsed
      ? 'collapsed'
      : toolOpen && selectedItem
        ? 'object'
        : 'layers'
  const rightPanelVisible = !previewMode && rightPanelMode !== 'collapsed'
  const availablePropertyTabs = propertyTabOptions.filter(({ id }) => (
    (advancedFeaturesEnabled ? advancedPropertyTabIds : basicPropertyTabIds).includes(id)
  ))
  const flowPropertyTabIds: ControlTab[] = flowStep === 'layout'
    ? ['motion', 'transform', 'animation', 'copy']
    : flowStep === 'backgrounds'
      ? ['background']
      : flowStep === 'audio'
        ? ['audio']
        : []
  const visiblePropertyTabs = editorExperience === 'flow' && flowPropertyTabIds.length > 0
    ? flowPropertyTabIds
        .map((tabId) => availablePropertyTabs.find(({ id }) => id === tabId))
        .filter((tab): tab is typeof availablePropertyTabs[number] => Boolean(tab))
    : availablePropertyTabs
  const visibleActiveTab = visiblePropertyTabs.some(({ id }) => id === activeTab)
    ? activeTab
    : 'motion'
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
  const selectedIncomingAppearance = selectedItem?.linkedAppearance
  const selectedIncomingSourceItem = selectedIncomingAppearance
    ? sortedItems.find((item) => item.id === selectedIncomingAppearance.triggerItemId)
    : undefined
  const selectedLinkedTargetItems = selectedItem
    ? sortedItems.filter((item) => item.linkedAppearance?.triggerItemId === selectedItem.id)
    : []
  const eligibleLinkTargetItems = selectedItem
    ? sortedItems.filter((item) => (
        item.id !== selectedItem.id
        && !wouldCreateDynamicLinkedAppearanceCycle(sortedItems, item.id, selectedItem.id)
      ))
    : []
  const pendingLinkTargetItem = sortedItems.find((item) => item.id === pendingLinkTargetItemId)
  const pendingLinkExistingSourceItem = pendingLinkTargetItem?.linkedAppearance
    ? sortedItems.find((item) => item.id === pendingLinkTargetItem.linkedAppearance?.triggerItemId)
    : undefined
  const pendingLinkReplacesExisting = Boolean(
    pendingLinkTargetItem?.linkedAppearance
    && pendingLinkTargetItem.linkedAppearance.triggerItemId !== selectedItem?.id
  )
  const selectedStageRelations = selectedItem
    ? [
        ...selectedLinkedTargetItems.map((targetItem) => ({ sourceItem: selectedItem, targetItem })),
        ...(selectedIncomingSourceItem
          ? [{ sourceItem: selectedIncomingSourceItem, targetItem: selectedItem }]
          : [])
      ].filter((relation, index, relations) => (
        relations.findIndex((entry) => (
          entry.sourceItem.id === relation.sourceItem.id
          && entry.targetItem.id === relation.targetItem.id
        )) === index
      ))
    : []
  const selectedStageRelationNodes = sortedItems
    .filter((item) => selectedStageRelations.some((relation) => (
      relation.sourceItem.id === item.id || relation.targetItem.id === item.id
    )))
    .map((item) => ({
      item,
      isSource: selectedStageRelations.some((relation) => relation.sourceItem.id === item.id),
      isTarget: selectedStageRelations.some((relation) => relation.targetItem.id === item.id)
    }))
  const targetEditingItem = targetEditingItemId
    ? sortedItems.find((item) => item.id === targetEditingItemId)
    : undefined

  const buildGroupStatePayload = (nextGroup: DynamicGroup) => {
    return buildGroupSyncPayload({
      ...nextGroup,
      items: synchronizeDynamicLinkedBackgrounds(nextGroup.items)
    }, advancedFeaturesEnabled)
  }

  const sendGroupStateSync = (nextGroup: DynamicGroup) => {
    sendDynamicEvent(wsIp, dynamicPort, 'GroupStateSync', buildGroupStatePayload(nextGroup))
  }

  const stopAudioPreview = useCallback(() => {
    const audio = audioPreviewRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioPreviewRef.current = null
    }
    setPreviewingAudioId('')
  }, [])

  const disposeBgmAudio = useCallback((audio: HTMLAudioElement) => {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }, [])

  const cancelBgmFade = useCallback(() => {
    if (bgmFadeFrameRef.current !== null) {
      window.cancelAnimationFrame(bgmFadeFrameRef.current)
      bgmFadeFrameRef.current = null
    }
    bgmFadingAudioRefs.current.forEach(disposeBgmAudio)
    bgmFadingAudioRefs.current.clear()
  }, [disposeBgmAudio])

  const stopBgmPlayback = useCallback((fade = false) => {
    const playbackEpoch = ++bgmPlaybackEpochRef.current
    cancelBgmFade()
    const current = bgmAudioRef.current
    bgmAudioRef.current = null
    const audios = current ? [current.element] : []
    if (audios.length === 0) return

    const finish = () => audios.forEach((audio) => {
      disposeBgmAudio(audio)
      bgmFadingAudioRefs.current.delete(audio)
    })
    if (!fade || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish()
      return
    }

    audios.forEach((audio) => bgmFadingAudioRefs.current.add(audio))
    const startedAt = performance.now()
    const startVolumes = audios.map((audio) => audio.volume)
    const step = (now: number) => {
      if (playbackEpoch !== bgmPlaybackEpochRef.current) {
        finish()
        return
      }
      const ratio = clamp((now - startedAt) / 180, 0, 1)
      audios.forEach((audio, index) => {
        audio.volume = Math.max(0, startVolumes[index] * (1 - ratio))
      })
      if (ratio >= 1) {
        bgmFadeFrameRef.current = null
        finish()
        return
      }
      bgmFadeFrameRef.current = window.requestAnimationFrame(step)
    }
    bgmFadeFrameRef.current = window.requestAnimationFrame(step)
  }, [cancelBgmFade, disposeBgmAudio])

  const fadeCurrentBgmVolume = useCallback((targetVolume: number, durationMs = 180) => {
    const current = bgmAudioRef.current?.element
    if (!current) return
    cancelBgmFade()
    const fromVolume = current.volume
    const startedAt = performance.now()
    const step = (now: number) => {
      const ratio = clamp((now - startedAt) / Math.max(1, durationMs), 0, 1)
      current.volume = clamp(lerp(fromVolume, targetVolume, ratio), 0, 1)
      if (ratio >= 1) {
        bgmFadeFrameRef.current = null
        return
      }
      bgmFadeFrameRef.current = window.requestAnimationFrame(step)
    }
    bgmFadeFrameRef.current = window.requestAnimationFrame(step)
  }, [cancelBgmFade])

  const getPreviewBgmTargetVolume = useCallback(() => {
    if (backgroundTransitionAudioActiveRef.current) return PREVIEW_BGM_TRANSITION_DUCK_VOLUME
    return bgmDuckCountRef.current > 0 ? PREVIEW_BGM_DUCK_VOLUME : PREVIEW_BGM_VOLUME
  }, [])

  const playPreviewBgm = useCallback((audio?: DynamicAudioMedia) => {
    const playbackEpoch = ++bgmPlaybackEpochRef.current
    const current = bgmAudioRef.current
    const targetVolume = getPreviewBgmTargetVolume()
    if (current && audio && current.id === audio.id) {
      current.element.loop = true
      void current.element.play().then(() => {
        if (bgmAudioRef.current?.element !== current.element) disposeBgmAudio(current.element)
      }).catch(() => undefined)
      fadeCurrentBgmVolume(targetVolume, 160)
      return
    }

    cancelBgmFade()
    const previous = current?.element
    if (previous) bgmFadingAudioRefs.current.add(previous)
    let nextElement: HTMLAudioElement | undefined
    if (audio?.url) {
      const createdElement = new Audio(audio.url)
      nextElement = createdElement
      createdElement.preload = 'auto'
      createdElement.loop = true
      createdElement.volume = 0
      bgmAudioRef.current = { id: audio.id, element: createdElement }
      void createdElement.play().then(() => {
        if (bgmAudioRef.current?.element !== createdElement) disposeBgmAudio(createdElement)
      }).catch(() => {
        if (bgmAudioRef.current?.element === createdElement) bgmAudioRef.current = null
        disposeBgmAudio(createdElement)
      })
    } else {
      bgmAudioRef.current = null
    }

    if (!previous && !nextElement) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduceMotion ? 1 : PREVIEW_BGM_FADE_MS
    const previousVolume = previous?.volume ?? 0
    const startedAt = performance.now()
    const step = (now: number) => {
      if (playbackEpoch !== bgmPlaybackEpochRef.current) {
        if (previous) {
          disposeBgmAudio(previous)
          bgmFadingAudioRefs.current.delete(previous)
        }
        if (nextElement && bgmAudioRef.current?.element !== nextElement) disposeBgmAudio(nextElement)
        return
      }
      const ratio = clamp((now - startedAt) / duration, 0, 1)
      if (previous) previous.volume = Math.max(0, previousVolume * (1 - ratio))
      if (nextElement) nextElement.volume = clamp(targetVolume * ratio, 0, 1)
      if (ratio >= 1) {
        bgmFadeFrameRef.current = null
        if (previous) {
          disposeBgmAudio(previous)
          bgmFadingAudioRefs.current.delete(previous)
        }
        return
      }
      bgmFadeFrameRef.current = window.requestAnimationFrame(step)
    }
    bgmFadeFrameRef.current = window.requestAnimationFrame(step)
  }, [cancelBgmFade, disposeBgmAudio, fadeCurrentBgmVolume, getPreviewBgmTargetVolume])

  const stopObjectAudioPlayback = useCallback(() => {
    objectAudioTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    objectAudioTimersRef.current.clear()
    objectAudioEpochKeysRef.current.clear()
    objectAudioSessionKeyRef.current = ''
    targetArrivalKeysRef.current.clear()
    objectAudioRefs.current.forEach((audio) => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    })
    objectAudioRefs.current.clear()
    bgmDuckCountRef.current = 0
    fadeCurrentBgmVolume(getPreviewBgmTargetVolume(), 120)
  }, [fadeCurrentBgmVolume, getPreviewBgmTargetVolume])

  const playObjectAudio = useCallback((audioId?: string) => {
    if (!audioId) return
    const audioMedia = latestGroupRef.current.audioLibrary?.find((audio) => audio.id === audioId)
    if (!audioMedia?.url) return

    const audio = new Audio(audioMedia.url)
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      objectAudioRefs.current.delete(audio)
      bgmDuckCountRef.current = Math.max(0, bgmDuckCountRef.current - 1)
      if (bgmDuckCountRef.current === 0) {
        fadeCurrentBgmVolume(getPreviewBgmTargetVolume(), 240)
      }
    }
    audio.preload = 'auto'
    audio.volume = 1
    audio.addEventListener('ended', finish, { once: true })
    audio.addEventListener('error', finish, { once: true })
    objectAudioRefs.current.add(audio)
    bgmDuckCountRef.current += 1
    fadeCurrentBgmVolume(getPreviewBgmTargetVolume(), 140)
    void audio.play().catch(finish)
  }, [fadeCurrentBgmVolume, getPreviewBgmTargetVolume])

  const clearBackgroundTransitionPlayback = useCallback(() => {
    if (backgroundCycleTimerRef.current !== null) {
      window.clearTimeout(backgroundCycleTimerRef.current)
      backgroundCycleTimerRef.current = null
    }
    backgroundTransitionTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    backgroundTransitionTimersRef.current = []
    backgroundTransitionAudioActiveRef.current = false
    stopBackgroundTransitionSound()
    fadeCurrentBgmVolume(getPreviewBgmTargetVolume(), 120)
    setBackgroundTransitionState(null)
  }, [fadeCurrentBgmVolume, getPreviewBgmTargetVolume])

  const clearPreviewPlayback = useCallback((fadeBgm = false) => {
    clearBackgroundTransitionPlayback()
    stopObjectAudioPlayback()
    stopBgmPlayback(fadeBgm)
  }, [clearBackgroundTransitionPlayback, stopBgmPlayback, stopObjectAudioPlayback])

  const handleTargetArrival = useCallback((itemId: string) => {
    if (!advancedFeaturesEnabled) return
    const epoch = itemPlaybackEpochsRef.current[itemId]
    if (epoch) {
      const elapsedMs = Math.max(0, performance.now() - epoch.startedAt)
      const sample = sampleDynamicAppearanceTimeline(epoch.schedule, elapsedMs)
      if (!sample.interactive) return
      const arrivalKey = `${epoch.key}:targetArrival`
      if (targetArrivalKeysRef.current.has(arrivalKey)) return
      targetArrivalKeysRef.current.add(arrivalKey)
    }
    const item = latestGroupRef.current.items.find((entry) => entry.id === itemId)
    if (item?.audioTrigger === 'targetArrival') playObjectAudio(item.audioId)
  }, [advancedFeaturesEnabled, playObjectAudio])

  const transitionToPreviewBackground = useCallback((currentBackgroundId: string, nextBackgroundId: string) => {
    if (!nextBackgroundId || nextBackgroundId === currentBackgroundId) return 0
    backgroundTransitionTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    backgroundTransitionTimersRef.current = []

    const nextBackground = getBackgrounds(latestGroupRef.current)
      .find((background) => background.id === nextBackgroundId)
    const transition = advancedFeaturesEnabled
      ? nextBackground?.backgroundTransition ?? group.backgroundTransition ?? 'none'
      : 'none'
    const timing = getBackgroundTransitionTiming(transition)
    if (transition === 'none' || timing.closeMs <= 0) {
      setPreviewBackgroundId(nextBackgroundId)
      setBackgroundTransitionState(null)
      return 0
    }

    const key = Date.now()
    backgroundTransitionAudioActiveRef.current = true
    fadeCurrentBgmVolume(PREVIEW_BGM_TRANSITION_DUCK_VOLUME, 70)
    playBackgroundTransitionSound(transition)
    setBackgroundTransitionState({ type: transition, phase: 'closing', key })

    const switchTimer = window.setTimeout(() => {
      setPreviewBackgroundId(nextBackgroundId)
      setBackgroundTransitionState({ type: transition, phase: 'opening', key })
    }, timing.closeMs)
    const finishTimer = window.setTimeout(() => {
      backgroundTransitionAudioActiveRef.current = false
      stopBackgroundTransitionSound()
      fadeCurrentBgmVolume(getPreviewBgmTargetVolume(), 220)
      setBackgroundTransitionState((current) => current?.key === key ? null : current)
      backgroundTransitionTimersRef.current = []
    }, timing.closeMs + timing.openMs)
    backgroundTransitionTimersRef.current = [switchTimer, finishTimer]
    return timing.closeMs + timing.openMs
  }, [advancedFeaturesEnabled, fadeCurrentBgmVolume, getPreviewBgmTargetVolume, group.backgroundTransition])

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
    clearPreviewPlayback(false)
    stopAudioPreview()
    clearTargetEditing()
    onBack()
  }

  useEffect(() => {
    latestGroupRef.current = group
  }, [group])

  useEffect(() => {
    if (advancedFeaturesEnabled || (activeTab !== 'audio' && activeTab !== 'background')) return
    setActiveTab('motion')
  }, [activeTab, advancedFeaturesEnabled])

  useEffect(() => {
    if (advancedFeaturesEnabled) return
    clearTargetEditing()
    clearPreviewPlayback(false)
    stopAudioPreview()
  }, [advancedFeaturesEnabled, clearPreviewPlayback, clearTargetEditing, stopAudioPreview])

  useEffect(() => {
    clearPreviewPlayback(false)
    stopAudioPreview()
    const nextFlowSession = loadDynamicCreationFlowSession(group.id, {
      itemIds: group.items.map((item) => item.id),
      defaultExperience: initialExperience
    })
    setFlowSession(nextFlowSession)
    setFlowDetailSection('')
    setPendingFlowLinkSourceId('')
    setPendingFlowLinkTargetId('')
    setSelectedItemId(getInitialItemId(group.items, initialItemId, nextFlowSession.selectedItemId))
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
    setLinkEditorOpen(false)
    setEditingLinkTargetItemId('')
    setPendingLinkTargetItemId('')
    setLinkageErrorKey('')
    setIsCopying(false)
    setCopyErrorKey('')
    setCopiedSourceItemId('')
    setSelectedCopyFields([...(advancedFeaturesEnabled ? ADVANCED_COPY_FIELDS : BASIC_COPY_FIELDS)])
    setIsImagePreviewOpen(false)
    setImagePreviewTransform({ scale: 1, x: 0, y: 0 })
    setIsEditingItemName(false)
    setItemNameDraft('')
    setItemNameErrorKey('')
    setIsSavingItemName(false)
    setSelectedLayerItemIds([])
    setSelectedBackgroundIds([])
    setPreviewBackgroundId(group.background?.id ?? '')
    clearTargetEditing()
  }, [advancedFeaturesEnabled, clearPreviewPlayback, clearTargetEditing, group.id, initialExperience, initialItemId, stopAudioPreview])

  useEffect(() => {
    if (flowSession.groupId !== group.id || flowSession.selectedItemId === selectedItemId) return
    updateFlowSession({ selectedItemId })
  }, [flowSession.groupId, flowSession.selectedItemId, group.id, selectedItemId, updateFlowSession])

  useEffect(() => {
    if (previewMode || editorExperience !== 'flow') return

    setRightPanelCollapsed(false)
    setAppearPanelOpen(false)
    if (flowStep === 'objects') {
      setFlowDetailSection('')
      setToolOpen(false)
      return
    }

    if (flowStep === 'layout') {
      setFlowDetailSection('')
      setToolOpen(group.items.length > 0)
      if (!['motion', 'animation', 'transform', 'copy'].includes(activeTab)) setActiveTab('motion')
      return
    }

    if (
      (flowStep === 'backgrounds' && flowDetailSection === 'background')
      || (flowStep === 'audio' && flowDetailSection === 'audio')
    ) {
      setToolOpen(group.items.length > 0)
      setActiveTab(flowDetailSection)
      return
    }

    setToolOpen(false)
  }, [activeTab, editorExperience, flowDetailSection, flowStep, group.items.length, previewMode])

  useEffect(() => {
    setCopyConfirmOpen(false)
    setClickAnimationRangeOpen(false)
    setClickAnimationDraft([])
    setLinkEditorOpen(false)
    setEditingLinkTargetItemId('')
    setPendingLinkTargetItemId('')
    setPendingLinkedAppearanceMode('showAfter')
    setPendingLinkDelaySeconds(0)
    setLinkageErrorKey('')
    setCopyErrorKey('')
    setCopiedSourceItemId((currentId) => currentId === selectedItemId ? '' : currentId)
    setIsImagePreviewOpen(false)
    setImagePreviewTransform({ scale: 1, x: 0, y: 0 })
    imagePreviewPointersRef.current.clear()
    imagePreviewGestureRef.current = null
    setIsEditingItemName(false)
    setItemNameErrorKey('')
    setItemNameDraft(latestGroupRef.current.items.find((item) => item.id === selectedItemId)?.name ?? '')
    clearTargetEditing()
  }, [clearTargetEditing, selectedItemId])

  useEffect(() => {
    if (!selectedItem) return
    const nextCursor = selectedItem.animationId >= FIRST_SELECTABLE_ANIMATION_ID
      ? selectedItem.animationId
      : FIRST_SELECTABLE_ANIMATION_ID
    setAnimationCursor(nextCursor)
  }, [selectedItem?.id, selectedItem?.animationId])

  useLayoutEffect(() => {
    if (!previewMode || !advancedFeaturesEnabled) {
      itemPlaybackSessionRef.current = ''
      itemPlaybackContextRef.current = ''
      itemPlaybackEpochsRef.current = {}
      setItemPlaybackEpochs((current) => Object.keys(current).length === 0 ? current : {})
      return
    }

    const sessionKey = `${group.id}:${previewReplayId}`
    const contextKey = [
      sessionKey,
      displayedBackgroundId,
      displayedAppearAnimation,
      group.appearMode,
      appearIntervalMs,
      displayedItemsTimelineKey
    ].join('|')
    if (itemPlaybackContextRef.current === contextKey) return

    const now = performance.now()
    const previousEpochs = itemPlaybackEpochsRef.current
    const sameSession = itemPlaybackSessionRef.current === sessionKey
    const activeItemIds = new Set<string>()

    if (sameSession) {
      displayedItems.forEach((item) => {
        if (item.linkedAppearance) return
        const previousEpoch = previousEpochs[item.id]
        if (!previousEpoch) return
        const previousSample = sampleDynamicAppearanceTimeline(
          previousEpoch.schedule,
          Math.max(0, now - previousEpoch.startedAt)
        )
        if (previousSample.interactive) activeItemIds.add(item.id)
      })
    }

    const timeline = buildDynamicAppearanceTimeline({
      items: displayedItems,
      appearMode: group.appearMode,
      intervalMs: appearIntervalMs,
      appearAnimation: displayedAppearAnimation,
      activeItemIds
    })
    const nextEpochs = Object.fromEntries(displayedItems.map((item) => {
      const schedule = timeline[item.id] ?? baseAppearanceTimeline[item.id]
      const previousEpoch = previousEpochs[item.id]
      if (activeItemIds.has(item.id) && previousEpoch) {
        return [item.id, {
          key: previousEpoch.key,
          startedAt: previousEpoch.startedAt + previousEpoch.schedule.activeStartMs,
          schedule
        } satisfies DynamicItemPlaybackEpoch]
      }

      itemPlaybackEpochCounterRef.current += 1
      return [item.id, {
        key: `${sessionKey}:${itemPlaybackEpochCounterRef.current}`,
        startedAt: now,
        schedule
      } satisfies DynamicItemPlaybackEpoch]
    }))

    displayedItems.forEach((item) => {
      const previousEpoch = previousEpochs[item.id]
      const nextEpoch = nextEpochs[item.id]
      if (!previousEpoch || !nextEpoch || previousEpoch.key === nextEpoch.key) return
      const timer = objectAudioTimersRef.current.get(item.id)
      if (timer !== undefined) window.clearTimeout(timer)
      objectAudioTimersRef.current.delete(item.id)
      objectAudioEpochKeysRef.current.delete(item.id)
    })

    itemPlaybackSessionRef.current = sessionKey
    itemPlaybackContextRef.current = contextKey
    itemPlaybackEpochsRef.current = nextEpochs
    setItemPlaybackEpochs(nextEpochs)
  }, [advancedFeaturesEnabled, appearIntervalMs, baseAppearanceTimeline, displayedAppearAnimation, displayedBackgroundId, displayedItems, displayedItemsTimelineKey, group.appearMode, group.id, previewMode, previewReplayId])

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
    if (!linkEditorOpen) return undefined
    const frame = window.requestAnimationFrame(() => linkEditorCloseButtonRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [linkEditorOpen])

  useEffect(() => {
    if (!isImagePreviewOpen && !copyConfirmOpen && !clickAnimationRangeOpen && !linkEditorOpen) return undefined
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
      if (linkEditorOpen) {
        setLinkEditorOpen(false)
        setEditingLinkTargetItemId('')
        setPendingLinkTargetItemId('')
        setLinkageErrorKey('')
        return
      }
      if (isCopying) return
      setCopyConfirmOpen(false)
      setCopyErrorKey('')
      window.requestAnimationFrame(() => copyReturnFocusRef.current?.focus({ preventScroll: true }))
    }
    window.addEventListener('keydown', handleModalKeyDown)
    return () => window.removeEventListener('keydown', handleModalKeyDown)
  }, [clickAnimationRangeOpen, copyConfirmOpen, isCopying, isImagePreviewOpen, linkEditorOpen])

  useEffect(() => {
    if (!targetEditingItemId) return
    if (previewMode || !toolOpen || visibleActiveTab !== 'motion' || backgroundPanelOpen || appearPanelOpen || rightPanelCollapsed) {
      clearTargetEditing()
    }
  }, [appearPanelOpen, backgroundPanelOpen, clearTargetEditing, previewMode, rightPanelCollapsed, targetEditingItemId, toolOpen, visibleActiveTab])

  useEffect(() => {
    const video = stageBackgroundVideoRef.current
    if (transitionPreparing || !video || displayedBackground?.type !== 'video' || !displayedBackground.url) return undefined

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

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      video.load()
    } else {
      playVideo()
    }
    const retryTimer = window.setTimeout(playVideo, 60)
    video.addEventListener('loadeddata', playVideo)
    video.addEventListener('canplay', playVideo)

    return () => {
      cancelled = true
      window.clearTimeout(retryTimer)
      video.removeEventListener('loadeddata', playVideo)
      video.removeEventListener('canplay', playVideo)
    }
  }, [displayedBackground?.id, displayedBackground?.type, displayedBackground?.url, transitionPreparing])

  useEffect(() => {
    const activeId = group.background?.id ?? backgrounds[0]?.id ?? ''
    const playbackStartIndex = getDynamicBackgroundPlaybackStartIndex(
      backgrounds,
      activeId,
      group.backgroundPlayMode
    )
    const playbackStartId = backgrounds[playbackStartIndex]?.id ?? activeId
    setPreviewBackgroundId(playbackStartId)
    clearBackgroundTransitionPlayback()

    if (
      !previewMode
      || group.backgroundPlayMode === 'fixed'
      || backgrounds.length <= 1
    ) {
      return undefined
    }

    let currentId = playbackStartId
    let cycle = 0
    const activeIndex = Math.max(0, playbackStartIndex)
    const scheduleNext = (delayMs = backgroundIntervalMs) => {
      backgroundCycleTimerRef.current = window.setTimeout(() => {
        const currentIndex = Math.max(0, backgrounds.findIndex((background) => background.id === currentId))
        let nextId = playbackStartId
        if (group.backgroundPlayMode === 'sequence') {
          nextId = backgrounds[(currentIndex + 1) % backgrounds.length]?.id ?? playbackStartId
        } else {
          cycle += 1
          const nextIndex = getRandomBackgroundIndexForCycle(
            group.id,
            previewReplayId,
            backgrounds,
            activeIndex,
            cycle
          )
          nextId = backgrounds[nextIndex]?.id ?? playbackStartId
        }
        const transitionDuration = transitionToPreviewBackground(currentId, nextId)
        currentId = nextId
        scheduleNext(Math.max(backgroundIntervalMs, transitionDuration + 120))
      }, delayMs)
    }
    scheduleNext()

    return clearBackgroundTransitionPlayback
  }, [backgroundIdsKey, backgroundIntervalMs, clearBackgroundTransitionPlayback, group.background?.id, group.backgroundPlayMode, group.id, previewMode, previewReplayId, transitionToPreviewBackground])

  useEffect(() => {
    if (!previewMode || !advancedFeaturesEnabled) {
      stopBgmPlayback(false)
      return
    }
    const bgm = group.audioLibrary?.find((audio) => audio.id === displayedBackground?.bgmAudioId)
    playPreviewBgm(bgm)
  }, [advancedFeaturesEnabled, displayedBackground?.bgmAudioId, group.audioLibrary, playPreviewBgm, previewMode, previewReplayId, stopBgmPlayback])

  useEffect(() => {
    const sessionKey = previewMode && advancedFeaturesEnabled
      ? `${group.id}:${previewReplayId}`
      : ''
    if (objectAudioSessionKeyRef.current !== sessionKey) {
      objectAudioTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      objectAudioTimersRef.current.clear()
      objectAudioEpochKeysRef.current.clear()
      objectAudioSessionKeyRef.current = sessionKey
    }
    if (!sessionKey) return

    const nextDisplayedItemIds = new Set(displayedItems.map((item) => item.id))
    objectAudioEpochKeysRef.current.forEach((_epochKey, itemId) => {
      if (nextDisplayedItemIds.has(itemId)) return
      const timer = objectAudioTimersRef.current.get(itemId)
      if (timer !== undefined) window.clearTimeout(timer)
      objectAudioTimersRef.current.delete(itemId)
      objectAudioEpochKeysRef.current.delete(itemId)
    })

    displayedItems.forEach((item) => {
      const epoch = itemPlaybackEpochs[item.id]
      if (!epoch) return
      if (objectAudioEpochKeysRef.current.get(item.id) === epoch.key) return

      const previousTimer = objectAudioTimersRef.current.get(item.id)
      if (previousTimer !== undefined) window.clearTimeout(previousTimer)
      objectAudioTimersRef.current.delete(item.id)
      objectAudioEpochKeysRef.current.set(item.id, epoch.key)

      if (!item.audioId || item.audioTrigger === 'targetArrival') return
      const configuredDelay = item.audioTrigger === 'appearanceDelay'
        ? Math.max(0, item.audioDelayMs ?? 0)
        : 0
      const playAt = epoch.startedAt + epoch.schedule.activeStartMs + configuredDelay
      if (epoch.schedule.hideStartMs !== null && playAt >= epoch.startedAt + epoch.schedule.hideStartMs) {
        return
      }
      const timer = window.setTimeout(() => {
        objectAudioTimersRef.current.delete(item.id)
        if (objectAudioEpochKeysRef.current.get(item.id) !== epoch.key) return
        const currentEpoch = itemPlaybackEpochsRef.current[item.id]
        if (!currentEpoch || currentEpoch.key !== epoch.key) return
        const elapsedMs = Math.max(0, performance.now() - currentEpoch.startedAt)
        if (currentEpoch.schedule.hideStartMs !== null && elapsedMs >= currentEpoch.schedule.hideStartMs) return
        if (!sampleDynamicAppearanceTimeline(currentEpoch.schedule, elapsedMs).active) return
        playObjectAudio(item.audioId)
      }, Math.max(0, playAt - performance.now()))
      objectAudioTimersRef.current.set(item.id, timer)
    })
  }, [advancedFeaturesEnabled, displayedBackgroundId, displayedItems, displayedItemsAudioKey, itemPlaybackEpochs, playObjectAudio, previewMode, previewReplayId])

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
    const selectedItemExists = group.items.some((item) => item.id === selectedItemId)
    const selectedItemIsDisplayed = displayedItems.some((item) => item.id === selectedItemId)
    const selectionMustFollowBackground = editorExperience !== 'flow'
      && !previewMode
      && backgroundScopeActive
      && !selectedItemIsDisplayed

    if (!selectedItemExists || selectionMustFollowBackground) {
      setSelectedItemId(displayedItems[0]?.id ?? '')
      if (selectionMustFollowBackground) {
        clearTargetEditing()
        setToolOpen(false)
      }
      return
    }

    if (!selectedItemId && displayedItems[0]) {
      setSelectedItemId(displayedItems[0].id)
    }
  }, [
    backgroundScopeActive,
    clearTargetEditing,
    displayedItemIdsKey,
    editorExperience,
    group.items,
    previewMode,
    selectedItemId
  ])

  useEffect(() => {
    if (previewMode) return
    const displayedItemIds = new Set(displayedItems.map((item) => item.id))
    setSelectedLayerItemIds((currentIds) => {
      const nextIds = currentIds.filter((itemId) => displayedItemIds.has(itemId))
      return nextIds.length === currentIds.length ? currentIds : nextIds
    })
  }, [displayedItemIdsKey, previewMode])

  useEffect(() => {
    if (transitionPreparing) return undefined
    let cancelled = false
    let clearTimer: number | undefined

    setReceiverSyncError(false)
    setReceiverSyncStatus(null)
    void syncDynamicGroupToReceiver({
      group,
      ip: wsIp,
      port: dynamicPort,
      advancedFeaturesEnabled,
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
  }, [advancedFeaturesEnabled, dynamicPort, group, transitionPreparing, wsIp])

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
    const validMediaIds = new Set(
      group.items.filter(isDynamicMediaItem).map((item) => item.media.id)
    )
    const storedSizes = getStoredItemMediaSizes(group.items)
    setItemImageSizes((currentSizes) => {
      const nextSizes = Object.fromEntries(Object.entries(currentSizes).filter(([mediaId]) => validMediaIds.has(mediaId)))
      Object.entries(storedSizes).forEach(([mediaId, size]) => {
        if (!nextSizes[mediaId]) nextSizes[mediaId] = size
      })
      const currentEntries = Object.entries(currentSizes)
      const unchanged = Object.keys(nextSizes).length === currentEntries.length
        && currentEntries.every(([mediaId, size]) => (
          nextSizes[mediaId]?.width === size.width && nextSizes[mediaId]?.height === size.height
        ))
      return unchanged ? currentSizes : nextSizes
    })
  }, [group.items])

  useEffect(() => {
    if (transitionPreparing) return
    sendGroupStateSync(group)
  }, [appearIntervalMs, dynamicPort, group.id, transitionPreparing, wsIp])

  useEffect(() => () => {
    clearTargetEditing()
    clearPreviewPlayback(false)
    stopAudioPreview()
    if (copyFeedbackTimerRef.current !== null) {
      window.clearTimeout(copyFeedbackTimerRef.current)
    }
    if (audioFileErrorTimerRef.current !== null) {
      window.clearTimeout(audioFileErrorTimerRef.current)
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
  }, [clearPreviewPlayback, clearTargetEditing, stopAudioPreview])

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
    const updatedItems = currentGroup.items.map((item) => {
      if (item.id !== itemId) return item
      changedItem = { ...updater(item), updatedAt: Date.now() }
      return changedItem
    })
    const synchronizedItems = synchronizeDynamicLinkedBackgrounds(updatedItems)
    changedItem = synchronizedItems.find((item) => item.id === itemId)
    const nextGroup: DynamicGroup = {
      ...currentGroup,
      items: synchronizedItems,
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
    if (itemId !== selectedItemId) clearTargetEditing()

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
      advancedFeaturesEnabled,
      appearMode: options.appearMode ?? group.appearMode,
      intervalMs: options.intervalMs ?? appearIntervalMs,
      appearAnimation: group.appearAnimation ?? 'none',
      backgroundPlayMode: options.backgroundPlayMode ?? group.backgroundPlayMode,
      backgroundIntervalMs: options.backgroundIntervalMs ?? backgroundIntervalMs,
      backgroundTransition: group.backgroundTransition ?? 'none',
      replayId: options.replayId ?? previewReplayIdRef.current,
      resolvedAnimationIds: buildResolvedAnimationIds(options.replayId ?? previewReplayIdRef.current)
    })
  }

  const restartPreviewPlayback = (appearMode = group.appearMode, intervalMs = appearIntervalMs) => {
    clearPreviewPlayback(false)
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
      clearTargetEditing()
      clearPreviewPlayback(false)
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
      setLinkEditorOpen(false)
      setEditingLinkTargetItemId('')
      setPendingLinkTargetItemId('')
      setPendingLinkedAppearanceMode('showAfter')
      setPendingLinkDelaySeconds(0)
      setLinkageErrorKey('')
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
    clearPreviewPlayback(false)
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
      item.id === targetEditingItemId && targetDraftPosition
        ? { ...item, position: targetDraftPosition }
        : item,
      getDynamicItemPreviewSize(
        item,
        isDynamicMediaItem(item) ? itemImageSizes[item.media.id] : undefined,
        measuredStageSize
      ),
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
    const hitItemId = isFirstPointer
      ? resolveStageItemIdAtPoint({ x: event.clientX, y: event.clientY })
      : gestureItemIdRef.current ?? ''
    const itemId = targetEditingItemId
      ? (hitItemId === targetEditingItemId ? hitItemId : '')
      : hitItemId
    if (!itemId) {
      if (targetEditingItemId) {
        event.preventDefault()
        return
      }
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
      dragStartRef.current = {
        point,
        position: targetEditingItemId === itemId && targetDraftPosition
          ? targetDraftPosition
          : item.position
      }
      pinchStartRef.current = null
      return
    }

    if (pointersRef.current.size >= 2 && !targetEditingItemId) {
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
      if (targetEditingItemId === itemId) {
        setTargetDraftPosition({
          x: clamp(dragStartRef.current.position.x + dx, 0, 1),
          y: clamp(dragStartRef.current.position.y + dy, 0, 1)
        })
        return
      }
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
        if (item && itemId !== targetEditingItemId) emitTransform(item, true)
      }
      if (itemIdAtEnd !== targetEditingItemId) flushPendingTransformPersist()
      gestureModeRef.current = 'none'
      gestureItemIdRef.current = null
      dragStartRef.current = null
      pinchStartRef.current = null
      setManipulatingItemId('')
      gestureMovedRef.current = false
      if (shouldOpenTool && itemIdAtEnd && !targetEditingItemId) {
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

  const setAppearAnimation = (appearAnimation: DynamicAppearAnimation) => {
    const updatedGroup = updateDynamicAdvancedPlayback(group.id, { appearAnimation })
    if (!updatedGroup) return

    const resolvedAnimation = updatedGroup.appearAnimation ?? 'none'
    const nextGroup: DynamicGroup = {
      ...latestGroupRef.current,
      appearAnimation: resolvedAnimation,
      updatedAt: updatedGroup.updatedAt
    }
    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
    sendGroupStateSync(nextGroup)
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
      if (!createdItem || !isDynamicMediaItem(createdItem)) return

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
    const selectedBackground = backgrounds.find((background) => background.id === backgroundId)
    setBackgroundBgmDraftAudioId(selectedBackground?.bgmAudioId ?? '')
    setBackgroundTransitionDraft(selectedBackground?.backgroundTransition ?? group.backgroundTransition ?? 'none')
    const nextGroup = await setActiveDynamicBackground(group.id, backgroundId)
    if (!nextGroup) return

    latestGroupRef.current = nextGroup
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
    clearTargetEditing()
    const intervalUnit = getBackgroundIntervalUnit(backgroundIntervalMs)
    setBackgroundIntervalUnit(intervalUnit)
    setBackgroundIntervalDraft(formatBackgroundInterval(backgroundIntervalMs, intervalUnit))
    setBackgroundBgmDraftAudioId(displayedBackground?.bgmAudioId ?? '')
    setBackgroundTransitionDraft(displayedBackground?.backgroundTransition ?? group.backgroundTransition ?? 'none')
    stopAudioPreview()
    setToolOpen(false)
    setAppearPanelOpen(false)
    setBackgroundPanelOpen(true)
  }

  const closeBackgroundEditor = () => {
    clearTargetEditing()
    stopAudioPreview()
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

  const updateAudioDuration = (nextGroup: DynamicGroup, audioId: string, durationMs?: number) => {
    if (!durationMs) return nextGroup
    const updatedGroup: DynamicGroup = {
      ...nextGroup,
      audioLibrary: (nextGroup.audioLibrary ?? []).map((audio) => (
        audio.id === audioId ? { ...audio, durationMs } : audio
      )),
      updatedAt: Date.now()
    }
    upsertDynamicGroup(updatedGroup)
    return updatedGroup
  }

  const showAudioFileError = (errorKey: string) => {
    setAudioFileErrorKey(errorKey)
    if (audioFileErrorTimerRef.current !== null) {
      window.clearTimeout(audioFileErrorTimerRef.current)
    }
    audioFileErrorTimerRef.current = window.setTimeout(() => {
      setAudioFileErrorKey('')
      audioFileErrorTimerRef.current = null
    }, 3200)
  }

  const addAudioFile = async (file: File) => {
    const normalizedFile = normalizeDynamicAudioFile(file)
    if (!normalizedFile) {
      showAudioFileError('control.unsupportedAudioFile')
      return undefined
    }

    setAudioFileErrorKey('')
    setIsAddingAudio(true)
    try {
      const [nextGroup, durationMs] = await Promise.all([
        addDynamicAudio(group.id, normalizedFile),
        readAudioDurationMs(normalizedFile)
      ])
      if (!nextGroup) throw new Error('Unable to add audio to the current group')
      const addedAudio = nextGroup.audioLibrary?.[0]
      if (!addedAudio) throw new Error('Stored audio is missing from the current group')
      const groupWithDuration = updateAudioDuration(nextGroup, addedAudio.id, durationMs)
      latestGroupRef.current = groupWithDuration
      onGroupChange(groupWithDuration)
      uploadUnityAsset({
        ip: wsIp,
        port: dynamicPort,
        file: normalizedFile,
        fields: {
          role: 'audio',
          groupId: group.id,
          assetId: addedAudio.id,
          mediaType: 'audio',
          mimeType: addedAudio.mimeType,
          durationMs
        }
      })
      sendGroupStateSync(groupWithDuration)
      return groupWithDuration.audioLibrary?.find((audio) => audio.id === addedAudio.id)
    } catch (error) {
      console.error('Failed to add dynamic audio:', error)
      showAudioFileError('control.audioAddFailed')
      return undefined
    } finally {
      setIsAddingAudio(false)
    }
  }

  const handleItemAudioChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedItem) return
    const audio = await addAudioFile(file)
    if (!audio) return
    persistAdvancedItem((item) => ({ ...item, audioId: audio.id }))
  }

  const handleBackgroundAudioChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const audio = await addAudioFile(file)
    if (!audio) return
    setBackgroundBgmDraftAudioId(audio.id)
    if (selectedBackgroundIds.length > 0) {
      const nextGroup = await setDynamicBackgroundBgm(group.id, selectedBackgroundIds, audio.id)
      if (nextGroup) {
        latestGroupRef.current = nextGroup
        onGroupChange(nextGroup)
        sendGroupStateSync(nextGroup)
      }
    }
  }

  const handleFlowAudioChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await addAudioFile(file)
  }

  const toggleAudioPreview = (audio: DynamicAudioMedia) => {
    if (previewingAudioId === audio.id) {
      stopAudioPreview()
      return
    }
    stopAudioPreview()
    if (!audio.url) return
    const preview = new Audio(audio.url)
    audioPreviewRef.current = preview
    setPreviewingAudioId(audio.id)
    preview.addEventListener('ended', stopAudioPreview, { once: true })
    preview.addEventListener('error', stopAudioPreview, { once: true })
    void preview.play().catch(stopAudioPreview)
  }

  const handleAudioDelete = async (audioId: string) => {
    if (!window.confirm(t('control.confirmDeleteAudio'))) return
    if (previewingAudioId === audioId) stopAudioPreview()
    const nextGroup = await deleteDynamicAudio(group.id, audioId)
    if (!nextGroup) return
    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
    setBackgroundBgmDraftAudioId((currentId) => currentId === audioId ? '' : currentId)
    sendGroupStateSync(nextGroup)
  }

  const handleItemAudioSelect = (audioId?: string) => {
    persistAdvancedItem((item) => ({ ...item, audioId }))
  }

  const handleItemAudioTriggerChange = (audioTrigger: DynamicItemAudioTrigger) => {
    persistAdvancedItem((item) => ({ ...item, audioTrigger }))
  }

  const handleItemAudioDelayChange = (value: number) => {
    const audioDelayMs = clamp(Math.round(value * 1000), 0, 600000)
    persistAdvancedItem((item) => ({ ...item, audioDelayMs }))
  }

  const toggleItemBackground = (backgroundId: string) => {
    if (!selectedItem || selectedIncomingSourceItem) return
    const currentIds = selectedItem.backgroundIds ?? []
    const nextIds = currentIds.includes(backgroundId)
      ? currentIds.filter((id) => id !== backgroundId)
      : [...currentIds, backgroundId]
    if (currentIds.length > 0 && nextIds.length === 0) return
    persistAdvancedItem((item) => ({ ...item, backgroundIds: nextIds }))
  }

  const setItemBackgroundScope = (scope: 'all' | 'selected') => {
    if (!selectedItem || selectedIncomingSourceItem) return
    if (scope === 'all') {
      persistAdvancedItem((item) => ({ ...item, backgroundIds: [] }))
      return
    }
    const fallbackId = displayedBackgroundId || backgrounds[0]?.id
    if (!fallbackId) return
    persistAdvancedItem((item) => ({ ...item, backgroundIds: [fallbackId] }))
  }

  const applyBackgroundBgm = async (audioId?: string) => {
    const targetIds = selectedBackgroundIds.length > 0
      ? selectedBackgroundIds
      : displayedBackgroundId
        ? [displayedBackgroundId]
        : []
    if (targetIds.length === 0) return
    const nextGroup = await setDynamicBackgroundBgm(group.id, targetIds, audioId)
    if (!nextGroup) return
    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
    sendGroupStateSync(nextGroup)
  }

  const applyBackgroundTransition = async () => {
    const targetIds = selectedBackgroundIds.length > 0
      ? selectedBackgroundIds
      : displayedBackgroundId
        ? [displayedBackgroundId]
        : []
    if (targetIds.length === 0) return
    const nextGroup = await setDynamicBackgroundTransition(group.id, targetIds, backgroundTransitionDraft)
    if (!nextGroup) return
    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
    sendGroupStateSync(nextGroup)
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
    setSelectedLayerItemIds(allLayersSelected ? [] : layerItems.map((item) => item.id))
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

    clearTargetEditing()
    const changedItem = updateItemLocal(selectedItem.id, (item) => ({
      ...item,
      moveMode,
      targetMode: 'loop'
    }), { persist: true, emit: false })
    if (changedItem) sendGroupStateSync(latestGroupRef.current)
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

  const persistAdvancedItem = (updater: (item: DynamicItem) => DynamicItem) => {
    if (!selectedItem) return undefined
    const changedItem = updateItemLocal(selectedItem.id, updater, { persist: true, emit: false })
    if (changedItem) sendGroupStateSync(latestGroupRef.current)
    return changedItem
  }

  const closeLinkEditor = () => {
    setLinkEditorOpen(false)
    setEditingLinkTargetItemId('')
    setPendingLinkTargetItemId('')
    setPendingLinkedAppearanceMode('showAfter')
    setPendingLinkDelaySeconds(0)
    setLinkageErrorKey('')
  }

  const openLinkEditor = (targetItem?: DynamicItem) => {
    if (!selectedItem) return
    const linkedAppearance = targetItem?.linkedAppearance?.triggerItemId === selectedItem.id
      ? targetItem.linkedAppearance
      : undefined
    setEditingLinkTargetItemId(targetItem?.id ?? '')
    setPendingLinkTargetItemId(targetItem?.id ?? '')
    setPendingLinkedAppearanceMode(linkedAppearance?.mode ?? 'showAfter')
    setPendingLinkDelaySeconds((linkedAppearance?.delayMs ?? 0) / 1000)
    setLinkageErrorKey(eligibleLinkTargetItems.length === 0 ? 'control.linkageTargetMissing' : '')
    setLinkEditorOpen(true)
  }

  useEffect(() => {
    if (
      !pendingFlowLinkSourceId
      || editorExperience !== 'flow'
      || flowStep !== 'appearance'
      || selectedItem?.id !== pendingFlowLinkSourceId
    ) return

    const targetItem = pendingFlowLinkTargetId
      ? sortedItems.find((item) => item.id === pendingFlowLinkTargetId)
      : undefined
    openLinkEditor(targetItem)
    setPendingFlowLinkSourceId('')
    setPendingFlowLinkTargetId('')
  }, [
    editorExperience,
    flowStep,
    pendingFlowLinkSourceId,
    pendingFlowLinkTargetId,
    selectedItem?.id
  ])

  const persistLinkedAppearanceRelation = (
    sourceItemId: string,
    previousTargetItemId: string,
    targetItemId: string,
    mode: DynamicLinkedAppearanceMode,
    delayMs: number
  ) => {
    const currentGroup = latestGroupRef.current
    const now = Date.now()
    const updatedItems = currentGroup.items.map((item) => {
      if (
        previousTargetItemId
        && previousTargetItemId !== targetItemId
        && item.id === previousTargetItemId
        && item.linkedAppearance?.triggerItemId === sourceItemId
      ) {
        return { ...item, linkedAppearance: undefined, updatedAt: now }
      }
      if (item.id !== targetItemId) return item
      if (mode === 'none') {
        return item.linkedAppearance?.triggerItemId === sourceItemId
          ? { ...item, linkedAppearance: undefined, updatedAt: now }
          : item
      }
      const linkedAppearance: DynamicLinkedAppearance = {
        triggerItemId: sourceItemId,
        mode,
        delayMs
      }
      return { ...item, linkedAppearance, updatedAt: now }
    })
    const nextItems = synchronizeDynamicLinkedBackgrounds(updatedItems)
    const nextGroup = { ...currentGroup, items: nextItems, updatedAt: now }
    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
    upsertDynamicGroup(nextGroup)
    sendGroupStateSync(nextGroup)
  }

  const handleLinkedAppearanceModeChange = (mode: DynamicLinkedAppearanceMode) => {
    setPendingLinkedAppearanceMode(mode)
    setLinkageErrorKey('')
  }

  const handleLinkedAppearanceDelayChange = (seconds: number) => {
    setPendingLinkDelaySeconds(clamp(Number.isFinite(seconds) ? seconds : 0, 0, 600))
    setLinkageErrorKey('')
  }

  const selectLinkTargetItem = (targetItemId: string) => {
    if (!selectedItem) return
    const currentItems = latestGroupRef.current.items
    if (
      targetItemId === selectedItem.id
      || !currentItems.some((item) => item.id === targetItemId)
    ) {
      setLinkageErrorKey('control.linkageTargetMissing')
      return
    }
    if (wouldCreateDynamicLinkedAppearanceCycle(currentItems, targetItemId, selectedItem.id)) {
      setLinkageErrorKey('control.linkageCycleError')
      return
    }
    setPendingLinkTargetItemId(targetItemId)
    setLinkageErrorKey('')
  }

  const confirmLinkEditor = () => {
    if (!selectedItem || !pendingLinkTargetItemId) {
      setLinkageErrorKey('control.linkageTargetMissing')
      return
    }
    const currentItems = latestGroupRef.current.items
    if (wouldCreateDynamicLinkedAppearanceCycle(currentItems, pendingLinkTargetItemId, selectedItem.id)) {
      setLinkageErrorKey('control.linkageCycleError')
      return
    }
    persistLinkedAppearanceRelation(
      selectedItem.id,
      editingLinkTargetItemId,
      pendingLinkTargetItemId,
      pendingLinkedAppearanceMode,
      clamp(Math.round(pendingLinkDelaySeconds * 1000), 0, 600000)
    )
    closeLinkEditor()
  }

  const removeEditedLink = () => {
    if (!selectedItem || !editingLinkTargetItemId) return
    persistLinkedAppearanceRelation(
      selectedItem.id,
      editingLinkTargetItemId,
      editingLinkTargetItemId,
      'none',
      0
    )
    closeLinkEditor()
  }

  const focusTargetSetButton = () => {
    window.requestAnimationFrame(() => targetSetButtonRef.current?.focus({ preventScroll: true }))
  }

  const handleTargetModeChange = (targetMode: DynamicTargetMode) => {
    if (!selectedItem) return

    // The target mode choice is intentionally only actionable while entering
    // the editor. Once the editor is open, clicking the selected choice must
    // leave the draft position/loop value untouched.
    if (targetMode === 'target') {
      if (targetEditingItemId === selectedItem.id) return
      startTargetEditing()
      return
    }

    clearTargetEditing()
    persistAdvancedItem((item) => ({
      ...item,
      targetMode
    }))
  }

  const handleTargetLoopToggle = () => {
    if (!selectedItem || targetEditingItemId !== selectedItem.id) return
    setTargetDraftLoop((currentLoop) => !currentLoop)
  }

  const startTargetEditing = () => {
    if (!selectedItem) return
    // Avoid reinitializing an in-progress draft when the selected mode card is
    // clicked again.
    if (targetEditingItemId === selectedItem.id) return

    clearTargetEditing()
    targetEditSnapshotRef.current = {
      itemId: selectedItem.id,
      moveMode: selectedItem.moveMode,
      targetMode: selectedItem.targetMode ?? 'loop',
      targetLoop: selectedItem.targetLoop === true,
      targetPosition: selectedItem.targetPosition
    }
    setTargetEditingItemId(selectedItem.id)
    setTargetDraftPosition(selectedItem.targetPosition ?? selectedItem.position)
    setTargetDraftLoop(selectedItem.targetLoop === true)
    setManipulatingItemId(selectedItem.id)
  }

  const cancelTargetEditing = () => {
    // All target changes are held in the draft states until completion, so
    // cancelling naturally leaves the persisted targetMode/targetPosition/
    // targetLoop values untouched. Clear the draft and return focus to the
    // single entry button.
    clearTargetEditing()
    focusTargetSetButton()
  }

  const completeTargetEditing = () => {
    if (!selectedItem || targetEditingItemId !== selectedItem.id || !targetDraftPosition) return
    const targetPosition = {
      x: clamp(targetDraftPosition.x, 0, 1),
      y: clamp(targetDraftPosition.y, 0, 1)
    }
    persistAdvancedItem((item) => ({
      ...item,
      targetMode: 'target',
      targetPosition,
      targetLoop: targetDraftLoop
    }))
    clearTargetEditing()
    focusTargetSetButton()
  }

  const handleTargetEditingKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!targetEditingItemId) return
    if (event.key === 'Enter') {
      event.preventDefault()
      completeTargetEditing()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelTargetEditing()
      return
    }

    const step = event.shiftKey ? 0.05 : 0.01
    const offset = event.key === 'ArrowLeft'
      ? { x: -step, y: 0 }
      : event.key === 'ArrowRight'
        ? { x: step, y: 0 }
        : event.key === 'ArrowUp'
          ? { x: 0, y: -step }
          : event.key === 'ArrowDown'
            ? { x: 0, y: step }
            : null
    if (!offset) return

    event.preventDefault()
    setTargetDraftPosition((currentPosition) => currentPosition ? {
      x: clamp(currentPosition.x + offset.x, 0, 1),
      y: clamp(currentPosition.y + offset.y, 0, 1)
    } : currentPosition)
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
    if (isDynamicBubbleItem(selectedItem)) {
      setEditingBubbleItemId(selectedItem.id)
      setBubbleEditorOpen(true)
      setToolOpen(false)
      setBackgroundPanelOpen(false)
      setAppearPanelOpen(false)
      setRightPanelCollapsed(false)
      return
    }
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
      const nextGroup = isDynamicBubbleItem(selectedItem)
        ? updateDynamicItem(group.id, selectedItem.id, (item) => ({ ...item, name: nextName }))
        : await updateDynamicItemMeta(group.id, selectedItem.id, { name: nextName })
      const updatedItem = nextGroup?.items.find((item) => item.id === selectedItem.id)
      if (!nextGroup || !updatedItem) {
        setItemNameErrorKey('control.nameSaveFailed')
        return
      }

      latestGroupRef.current = nextGroup
      onGroupChange(nextGroup)
      if (isDynamicMediaItem(updatedItem)) {
        sendDynamicEvent(wsIp, dynamicPort, 'ItemUpdate', {
          groupId: group.id,
          itemId: updatedItem.id,
          assetId: updatedItem.media.id,
          name: updatedItem.name,
          mediaType: updatedItem.media.type,
          mimeType: updatedItem.media.mimeType,
          replacedAsset: false
        })
      } else {
        sendGroupStateSync(nextGroup)
      }
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
    setSelectedCopyFields([...allCopyFields])
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
    if (!selectedItem || !copySourceItem || isCopying) return

    const targetItemId = selectedItem.id
    const sourceItemId = copySourceItem.id
    const copyFields = selectedCopyFields.filter((field) => allCopyFields.includes(field))
    if (copyFields.length === 0) return
    if (
      copyFields.includes('linkage')
      && copySourceItem.linkedAppearance
      && wouldCreateDynamicLinkedAppearanceCycle(
        latestGroupRef.current.items,
        targetItemId,
        copySourceItem.linkedAppearance.triggerItemId
      )
    ) {
      setCopyErrorKey('control.linkageCycleError')
      return
    }
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
        if (field === 'motion') return [
          'position',
          'gridIndex',
          'moveMode',
          'movePercent',
          'moveSpeed',
          'moveTrack',
          'targetMode',
          'targetLoop',
          'targetPosition'
        ]
        if (field === 'animation') return ['animationMode', 'animationId', 'clickAnimationIds']
        if (field === 'size') return ['scale', 'rotation']
        if (field === 'deform') return ['flipX', 'flipY']
        if (field === 'audio') return ['audioId', 'audioTrigger', 'audioDelayMs']
        if (field === 'background') return ['backgroundIds']
        return ['linkedAppearance']
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
            track: getItemTrack(copiedItem),
            targetMode: copiedItem.targetMode ?? 'loop',
            targetLoop: copiedItem.targetLoop === true,
            targetPosition: copiedItem.targetPosition ?? null
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
      sendGroupStateSync(nextGroup)

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
    if (target.closest('.dynamic-layer-property-button, .dynamic-layer-delete-button, .dynamic-layer-select, .dynamic-layer-children-toggle')) return

    const sourceRect = event.currentTarget.getBoundingClientRect()

    const dragState: LayerDragState = {
      itemId,
      orderedIds: allLayerItems.map((item) => item.id),
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
    const visibleIds = layerItems.map((item) => item.id)
    const visibleIndex = visibleIds.indexOf(itemId)
    const nextVisibleIndex = visibleIndex + offset
    if (visibleIndex < 0 || nextVisibleIndex < 0 || nextVisibleIndex >= visibleIds.length) return

    const targetItemId = visibleIds[nextVisibleIndex]
    const orderedIds = allLayerItems.map((item) => item.id).filter((id) => id !== itemId)
    const targetIndex = orderedIds.indexOf(targetItemId)
    if (targetIndex < 0) return
    orderedIds.splice(targetIndex + (offset > 0 ? 1 : 0), 0, itemId)
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

  const closeAddItemMenu = (restoreFocus = false) => {
    setAddItemMenuOpen(false)
    if (restoreFocus) {
      window.requestAnimationFrame(() => addItemButtonRef.current?.focus({ preventScroll: true }))
    }
  }

  const openBubbleEditor = (itemId = '') => {
    closeAddItemMenu()
    setEditingBubbleItemId(itemId)
    setBubbleEditorOpen(true)
    setToolOpen(false)
    setBackgroundPanelOpen(false)
    setAppearPanelOpen(false)
    setRightPanelCollapsed(false)
  }

  const closeBubbleEditor = () => {
    if (isSavingBubble) return
    const returnToProperties = Boolean(editingBubbleItemId)
    setBubbleEditorOpen(false)
    setEditingBubbleItemId('')
    if (returnToProperties) {
      setToolOpen(true)
      setRightPanelCollapsed(false)
    }
    window.requestAnimationFrame(() => {
      const focusTarget = returnToProperties
        ? propertyThumbnailButtonRef.current
        : addItemButtonRef.current
      focusTarget?.focus({ preventScroll: true })
    })
  }

  const uploadBubbleImage = (file: File, nextGroup: DynamicGroup, itemId: string) => {
    const bubbleItem = nextGroup.items.find((item) => item.id === itemId)
    if (!bubbleItem || !isDynamicBubbleItem(bubbleItem) || !bubbleItem.bubble.image) return
    const image = bubbleItem.bubble.image
    uploadUnityAsset({
      ip: wsIp,
      port: dynamicPort,
      file,
      fields: {
        role: 'bubbleImage',
        groupId: nextGroup.id,
        itemId,
        assetId: image.id,
        mediaType: image.type,
        mimeType: image.mimeType
      }
    })
  }

  const handleBubbleSubmit = async (value: DynamicBubbleEditorSubmitValue) => {
    if (isSavingBubble) return
    if (!editingBubbleItem && latestGroupRef.current.items.length >= MAX_DYNAMIC_ITEMS_PER_GROUP) {
      window.alert(t('items.limitReached'))
      return
    }

    setIsSavingBubble(true)
    try {
      flushPendingTransformPersist()
      const input: DynamicBubbleInput = {
        ...value,
        name: value.bodyText.trim().split(/\r?\n/, 1)[0]?.slice(0, 28)
          || value.title.trim()
          || (value.bubbleType === 'title'
            ? '标题遮罩'
            : value.bubbleType === 'thought' ? '想象气泡' : '对话气泡')
      }
      const currentGroup = latestGroupRef.current
      const nextGroup = editingBubbleItem
        ? await updateDynamicBubble(currentGroup.id, editingBubbleItem.id, input)
        : await addDynamicBubble(currentGroup.id, input)
      if (!nextGroup) throw new Error('Unable to save bubble')

      const itemId = editingBubbleItem?.id
        ?? nextGroup.items.find((item) => !currentGroup.items.some((currentItem) => currentItem.id === item.id))?.id
      if (!itemId) throw new Error('Unable to resolve bubble item')

      if (value.imageFile) uploadBubbleImage(value.imageFile, nextGroup, itemId)
      latestGroupRef.current = nextGroup
      onGroupChange(nextGroup)
      setSelectedItemId(itemId)
      setBubbleEditorOpen(false)
      setEditingBubbleItemId('')
      setToolOpen(true)
      setRightPanelCollapsed(false)
      sendGroupStateSync(nextGroup)
      playUiSound('success')
      window.requestAnimationFrame(() => propertyThumbnailButtonRef.current?.focus({ preventScroll: true }))
    } finally {
      setIsSavingBubble(false)
    }
  }
  const flowSummary = getDynamicCreationFlowSummary(group)
  const layerRelationTree: DynamicAppearanceRelationTreeNode[] = advancedFeaturesEnabled
    ? buildVisibleLayerRelationTree(flowSummary.relationTree, layerItems)
    : layerItems.map((item) => ({
        itemId: item.id,
        name: item.name,
        order: item.order,
        children: []
      }))
  const layerItemById = new Map(layerItems.map((item) => [item.id, item]))
  const layerParentItemIds = getRelationTreeParentIds(layerRelationTree)
  const selectedLayerAncestorIds = selectedItem
    ? getRelationTreeAncestorIds(layerRelationTree, selectedItem.id)
    : []
  const layerParentItemIdsKey = layerParentItemIds.join('|')
  const selectedLayerAncestorIdsKey = selectedLayerAncestorIds.join('|')

  useEffect(() => {
    const validParentItemIds = new Set(layerParentItemIdsKey ? layerParentItemIdsKey.split('|') : [])
    const expandedAncestorIds = selectedLayerAncestorIdsKey ? selectedLayerAncestorIdsKey.split('|') : []
    setCollapsedLayerItemIds((currentIds) => {
      const nextIds = new Set(
        Array.from(currentIds).filter((itemId) => validParentItemIds.has(itemId))
      )
      expandedAncestorIds.forEach((itemId) => nextIds.delete(itemId))
      if (
        nextIds.size === currentIds.size
        && Array.from(currentIds).every((itemId) => nextIds.has(itemId))
      ) return currentIds
      return nextIds
    })
  }, [layerParentItemIdsKey, selectedLayerAncestorIdsKey])

  const flowStepIndex = DYNAMIC_CREATION_FLOW_STEPS.findIndex((step) => step.id === flowStep)
  const flowStepNumber = Math.max(1, flowStepIndex + 1)
  const flowStepTitleKey = `flow.step${flowStepNumber}Title`
  const flowSyncLabel = receiverSyncError
    ? t('sync.failed')
    : receiverSyncMessage || t('flow.autoSaved')
  const flowItems: DynamicCreationFlowItem[] = sortedItems.map((item, index) => {
    const sourceItem = item.linkedAppearance
      ? sortedItems.find((entry) => entry.id === item.linkedAppearance?.triggerItemId)
      : undefined
    const audio = group.audioLibrary?.find((entry) => entry.id === item.audioId)
    const audioTriggerKey = item.audioTrigger === 'appearanceDelay'
      ? 'control.audioAfterDelay'
      : item.audioTrigger === 'targetArrival'
        ? 'control.audioOnArrival'
        : 'control.audioOnAppearance'
    const backgroundLabel = sourceItem
      ? t('flow.backgroundFollows', { name: sourceItem.name })
      : (item.backgroundIds ?? []).length === 0
        ? t('control.allBackgrounds')
        : t('control.selectedBackgroundCount', { count: item.backgroundIds?.length ?? 0 })

    return {
      id: item.id,
      name: item.name,
      item,
      order: index,
      moveLabel: getTranslatedMotionLabel(item.moveMode),
      animationLabel: `${t('control.animationShort')} ${item.animationId}`,
      targetConfigured: item.targetMode === 'target' && Boolean(item.targetPosition),
      audioId: item.audioId,
      audioTrigger: item.audioTrigger ?? 'appearance',
      audioDelayMs: item.audioDelayMs ?? 0,
      audioTargetMissing: Boolean(
        audio
        && item.audioTrigger === 'targetArrival'
        && (item.targetMode !== 'target' || !item.targetPosition)
      ),
      audioLabel: audio ? `${audio.name} · ${t(audioTriggerKey)}` : t('control.noAudio'),
      backgroundIds: [...(item.backgroundIds ?? [])],
      backgroundLabel,
      linkedAppearance: item.linkedAppearance && sourceItem
        ? {
            sourceId: sourceItem.id,
            sourceName: sourceItem.name,
            mode: item.linkedAppearance.mode,
            delayMs: item.linkedAppearance.delayMs
          }
        : undefined,
      linkedTargetCount: sortedItems.filter((entry) => entry.linkedAppearance?.triggerItemId === item.id).length
    }
  })
  const flowBackgrounds: DynamicCreationFlowBackground[] = backgrounds.map((background) => ({
    id: background.id,
    name: background.name,
    previewUrl: background.url,
    type: background.type
  }))
  const flowAudioLibrary = (group.audioLibrary ?? []).map((audio) => ({
    id: audio.id,
    name: audio.name,
    durationLabel: formatAudioDuration(audio.durationMs)
  }))
  const relevantFlowIssues = advancedFeaturesEnabled
    ? flowSummary.issues
    : flowSummary.issues.filter((issue) => (
        issue.step !== 'appearance'
        && issue.step !== 'backgrounds'
        && issue.step !== 'audio'
        && issue.code !== 'layout.targetMissing'
      ))
  const flowIssues: DynamicCreationFlowIssue[] = relevantFlowIssues.map((issue, index) => {
    const stepNumber = DYNAMIC_CREATION_FLOW_STEPS.findIndex((step) => step.id === issue.step) + 1
    return {
      id: `${issue.code}:${issue.itemId ?? issue.backgroundId ?? index}`,
      severity: issue.severity === 'blocking' ? 'error' : 'warning',
      title: t(issue.messageKey, issue.params ?? {}),
      description: t(`flow.step${Math.max(1, stepNumber)}Description`),
      step: issue.step,
      itemId: issue.itemId,
      actionable: issue.code !== 'review.noVisibleObjects'
        && issue.code !== 'appearance.missingTrigger'
    }
  })

  const setEditorExperience = (experience: DynamicCreationFlowExperience) => {
    if (
      previewMode
      || experience === editorExperience
      || (!advancedFeaturesEnabled && experience === 'flow')
    ) return
    stopAudioPreview()
    clearTargetEditing()
    setBackgroundPanelOpen(false)
    setAppearPanelOpen(false)
    setFlowDetailSection('')
    setRightPanelCollapsed(false)
    setToolOpen(experience === 'flow' && flowStep === 'layout' && Boolean(selectedItem))
    updateFlowSession({ experience })
  }

  const setCreationFlowStep = (step: DynamicCreationFlowStepId, itemId?: string) => {
    if (previewMode) return
    const stepDefinition = DYNAMIC_CREATION_FLOW_STEPS.find((entry) => entry.id === step)
    if (!stepDefinition || (stepDefinition.requiresItems && sortedItems.length === 0)) return

    stopAudioPreview()
    clearTargetEditing()
    setBackgroundPanelOpen(false)
    setAppearPanelOpen(false)
    setFlowDetailSection('')
    setRightPanelCollapsed(false)
    if (itemId && sortedItems.some((item) => item.id === itemId)) setSelectedItemId(itemId)
    setToolOpen(step === 'layout' && sortedItems.length > 0)
    if (step === 'layout' && !['motion', 'animation', 'transform', 'copy'].includes(activeTab)) {
      setActiveTab('motion')
    }
    updateFlowSession({
      step,
      selectedItemId: itemId ?? selectedItemId
    })
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[data-flow-step-heading]')?.focus()
      })
    })
  }

  const moveCreationFlowStep = (offset: -1 | 1) => {
    const nextStep = DYNAMIC_CREATION_FLOW_STEPS[flowStepIndex + offset]
    if (!nextStep) {
      if (offset > 0 && flowStep === 'review') handleControlBack()
      return
    }
    if (offset > 0 && (flowStep === 'backgrounds' || flowStep === 'audio')) {
      const configured = flowSummary.stepStatus[flowStep].configured
      const skippedSteps = configured
        ? flowSession.skippedSteps.filter((stepId) => stepId !== flowStep)
        : Array.from(new Set([...flowSession.skippedSteps, flowStep]))
      if (skippedSteps.length !== flowSession.skippedSteps.length
        || skippedSteps.some((stepId, index) => stepId !== flowSession.skippedSteps[index])) {
        updateFlowSession({ skippedSteps })
      }
    }
    setCreationFlowStep(nextStep.id)
  }

  const handleFlowAppearanceMove = (itemId: string, direction: 'up' | 'down') => {
    const playbackIds = sortedItems.map((item) => item.id)
    const rootItemIds = flowSummary.relationTree.map((node) => node.itemId)
    const currentRootIndex = rootItemIds.indexOf(itemId)
    const nextRootIndex = currentRootIndex + (direction === 'up' ? -1 : 1)
    if (currentRootIndex < 0 || nextRootIndex < 0 || nextRootIndex >= rootItemIds.length) return

    const currentIndex = playbackIds.indexOf(itemId)
    const nextIndex = playbackIds.indexOf(rootItemIds[nextRootIndex])
    if (currentIndex < 0 || nextIndex < 0) return

    const nextPlaybackIds = [...playbackIds]
    const currentItemId = nextPlaybackIds[currentIndex]
    nextPlaybackIds[currentIndex] = nextPlaybackIds[nextIndex]
    nextPlaybackIds[nextIndex] = currentItemId
    const layerOrderIds = convertDynamicPlaybackOrderToLayerOrder(nextPlaybackIds, playbackIds)
    const nextGroup = reorderDynamicItems(group.id, layerOrderIds, latestGroupRef.current)
    if (!nextGroup) return

    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
    sendGroupStateSync(nextGroup)
    setSelectedItemId(itemId)
  }

  const handleFlowAddRelation = (sourceItemId: string) => {
    if (!advancedFeaturesEnabled) return
    setPendingFlowLinkTargetId('')
    selectItem(sourceItemId, false)
    setPendingFlowLinkSourceId(sourceItemId)
  }

  const handleFlowEditRelation = (targetItemId: string) => {
    if (!advancedFeaturesEnabled) return
    const targetItem = sortedItems.find((item) => item.id === targetItemId)
    const sourceItemId = targetItem?.linkedAppearance?.triggerItemId
    if (!sourceItemId || !sortedItems.some((item) => item.id === sourceItemId)) return
    setPendingFlowLinkTargetId(targetItemId)
    selectItem(sourceItemId, false)
    setPendingFlowLinkSourceId(sourceItemId)
  }

  const handleFlowSetItemBackgrounds = (itemId: string, nextBackgroundIds: string[]) => {
    if (!advancedFeaturesEnabled) return
    const currentItem = sortedItems.find((item) => item.id === itemId)
    if (!currentItem) return
    const incomingSourceExists = Boolean(
      currentItem.linkedAppearance
      && sortedItems.some((item) => item.id === currentItem.linkedAppearance?.triggerItemId)
    )
    if (incomingSourceExists) return

    const validBackgroundIds = Array.from(new Set(nextBackgroundIds)).filter((backgroundId) => (
      backgrounds.some((background) => background.id === backgroundId)
    ))
    const currentBackgroundIds = currentItem.backgroundIds ?? []
    if (
      currentBackgroundIds.length === validBackgroundIds.length
      && currentBackgroundIds.every((backgroundId, index) => backgroundId === validBackgroundIds[index])
    ) {
      selectItem(itemId, false)
      return
    }

    const changedItem = updateItemLocal(itemId, (item) => ({
      ...item,
      backgroundIds: validBackgroundIds
    }), { persist: true, emit: false })
    if (!changedItem) return
    selectItem(itemId, false)
    sendGroupStateSync(latestGroupRef.current)
  }

  const updateFlowItemAudio = (
    itemId: string,
    updater: (item: DynamicItem) => DynamicItem
  ) => {
    if (!advancedFeaturesEnabled) return
    if (!sortedItems.some((item) => item.id === itemId)) return
    const changedItem = updateItemLocal(itemId, updater, { persist: true, emit: false })
    if (changedItem) sendGroupStateSync(latestGroupRef.current)
  }

  const handleFlowSetItemAudio = (itemId: string, audioId?: string) => {
    const validAudioId = audioId && (group.audioLibrary ?? []).some((audio) => audio.id === audioId)
      ? audioId
      : undefined
    updateFlowItemAudio(itemId, (item) => ({ ...item, audioId: validAudioId }))
  }

  const handleFlowSetItemAudioTrigger = (itemId: string, audioTrigger: DynamicItemAudioTrigger) => {
    updateFlowItemAudio(itemId, (item) => ({ ...item, audioTrigger }))
  }

  const handleFlowSetItemAudioDelay = (itemId: string, delayMs: number) => {
    const audioDelayMs = clamp(Math.round(delayMs), 0, 600000)
    updateFlowItemAudio(itemId, (item) => ({ ...item, audioDelayMs }))
  }

  const handleFlowAudioPreview = (audioId: string) => {
    const audio = group.audioLibrary?.find((entry) => entry.id === audioId)
    if (audio) toggleAudioPreview(audio)
  }

  const handleFlowIssue = (issue: DynamicCreationFlowIssue) => {
    const issueStep = issue.step as DynamicCreationFlowStepId
    setCreationFlowStep(issueStep, issue.itemId)
    if (!issue.itemId || !advancedFeaturesEnabled) return
    if (issueStep === 'backgrounds') {
      setFlowDetailSection('background')
      setActiveTab('background')
      selectItem(issue.itemId, true)
    } else if (issueStep === 'audio') {
      setFlowDetailSection('audio')
      setActiveTab('audio')
      selectItem(issue.itemId, true)
    } else if (issueStep === 'layout') {
      setActiveTab('motion')
      selectItem(issue.itemId, true)
    } else {
      selectItem(issue.itemId, false)
    }
  }

  const handleFlowPreview = () => {
    const firstBlockingIssue = flowIssues.find((issue) => issue.severity === 'error')
    if (firstBlockingIssue) {
      handleFlowIssue(firstBlockingIssue)
      return
    }
    setPreviewModeEnabled(true)
  }

  const skipCurrentFlowStep = () => {
    if (flowStep !== 'backgrounds' && flowStep !== 'audio') return
    moveCreationFlowStep(1)
  }

  const closeFlowDetail = () => {
    stopAudioPreview()
    clearTargetEditing()
    setFlowDetailSection('')
    setToolOpen(false)
  }
  const flowNextDisabled = sortedItems.length === 0

  const toggleLayerChildren = (itemId: string) => {
    setCollapsedLayerItemIds((currentIds) => {
      const nextIds = new Set(currentIds)
      if (nextIds.has(itemId)) nextIds.delete(itemId)
      else nextIds.add(itemId)
      return nextIds
    })
  }

  const renderLayerNode = (
    node: DynamicAppearanceRelationTreeNode,
    depth: number
  ): React.ReactNode => {
    const item = layerItemById.get(node.itemId)
    if (!item) return null

    const motionLabel = getTranslatedMotionLabel(item.moveMode)
    const linkedSourceItem = advancedFeaturesEnabled && item.linkedAppearance
      ? sortedItems.find((entry) => entry.id === item.linkedAppearance?.triggerItemId)
      : undefined
    const hasChildren = node.children.length > 0
    const childrenExpanded = hasChildren && !collapsedLayerItemIds.has(item.id)
    const childrenId = `dynamic-layer-children-${item.id}`
    const hasLinkedRelation = advancedFeaturesEnabled && Boolean(linkedSourceItem || hasChildren)

    return (
      <li
        key={item.id}
        className={`dynamic-layer-node depth-${Math.min(depth, 3)} ${depth > 0 ? 'is-child' : 'is-root'}`}
      >
        <article
          data-layer-item-id={item.id}
          className={`dynamic-layer-card ${selectedItem?.id === item.id ? 'active' : ''} ${selectedLayerItemIds.includes(item.id) ? 'is-checked' : ''} ${pressedLayerItemId === item.id ? 'is-pressed' : ''} ${draggedLayerItemId === item.id ? 'dragging' : ''} ${layerDropHint?.itemId === item.id ? `drop-${layerDropHint.placement}` : ''} ${hasLinkedRelation ? 'has-linked-relation' : ''} ${hasChildren ? 'has-children' : ''} ${depth > 0 ? 'is-child-card' : ''}`}
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
            onClick={() => selectItem(
              item.id,
              editorExperience !== 'flow' || flowStep !== 'objects'
            )}
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
            <DynamicItemThumbnail item={item} />
            <span className="dynamic-layer-copy">
              <strong>{item.name}</strong>
              <small>{t('control.layerSummary', { motion: motionLabel, animation: item.animationId })}</small>
              {linkedSourceItem && (
                <span
                  className="dynamic-layer-parent-summary"
                  title={t('control.linkageControlledByNamed', { name: linkedSourceItem.name })}
                >
                  <LockKeyhole size={10} strokeWidth={2.6} aria-hidden="true" />
                  <span>{t('control.linkageFromCompact', { name: linkedSourceItem.name })}</span>
                </span>
              )}
            </span>
          </button>
          <div className="dynamic-layer-actions">
            <button
              type="button"
              className="dynamic-layer-property-button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                if (editorExperience === 'flow' && flowStep === 'objects') {
                  setCreationFlowStep('layout', item.id)
                } else {
                  selectItem(item.id, true)
                }
              }}
              aria-label={t('control.openObjectProperties', { name: item.name })}
              title={t('control.objectProperties')}
            >
              {t('control.properties')}
            </button>
            <button
              type="button"
              className="dynamic-layer-delete-button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                handleItemDelete(item.id)
              }}
              aria-label={t('control.deleteNamed', { name: item.name })}
              title={t('items.delete')}
            >
              ×
            </button>
          </div>
          {hasChildren && (
            <button
              type="button"
              className="dynamic-layer-children-toggle"
              aria-expanded={childrenExpanded}
              aria-controls={childrenId}
              aria-label={t(
                childrenExpanded ? 'flow.collapseChildren' : 'flow.expandChildren',
                { count: node.children.length }
              )}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                toggleLayerChildren(item.id)
              }}
            >
              <Link2 size={15} strokeWidth={2.4} aria-hidden="true" />
              <span>{t('flow.childCount', { count: node.children.length })}</span>
              {childrenExpanded
                ? <ChevronDown size={16} strokeWidth={2.4} aria-hidden="true" />
                : <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />}
            </button>
          )}
        </article>

        {hasChildren && childrenExpanded && (
          <ol id={childrenId} className="dynamic-layer-children">
            {node.children.map((child) => renderLayerNode(child, depth + 1))}
          </ol>
        )}
      </li>
    )
  }

  return (
    <main
      className={`ipad-screen dynamic-control-screen apple-container ${editorExperience === 'flow' ? 'dynamic-flow-mode' : ''} ${previewMode ? 'dynamic-previewing' : ''} ${backgroundPanelOpen ? 'dynamic-background-open' : ''} ${transitionPreparing ? 'dynamic-transition-prepared' : ''} dynamic-right-panel-${rightPanelMode}`}
      aria-hidden={transitionPreparing || undefined}
    >
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

            <div className={`dynamic-control-actions ${editorExperience === 'flow' ? 'is-flow-experience' : 'is-free-experience'}`}>
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
              <input
                ref={itemAudioInputRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.ogg"
                className="hidden"
                onChange={handleItemAudioChange}
              />
              <input
                ref={backgroundAudioInputRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.ogg"
                className="hidden"
                onChange={handleBackgroundAudioChange}
              />
              <input
                ref={flowAudioInputRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.ogg"
                className="hidden"
                onChange={handleFlowAudioChange}
              />
              {editorExperience === 'flow' && (
                <nav className="dynamic-flow-step-nav" aria-label={t('flow.openSteps')}>
                  <ol className={`dynamic-flow-step-list ${DYNAMIC_CREATION_FLOW_STEPS.length > 5 ? 'has-max-count' : ''}`}>
                    {DYNAMIC_CREATION_FLOW_STEPS.map((step) => {
                      const isCurrent = step.id === flowStep
                      const isPast = step.index < flowStepIndex
                      const stepStatus = flowSummary.stepStatus[step.id]
                      const hasRelevantBlockingIssue = flowIssues.some((issue) => (
                        issue.severity === 'error'
                        && (step.id === 'review' || issue.step === step.id)
                      ))
                      const isComplete = isPast && (
                        (stepStatus.configured && !hasRelevantBlockingIssue)
                        || (!stepStatus.configured && flowSession.skippedSteps.includes(step.id))
                      )
                      const isError = isPast && hasRelevantBlockingIssue
                      const isDisabled = step.requiresItems && sortedItems.length === 0
                      const status = isCurrent
                        ? 'process'
                        : isDisabled
                          ? 'disabled'
                          : isError
                            ? 'error'
                            : isComplete
                              ? 'finish'
                              : 'wait'
                      return (
                        <li key={step.id} className="dynamic-flow-step-item" data-status={status}>
                          <button
                            type="button"
                            className="dynamic-flow-step-button"
                            onClick={() => {
                              if (!isDisabled) setCreationFlowStep(step.id)
                            }}
                            onKeyDown={(event) => {
                              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                              event.preventDefault()
                              const buttons = Array.from(
                                event.currentTarget.closest('ol')?.querySelectorAll<HTMLButtonElement>('.dynamic-flow-step-button') ?? []
                              )
                              const currentIndex = buttons.indexOf(event.currentTarget)
                              const nextIndex = event.key === 'Home'
                                ? 0
                                : event.key === 'End'
                                  ? buttons.length - 1
                                  : Math.min(
                                    buttons.length - 1,
                                    Math.max(0, currentIndex + (event.key === 'ArrowRight' ? 1 : -1))
                                  )
                              buttons[nextIndex]?.focus()
                            }}
                            aria-current={isCurrent ? 'step' : undefined}
                            aria-disabled={isDisabled || undefined}
                            aria-label={`${t('flow.stepProgress', { current: step.index + 1, total: DYNAMIC_CREATION_FLOW_STEPS.length })}: ${t(`flow.step${step.index + 1}Title`)}`}
                            title={t(`flow.step${step.index + 1}Description`)}
                          >
                            <span className="dynamic-flow-step-index" aria-hidden="true">
                              {isComplete ? <Check size={13} strokeWidth={2.8} /> : step.index + 1}
                            </span>
                            <span className="dynamic-flow-step-label">{t(`flow.step${step.index + 1}Title`)}</span>
                          </button>
                          {step.index < DYNAMIC_CREATION_FLOW_STEPS.length - 1 && (
                            <span className="dynamic-flow-step-connector" aria-hidden="true" />
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </nav>
              )}

              {advancedFeaturesEnabled && (
                <div className="dynamic-editor-experience-switch" role="group" aria-label={t('flow.switchMode')}>
                  <button
                    type="button"
                    className={editorExperience === 'flow' ? 'is-active' : ''}
                    aria-pressed={editorExperience === 'flow'}
                    onClick={() => setEditorExperience('flow')}
                    title={t('flow.modeGuidedDescription')}
                  >
                    {t('flow.modeGuided')}
                  </button>
                  <button
                    type="button"
                    className={editorExperience === 'free' ? 'is-active' : ''}
                    aria-pressed={editorExperience === 'free'}
                    onClick={() => setEditorExperience('free')}
                    title={t('flow.modeFreeDescription')}
                  >
                    {t('flow.modeFree')}
                  </button>
                </div>
              )}

              {editorExperience === 'free' && (
                <>
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
                </>
              )}
            </div>
          </>
        )}
      </header>

      {(audioFileErrorKey || receiverSyncStatus || receiverSyncError) && (
        <div
          className={`status-toast ${audioFileErrorKey || receiverSyncError ? 'error' : 'success'}`}
          role={audioFileErrorKey || receiverSyncError ? 'alert' : 'status'}
          aria-live={audioFileErrorKey || receiverSyncError ? 'assertive' : 'polite'}
        >
          {audioFileErrorKey ? t(audioFileErrorKey) : receiverSyncMessage}
        </div>
      )}

      <section className="dynamic-control-workspace">
        <div className={`dynamic-editor-row ${previewMode ? 'preview-only' : ''} ${rightPanelVisible ? 'right-panel-open' : 'right-panel-collapsed'}`}>
          <div className="dynamic-stage-shell">
            <div
              ref={stageRef}
              className={`dynamic-stage ${activeTab === 'motion' && toolOpen ? 'show-zones' : ''} ${backgroundTransitionState ? `is-background-transition is-${backgroundTransitionState.type} is-${backgroundTransitionState.phase}` : ''}`}
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
                  autoPlay={!transitionPreparing}
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

            {advancedFeaturesEnabled && targetEditingItem && targetDraftPosition && (() => {
              const width = stageSize.width || DEFAULT_STAGE_PREVIEW_WIDTH
              const height = stageSize.height || DEFAULT_STAGE_PREVIEW_HEIGHT
              const startX = targetEditingItem.position.x * width
              const startY = targetEditingItem.position.y * height
              const endX = targetDraftPosition.x * width
              const endY = targetDraftPosition.y * height
              const distance = Math.hypot(endX - startX, endY - startY)
              const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI
              const coordinatesOverlap = distance < 8
              const markersOverlap = distance < 36
              const startPointLabel = String(t('control.startPoint'))
              const endPointLabel = String(t('control.endPoint'))
              const itemPreviewSize = getDynamicItemPreviewSize(
                targetEditingItem,
                isDynamicMediaItem(targetEditingItem)
                  ? itemImageSizes[targetEditingItem.media.id]
                  : undefined,
                stageSize
              )
              const itemScale = Math.max(Math.abs(targetEditingItem.scale), MIN_ITEM_SCALE)
              const rotationRadians = targetEditingItem.rotation * Math.PI / 180
              const rotatedItemHeight = (
                Math.abs(itemPreviewSize.height * itemScale * Math.cos(rotationRadians))
                + Math.abs(itemPreviewSize.width * itemScale * Math.sin(rotationRadians))
              )
              const labelHeight = 30
              const labelGap = 14
              const estimateLabelWidth = (label: string) => Math.max(
                68,
                40 + Array.from(label).reduce((total, character) => (
                  total + (/[^\u0000-\u00ff]/.test(character) ? 13 : 8)
                ), 0)
              )
              const startLabelWidth = Math.min(width - 16, estimateLabelWidth(startPointLabel))
              const endLabelWidth = Math.min(width - 16, estimateLabelWidth(endPointLabel))
              const clampLabelX = (pointX: number, labelWidth: number) => {
                const halfWidth = labelWidth / 2
                return clamp(pointX, halfWidth + 8, width - halfWidth - 8)
              }
              const resolveLabelY = (pointY: number) => {
                const aboveAnchor = pointY - rotatedItemHeight / 2 - labelGap
                const belowAnchor = pointY + rotatedItemHeight / 2 + labelGap
                if (aboveAnchor - labelHeight >= 8) {
                  return { y: aboveAnchor, below: false }
                }
                if (belowAnchor + labelHeight <= height - 8) {
                  return { y: belowAnchor, below: true }
                }
                return {
                  y: clamp(aboveAnchor, labelHeight + 8, height - 8),
                  below: false
                }
              }
              const startLabelY = resolveLabelY(startY)
              const endLabelY = resolveLabelY(endY)
              let startLabelX = clampLabelX(startX, startLabelWidth)
              let endLabelX = clampLabelX(endX, endLabelWidth)
              const startLabelTop = startLabelY.below ? startLabelY.y : startLabelY.y - labelHeight
              const endLabelTop = endLabelY.below ? endLabelY.y : endLabelY.y - labelHeight
              const labelsOverlap = (
                startLabelX + startLabelWidth / 2 + 10 > endLabelX - endLabelWidth / 2
                && endLabelX + endLabelWidth / 2 + 10 > startLabelX - startLabelWidth / 2
                && startLabelTop + labelHeight + 8 > endLabelTop
                && endLabelTop + labelHeight + 8 > startLabelTop
              )
              if (labelsOverlap) {
                const pairGap = 14
                const pairWidth = startLabelWidth + pairGap + endLabelWidth
                const pairCenter = (startX + endX) / 2
                const pairLeft = clamp(
                  pairCenter - pairWidth / 2,
                  8,
                  Math.max(8, width - pairWidth - 8)
                )
                startLabelX = pairLeft + startLabelWidth / 2
                endLabelX = pairLeft + startLabelWidth + pairGap + endLabelWidth / 2
              }
              return (
                <>
                  <div
                    className="dynamic-target-editor-underlay"
                    aria-hidden="true"
                    style={{ zIndex: 10 + targetEditingItem.order }}
                  >
                    <span
                      className={`dynamic-target-path ${coordinatesOverlap ? 'is-overlapping' : ''}`}
                      style={{
                        left: `${startX}px`,
                        top: `${startY}px`,
                        width: `${distance}px`,
                        transform: `rotate(${angle}deg)`
                      }}
                    />
                    <span
                      className="dynamic-target-origin-ghost"
                      data-dynamic-item-id={targetEditingItem.id}
                      style={{
                        left: `${targetEditingItem.position.x * 100}%`,
                        top: `${targetEditingItem.position.y * 100}%`,
                        width: `${itemPreviewSize.width}px`,
                        height: `${itemPreviewSize.height}px`
                      }}
                    >
                      <span
                        className="dynamic-target-origin-ghost-transform"
                        style={{
                          transform: `rotate(${targetEditingItem.rotation}deg) scale(${getItemFlipX(targetEditingItem) ? -targetEditingItem.scale : targetEditingItem.scale}, ${getItemFlipY(targetEditingItem) ? -targetEditingItem.scale : targetEditingItem.scale})`
                        }}
                      >
                        {isDynamicBubbleItem(targetEditingItem) ? (
                          <DynamicBubbleVisual
                            bubble={toDynamicBubbleDraft(targetEditingItem.bubble)}
                            className="dynamic-stage-bubble-visual"
                          />
                        ) : (
                          <img src={targetEditingItem.media.url} alt="" draggable={false} decoding="async" />
                        )}
                      </span>
                    </span>
                  </div>
                  <div
                    className={`dynamic-target-editor-overlay ${markersOverlap ? 'is-overlapping' : ''}`}
                    role="img"
                    aria-label={`${startPointLabel}: ${targetEditingItem.name}; ${endPointLabel}: ${targetEditingItem.name}`}
                  >
                    <span
                      className="dynamic-target-marker origin"
                      aria-hidden="true"
                      style={{ left: `${targetEditingItem.position.x * 100}%`, top: `${targetEditingItem.position.y * 100}%` }}
                    />
                    <span
                      className="dynamic-target-marker destination"
                      aria-hidden="true"
                      style={{ left: `${targetDraftPosition.x * 100}%`, top: `${targetDraftPosition.y * 100}%` }}
                    />
                    <span
                      className={`dynamic-target-label origin ${startLabelY.below ? 'is-below' : ''}`}
                      style={{ left: `${startLabelX}px`, top: `${startLabelY.y}px`, width: `${startLabelWidth}px` }}
                    >
                      <span>{startPointLabel}</span>
                    </span>
                    <span
                      className={`dynamic-target-label destination ${endLabelY.below ? 'is-below' : ''}`}
                      style={{ left: `${endLabelX}px`, top: `${endLabelY.y}px`, width: `${endLabelWidth}px` }}
                    >
                      <span>{endPointLabel}</span>
                    </span>
                  </div>
                </>
              )
            })()}

            {displayedItems.map((item, index) => {
              const isManipulating = manipulatingItemId === item.id
              const resolvedMoveMode = resolvePreviewMotionMode(item, group.id, previewReplayId)
              const resolvedAnimationId = previewMode
                ? getResolvedPreviewAnimationId(item, group.id, previewReplayId)
                : 0
              const isAmplitudeStatic = resolvedMoveMode !== 'left' && resolvedMoveMode !== 'right' && item.movePercent <= 0
              const targetEnabled = advancedFeaturesEnabled
                && item.targetMode === 'target'
                && Boolean(item.targetPosition)
              const shouldPlayMotion = previewMode && !isManipulating && !isAmplitudeStatic && !targetEnabled
              const motionMode = shouldPlayMotion ? resolvedMoveMode : 'none'
              const appearDelayMs = previewMode && group.appearMode === 'sequence' ? index * appearIntervalMs : 0
              const playbackEpoch = advancedFeaturesEnabled && previewMode
                ? itemPlaybackEpochs[item.id]
                : undefined
              const appearanceSchedule = playbackEpoch?.schedule
                ?? (advancedFeaturesEnabled && previewMode ? baseAppearanceTimeline[item.id] : undefined)
              const timelineElapsedMs = playbackEpoch
                ? Math.max(0, performance.now() - playbackEpoch.startedAt)
                : 0
              const motionDelayMs = appearanceSchedule
                ? appearanceSchedule.activeStartMs - timelineElapsedMs
                : appearDelayMs
              const animationStartedAtMs = playbackEpoch
                ? playbackEpoch.startedAt + appearanceSchedule!.activeStartMs
                : undefined
              const cachedItemSize = isDynamicMediaItem(item)
                ? itemImageSizes[item.media.id]
                : undefined
              const itemReady = isDynamicBubbleItem(item)
                || Boolean(readyItemMediaIds[item.media.id])
              const itemPreviewSize = getDynamicItemPreviewSize(item, cachedItemSize, stageSize)
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
                  schedule={appearanceSchedule}
                  epochStartedAt={playbackEpoch?.startedAt}
                  style={{
                    ...getMotionPreviewStyle(item, motionMode, !shouldPlayMotion, stageSize),
                    width: `${compositorSize.width}px`,
                    height: `${compositorSize.height}px`,
                    '--motion-delay': `${motionDelayMs}ms`
                  } as React.CSSProperties}
                >
                  <div className="dynamic-stage-item-wave">
                    <DynamicStageAppearance
                      previewing={previewMode}
                      ready={itemReady}
                      appearDelayMs={appearDelayMs}
                      appearAnimation={displayedAppearAnimation}
                      track={getItemTrack(item)}
                      item={item}
                      itemSize={itemPreviewSize}
                      stageSize={stageSize}
                      replayId={previewReplayId}
                      schedule={appearanceSchedule}
                      epochStartedAt={playbackEpoch?.startedAt}
                    >
                      <DynamicStageTarget
                        previewing={previewMode}
                        ready={itemReady}
                        enabled={targetEnabled}
                        loop={targetEditingItemId === item.id ? targetDraftLoop : item.targetLoop === true}
                        editing={targetEditingItemId === item.id}
                        item={item}
                        targetPosition={targetEditingItemId === item.id
                          ? targetDraftPosition ?? item.position
                          : item.targetPosition}
                        stageSize={stageSize}
                        appearDelayMs={appearDelayMs}
                        appearAnimation={displayedAppearAnimation}
                        replayId={previewReplayId}
                        schedule={appearanceSchedule}
                        epochStartedAt={playbackEpoch?.startedAt}
                        onArrival={handleTargetArrival}
                        editingLabel={`${item.name}: ${t('control.endPoint')}`}
                        editingDescriptionId={`dynamic-target-edit-help-${item.id} dynamic-target-edit-position-${item.id}`}
                        onEditingKeyDown={handleTargetEditingKeyDown}
                      >
                        <DynamicStageItemAnimation
                          animationId={resolvedAnimationId}
                          itemId={item.id}
                          enabled={previewMode
                            && resolvedAnimationId >= 1
                            && resolvedAnimationId <= 8}
                          coordinateScale={animationCoordinateScale}
                          startedAtMs={animationStartedAtMs}
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
                              {isDynamicBubbleItem(item) ? (
                                <DynamicBubbleVisual
                                  bubble={toDynamicBubbleDraft(item.bubble)}
                                  animate={previewMode}
                                  playbackKey={playbackEpoch?.key ?? previewReplayId}
                                  revealDelayMs={Math.max(0, motionDelayMs)}
                                  className={`dynamic-stage-bubble-visual ${!previewMode && selectedItem?.id === item.id ? 'is-active' : ''} ${copyFeedbackItemId === item.id ? 'is-copy-pulse' : ''}`}
                                  ariaLabel={item.name}
                                />
                              ) : (
                                <DynamicStageMedia
                                  src={item.media.url}
                                  name={item.name}
                                  mediaId={item.media.id}
                                  animationId={resolvedAnimationId}
                                  previewMode={previewMode}
                                  replayId={previewReplayId}
                                  playbackKey={playbackEpoch?.key}
                                  animationStartedAtMs={animationStartedAtMs}
                                  active={!previewMode && selectedItem?.id === item.id}
                                  copyPulse={copyFeedbackItemId === item.id}
                                  onImageLoad={handleItemImageLoad}
                                  onImageError={handleItemImageError}
                                />
                              )}
                            </div>
                          </div>
                        </DynamicStageItemAnimation>
                      </DynamicStageTarget>
                    </DynamicStageAppearance>
                  </div>
                </DynamicStageMotion>
              )
            })}
            {advancedFeaturesEnabled
              && !previewMode
              && !targetEditingItemId
              && (
                (editorExperience === 'free' && toolOpen)
                || (editorExperience === 'flow' && flowStep === 'appearance')
              )
              && selectedStageRelations.length > 0 && (
              <div className="dynamic-linkage-stage-overlay" aria-hidden="true">
                <svg
                  viewBox={`0 0 ${stageSize.width || DEFAULT_STAGE_PREVIEW_WIDTH} ${stageSize.height || DEFAULT_STAGE_PREVIEW_HEIGHT}`}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <marker
                      id="dynamic-linkage-arrowhead"
                      markerWidth="9"
                      markerHeight="9"
                      refX="7"
                      refY="4.5"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M 0 0 L 9 4.5 L 0 9 z" />
                    </marker>
                  </defs>
                  {selectedStageRelations.map(({ sourceItem, targetItem }) => {
                    const width = stageSize.width || DEFAULT_STAGE_PREVIEW_WIDTH
                    const height = stageSize.height || DEFAULT_STAGE_PREVIEW_HEIGHT
                    const sourceX = sourceItem.position.x * width
                    const sourceY = sourceItem.position.y * height
                    const targetX = targetItem.position.x * width
                    const targetY = targetItem.position.y * height
                    const bend = Math.min(72, Math.max(28, Math.abs(targetX - sourceX) * 0.18))
                    return (
                      <path
                        key={`${sourceItem.id}:${targetItem.id}`}
                        d={`M ${sourceX} ${sourceY} C ${sourceX + bend} ${sourceY - bend}, ${targetX - bend} ${targetY - bend}, ${targetX} ${targetY}`}
                        markerEnd="url(#dynamic-linkage-arrowhead)"
                      />
                    )
                  })}
                </svg>
                {selectedStageRelationNodes.map(({ item, isSource, isTarget }) => (
                  <span
                    key={item.id}
                    className={`dynamic-linkage-stage-node ${isSource ? 'is-source' : ''} ${isTarget ? 'is-target' : ''}`}
                    style={{ left: `${item.position.x * 100}%`, top: `${item.position.y * 100}%` }}
                  >
                    {isSource && isTarget
                      ? t('control.linkageBothRoles')
                      : isSource
                        ? t('control.linkageSourceRole')
                        : t('control.linkageTargetRole')}
                    <strong>{item.name}</strong>
                  </span>
                ))}
              </div>
            )}
            {backgroundTransitionState && (
              <div
                key={backgroundTransitionState.key}
                className={`dynamic-background-transition-layer is-${backgroundTransitionState.type} is-${backgroundTransitionState.phase}`}
                aria-hidden="true"
              >
                {backgroundTransitionState.type === 'curtain' && (
                  <>
                    <span className="dynamic-curtain-panel is-left" />
                    <span className="dynamic-curtain-panel is-right" />
                    <span className="dynamic-curtain-valance" />
                  </>
                )}
                {backgroundTransitionState.type === 'cameraFlash' && (
                  <span className="dynamic-camera-flash" />
                )}
                {backgroundTransitionState.type === 'shadowPlay' && (
                  <>
                    <span className="dynamic-shadow-cloth" />
                    <span className="dynamic-shadow-rod" />
                  </>
                )}
              </div>
            )}
            </div>
          </div>

        {rightPanelMode === 'flow'
          && (
            flowStep === 'appearance'
            || flowStep === 'backgrounds'
            || flowStep === 'audio'
            || flowStep === 'review'
          ) && (
          <DynamicCreationFlowPanel
            step={flowStep}
            items={flowItems}
            backgrounds={flowBackgrounds}
            audioLibrary={flowAudioLibrary}
            selectedItemId={selectedItem?.id ?? null}
            advancedFeaturesEnabled={advancedFeaturesEnabled}
            isAddingAudio={isAddingAudio}
            previewingAudioId={previewingAudioId}
            appearMode={group.appearMode}
            appearIntervalMs={appearIntervalMs}
            appearAnimation={displayedAppearAnimation}
            appearanceTree={flowSummary.relationTree}
            summary={{
              itemCount: flowSummary.itemCount,
              backgroundCount: flowSummary.backgroundCount,
              audioCount: flowSummary.itemAudioCount + flowSummary.backgroundAudioCount,
              relationCount: flowSummary.linkedAppearanceCount
            }}
            issues={flowIssues}
            syncLabel={flowSyncLabel}
            onSelectItem={(itemId) => selectItem(itemId, false)}
            onMoveAppearance={handleFlowAppearanceMove}
            onAddRelation={handleFlowAddRelation}
            onEditRelation={handleFlowEditRelation}
            onSetItemBackgrounds={handleFlowSetItemBackgrounds}
            onManageBackgrounds={openBackgroundEditor}
            onUploadAudio={() => flowAudioInputRef.current?.click()}
            onPreviewAudio={handleFlowAudioPreview}
            onSetItemAudio={handleFlowSetItemAudio}
            onSetItemAudioTrigger={handleFlowSetItemAudioTrigger}
            onSetItemAudioDelay={handleFlowSetItemAudioDelay}
            onSetAppearMode={setAppearMode}
            onSetAppearInterval={setAppearInterval}
            onSetAppearAnimation={setAppearAnimation}
            onStartPreview={handleFlowPreview}
            onGoToIssue={handleFlowIssue}
          />
        )}

        {rightPanelMode === 'layers' && (
          <aside
            className="dynamic-layer-panel"
            aria-label={t('control.layers')}
          >
            <div className="dynamic-layer-header">
              <div>
                <p className="eyebrow">{t('control.stageStructure')}</p>
                <h2 data-flow-step-heading tabIndex={-1}>{t('control.layers')} <span>{group.items.length}/{MAX_DYNAMIC_ITEMS_PER_GROUP}</span></h2>
              </div>
              <div className="dynamic-add-item-menu-anchor">
                <button
                  ref={addItemButtonRef}
                  type="button"
                  className="drawer-add-item-button"
                  disabled={isAddingLayerItem || group.items.length >= MAX_DYNAMIC_ITEMS_PER_GROUP}
                  onClick={() => {
                    setToolOpen(false)
                    setBackgroundPanelOpen(false)
                    setRightPanelCollapsed(false)
                    setAppearPanelOpen(false)
                    setAddItemMenuOpen((open) => !open)
                  }}
                  aria-label={t('items.add')}
                  title={t('items.add')}
                  aria-haspopup="menu"
                  aria-expanded={addItemMenuOpen}
                  aria-controls="dynamic-add-item-menu"
                >
                  +
                </button>
                {addItemMenuOpen && (
                  <>
                    <button
                      type="button"
                      className="dynamic-add-item-menu-scrim"
                      aria-label="关闭新增物件菜单"
                      onClick={() => closeAddItemMenu(true)}
                    />
                    <div
                      id="dynamic-add-item-menu"
                      className="dynamic-add-item-menu"
                      role="menu"
                      aria-label="选择物件类型"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          closeAddItemMenu()
                          layerItemInputRef.current?.click()
                        }}
                      >
                        <span className="dynamic-add-item-menu-icon is-media"><ImageIcon aria-hidden="true" /></span>
                        <span><strong>上传物件</strong><small>相册、拍照或文件</small></span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => openBubbleEditor()}>
                        <span className="dynamic-add-item-menu-icon is-bubble"><MessageCircleMore aria-hidden="true" /></span>
                        <span><strong>添加气泡</strong><small>对话、想象或标题</small></span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              {editorExperience === 'free' && (
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
                  <ChevronRight size={22} strokeWidth={2.4} aria-hidden="true" />
                </button>
              )}
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
              <ol className="dynamic-layer-tree">
                {layerRelationTree.map((node) => renderLayerNode(node, 0))}
              </ol>
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
            className={`dynamic-tool-panel side-right dynamic-property-overlay-panel ${advancedFeaturesEnabled ? 'is-advanced' : ''}`}
            aria-label={t('control.objectProperties')}
            data-flow-step-heading={editorExperience === 'flow' ? '' : undefined}
            tabIndex={editorExperience === 'flow' ? -1 : undefined}
          >
            <div className={`dynamic-tool-header ${isEditingItemName ? 'is-renaming' : ''}`}>
              <div className="dynamic-tool-title">
                <button
                  ref={propertyThumbnailButtonRef}
                  type="button"
                  className="dynamic-property-thumbnail-button"
                  onClick={openImagePreview}
                  aria-label={isDynamicBubbleItem(selectedItem)
                    ? `编辑${selectedItem.name}`
                    : t('control.previewNamed', { name: selectedItem.name })}
                  title={isDynamicBubbleItem(selectedItem)
                    ? selectedItem.bubble.bubbleType === 'title' ? '编辑标题遮罩' : '编辑气泡'
                    : t('control.previewImage')}
                >
                  <DynamicItemThumbnail item={selectedItem} decorative />
                  <span className="dynamic-property-thumbnail-icon" aria-hidden="true">
                    {isDynamicBubbleItem(selectedItem)
                      ? <Pencil size={14} strokeWidth={2.4} />
                      : <Maximize2 size={14} strokeWidth={2.4} />}
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
                  if (editorExperience === 'flow' && flowDetailSection) {
                    closeFlowDetail()
                  } else {
                    clearTargetEditing()
                    setToolOpen(false)
                  }
                  setBackgroundPanelOpen(false)
                  setRightPanelCollapsed(false)
                  setIsEditingItemName(false)
                  setItemNameErrorKey('')
                }}
                aria-label={editorExperience === 'flow' && flowDetailSection
                  ? t('flow.returnToEditing')
                  : t('control.backToLayers')}
                title={editorExperience === 'flow' && flowDetailSection
                  ? t('flow.returnToEditing')
                  : t('control.backToLayers')}
              >
                <X size={18} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>

            <div className="tool-tabs dynamic-tool-tabs">
              {visiblePropertyTabs.map(({ id, labelKey, shortLabelKey, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`tool-tab dynamic-property-tab ${visibleActiveTab === id ? 'active' : ''}`}
                  onClick={() => {
                    if (id !== 'motion') clearTargetEditing()
                    setActiveTab(id)
                  }}
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
                      className={`motion-mode-button ${!selectedTargetForControls && selectedItem.moveMode === motion.id ? 'active' : ''}`}
                      onClick={() => handleMotionChange(motion.id)}
                      aria-pressed={!selectedTargetForControls && selectedItem.moveMode === motion.id}
                    >
                      <span className={`motion-icon motion-icon-${motion.icon}`} />
                      <strong>{t(motion.labelKey)}</strong>
                    </button>
                  ))}
                </div>
                <label className={`dynamic-percent-control ${selectedTargetForControls ? 'is-disabled' : ''}`}>
                  <span>{t('control.amplitudeTrack', { percent: selectedItem.movePercent, track: getTranslatedTrackLabel(activeTrack) })}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={selectedItem.movePercent}
                    onChange={(event) => handleMotionPercentChange(Number(event.target.value))}
                    className="ipad-slider"
                    disabled={selectedTargetForControls}
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
                <div className={`dynamic-track-selector ${selectedTargetForControls ? 'is-disabled' : ''}`} aria-label={t('control.trackSelection')}>
                  <span>{t('control.track')}</span>
                  <div className="dynamic-track-buttons">
                    {trackOptions.map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        className={activeTrack === track.id ? 'active' : ''}
                        onClick={() => handleMoveTrackChange(track.id)}
                        disabled={selectedTargetForControls}
                      >
                        {t(track.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
                {advancedFeaturesEnabled && (
                  <section className="dynamic-advanced-motion-card">
                    <div className="dynamic-property-section-heading">
                      <strong>{t('control.destination')}</strong>
                      <span>{selectedTargetActive
                        ? t('control.destinationReady')
                        : t('control.setDestination')}</span>
                    </div>
                    <div
                      id={`dynamic-target-mode-${selectedItem.id}`}
                      className="dynamic-target-mode-row"
                      role="group"
                      aria-label={t('control.destination')}
                      hidden={!targetEditorOpen}
                    >
                      {targetEditorOpen && (
                        <>
                        <button
                          type="button"
                          className={`dynamic-target-mode-choice ${selectedTargetForControls ? 'active' : ''}`}
                          onClick={() => handleTargetModeChange('target')}
                          aria-pressed={selectedTargetForControls}
                        >
                          <Target size={18} strokeWidth={2.3} aria-hidden="true" />
                          <span>
                            <strong>{t('control.moveToDestination')}</strong>
                            <small>{selectedTargetActive ? t('control.destinationReady') : t('control.setDestination')}</small>
                          </span>
                          {selectedTargetForControls && <Check size={17} strokeWidth={2.5} aria-hidden="true" />}
                        </button>
                        <button
                          type="button"
                          className={`dynamic-target-loop-toggle ${targetDraftLoop ? 'active' : ''}`}
                          onClick={handleTargetLoopToggle}
                          aria-pressed={targetDraftLoop}
                          title={t('control.loopMovement')}
                        >
                          <Repeat2 size={18} strokeWidth={2.3} aria-hidden="true" />
                          <span>{t('control.loopMovement')}</span>
                        </button>
                        </>
                      )}
                    </div>
                    {targetEditorOpen ? (
                      <div className="dynamic-target-edit-actions">
                        <span
                          id={`dynamic-target-edit-help-${selectedItem.id}`}
                          className="dynamic-visually-hidden"
                        >
                          {t('control.targetEditingInstructions')}
                        </span>
                        <span
                          id={`dynamic-target-edit-position-${selectedItem.id}`}
                          className="dynamic-visually-hidden"
                          role="status"
                          aria-live="polite"
                          aria-atomic="true"
                        >
                          {t('control.targetPositionPercent', {
                            x: Math.round((targetDraftPosition?.x ?? selectedItem.position.x) * 100),
                            y: Math.round((targetDraftPosition?.y ?? selectedItem.position.y) * 100)
                          })}
                        </span>
                        <button type="button" className="ipad-button secondary-button" onClick={cancelTargetEditing}>
                          {t('common.cancel')}
                        </button>
                        <button type="button" className="ipad-button primary-button" onClick={completeTargetEditing}>
                          <CheckCircle2 size={17} strokeWidth={2.3} aria-hidden="true" />
                          {t('common.done')}
                        </button>
                      </div>
                    ) : (
                      <button
                        ref={targetSetButtonRef}
                        type="button"
                        className="dynamic-target-set-button"
                        onClick={startTargetEditing}
                        aria-expanded={targetEditorOpen}
                        aria-controls={`dynamic-target-mode-${selectedItem.id}`}
                      >
                        <Target size={18} strokeWidth={2.3} aria-hidden="true" />
                        <span>{selectedTargetActive ? t('control.editDestination') : t('control.setDestination')}</span>
                      </button>
                    )}
                  </section>
                )}
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

                {advancedFeaturesEnabled && editorExperience === 'free' && (
                  <section className="dynamic-object-linkage-card">
                    <div className="dynamic-property-section-heading">
                      <strong>{t('control.appearanceOrder')}</strong>
                      <span>{t('control.linkageCount', { count: selectedLinkedTargetItems.length })}</span>
                    </div>

                    <div className="dynamic-linkage-relation-list">
                      {selectedLinkedTargetItems.map((targetItem) => {
                        const relation = targetItem.linkedAppearance!
                        return (
                        <button
                          key={targetItem.id}
                          type="button"
                          className="dynamic-linkage-relation-button"
                          onClick={() => openLinkEditor(targetItem)}
                          aria-label={t('control.linkageEditNamed', { name: targetItem.name })}
                        >
                          <span className="dynamic-linkage-relation-thumbnail">
                            <DynamicItemThumbnail item={targetItem} decorative />
                            <LockKeyhole size={12} strokeWidth={2.5} aria-hidden="true" />
                          </span>
                          <span className="dynamic-linkage-relation-copy">
                            <small>{t('control.linkageControlledObject')}</small>
                            <strong>{targetItem.name}</strong>
                            <span>
                              {t(relation.mode === 'showAfter'
                                ? 'control.linkageShowAfter'
                                : 'control.linkageHideAfter')}
                              {' · '}{Number((relation.delayMs / 1000).toFixed(1))}{t('control.seconds')}
                            </span>
                          </span>
                          <span className="dynamic-linkage-background-inheritance">{t('control.linkageTemporaryBackgroundShort')}</span>
                          <ChevronRight size={16} strokeWidth={2.3} aria-hidden="true" />
                        </button>
                        )
                      })}
                      {selectedLinkedTargetItems.length === 0 && (
                        <div className="dynamic-linkage-empty">
                          <Link2 size={17} strokeWidth={2.2} aria-hidden="true" />
                          <span>{t('control.linkageNoTargets')}</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="dynamic-linkage-add-button"
                      onClick={() => openLinkEditor()}
                      disabled={eligibleLinkTargetItems.length === 0}
                      aria-haspopup="dialog"
                    >
                      <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
                      {t('control.linkageAdd')}
                    </button>

                    {selectedIncomingSourceItem && selectedIncomingAppearance && (
                      <div className="dynamic-linkage-incoming">
                        <div className="dynamic-linkage-direction-heading">
                          <span><LockKeyhole size={14} strokeWidth={2.4} aria-hidden="true" />{t('control.linkageIncoming')}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => selectItem(selectedIncomingSourceItem.id, true)}
                          aria-label={t('control.linkageViewSourceNamed', { name: selectedIncomingSourceItem.name })}
                        >
                          <DynamicItemThumbnail item={selectedIncomingSourceItem} decorative />
                          <span>
                            <small>{t('control.linkageControlledBy')}</small>
                            <strong>{selectedIncomingSourceItem.name}</strong>
                          </span>
                          <ArrowRight size={16} strokeWidth={2.3} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                    {linkageErrorKey && <p className="dynamic-linkage-error" role="alert">{t(linkageErrorKey)}</p>}
                  </section>
                )}
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
                    <DynamicItemThumbnail item={selectedItem} decorative />
                  </div>
                  <span>{t('control.objectPreview')}</span>
                </div>
              </div>
            )}

            {visibleActiveTab === 'audio' && advancedFeaturesEnabled && (
              <div className="dynamic-tool-body compact dynamic-property-body dynamic-property-audio-body">
                <section className="dynamic-advanced-property-card">
                  <div className="dynamic-property-section-heading">
                    <strong>{t('control.objectAudio')}</strong>
                    <span>{selectedItem.audioId ? t('control.audioAssigned') : t('control.audioNotAssigned')}</span>
                  </div>
                  <button
                    type="button"
                    className="dynamic-audio-upload-button"
                    disabled={isAddingAudio}
                    onClick={() => itemAudioInputRef.current?.click()}
                  >
                    <Upload size={17} strokeWidth={2.3} aria-hidden="true" />
                    <span>{isAddingAudio ? t('control.audioUploading') : t('control.uploadAudio')}</span>
                  </button>
                </section>

                <div className="dynamic-audio-library" role="radiogroup" aria-label={t('control.objectAudio')}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!selectedItem.audioId}
                    className={`dynamic-audio-option is-none ${!selectedItem.audioId ? 'active' : ''}`}
                    onClick={() => handleItemAudioSelect(undefined)}
                  >
                    <Ban size={17} strokeWidth={2.2} aria-hidden="true" />
                    <span><strong>{t('control.noAudio')}</strong></span>
                    {!selectedItem.audioId && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
                  </button>
                  {(group.audioLibrary ?? []).map((audio) => (
                    <div key={audio.id} className={`dynamic-audio-option ${selectedItem.audioId === audio.id ? 'active' : ''}`}>
                      <button
                        type="button"
                        className="dynamic-audio-select-button"
                        onClick={() => handleItemAudioSelect(audio.id)}
                        aria-pressed={selectedItem.audioId === audio.id}
                      >
                        <Music2 size={17} strokeWidth={2.2} aria-hidden="true" />
                        <span>
                          <strong>{audio.name}</strong>
                          <small>{formatAudioDuration(audio.durationMs) || t('control.audioFile')}</small>
                        </span>
                        {selectedItem.audioId === audio.id && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        className="dynamic-audio-icon-button"
                        onClick={() => toggleAudioPreview(audio)}
                        aria-label={previewingAudioId === audio.id ? t('common.stop') : t('control.previewAudio')}
                        title={previewingAudioId === audio.id ? t('common.stop') : t('control.previewAudio')}
                      >
                        {previewingAudioId === audio.id ? <Ban size={15} /> : <Play size={15} />}
                      </button>
                      <button
                        type="button"
                        className="dynamic-audio-icon-button danger"
                        onClick={() => handleAudioDelete(audio.id)}
                        aria-label={t('control.deleteAudio')}
                        title={t('control.deleteAudio')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {(group.audioLibrary ?? []).length === 0 && (
                    <div className="dynamic-audio-empty">{t('control.noAudioFiles')}</div>
                  )}
                </div>

                {selectedItem.audioId && (
                  <section className="dynamic-advanced-property-card">
                    <div className="dynamic-property-section-heading">
                      <strong>{t('control.audioPlayback')}</strong>
                      <span>{t(itemAudioTriggerOptions.find((option) => option.id === (selectedItem.audioTrigger ?? 'appearance'))?.labelKey ?? 'control.audioOnAppearance')}</span>
                    </div>
                    <div className="dynamic-audio-trigger-options" role="radiogroup" aria-label={t('control.audioPlayback')}>
                      {itemAudioTriggerOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={(selectedItem.audioTrigger ?? 'appearance') === option.id}
                          className={(selectedItem.audioTrigger ?? 'appearance') === option.id ? 'active' : ''}
                          onClick={() => handleItemAudioTriggerChange(option.id)}
                        >
                          {option.id === 'appearance' ? <Sparkles size={15} /> : option.id === 'appearanceDelay' ? <Clock3 size={15} /> : <Target size={15} />}
                          <span>{t(option.labelKey)}</span>
                        </button>
                      ))}
                    </div>
                    {selectedItem.audioTrigger === 'appearanceDelay' && (
                      <div
                        className="dynamic-audio-delay-field"
                        role="group"
                        aria-label={t('control.delaySeconds')}
                      >
                        <span>{t('control.delaySeconds')}</span>
                        <IntervalWheel
                          className="dynamic-audio-delay-wheel"
                          value={Number(((selectedItem.audioDelayMs ?? 0) / 1000).toFixed(1))}
                          min={0}
                          max={600}
                          step={0.1}
                          inputMode="decimal"
                          allowDirectInput={false}
                          onChange={handleItemAudioDelayChange}
                          ariaLabel={t('control.delaySeconds')}
                        />
                      </div>
                    )}
                    {selectedItem.audioTrigger === 'targetArrival' && selectedItem.targetMode !== 'target' && (
                      <p className="dynamic-property-note">{t('control.targetAudioNeedsDestination')}</p>
                    )}
                  </section>
                )}
              </div>
            )}

            {visibleActiveTab === 'background' && advancedFeaturesEnabled && (
              <div className="dynamic-tool-body compact dynamic-property-body dynamic-property-background-body">
                <section className="dynamic-advanced-property-card">
                  <div className="dynamic-property-section-heading">
                    <strong>{t('control.objectBackground')}</strong>
                    <span>{selectedIncomingSourceItem
                      ? t('control.linkageControlledByNamed', { name: selectedIncomingSourceItem.name })
                      : (selectedItem.backgroundIds ?? []).length === 0
                        ? t('control.allBackgrounds')
                        : t('control.selectedBackgroundCount', { count: selectedItem.backgroundIds?.length ?? 0 })}</span>
                  </div>
                  <div className="dynamic-target-mode-segmented" role="group" aria-label={t('control.objectBackground')}>
                    <button
                      type="button"
                      className={(selectedItem.backgroundIds ?? []).length === 0 ? 'active' : ''}
                      disabled={Boolean(selectedIncomingSourceItem)}
                      onClick={() => setItemBackgroundScope('all')}
                    >
                      {t('control.allBackgrounds')}
                    </button>
                    <button
                      type="button"
                      className={(selectedItem.backgroundIds ?? []).length > 0 ? 'active' : ''}
                      disabled={Boolean(selectedIncomingSourceItem)}
                      onClick={() => setItemBackgroundScope('selected')}
                    >
                      {t('control.specifiedBackgrounds')}
                    </button>
                  </div>
                </section>

                {(selectedItem.backgroundIds ?? []).length > 0 && (
                  <div className="dynamic-object-background-list">
                    {backgrounds.map((background) => {
                      const checked = selectedItem.backgroundIds?.includes(background.id) ?? false
                      const onlySelected = checked && selectedItem.backgroundIds?.length === 1
                      return (
                        <label key={background.id} className={`dynamic-object-background-card ${checked ? 'active' : ''} ${onlySelected ? 'is-required' : ''} ${selectedIncomingSourceItem ? 'is-inherited' : ''}`}>
                          {background.type === 'video' ? (
                            <video src={background.url} muted playsInline />
                          ) : (
                            <img src={background.url} alt="" />
                          )}
                          <span>
                            <strong>{background.name}</strong>
                            <small>{background.type === 'video' ? t('background.video') : t('background.image')}</small>
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={Boolean(selectedIncomingSourceItem) || onlySelected}
                            onChange={() => toggleItemBackground(background.id)}
                            aria-label={t('common.selectNamed', { name: background.name })}
                          />
                          <i aria-hidden="true"><Check size={13} strokeWidth={2.8} /></i>
                        </label>
                      )
                    })}
                  </div>
                )}
                {backgrounds.length === 0 && (
                  <div className="dynamic-audio-empty">{t('control.noBackgrounds')}</div>
                )}
                <p className="dynamic-property-note">
                  {selectedIncomingSourceItem
                    ? t('control.linkageTemporaryBackground')
                    : (selectedItem.backgroundIds ?? []).length === 0
                      ? t('control.objectAcrossAllBackgrounds')
                      : t('control.objectOnlyOnSelectedBackgrounds')}
                </p>
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
                      <DynamicItemThumbnail item={item} decorative />
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
              <DynamicItemThumbnail item={draggedItem} decorative />
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
            <label
              className={`dynamic-percent-control ${group.appearMode === 'all' ? 'disabled' : ''}`}
              aria-disabled={group.appearMode === 'all'}
            >
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
            {advancedFeaturesEnabled && (
              <section className="dynamic-appear-animation-section">
                <div className="dynamic-property-section-heading">
                  <strong>{t('control.appearAnimation')}</strong>
                  <span>{t(appearAnimationOptions.find((option) => option.id === (group.appearAnimation ?? 'none'))?.labelKey ?? 'control.appearAnimationNone')}</span>
                </div>
                <div className="dynamic-appear-animation-options" role="radiogroup" aria-label={t('control.appearAnimation')}>
                  {appearAnimationOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={(group.appearAnimation ?? 'none') === option.id}
                      className={(group.appearAnimation ?? 'none') === option.id ? 'active' : ''}
                      onClick={() => setAppearAnimation(option.id)}
                    >
                      <span className={`dynamic-appear-animation-icon is-${option.id}`} aria-hidden="true" />
                      <strong>{t(option.labelKey)}</strong>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <p className="dynamic-appear-order-note">{t('control.playInLayerOrder')}</p>
          </aside>
        )}

        {editorExperience === 'flow' && !previewMode && (
          <footer className="dynamic-flow-footer" aria-label={t('flow.modeGuided')}>
            <button
              type="button"
              className="dynamic-flow-footer-button is-secondary"
              onClick={() => moveCreationFlowStep(-1)}
              disabled={flowStepIndex <= 0}
            >
              <ChevronLeft size={17} strokeWidth={2.5} aria-hidden="true" />
              <span>{t('flow.previous')}</span>
            </button>

            <div className="dynamic-flow-footer-status">
              {flowDetailSection ? (
                <button type="button" onClick={closeFlowDetail} title={t('flow.returnToEditing')}>
                  <ChevronLeft size={15} strokeWidth={2.5} aria-hidden="true" />
                  <span>{t(flowStepTitleKey)}</span>
                </button>
              ) : (flowStep === 'backgrounds' || flowStep === 'audio') ? (
                <button type="button" onClick={skipCurrentFlowStep}>
                  <span>{t('flow.skip')}</span>
                </button>
              ) : (
                <span role="status" aria-live="polite">
                  <CheckCircle2 size={15} strokeWidth={2.4} aria-hidden="true" />
                  <span>
                    <strong>{t(flowStepTitleKey)}</strong>
                    <small>{t('flow.autoSaved')}</small>
                  </span>
                </span>
              )}
            </div>

            <button
              type="button"
              className="dynamic-flow-footer-button is-primary"
              onClick={() => moveCreationFlowStep(1)}
              disabled={flowNextDisabled}
            >
              <span>{flowStep === 'review' ? t('flow.finishEditing') : t('flow.next')}</span>
              <ChevronRight size={17} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </footer>
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
            className={`dynamic-background-modal ${advancedFeaturesEnabled ? 'is-advanced' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="background-editor-title"
          >
            <div className="drawer-heading dynamic-background-modal-heading">
              <div>
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

            <div className="dynamic-background-editor-layout">
              <section className="dynamic-background-library-pane" aria-labelledby="background-library-title">
                <div className="dynamic-background-pane-heading">
                  <div>
                    <h3 id="background-library-title">
                      {t('control.stageBackground')}
                      <span>{t('control.assetCount', { count: backgrounds.length })}</span>
                    </h3>
                  </div>
                  <span className="dynamic-background-pane-count" aria-live="polite">
                    {t('common.selectedCount', { count: selectedBackgroundIds.length })}
                  </span>
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
                      <small>
                        {background.type === 'video' ? t('background.video') : t('background.image')}
                        {advancedFeaturesEnabled
                          ? ` · ${t('control.backgroundTransitionSummary', {
                              transition: t(backgroundTransitionOptions.find((option) => option.id === (background.backgroundTransition ?? group.backgroundTransition ?? 'none'))?.labelKey ?? 'control.backgroundTransitionNone')
                            })}`
                          : ''}
                        {advancedFeaturesEnabled && background.bgmAudioId
                          ? ` · ${group.audioLibrary?.find((audio) => audio.id === background.bgmAudioId)?.name ?? t('control.backgroundMusic')}`
                          : ''}
                      </small>
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
              <aside className="dynamic-background-settings-pane" aria-labelledby="background-settings-title">
                <div className="dynamic-background-settings-scroll">
                  <div className="dynamic-background-pane-heading dynamic-background-settings-heading">
                    <div>
                      <p className="dynamic-background-pane-eyebrow">{t('control.stageBackground')}</p>
                      <h3 id="background-settings-title">{t('control.properties')}</h3>
                    </div>
                  </div>

                  <section className="dynamic-background-settings-section">
                    <div className="dynamic-background-section-heading">
                      <h4>{t('control.backgroundPlaybackMode')}</h4>
                    </div>
                    <div className={`dynamic-background-playback ${group.backgroundPlayMode === 'fixed' ? 'fixed-mode' : ''}`}>
                      <div
                        className="dynamic-mode-segmented"
                        role="group"
                        aria-label={t('control.backgroundPlaybackMode')}
                      >
                        {([
                          ['fixed', 'control.backgroundFixed'],
                          ['random', 'control.backgroundRandom'],
                          ['sequence', 'control.backgroundSequence']
                        ] as const).map(([mode, labelKey]) => (
                          <button
                            key={mode}
                            type="button"
                            aria-pressed={group.backgroundPlayMode === mode}
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
                              allowDirectInput={false}
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
                  </section>

            {advancedFeaturesEnabled && (
              <div className="dynamic-background-advanced-settings">
                <section className="dynamic-background-entrance-panel">
                  <div className="dynamic-background-bgm-heading">
                    <span>
                      <Sparkles size={17} strokeWidth={2.3} aria-hidden="true" />
                      <strong>{t('control.backgroundTransition')}</strong>
                    </span>
                    <small>{selectedBackgroundIds.length > 0
                      ? t('control.applyToSelectedBackgrounds', { count: selectedBackgroundIds.length })
                      : t('control.applyToCurrentBackground')}</small>
                  </div>
                  <div className="dynamic-background-entrance-controls">
                    <div className="dynamic-background-entrance-options" role="radiogroup" aria-label={t('control.backgroundTransition')}>
                      {backgroundTransitionOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={backgroundTransitionDraft === option.id}
                          className={backgroundTransitionDraft === option.id ? 'active' : ''}
                          onClick={() => setBackgroundTransitionDraft(option.id)}
                        >
                          <span className={`dynamic-background-transition-swatch is-${option.id}`} aria-hidden="true" />
                          <span>{t(option.labelKey)}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="ipad-button primary-button"
                      disabled={backgrounds.length === 0}
                      onClick={() => void applyBackgroundTransition()}
                    >
                      {t('control.applyTransition')}
                    </button>
                  </div>
                </section>

                <section className="dynamic-background-bgm-panel">
                  <div className="dynamic-background-bgm-heading">
                    <span>
                      <Music2 size={17} strokeWidth={2.3} aria-hidden="true" />
                      <strong>{t('control.backgroundMusic')}</strong>
                    </span>
                    <small>{selectedBackgroundIds.length > 0
                      ? t('control.applyToSelectedBackgrounds', { count: selectedBackgroundIds.length })
                      : t('control.applyToCurrentBackground')}</small>
                  </div>
                  <div className="dynamic-background-bgm-controls">
                    <div className="dynamic-background-bgm-source-row">
                      <select
                        value={backgroundBgmDraftAudioId}
                        onChange={(event) => setBackgroundBgmDraftAudioId(event.target.value)}
                        aria-label={t('control.backgroundMusic')}
                      >
                        <option value="">{t('control.noAudio')}</option>
                        {(group.audioLibrary ?? []).map((audio) => (
                          <option key={audio.id} value={audio.id}>{audio.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="dynamic-background-bgm-preview"
                        disabled={!backgroundBgmDraftAudioId}
                        onClick={() => {
                          const audio = group.audioLibrary?.find((entry) => entry.id === backgroundBgmDraftAudioId)
                          if (audio) toggleAudioPreview(audio)
                        }}
                        aria-label={previewingAudioId === backgroundBgmDraftAudioId ? t('common.stop') : t('control.previewAudio')}
                        title={previewingAudioId === backgroundBgmDraftAudioId ? t('common.stop') : t('control.previewAudio')}
                      >
                        {previewingAudioId === backgroundBgmDraftAudioId ? <Ban size={16} /> : <Play size={16} />}
                      </button>
                    </div>
                    <div className="dynamic-background-bgm-actions">
                      <button
                        type="button"
                        className="ipad-button secondary-button"
                        onClick={() => backgroundAudioInputRef.current?.click()}
                        disabled={isAddingAudio}
                      >
                        <Upload size={16} strokeWidth={2.3} aria-hidden="true" />
                        {t('control.uploadAudio')}
                      </button>
                      <button
                        type="button"
                        className="ipad-button primary-button"
                        disabled={backgrounds.length === 0}
                        onClick={() => applyBackgroundBgm(backgroundBgmDraftAudioId || undefined)}
                      >
                        <Link2 size={16} strokeWidth={2.3} aria-hidden="true" />
                        {backgroundBgmDraftAudioId ? t('control.applyMusic') : t('control.clearMusic')}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
                </div>
              </aside>

            </div>
          </section>
        </div>
      )}

      {isImagePreviewOpen && selectedItem && isDynamicMediaItem(selectedItem) && (
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
                <DynamicItemThumbnail item={copySourceItem} />
                <span>{t('control.source')}</span>
                <strong>{copySourceItem.name}</strong>
              </div>
              <span className="dynamic-copy-route-arrow" aria-hidden="true">→</span>
              <div className="dynamic-copy-route-item target">
                <DynamicItemThumbnail item={selectedItem} />
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
                    allCopyFields.every((field) => selectedCopyFields.includes(field)) ? [] : [...allCopyFields]
                  )}
                  disabled={isCopying}
                >
                  {allCopyFields.every((field) => selectedCopyFields.includes(field)) ? t('common.deselectAll') : t('common.selectAll')}
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
                disabled={!selectedCopyFields.some((field) => allCopyFields.includes(field)) || isCopying}
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

      {linkEditorOpen && selectedItem && (
        <div className="dynamic-modal-overlay dynamic-link-trigger-modal-overlay" role="presentation">
          <section
            className="dynamic-link-trigger-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dynamic-link-trigger-title"
          >
            <div className="dynamic-link-trigger-heading">
              <div>
                <p className="eyebrow">{t('control.objectLinkage')}</p>
                <h2 id="dynamic-link-trigger-title">{editingLinkTargetItemId
                  ? t('control.linkageEdit')
                  : t('control.linkageCreate')}</h2>
              </div>
              <button
                ref={linkEditorCloseButtonRef}
                type="button"
                className="dynamic-panel-close"
                onClick={closeLinkEditor}
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="dynamic-link-route" aria-label={t('control.linkageRelation')}>
              <span className="is-source">
                <DynamicItemThumbnail item={selectedItem} decorative />
                <span><small>{t('control.linkageTrigger')}</small><strong>{selectedItem.name}</strong></span>
              </span>
              <ArrowRight size={22} strokeWidth={2.5} aria-hidden="true" />
              <span className={`is-target ${pendingLinkTargetItem ? '' : 'is-empty'}`}>
                {pendingLinkTargetItem ? (
                  <DynamicItemThumbnail item={pendingLinkTargetItem} decorative />
                ) : (
                  <LockKeyhole size={19} strokeWidth={2.3} aria-hidden="true" />
                )}
                <span>
                  <small>{t('control.linkageControlledObject')}</small>
                  <strong>{pendingLinkTargetItem?.name ?? t('control.chooseControlledObject')}</strong>
                </span>
              </span>
            </div>

            <p className="dynamic-link-target-list-label">{t('control.chooseControlledObject')}</p>
            <div className="dynamic-link-trigger-list">
              {eligibleLinkTargetItems.map((item) => {
                const existingSource = item.linkedAppearance
                  ? sortedItems.find((entry) => entry.id === item.linkedAppearance?.triggerItemId)
                  : undefined
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={pendingLinkTargetItemId === item.id ? 'active' : ''}
                    onClick={() => selectLinkTargetItem(item.id)}
                  >
                    <DynamicItemThumbnail item={item} decorative />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{existingSource
                        ? t('control.linkageControlledByNamed', { name: existingSource.name })
                        : t('control.layerSummary', {
                            motion: getTranslatedMotionLabel(item.moveMode),
                            animation: item.animationId
                          })}</small>
                    </span>
                    {existingSource && existingSource.id !== selectedItem.id && (
                      <LockKeyhole size={15} strokeWidth={2.4} aria-hidden="true" />
                    )}
                    {pendingLinkTargetItemId === item.id && (
                      <Check size={17} strokeWidth={2.8} aria-hidden="true" />
                    )}
                  </button>
                )
              })}
              {eligibleLinkTargetItems.length === 0 && (
                <div className="dynamic-link-trigger-empty">{t('control.linkageTargetMissing')}</div>
              )}
            </div>

            <div className="dynamic-link-editor-controls">
              <div className="dynamic-linkage-mode-options" role="radiogroup" aria-label={t('control.linkageBehavior')}>
                {([
                  ...(editingLinkTargetItemId ? [['none', 'control.linkageNone']] : []),
                  ['showAfter', 'control.linkageShowAfter'],
                  ['hideAfter', 'control.linkageHideAfter']
                ] as [DynamicLinkedAppearanceMode, string][]).map(([mode, labelKey]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={pendingLinkedAppearanceMode === mode}
                    className={pendingLinkedAppearanceMode === mode ? 'active' : ''}
                    onClick={() => handleLinkedAppearanceModeChange(mode)}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>

              {pendingLinkedAppearanceMode !== 'none' && (
                <label className="dynamic-linkage-delay-field">
                  <span>{t('control.linkageDelay')}</span>
                  <span>
                    <input
                      type="number"
                      min="0"
                      max="600"
                      step="0.1"
                      inputMode="decimal"
                      value={Number(pendingLinkDelaySeconds.toFixed(1))}
                      onChange={(event) => handleLinkedAppearanceDelayChange(Number(event.target.value))}
                    />
                    <small>{t('control.seconds')}</small>
                  </span>
                </label>
              )}

              {pendingLinkTargetItem && pendingLinkedAppearanceMode !== 'none' && (
                <p className="dynamic-link-summary">
                  {t(pendingLinkedAppearanceMode === 'showAfter'
                    ? 'control.linkageSummaryShow'
                    : 'control.linkageSummaryHide', {
                    source: selectedItem.name,
                    target: pendingLinkTargetItem.name,
                    seconds: Number(pendingLinkDelaySeconds.toFixed(1))
                  })}
                </p>
              )}

              {pendingLinkTargetItem && pendingLinkedAppearanceMode !== 'none' && (
                <p className="dynamic-link-background-note">
                  <Link2 size={14} strokeWidth={2.4} aria-hidden="true" />
                  {t('control.linkageTemporaryBackground')}
                </p>
              )}

              {pendingLinkReplacesExisting && pendingLinkExistingSourceItem && (
                <p className="dynamic-link-replace-warning" role="status">
                  <LockKeyhole size={14} strokeWidth={2.4} aria-hidden="true" />
                  {t('control.linkageReplaceWarning', { name: pendingLinkExistingSourceItem.name })}
                </p>
              )}

              {linkageErrorKey && <p className="dynamic-link-trigger-error" role="alert">{t(linkageErrorKey)}</p>}

              <div className="dynamic-link-editor-actions">
                {editingLinkTargetItemId && (
                  <button type="button" className="dynamic-link-remove-button" onClick={removeEditedLink}>
                    <Unlink2 size={15} strokeWidth={2.4} aria-hidden="true" />
                    {t('control.linkageRemove')}
                  </button>
                )}
                <span />
                <button type="button" className="ipad-button secondary-button" onClick={closeLinkEditor}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="ipad-button primary-button"
                  onClick={confirmLinkEditor}
                  disabled={!pendingLinkTargetItemId || (pendingLinkedAppearanceMode === 'none' && !editingLinkTargetItemId)}
                >
                  {pendingLinkReplacesExisting
                    ? t('control.linkageReplace')
                    : editingLinkTargetItemId
                      ? t('control.linkageUpdate')
                      : t('control.linkageConfirm')}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <DynamicBubbleEditor
        open={bubbleEditorOpen}
        mode={editingBubbleItem ? 'edit' : 'create'}
        initialValue={editingBubbleItem
          ? toDynamicBubbleDraft(editingBubbleItem.bubble)
          : undefined}
        stageBackgroundUrl={displayedBackground?.type === 'image'
          ? displayedBackground.url
          : undefined}
        busy={isSavingBubble}
        resetKey={editingBubbleItem?.id ?? 'new'}
        onCancel={closeBubbleEditor}
        onSubmit={handleBubbleSubmit}
      />
    </main>
  )
}

const areDynamicControlPropsEqual = (
  previous: DynamicControlPageProps,
  next: DynamicControlPageProps
) => previous.group === next.group
  && previous.wsIp === next.wsIp
  && previous.dynamicPort === next.dynamicPort
  && previous.advancedFeaturesEnabled === next.advancedFeaturesEnabled
  && previous.initialItemId === next.initialItemId
  && previous.initialExperience === next.initialExperience
  && previous.transitionPreparing === next.transitionPreparing

export default memo(DynamicControlPage, areDynamicControlPropsEqual)
