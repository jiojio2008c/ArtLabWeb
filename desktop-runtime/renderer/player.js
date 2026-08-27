import {
  WALK_ANIMATION_ID,
  drawWalkImage
} from './walk-animation-core.js'
import { sampleItemAnimation } from './item-animation-core.js'
import {
  DYNAMIC_ANIMATION_IDS,
  getDynamicAnimationMode,
  resolveDynamicAnimationId
} from './dynamic-animation-catalog.js'
import {
  UNITY_EXTRA_ANIMATION_MAX_ID,
  UNITY_EXTRA_ANIMATION_MIN_ID,
  UNITY_EXTRA_ANIMATION_DEFINITIONS,
  drawUnityAnimationImage
} from './unity-animation-core.js'
import {
  RIPPLE_DURATION_MS,
  createAnimationOverrideStore,
  isAnimationOverrideComplete,
  mapClientPointToStage,
  sampleRipple
} from './interaction-core.js'
import { createInteractionAudio } from './interaction-audio.js'
import {
  MAX_WATER_RIPPLES,
  createWaterRippleRenderer
} from './water-ripple-renderer.js'
import { createDynamicPortalWorld } from './archive-portal-world.js'
import {
  buildDynamicAppearanceTimeline,
  getContinuableDynamicAppearanceItemIds,
  getDynamicAppearanceTimingForBackground,
  getDynamicBackgroundAppearanceForGroup,
  sampleDynamicAppearanceTimeline
} from './advanced-appearance-timeline.js'
import {
  getDynamicBackgroundPlaybackStartIndex,
  getDynamicStageItemsForBackground,
  getDynamicFixedBackgroundEpochKey,
  resolveDynamicFixedBackgroundEpoch,
  resolveDynamicBackgroundPlaybackEpoch
} from './background-playback-core.js'
import {
  getTargetMotionDurationMs,
  sampleTargetMotionState
} from './target-motion-core.js'
import {
  sampleDynamicHorizontalMotion,
  sampleDynamicOrbitMotion,
  getDynamicVerticalWaveOffsets,
  sampleDynamicVerticalWave
} from './dynamic-motion-core.js'
import {
  drawBubble,
  getBubbleAssetId,
  getBubbleSize,
  isBubbleItem,
  normalizeBubble
} from './bubble-render-core.js'
import {
  DEFAULT_STAGE_WATERMARK_ENABLED,
  configureHighQualityImageSmoothing
} from './stage-presentation-core.js'

const STAGE_WIDTH = 1920
const STAGE_HEIGHT = 1080
const DESKTOP_ADVANCED_FEATURES_ENABLED = true
const TARGET_ARRIVAL_SETTLE_MS = 80
const PREVIEW_BGM_VOLUME = 0.62
const PREVIEW_BGM_DUCK_VOLUME = 0.2
const PREVIEW_BGM_TRANSITION_DUCK_VOLUME = 0.1
const PREVIEW_BGM_FADE_MS = 420
const BACKGROUND_TRANSITION_TIMINGS = {
  curtain: { closeMs: 520, openMs: 680 },
  cameraFlash: { closeMs: 150, openMs: 330 },
  shadowPlay: { closeMs: 650, openMs: 750 }
}

const pageParams = new URLSearchParams(window.location.search)
const displayFlipMode = pageParams.get('displayFlip')
const pointerFlipMode = pageParams.get('pointerFlip') ?? displayFlipMode
const isHorizontalDisplayFlip = displayFlipMode === 'horizontal' || displayFlipMode === 'both'
const isVerticalDisplayFlip = displayFlipMode === 'vertical' || displayFlipMode === 'both'
const isHorizontalPointerFlip = pointerFlipMode === 'horizontal' || pointerFlipMode === 'both'
const isVerticalPointerFlip = pointerFlipMode === 'vertical' || pointerFlipMode === 'both'
const displayRoot = document.getElementById('displayRoot')
const canvas = document.getElementById('stage')
const context = canvas.getContext('2d')
const backgroundCanvas = document.getElementById('backgroundStage')
const backgroundSourceCanvas = document.createElement('canvas')
const backgroundSourceContext = backgroundSourceCanvas.getContext('2d')
const statusPanel = document.getElementById('statusPanel')
const statusText = document.getElementById('statusText')
const groupText = document.getElementById('groupText')
const archiveView = document.getElementById('archiveView')
const stageStandby = document.getElementById('stageStandby')
let archiveMirrorImage = document.getElementById('archiveMirrorImage')
const archiveMirrorFallback = document.getElementById('archiveMirrorFallback')
const archiveSourceImage = document.getElementById('archiveSourceImage')
const archivePortalCanvas = document.getElementById('archivePortalCanvas')
const archivePortalFallbackCanvas = document.getElementById('archivePortalFallbackCanvas')
const archivePortalContext = archivePortalFallbackCanvas.getContext('2d')

displayRoot?.classList.toggle('is-horizontal-flipped', isHorizontalDisplayFlip)
displayRoot?.classList.toggle('is-vertical-flipped', isVerticalDisplayFlip)

backgroundSourceCanvas.width = STAGE_WIDTH
backgroundSourceCanvas.height = STAGE_HEIGHT
configureHighQualityImageSmoothing(context)
configureHighQualityImageSmoothing(backgroundSourceContext)
configureHighQualityImageSmoothing(archivePortalContext)
const waterRippleRenderer = createWaterRippleRenderer(backgroundCanvas)

let runtimeState = {
  activeGroupId: null,
  groups: {},
  assets: {},
  watermarkEnabled: DEFAULT_STAGE_WATERMARK_ENABLED,
  view: {
    mode: 'archive',
    mirror: {
      replayId: null,
      startedAt: 0,
      elapsedMs: 0,
      receivedAt: 0,
      capturedAt: 0,
      width: 0,
      height: 0,
      snapshotDataUrl: '',
      source: {
        dataUrl: '',
        width: 0,
        height: 0,
        capturedAt: 0,
        origin: null
      }
    }
  },
  preview: {
    enabled: false,
    advancedFeaturesEnabled: DESKTOP_ADVANCED_FEATURES_ENABLED,
    replayId: 0,
    startedAt: Date.now(),
    appearMode: 'all',
    intervalMs: 800,
    backgroundPlayMode: 'fixed',
    backgroundIntervalMs: 5000
  },
  server: {
    status: 'starting',
    port: 8080,
    addresses: []
  },
  lastEvent: null
}

let serverStatus = runtimeState.server
let stageScale = 1
let stageOffsetX = 0
let stageOffsetY = 0
let lastPreviewKey = ''
let previewStartTime = performance.now()
let lastDrawnBackgroundAssetId = ''
let randomBackgroundState = { key: '', indices: [] }
let backgroundPlaybackScheduleState = { key: '', entries: [], startedAt: 0 }
let fixedBackgroundEpochState = { key: '', changedAt: 0 }
let lastStateEventSequence = 0
let ripples = []
let alphaHitWarningShown = false
let activeArchiveReplayId = ''
let archiveTransitionFrameId = 0
let archiveTransitionStartedAt = 0
let archiveMirrorImageFrameKey = ''
let archiveMirrorImageLoadSequence = 0
let archiveSourceImageFrameKey = ''
let archiveSourceImageFailedFrameKey = ''
let archivePortalWorld = null
let previewPresentationKey = ''
let previewPresentationReady = false
let stageSurfaceCleared = false

const imageCache = new Map()
const videoCache = new Map()
const transitionLogo = {
  element: new Image(),
  loaded: false,
  failed: false
}
transitionLogo.element.onload = () => {
  transitionLogo.loaded = true
}
transitionLogo.element.onerror = () => {
  transitionLogo.failed = true
}
transitionLogo.element.src = './assets/Right_Logo.png'
const RANDOM_PREVIEW_MOTION_MODES = ['verticalWave', 'left', 'right', 'orbit']
const UNITY_PREVIEW_DURATION_BY_ID = new Map(
  UNITY_EXTRA_ANIMATION_DEFINITIONS.map((definition) => [definition.id, definition.duration])
)
const UNITY_CLICK_ONE_SHOT_DURATION_BY_ID = new Map(
  UNITY_EXTRA_ANIMATION_DEFINITIONS
    .filter((definition) => !definition.loop)
    .map((definition) => [definition.id, definition.duration])
)
const HIT_SAMPLE_SIZE = 9
const HIT_ALPHA_THRESHOLD = 18
const hitCanvas = document.createElement('canvas')
const hitContext = hitCanvas.getContext('2d', { willReadFrequently: true })
const animationOverrides = createAnimationOverrideStore()
const interactionAudio = createInteractionAudio()
const advancedPlaybackState = {
  sessionKey: '',
  appearanceContextKey: '',
  appearanceBackgroundEpochKey: '',
  appearanceEpochCounter: 0,
  itemEpochs: new Map(),
  currentBgm: null,
  fadingBgms: new Set(),
  objectVoices: new Set(),
  triggeredAudioCycles: new Map(),
  lastAudioUpdateAt: 0,
  lastTransitionSoundKey: ''
}

hitCanvas.width = HIT_SAMPLE_SIZE
hitCanvas.height = HIT_SAMPLE_SIZE

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const lerp = (a, b, t) => a + (b - a) * t
const degToRad = (value) => value * Math.PI / 180

const hashString = (value) => {
  let hash = 0
  const text = String(value || '')
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const mixHash = (value) => {
  let mixed = value | 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d)
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b)
  return (mixed ^ (mixed >>> 16)) >>> 0
}

const smoothstep = (value) => {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

const resizeCanvas = () => {
  const dpr = window.devicePixelRatio || 1
  const width = window.innerWidth
  const height = window.innerHeight
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  backgroundCanvas.width = Math.round(width * dpr)
  backgroundCanvas.height = Math.round(height * dpr)
  backgroundCanvas.style.width = `${width}px`
  backgroundCanvas.style.height = `${height}px`
  configureHighQualityImageSmoothing(context)

  const scaleX = width / STAGE_WIDTH
  const scaleY = height / STAGE_HEIGHT
  stageScale = Math.min(scaleX, scaleY)
  stageOffsetX = (width - STAGE_WIDTH * stageScale) / 2
  stageOffsetY = (height - STAGE_HEIGHT * stageScale) / 2
}

const getActiveGroup = () => {
  if (!runtimeState.activeGroupId) return null
  return runtimeState.groups[runtimeState.activeGroupId] ?? null
}

const isArchiveView = () => runtimeState.view?.mode !== 'stage'

const getAsset = (assetId) => {
  if (!assetId) return null
  return runtimeState.assets[assetId] ?? null
}

const ARCHIVE_TRANSITION_DURATION_MS = 2200
const clamp01 = (value) => Math.min(1, Math.max(0, value))
const easeInOutCubic = (value) => value < 0.5
  ? 4 * value * value * value
  : 1 - Math.pow(-2 * value + 2, 3) / 2
const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3)

const resizeArchivePortalCanvas = () => {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  archivePortalFallbackCanvas.width = Math.round(window.innerWidth * dpr)
  archivePortalFallbackCanvas.height = Math.round(window.innerHeight * dpr)
  archivePortalFallbackCanvas.style.width = `${window.innerWidth}px`
  archivePortalFallbackCanvas.style.height = `${window.innerHeight}px`
  configureHighQualityImageSmoothing(archivePortalContext)
  archivePortalContext.setTransform(dpr, 0, 0, dpr, 0, 0)
}

