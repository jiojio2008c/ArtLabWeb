import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import {
  DYNAMIC_ANIMATION_IDS,
  getDynamicAnimationMode,
  getDynamicClickAnimationIds,
  normalizeDynamicAnimationId,
  normalizeDynamicClickAnimationIds,
  normalizeDynamicAnimationMode,
  type DynamicAnimationMode
} from '../../desktop-runtime/renderer/dynamic-animation-catalog.js'
import {
  convertDynamicLinkedAppearanceToIndependentTiming,
  normalizeDynamicAppearAnimation,
  normalizeDynamicAppearanceTimeMs,
  normalizeDynamicLinkedAppearance,
  wouldCreateDynamicLinkedAppearanceCycle
} from '../../desktop-runtime/renderer/advanced-appearance-timeline.js'
import {
  DEFAULT_DYNAMIC_BACKGROUND_PLAYBACK_LOOP,
  normalizeDynamicBackgroundPlaybackLoop
} from '../../desktop-runtime/renderer/background-playback-core.js'

const DYNAMIC_GROUPS_KEY = 'magicfloor_dynamic_groups_v1'
const DYNAMIC_DB_NAME = 'magicfloor_dynamic_media'
const DYNAMIC_DB_VERSION = 1
const DYNAMIC_STORE_NAME = 'media'
const DYNAMIC_DIRECTORY = Directory.Data
const DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION = 4
const MAX_DYNAMIC_ITEMS_PER_GROUP = 30
const GRID_COLUMNS = 16
const GRID_ROWS = 9
const DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS = 800
const MIN_DYNAMIC_APPEAR_INTERVAL_MS = 100
const MAX_DYNAMIC_APPEAR_INTERVAL_MS = 5000
const DEFAULT_DYNAMIC_BACKGROUND_INTERVAL_MS = 5000
const MIN_DYNAMIC_BACKGROUND_INTERVAL_MS = 1000
const MAX_DYNAMIC_BACKGROUND_INTERVAL_MS = 600000
const DEFAULT_DYNAMIC_MOVE_SPEED = 50
const DEFAULT_DYNAMIC_BUBBLE_REVEAL_INTERVAL_MS = 80
const MIN_DYNAMIC_BUBBLE_REVEAL_INTERVAL_MS = 20
const MAX_DYNAMIC_BUBBLE_REVEAL_INTERVAL_MS = 1000
const MIN_DYNAMIC_BUBBLE_FONT_SIZE_PX = 18
const MAX_DYNAMIC_BUBBLE_FONT_SIZE_PX = 120
const MIN_DYNAMIC_BUBBLE_WIDTH_PX = 220
const MAX_DYNAMIC_BUBBLE_WIDTH_PX = 1600
const MIN_DYNAMIC_BUBBLE_HEIGHT_PX = 140
const MAX_DYNAMIC_BUBBLE_HEIGHT_PX = 1000
const DYNAMIC_DIALOGUE_BUBBLE_STYLE_IDS = [
  'dialogue-rounded-left',
  'dialogue-rounded-right',
  'dialogue-soft-left',
  'dialogue-soft-right',
  'dialogue-comic-left',
  'dialogue-comic-right'
] as const
const DYNAMIC_THOUGHT_BUBBLE_STYLE_IDS = [
  'thought-cloud-left',
  'thought-cloud-right'
] as const
const DYNAMIC_TITLE_BUBBLE_STYLE_IDS = [
  'title-rounded',
  'title-pill',
  'title-ticket',
  'title-underline',
  'title-none'
] as const
const DYNAMIC_LEGACY_BUBBLE_STYLE_IDS = [
  'dialogue-rounded',
  'dialogue-soft',
  'dialogue-comic',
  'thought-cloud',
  'thought-soft',
  'thought-soft-left',
  'thought-soft-right'
] as const
const DYNAMIC_BUBBLE_TITLE_MASK_IDS = ['rounded', 'pill', 'ticket', 'underline', 'none'] as const

type DynamicMediaType = 'image' | 'video'
type DynamicStoredMediaType = DynamicMediaType | 'audio'
type DynamicMoveMode = 'none' | 'verticalWave' | 'left' | 'right' | 'orbit' | 'random'
type DynamicMoveTrack = 'top' | 'middle' | 'bottom'
type DynamicAppearMode = 'sequence' | 'all'
type DynamicAppearAnimation = 'none' | 'drop' | 'trackSlide'
type DynamicBackgroundPlayMode = 'fixed' | 'random' | 'sequence'
type DynamicBackgroundPlaybackLoop = boolean
type DynamicBackgroundTransition = 'none' | 'curtain' | 'cameraFlash' | 'shadowPlay'
type DynamicTargetMode = 'loop' | 'target'
type DynamicItemAudioTrigger = 'appearance' | 'appearanceDelay' | 'targetArrival'
type DynamicLinkedAppearanceMode = 'none' | 'showAfter' | 'hideAfter'
type DynamicCopyField = 'motion' | 'animation' | 'size' | 'deform' | 'audio' | 'background' | 'linkage'
type DynamicItemKind = 'media' | 'bubble'
type DynamicBubbleType = 'dialogue' | 'thought' | 'title'
type DynamicBubbleRevealMode = 'all' | 'typewriter'
type DynamicBubbleStyleId = typeof DYNAMIC_DIALOGUE_BUBBLE_STYLE_IDS[number]
  | typeof DYNAMIC_THOUGHT_BUBBLE_STYLE_IDS[number]
  | typeof DYNAMIC_TITLE_BUBBLE_STYLE_IDS[number]
type DynamicBubbleTitleMaskId = typeof DYNAMIC_BUBBLE_TITLE_MASK_IDS[number]
type DynamicBubblePaletteId = 'ink' | 'ocean' | 'coral' | 'sun' | 'violet'

const DYNAMIC_BUBBLE_MASK_COLOR_BY_PALETTE: Record<DynamicBubblePaletteId, string> = {
  ink: '#263a3b',
  ocean: '#0c8fa4',
  coral: '#dd6859',
  sun: '#c88722',
  violet: '#7567b4'
}

const DYNAMIC_BUBBLE_DEFAULT_SURFACE_COLORS = {
  'dialogue-rounded': { surfaceColor: '#fffef6', outlineColor: '#3b9089' },
  'dialogue-soft': { surfaceColor: '#e9f8f5', outlineColor: '#84b7c0' },
  'dialogue-comic': { surfaceColor: '#1f3635', outlineColor: '#d9e3df' },
  'thought-cloud': { surfaceColor: '#fffffd', outlineColor: '#6c9fa0' },
  title: { surfaceColor: '#ffffff', outlineColor: '#263a3b' }
} as const

interface DynamicLinkedAppearance {
  triggerItemId: string
  mode: Exclude<DynamicLinkedAppearanceMode, 'none'>
  delayMs: number
}

interface DynamicMedia {
  id: string
  name: string
  type: DynamicMediaType
  mimeType: string
  url: string
  width?: number
  height?: number
  filePath?: string
  storageKey?: string
  updatedAt: number
}

interface DynamicAudioMedia extends Omit<DynamicMedia, 'type'> {
  type: 'audio'
  durationMs?: number
}

interface DynamicAppearanceTiming {
  appearanceDelayMs?: number
  appearanceHideMs?: number | null
}

interface DynamicBackgroundAppearance {
  appearMode: DynamicAppearMode
  appearIntervalMs: number
  appearAnimation: DynamicAppearAnimation
}

type DynamicStoredMedia = DynamicMedia | DynamicAudioMedia

interface DynamicBackground extends DynamicMedia {
  bgmAudioId?: string
  backgroundTransition?: DynamicBackgroundTransition
  appearance?: DynamicBackgroundAppearance
}

interface DynamicBubbleContent {
  schemaVersion: 2
  bubbleType: DynamicBubbleType
  styleId: DynamicBubbleStyleId
  title: string
  bodyText: string
  revealMode: DynamicBubbleRevealMode
  revealIntervalMs: number
  fontSizePx: number
  textColor: string
  surfaceColor: string
  outlineColor: string
  surfaceId: string
  titleMaskId: DynamicBubbleTitleMaskId
  paletteId: DynamicBubblePaletteId
  maskColor: string
  maskOpacity: number
  widthPx: number
  heightPx: number
  image?: DynamicMedia
}

interface DynamicBubbleInput {
  name?: string
  bubbleType: DynamicBubbleType
  styleId: DynamicBubbleStyleId
  title: string
  bodyText: string
  revealMode: DynamicBubbleRevealMode
  revealIntervalMs: number
  fontSizePx: number
  textColor: string
  surfaceColor?: string
  outlineColor?: string
  surfaceId?: string
  titleMaskId?: DynamicBubbleTitleMaskId
  paletteId: DynamicBubblePaletteId
  maskColor: string
  maskOpacity: number
  widthPx: number
  heightPx: number
  imageFile?: File | null
  removeImage?: boolean
}

interface DynamicItemBase {
  id: string
  name: string
  position: {
    x: number
    y: number
  }
  gridIndex: number
  scale: number
  rotation: number
  flipX: boolean
  flipY: boolean
  animationMode: DynamicAnimationMode
  animationId: number
  clickAnimationIds: number[]
  moveMode: DynamicMoveMode
  movePercent: number
  moveSpeed: number
  moveTrack: DynamicMoveTrack
  targetMode?: DynamicTargetMode
  targetLoop?: boolean
  targetPosition?: {
    x: number
    y: number
  }
  appearanceDelayMs?: number
  appearanceHideMs?: number | null
  hideAfterTarget?: boolean
  appearanceByBackground?: Record<string, DynamicAppearanceTiming>
  audioId?: string
  audioTrigger?: DynamicItemAudioTrigger
  audioDelayMs?: number
  linkedAppearance?: DynamicLinkedAppearance
  backgroundIds?: string[]
  isVisible: boolean
  order: number
  createdAt: number
  updatedAt: number
}

interface DynamicMediaItem extends DynamicItemBase {
  kind: 'media'
  media: DynamicMedia
}

interface DynamicBubbleItem extends DynamicItemBase {
  kind: 'bubble'
  bubble: DynamicBubbleContent
}

type DynamicItem = DynamicMediaItem | DynamicBubbleItem

interface DynamicGroup {
  id: string
  name: string
  folderId?: string
  libraryOrder?: number
  thumbnail?: DynamicMedia
  background?: DynamicBackground
  backgrounds?: DynamicBackground[]
  activeBackgroundId?: string
  backgroundPlayMode: DynamicBackgroundPlayMode
  backgroundIntervalMs: number
  backgroundPlaybackLoop?: boolean
  appearMode: DynamicAppearMode
  appearIntervalMs: number
  appearAnimation?: DynamicAppearAnimation
  backgroundTransition?: DynamicBackgroundTransition
  audioLibrary?: DynamicAudioMedia[]
  linkedAppearanceModelVersion?: number
  items: DynamicItem[]
  createdAt: number
  updatedAt: number
}

