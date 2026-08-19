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
  normalizeDynamicAppearAnimation,
  normalizeDynamicLinkedAppearance,
  synchronizeDynamicLinkedBackgrounds,
  wouldCreateDynamicLinkedAppearanceCycle
} from '../../desktop-runtime/renderer/advanced-appearance-timeline.js'

const DYNAMIC_GROUPS_KEY = 'magicfloor_dynamic_groups_v1'
const DYNAMIC_DB_NAME = 'magicfloor_dynamic_media'
const DYNAMIC_DB_VERSION = 1
const DYNAMIC_STORE_NAME = 'media'
const DYNAMIC_DIRECTORY = Directory.Data
const DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION = 3
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
const DYNAMIC_DIALOGUE_BUBBLE_STYLE_IDS = ['dialogue-rounded', 'dialogue-soft', 'dialogue-comic'] as const
const DYNAMIC_THOUGHT_BUBBLE_STYLE_IDS = ['thought-cloud', 'thought-soft'] as const

type DynamicMediaType = 'image' | 'video'
type DynamicStoredMediaType = DynamicMediaType | 'audio'
type DynamicMoveMode = 'none' | 'verticalWave' | 'left' | 'right' | 'orbit' | 'random'
type DynamicMoveTrack = 'top' | 'middle' | 'bottom'
type DynamicAppearMode = 'sequence' | 'all'
type DynamicAppearAnimation = 'none' | 'drop' | 'trackSlide'
type DynamicBackgroundPlayMode = 'fixed' | 'random' | 'sequence'
type DynamicBackgroundTransition = 'none' | 'curtain' | 'cameraFlash' | 'shadowPlay'
type DynamicTargetMode = 'loop' | 'target'
type DynamicItemAudioTrigger = 'appearance' | 'appearanceDelay' | 'targetArrival'
type DynamicLinkedAppearanceMode = 'none' | 'showAfter' | 'hideAfter'
type DynamicCopyField = 'motion' | 'animation' | 'size' | 'deform' | 'audio' | 'background' | 'linkage'
type DynamicItemKind = 'media' | 'bubble'
type DynamicBubbleType = 'dialogue' | 'thought'
type DynamicBubbleRevealMode = 'all' | 'typewriter'
type DynamicBubbleStyleId = typeof DYNAMIC_DIALOGUE_BUBBLE_STYLE_IDS[number]
  | typeof DYNAMIC_THOUGHT_BUBBLE_STYLE_IDS[number]
type DynamicBubblePaletteId = 'ink' | 'ocean' | 'coral' | 'sun' | 'violet'

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

type DynamicStoredMedia = DynamicMedia | DynamicAudioMedia

interface DynamicBackground extends DynamicMedia {
  bgmAudioId?: string
  backgroundTransition?: DynamicBackgroundTransition
}

interface DynamicBubbleContent {
  schemaVersion: 1
  bubbleType: DynamicBubbleType
  styleId: DynamicBubbleStyleId
  title: string
  bodyText: string
  revealMode: DynamicBubbleRevealMode
  revealIntervalMs: number
  fontSizePx: number
  textColor: string
  surfaceId: string
  paletteId: DynamicBubblePaletteId
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
  surfaceId?: string
  paletteId: DynamicBubblePaletteId
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
  value === 'thought' ? 'thought' : 'dialogue'
)

const normalizeDynamicBubbleStyleId = (bubbleType: DynamicBubbleType, value: unknown): DynamicBubbleStyleId => {
  const styleId = typeof value === 'string' ? value.trim() : ''
  const allowedStyleIds: readonly string[] = bubbleType === 'thought'
    ? DYNAMIC_THOUGHT_BUBBLE_STYLE_IDS
    : DYNAMIC_DIALOGUE_BUBBLE_STYLE_IDS
  return (allowedStyleIds.includes(styleId) ? styleId : allowedStyleIds[0]) as DynamicBubbleStyleId
}