const drawArchivePortal = (progress, now) => {
  const width = window.innerWidth
  const height = window.innerHeight
  archivePortalContext.clearRect(0, 0, width, height)
  if (progress >= 0.995) return

  const activation = easeOutCubic(clamp01(progress / 0.2))
  const travel = easeInOutCubic(clamp01((progress - 0.16) / 0.46))
  const exit = 1 - clamp01((progress - 0.76) / 0.22)
  const centerX = width * (0.36 + travel * 0.14)
  const centerY = height * (0.5 - travel * 0.02)
  const baseSize = Math.min(width, height) * (0.2 + travel * 1.46)

  archivePortalContext.save()
  archivePortalContext.globalCompositeOperation = 'lighter'
  const lineCount = width >= 1400 ? 54 : 38
  for (let index = 0; index < lineCount; index += 1) {
    const seed = ((index * 67) % 101) / 101
    const side = index % 2 === 0 ? -1 : 1
    const startX = centerX + side * baseSize * (0.1 + seed * 0.18)
    const spread = baseSize * (0.55 + seed * 0.55)
    const y = centerY + (seed - 0.5) * height * 0.94
    archivePortalContext.beginPath()
    archivePortalContext.moveTo(startX, centerY + (seed - 0.5) * baseSize * 0.38)
    archivePortalContext.lineTo(centerX + side * spread, y)
    archivePortalContext.strokeStyle = index % 3 === 0
      ? `rgba(178, 90, 255, ${0.46 * activation * exit})`
      : `rgba(70, 232, 255, ${0.38 * activation * exit})`
    archivePortalContext.lineWidth = 1 + (index % 4) * 0.45
    archivePortalContext.stroke()
  }

  archivePortalContext.translate(centerX, centerY)
  archivePortalContext.rotate(Math.sin(now / 620) * 0.025)
  const pulse = 1 + Math.sin(now / 80) * 0.018 * activation
  archivePortalContext.scale(pulse, pulse)
  archivePortalContext.strokeStyle = `rgba(109, 238, 255, ${activation * exit})`
  archivePortalContext.shadowColor = '#62dfff'
  archivePortalContext.shadowBlur = 24
  archivePortalContext.lineWidth = Math.max(2, baseSize * 0.008)
  archivePortalContext.strokeRect(-baseSize * 0.38, -baseSize * 0.29, baseSize * 0.76, baseSize * 0.58)
  archivePortalContext.strokeStyle = `rgba(177, 80, 255, ${activation * exit * 0.78})`
  archivePortalContext.shadowColor = '#a14dff'
  archivePortalContext.shadowBlur = 36
  archivePortalContext.strokeRect(-baseSize * 0.41, -baseSize * 0.32, baseSize * 0.82, baseSize * 0.64)
  archivePortalContext.restore()
}

const stopArchiveTransition = () => {
  if (archiveTransitionFrameId) window.cancelAnimationFrame(archiveTransitionFrameId)
  archiveTransitionFrameId = 0
  archivePortalWorld?.destroy()
  archivePortalWorld = null
  archiveView.classList.remove('is-transitioning')
  archivePortalCanvas.classList.remove('is-active')
  archivePortalFallbackCanvas.classList.remove('is-active')
  archivePortalContext.clearRect(0, 0, window.innerWidth, window.innerHeight)
}

const resetArchiveMirrorSnapshotLayer = () => {
  archiveMirrorImageLoadSequence += 1
  archiveMirrorImageFrameKey = ''
  archiveMirrorImage.onload = null
  archiveMirrorImage.onerror = null
  archiveMirrorImage.removeAttribute('src')
  archiveView.classList.remove('has-snapshot')
}

const resetArchiveSourceLayer = () => {
  archiveSourceImageFrameKey = ''
  archiveSourceImageFailedFrameKey = ''
  archiveSourceImage.onload = null
  archiveSourceImage.onerror = null
  archiveSourceImage.removeAttribute('src')
  archiveMirrorFallback.classList.remove('has-source')
}

const resetArchiveMediaLayers = () => {
  resetArchiveMirrorSnapshotLayer()
  resetArchiveSourceLayer()
}

const loadArchiveMirrorSnapshot = (snapshotDataUrl, frameKey) => {
  const loadSequence = ++archiveMirrorImageLoadSequence
  archiveMirrorImageFrameKey = frameKey
  const nextImage = new Image()
  nextImage.className = 'archive-mirror-image'
  nextImage.alt = ''
  nextImage.draggable = false
  nextImage.onload = () => {
    if (loadSequence !== archiveMirrorImageLoadSequence || archiveMirrorImageFrameKey !== frameKey) return

    nextImage.id = 'archiveMirrorImage'
    archiveMirrorImage.onload = null
    archiveMirrorImage.onerror = null
    archiveMirrorImage.replaceWith(nextImage)
    archiveMirrorImage = nextImage
    archiveView.classList.add('has-snapshot')
  }
  nextImage.onerror = () => {
    if (loadSequence !== archiveMirrorImageLoadSequence || archiveMirrorImageFrameKey !== frameKey) return
    archiveMirrorImageFrameKey = ''
    if (!archiveMirrorImage.getAttribute('src')) archiveView.classList.remove('has-snapshot')
  }
  nextImage.src = snapshotDataUrl
}

const getArchivePortalOrigin = (mirror) => {
  const source = mirror?.source ?? {}
  const origin = source.origin
  const sourceWidth = Math.max(0, Number(source.width) || 0)
  const sourceHeight = Math.max(0, Number(source.height) || 0)
  if (!origin || sourceWidth <= 0 || sourceHeight <= 0) {
    return {
      left: window.innerWidth * 0.18,
      top: window.innerHeight * 0.22,
      width: window.innerWidth * 0.26,
      height: window.innerHeight * 0.56
    }
  }

  const scale = Math.min(window.innerWidth / sourceWidth, window.innerHeight / sourceHeight)
  const offsetX = (window.innerWidth - sourceWidth * scale) / 2
  const offsetY = (window.innerHeight - sourceHeight * scale) / 2
  return {
    left: offsetX + Math.max(0, Number(origin.left) || 0) * scale,
    top: offsetY + Math.max(0, Number(origin.top) || 0) * scale,
    width: Math.max(1, Number(origin.width) || 1) * scale,
    height: Math.max(1, Number(origin.height) || 1) * scale
  }
}

const startArchiveTransition = (mirror) => {
  stopArchiveTransition()
  const elapsedSinceReceipt = Math.max(0, Date.now() - (Number(mirror?.receivedAt) || Date.now()))
  archiveTransitionStartedAt = performance.now() - Math.min(
    ARCHIVE_TRANSITION_DURATION_MS,
    Math.max(0, Number(mirror?.elapsedMs) || 0) + elapsedSinceReceipt
  )
  archiveView.classList.add('is-transitioning')

  const cardRect = getArchivePortalOrigin(mirror)
  try {
    archivePortalWorld = createDynamicPortalWorld(archivePortalCanvas, {
      left: cardRect.left,
      top: cardRect.top,
      width: cardRect.width,
      height: cardRect.height
    }, 'dynamic')
    archivePortalCanvas.classList.add('is-active')
  } catch (error) {
    console.warn('Archive portal WebGL fallback enabled:', error)
    archivePortalFallbackCanvas.classList.add('is-active')
  }

  const animate = (now) => {
    const progress = clamp01((now - archiveTransitionStartedAt) / ARCHIVE_TRANSITION_DURATION_MS)
    archiveView.style.setProperty('--archive-transition-progress', String(progress))
    if (archivePortalWorld) {
      archivePortalWorld.state.progress = progress
    } else {
      drawArchivePortal(progress, now)
    }

    if (progress < 1 && isArchiveView()) {
      archiveTransitionFrameId = window.requestAnimationFrame(animate)
      return
    }

    stopArchiveTransition()
  }

  archiveTransitionFrameId = window.requestAnimationFrame(animate)
}

const renderArchiveMirror = () => {
  const archiveActive = isArchiveView()
  const mirror = runtimeState.view?.mirror ?? {}
  const replayId = String(mirror.replayId || '')
  const snapshotDataUrl = typeof mirror.snapshotDataUrl === 'string' ? mirror.snapshotDataUrl : ''
  const snapshotCapturedAt = Math.max(0, Number(mirror.capturedAt) || 0)
  const snapshotFrameKey = snapshotDataUrl ? `${replayId}:${snapshotCapturedAt}` : ''
  const sourceDataUrl = mirror.transition === 'portal' && typeof mirror.source?.dataUrl === 'string'
    ? mirror.source.dataUrl
    : ''
  const sourceCapturedAt = Math.max(0, Number(mirror.source?.capturedAt) || 0)
  const sourceFrameKey = sourceDataUrl ? `${replayId}:${sourceCapturedAt}` : ''

  displayRoot?.classList.toggle('is-archive-view', archiveActive)
  archiveView?.setAttribute('aria-hidden', archiveActive ? 'false' : 'true')
  canvas.setAttribute('aria-hidden', archiveActive ? 'true' : 'false')

  if (!archiveActive) {
    stopArchiveTransition()
    resetArchiveMediaLayers()
    return
  }

  if (sourceDataUrl && sourceFrameKey !== archiveSourceImageFrameKey) {
    archiveSourceImageFrameKey = sourceFrameKey
    archiveSourceImageFailedFrameKey = ''
    archiveMirrorFallback.classList.remove('has-source')
    archiveSourceImage.onload = () => {
      if (archiveSourceImageFrameKey !== sourceFrameKey) return
      archiveMirrorFallback.classList.add('has-source')
      renderArchiveMirror()
    }
    archiveSourceImage.onerror = () => {
      if (archiveSourceImageFrameKey !== sourceFrameKey) return
      archiveSourceImageFailedFrameKey = sourceFrameKey
      archiveMirrorFallback.classList.remove('has-source')
      renderArchiveMirror()
    }
    archiveSourceImage.src = sourceDataUrl
  } else if (!sourceDataUrl) {
    resetArchiveSourceLayer()
  }

  if (replayId && replayId !== activeArchiveReplayId) {
    const sourceReady = !sourceDataUrl
      || archiveSourceImageFailedFrameKey === sourceFrameKey
      || (
        archiveSourceImageFrameKey === sourceFrameKey
        && archiveSourceImage.complete
        && archiveSourceImage.naturalWidth > 0
      )
    if (mirror.transition === 'portal' && !sourceReady) return

    activeArchiveReplayId = replayId
    if (mirror.transition === 'portal') {
      startArchiveTransition(mirror)
    } else {
      stopArchiveTransition()
    }
  }

  if (snapshotDataUrl && snapshotFrameKey !== archiveMirrorImageFrameKey) {
    loadArchiveMirrorSnapshot(snapshotDataUrl, snapshotFrameKey)
  } else if (!snapshotDataUrl) {
    resetArchiveMirrorSnapshotLayer()
  }

  archiveMirrorFallback.setAttribute('aria-hidden', snapshotDataUrl ? 'true' : 'false')
}

const setRuntimeViewMediaState = (archiveActive) => {
  videoCache.forEach((entry) => {
    if (archiveActive) {
      entry.element.pause()
    } else {
      entry.element.play().catch(() => {})
    }
  })
}