interface DynamicGroupOrganization {
  folderId?: string
  libraryOrder?: number
}

interface DynamicMediaRecord {
  key: string
  name: string
  type: DynamicStoredMediaType
  mimeType: string
  blob: Blob
  width?: number
  height?: number
  updatedAt: number
}

const isNativeStorage = () => Capacitor.isNativePlatform()

const generateId = (prefix: string) => {
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`
}

const isDynamicBubbleItem = (item: DynamicItem): item is DynamicBubbleItem => item.kind === 'bubble'

const isDynamicMediaItem = (item: DynamicItem): item is DynamicMediaItem => item.kind !== 'bubble'

const getDynamicItemMedia = (item: DynamicItem) => (
  isDynamicMediaItem(item) ? item.media : undefined
)

const getDynamicItemBubbleImage = (item: DynamicItem) => (
  isDynamicBubbleItem(item) ? item.bubble.image : undefined
)

const clampRoundedNumber = (value: unknown, minimum: number, maximum: number, fallback: number) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.round(number)))
}

const normalizeDynamicBubbleType = (value: unknown): DynamicBubbleType => (
  value === 'thought' || value === 'title' ? value : 'dialogue'
)

const normalizeDynamicBubbleStyleId = (bubbleType: DynamicBubbleType, value: unknown): DynamicBubbleStyleId => {
  const styleId = typeof value === 'string' ? value.trim() : ''
  const legacyStyleMap: Record<typeof DYNAMIC_LEGACY_BUBBLE_STYLE_IDS[number], DynamicBubbleStyleId> = {
    'dialogue-rounded': 'dialogue-rounded-right',
    'dialogue-soft': 'dialogue-soft-right',
    'dialogue-comic': 'dialogue-comic-right',
    'thought-cloud': 'thought-cloud-right',
    'thought-soft': 'thought-cloud-right',
    'thought-soft-left': 'thought-cloud-left',
    'thought-soft-right': 'thought-cloud-right'
  }
  const canonicalStyleId = DYNAMIC_LEGACY_BUBBLE_STYLE_IDS.includes(
    styleId as typeof DYNAMIC_LEGACY_BUBBLE_STYLE_IDS[number]
  )
    ? legacyStyleMap[styleId as typeof DYNAMIC_LEGACY_BUBBLE_STYLE_IDS[number]]
    : styleId
  const allowedStyleIds: readonly string[] = bubbleType === 'thought'
    ? DYNAMIC_THOUGHT_BUBBLE_STYLE_IDS
    : bubbleType === 'title'
      ? DYNAMIC_TITLE_BUBBLE_STYLE_IDS
      : DYNAMIC_DIALOGUE_BUBBLE_STYLE_IDS
  const fallbackStyleId: DynamicBubbleStyleId = bubbleType === 'thought'
    ? 'thought-cloud-right'
    : bubbleType === 'title'
      ? 'title-rounded'
      : 'dialogue-rounded-right'
  return (allowedStyleIds.includes(canonicalStyleId)
    ? canonicalStyleId
    : fallbackStyleId) as DynamicBubbleStyleId
}

const getDynamicBubbleDefaultSurfaceColors = (styleId: DynamicBubbleStyleId) => {
  if (styleId.startsWith('dialogue-rounded-')) return DYNAMIC_BUBBLE_DEFAULT_SURFACE_COLORS['dialogue-rounded']
  if (styleId.startsWith('dialogue-soft-')) return DYNAMIC_BUBBLE_DEFAULT_SURFACE_COLORS['dialogue-soft']
  if (styleId.startsWith('dialogue-comic-')) return DYNAMIC_BUBBLE_DEFAULT_SURFACE_COLORS['dialogue-comic']
  if (styleId.startsWith('thought-cloud-')) return DYNAMIC_BUBBLE_DEFAULT_SURFACE_COLORS['thought-cloud']
  return DYNAMIC_BUBBLE_DEFAULT_SURFACE_COLORS.title
}

const normalizeDynamicBubbleColor = (value: unknown, fallback: string) => (
  typeof value === 'string' && value.trim() ? value.trim() : fallback
)

const normalizeDynamicBubbleTitleMaskId = (value: unknown): DynamicBubbleTitleMaskId => (
  DYNAMIC_BUBBLE_TITLE_MASK_IDS.includes(value as DynamicBubbleTitleMaskId)
    ? value as DynamicBubbleTitleMaskId
    : 'rounded'
)

const normalizeDynamicBubblePaletteId = (
  bubbleType: DynamicBubbleType,
  value: unknown
): DynamicBubblePaletteId => {
  if (value === 'ink' || value === 'ocean' || value === 'coral' || value === 'sun' || value === 'violet') {
    return value
  }
  return bubbleType === 'thought' ? 'ink' : 'ocean'
}

const normalizeDynamicBubbleMaskOpacity = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 0.92
  const number = Number(value)
  if (!Number.isFinite(number)) return 0.92
  return Math.min(1, Math.max(0, number))
}

const normalizeDynamicBubbleContent = (
  bubble: Partial<DynamicBubbleContent> | undefined,
  image?: DynamicMedia
): DynamicBubbleContent => {
  const bubbleType = normalizeDynamicBubbleType(bubble?.bubbleType)
  const paletteId = normalizeDynamicBubblePaletteId(bubbleType, bubble?.paletteId)
  const styleId = normalizeDynamicBubbleStyleId(bubbleType, bubble?.styleId)
  const defaultSurfaceColors = getDynamicBubbleDefaultSurfaceColors(styleId)
  const title = typeof bubble?.title === 'string' ? bubble.title : ''
  const bodyText = typeof bubble?.bodyText === 'string' ? bubble.bodyText : ''
  return {
    schemaVersion: 2,
    bubbleType,
    styleId,
    title: bubbleType === 'title' ? '' : title,
    bodyText: bubbleType === 'title' && !bodyText.trim() ? title : bodyText,
    revealMode: bubble?.revealMode === 'typewriter' ? 'typewriter' : 'all',
    revealIntervalMs: clampRoundedNumber(
      bubble?.revealIntervalMs,
      MIN_DYNAMIC_BUBBLE_REVEAL_INTERVAL_MS,
      MAX_DYNAMIC_BUBBLE_REVEAL_INTERVAL_MS,
      DEFAULT_DYNAMIC_BUBBLE_REVEAL_INTERVAL_MS
    ),
    fontSizePx: clampRoundedNumber(
      bubble?.fontSizePx,
      MIN_DYNAMIC_BUBBLE_FONT_SIZE_PX,
      MAX_DYNAMIC_BUBBLE_FONT_SIZE_PX,
      52
    ),
    textColor: typeof bubble?.textColor === 'string' && bubble.textColor.trim()
      ? bubble.textColor.trim()
      : '#172033',
    surfaceColor: normalizeDynamicBubbleColor(bubble?.surfaceColor, defaultSurfaceColors.surfaceColor),
    outlineColor: normalizeDynamicBubbleColor(bubble?.outlineColor, defaultSurfaceColors.outlineColor),
    surfaceId: typeof bubble?.surfaceId === 'string' && bubble.surfaceId.trim()
      ? bubble.surfaceId.trim()
      : 'light',
    titleMaskId: normalizeDynamicBubbleTitleMaskId(bubble?.titleMaskId),
    paletteId,
    maskColor: typeof bubble?.maskColor === 'string' && bubble.maskColor.trim()
      ? bubble.maskColor.trim()
      : DYNAMIC_BUBBLE_MASK_COLOR_BY_PALETTE[paletteId] ?? '#0c8fa4',
    maskOpacity: normalizeDynamicBubbleMaskOpacity(bubble?.maskOpacity),
    widthPx: clampRoundedNumber(
      bubble?.widthPx,
      MIN_DYNAMIC_BUBBLE_WIDTH_PX,
      MAX_DYNAMIC_BUBBLE_WIDTH_PX,
      bubbleType === 'thought' ? 940 : bubbleType === 'title' ? 900 : 1080
    ),
    heightPx: clampRoundedNumber(
      bubble?.heightPx,
      MIN_DYNAMIC_BUBBLE_HEIGHT_PX,
      MAX_DYNAMIC_BUBBLE_HEIGHT_PX,
      bubbleType === 'thought' ? 680 : bubbleType === 'title' ? 220 : 480
    ),
    image: bubbleType === 'thought' ? image ?? bubble?.image : undefined
  }
}

const normalizeDynamicItemKind = (item: DynamicItem): DynamicItem => {
  if ((item as DynamicItem).kind === 'bubble' && (item as DynamicBubbleItem).bubble) {
    const bubbleItem = item as DynamicBubbleItem
    return {
      ...bubbleItem,
      kind: 'bubble',
      bubble: normalizeDynamicBubbleContent(bubbleItem.bubble)
    }
  }

  return {
    ...(item as DynamicMediaItem),
    kind: 'media'
  }
}

const safePathSegment = (value: string) => value.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'default'

const getMediaType = (file: File): DynamicMediaType => {
  if (file.type.startsWith('video/')) return 'video'
  return 'image'
}

const getStoredMediaType = (file: File): DynamicStoredMediaType => (
  file.type.startsWith('audio/') ? 'audio' : getMediaType(file)
)

const DYNAMIC_AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg'
}

const normalizeDynamicAudioFile = (file: File): File | undefined => {
  const extension = file.name.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? ''
  const normalizedMimeType = file.type.trim().toLowerCase().split(';', 1)[0]
  const extensionMimeType = DYNAMIC_AUDIO_MIME_BY_EXTENSION[extension]

  if (!extensionMimeType && !normalizedMimeType.startsWith('audio/')) return undefined

  const targetMimeType = extensionMimeType ?? normalizedMimeType
  if (targetMimeType === file.type) return file

  return new File([file], file.name, {
    type: targetMimeType,
    lastModified: file.lastModified
  })
}

const getFileExtension = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension && /^[a-z0-9]+$/.test(extension)) return extension

  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  if (file.type === 'audio/mpeg') return 'mp3'
  if (file.type === 'audio/mp4') return 'm4a'
  if (file.type === 'audio/wav' || file.type === 'audio/x-wav') return 'wav'
  if (file.type === 'audio/ogg') return 'ogg'
  if (file.type.startsWith('audio/')) return 'm4a'
  if (file.type === 'video/quicktime') return 'mov'
  if (file.type.startsWith('video/')) return 'mp4'
  return 'png'
}

const calculateGridIndex = (x: number, y: number) => {
  const col = Math.min(GRID_COLUMNS - 1, Math.max(0, Math.floor(x * GRID_COLUMNS)))
  const row = Math.min(GRID_ROWS - 1, Math.max(0, (GRID_ROWS - 1) - Math.floor(y * GRID_ROWS)))
  return row * GRID_COLUMNS + col
}

const getDynamicMoveTrackFromPosition = (y: number): DynamicMoveTrack => {
  if (y < 1 / 3) return 'top'
  if (y > 2 / 3) return 'bottom'
  return 'middle'
}

const getDynamicMoveTrackCenter = (track: DynamicMoveTrack) => {
  if (track === 'top') return 1 / 6
  if (track === 'bottom') return 5 / 6
  return 1 / 2
}

const getDynamicMoveSpeedFromItem = (item: DynamicItem) => {
  if (item.moveSpeed !== undefined) return item.moveSpeed
  if (item.moveMode === 'left' || item.moveMode === 'right') return item.movePercent
  return DEFAULT_DYNAMIC_MOVE_SPEED
}

const getDynamicAppearIntervalFromGroup = (group: DynamicGroup) => {
  const interval = Number(group.appearIntervalMs)
  if (!Number.isFinite(interval)) return DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS
  return Math.min(MAX_DYNAMIC_APPEAR_INTERVAL_MS, Math.max(MIN_DYNAMIC_APPEAR_INTERVAL_MS, Math.round(interval)))
}

const getDynamicBackgroundIntervalFromGroup = (group: DynamicGroup) => {
  const interval = Number(group.backgroundIntervalMs)
  if (!Number.isFinite(interval)) return DEFAULT_DYNAMIC_BACKGROUND_INTERVAL_MS
  return Math.min(MAX_DYNAMIC_BACKGROUND_INTERVAL_MS, Math.max(MIN_DYNAMIC_BACKGROUND_INTERVAL_MS, Math.round(interval)))
}

const getDynamicBackgroundPlayModeFromGroup = (group: DynamicGroup): DynamicBackgroundPlayMode => {
  if (group.backgroundPlayMode === 'random' || group.backgroundPlayMode === 'sequence') {
    return group.backgroundPlayMode
  }
  return 'fixed'
}

const getDynamicBackgroundPlaybackLoopFromGroup = (group: DynamicGroup): boolean => (
  normalizeDynamicBackgroundPlaybackLoop(
    group.backgroundPlaybackLoop,
    DEFAULT_DYNAMIC_BACKGROUND_PLAYBACK_LOOP
  )
)

const getDynamicAppearAnimationFromGroup = (group: DynamicGroup): DynamicAppearAnimation => {
  return normalizeDynamicAppearAnimation(group.appearAnimation)
}

const getDynamicBackgroundTransitionFromGroup = (group: DynamicGroup): DynamicBackgroundTransition => {
  if (
    group.backgroundTransition === 'curtain'
    || group.backgroundTransition === 'cameraFlash'
    || group.backgroundTransition === 'shadowPlay'
  ) {
    return group.backgroundTransition
  }
  return 'none'
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeDynamicAppearanceTiming = (value: unknown): DynamicAppearanceTiming | undefined => {
  if (typeof value === 'number' || typeof value === 'string') {
    const numericValue = Number(value)
    return Number.isFinite(numericValue)
      ? { appearanceDelayMs: normalizeDynamicAppearanceTimeMs(numericValue) }
      : undefined
  }
  if (!isRecord(value)) return undefined

  const hasDelay = Object.prototype.hasOwnProperty.call(value, 'appearanceDelayMs')
  const hasHide = Object.prototype.hasOwnProperty.call(value, 'appearanceHideMs')
  if (!hasDelay && !hasHide) return undefined

  const timing: DynamicAppearanceTiming = {
    ...(hasDelay
      ? { appearanceDelayMs: normalizeDynamicAppearanceTimeMs(value.appearanceDelayMs) }
      : {})
  }
  if (hasHide) {
    timing.appearanceHideMs = value.appearanceHideMs === null
      ? null
      : normalizeDynamicAppearanceTimeMs(value.appearanceHideMs)
  }
  return timing
}

const normalizeDynamicAppearanceByBackground = (
  value: unknown
): Record<string, DynamicAppearanceTiming> => {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .map(([backgroundId, timing]) => [
        backgroundId.trim(),
        normalizeDynamicAppearanceTiming(timing)
      ] as const)
      .filter((entry): entry is readonly [string, DynamicAppearanceTiming] => (
        Boolean(entry[0]) && Boolean(entry[1])
      ))
  )
}

const normalizeDynamicBackgroundAppearance = (
  value: unknown,
  group: DynamicGroup
): DynamicBackgroundAppearance => {
  const source = isRecord(value) ? value : {}
  const fallbackMode: DynamicAppearMode = group.appearMode === 'sequence' ? 'sequence' : 'all'
  const sourceMode = source.appearMode ?? source.mode
  const appearMode: DynamicAppearMode = sourceMode === 'sequence' || sourceMode === 'all'
    ? sourceMode
    : fallbackMode
  const sourceInterval = source.appearIntervalMs ?? source.intervalMs
  const appearIntervalMs = getDynamicAppearIntervalFromGroup({
    ...group,
    appearIntervalMs: sourceInterval === undefined ? group.appearIntervalMs : Number(sourceInterval)
  })
  const fallbackAnimation = getDynamicAppearAnimationFromGroup(group)
  const sourceAnimation = source.appearAnimation ?? source.animation
  const appearAnimation = sourceAnimation === undefined
    ? fallbackAnimation
    : normalizeDynamicAppearAnimation(sourceAnimation)

  return {
    appearMode,
    appearIntervalMs,
    appearAnimation
  }
}

const getDynamicTargetModeFromItem = (item: DynamicItem): DynamicTargetMode => (
  item.targetMode === 'target' && item.targetPosition ? 'target' : 'loop'
)

const getDynamicAudioTriggerFromItem = (item: DynamicItem): DynamicItemAudioTrigger => {
  if (item.audioTrigger === 'appearanceDelay' || item.audioTrigger === 'targetArrival') {
    return item.audioTrigger
  }
  return 'appearance'
}

const normalizeDynamicPosition = (position?: { x: number; y: number }) => {
  if (!position) return undefined
  const x = Number(position.x)
  const y = Number(position.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y))
  }
}

const normalizeLegacyDynamicItemLinks = (items: DynamicItem[]) => {
  const validItemIds = new Set(items.map((item) => item.id).filter(Boolean))
  const normalizedItems = items.map((item) => ({
    ...item,
    linkedAppearance: normalizeDynamicLinkedAppearance(
      item.linkedAppearance,
      item.id,
      validItemIds
    )
  }))

  const validatedItems = normalizedItems.map((item) => ({
    ...item,
    linkedAppearance: item.linkedAppearance && !wouldCreateDynamicLinkedAppearanceCycle(
      normalizedItems,
      item.id,
      item.linkedAppearance.triggerItemId
    )
      ? item.linkedAppearance
      : undefined
  }))

  return validatedItems
}

const normalizeDynamicIndependentAppearance = (items: DynamicItem[]) => items.map((item) => ({
  ...item,
  appearanceDelayMs: normalizeDynamicAppearanceTimeMs(item.appearanceDelayMs),
  appearanceHideMs: item.appearanceHideMs !== null
    && item.appearanceHideMs !== undefined
    && Number.isFinite(Number(item.appearanceHideMs))
    ? normalizeDynamicAppearanceTimeMs(item.appearanceHideMs)
    : undefined,
  hideAfterTarget: item.hideAfterTarget === true,
  appearanceByBackground: normalizeDynamicAppearanceByBackground(item.appearanceByBackground),
  linkedAppearance: undefined
}))

const migrateDynamicLinkedAppearanceModel = (group: DynamicGroup): DynamicGroup => {
  const sourceItems = Array.isArray(group.items) ? group.items : []
  const modelVersion = Number(group.linkedAppearanceModelVersion)

  if (Number.isFinite(modelVersion) && modelVersion >= DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION) {
    return {
      ...group,
      linkedAppearanceModelVersion: modelVersion,
      items: normalizeDynamicIndependentAppearance(sourceItems)
    }
  }

  let legacyItems = sourceItems
  if (!Number.isFinite(modelVersion) || modelVersion < 3) {
    const validItemIds = new Set(sourceItems.map((item) => item.id).filter(Boolean))
    const migratedItems: DynamicItem[] = sourceItems.map((item) => ({
      ...item,
      linkedAppearance: undefined
    }))
    const targetIndexById = new Map(migratedItems.map((item, index) => [item.id, index]))

    sourceItems
      .map((sourceItem) => ({
        sourceItem,
        legacyLink: normalizeDynamicLinkedAppearance(
          sourceItem.linkedAppearance,
          sourceItem.id,
          validItemIds
        )
      }))
      .filter((entry): entry is { sourceItem: DynamicItem; legacyLink: DynamicLinkedAppearance } => Boolean(entry.legacyLink))
      .sort((left, right) => (
        (right.sourceItem.updatedAt ?? 0) - (left.sourceItem.updatedAt ?? 0)
        || left.sourceItem.order - right.sourceItem.order
      ))
      .forEach(({ sourceItem, legacyLink }) => {
        const targetIndex = targetIndexById.get(legacyLink.triggerItemId)
        if (targetIndex === undefined || migratedItems[targetIndex].linkedAppearance) return

        migratedItems[targetIndex] = {
          ...migratedItems[targetIndex],
          linkedAppearance: {
            triggerItemId: sourceItem.id,
            mode: legacyLink.mode,
            delayMs: legacyLink.delayMs
          }
        }
      })
    legacyItems = migratedItems
  }

  const migratedItems = convertDynamicLinkedAppearanceToIndependentTiming({
    items: normalizeLegacyDynamicItemLinks(legacyItems),
    appearMode: group.appearMode,
    intervalMs: group.appearIntervalMs,
    appearAnimation: group.appearAnimation
  }) as DynamicItem[]

  return {
    ...group,
    linkedAppearanceModelVersion: DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION,
    items: normalizeDynamicIndependentAppearance(migratedItems)
  }
}

const blobToBase64 = (blob: Blob) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read dynamic media blob'))
    reader.readAsDataURL(blob)
  })
}

const toDataUrl = (data: string, mimeType: string) => {
  if (data.startsWith('data:')) return data
  return `data:${mimeType};base64,${data}`
}

const base64ToBlob = (data: string, mimeType: string) => {
  const base64 = data.includes(',') ? data.split(',')[1] : data
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

const readImageDimensions = (file: File) => {
  if (!file.type.startsWith('image/')) {
    return Promise.resolve<{ width?: number; height?: number }>({})
  }

  return new Promise<{ width?: number; height?: number }>((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    const cleanup = () => URL.revokeObjectURL(objectUrl)

    image.onload = () => {
      const width = image.naturalWidth || image.width
      const height = image.naturalHeight || image.height
      cleanup()
      resolve(width > 0 && height > 0 ? { width, height } : {})
    }
    image.onerror = () => {
      cleanup()
      resolve({})
    }
    image.src = objectUrl
  })
}

const openDynamicDb = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available'))
      return
    }

    const request = window.indexedDB.open(DYNAMIC_DB_NAME, DYNAMIC_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DYNAMIC_STORE_NAME)) {
        db.createObjectStore(DYNAMIC_STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open dynamic media cache'))
  })
}

const putDynamicBlob = async (record: DynamicMediaRecord) => {
  const db = await openDynamicDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(DYNAMIC_STORE_NAME, 'readwrite')
      transaction.objectStore(DYNAMIC_STORE_NAME).put(record)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to save dynamic media blob'))
    })
  } finally {
    db.close()
  }
}

const getDynamicBlob = async (key: string) => {
  const db = await openDynamicDb()
  try {
    return await new Promise<DynamicMediaRecord | undefined>((resolve, reject) => {
      const transaction = db.transaction(DYNAMIC_STORE_NAME, 'readonly')
      const request = transaction.objectStore(DYNAMIC_STORE_NAME).get(key)
      request.onsuccess = () => resolve(request.result as DynamicMediaRecord | undefined)
      request.onerror = () => reject(request.error ?? new Error('Failed to load dynamic media blob'))
    })
  } finally {
    db.close()
  }
}

const deleteDynamicBlob = async (key: string) => {
  const db = await openDynamicDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(DYNAMIC_STORE_NAME, 'readwrite')
      transaction.objectStore(DYNAMIC_STORE_NAME).delete(key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to delete dynamic media blob'))
    })
  } finally {
    db.close()
  }
}

const saveFileToFilesystem = async (file: File, mediaId: string, scope: string) => {
  const extension = getFileExtension(file)
  const path = `dynamic-art/${safePathSegment(scope)}/${safePathSegment(mediaId)}.${extension}`
  const data = await blobToBase64(file)
  await Filesystem.writeFile({
    path,
    data,
    directory: DYNAMIC_DIRECTORY,
    recursive: true
  })
  return path
}

const resolveMediaUrl = async <T extends DynamicStoredMedia>(media: T): Promise<T> => {
  if (media.filePath && isNativeStorage()) {
    try {
      if (media.type === 'video') {
        const result = await Filesystem.getUri({
          path: media.filePath,
          directory: DYNAMIC_DIRECTORY
        })

        return {
          ...media,
          url: Capacitor.convertFileSrc(result.uri)
        }
      }

      const result = await Filesystem.readFile({
        path: media.filePath,
        directory: DYNAMIC_DIRECTORY
      })

      const url = result.data instanceof Blob
        ? URL.createObjectURL(result.data)
        : toDataUrl(result.data, media.mimeType)

      return { ...media, url } as T
    } catch (error) {
      console.error('Failed to resolve dynamic media file:', error)
    }
  }

  if (media.storageKey) {
    try {
      const record = await getDynamicBlob(media.storageKey)
      if (record?.blob) {
        return {
          ...media,
          name: media.name || record.name,
          type: media.type || record.type,
          mimeType: media.mimeType || record.mimeType,
          url: URL.createObjectURL(record.blob)
        } as T
      }
    } catch (error) {
      console.error('Failed to resolve dynamic media blob:', error)
    }
  }

  return {
    ...media,
    url: media.url ?? ''
  } as T
}

const loadRawGroups = (): DynamicGroup[] => {
  try {
    const raw = localStorage.getItem(DYNAMIC_GROUPS_KEY)
    const groups = raw ? JSON.parse(raw) as DynamicGroup[] : []
    return groups.map((group) => normalizeDynamicGroupAppearance(
      migrateDynamicLinkedAppearanceModel({
        ...group,
        items: Array.isArray(group.items) ? group.items.map(normalizeDynamicItemKind) : []
      })
    ))
  } catch {
    return []
  }
}

const serializeMediaForStorage = <T extends DynamicStoredMedia>(media?: T): T | undefined => {
  if (!media) return undefined

  const { url: _url, ...storedMedia } = media
  return {
    ...storedMedia,
    url: ''
  } as T
}

const serializeBackgroundForStorage = (background?: DynamicBackground): DynamicBackground | undefined => {
  if (!background) return undefined
  const { appearAnimation: _legacyAppearAnimation, ...nextBackground } = background as DynamicBackground & {
    appearAnimation?: DynamicAppearAnimation
  }
  return serializeMediaForStorage(nextBackground as DynamicBackground) as DynamicBackground
}

const serializeDynamicItemForStorage = (item: DynamicItem): DynamicItem => {
  const appearanceByBackground = normalizeDynamicAppearanceByBackground(item.appearanceByBackground)
  const normalizedItem = {
    ...item,
    ...(Object.keys(appearanceByBackground).length > 0 ? { appearanceByBackground } : {})
  }

  if (isDynamicBubbleItem(item)) {
    const bubble = normalizeDynamicBubbleContent(item.bubble)
    return {
      ...normalizedItem,
      kind: 'bubble',
      bubble: {
        ...bubble,
        image: serializeMediaForStorage(bubble.image)
      }
    }
  }

  return {
    ...normalizedItem,
    kind: 'media',
    media: serializeMediaForStorage(item.media) ?? item.media
  }
}

const serializeGroupForStorage = (group: DynamicGroup): DynamicGroup => ({
  ...group,
  thumbnail: serializeMediaForStorage(group.thumbnail),
  background: serializeBackgroundForStorage(group.background),
  backgrounds: getGroupBackgrounds(group).map((background) => serializeBackgroundForStorage(background) as DynamicBackground),
  audioLibrary: group.audioLibrary?.map((audio) => (
    serializeMediaForStorage(audio) as DynamicAudioMedia
  )),
  items: group.items.map(serializeDynamicItemForStorage)
})

const saveDynamicGroups = (groups: DynamicGroup[]) => {
  const storageGroups = groups.map((group) => (
    serializeGroupForStorage(normalizeDynamicGroupAppearance(group))
  ))
  localStorage.setItem(DYNAMIC_GROUPS_KEY, JSON.stringify(storageGroups))
}

const getGroupBackgrounds = (group: DynamicGroup) => {
  if (group.backgrounds?.length) return group.backgrounds
  return group.background ? [group.background] : []
}

const normalizeInitialDynamicItemBackgroundIds = (
  group: DynamicGroup,
  initialBackgroundIds?: string | string[]
) => {
  if (initialBackgroundIds === undefined) return []

  const validBackgroundIds = new Set(getGroupBackgrounds(group).map((background) => background.id))
  const requestedBackgroundIds = Array.isArray(initialBackgroundIds)
    ? initialBackgroundIds
    : [initialBackgroundIds]

  return Array.from(new Set(
    requestedBackgroundIds
      .map((backgroundId) => typeof backgroundId === 'string' ? backgroundId.trim() : '')
      .filter((backgroundId) => backgroundId && validBackgroundIds.has(backgroundId))
  ))
}

const normalizeDynamicGroupAppearance = (group: DynamicGroup): DynamicGroup => {
  const sourceBackgrounds = getGroupBackgrounds(group)
  const backgrounds = sourceBackgrounds.map((background) => ({
    ...background,
    appearance: normalizeDynamicBackgroundAppearance(background.appearance, group)
  }))
  const activeBackground = getActiveBackground(group, backgrounds)

  return {
    ...group,
    backgrounds,
    background: activeBackground,
    activeBackgroundId: activeBackground?.id ?? group.activeBackgroundId,
    backgroundPlaybackLoop: getDynamicBackgroundPlaybackLoopFromGroup(group),
    items: normalizeDynamicIndependentAppearance(
      Array.isArray(group.items) ? group.items.map(normalizeDynamicItemKind) : []
    )
  }
}

const mergeMediaPersistentFields = <T extends DynamicStoredMedia>(media?: T, existingMedia?: DynamicStoredMedia): T | undefined => {
  if (!media) return undefined
  if (!existingMedia || existingMedia.id !== media.id) return media

  return {
    ...existingMedia,
    ...media,
    filePath: media.filePath ?? existingMedia.filePath,
    storageKey: media.storageKey ?? existingMedia.storageKey,
    url: media.url || existingMedia.url || ''
  } as T
}

const mergeGroupPersistentMedia = (group: DynamicGroup, existingGroup?: DynamicGroup): DynamicGroup => {
  if (!existingGroup) return group

  const existingMediaById = new Map<string, DynamicStoredMedia>()
  const collectMedia = (media?: DynamicStoredMedia) => {
    if (media) existingMediaById.set(media.id, media)
  }

  collectMedia(existingGroup.thumbnail)
  getGroupBackgrounds(existingGroup).forEach(collectMedia)
  existingGroup.audioLibrary?.forEach(collectMedia)
  existingGroup.items.forEach((item) => {
    collectMedia(getDynamicItemMedia(item))
    collectMedia(getDynamicItemBubbleImage(item))
  })

  return {
    ...group,
    thumbnail: mergeMediaPersistentFields(group.thumbnail, group.thumbnail ? existingMediaById.get(group.thumbnail.id) : undefined),
    background: mergeMediaPersistentFields(group.background, group.background ? existingMediaById.get(group.background.id) : undefined),
    backgrounds: getGroupBackgrounds(group).map((background) => (
      mergeMediaPersistentFields(background, existingMediaById.get(background.id)) as DynamicBackground
    )),
    audioLibrary: group.audioLibrary?.map((audio) => (
      mergeMediaPersistentFields(audio, existingMediaById.get(audio.id)) as DynamicAudioMedia
    )),
    items: group.items.map((item) => {
      if (isDynamicBubbleItem(item)) {
        const image = item.bubble.image
        return {
          ...item,
          bubble: {
            ...item.bubble,
            image: mergeMediaPersistentFields(image, image ? existingMediaById.get(image.id) : undefined)
          }
        }
      }

      return {
        ...item,
        media: mergeMediaPersistentFields(item.media, existingMediaById.get(item.media.id)) ?? item.media
      }
    })
  }
}

const getActiveBackground = (group: DynamicGroup, backgrounds = getGroupBackgrounds(group)) => {
  const activeBackgroundId = String(group.activeBackgroundId ?? '').trim()
  return backgrounds.find((background) => background.id === activeBackgroundId)
    ?? backgrounds.find((background) => background.id === group.background?.id)
    ?? backgrounds[0]
}

const hydrateGroup = async (group: DynamicGroup): Promise<DynamicGroup> => {
  const normalizedGroup = normalizeDynamicGroupAppearance(group)
  const sourceBackgrounds = getGroupBackgrounds(normalizedGroup)
  const groupAppearAnimation = getDynamicAppearAnimationFromGroup(normalizedGroup)
  const groupBackgroundTransition = getDynamicBackgroundTransitionFromGroup(normalizedGroup)
  const [thumbnail, resolvedBackgrounds, audioLibrary, resolvedItems] = await Promise.all([
    normalizedGroup.thumbnail ? resolveMediaUrl(normalizedGroup.thumbnail) : Promise.resolve(undefined),
    Promise.all(sourceBackgrounds.map(async (background) => ({
      ...await resolveMediaUrl(background),
      backgroundTransition: groupBackgroundTransition,
      appearAnimation: undefined
    }))),
    Promise.all((normalizedGroup.audioLibrary ?? []).map(async (audio) => (
      await resolveMediaUrl(audio) as DynamicAudioMedia
    ))),
    Promise.all(normalizedGroup.items.map(async (sourceItem): Promise<DynamicItem> => {
      const item = normalizeDynamicItemKind(sourceItem)
      const commonItem = {
        ...item,
        flipX: item.flipX ?? false,
        flipY: item.flipY ?? false,
        animationMode: getDynamicAnimationMode(item),
        animationId: normalizeDynamicAnimationId(item.animationId),
        clickAnimationIds: getDynamicClickAnimationIds(item),
        moveSpeed: getDynamicMoveSpeedFromItem(item),
        moveTrack: item.moveTrack ?? getDynamicMoveTrackFromPosition(item.position.y),
        targetMode: getDynamicTargetModeFromItem(item),
        targetLoop: item.targetLoop === true,
        targetPosition: normalizeDynamicPosition(item.targetPosition),
        appearanceDelayMs: normalizeDynamicAppearanceTimeMs(item.appearanceDelayMs),
        appearanceHideMs: item.appearanceHideMs !== null
          && item.appearanceHideMs !== undefined
          && Number.isFinite(Number(item.appearanceHideMs))
          ? normalizeDynamicAppearanceTimeMs(item.appearanceHideMs)
          : undefined,
        hideAfterTarget: item.hideAfterTarget === true,
        audioTrigger: getDynamicAudioTriggerFromItem(item),
        audioDelayMs: Math.max(0, Math.round(Number(item.audioDelayMs) || 0)),
        backgroundIds: Array.isArray(item.backgroundIds)
          ? Array.from(new Set(item.backgroundIds.filter(Boolean)))
          : []
      }

      if (isDynamicBubbleItem(item)) {
        const image = item.bubble.image
          ? await resolveMediaUrl(item.bubble.image)
          : undefined
        return {
          ...commonItem,
          kind: 'bubble',
          bubble: normalizeDynamicBubbleContent(item.bubble, image)
        }
      }

      return {
        ...commonItem,
        kind: 'media',
        media: await resolveMediaUrl(item.media)
      }
    }))
  ])

  const backgrounds = resolvedBackgrounds as DynamicBackground[]
  const items = normalizeDynamicIndependentAppearance(resolvedItems)

  const background = getActiveBackground(normalizedGroup, backgrounds)

  return {
    ...normalizedGroup,
    thumbnail,
    background,
    backgrounds,
    activeBackgroundId: background?.id,
    backgroundPlayMode: getDynamicBackgroundPlayModeFromGroup(group),
    backgroundIntervalMs: getDynamicBackgroundIntervalFromGroup(group),
    backgroundPlaybackLoop: getDynamicBackgroundPlaybackLoopFromGroup(group),
    appearIntervalMs: getDynamicAppearIntervalFromGroup(group),
    appearAnimation: groupAppearAnimation,
    backgroundTransition: groupBackgroundTransition,
    audioLibrary,
    items
  }
}

const loadDynamicGroups = async () => {
  const groups = loadRawGroups()
  if (groups.length > 0) {
    saveDynamicGroups(groups)
  }
  return Promise.all(groups.map(hydrateGroup))
}

const persistDynamicAsset = async (file: File, scope: string): Promise<DynamicStoredMedia> => {
  const mediaId = generateId('media')
  const type = getStoredMediaType(file)
  const mimeType = file.type || (type === 'video' ? 'video/mp4' : type === 'audio' ? 'audio/mp4' : 'image/png')
  const dimensions = await readImageDimensions(file)
  let filePath: string | undefined
  let storageKey: string | undefined

  if (isNativeStorage()) {
    try {
      filePath = await saveFileToFilesystem(file, mediaId, scope)
    } catch (error) {
      console.error('Failed to persist dynamic media file:', error)
    }
  }

  if (!filePath) {
    storageKey = mediaId
    try {
      await putDynamicBlob({
        key: storageKey,
        name: file.name,
        type,
        mimeType,
        blob: file,
        ...dimensions,
        updatedAt: Date.now()
      })
    } catch (error) {
      console.error('Failed to persist dynamic media blob:', error)
      storageKey = undefined
    }
  }

  return {
    id: mediaId,
    name: file.name,
    type,
    mimeType,
    url: URL.createObjectURL(file),
    ...dimensions,
    filePath,
    storageKey,
    updatedAt: Date.now()
  }
}

const persistDynamicMedia = async (file: File, scope: string): Promise<DynamicMedia> => {
  const media = await persistDynamicAsset(file, scope)
  if (media.type === 'audio') {
    await deleteDynamicMedia(media)
    throw new Error('Audio files cannot be used as dynamic visual media')
  }
  return media
}

const persistDynamicAudio = async (file: File, scope: string): Promise<DynamicAudioMedia> => {
  const normalizedFile = normalizeDynamicAudioFile(file)
  if (!normalizedFile) throw new Error('The selected file is not a supported audio file')

  const media = await persistDynamicAsset(normalizedFile, scope)
  if (media.type !== 'audio') {
    await deleteDynamicMedia(media)
    throw new Error('The selected file is not an audio file')
  }
  if (!media.filePath && !media.storageKey) {
    await deleteDynamicMedia(media)
    throw new Error('The selected audio file could not be persisted')
  }
  return media
}

const getDynamicMediaFile = async (media: DynamicStoredMedia): Promise<File | undefined> => {
  let blob: Blob | undefined

  if (media.filePath && isNativeStorage()) {
    try {
      const result = await Filesystem.readFile({
        path: media.filePath,
        directory: DYNAMIC_DIRECTORY
      })

      blob = result.data instanceof Blob
        ? result.data
        : base64ToBlob(result.data, media.mimeType)
    } catch (error) {
      console.error('Failed to read dynamic media file for sync:', error)
    }
  }

  if (!blob && media.storageKey) {
    try {
      const record = await getDynamicBlob(media.storageKey)
      blob = record?.blob
    } catch (error) {
      console.error('Failed to read dynamic media blob for sync:', error)
    }
  }

  if (!blob && media.url) {
    try {
      const response = await fetch(media.url)
      if (response.ok) {
        blob = await response.blob()
      }
    } catch (error) {
      console.error('Failed to fetch dynamic media url for sync:', error)
    }
  }

  if (!blob) return undefined

  const mimeType = media.mimeType || blob.type || 'application/octet-stream'
  return new File([blob], media.name || `${media.id}.bin`, {
    type: mimeType,
    lastModified: media.updatedAt || Date.now()
  })
}

const deleteDynamicMedia = async (media?: DynamicStoredMedia) => {
  if (!media) return

  if (media.filePath && isNativeStorage()) {
    try {
      await Filesystem.deleteFile({
        path: media.filePath,
        directory: DYNAMIC_DIRECTORY
      })
    } catch (error) {
      console.error('Failed to delete dynamic media file:', error)
    }
  }

  if (media.storageKey) {
    try {
      await deleteDynamicBlob(media.storageKey)
    } catch (error) {
      console.error('Failed to delete dynamic media blob:', error)
    }
  }
}

const isMediaUsedByOtherGroups = (groups: DynamicGroup[], groupId: string, mediaId?: string) => {
  if (!mediaId) return false

  return groups.some((group) => {
    if (group.id === groupId) return false
    if (group.thumbnail?.id === mediaId) return true
    if (getGroupBackgrounds(group).some((background) => background.id === mediaId)) return true
    if (group.audioLibrary?.some((audio) => audio.id === mediaId)) return true
    return group.items.some((item) => (
      getDynamicItemMedia(item)?.id === mediaId || getDynamicItemBubbleImage(item)?.id === mediaId
    ))
  })
}

const isMediaUsedByOtherEntity = (groups: DynamicGroup[], groupId: string, itemId: string, mediaId?: string) => {
  if (!mediaId) return false

  return groups.some((group) => {
    if (group.thumbnail?.id === mediaId) return true
    if (getGroupBackgrounds(group).some((background) => background.id === mediaId)) return true
    if (group.audioLibrary?.some((audio) => audio.id === mediaId)) return true
    return group.items.some((item) => {
      if (group.id === groupId && item.id === itemId) return false
      return getDynamicItemMedia(item)?.id === mediaId || getDynamicItemBubbleImage(item)?.id === mediaId
    })
  })
}

const collectDynamicGroupMedia = (group: DynamicGroup) => {
  const mediaById = new Map<string, DynamicStoredMedia>()
  const addMedia = (media?: DynamicStoredMedia) => {
    if (media) mediaById.set(media.id, media)
  }

  addMedia(group.thumbnail)
  getGroupBackgrounds(group).forEach(addMedia)
  group.audioLibrary?.forEach(addMedia)
  group.items.forEach((item) => {
    addMedia(getDynamicItemMedia(item))
    addMedia(getDynamicItemBubbleImage(item))
  })

  return Array.from(mediaById.values())
}

const createDynamicGroup = async (
  name: string,
  thumbnailFile?: File,
  background?: DynamicBackground,
  organization: DynamicGroupOrganization = {}
) => {
  const now = Date.now()
  const groupId = generateId('group')
  const thumbnail = thumbnailFile ? await persistDynamicMedia(thumbnailFile, `${groupId}/thumbnail`) : undefined
  const nextGroup: DynamicGroup = {
    id: groupId,
    name: name.trim() || '未命名作品檔案',
    folderId: organization.folderId,
    libraryOrder: organization.libraryOrder,
    thumbnail,
    background,
    backgrounds: background ? [background] : [],
    activeBackgroundId: background?.id,
    backgroundPlayMode: 'fixed',
    backgroundIntervalMs: DEFAULT_DYNAMIC_BACKGROUND_INTERVAL_MS,
    backgroundPlaybackLoop: DEFAULT_DYNAMIC_BACKGROUND_PLAYBACK_LOOP,
    appearMode: 'all',
    appearIntervalMs: DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS,
    appearAnimation: 'none',
    backgroundTransition: 'none',
    audioLibrary: [],
    linkedAppearanceModelVersion: DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION,
    items: [],
    createdAt: now,
    updatedAt: now
  }

  const normalizedGroup = normalizeDynamicGroupAppearance(nextGroup)
  const groups = loadRawGroups()
  const nextGroups = [normalizedGroup, ...groups]
  saveDynamicGroups(nextGroups)
  return hydrateGroup(normalizedGroup)
}

const updateDynamicGroupOrganization = async (
  groupId: string,
  organization: DynamicGroupOrganization
) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  group.folderId = organization.folderId
  if (organization.libraryOrder !== undefined) {
    group.libraryOrder = organization.libraryOrder
  }
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const updateDynamicGroupMeta = async (groupId: string, values: { name: string; thumbnailFile?: File }) => {
  const initialGroups = loadRawGroups()
  if (!initialGroups.some((item) => item.id === groupId)) return undefined

  const nextThumbnail = values.thumbnailFile
    ? await persistDynamicMedia(values.thumbnailFile, `${groupId}/thumbnail`)
    : undefined
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) {
    if (nextThumbnail) await deleteDynamicMedia(nextThumbnail)
    return undefined
  }

  const previousThumbnail = group.thumbnail
  group.name = values.name.trim() || group.name || '未命名作品檔案'
  if (nextThumbnail) group.thumbnail = nextThumbnail
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)

  if (
    previousThumbnail
    && nextThumbnail
    && previousThumbnail.id !== nextThumbnail.id
    && !isMediaUsedByOtherGroups(groups, groupId, previousThumbnail.id)
  ) {
    await deleteDynamicMedia(previousThumbnail)
  }
  return hydrateGroup(group)
}

const deleteDynamicGroup = async (groupId: string) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return loadDynamicGroups()

  const nextGroups = groups.filter((item) => item.id !== groupId)
  saveDynamicGroups(nextGroups)
  const mediaToDelete = collectDynamicGroupMedia(group)
    .filter((media) => !isMediaUsedByOtherGroups(groups, groupId, media.id))
  await Promise.all(mediaToDelete.map(deleteDynamicMedia))
  return Promise.all(nextGroups.map(hydrateGroup))
}

const upsertDynamicGroup = (group: DynamicGroup) => {
  const groups = loadRawGroups()
  const index = groups.findIndex((item) => item.id === group.id)
  const existingGroup = index >= 0 ? groups[index] : undefined
  const normalizedGroup = normalizeDynamicGroupAppearance(group)
  const nextGroup = mergeGroupPersistentMedia({
    ...normalizedGroup,
    backgroundPlayMode: getDynamicBackgroundPlayModeFromGroup(normalizedGroup),
    backgroundIntervalMs: getDynamicBackgroundIntervalFromGroup(normalizedGroup),
    backgroundPlaybackLoop: getDynamicBackgroundPlaybackLoopFromGroup(normalizedGroup),
    appearIntervalMs: getDynamicAppearIntervalFromGroup(normalizedGroup),
    appearAnimation: getDynamicAppearAnimationFromGroup(normalizedGroup),
    backgroundTransition: getDynamicBackgroundTransitionFromGroup(normalizedGroup),
    audioLibrary: normalizedGroup.audioLibrary ?? [],
    items: normalizeDynamicIndependentAppearance(normalizedGroup.items.map(normalizeDynamicItemKind)),
    linkedAppearanceModelVersion: DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION,
    updatedAt: Date.now()
  }, existingGroup)

  nextGroup.backgrounds = getGroupBackgrounds(nextGroup).map((background) => ({
    ...background,
    backgroundTransition: nextGroup.backgroundTransition ?? 'none',
    appearAnimation: undefined
  }))
  nextGroup.background = nextGroup.backgrounds.find((background) => background.id === nextGroup.activeBackgroundId)
    ?? nextGroup.backgrounds[0]

  if (index >= 0) {
    groups[index] = nextGroup
  } else {
    groups.unshift(nextGroup)
  }

  saveDynamicGroups(groups)
  return nextGroup
}

const setDynamicBackground = async (groupId: string, file: File) => {
  const persistedBackground = await persistDynamicMedia(file, `${groupId}/background`) as DynamicBackground
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) {
    await deleteDynamicMedia(persistedBackground)
    return undefined
  }

  const background: DynamicBackground = {
    ...persistedBackground,
    backgroundTransition: getDynamicBackgroundTransitionFromGroup(group),
    appearance: normalizeDynamicBackgroundAppearance(undefined, group)
  }
  const currentBackgrounds = getGroupBackgrounds(group)
  group.backgrounds = [background, ...currentBackgrounds.filter((item) => item.id !== background.id)]
  group.background = background
  group.activeBackgroundId = background.id
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const setActiveDynamicBackground = async (groupId: string, backgroundId: string) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const backgrounds = getGroupBackgrounds(group)
  const background = backgrounds.find((item) => item.id === backgroundId)
  if (!background) return hydrateGroup(group)

  group.backgrounds = backgrounds
  group.background = background
  group.activeBackgroundId = background.id
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const deleteDynamicBackgrounds = async (groupId: string, backgroundIds: string[]) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group || backgroundIds.length === 0) return undefined

  const deleteSet = new Set(backgroundIds)
  const currentBackgrounds = getGroupBackgrounds(group)
  const remainingBackgrounds = currentBackgrounds.filter((background) => !deleteSet.has(background.id))

  if (remainingBackgrounds.length === currentBackgrounds.length) {
    return hydrateGroup(group)
  }

  group.backgrounds = remainingBackgrounds
  const activeBackground = getActiveBackground(group, remainingBackgrounds)
  group.background = activeBackground
  group.activeBackgroundId = activeBackground?.id
  group.items = group.items.map((item) => {
    const backgroundIds = Array.isArray(item.backgroundIds)
      ? item.backgroundIds.filter((backgroundId) => !deleteSet.has(backgroundId))
      : []
    const appearanceByBackground = Object.fromEntries(
      Object.entries(normalizeDynamicAppearanceByBackground(item.appearanceByBackground))
        .filter(([backgroundId]) => !deleteSet.has(backgroundId))
    )
    if (
      (!Array.isArray(item.backgroundIds) || item.backgroundIds.length === 0)
      && Object.keys(appearanceByBackground).length === Object.keys(item.appearanceByBackground ?? {}).length
    ) return item
    return {
      ...item,
      // An empty list deliberately falls back to "all backgrounds".
      backgroundIds,
      appearanceByBackground: Object.keys(appearanceByBackground).length > 0
        ? appearanceByBackground
        : undefined,
      updatedAt: Date.now()
    }
  })
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  const mediaToDelete = currentBackgrounds
    .filter((background) => deleteSet.has(background.id))
    .filter((background) => !isMediaUsedByOtherGroups(groups, groupId, background.id))
  await Promise.all(mediaToDelete.map(deleteDynamicMedia))
  return hydrateGroup(group)
}

const reorderDynamicBackgrounds = (
  groupId: string,
  orderedBackgroundIds: string[],
  currentGroup?: DynamicGroup
) => {
  const groups = loadRawGroups()
  const groupIndex = groups.findIndex((item) => item.id === groupId)
  const storedGroup = groupIndex >= 0 ? groups[groupIndex] : undefined
  const group = currentGroup?.id === groupId
    ? mergeGroupPersistentMedia(currentGroup, storedGroup)
    : storedGroup
  if (!group) return undefined

  const currentBackgrounds = getGroupBackgrounds(group)
  const validIds = new Set(currentBackgrounds.map((background) => background.id))
  const orderedIds = orderedBackgroundIds.filter((backgroundId) => validIds.has(backgroundId))
  currentBackgrounds.forEach((background) => {
    if (!orderedIds.includes(background.id)) orderedIds.push(background.id)
  })

  const backgroundById = new Map(currentBackgrounds.map((background) => [background.id, background]))
  const backgrounds = orderedIds
    .map((backgroundId) => backgroundById.get(backgroundId))
    .filter(Boolean) as DynamicBackground[]
  const activeBackground = getActiveBackground(group, backgrounds)

  group.backgrounds = backgrounds
  group.background = activeBackground
  group.activeBackgroundId = activeBackground?.id
  group.updatedAt = Date.now()

  if (groupIndex >= 0) {
    groups[groupIndex] = group
  } else {
    groups.unshift(group)
  }

  saveDynamicGroups(groups)
  return group
}

const addDynamicItem = async (
  groupId: string,
  file: File,
  itemName?: string,
  initialBackgroundIds?: string | string[]
) => {
  const media = await persistDynamicMedia(file, `${groupId}/items`)
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group || group.items.length >= MAX_DYNAMIC_ITEMS_PER_GROUP) {
    await deleteDynamicMedia(media)
    return undefined
  }

  const now = Date.now()
  const item: DynamicItem = {
    id: generateId('item'),
    name: itemName?.trim() || file.name,
    kind: 'media',
    media,
    position: { x: 0.5, y: 0.5 },
    gridIndex: calculateGridIndex(0.5, 0.5),
    scale: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
    animationMode: 'none',
    animationId: 0,
    clickAnimationIds: [...DYNAMIC_ANIMATION_IDS],
    moveMode: 'none',
    movePercent: 50,
    moveSpeed: DEFAULT_DYNAMIC_MOVE_SPEED,
    moveTrack: 'middle',
    targetMode: 'loop',
    targetLoop: false,
    appearanceDelayMs: 0,
    hideAfterTarget: false,
    audioTrigger: 'appearance',
    audioDelayMs: 0,
    backgroundIds: normalizeInitialDynamicItemBackgroundIds(group, initialBackgroundIds),
    isVisible: true,
    order: group.items.length,
    createdAt: now,
    updatedAt: now
  }

  group.items.push(item)
  group.updatedAt = now
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const updateDynamicItemMeta = async (
  groupId: string,
  itemId: string,
  values: { name: string; file?: File }
) => {
  const nextMedia = values.file
    ? await persistDynamicMedia(values.file, `${groupId}/items`)
    : undefined
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) {
    if (nextMedia) await deleteDynamicMedia(nextMedia)
    return undefined
  }

  const item = group.items.find((nextItem) => nextItem.id === itemId)
  if (!item || !isDynamicMediaItem(item)) {
    if (nextMedia) await deleteDynamicMedia(nextMedia)
    return undefined
  }

  const previousMedia = item.media
  item.name = values.name.trim() || item.name || values.file?.name || '未命名物件'
  if (nextMedia) item.media = nextMedia

  item.updatedAt = Date.now()
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  if (
    previousMedia
    && nextMedia
    && previousMedia.id !== nextMedia.id
    && !isMediaUsedByOtherEntity(groups, groupId, itemId, previousMedia.id)
  ) {
    await deleteDynamicMedia(previousMedia)
  }
  return hydrateGroup(group)
}

const createDynamicItemBase = (
  group: DynamicGroup,
  name: string,
  now: number,
  initialBackgroundIds?: string | string[]
): DynamicItemBase => ({
  id: generateId('item'),
  name,
  position: { x: 0.5, y: 0.5 },
  gridIndex: calculateGridIndex(0.5, 0.5),
  scale: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
  animationMode: 'none',
  animationId: 0,
  clickAnimationIds: [...DYNAMIC_ANIMATION_IDS],
  moveMode: 'none',
  movePercent: 50,
  moveSpeed: DEFAULT_DYNAMIC_MOVE_SPEED,
  moveTrack: 'middle',
  targetMode: 'loop',
  targetLoop: false,
  appearanceDelayMs: 0,
  hideAfterTarget: false,
  audioTrigger: 'appearance',
  audioDelayMs: 0,
  backgroundIds: normalizeInitialDynamicItemBackgroundIds(group, initialBackgroundIds),
  isVisible: true,
  order: group.items.length,
  createdAt: now,
  updatedAt: now
})

const addDynamicBubble = async (
  groupId: string,
  input: DynamicBubbleInput,
  initialBackgroundIds?: string | string[]
) => {
  const bubbleType = normalizeDynamicBubbleType(input.bubbleType)
  let image: DynamicMedia | undefined
  if (bubbleType === 'thought' && input.imageFile) {
    image = await persistDynamicMedia(input.imageFile, `${groupId}/bubble-images`)
    if (image.type !== 'image') {
      await deleteDynamicMedia(image)
      throw new Error('Thought bubble media must be an image')
    }
  }

  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group || group.items.length >= MAX_DYNAMIC_ITEMS_PER_GROUP) {
    if (image) await deleteDynamicMedia(image)
    return undefined
  }

  const now = Date.now()
  const nameFallback = bubbleType === 'title'
    ? input.bodyText.trim() || input.title.trim()
    : input.title.trim()
  const item: DynamicBubbleItem = {
    ...createDynamicItemBase(
      group,
      input.name?.trim() || nameFallback || '气泡',
      now,
      initialBackgroundIds
    ),
    kind: 'bubble',
    bubble: normalizeDynamicBubbleContent({
      schemaVersion: 2,
      bubbleType,
      styleId: input.styleId,
      title: input.title,
      bodyText: input.bodyText,
      revealMode: input.revealMode,
      revealIntervalMs: input.revealIntervalMs,
      fontSizePx: input.fontSizePx,
      textColor: input.textColor,
      surfaceColor: input.surfaceColor,
      outlineColor: input.outlineColor,
      surfaceId: input.surfaceId,
      titleMaskId: input.titleMaskId,
      paletteId: input.paletteId,
      maskColor: input.maskColor,
      maskOpacity: input.maskOpacity,
      widthPx: input.widthPx,
      heightPx: input.heightPx
    }, image)
  }

  group.items.push(item)
  group.updatedAt = now
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const updateDynamicBubble = async (
  groupId: string,
  itemId: string,
  input: DynamicBubbleInput
) => {
  const bubbleType = normalizeDynamicBubbleType(input.bubbleType)
  let nextImage: DynamicMedia | undefined
  if (bubbleType === 'thought' && input.imageFile) {
    nextImage = await persistDynamicMedia(input.imageFile, `${groupId}/bubble-images`)
    if (nextImage.type !== 'image') {
      await deleteDynamicMedia(nextImage)
      throw new Error('Thought bubble media must be an image')
    }
  }

  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) {
    if (nextImage) await deleteDynamicMedia(nextImage)
    return undefined
  }

  const item = group.items.find((nextItem) => nextItem.id === itemId)
  if (!item || !isDynamicBubbleItem(item)) {
    if (nextImage) await deleteDynamicMedia(nextImage)
    return undefined
  }

  const previousImage = item.bubble.image
  let image = bubbleType === 'thought' && !input.removeImage && input.imageFile !== null
    ? previousImage
    : undefined
  if (nextImage) image = nextImage

  const nameFallback = bubbleType === 'title'
    ? input.bodyText.trim() || input.title.trim()
    : input.title.trim()
  item.name = input.name?.trim() || nameFallback || item.name || '气泡'
  item.bubble = normalizeDynamicBubbleContent({
    schemaVersion: 2,
    bubbleType,
    styleId: input.styleId,
    title: input.title,
    bodyText: input.bodyText,
    revealMode: input.revealMode,
    revealIntervalMs: input.revealIntervalMs,
    fontSizePx: input.fontSizePx,
    textColor: input.textColor,
    surfaceColor: input.surfaceColor ?? item.bubble.surfaceColor,
    outlineColor: input.outlineColor ?? item.bubble.outlineColor,
    surfaceId: input.surfaceId,
    titleMaskId: input.titleMaskId ?? item.bubble.titleMaskId,
    paletteId: input.paletteId,
    maskColor: input.maskColor ?? item.bubble.maskColor,
    maskOpacity: input.maskOpacity ?? item.bubble.maskOpacity,
    widthPx: input.widthPx,
    heightPx: input.heightPx
  }, image)
  item.updatedAt = Date.now()
  group.updatedAt = item.updatedAt
  saveDynamicGroups(groups)

  if (
    previousImage
    && previousImage.id !== image?.id
    && !isMediaUsedByOtherEntity(groups, groupId, itemId, previousImage.id)
  ) {
    await deleteDynamicMedia(previousImage)
  }

  return hydrateGroup(group)
}

const updateDynamicItem = (groupId: string, itemId: string, updater: (item: DynamicItem) => DynamicItem) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  group.items = normalizeDynamicIndependentAppearance(group.items.map((item) => (
    item.id === itemId ? { ...updater(item), updatedAt: Date.now() } : item
  )))
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return group
}

const deleteDynamicItems = async (groupId: string, itemIds: string[]) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group || itemIds.length === 0) return undefined

  const deleteSet = new Set(itemIds)
  const deletedItems = group.items.filter((item) => deleteSet.has(item.id))
  if (deletedItems.length === 0) return hydrateGroup(group)

  group.items = group.items
    .filter((item) => !deleteSet.has(item.id))
    .map((nextItem, index) => ({
      ...nextItem,
      linkedAppearance: nextItem.linkedAppearance && deleteSet.has(nextItem.linkedAppearance.triggerItemId)
        ? undefined
        : nextItem.linkedAppearance,
      order: index,
      updatedAt: Date.now()
    }))

  const remainingMediaIds = new Set(
    groups.flatMap((nextGroup) => collectDynamicGroupMedia(nextGroup).map((media) => media.id))
  )
  const deletedMedia = Array.from(new Map(
    deletedItems.flatMap((item) => [
      getDynamicItemMedia(item),
      getDynamicItemBubbleImage(item)
    ])
      .filter((media): media is DynamicMedia => Boolean(media))
      .map((media) => [media.id, media])
  ).values())
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  await Promise.all(
    deletedMedia
      .filter((media) => !remainingMediaIds.has(media.id))
      .map(deleteDynamicMedia)
  )
  return hydrateGroup(group)
}

const deleteDynamicItem = async (groupId: string, itemId: string) => deleteDynamicItems(groupId, [itemId])

const copyDynamicItemSettings = async (
  groupId: string,
  targetItemId: string,
  sourceItemId: string,
  copyFields: DynamicCopyField[] = ['motion', 'animation', 'size', 'deform', 'audio', 'background', 'linkage'],
  currentGroup?: DynamicGroup
) => {
  const groups = loadRawGroups()
  const groupIndex = groups.findIndex((item) => item.id === groupId)
  const storedGroup = groupIndex >= 0 ? groups[groupIndex] : undefined
  const group = currentGroup?.id === groupId
    ? mergeGroupPersistentMedia(currentGroup, storedGroup)
    : storedGroup
  if (!group) return undefined

  const source = group.items.find((item) => item.id === sourceItemId)
  const target = group.items.find((item) => item.id === targetItemId)
  if (!source || !target) return undefined

  const fieldSet = new Set(copyFields)
  const sourceTrack = source.moveTrack ?? getDynamicMoveTrackFromPosition(source.position.y)
  const sourceAppearanceByBackground = normalizeDynamicAppearanceByBackground(source.appearanceByBackground)
  group.items = group.items.map((item) => {
    if (item.id !== targetItemId) return item
    const position = fieldSet.has('motion')
      ? { ...source.position }
      : item.position
    return {
      ...item,
      position,
      gridIndex: calculateGridIndex(position.x, position.y),
      scale: fieldSet.has('size') ? source.scale : item.scale,
      rotation: fieldSet.has('size') ? source.rotation : item.rotation,
      flipX: fieldSet.has('deform') ? source.flipX ?? false : item.flipX,
      flipY: fieldSet.has('deform') ? source.flipY ?? false : item.flipY,
      animationMode: fieldSet.has('animation')
        ? normalizeDynamicAnimationMode(source.animationMode, source.animationId)
        : normalizeDynamicAnimationMode(item.animationMode, item.animationId),
      animationId: fieldSet.has('animation') ? source.animationId : item.animationId,
      clickAnimationIds: fieldSet.has('animation')
        ? getDynamicClickAnimationIds(source)
        : normalizeDynamicClickAnimationIds(item.clickAnimationIds, !Array.isArray(item.clickAnimationIds)),
      moveMode: fieldSet.has('motion') ? source.moveMode : item.moveMode,
      movePercent: fieldSet.has('motion') ? source.movePercent : item.movePercent,
      moveSpeed: fieldSet.has('motion') ? getDynamicMoveSpeedFromItem(source) : item.moveSpeed,
      moveTrack: fieldSet.has('motion') ? sourceTrack : item.moveTrack,
      targetMode: fieldSet.has('motion') ? getDynamicTargetModeFromItem(source) : item.targetMode,
      targetLoop: fieldSet.has('motion') ? source.targetLoop === true : item.targetLoop,
      targetPosition: fieldSet.has('motion')
        ? source.targetPosition ? { ...source.targetPosition } : undefined
        : item.targetPosition,
      appearanceDelayMs: fieldSet.has('motion')
        ? normalizeDynamicAppearanceTimeMs(source.appearanceDelayMs)
        : item.appearanceDelayMs,
      appearanceHideMs: fieldSet.has('motion')
        ? source.appearanceHideMs
        : item.appearanceHideMs,
      appearanceByBackground: fieldSet.has('motion')
        ? Object.keys(sourceAppearanceByBackground).length > 0
          ? sourceAppearanceByBackground
          : undefined
        : item.appearanceByBackground,
      hideAfterTarget: fieldSet.has('motion')
        ? source.hideAfterTarget === true
        : item.hideAfterTarget,
      audioId: fieldSet.has('audio') ? source.audioId : item.audioId,
      audioTrigger: fieldSet.has('audio') ? getDynamicAudioTriggerFromItem(source) : item.audioTrigger,
      audioDelayMs: fieldSet.has('audio')
        ? Math.max(0, Math.round(Number(source.audioDelayMs) || 0))
        : item.audioDelayMs,
      backgroundIds: fieldSet.has('background')
        ? Array.from(new Set(source.backgroundIds ?? []))
        : item.backgroundIds,
      linkedAppearance: undefined,
      updatedAt: Date.now()
    }
  })
  group.items = normalizeDynamicIndependentAppearance(group.items)
  group.updatedAt = Date.now()

  if (groupIndex >= 0) {
    groups[groupIndex] = group
  } else {
    groups.unshift(group)
  }

  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const reorderDynamicItems = (
  groupId: string,
  orderedItemIdsFromFront: string[],
  currentGroup?: DynamicGroup
) => {
  const groups = loadRawGroups()
  const groupIndex = groups.findIndex((item) => item.id === groupId)
  const storedGroup = groupIndex >= 0 ? groups[groupIndex] : undefined
  const group = currentGroup?.id === groupId
    ? mergeGroupPersistentMedia(currentGroup, storedGroup)
    : storedGroup
  if (!group) return undefined

  const validIds = new Set(group.items.map((item) => item.id))
  const orderedIds = orderedItemIdsFromFront.filter((itemId) => validIds.has(itemId))
  group.items.forEach((item) => {
    if (!orderedIds.includes(item.id)) orderedIds.push(item.id)
  })

  const orderById = new Map(
    orderedIds.map((itemId, index) => [itemId, orderedIds.length - 1 - index])
  )
  group.items = group.items.map((item) => ({
    ...item,
    order: orderById.get(item.id) ?? item.order,
    updatedAt: Date.now()
  }))
  group.updatedAt = Date.now()

  if (groupIndex >= 0) {
    groups[groupIndex] = group
  } else {
    groups.unshift(group)
  }
  saveDynamicGroups(groups)
  return group
}

const updateDynamicGroupAppearMode = (
  groupId: string,
  appearMode: DynamicAppearMode,
  appearIntervalMs?: number
) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  group.appearMode = appearMode
  group.appearIntervalMs = getDynamicAppearIntervalFromGroup({
    ...group,
    appearIntervalMs: appearIntervalMs ?? group.appearIntervalMs
  })
  const now = Date.now()
  const sequenceIndexById = new Map(
    [...group.items]
      .sort((left, right) => left.order - right.order)
      .map((item, index) => [item.id, index])
  )
  group.items = group.items.map((item) => ({
    ...item,
    appearanceDelayMs: appearMode === 'sequence'
      ? (sequenceIndexById.get(item.id) ?? 0) * group.appearIntervalMs
      : 0,
    linkedAppearance: undefined,
    updatedAt: now
  }))
  group.updatedAt = now
  saveDynamicGroups(groups)
  return group
}

const updateDynamicBackgroundPlayback = (
  groupId: string,
  backgroundPlayMode: DynamicBackgroundPlayMode,
  backgroundIntervalMs?: number,
  backgroundPlaybackLoop?: boolean
) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  group.backgroundPlayMode = backgroundPlayMode
  group.backgroundIntervalMs = getDynamicBackgroundIntervalFromGroup({
    ...group,
    backgroundIntervalMs: backgroundIntervalMs ?? group.backgroundIntervalMs
  })
  group.backgroundPlaybackLoop = getDynamicBackgroundPlaybackLoopFromGroup({
    ...group,
    backgroundPlaybackLoop: backgroundPlaybackLoop ?? group.backgroundPlaybackLoop
  })
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return group
}

const updateDynamicAdvancedPlayback = (
  groupId: string,
  values: {
    appearAnimation?: DynamicAppearAnimation
    backgroundTransition?: DynamicBackgroundTransition
  }
) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  if (values.appearAnimation !== undefined) {
    const appearAnimation = getDynamicAppearAnimationFromGroup({
      ...group,
      appearAnimation: values.appearAnimation
    })
    group.appearAnimation = appearAnimation
  }
  if (values.backgroundTransition !== undefined) {
    group.backgroundTransition = getDynamicBackgroundTransitionFromGroup({
      ...group,
      backgroundTransition: values.backgroundTransition
    })
  }
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return group
}

const addDynamicAudio = async (groupId: string, file: File) => {
  const nextAudio = await persistDynamicAudio(file, `${groupId}/audio`)
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) {
    await deleteDynamicMedia(nextAudio)
    return undefined
  }

  group.audioLibrary = [nextAudio, ...(group.audioLibrary ?? []).filter((item) => item.id !== nextAudio.id)]
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const setDynamicBackgroundBgm = async (groupId: string, backgroundIds: string[], audioId?: string) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const backgroundIdSet = new Set(backgroundIds)
  const validAudioId = audioId && group.audioLibrary?.some((audio) => audio.id === audioId)
    ? audioId
    : undefined
  group.backgrounds = getGroupBackgrounds(group).map((background) => (
    backgroundIdSet.has(background.id)
      ? { ...background, bgmAudioId: validAudioId }
      : background
  ))
  const activeBackground = getActiveBackground(group, group.backgrounds)
  group.background = activeBackground
  group.activeBackgroundId = activeBackground?.id
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const setDynamicBackgroundTransition = async (
  groupId: string,
  backgroundTransition: DynamicBackgroundTransition
) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const normalizedTransition = getDynamicBackgroundTransitionFromGroup({
    ...group,
    backgroundTransition
  })
  group.backgroundTransition = normalizedTransition
  group.backgrounds = getGroupBackgrounds(group).map((background) => (
    { ...background, backgroundTransition: normalizedTransition, appearAnimation: undefined }
  ))
  const activeBackground = getActiveBackground(group, group.backgrounds)
  group.background = activeBackground
  group.activeBackgroundId = activeBackground?.id
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const deleteDynamicAudio = async (groupId: string, audioId: string) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const audio = group.audioLibrary?.find((item) => item.id === audioId)
  if (!audio) return hydrateGroup(group)

  group.audioLibrary = (group.audioLibrary ?? []).filter((item) => item.id !== audioId)
  group.backgrounds = getGroupBackgrounds(group).map((background) => (
    background.bgmAudioId === audioId ? { ...background, bgmAudioId: undefined } : background
  ))
  const activeBackground = getActiveBackground(group, group.backgrounds)
  group.background = activeBackground
  group.activeBackgroundId = activeBackground?.id
  group.items = group.items.map((item) => (
    item.audioId === audioId ? { ...item, audioId: undefined } : item
  ))
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  await deleteDynamicMedia(audio)
  return hydrateGroup(group)
}

export type {
  DynamicAppearMode,
  DynamicAppearAnimation,
  DynamicAnimationMode,
  DynamicAppearanceTiming,
  DynamicAudioMedia,
  DynamicBackground,
  DynamicBackgroundAppearance,
  DynamicBackgroundPlayMode,
  DynamicBackgroundPlaybackLoop,
  DynamicBackgroundTransition,
  DynamicBubbleContent,
  DynamicBubbleInput,
  DynamicBubbleItem,
  DynamicBubblePaletteId,
  DynamicBubbleRevealMode,
  DynamicBubbleStyleId,
  DynamicBubbleTitleMaskId,
  DynamicBubbleType,
  DynamicCopyField,
  DynamicGroup,
  DynamicGroupOrganization,
  DynamicItem,
  DynamicItemAudioTrigger,
  DynamicItemKind,
  DynamicLinkedAppearance,
  DynamicLinkedAppearanceMode,
  DynamicMedia,
  DynamicMediaItem,
  DynamicMediaType,
  DynamicMoveMode,
  DynamicMoveTrack,
  DynamicTargetMode
}
export {
  DYNAMIC_DIALOGUE_BUBBLE_STYLE_IDS,
  DYNAMIC_GROUPS_KEY,
  DYNAMIC_THOUGHT_BUBBLE_STYLE_IDS,
  DYNAMIC_TITLE_BUBBLE_STYLE_IDS,
  DYNAMIC_BUBBLE_TITLE_MASK_IDS,
  DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS,
  DEFAULT_DYNAMIC_BUBBLE_REVEAL_INTERVAL_MS,
  DEFAULT_DYNAMIC_BACKGROUND_INTERVAL_MS,
  DEFAULT_DYNAMIC_BACKGROUND_PLAYBACK_LOOP,
  MAX_DYNAMIC_BACKGROUND_INTERVAL_MS,
  MAX_DYNAMIC_APPEAR_INTERVAL_MS,
  MAX_DYNAMIC_ITEMS_PER_GROUP,
  MIN_DYNAMIC_APPEAR_INTERVAL_MS,
  MIN_DYNAMIC_BACKGROUND_INTERVAL_MS,
  addDynamicBubble,
  addDynamicItem,
  addDynamicAudio,
  calculateGridIndex,
  copyDynamicItemSettings,
  createDynamicGroup,
  deleteDynamicBackgrounds,
  deleteDynamicGroup,
  deleteDynamicItem,
  deleteDynamicItems,
  deleteDynamicAudio,
  getDynamicMoveTrackCenter,
  getDynamicMoveTrackFromPosition,
  getDynamicItemBubbleImage,
  getDynamicItemMedia,
  getDynamicMediaFile,
  isDynamicBubbleItem,
  isDynamicMediaItem,
  loadDynamicGroups,
  normalizeDynamicBackgroundPlaybackLoop,
  normalizeDynamicAudioFile,
  persistDynamicAudio,
  persistDynamicMedia,
  reorderDynamicBackgrounds,
  reorderDynamicItems,
  saveDynamicGroups,
  setActiveDynamicBackground,
  setDynamicBackground,
  setDynamicBackgroundTransition,
  setDynamicBackgroundBgm,
  updateDynamicAdvancedPlayback,
  updateDynamicGroupAppearMode,
  updateDynamicBackgroundPlayback,
  updateDynamicGroupMeta,
  updateDynamicGroupOrganization,
  updateDynamicItemMeta,
  updateDynamicItem,
  updateDynamicBubble,
  upsertDynamicGroup
}