const normalizeDynamicBubblePaletteId = (
  bubbleType: DynamicBubbleType,
  value: unknown
): DynamicBubblePaletteId => {
  if (value === 'ink' || value === 'ocean' || value === 'coral' || value === 'sun' || value === 'violet') {
    return value
  }
  return bubbleType === 'thought' ? 'ink' : 'ocean'
}

const normalizeDynamicBubbleContent = (
  bubble: Partial<DynamicBubbleContent> | undefined,
  image?: DynamicMedia
): DynamicBubbleContent => {
  const bubbleType = normalizeDynamicBubbleType(bubble?.bubbleType)
  return {
    schemaVersion: 1,
    bubbleType,
    styleId: normalizeDynamicBubbleStyleId(bubbleType, bubble?.styleId),
    title: typeof bubble?.title === 'string' ? bubble.title : '',
    bodyText: typeof bubble?.bodyText === 'string' ? bubble.bodyText : '',
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
    surfaceId: typeof bubble?.surfaceId === 'string' && bubble.surfaceId.trim()
      ? bubble.surfaceId.trim()
      : 'light',
    paletteId: normalizeDynamicBubblePaletteId(bubbleType, bubble?.paletteId),
    widthPx: clampRoundedNumber(
      bubble?.widthPx,
      MIN_DYNAMIC_BUBBLE_WIDTH_PX,
      MAX_DYNAMIC_BUBBLE_WIDTH_PX,
      bubbleType === 'thought' ? 940 : 1080
    ),
    heightPx: clampRoundedNumber(
      bubble?.heightPx,
      MIN_DYNAMIC_BUBBLE_HEIGHT_PX,
      MAX_DYNAMIC_BUBBLE_HEIGHT_PX,
      bubbleType === 'thought' ? 680 : 480
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

const getDynamicBackgroundTransitionFromBackground = (
  background: DynamicBackground,
  fallback: DynamicBackgroundTransition = 'none'
): DynamicBackgroundTransition => {
  if (
    background.backgroundTransition === 'curtain'
    || background.backgroundTransition === 'cameraFlash'
    || background.backgroundTransition === 'shadowPlay'
  ) {
    return background.backgroundTransition
  }
  return background.backgroundTransition === 'none' ? 'none' : fallback
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

const normalizeDynamicItemLinks = (items: DynamicItem[]) => {
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

  return synchronizeDynamicLinkedBackgrounds(validatedItems)
}

const migrateDynamicLinkedAppearanceModel = (group: DynamicGroup): DynamicGroup => {
  const sourceItems = Array.isArray(group.items) ? group.items : []
  if (group.linkedAppearanceModelVersion === DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION) {
    return {
      ...group,
      items: normalizeDynamicItemLinks(sourceItems)
    }
  }

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

  return {
    ...group,
    linkedAppearanceModelVersion: DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION,
    items: normalizeDynamicItemLinks(migratedItems)
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
    return groups.map((group) => migrateDynamicLinkedAppearanceModel({
      ...group,
      items: Array.isArray(group.items) ? group.items.map(normalizeDynamicItemKind) : []
    }))
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
  if (isDynamicBubbleItem(item)) {
    return {
      ...item,
      kind: 'bubble',
      bubble: {
        ...item.bubble,
        image: serializeMediaForStorage(item.bubble.image)
      }
    }
  }

  return {
    ...item,
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
  const storageGroups = groups.map(serializeGroupForStorage)
  localStorage.setItem(DYNAMIC_GROUPS_KEY, JSON.stringify(storageGroups))
}

const getGroupBackgrounds = (group: DynamicGroup) => {
  if (group.backgrounds?.length) return group.backgrounds
  return group.background ? [group.background] : []
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
  return backgrounds.find((background) => background.id === group.activeBackgroundId)
    ?? group.background
    ?? backgrounds[0]
}

const hydrateGroup = async (group: DynamicGroup): Promise<DynamicGroup> => {
  const sourceBackgrounds = getGroupBackgrounds(group)
  const groupAppearAnimation = getDynamicAppearAnimationFromGroup(group)
  const groupBackgroundTransition = getDynamicBackgroundTransitionFromGroup(group)
  const [thumbnail, resolvedBackgrounds, audioLibrary, resolvedItems] = await Promise.all([
    group.thumbnail ? resolveMediaUrl(group.thumbnail) : Promise.resolve(undefined),
    Promise.all(sourceBackgrounds.map(async (background) => ({
      ...await resolveMediaUrl(background),
      backgroundTransition: getDynamicBackgroundTransitionFromBackground(background, groupBackgroundTransition),
      appearAnimation: undefined
    }))),
    Promise.all((group.audioLibrary ?? []).map(async (audio) => (
      await resolveMediaUrl(audio) as DynamicAudioMedia
    ))),
    Promise.all(group.items.map(async (sourceItem): Promise<DynamicItem> => {
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
  const items = normalizeDynamicItemLinks(resolvedItems)

  const background = getActiveBackground(group, backgrounds)

  return {
    ...group,
    thumbnail,
    background,
    backgrounds,
    activeBackgroundId: background?.id,
    backgroundPlayMode: getDynamicBackgroundPlayModeFromGroup(group),
    backgroundIntervalMs: getDynamicBackgroundIntervalFromGroup(group),
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

  const groups = loadRawGroups()
  const nextGroups = [nextGroup, ...groups]
  saveDynamicGroups(nextGroups)
  return hydrateGroup(nextGroup)
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
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const previousThumbnail = group.thumbnail
  group.name = values.name.trim() || group.name || '未命名作品檔案'

  if (values.thumbnailFile) {
    group.thumbnail = await persistDynamicMedia(values.thumbnailFile, `${groupId}/thumbnail`)

    if (
      previousThumbnail
      && previousThumbnail.id !== group.thumbnail.id
      && !isMediaUsedByOtherGroups(groups, groupId, previousThumbnail.id)
    ) {
      await deleteDynamicMedia(previousThumbnail)
    }
  }

  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const deleteDynamicGroup = async (groupId: string) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return loadDynamicGroups()

  await Promise.all(
    collectDynamicGroupMedia(group)
      .filter((media) => !isMediaUsedByOtherGroups(groups, groupId, media.id))
      .map(deleteDynamicMedia)
  )

  const nextGroups = groups.filter((item) => item.id !== groupId)
  saveDynamicGroups(nextGroups)
  return Promise.all(nextGroups.map(hydrateGroup))
}

const upsertDynamicGroup = (group: DynamicGroup) => {
  const groups = loadRawGroups()
  const index = groups.findIndex((item) => item.id === group.id)
  const existingGroup = index >= 0 ? groups[index] : undefined
  const nextGroup = mergeGroupPersistentMedia({
    ...group,
    backgroundPlayMode: getDynamicBackgroundPlayModeFromGroup(group),
    backgroundIntervalMs: getDynamicBackgroundIntervalFromGroup(group),
    appearIntervalMs: getDynamicAppearIntervalFromGroup(group),
    appearAnimation: getDynamicAppearAnimationFromGroup(group),
    backgroundTransition: getDynamicBackgroundTransitionFromGroup(group),
    audioLibrary: group.audioLibrary ?? [],
    items: normalizeDynamicItemLinks(group.items),
    linkedAppearanceModelVersion: DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION,
    updatedAt: Date.now()
  }, existingGroup)

  if (index >= 0) {
    groups[index] = nextGroup
  } else {
    groups.unshift(nextGroup)
  }

  saveDynamicGroups(groups)
  return nextGroup
}

const setDynamicBackground = async (groupId: string, file: File) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const persistedBackground = await persistDynamicMedia(file, `${groupId}/background`) as DynamicBackground
  const background: DynamicBackground = {
    ...persistedBackground,
    backgroundTransition: getDynamicBackgroundTransitionFromGroup(group)
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

  await Promise.all(
    currentBackgrounds
      .filter((background) => deleteSet.has(background.id))
      .map(async (background) => {
        if (!isMediaUsedByOtherGroups(groups, groupId, background.id)) {
          await deleteDynamicMedia(background)
        }
      })
  )

  const activeBackground = remainingBackgrounds.find((background) => background.id === group.activeBackgroundId)
    ?? remainingBackgrounds[0]

  group.backgrounds = remainingBackgrounds
  group.background = activeBackground
  group.activeBackgroundId = activeBackground?.id
  group.items = group.items.map((item) => {
    if (!Array.isArray(item.backgroundIds) || item.backgroundIds.length === 0) return item
    const backgroundIds = item.backgroundIds.filter((backgroundId) => !deleteSet.has(backgroundId))
    return {
      ...item,
      // An empty list deliberately falls back to "all backgrounds".
      backgroundIds,
      updatedAt: Date.now()
    }
  })
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
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
  const activeBackground = backgrounds.find((background) => background.id === group.activeBackgroundId)
    ?? backgrounds.find((background) => background.id === group.background?.id)
    ?? backgrounds[0]

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

const addDynamicItem = async (groupId: string, file: File, itemName?: string) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group || group.items.length >= MAX_DYNAMIC_ITEMS_PER_GROUP) return undefined

  const media = await persistDynamicMedia(file, `${groupId}/items`)
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
    audioTrigger: 'appearance',
    audioDelayMs: 0,
    backgroundIds: [],
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
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const item = group.items.find((nextItem) => nextItem.id === itemId)
  if (!item || !isDynamicMediaItem(item)) return undefined

  const previousMedia = item.media
  item.name = values.name.trim() || item.name || values.file?.name || '未命名物件'

  if (values.file) {
    item.media = await persistDynamicMedia(values.file, `${groupId}/items`)

    if (
      previousMedia.id !== item.media.id
      && !isMediaUsedByOtherEntity(groups, groupId, itemId, previousMedia.id)
    ) {
      await deleteDynamicMedia(previousMedia)
    }
  }

  item.updatedAt = Date.now()
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const createDynamicItemBase = (
  group: DynamicGroup,
  name: string,
  now: number
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
  audioTrigger: 'appearance',
  audioDelayMs: 0,
  backgroundIds: [],
  isVisible: true,
  order: group.items.length,
  createdAt: now,
  updatedAt: now
})

const addDynamicBubble = async (groupId: string, input: DynamicBubbleInput) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group || group.items.length >= MAX_DYNAMIC_ITEMS_PER_GROUP) return undefined

  const bubbleType = normalizeDynamicBubbleType(input.bubbleType)
  let image: DynamicMedia | undefined
  if (bubbleType === 'thought' && input.imageFile) {
    image = await persistDynamicMedia(input.imageFile, `${groupId}/bubble-images`)
    if (image.type !== 'image') {
      await deleteDynamicMedia(image)
      throw new Error('Thought bubble media must be an image')
    }
  }

  const now = Date.now()
  const item: DynamicBubbleItem = {
    ...createDynamicItemBase(group, input.name?.trim() || input.title.trim() || '气泡', now),
    kind: 'bubble',
    bubble: normalizeDynamicBubbleContent({
      schemaVersion: 1,
      bubbleType,
      styleId: input.styleId,
      title: input.title,
      bodyText: input.bodyText,
      revealMode: input.revealMode,
      revealIntervalMs: input.revealIntervalMs,
      fontSizePx: input.fontSizePx,
      textColor: input.textColor,
      surfaceId: input.surfaceId,
      paletteId: input.paletteId,
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
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const item = group.items.find((nextItem) => nextItem.id === itemId)
  if (!item || !isDynamicBubbleItem(item)) return undefined

  const previousImage = item.bubble.image
  const bubbleType = normalizeDynamicBubbleType(input.bubbleType)
  let image = bubbleType === 'thought' && !input.removeImage && input.imageFile !== null
    ? previousImage
    : undefined

  if (bubbleType === 'thought' && input.imageFile) {
    const nextImage = await persistDynamicMedia(input.imageFile, `${groupId}/bubble-images`)
    if (nextImage.type !== 'image') {
      await deleteDynamicMedia(nextImage)
      throw new Error('Thought bubble media must be an image')
    }
    image = nextImage
  }

  item.name = input.name?.trim() || input.title.trim() || item.name || '气泡'
  item.bubble = normalizeDynamicBubbleContent({
    schemaVersion: 1,
    bubbleType,
    styleId: input.styleId,
    title: input.title,
    bodyText: input.bodyText,
    revealMode: input.revealMode,
    revealIntervalMs: input.revealIntervalMs,
    fontSizePx: input.fontSizePx,
    textColor: input.textColor,
    surfaceId: input.surfaceId,
    paletteId: input.paletteId,
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

  group.items = normalizeDynamicItemLinks(group.items.map((item) => (
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
  await Promise.all(
    deletedMedia
      .filter((media) => !remainingMediaIds.has(media.id))
      .map(deleteDynamicMedia)
  )

  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
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
  const canCopyLinkage = !source.linkedAppearance || !wouldCreateDynamicLinkedAppearanceCycle(
    group.items,
    targetItemId,
    source.linkedAppearance.triggerItemId
  )
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
      audioId: fieldSet.has('audio') ? source.audioId : item.audioId,
      audioTrigger: fieldSet.has('audio') ? getDynamicAudioTriggerFromItem(source) : item.audioTrigger,
      audioDelayMs: fieldSet.has('audio')
        ? Math.max(0, Math.round(Number(source.audioDelayMs) || 0))
        : item.audioDelayMs,
      backgroundIds: fieldSet.has('background')
        ? Array.from(new Set(source.backgroundIds ?? []))
        : item.backgroundIds,
      linkedAppearance: fieldSet.has('linkage') && canCopyLinkage
        ? source.linkedAppearance ? { ...source.linkedAppearance } : undefined
        : item.linkedAppearance,
      updatedAt: Date.now()
    }
  })
  group.items = normalizeDynamicItemLinks(group.items)
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
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return group
}

const updateDynamicBackgroundPlayback = (
  groupId: string,
  backgroundPlayMode: DynamicBackgroundPlayMode,
  backgroundIntervalMs?: number
) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  group.backgroundPlayMode = backgroundPlayMode
  group.backgroundIntervalMs = getDynamicBackgroundIntervalFromGroup({
    ...group,
    backgroundIntervalMs: backgroundIntervalMs ?? group.backgroundIntervalMs
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
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const nextAudio = await persistDynamicAudio(file, `${groupId}/audio`)
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
  group.background = group.backgrounds.find((background) => background.id === group.activeBackgroundId)
    ?? group.backgrounds[0]
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const setDynamicBackgroundTransition = async (
  groupId: string,
  backgroundIds: string[],
  backgroundTransition: DynamicBackgroundTransition
) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const backgroundIdSet = new Set(backgroundIds)
  const normalizedTransition = getDynamicBackgroundTransitionFromGroup({
    ...group,
    backgroundTransition
  })
  group.backgrounds = getGroupBackgrounds(group).map((background) => (
    backgroundIdSet.has(background.id)
      ? { ...background, backgroundTransition: normalizedTransition, appearAnimation: undefined }
      : background
  ))
  group.background = group.backgrounds.find((background) => background.id === group.activeBackgroundId)
    ?? group.backgrounds[0]
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
  group.background = group.backgrounds.find((background) => background.id === group.activeBackgroundId)
    ?? group.backgrounds[0]
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
  DynamicAudioMedia,
  DynamicBackground,
  DynamicBackgroundPlayMode,
  DynamicBackgroundTransition,
  DynamicBubbleContent,
  DynamicBubbleInput,
  DynamicBubbleItem,
  DynamicBubblePaletteId,
  DynamicBubbleRevealMode,
  DynamicBubbleStyleId,
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
  DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS,
  DEFAULT_DYNAMIC_BUBBLE_REVEAL_INTERVAL_MS,
  DEFAULT_DYNAMIC_BACKGROUND_INTERVAL_MS,
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