const clearUnusedMedia = () => {
  const validUrls = new Set(
    Object.values(runtimeState.assets)
      .map((asset) => asset.url)
      .filter(Boolean)
  )

  imageCache.forEach((entry, url) => {
    if (!validUrls.has(url)) imageCache.delete(url)
  })

  videoCache.forEach((entry, url) => {
    if (!validUrls.has(url)) {
      entry.element.pause()
      entry.element.removeAttribute('src')
      entry.element.load()
      videoCache.delete(url)
    }
  })
}

const getImage = (asset) => {
  if (!asset?.url) return null
  const cached = imageCache.get(asset.url)
  if (cached) return cached

  const image = new Image()
  const entry = {
    element: image,
    loaded: false,
    failed: false,
    width: 0,
    height: 0
  }
  image.onload = () => {
    entry.loaded = true
    entry.width = image.naturalWidth || image.width
    entry.height = image.naturalHeight || image.height
  }
  image.onerror = () => {
    entry.failed = true
  }
  image.crossOrigin = 'anonymous'
  image.src = asset.url
  imageCache.set(asset.url, entry)
  return entry
}

const getVideo = (asset) => {
  if (!asset?.url) return null
  const cached = videoCache.get(asset.url)
  if (cached) return cached

  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.src = asset.url
  video.muted = true
  video.loop = true
  video.autoplay = true
  video.playsInline = true
  video.preload = 'auto'

  const entry = {
    element: video,
    loaded: false,
    failed: false,
    width: 0,
    height: 0
  }

  video.addEventListener('loadedmetadata', () => {
    entry.loaded = true
    entry.width = video.videoWidth || STAGE_WIDTH
    entry.height = video.videoHeight || STAGE_HEIGHT
    video.play().catch(() => {})
  })
  video.addEventListener('error', () => {
    entry.failed = true
  })

  video.play().catch(() => {})
  videoCache.set(asset.url, entry)
  return entry
}

const preloadBackground = (background) => {
  const asset = getAsset(background?.assetId)
  if (!asset?.url) return
  if (asset.mediaType === 'video') {
    getVideo(asset)
  } else {
    getImage(asset)
  }
}

const getPreviewPresentationKey = () => {
  const preview = runtimeState.preview ?? {}
  if (preview.enabled !== true || isArchiveView()) return ''
  return `${runtimeState.activeGroupId ?? preview.groupId ?? ''}:${preview.replayId ?? 0}`
}

const isAssetReadyForPreview = (assetId) => {
  const asset = getAsset(assetId)
  if (!asset?.url) return false
  if (asset.mediaType === 'video') {
    const video = getVideo(asset)
    return Boolean(video?.loaded && video.element.readyState >= 2)
  }
  return Boolean(getImage(asset)?.loaded)
}

const arePreviewVisualsReady = (group) => {
  if (!group) return false
  const backgrounds = group.backgrounds ?? []
  const activeBackground = backgrounds.find((background) => (
    background.assetId === group.activeBackgroundId
  )) ?? backgrounds[0]
  if (activeBackground?.assetId && !isAssetReadyForPreview(activeBackground.assetId)) return false

  const visibleItems = getDynamicStageItemsForBackground(
    getOrderedItems(group),
    activeBackground
  )
  return visibleItems.every((item) => {
    if (item.isVisible === false) return true
    if (isBubbleItem(item)) {
      const bubbleImageAssetId = item.imageAssetId ?? getBubbleAssetId(item)
      return !bubbleImageAssetId || isAssetReadyForPreview(bubbleImageAssetId)
    }
    return !item.assetId || isAssetReadyForPreview(item.assetId)
  })
}

const primePreviewAssets = (group) => {
  if (!group) return
  const backgrounds = group.backgrounds ?? []
  const activeBackground = backgrounds.find((background) => (
    background.assetId === group.activeBackgroundId
  )) ?? backgrounds[0]
  if (activeBackground?.assetId) preloadBackground(activeBackground)

  const visibleItems = getDynamicStageItemsForBackground(
    getOrderedItems(group),
    activeBackground
  )
  visibleItems.forEach((item) => {
    const assetId = isBubbleItem(item)
      ? item.imageAssetId ?? getBubbleAssetId(item)
      : item.assetId
    const asset = getAsset(assetId)
    if (!asset?.url) return
    if (asset.mediaType === 'video') getVideo(asset)
    else getImage(asset)
  })
}

const clearStageSurface = () => {
  if (stageSurfaceCleared) return
  const dpr = window.devicePixelRatio || 1
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  backgroundSourceContext.setTransform(1, 0, 0, 1, 0, 0)
  backgroundSourceContext.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  backgroundCanvas.getContext('2d')?.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height)
  backgroundCanvas.classList.add('is-hidden')
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  stageSurfaceCleared = true
}

const activatePreviewPresentation = (key, now) => {
  previewPresentationKey = key
  previewPresentationReady = true
  previewStartTime = now
  lastPreviewKey = ''
  stageSurfaceCleared = false
  ripples = []
  animationOverrides.clearAll()
  resetAdvancedPlaybackSession(key)
  setRuntimeViewMediaState(false)
}

const updateRuntimePresentation = (now = performance.now()) => {
  const archiveActive = isArchiveView()
  const requestedKey = getPreviewPresentationKey()

  if (!requestedKey) {
    previewPresentationKey = ''
    previewPresentationReady = false
  } else if (previewPresentationKey !== requestedKey) {
    previewPresentationKey = requestedKey
    previewPresentationReady = false
  }

  if (!archiveActive && requestedKey && !previewPresentationReady) {
    primePreviewAssets(getActiveGroup())
    if (arePreviewVisualsReady(getActiveGroup())) {
      activatePreviewPresentation(requestedKey, now)
    }
  }

  const standbyActive = !archiveActive && !previewPresentationReady
  displayRoot?.classList.toggle('is-stage-standby', standbyActive)
  stageStandby?.setAttribute('aria-hidden', standbyActive ? 'false' : 'true')
  if (standbyActive) clearStageSurface()
  return { archiveActive, standbyActive, previewActive: !archiveActive && !standbyActive }
}

const disposeAudioElement = (element) => {
  if (!element) return
  element.pause()
  element.removeAttribute('src')
  element.load()
}

const clearAdvancedAudioPlayback = () => {
  if (advancedPlaybackState.currentBgm) {
    disposeAudioElement(advancedPlaybackState.currentBgm.element)
    advancedPlaybackState.currentBgm = null
  }
  advancedPlaybackState.fadingBgms.forEach((entry) => disposeAudioElement(entry.element))
  advancedPlaybackState.fadingBgms.clear()
  advancedPlaybackState.objectVoices.forEach((voice) => disposeAudioElement(voice.element))
  advancedPlaybackState.objectVoices.clear()
  advancedPlaybackState.triggeredAudioCycles.clear()
  advancedPlaybackState.lastAudioUpdateAt = 0
  advancedPlaybackState.lastTransitionSoundKey = ''
  interactionAudio.stopBackgroundTransition?.()
}

const resetAdvancedPlaybackSession = (sessionKey = '') => {
  clearAdvancedAudioPlayback()
  advancedPlaybackState.sessionKey = sessionKey
  advancedPlaybackState.appearanceContextKey = ''
  advancedPlaybackState.appearanceBackgroundEpochKey = ''
  advancedPlaybackState.appearanceEpochCounter = 0
  advancedPlaybackState.itemEpochs.clear()
  randomBackgroundState = { key: '', indices: [] }
  backgroundPlaybackScheduleState = { key: '', entries: [], startedAt: 0 }
  fixedBackgroundEpochState = { key: '', changedAt: 0 }
}

const startBgmPlayback = (audioId, now) => {
  const current = advancedPlaybackState.currentBgm
  if (current?.audioId === audioId) {
    current.element.loop = true
    current.element.play().catch(() => {})
    return
  }

  if (current) {
    current.fadeFrom = current.element.volume
    current.fadeTo = 0
    current.fadeStartedAt = now
    current.fadeDurationMs = PREVIEW_BGM_FADE_MS
    current.stopAfterFade = true
    advancedPlaybackState.fadingBgms.add(current)
    advancedPlaybackState.currentBgm = null
  }

  const asset = getAsset(audioId)
  if (!audioId || !asset?.url) return

  const element = new Audio(asset.url)
  const entry = {
    audioId,
    element,
    fadeFrom: 0,
    fadeTo: advancedPlaybackState.objectVoices.size > 0
      ? PREVIEW_BGM_DUCK_VOLUME
      : PREVIEW_BGM_VOLUME,
    fadeStartedAt: now,
    fadeDurationMs: PREVIEW_BGM_FADE_MS,
    stopAfterFade: false
  }
  element.preload = 'auto'
  element.loop = true
  element.volume = 0
  advancedPlaybackState.currentBgm = entry
  element.play().catch(() => {
    if (advancedPlaybackState.currentBgm === entry) advancedPlaybackState.currentBgm = null
    disposeAudioElement(element)
  })
}

const updateBgmVolumes = (now, transitionActive = false) => {
  const duckedVolume = transitionActive
    ? PREVIEW_BGM_TRANSITION_DUCK_VOLUME
    : advancedPlaybackState.objectVoices.size > 0
      ? PREVIEW_BGM_DUCK_VOLUME
      : PREVIEW_BGM_VOLUME
  const current = advancedPlaybackState.currentBgm
  if (current) {
    if (current.fadeTo !== duckedVolume) {
      current.fadeFrom = current.element.volume
      current.fadeTo = duckedVolume
      current.fadeStartedAt = now
      current.fadeDurationMs = transitionActive
        ? 70
        : advancedPlaybackState.objectVoices.size > 0
          ? 140
          : 240
    }
    const progress = clamp((now - current.fadeStartedAt) / Math.max(1, current.fadeDurationMs), 0, 1)
    current.element.volume = clamp(lerp(current.fadeFrom, current.fadeTo, progress), 0, 1)
  }

  advancedPlaybackState.fadingBgms.forEach((entry) => {
    const progress = clamp((now - entry.fadeStartedAt) / Math.max(1, entry.fadeDurationMs), 0, 1)
    entry.element.volume = clamp(lerp(entry.fadeFrom, entry.fadeTo, progress), 0, 1)
    if (progress >= 1 && entry.stopAfterFade) {
      disposeAudioElement(entry.element)
      advancedPlaybackState.fadingBgms.delete(entry)
    }
  })
}

const playObjectAudio = (audioId) => {
  const asset = getAsset(audioId)
  if (!audioId || !asset?.url) return

  const element = new Audio(asset.url)
  const voice = { audioId, element }
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    advancedPlaybackState.objectVoices.delete(voice)
    disposeAudioElement(element)
  }

  element.preload = 'auto'
  element.volume = 1
  element.addEventListener('ended', finish, { once: true })
  element.addEventListener('error', finish, { once: true })
  advancedPlaybackState.objectVoices.add(voice)
  element.play().catch(finish)
}

const getItemAudioTriggerElapsedMs = (item, itemEpoch) => {
  if (!itemEpoch) return null
  const schedule = itemEpoch.schedule
  const trigger = item.audioTrigger ?? 'appearance'
  if (trigger === 'appearanceDelay') {
    return schedule.activeStartMs + clamp(Number(item.audioDelayMs ?? 0), 0, 600000)
  }
  if (trigger === 'targetArrival') {
    if (item.targetMode !== 'target' || !item.targetPosition) return null
    return schedule.activeStartMs
      + getTargetMotionDurationMs(item.moveSpeed, 3.8)
      + TARGET_ARRIVAL_SETTLE_MS
  }
  return schedule.activeStartMs
}

