import { useEffect, useRef, useState } from 'react'
import {
  MAX_DYNAMIC_ITEMS_PER_GROUP,
  addDynamicItem,
  calculateGridIndex,
  copyDynamicItemSettings,
  DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS,
  deleteDynamicBackgrounds,
  deleteDynamicItem,
  getDynamicMoveTrackCenter,
  getDynamicMoveTrackFromPosition,
  MAX_DYNAMIC_APPEAR_INTERVAL_MS,
  MIN_DYNAMIC_APPEAR_INTERVAL_MS,
  setActiveDynamicBackground,
  setDynamicBackground,
  updateDynamicGroupAppearMode,
  upsertDynamicGroup,
  type DynamicAppearMode,
  type DynamicBackground,
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

type ControlTab = 'motion' | 'animation' | 'transform' | 'deform' | 'copy'
type GestureMode = 'none' | 'drag' | 'pinch'
type ToolPanelSide = 'left' | 'right'

interface Point {
  x: number
  y: number
}

interface MediaSize {
  width: number
  height: number
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
const HORIZONTAL_WAVE_CYCLES = 8

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const getDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const getAngle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI
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

const getInitialItemId = (items: DynamicItem[], itemId = '') => {
  if (itemId && items.some((item) => item.id === itemId)) return itemId
  return items[0]?.id ?? ''
}

const getItemTrack = (item: DynamicItem) => item.moveTrack ?? getTrack(item.position.y)
const getItemMoveSpeed = (item: DynamicItem) => clamp(item.moveSpeed ?? DEFAULT_MOVE_SPEED, 0, 100)
const getItemFlipX = (item: DynamicItem) => item.flipX ?? false
const getItemFlipY = (item: DynamicItem) => item.flipY ?? false

const getToolSideForItem = (item?: DynamicItem) => {
  if (!item) return 'right'
  return item.position.x > 0.5 ? 'left' : 'right'
}

const getTrackBounds = (track: DynamicMoveTrack) => {
  if (track === 'top') return { start: 0, end: 1 / 3 }
  if (track === 'bottom') return { start: 2 / 3, end: 1 }
  return { start: 1 / 3, end: 2 / 3 }
}

const getMoveDuration = (speed: number) => {
  const ratio = clamp(speed, 0, 100) / 100
  return 14 - ratio * 11.5
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
  const moveDuration = getMoveDuration(getItemMoveSpeed(item))

  return {
    left: isLoopMove ? (item.moveMode === 'left' ? '109%' : '-9%') : `${item.position.x * 100}%`,
    top: isLoopMove
      ? `${(amplitudeRatio > 0 ? 0.5 : getDynamicMoveTrackCenter(moveTrack)) * 100}%`
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
  const latestGroupRef = useRef(group)
  const pointersRef = useRef<Map<number, Point>>(new Map())
  const gestureModeRef = useRef<GestureMode>('none')
  const gestureItemIdRef = useRef<string | null>(null)
  const dragStartRef = useRef<{ point: Point; position: Point } | null>(null)
  const pinchStartRef = useRef<{ distance: number; angle: number; scale: number; rotation: number } | null>(null)
  const lastTransformSentAtRef = useRef<Record<string, number>>({})
  const drawerDragStartRef = useRef<number | null>(null)
  const lastTapRef = useRef<{ itemId: string; time: number } | null>(null)
  const copyFeedbackTimerRef = useRef<number | null>(null)
  const previewReplayIdRef = useRef(0)
  const transformPersistTimerRef = useRef<number | null>(null)

  const [selectedItemId, setSelectedItemId] = useState(() => getInitialItemId(group.items, initialItemId))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toolOpen, setToolOpen] = useState(false)
  const [toolSide, setToolSide] = useState<ToolPanelSide>('right')
  const [activeTab, setActiveTab] = useState<ControlTab>('motion')
  const [backgroundPanelOpen, setBackgroundPanelOpen] = useState(false)
  const [selectedBackgroundIds, setSelectedBackgroundIds] = useState<string[]>([])
  const [copiedSourceItemId, setCopiedSourceItemId] = useState('')
  const [copyFeedbackItemId, setCopyFeedbackItemId] = useState('')
  const [manipulatingItemId, setManipulatingItemId] = useState('')
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [itemImageSizes, setItemImageSizes] = useState<Record<string, MediaSize>>({})
  const [isAddingLayerItem, setIsAddingLayerItem] = useState(false)
  const [receiverSyncStatus, setReceiverSyncStatus] = useState('')
  const [receiverSyncError, setReceiverSyncError] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const [previewReplayId, setPreviewReplayId] = useState(0)

  const sortedItems = [...group.items].sort((a, b) => a.order - b.order)
  const selectedItem = sortedItems.find((item) => item.id === selectedItemId) ?? sortedItems[0]
  const backgrounds = getBackgrounds(group)
  const activeTrack = selectedItem ? getItemTrack(selectedItem) : 'middle'
  const selectedMoveSpeed = selectedItem ? getItemMoveSpeed(selectedItem) : DEFAULT_MOVE_SPEED
  const appearIntervalMs = clamp(
    group.appearIntervalMs ?? DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS,
    MIN_DYNAMIC_APPEAR_INTERVAL_MS,
    MAX_DYNAMIC_APPEAR_INTERVAL_MS
  )
  const appearIntervalSeconds = (appearIntervalMs / 1000).toFixed(1)

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
    setDrawerOpen(false)
    setBackgroundPanelOpen(false)
  }, [group.id])

  useEffect(() => {
    const video = stageBackgroundVideoRef.current
    if (!video || group.background?.type !== 'video' || !group.background.url) return undefined

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
  }, [group.background?.id, group.background?.type, group.background?.url])

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
    const validMediaIds = new Set(group.items.map((item) => item.media.id))
    setItemImageSizes((currentSizes) => {
      const nextSizes = Object.fromEntries(
        Object.entries(currentSizes).filter(([mediaId]) => validMediaIds.has(mediaId))
      )
      return Object.keys(nextSizes).length === Object.keys(currentSizes).length ? currentSizes : nextSizes
    })
  }, [group.items])

  useEffect(() => {
    const currentBackgrounds = getBackgrounds(group)
    sendDynamicEvent(wsIp, dynamicPort, 'GroupStateSync', {
      groupId: group.id,
      name: group.name,
      appearMode: group.appearMode,
      appearIntervalMs,
      activeBackgroundId: group.activeBackgroundId,
      background: toBackgroundPayload(group.background),
      backgrounds: currentBackgrounds.map((background) => toBackgroundPayload(background)),
      items: group.items.map((item) => ({
        itemId: item.id,
        assetId: item.media.id,
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
    })
  }, [appearIntervalMs, dynamicPort, group.id, wsIp])

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current !== null) {
      window.clearTimeout(copyFeedbackTimerRef.current)
    }
    if (transformPersistTimerRef.current !== null) {
      window.clearTimeout(transformPersistTimerRef.current)
      upsertDynamicGroup(latestGroupRef.current)
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
      const item = latestGroupRef.current.items.find((nextItem) => nextItem.id === itemId)
      setToolSide(getToolSideForItem(item))
      setToolOpen(true)
      setBackgroundPanelOpen(false)
      setDrawerOpen(false)
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
      replayId?: number
    } = {}
  ) => {
    sendDynamicEvent(wsIp, dynamicPort, 'PreviewMode', {
      groupId: group.id,
      enabled,
      appearMode: options.appearMode ?? group.appearMode,
      intervalMs: options.intervalMs ?? appearIntervalMs,
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
      setDrawerOpen(false)
      setBackgroundPanelOpen(false)
      setManipulatingItemId('')
    }

    sendPreviewModeState(enabled, { replayId })
  }

  const handleStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (previewMode) {
      event.preventDefault()
      setPreviewModeEnabled(false)
      return
    }

    const target = event.target as HTMLElement
    const itemElement = target.closest<HTMLElement>('[data-dynamic-item-id]')
    const itemId = itemElement?.dataset.dynamicItemId ?? gestureItemIdRef.current
    if (!itemId) {
      setToolOpen(false)
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    if (itemElement) {
      const now = Date.now()
      const lastTap = lastTapRef.current
      const isDoubleTap = Boolean(lastTap && lastTap.itemId === itemId && now - lastTap.time < 330)
      lastTapRef.current = { itemId, time: now }
      selectItem(itemId, isDoubleTap)
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
    setDrawerOpen(false)
    setBackgroundPanelOpen(true)
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
      setDrawerOpen(true)
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

  const handleCopySettings = async (sourceItemId: string) => {
    if (!selectedItem) return

    const nextGroup = await copyDynamicItemSettings(group.id, selectedItem.id, sourceItemId, latestGroupRef.current)
    if (!nextGroup) return

    latestGroupRef.current = nextGroup
    onGroupChange(nextGroup)
    sendDynamicEvent(wsIp, dynamicPort, 'ItemSettingsCopy', {
      groupId: group.id,
      targetItemId: selectedItem.id,
      sourceItemId,
      fields: ['scale', 'rotation', 'flipX', 'flipY', 'animationId', 'moveMode', 'movePercent', 'moveSpeed', 'moveTrack']
    })
    const copiedItem = nextGroup.items.find((item) => item.id === selectedItem.id)
    if (copiedItem) {
      emitTransform(copiedItem, true)
      sendDynamicEvent(wsIp, dynamicPort, 'ItemDeform', {
        groupId: group.id,
        itemId: copiedItem.id,
        flipX: getItemFlipX(copiedItem),
        flipY: getItemFlipY(copiedItem)
      })
      sendDynamicEvent(wsIp, dynamicPort, 'ItemMotion', {
        groupId: group.id,
        itemId: copiedItem.id,
        mode: copiedItem.moveMode,
        percent: copiedItem.movePercent,
        speed: getItemMoveSpeed(copiedItem),
        track: getItemTrack(copiedItem)
      })
    }

    if (copyFeedbackTimerRef.current !== null) {
      window.clearTimeout(copyFeedbackTimerRef.current)
    }
    setCopiedSourceItemId(sourceItemId)
    setCopyFeedbackItemId(selectedItem.id)
    playUiSound('success')

    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setToolOpen(false)
      setActiveTab('motion')
      setCopiedSourceItemId('')
      setCopyFeedbackItemId('')
      copyFeedbackTimerRef.current = null
    }, 560)
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

  const handleDrawerPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (previewMode) return

    drawerDragStartRef.current = event.clientX
  }

  const handleDrawerPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (previewMode) {
      drawerDragStartRef.current = null
      setDrawerOpen(false)
      return
    }

    const startX = drawerDragStartRef.current
    drawerDragStartRef.current = null
    const applyDrawerOpen = (open: boolean) => {
      if (open) {
        setToolOpen(false)
        setBackgroundPanelOpen(false)
      }
      setDrawerOpen(open)
    }

    if (startX === null) {
      applyDrawerOpen(!drawerOpen)
      return
    }

    const deltaX = event.clientX - startX
    if (Math.abs(deltaX) < 20) {
      applyDrawerOpen(!drawerOpen)
      return
    }
    applyDrawerOpen(deltaX < 0)
  }

  return (
    <main className={`ipad-screen dynamic-control-screen apple-container ${previewMode ? 'dynamic-previewing' : ''}`}>
      <header className="ipad-topbar dynamic-control-topbar">
        <div className="topbar-title-row">
          <button
            type="button"
            className="ipad-button ghost-button"
            onClick={() => {
              if (previewMode) setPreviewModeEnabled(false)
              onBack()
            }}
          >
            返回
          </button>
          <div className="min-w-0">
            <p className="eyebrow">作品檔案</p>
            <h1 className="screen-title">{group.name}</h1>
          </div>
        </div>

        <div className="dynamic-appear-mode-panel" aria-label="出現方式">
          <span>出現方式</span>
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
          <label className={`dynamic-interval-control ${group.appearMode === 'all' ? 'disabled' : ''}`}>
            <span>間隔 {appearIntervalSeconds}s</span>
            <input
              type="range"
              min={MIN_DYNAMIC_APPEAR_INTERVAL_MS}
              max={MAX_DYNAMIC_APPEAR_INTERVAL_MS}
              step="100"
              value={appearIntervalMs}
              disabled={group.appearMode === 'all'}
              onChange={(event) => setAppearInterval(Number(event.target.value))}
              className="ipad-slider compact"
            />
          </label>
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
            className={`ipad-button ${previewMode ? 'secondary-button' : 'primary-button success-button'}`}
            onClick={() => setPreviewModeEnabled(!previewMode)}
          >
            {previewMode ? '停止預覽' : '預覽'}
          </button>
          <button
            type="button"
            className="ipad-button secondary-button"
            onClick={() => {
              if (previewMode) setPreviewModeEnabled(false)
              const nextOpen = !backgroundPanelOpen
              if (nextOpen) {
                setToolOpen(false)
                setDrawerOpen(false)
              }
              setBackgroundPanelOpen(nextOpen)
            }}
          >
            選擇背景
          </button>
          <button
            type="button"
            className="ipad-button primary-button"
            onClick={() => {
              if (previewMode) setPreviewModeEnabled(false)
              setToolOpen(false)
              setDrawerOpen(false)
              backgroundInputRef.current?.click()
            }}
          >
            新增背景
          </button>
        </div>
      </header>

      {(receiverSyncStatus || receiverSyncError) && (
        <div className={`status-toast ${receiverSyncError ? 'error' : 'success'}`}>
          {receiverSyncError || receiverSyncStatus}
        </div>
      )}

      <section className="dynamic-control-workspace">
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

            {group.background ? (
              group.background.type === 'video' ? (
                <video
                  ref={stageBackgroundVideoRef}
                  src={group.background.url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  className="dynamic-stage-background"
                />
              ) : (
                <img src={group.background.url} alt={group.background.name} className="dynamic-stage-background" />
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

        {!previewMode && backgroundPanelOpen && (
          <aside className="dynamic-background-drawer">
            <div className="drawer-heading">
              <div>
                <p className="eyebrow">背景素材</p>
                <h2>{backgrounds.length} 個</h2>
              </div>
              <button type="button" className="mini-action-button" onClick={() => setBackgroundPanelOpen(false)}>
                收起
              </button>
            </div>

            <div className="background-library-list">
              {backgrounds.map((background) => (
                <article
                  key={background.id}
                  className={`background-library-card ${group.background?.id === background.id ? 'active' : ''}`}
                >
                  <label className="background-check">
                    <input
                      type="checkbox"
                      checked={selectedBackgroundIds.includes(background.id)}
                      onChange={() => toggleBackgroundSelection(background.id)}
                    />
                    <span>選取</span>
                  </label>
                  <button type="button" className="background-preview-button" onClick={() => handleBackgroundSelect(background.id)}>
                    {background.type === 'video' ? (
                      <video src={background.url} muted playsInline />
                    ) : (
                      <img src={background.url} alt={background.name} />
                    )}
                    <strong>{background.name}</strong>
                  </button>
                </article>
              ))}
              {backgrounds.length === 0 && (
                <div className="background-empty-state">尚未加入背景</div>
              )}
            </div>

            <div className="background-drawer-actions">
              <button type="button" className="ipad-button secondary-button" onClick={() => backgroundInputRef.current?.click()}>
                新增
              </button>
              <button
                type="button"
                className="ipad-button danger-button"
                disabled={selectedBackgroundIds.length === 0}
                onClick={handleBackgroundDelete}
              >
                刪除選取
              </button>
            </div>
          </aside>
        )}

        {!previewMode && (
          <aside className={`dynamic-layer-drawer ${drawerOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="dynamic-drawer-handle"
            onPointerDown={handleDrawerPointerDown}
            onPointerUp={handleDrawerPointerUp}
            aria-label="開關圖層"
          >
            <span />
          </button>
          <div className="dynamic-layer-content">
            <div className="drawer-heading">
              <div>
                <p className="eyebrow">圖層</p>
                <h2>{group.items.length}/{MAX_DYNAMIC_ITEMS_PER_GROUP}</h2>
              </div>
              <button
                type="button"
                className="drawer-add-item-button"
                disabled={isAddingLayerItem || group.items.length >= MAX_DYNAMIC_ITEMS_PER_GROUP}
                onClick={() => {
                  setToolOpen(false)
                  setBackgroundPanelOpen(false)
                  layerItemInputRef.current?.click()
                }}
                aria-label="新增圖片"
              >
                +
              </button>
            </div>
            <div className="dynamic-layer-list">
              {sortedItems.map((item) => (
                <article key={item.id} className={`dynamic-layer-card ${selectedItem?.id === item.id ? 'active' : ''}`}>
                  <button type="button" className="dynamic-layer-main" onClick={() => selectItem(item.id, true)}>
                    <img src={item.media.url} alt={item.name} />
                    <span>{item.name}</span>
                  </button>
                  <div className="dynamic-layer-actions">
                    <button type="button" onClick={() => {
                      selectItem(item.id, true)
                      setActiveTab('copy')
                    }}>
                      復用
                    </button>
                    <button type="button" className="danger-inline-button" onClick={() => handleItemDelete(item.id)}>
                      刪除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
          </aside>
        )}

        {selectedItem && toolOpen && !previewMode && (
          <aside className={`dynamic-tool-panel side-${toolSide}`}>
            <div className="dynamic-tool-header">
              <div className="dynamic-tool-title">
                <img src={selectedItem.media.url} alt={selectedItem.name} />
                <div>
                  <p className="eyebrow">控制工具</p>
                  <h2>{selectedItem.name}</h2>
                </div>
              </div>
              <button type="button" className="mini-action-button" onClick={() => setToolOpen(false)}>
                收起
              </button>
            </div>

            <div className="tool-tabs dynamic-tool-tabs">
              {[
                { id: 'motion', label: '移動' },
                { id: 'animation', label: '動畫' },
                { id: 'transform', label: '大小' },
                { id: 'deform', label: '物件變形' },
                { id: 'copy', label: '復用' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`tool-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id as ControlTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'motion' && (
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

            {activeTab === 'animation' && (
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

            {activeTab === 'transform' && (
              <div className="dynamic-tool-body compact">
                <div className="dynamic-transform-readout">
                  <span>網格 {selectedItem.gridIndex}</span>
                  <span>{selectedItem.scale.toFixed(1)}x</span>
                  <span>{selectedItem.rotation.toFixed(0)}°</span>
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
              </div>
            )}

            {activeTab === 'deform' && (
              <div className="dynamic-tool-body compact">
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

            {activeTab === 'copy' && (
              <div className="dynamic-tool-body compact">
                <div className="copy-source-list">
                  {sortedItems.filter((item) => item.id !== selectedItem.id).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-silent="true"
                      className={`copy-source-button ${copiedSourceItemId === item.id ? 'copied' : ''}`}
                      onClick={() => handleCopySettings(item.id)}
                    >
                      <img src={item.media.url} alt={item.name} />
                      <span>{item.name}</span>
                    </button>
                  ))}
                  {sortedItems.length <= 1 && (
                    <span className="copy-empty">暫無其他圖片可復用。</span>
                  )}
                </div>
                {copyFeedbackItemId === selectedItem.id && (
                  <div className="dynamic-copy-feedback">已套用參數</div>
                )}
              </div>
            )}
          </aside>
        )}
      </section>
    </main>
  )
}

export default DynamicControlPage