const updateAdvancedAudioPlayback = (group, items, backgroundFrame, now) => {
  if (!isAdvancedPreviewEnabled() || !group) {
    if (
      advancedPlaybackState.currentBgm
      || advancedPlaybackState.fadingBgms.size > 0
      || advancedPlaybackState.objectVoices.size > 0
    ) clearAdvancedAudioPlayback()
    return
  }

  const targetBgmId = backgroundFrame?.background?.bgmAudioId ?? null
  if (advancedPlaybackState.currentBgm?.audioId !== targetBgmId) {
    startBgmPlayback(targetBgmId, now)
  }

  items.forEach((item, itemIndex) => {
    if (item.isVisible === false || !item.audioId) return
    const itemEpoch = advancedPlaybackState.itemEpochs.get(item.itemId)
    if (!itemEpoch) return
    const triggerKey = `${advancedPlaybackState.sessionKey}:${itemEpoch.key}:${item.itemId}:${item.audioTrigger ?? 'appearance'}`
    if (advancedPlaybackState.triggeredAudioCycles.has(triggerKey)) return
    const triggerElapsedMs = getItemAudioTriggerElapsedMs(item, itemEpoch)
    const timelineElapsedMs = Math.max(0, now - itemEpoch.startedAt)
    if (triggerElapsedMs === null || timelineElapsedMs < triggerElapsedMs) return
    if (itemEpoch.schedule.hideStartMs !== null && triggerElapsedMs >= itemEpoch.schedule.hideStartMs) return
    const sample = sampleDynamicAppearanceTimeline(itemEpoch.schedule, timelineElapsedMs)
    if (!sample.active) return
    advancedPlaybackState.triggeredAudioCycles.set(triggerKey, now)
    playObjectAudio(item.audioId)
  })

  if (advancedPlaybackState.triggeredAudioCycles.size > 512) {
    const oldestAllowedAt = now - 20 * 60 * 1000
    advancedPlaybackState.triggeredAudioCycles.forEach((triggeredAt, key) => {
      if (triggeredAt < oldestAllowedAt) advancedPlaybackState.triggeredAudioCycles.delete(key)
    })
  }

  const transition = backgroundFrame?.transition
  if (transition?.type && transition.type !== 'none') {
    const transitionSoundKey = `${advancedPlaybackState.sessionKey}:${transition.ordinal}:${transition.type}`
    if (advancedPlaybackState.lastTransitionSoundKey !== transitionSoundKey) {
      advancedPlaybackState.lastTransitionSoundKey = transitionSoundKey
      interactionAudio.playBackgroundTransition?.(transition.type)
    }
  }
  updateBgmVolumes(now, Boolean(transition))
}

const drawCover = (renderContext, source, sourceWidth, sourceHeight) => {
  if (!source || !sourceWidth || !sourceHeight) return

  const scale = Math.max(STAGE_WIDTH / sourceWidth, STAGE_HEIGHT / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  const x = (STAGE_WIDTH - width) / 2
  const y = (STAGE_HEIGHT - height) / 2
  renderContext.drawImage(source, x, y, width, height)
}

const drawPlaceholderBackground = (renderContext, time) => {
  const gradient = renderContext.createLinearGradient(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  gradient.addColorStop(0, '#07111d')
  gradient.addColorStop(0.48, '#0f1a24')
  gradient.addColorStop(1, '#04070b')
  renderContext.fillStyle = gradient
  renderContext.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  renderContext.save()
  renderContext.globalAlpha = 0.14
  renderContext.strokeStyle = '#9cc9ff'
  renderContext.lineWidth = 1
  const drift = (time * 0.02) % 80
  for (let x = -80 + drift; x < STAGE_WIDTH + 80; x += 80) {
    renderContext.beginPath()
    renderContext.moveTo(x, 0)
    renderContext.lineTo(x + 160, STAGE_HEIGHT)
    renderContext.stroke()
  }
  renderContext.restore()
}

const isAdvancedPreviewEnabled = () => (
  runtimeState.preview?.enabled === true
  && runtimeState.preview?.advancedFeaturesEnabled === true
)

const getBackgroundTransitionTiming = (transition) => (
  BACKGROUND_TRANSITION_TIMINGS[transition] ?? { closeMs: 0, openMs: 0 }
)

const getRandomBackgroundIndex = (group, backgrounds, activeIndex, cycle) => {
  if (backgrounds.length <= 1 || cycle <= 0) return activeIndex

  const preview = runtimeState.preview ?? {}
  const key = `${group.groupId}:${preview.replayId}:${activeIndex}:${backgrounds.map((item) => item.assetId).join(',')}`
  if (randomBackgroundState.key !== key) {
    randomBackgroundState = { key, indices: [activeIndex] }
  }

  while (randomBackgroundState.indices.length <= cycle) {
    const nextCycle = randomBackgroundState.indices.length
    const previousIndex = randomBackgroundState.indices[nextCycle - 1]
    const offset = 1 + (hashString(`${key}:${nextCycle}`) % (backgrounds.length - 1))
    randomBackgroundState.indices.push((previousIndex + offset) % backgrounds.length)
  }
  return randomBackgroundState.indices[cycle]
}

const getBackgroundAtCycle = (group, backgrounds, activeIndex, mode, cycle) => {
  const safeCycle = Math.max(0, cycle)
  if (mode === 'sequence') {
    return backgrounds[(activeIndex + safeCycle) % backgrounds.length]
  }
  if (mode === 'random') {
    return backgrounds[getRandomBackgroundIndex(group, backgrounds, activeIndex, safeCycle)]
  }
  return backgrounds[activeIndex] ?? backgrounds[0]
}

const getBackgroundPlaybackSchedule = (group, backgrounds, activeIndex, mode, intervalMs, preview, now) => {
  const key = [
    group.groupId,
    preview.replayId,
    group.activeBackgroundId ?? '',
    activeIndex,
    mode,
    intervalMs,
    isAdvancedPreviewEnabled(),
    preview.backgroundTransition ?? '',
    group.backgroundTransition ?? 'none',
    backgrounds.map((background) => `${background.assetId}:${background.backgroundTransition ?? ''}`).join(',')
  ].join('|')

  if (backgroundPlaybackScheduleState.key !== key) {
    backgroundPlaybackScheduleState = resolveDynamicBackgroundPlaybackEpoch(
      backgroundPlaybackScheduleState,
      key,
      now
    )
    backgroundPlaybackScheduleState.entries = []
  }

  const getEntry = (ordinal) => {
    while (backgroundPlaybackScheduleState.entries.length < ordinal) {
      const nextOrdinal = backgroundPlaybackScheduleState.entries.length + 1
      const targetBackground = getBackgroundAtCycle(group, backgrounds, activeIndex, mode, nextOrdinal)
      const transitionType = isAdvancedPreviewEnabled()
        ? targetBackground?.backgroundTransition ?? preview.backgroundTransition ?? group.backgroundTransition ?? 'none'
        : 'none'
      const timing = getBackgroundTransitionTiming(transitionType)
      const previousEntry = backgroundPlaybackScheduleState.entries[nextOrdinal - 2]
      const startsAtMs = previousEntry?.nextStartsAtMs ?? intervalMs
      backgroundPlaybackScheduleState.entries.push({
        ordinal: nextOrdinal,
        targetBackground,
        transitionType,
        timing,
        startsAtMs,
        nextStartsAtMs: startsAtMs + Math.max(intervalMs, timing.closeMs + timing.openMs + 120)
      })
    }
    return backgroundPlaybackScheduleState.entries[ordinal - 1]
  }

  return { getEntry }
}

const getBackgroundPlaybackFrame = (group, now) => {
  const backgrounds = group?.backgrounds ?? []
  if (backgrounds.length === 0) {
    fixedBackgroundEpochState = { key: '', changedAt: 0 }
    return {
      background: null,
      nextBackground: null,
      cycle: 0,
      changedAt: previewStartTime,
      transition: null
    }
  }

  const preview = runtimeState.preview ?? {}
  const mode = preview.backgroundPlayMode ?? group.backgroundPlayMode ?? 'fixed'
  const activeIndex = getDynamicBackgroundPlaybackStartIndex(
    backgrounds,
    group.activeBackgroundId,
    'fixed'
  )
  if (!preview.enabled || mode === 'fixed' || backgrounds.length === 1) {
    const activeBackground = backgrounds[activeIndex] ?? backgrounds[0]
    const fixedBackgroundKey = getDynamicFixedBackgroundEpochKey({
      sessionKey: advancedPlaybackState.sessionKey,
      groupId: group.groupId,
      replayId: preview.replayId ?? 0,
      backgroundId: activeBackground?.assetId ?? 'none'
    })
    fixedBackgroundEpochState = resolveDynamicFixedBackgroundEpoch(
      fixedBackgroundEpochState,
      fixedBackgroundKey,
      now
    )
    return {
      background: activeBackground,
      nextBackground: null,
      cycle: 0,
      changedAt: fixedBackgroundEpochState.changedAt || previewStartTime,
      transition: null
    }
  }

  const intervalMs = clamp(
    Number(preview.backgroundIntervalMs ?? group.backgroundIntervalMs ?? 5000),
    1000,
    600000
  )
  const playbackStartIndex = getDynamicBackgroundPlaybackStartIndex(
    backgrounds,
    group.activeBackgroundId,
    mode
  )
  const schedule = getBackgroundPlaybackSchedule(
    group,
    backgrounds,
    playbackStartIndex,
    mode,
    intervalMs,
    preview,
    now
  )
  const scheduleStartedAt = backgroundPlaybackScheduleState.startedAt || previewStartTime
  const elapsedMs = Math.max(0, now - scheduleStartedAt)
  let transitionOrdinal = 1
  let entry = schedule.getEntry(transitionOrdinal)
  while (elapsedMs >= entry.nextStartsAtMs) {
    transitionOrdinal += 1
    entry = schedule.getEntry(transitionOrdinal)
  }

  const previousEntry = transitionOrdinal > 1 ? schedule.getEntry(transitionOrdinal - 1) : null
  const fromBackground = getBackgroundAtCycle(group, backgrounds, playbackStartIndex, mode, transitionOrdinal - 1)
  const toBackground = entry.targetBackground

  if (elapsedMs < entry.startsAtMs) {
    return {
      background: fromBackground,
      nextBackground: toBackground,
      cycle: transitionOrdinal - 1,
      changedAt: previousEntry
        ? scheduleStartedAt + previousEntry.startsAtMs + previousEntry.timing.closeMs
        : scheduleStartedAt,
      transition: null
    }
  }

  const phaseElapsedMs = elapsedMs - entry.startsAtMs
  const transitionDurationMs = entry.timing.closeMs + entry.timing.openMs
  const switched = phaseElapsedMs >= entry.timing.closeMs
  const cycle = transitionOrdinal - (switched ? 0 : 1)
  const transitionActive = entry.transitionType !== 'none' && phaseElapsedMs < transitionDurationMs
  const transitionStartedAt = scheduleStartedAt + entry.startsAtMs

  return {
    background: switched ? toBackground : fromBackground,
    nextBackground: toBackground,
    cycle,
    changedAt: switched
      ? transitionStartedAt + entry.timing.closeMs
      : transitionOrdinal === 1
        ? previewStartTime
        : scheduleStartedAt + previousEntry.startsAtMs + previousEntry.timing.closeMs,
    transition: transitionActive
      ? {
          type: entry.transitionType,
          phase: switched ? 'opening' : 'closing',
          elapsedMs: phaseElapsedMs,
          phaseElapsedMs: switched ? phaseElapsedMs - entry.timing.closeMs : phaseElapsedMs,
          closeMs: entry.timing.closeMs,
          openMs: entry.timing.openMs,
          ordinal: transitionOrdinal,
          fromBackground,
          toBackground,
          startedAt: transitionStartedAt
        }
      : null
  }
}

const drawBackground = (renderContext, activeBackground, time) => {
  const asset = getAsset(activeBackground?.assetId)

  if (!asset?.url) {
    drawPlaceholderBackground(renderContext, time)
    return {
      textureKey: `placeholder:${activeBackground?.assetId ?? 'none'}`,
      textureIsDynamic: true
    }
  }

  if (asset.mediaType === 'video') {
    const video = getVideo(asset)
    if (video?.loaded && video.element.readyState >= 2) {
      if (lastDrawnBackgroundAssetId !== activeBackground.assetId) {
        video.element.currentTime = 0
        video.element.play().catch(() => {})
      }
      lastDrawnBackgroundAssetId = activeBackground.assetId
      drawCover(renderContext, video.element, video.width, video.height)
      return {
        textureKey: `video:${asset.assetId}:${asset.updatedAt ?? 0}`,
        textureIsDynamic: true
      }
    }
  } else {
    const image = getImage(asset)
    if (image?.loaded) {
      lastDrawnBackgroundAssetId = activeBackground.assetId
      drawCover(renderContext, image.element, image.width, image.height)
      return {
        textureKey: `image:${asset.assetId}:${asset.updatedAt ?? 0}`,
        textureIsDynamic: false
      }
    }
  }

  drawPlaceholderBackground(renderContext, time)
  return {
    textureKey: `loading:${asset.assetId}:${asset.updatedAt ?? 0}`,
    textureIsDynamic: true
  }
}

const drawCurtainPanel = (renderContext, x, width, isLeft) => {
  if (width <= 0) return

  const gradient = renderContext.createLinearGradient(x, 0, x + width, 0)
  const edgeColor = isLeft ? '#76102f' : '#e05468'
  const centerColor = isLeft ? '#e05468' : '#76102f'
  gradient.addColorStop(0, edgeColor)
  gradient.addColorStop(0.42, '#b51d43')
  gradient.addColorStop(1, centerColor)
  renderContext.fillStyle = gradient
  renderContext.fillRect(x, -42, width, STAGE_HEIGHT + 84)

  renderContext.save()
  renderContext.globalAlpha = 0.22
  for (let stripeX = x + 28; stripeX < x + width; stripeX += 64) {
    renderContext.fillStyle = stripeX % 128 < 64 ? '#fff3ee' : '#4b061d'
    renderContext.fillRect(stripeX, -42, 24, STAGE_HEIGHT + 84)
  }
  renderContext.restore()

  renderContext.fillStyle = '#efbd5a'
  renderContext.fillRect(isLeft ? x + width - 5 : x, -42, 5, STAGE_HEIGHT + 84)
}

const drawCurtainTransition = (renderContext, transition) => {
  const duration = transition.phase === 'closing' ? transition.closeMs : transition.openMs
  const phaseProgress = easeOutCubic(clamp(transition.phaseElapsedMs / Math.max(1, duration), 0, 1))
  const coverage = transition.phase === 'closing' ? phaseProgress : 1 - phaseProgress
  const panelWidth = STAGE_WIDTH * 0.505 * coverage

  drawCurtainPanel(renderContext, 0, panelWidth, true)
  drawCurtainPanel(renderContext, STAGE_WIDTH - panelWidth, panelWidth, false)

  const valanceAlpha = transition.phase === 'closing'
    ? clamp(coverage * 1.35, 0, 1)
    : clamp(coverage * 1.65, 0, 1)
  if (valanceAlpha <= 0) return

  renderContext.save()
  renderContext.globalAlpha = valanceAlpha
  const valance = renderContext.createLinearGradient(0, 0, 0, STAGE_HEIGHT * 0.2)
  valance.addColorStop(0, '#d73b58')
  valance.addColorStop(1, '#971631')
  renderContext.fillStyle = valance
  renderContext.beginPath()
  renderContext.moveTo(-40, -20)
  renderContext.lineTo(STAGE_WIDTH + 40, -20)
  renderContext.lineTo(STAGE_WIDTH + 40, STAGE_HEIGHT * 0.11)
  renderContext.quadraticCurveTo(STAGE_WIDTH / 2, STAGE_HEIGHT * 0.25, -40, STAGE_HEIGHT * 0.11)
  renderContext.closePath()
  renderContext.fill()
  renderContext.strokeStyle = '#efbd5a'
  renderContext.lineWidth = 8
  renderContext.stroke()
  renderContext.restore()
}

const drawCameraFlashTransition = (renderContext, transition) => {
  const duration = transition.phase === 'closing' ? transition.closeMs : transition.openMs
  const phaseProgress = clamp(transition.phaseElapsedMs / Math.max(1, duration), 0, 1)
  const alpha = transition.phase === 'closing'
    ? smoothstep(phaseProgress)
    : 1 - smoothstep(phaseProgress)
  if (alpha <= 0) return

  renderContext.save()
  renderContext.globalCompositeOperation = 'screen'
  renderContext.globalAlpha = alpha
  renderContext.fillStyle = '#ffffff'
  renderContext.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  renderContext.restore()
}

const drawShadowPlayTransition = (renderContext, transition) => {
  const duration = transition.phase === 'closing' ? transition.closeMs : transition.openMs
  const phaseProgress = easeOutCubic(clamp(transition.phaseElapsedMs / Math.max(1, duration), 0, 1))
  const coverage = transition.phase === 'closing' ? phaseProgress : 1 - phaseProgress
  const clothWidth = STAGE_WIDTH * 1.04 * coverage
  if (clothWidth <= 0) return

  const cloth = renderContext.createLinearGradient(0, 0, Math.max(1, clothWidth), 0)
  cloth.addColorStop(0, '#e2cc91')
  cloth.addColorStop(0.62, '#f5e9c8')
  cloth.addColorStop(1, '#d2b36e')
  renderContext.fillStyle = cloth
  renderContext.fillRect(-20, -22, clothWidth, STAGE_HEIGHT + 44)

  renderContext.save()
  renderContext.globalAlpha = 0.13
  renderContext.strokeStyle = '#6d4c24'
  renderContext.lineWidth = 2
  for (let y = 8; y < STAGE_HEIGHT; y += 17) {
    renderContext.beginPath()
    renderContext.moveTo(-20, y)
    renderContext.lineTo(clothWidth - 20, y + Math.sin(y * 0.04) * 4)
    renderContext.stroke()
  }
  renderContext.restore()

  renderContext.fillStyle = '#684824'
  renderContext.fillRect(clothWidth - 26, -30, 12, STAGE_HEIGHT + 60)
  renderContext.fillStyle = 'rgba(255, 255, 255, 0.17)'
  renderContext.fillRect(clothWidth - 24, -30, 3, STAGE_HEIGHT + 60)
}

const drawTransitionLogo = (renderContext, transition) => {
  if (!transitionLogo.loaded || transitionLogo.failed || !transition) return
  const phaseDuration = transition.phase === 'closing' ? transition.closeMs : transition.openMs
  const phaseProgress = clamp(transition.phaseElapsedMs / Math.max(1, phaseDuration), 0, 1)
  const fadeIn = transition.phase === 'closing'
    ? smoothstep(clamp((phaseProgress - 0.58) / 0.42, 0, 1))
    : 1
  const fadeOut = transition.phase === 'opening'
    ? 1 - smoothstep(clamp(phaseProgress / 0.46, 0, 1))
    : 1
  const alpha = clamp(fadeIn * fadeOut, 0, 1)
  if (alpha <= 0.001) return

  const sourceWidth = transitionLogo.element.naturalWidth || 1372
  const sourceHeight = transitionLogo.element.naturalHeight || 716
  const maxWidth = STAGE_WIDTH * 0.42
  const maxHeight = STAGE_HEIGHT * 0.22
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  let drawX = (STAGE_WIDTH - width) / 2

  renderContext.save()
  renderContext.globalAlpha = alpha
  if (transition.type === 'cameraFlash') {
    renderContext.globalCompositeOperation = 'multiply'
    renderContext.filter = 'brightness(0.18) contrast(1.2)'
  } else if (transition.type === 'shadowPlay') {
    const easedProgress = easeOutCubic(phaseProgress)
    const coverage = transition.phase === 'closing' ? easedProgress : 1 - easedProgress
    const clothWidth = STAGE_WIDTH * 1.04 * coverage
    renderContext.beginPath()
    renderContext.rect(-20, -22, Math.max(0, clothWidth), STAGE_HEIGHT + 44)
    renderContext.clip()
    drawX = (clothWidth - width) / 2 - 10
    renderContext.filter = 'brightness(0.34) contrast(1.1)'
    renderContext.shadowColor = 'rgba(65, 42, 17, 0.34)'
    renderContext.shadowBlur = 20
  } else {
    renderContext.shadowColor = 'rgba(0, 0, 0, 0.35)'
    renderContext.shadowBlur = 24
  }
  renderContext.drawImage(
    transitionLogo.element,
    drawX,
    (STAGE_HEIGHT - height) / 2,
    width,
    height
  )
  renderContext.restore()
}

const drawBackgroundTransition = (renderContext, backgroundFrame) => {
  const transition = backgroundFrame?.transition
  if (!transition) return

  renderContext.save()
  if (transition.type === 'curtain') drawCurtainTransition(renderContext, transition)
  if (transition.type === 'cameraFlash') drawCameraFlashTransition(renderContext, transition)
  if (transition.type === 'shadowPlay') drawShadowPlayTransition(renderContext, transition)
  drawTransitionLogo(renderContext, transition)
  renderContext.restore()
}

const addBackgroundRipple = (x, y, startedAt) => {
  ripples = [
    ...ripples.slice(-(MAX_WATER_RIPPLES - 1)),
    { x, y, startedAt }
  ]
}

const drawBackgroundRipples = (now) => {
  if (ripples.length === 0) return

  context.save()
  context.globalCompositeOperation = 'screen'

  ripples.forEach((ripple) => {
    const sample = sampleRipple(ripple, now)
    if (!sample) return

    if (sample.centerAlpha > 0) {
      context.globalAlpha = 1
      const gradient = context.createRadialGradient(
        sample.x,
        sample.y,
        0,
        sample.x,
        sample.y,
        sample.centerRadius
      )
      gradient.addColorStop(0, `rgba(220, 250, 255, ${sample.centerAlpha})`)
      gradient.addColorStop(0.46, `rgba(118, 213, 255, ${sample.centerAlpha * 0.48})`)
      gradient.addColorStop(1, 'rgba(84, 170, 255, 0)')
      context.fillStyle = gradient
      context.beginPath()
      context.arc(sample.x, sample.y, sample.centerRadius, 0, Math.PI * 2)
      context.fill()
    }

    sample.rings.forEach((ring, index) => {
      context.globalAlpha = ring.alpha
      context.strokeStyle = index === 0 ? '#d8fbff' : '#75c9ff'
      context.lineWidth = ring.lineWidth
      context.beginPath()
      context.arc(sample.x, sample.y, ring.radius, 0, Math.PI * 2)
      context.stroke()
    })
  })

  context.restore()
}

const getPreviewAppearAlpha = (item, itemIndex, now) => {
  const preview = runtimeState.preview ?? {}
  if (!preview.enabled) return 1

  const elapsed = now - previewStartTime
  const appearMode = preview.appearMode ?? getActiveGroup()?.appearMode ?? 'all'
  const intervalMs = preview.intervalMs ?? getActiveGroup()?.appearIntervalMs ?? 800
  const fadeMs = 420
  const explicitDelayMs = Math.max(0, Number(item.appearanceDelayMs) || 0)

  if (appearMode === 'sequence') {
    const delay = Number.isFinite(Number(item.appearanceDelayMs))
      ? explicitDelayMs
      : itemIndex * intervalMs
    return smoothstep((elapsed - delay) / fadeMs)
  }

  return smoothstep((elapsed - explicitDelayMs) / fadeMs)
}

const getVisibleItemsForPlayback = (group, backgroundFrame) => {
  const items = getOrderedItems(group)
  return getDynamicStageItemsForBackground(items, backgroundFrame?.background)
}

const getAppearanceContextSignature = (items, backgroundFrame) => {
  const preview = runtimeState.preview ?? {}
  const group = getActiveGroup()
  const background = backgroundFrame?.background
  const backgroundId = background?.assetId ?? ''
  const backgroundAppearance = getDynamicBackgroundAppearanceForGroup({
    ...group,
    appearMode: preview.appearMode ?? group?.appearMode,
    appearIntervalMs: preview.intervalMs ?? group?.appearIntervalMs,
    appearAnimation: preview.appearAnimation ?? group?.appearAnimation
  }, background)
  const backgroundEpochKey = [
    advancedPlaybackState.sessionKey,
    backgroundFrame?.cycle ?? 0,
    backgroundId || 'none',
    Math.round(backgroundFrame?.changedAt ?? previewStartTime)
  ].join(':')
  const itemSignature = items.map((item) => {
    const timing = getDynamicAppearanceTimingForBackground(item, backgroundId)
    const appearanceHideMs = timing
      && Object.prototype.hasOwnProperty.call(timing, 'appearanceHideMs')
      ? timing.appearanceHideMs
      : item.appearanceHideMs ?? ''
    return [
      item.itemId,
      timing?.appearanceDelayMs ?? item.appearanceDelayMs ?? 0,
      appearanceHideMs,
      item.hideAfterTarget === true ? 1 : 0,
      item.linkedAppearance?.triggerItemId ?? '',
      item.linkedAppearance?.mode ?? '',
      item.linkedAppearance?.delayMs ?? 0
    ].join(':')
  }).join('|')
  const appearAnimation = backgroundAppearance.appearAnimation
  const contextKey = [
    backgroundEpochKey,
    backgroundAppearance.appearMode,
    backgroundAppearance.appearIntervalMs,
    appearAnimation,
    itemSignature
  ].join('|')
  return {
    backgroundEpochKey,
    contextKey,
    appearAnimation,
    appearMode: backgroundAppearance.appearMode,
    intervalMs: backgroundAppearance.appearIntervalMs,
    backgroundId
  }
}

const syncItemAppearanceTimeline = (items, backgroundFrame, now) => {
  if (!isAdvancedPreviewEnabled()) {
    advancedPlaybackState.appearanceContextKey = ''
    advancedPlaybackState.appearanceBackgroundEpochKey = ''
    advancedPlaybackState.itemEpochs.clear()
    return
  }

  const {
    backgroundEpochKey,
    contextKey,
    appearAnimation,
    appearMode,
    intervalMs,
    backgroundId
  } = getAppearanceContextSignature(items, backgroundFrame)
  if (advancedPlaybackState.appearanceContextKey === contextKey) return

  const previousEpochs = advancedPlaybackState.itemEpochs
  const activeItemIds = new Set()
  items.forEach((item) => {
    if (item.linkedAppearance) return
    const previousEpoch = previousEpochs.get(item.itemId)
    if (!previousEpoch) return
    const previousSample = sampleDynamicAppearanceTimeline(
      previousEpoch.schedule,
      Math.max(0, now - previousEpoch.startedAt)
    )
    if (previousSample.interactive) activeItemIds.add(item.itemId)
  })

  const timeline = buildDynamicAppearanceTimeline({
    items,
    appearMode,
    intervalMs,
    appearAnimation,
    activeItemIds,
    backgroundId
  })
  const continuableItemIds = getContinuableDynamicAppearanceItemIds({
    items,
    previousEpochs,
    timeline,
    activeItemIds
  })
  const epochStartedAt = backgroundFrame?.changedAt ?? previewStartTime
  const nextEpochs = new Map()

  items.forEach((item) => {
    const schedule = timeline[item.itemId]
    if (!schedule) return
    const previousEpoch = previousEpochs.get(item.itemId)
    if (continuableItemIds.has(item.itemId) && previousEpoch) {
      nextEpochs.set(item.itemId, {
        ...previousEpoch,
        backgroundEpochKey
      })
      return
    }

    advancedPlaybackState.appearanceEpochCounter += 1
    nextEpochs.set(item.itemId, {
      key: `${backgroundEpochKey}:${advancedPlaybackState.appearanceEpochCounter}`,
      startedAt: epochStartedAt,
      schedule,
      backgroundEpochKey
    })
  })

  advancedPlaybackState.appearanceContextKey = contextKey
  advancedPlaybackState.appearanceBackgroundEpochKey = backgroundEpochKey
  advancedPlaybackState.itemEpochs = nextEpochs
}

const getItemAppearanceSample = (item, itemIndex, now) => {
  if (!isAdvancedPreviewEnabled()) {
    const alpha = getPreviewAppearAlpha(item, itemIndex, now)
    const preview = runtimeState.preview ?? {}
    const intervalMs = preview.intervalMs ?? getActiveGroup()?.appearIntervalMs ?? 800
    const delayMs = Number.isFinite(Number(item.appearanceDelayMs))
      ? Math.max(0, Number(item.appearanceDelayMs))
      : preview.appearMode === 'sequence'
        ? itemIndex * intervalMs
        : 0
    return {
      alpha,
      active: alpha > 0.001,
      interactive: alpha > 0.04,
      animationElapsedMs: preview.enabled
        ? Math.max(0, now - previewStartTime - delayMs)
        : Number.POSITIVE_INFINITY,
      schedule: null,
      epoch: null
    }
  }

  const epoch = advancedPlaybackState.itemEpochs.get(item.itemId)
  if (!epoch) {
    return {
      alpha: 0,
      active: false,
      interactive: false,
      animationElapsedMs: 0,
      schedule: null,
      epoch: null
    }
  }
  return {
    ...sampleDynamicAppearanceTimeline(epoch.schedule, Math.max(0, now - epoch.startedAt)),
    schedule: epoch.schedule,
    epoch
  }
}

const getAdvancedItemPlaybackState = (item, itemIndex, now, image, backgroundFrame, appearanceSample) => {
  if (!isAdvancedPreviewEnabled()) {
    return {
      x: 0,
      y: 0,
      alpha: appearanceSample.alpha,
      interactive: appearanceSample.interactive,
      animationElapsedMs: appearanceSample.animationElapsedMs,
      silhouette: false,
      targetActive: false
    }
  }

  const schedule = appearanceSample.schedule
  const appearAnimation = schedule?.appearAnimation ?? 'none'
  const appearanceProgress = appearanceSample.alpha
  const size = getItemBaseSize(item, image)
  const numericScale = Number(item.scale ?? 1)
  const itemScale = Number.isFinite(numericScale) ? Math.max(Math.abs(numericScale), 0.05) : 1
  const halfWidth = size.width * itemScale / 2
  const halfHeight = size.height * itemScale / 2
  const positionX = clamp(Number(item.position?.x ?? 0.5), -0.5, 1.5)
  const positionY = clamp(Number(item.position?.y ?? 0.5), -0.5, 1.5)
  let appearanceX = 0
  let appearanceY = 0

  if (appearAnimation === 'drop') {
    const fromY = -(positionY * STAGE_HEIGHT + halfHeight + 72)
    appearanceY = lerp(fromY, 0, appearanceProgress)
  } else if (appearAnimation === 'trackSlide') {
    const fromRight = getMoveTrack(item) === 'middle'
    const fromX = fromRight
      ? (1 - positionX) * STAGE_WIDTH + halfWidth + 72
      : -(positionX * STAGE_WIDTH + halfWidth + 72)
    appearanceX = lerp(fromX, 0, appearanceProgress)
  }

  const targetActive = item.targetMode === 'target' && item.targetPosition
  let targetX = 0
  let targetY = 0
  let targetHidden = false
  if (targetActive) {
    const targetDurationMs = getTargetMotionDurationMs(item.moveSpeed, 3.8)
    const targetElapsedMs = appearanceSample.animationElapsedMs
    const targetState = sampleTargetMotionState(
      targetElapsedMs,
      targetDurationMs,
      {
        loop: item.targetLoop === true,
        hideAfterTarget: item.hideAfterTarget === true,
        settleMs: TARGET_ARRIVAL_SETTLE_MS
      }
    )
    targetX = (Number(item.targetPosition.x) - positionX) * STAGE_WIDTH * targetState.progress
    targetY = (Number(item.targetPosition.y) - positionY) * STAGE_HEIGHT * targetState.progress
    targetHidden = targetState.hidden
  }

  const transition = backgroundFrame?.transition
  let transitionX = 0
  let silhouette = false
  if (transition?.type === 'shadowPlay') {
    silhouette = true
    const fromRight = getMoveTrack(item) === 'middle'
    const outsideX = fromRight
      ? (1 - positionX) * STAGE_WIDTH + halfWidth + 96
      : -(positionX * STAGE_WIDTH + halfWidth + 96)
    if (transition.phase === 'closing') {
      const progress = easeOutCubic(clamp(transition.phaseElapsedMs / Math.min(560, transition.closeMs), 0, 1))
      transitionX = outsideX * progress
    } else {
      const progress = easeOutCubic(clamp(transition.phaseElapsedMs / Math.min(620, transition.openMs), 0, 1))
      transitionX = outsideX * (1 - progress)
    }
    appearanceX = 0
    appearanceY = 0
  }

  return {
    x: appearanceX + targetX + transitionX,
    y: appearanceY + targetY,
    alpha: targetHidden ? 0 : clamp(appearanceSample.alpha, 0, 1),
    interactive: !targetHidden && appearanceSample.interactive,
    animationElapsedMs: appearanceSample.animationElapsedMs,
    silhouette,
    targetActive: Boolean(targetActive)
  }
}

const speedToCycleSeconds = (speed, baseSeconds = 5.5) => {
  const normalized = clamp(Number(speed ?? 50), 1, 100) / 100
  return lerp(baseSeconds * 1.55, baseSeconds * 0.46, normalized)
}

const getMoveTrack = (item) => {
  if (item.moveTrack === 'top' || item.moveTrack === 'middle' || item.moveTrack === 'bottom') {
    return item.moveTrack
  }

  const positionY = Number(item.position?.y ?? 0.5)
  if (positionY < 1 / 3) return 'top'
  if (positionY > 2 / 3) return 'bottom'
  return 'middle'
}

const resolvePreviewMotionMode = (item, preview) => {
  if (item.moveMode !== 'random') return item.moveMode
  const groupId = preview.groupId || runtimeState.activeGroupId || ''
  const key = `${groupId}:${item.itemId}:${preview.replayId || 0}`
  return RANDOM_PREVIEW_MOTION_MODES[mixHash(hashString(key)) % RANDOM_PREVIEW_MOTION_MODES.length]
}

const getMotionTransform = (item, itemIndex, now, animationElapsedMs) => {
  const preview = runtimeState.preview ?? {}
  const motionMode = resolvePreviewMotionMode(item, preview)
  if (!preview.enabled || motionMode === 'none') {
    return {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0
    }
  }

  const cycleSeconds = speedToCycleSeconds(item.moveSpeed)
  const usesAppearanceTimeline = isAdvancedPreviewEnabled() && Number.isFinite(animationElapsedMs)
  const playbackTimeSeconds = usesAppearanceTimeline
    ? Math.max(0, animationElapsedMs) / 1000
    : now / 1000
  if (motionMode === 'verticalWave') {
    const intervalMs = preview.intervalMs ?? getActiveGroup()?.appearIntervalMs ?? 800
    const appearDelayMs = preview.appearMode === 'sequence' ? itemIndex * intervalMs : 0
    const elapsedMs = usesAppearanceTimeline
      ? Math.max(0, animationElapsedMs)
      : now - previewStartTime - appearDelayMs
    const { waveUp, waveDown } = getDynamicVerticalWaveOffsets(item, STAGE_HEIGHT)
    const progress = elapsedMs <= 0 ? 0 : elapsedMs / 1000 / cycleSeconds

    return {
      x: 0,
      y: sampleDynamicVerticalWave(progress, waveDown, waveUp),
      scale: 1,
      rotation: 0
    }
  }

  const baseX = clamp(item.position?.x ?? 0.5, -0.2, 1.2) * STAGE_WIDTH

  switch (motionMode) {
    case 'left':
    case 'right': {
      const progress = (playbackTimeSeconds / speedToCycleSeconds(item.moveSpeed, 8.5)) % 1
      const point = sampleDynamicHorizontalMotion(
        motionMode,
        progress,
        item.movePercent,
        { width: STAGE_WIDTH, height: STAGE_HEIGHT }
      )
      return {
        x: point.x - baseX,
        y: point.y,
        scale: 1,
        rotation: 0
      }
    }

    case 'orbit': {
      const point = sampleDynamicOrbitMotion(
        item,
        playbackTimeSeconds / cycleSeconds,
        { width: STAGE_WIDTH, height: STAGE_HEIGHT }
      )
      return {
        x: point.x,
        y: point.y,
        scale: 1,
        rotation: 0
      }
    }

    default:
      return {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0
      }
  }
}

const getBaseImageSize = (imageEntry) => {
  const naturalWidth = imageEntry?.width || 360
  const naturalHeight = imageEntry?.height || 260
  const maxSize = 380
  const minSize = 120
  let ratio = maxSize / Math.max(naturalWidth, naturalHeight)

  if (Math.max(naturalWidth, naturalHeight) < minSize) {
    ratio = minSize / Math.max(naturalWidth, naturalHeight)
  } else {
    ratio = Math.min(ratio, 1)
  }

  return {
    width: naturalWidth * ratio,
    height: naturalHeight * ratio
  }
}

const getItemBaseSize = (item, imageEntry) => (
  isBubbleItem(item) ? getBubbleSize(item.bubble) : getBaseImageSize(imageEntry)
)

const drawMissingItem = (item, renderState) => {
  context.save()
  context.globalAlpha = renderState.alpha
  if (renderState.silhouette) context.filter = 'brightness(0) opacity(0.82)'
  context.translate(renderState.x, renderState.y)
  context.fillStyle = 'rgba(255, 255, 255, 0.08)'
  context.strokeStyle = 'rgba(255, 255, 255, 0.24)'
  context.lineWidth = 2
  context.beginPath()
  context.roundRect(-80, -60, 160, 120, 18)
  context.fill()
  context.stroke()
  context.fillStyle = 'rgba(255, 255, 255, 0.72)'
  context.font = '24px Microsoft JhengHei, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(item.assetId ? '素材載入中' : '缺少素材', 0, 0)
  context.restore()
}

const getEffectiveAnimation = (item, now, animationElapsedMs) => {
  const preview = runtimeState.preview ?? {}
  const override = animationOverrides.get(runtimeState.activeGroupId, item)
  if (override) {
    const oneShotDuration = UNITY_CLICK_ONE_SHOT_DURATION_BY_ID.get(override.activeAnimationId)
    if (isAnimationOverrideComplete(override, now, oneShotDuration)) {
      animationOverrides.complete(runtimeState.activeGroupId, item.itemId, override.startedAt)
    } else {
      return {
        animationId: override.activeAnimationId,
        timeSeconds: Math.max(0, now - override.startedAt) / 1000
      }
    }
  }

  if (!preview.enabled) {
    return {
      animationId: 0,
      timeSeconds: 0
    }
  }

  const mode = getDynamicAnimationMode(item)
  const animationId = Number(
    preview.resolvedAnimationIds?.[item.itemId]
    ?? resolveDynamicAnimationId(
      mode,
      item.animationId,
      DYNAMIC_ANIMATION_IDS,
      `${preview.groupId ?? runtimeState.activeGroupId ?? ''}:${item.itemId}:${preview.replayId ?? 0}`
    )
  )

  const elapsedSeconds = isAdvancedPreviewEnabled() && Number.isFinite(animationElapsedMs)
    ? Math.max(0, animationElapsedMs) / 1000
    : Math.max(0, now - previewStartTime) / 1000
  const previewDuration = UNITY_PREVIEW_DURATION_BY_ID.get(animationId) ?? 0

  return {
    animationId,
    timeSeconds: previewDuration > 0
      ? elapsedSeconds % previewDuration
      : elapsedSeconds
  }
}

const getItemRenderState = (item, itemIndex, now, image, backgroundFrame) => {
  const appearanceSample = getItemAppearanceSample(item, itemIndex, now)
  const effectiveAnimation = getEffectiveAnimation(item, now, appearanceSample.animationElapsedMs)
  const animation = effectiveAnimation.animationId >= UNITY_EXTRA_ANIMATION_MIN_ID
    && effectiveAnimation.animationId <= UNITY_EXTRA_ANIMATION_MAX_ID
    ? {
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        scaleX: 1,
        scaleY: 1,
        alpha: 1
      }
    : sampleItemAnimation(
        effectiveAnimation.animationId,
        item.itemId,
        effectiveAnimation.timeSeconds
      )
  const advanced = getAdvancedItemPlaybackState(
    item,
    itemIndex,
    now,
    image,
    backgroundFrame,
    appearanceSample
  )
  const motion = advanced.targetActive
    ? { x: 0, y: 0, scale: 1, rotation: 0 }
    : getMotionTransform(item, itemIndex, now, advanced.animationElapsedMs)
  const baseX = clamp(item.position?.x ?? 0.5, -0.5, 1.5) * STAGE_WIDTH
  const baseY = clamp(item.position?.y ?? 0.5, -0.5, 1.5) * STAGE_HEIGHT
  const numericScale = Number(item.scale ?? 1)
  const baseScale = Number.isFinite(numericScale) ? numericScale : 1
  const flipX = item.flipX ? -1 : 1
  const flipY = item.flipY ? -1 : 1
  const appearAlpha = advanced.alpha

  return {
    x: baseX + motion.x + animation.offsetX + advanced.x,
    y: baseY + motion.y + animation.offsetY + advanced.y,
    rotation: degToRad(Number(item.rotation ?? 0) + motion.rotation + animation.rotation),
    skewX: animation.skewX,
    skewY: animation.skewY,
    scaleX: flipX * baseScale * motion.scale * animation.scaleX,
    scaleY: flipY * baseScale * motion.scale * animation.scaleY,
    alpha: clamp(appearAlpha * animation.alpha, 0, 1),
    appearAlpha,
    interactive: advanced.interactive,
    silhouette: advanced.silhouette,
    animationId: effectiveAnimation.animationId,
    animationTimeSeconds: effectiveAnimation.timeSeconds,
    animationElapsedMs: advanced.animationElapsedMs,
    size: getItemBaseSize(item, image)
  }
}

const applyItemRenderTransform = (renderContext, renderState) => {
  renderContext.translate(renderState.x, renderState.y)
  renderContext.rotate(renderState.rotation)
  renderContext.transform(1, renderState.skewY, renderState.skewX, 1, 0, 0)
  renderContext.scale(renderState.scaleX, renderState.scaleY)
}

const drawItemImage = (renderContext, image, renderState) => {
  const { width, height } = renderState.size
  if (renderState.animationId === WALK_ANIMATION_ID) {
    drawWalkImage(
      renderContext,
      image.element,
      -width / 2,
      -height / 2,
      width,
      height,
      renderState.animationTimeSeconds
    )
    return
  }

  if (
    renderState.animationId >= UNITY_EXTRA_ANIMATION_MIN_ID
    && renderState.animationId <= UNITY_EXTRA_ANIMATION_MAX_ID
  ) {
    drawUnityAnimationImage(
      renderContext,
      image.element,
      -width / 2,
      -height / 2,
      width,
      height,
      renderState.animationId,
      renderState.animationTimeSeconds
    )
    return
  }

  renderContext.drawImage(
    image.element,
    -width / 2,
    -height / 2,
    width,
    height
  )
}

const getBubbleImage = (item) => getImage(getAsset(
  item.imageAssetId ?? getBubbleAssetId(item)
))

const drawItemBubble = (renderContext, item, image, renderState) => {
  const bubble = normalizeBubble({
    ...(item.bubble ?? {}),
    imageAssetId: item.imageAssetId ?? item.bubble?.imageAssetId
  })
  renderContext.save()
  renderContext.translate(-renderState.size.width / 2, -renderState.size.height / 2)
  drawBubble(renderContext, bubble, image, renderState.animationElapsedMs)
  renderContext.restore()
}

const drawItemContent = (renderContext, item, image, renderState) => {
  if (isBubbleItem(item)) {
    drawItemBubble(renderContext, item, image, renderState)
    return
  }
  drawItemImage(renderContext, image, renderState)
}

const drawItem = (item, itemIndex, now, backgroundFrame) => {
  if (item.isVisible === false) return

  const bubbleItem = isBubbleItem(item)
  const image = bubbleItem
    ? getBubbleImage(item)
    : getImage(getAsset(item.assetId))
  const renderState = getItemRenderState(item, itemIndex, now, image, backgroundFrame)

  if (!bubbleItem && !image?.loaded) {
    drawMissingItem(item, renderState)
    return
  }

  context.save()
  context.globalAlpha = renderState.alpha
  if (renderState.silhouette) context.filter = 'brightness(0) opacity(0.82)'
  applyItemRenderTransform(context, renderState)
  drawItemContent(context, item, image, renderState)
  context.restore()
}

const getOrderedItems = (group) => {
  return (group?.items ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

const isPointOverItem = (item, itemIndex, now, stagePoint, backgroundFrame) => {
  if (item.isVisible === false || !hitContext) return false

  const bubbleItem = isBubbleItem(item)
  const image = bubbleItem
    ? getBubbleImage(item)
    : getImage(getAsset(item.assetId))
  if (!bubbleItem && !image?.loaded) return false

  const renderState = getItemRenderState(item, itemIndex, now, image, backgroundFrame)
  if (!renderState.interactive) return false

  const maxScale = Math.max(Math.abs(renderState.scaleX), Math.abs(renderState.scaleY))
  const skewPadding = 1 + Math.abs(renderState.skewX) + Math.abs(renderState.skewY)
  const hitRadius = Math.hypot(renderState.size.width, renderState.size.height)
    * 0.58
    * maxScale
    * skewPadding
    + HIT_SAMPLE_SIZE

  if (Math.hypot(stagePoint.x - renderState.x, stagePoint.y - renderState.y) > hitRadius) {
    return false
  }

  try {
    hitContext.setTransform(1, 0, 0, 1, 0, 0)
    hitContext.clearRect(0, 0, HIT_SAMPLE_SIZE, HIT_SAMPLE_SIZE)
    hitContext.save()
    try {
      hitContext.translate(
        HIT_SAMPLE_SIZE / 2 - stagePoint.x,
        HIT_SAMPLE_SIZE / 2 - stagePoint.y
      )
      applyItemRenderTransform(hitContext, renderState)
      drawItemContent(hitContext, item, image, renderState)
    } finally {
      hitContext.restore()
    }

    const pixels = hitContext.getImageData(0, 0, HIT_SAMPLE_SIZE, HIT_SAMPLE_SIZE).data
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] >= HIT_ALPHA_THRESHOLD) return true
    }
  } catch (error) {
    if (!alphaHitWarningShown) {
      alphaHitWarningShown = true
      console.warn('Alpha hit testing is unavailable:', error)
    }
  }

  return false
}

const findTopmostItemAtPoint = (group, now, stagePoint, backgroundFrame) => {
  const items = getVisibleItemsForPlayback(group, backgroundFrame)
  syncItemAppearanceTimeline(items, backgroundFrame, now)
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (isPointOverItem(items[index], index, now, stagePoint, backgroundFrame)) {
      return items[index]
    }
  }
  return null
}

const handleStagePointerDown = (event) => {
  if (isArchiveView() || !previewPresentationReady) return
  if (event.button !== 0 || event.isPrimary === false) return
  if (event.pointerType && event.pointerType !== 'mouse') return

  interactionAudio.unlock()
  const stagePoint = mapClientPointToStage({
    clientX: isHorizontalPointerFlip ? window.innerWidth - event.clientX : event.clientX,
    clientY: isVerticalPointerFlip ? window.innerHeight - event.clientY : event.clientY,
    stageScale,
    stageOffsetX,
    stageOffsetY,
    stageWidth: STAGE_WIDTH,
    stageHeight: STAGE_HEIGHT
  })
  if (!stagePoint) return

  event.preventDefault()
  const now = performance.now()
  const group = getActiveGroup()
  const backgroundFrame = getBackgroundPlaybackFrame(group, now)
  const hitItem = findTopmostItemAtPoint(group, now, stagePoint, backgroundFrame)
  if (!hitItem) {
    addBackgroundRipple(stagePoint.x, stagePoint.y, now)
    return
  }

  const override = animationOverrides.cycle(runtimeState.activeGroupId, hitItem, now)
  if (override) interactionAudio.playImageClick(override.activeAnimationId)
}

const drawFrame = (now) => {
  const presentation = updateRuntimePresentation(now)
  if (!presentation.previewActive) {
    if (
      advancedPlaybackState.currentBgm
      || advancedPlaybackState.fadingBgms.size > 0
      || advancedPlaybackState.objectVoices.size > 0
    ) clearAdvancedAudioPlayback()
    requestAnimationFrame(drawFrame)
    return
  }

  const dpr = window.devicePixelRatio || 1
  const group = getActiveGroup()
  const playbackFrame = getBackgroundPlaybackFrame(group, now)
  preloadBackground(playbackFrame.nextBackground)
  const visibleItems = getVisibleItemsForPlayback(group, playbackFrame)
  syncItemAppearanceTimeline(visibleItems, playbackFrame, now)
  updateAdvancedAudioPlayback(group, visibleItems, playbackFrame, now)
  configureHighQualityImageSmoothing(backgroundSourceContext)
  backgroundSourceContext.setTransform(1, 0, 0, 1, 0, 0)
  backgroundSourceContext.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  const backgroundRender = drawBackground(backgroundSourceContext, playbackFrame.background, now)
  stageSurfaceCleared = false
  ripples = ripples.filter((ripple) => now - ripple.startedAt < RIPPLE_DURATION_MS)

  const backgroundRendered = waterRippleRenderer.render({
    sourceCanvas: backgroundSourceCanvas,
    textureKey: backgroundRender.textureKey,
    textureIsDynamic: backgroundRender.textureIsDynamic,
    ripples,
    now,
    stageWidth: STAGE_WIDTH,
    stageHeight: STAGE_HEIGHT,
    viewport: {
      x: stageOffsetX * dpr,
      y: stageOffsetY * dpr,
      width: STAGE_WIDTH * stageScale * dpr,
      height: STAGE_HEIGHT * stageScale * dpr
    }
  })
  backgroundCanvas.classList.toggle('is-hidden', !backgroundRendered)

  configureHighQualityImageSmoothing(context)
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (!backgroundRendered) {
    context.fillStyle = '#05070a'
    context.fillRect(0, 0, window.innerWidth, window.innerHeight)
  }

  context.save()
  context.translate(stageOffsetX, stageOffsetY)
  context.scale(stageScale, stageScale)

  if (!backgroundRendered) {
    context.drawImage(backgroundSourceCanvas, 0, 0, STAGE_WIDTH, STAGE_HEIGHT)
    drawBackgroundRipples(now)
  }

  if (visibleItems.length) {
    visibleItems.forEach((item, index) => drawItem(item, index, now, playbackFrame))
  }

  drawBackgroundTransition(context, playbackFrame)

  context.restore()

  requestAnimationFrame(drawFrame)
}

const updateStatusPanel = () => {
  const addresses = serverStatus.addresses?.length
    ? serverStatus.addresses.join(' / ')
    : '本機 IP'

  if (serverStatus.status === 'listening') {
    statusText.textContent = `接收服務已啟動：${addresses}:8080`
  } else if (serverStatus.status === 'error') {
    statusText.textContent = `8080 啟動失敗：${serverStatus.error || '未知錯誤'}`
  } else {
    statusText.textContent = '正在啟動 8080 接收服務...'
  }

  const group = getActiveGroup()
  if (group) {
    groupText.textContent = `${group.name || group.groupId} · ${group.items?.length ?? 0} 個物件`
    statusPanel.classList.add('is-hidden')
  } else {
    groupText.textContent = '等待 iPad 傳入作品檔案'
    statusPanel.classList.remove('is-hidden')
  }

  if (serverStatus.status === 'error') {
    statusPanel.classList.remove('is-hidden')
  }
}

const applyStateEventToInteractions = (state) => {
  const event = state.lastEvent
  const sequence = Number(event?.sequence ?? 0)
  if (!Number.isFinite(sequence) || sequence <= lastStateEventSequence) return

  lastStateEventSequence = sequence
  switch (event.eventName) {
    case 'PreviewMode':
      if (event.enabled) animationOverrides.clearAll()
      break

    case 'ItemAnimation':
    case 'ItemDelete':
      animationOverrides.clearItem(event.groupId, event.itemId)
      break

    case 'GroupDelete':
      animationOverrides.clearGroup(event.groupId)
      break

    default:
      break
  }
}

const receiveState = (state) => {
  const previousState = runtimeState
  const watermarkEnabled = typeof state.watermarkEnabled === 'boolean'
    ? state.watermarkEnabled
    : previousState.watermarkEnabled
  const previousPreview = previousState.preview ?? {}
  const nextPreview = {
    ...(state.preview ?? {}),
    advancedFeaturesEnabled: DESKTOP_ADVANCED_FEATURES_ENABLED
  }
  const normalizedGroups = Object.fromEntries(
    Object.entries(state.groups ?? {}).map(([groupId, group]) => [
      groupId,
      {
        ...(group ?? {}),
        advancedFeaturesEnabled: DESKTOP_ADVANCED_FEATURES_ENABLED
      }
    ])
  )
  const activeGroupChanged = previousState.activeGroupId !== state.activeGroupId
  const previewRestarted = Boolean(nextPreview.enabled) && (
    !previousPreview.enabled
    || previousPreview.replayId !== nextPreview.replayId
  )
  const archiveModeChanged = (previousState.view?.mode !== 'stage') !== (state.view?.mode !== 'stage')
  const previousAdvancedPreview = previousPreview.enabled === true
    && previousPreview.advancedFeaturesEnabled === true
  const nextAdvancedPreview = nextPreview.enabled === true
    && nextPreview.advancedFeaturesEnabled === true
  const advancedSessionKey = nextAdvancedPreview
    ? `${state.activeGroupId ?? nextPreview.groupId ?? ''}:${nextPreview.replayId ?? 0}`
    : ''
  const advancedSessionChanged = advancedSessionKey !== advancedPlaybackState.sessionKey

  runtimeState = {
    ...state,
    groups: normalizedGroups,
    preview: nextPreview,
    watermarkEnabled
  }
  if (advancedSessionChanged) {
    resetAdvancedPlaybackSession(advancedSessionKey)
  } else if (previousAdvancedPreview && !nextAdvancedPreview) {
    resetAdvancedPlaybackSession('')
  }
  if (activeGroupChanged || previewRestarted) animationOverrides.clearAll()
  if (activeGroupChanged) ripples = []
  applyStateEventToInteractions(runtimeState)
  animationOverrides.reconcile(runtimeState)
  clearUnusedMedia()
  renderArchiveMirror()
  updateRuntimePresentation()
  if (archiveModeChanged || previousPreview.enabled !== nextPreview.enabled) {
    setRuntimeViewMediaState(isArchiveView() || !previewPresentationReady)
  }

  const preview = runtimeState.preview ?? {}
  const key = `${preview.enabled}:${preview.replayId}:${preview.groupId}:${preview.appearMode}:${preview.intervalMs}:${preview.appearAnimation}:${preview.backgroundPlayMode}:${preview.backgroundIntervalMs}:${preview.backgroundTransition}:${preview.advancedFeaturesEnabled}`
  if (key !== lastPreviewKey) {
    lastPreviewKey = key
    previewStartTime = performance.now()
  }

  updateStatusPanel()
}

const receiveServerStatus = (status) => {
  serverStatus = status
  updateStatusPanel()
}

window.addEventListener('resize', () => {
  resizeCanvas()
  resizeArchivePortalCanvas()
})
window.addEventListener('beforeunload', () => {
  resetAdvancedPlaybackSession('')
})
canvas.addEventListener('pointerdown', handleStagePointerDown)
resizeCanvas()
resizeArchivePortalCanvas()
renderArchiveMirror()

window.runtimeApi?.onState(receiveState)
window.runtimeApi?.onServerStatus(receiveServerStatus)
window.runtimeApi?.requestState()

requestAnimationFrame(drawFrame)
