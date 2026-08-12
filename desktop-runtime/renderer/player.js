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
  drawUnityAnimationImage
} from './unity-animation-core.js'
import {
  RIPPLE_DURATION_MS,
  createAnimationOverrideStore,
  mapClientPointToStage,
  sampleRipple
} from './interaction-core.js'
import { createInteractionAudio } from './interaction-audio.js'
import {
  MAX_WATER_RIPPLES,
  createWaterRippleRenderer
} from './water-ripple-renderer.js'

const STAGE_WIDTH = 1920
const STAGE_HEIGHT = 1080
const REFERENCE_PREVIEW_STAGE_HEIGHT = 540
const VERTICAL_TRACK_EDGE_PADDING_RATIO = 28 / REFERENCE_PREVIEW_STAGE_HEIGHT
const VERTICAL_OUT_PADDING_RATIO = Math.max(0.22, 120 / REFERENCE_PREVIEW_STAGE_HEIGHT)

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

displayRoot?.classList.toggle('is-horizontal-flipped', isHorizontalDisplayFlip)
displayRoot?.classList.toggle('is-vertical-flipped', isVerticalDisplayFlip)

backgroundSourceCanvas.width = STAGE_WIDTH
backgroundSourceCanvas.height = STAGE_HEIGHT
const waterRippleRenderer = createWaterRippleRenderer(backgroundCanvas)

let runtimeState = {
  activeGroupId: null,
  groups: {},
  assets: {},
  preview: {
    enabled: false,
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
let randomBackgroundState = { key: '', cycle: 0, index: 0 }
let lastStateEventSequence = 0
let ripples = []
let alphaHitWarningShown = false

const imageCache = new Map()
const videoCache = new Map()
const RANDOM_PREVIEW_MOTION_MODES = ['verticalWave', 'left', 'right', 'orbit']
const HIT_SAMPLE_SIZE = 9
const HIT_ALPHA_THRESHOLD = 18
const hitCanvas = document.createElement('canvas')
const hitContext = hitCanvas.getContext('2d', { willReadFrequently: true })
const animationOverrides = createAnimationOverrideStore()
const interactionAudio = createInteractionAudio()

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

const getAsset = (assetId) => {
  if (!assetId) return null
  return runtimeState.assets[assetId] ?? null
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

const getPreviewBackground = (group, now) => {
  const backgrounds = group?.backgrounds ?? []
  if (backgrounds.length === 0) return null

  const activeIndex = Math.max(0, backgrounds.findIndex((item) => item.assetId === group.activeBackgroundId))
  const preview = runtimeState.preview ?? {}
  const mode = preview.backgroundPlayMode ?? group.backgroundPlayMode ?? 'fixed'
  if (!preview.enabled || mode === 'fixed' || backgrounds.length === 1) {
    return backgrounds[activeIndex] ?? backgrounds[0]
  }

  const intervalMs = clamp(
    Number(preview.backgroundIntervalMs ?? group.backgroundIntervalMs ?? 5000),
    1000,
    600000
  )
  const cycle = Math.max(0, Math.floor((now - previewStartTime) / intervalMs))
  if (mode === 'sequence') {
    return backgrounds[(activeIndex + cycle) % backgrounds.length]
  }

  const key = `${group.groupId}:${preview.replayId}:${backgrounds.map((item) => item.assetId).join(',')}`
  if (randomBackgroundState.key !== key || cycle < randomBackgroundState.cycle) {
    randomBackgroundState = { key, cycle: 0, index: activeIndex }
  }
  while (randomBackgroundState.cycle < cycle) {
    const nextCycle = randomBackgroundState.cycle + 1
    const offset = 1 + (hashString(`${key}:${nextCycle}`) % (backgrounds.length - 1))
    randomBackgroundState.index = (randomBackgroundState.index + offset) % backgrounds.length
    randomBackgroundState.cycle = nextCycle
  }
  return backgrounds[randomBackgroundState.index]
}

const drawBackground = (renderContext, group, time) => {
  const activeBackground = getPreviewBackground(group, time)
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

  if (appearMode === 'sequence') {
    const delay = itemIndex * intervalMs
    return smoothstep((elapsed - delay) / fadeMs)
  }

  return smoothstep(elapsed / fadeMs)
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

const getMoveTrackBounds = (track) => {
  if (track === 'top') return { start: 0, end: 1 / 3 }
  if (track === 'bottom') return { start: 2 / 3, end: 1 }
  return { start: 1 / 3, end: 2 / 3 }
}

const getVerticalWaveOffsets = (item) => {
  const percent = clamp(Number(item.movePercent ?? 50), 0, 100) / 100
  const localRatio = Math.min(percent / 0.5, 1)
  const fullRatio = Math.max((percent - 0.5) / 0.5, 0)
  const positionYValue = Number(item.position?.y ?? 0.5)
  const positionY = Number.isFinite(positionYValue) ? positionYValue : 0.5
  const { start: trackStart, end: trackEnd } = getMoveTrackBounds(getMoveTrack(item))
  const trackEdgePadding = STAGE_HEIGHT * VERTICAL_TRACK_EDGE_PADDING_RATIO
  const outPadding = STAGE_HEIGHT * VERTICAL_OUT_PADDING_RATIO
  const localUpLimit = Math.max((positionY - trackStart) * STAGE_HEIGHT - trackEdgePadding, 0)
  const localDownLimit = Math.max((trackEnd - positionY) * STAGE_HEIGHT - trackEdgePadding, 0)
  const localWaveUp = -localUpLimit * localRatio
  const localWaveDown = localDownLimit * localRatio
  const fullWaveUp = -(positionY * STAGE_HEIGHT + outPadding)
  const fullWaveDown = (1 - positionY) * STAGE_HEIGHT + outPadding

  return {
    waveUp: lerp(localWaveUp, fullWaveUp, fullRatio),
    waveDown: lerp(localWaveDown, fullWaveDown, fullRatio)
  }
}

const sampleVerticalWave = (progress, waveDown, waveUp) => {
  const cycleProgress = ((progress % 1) + 1) % 1
  if (cycleProgress < 0.35) {
    return lerp(0, waveDown, smoothstep(cycleProgress / 0.35))
  }
  if (cycleProgress < 0.7) {
    return lerp(waveDown, waveUp, smoothstep((cycleProgress - 0.35) / 0.35))
  }
  return lerp(waveUp, 0, smoothstep((cycleProgress - 0.7) / 0.3))
}

const resolvePreviewMotionMode = (item, preview) => {
  if (item.moveMode !== 'random') return item.moveMode
  const groupId = preview.groupId || runtimeState.activeGroupId || ''
  const key = `${groupId}:${item.itemId}:${preview.replayId || 0}`
  return RANDOM_PREVIEW_MOTION_MODES[mixHash(hashString(key)) % RANDOM_PREVIEW_MOTION_MODES.length]
}

const getMotionTransform = (item, itemIndex, now) => {
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

  const percent = clamp(Number(item.movePercent ?? 50), 0, 100) / 100
  const cycleSeconds = speedToCycleSeconds(item.moveSpeed)
  if (motionMode === 'verticalWave') {
    const intervalMs = preview.intervalMs ?? getActiveGroup()?.appearIntervalMs ?? 800
    const appearDelayMs = preview.appearMode === 'sequence' ? itemIndex * intervalMs : 0
    const elapsedMs = now - previewStartTime - appearDelayMs
    const { waveUp, waveDown } = getVerticalWaveOffsets(item)
    const progress = elapsedMs <= 0 ? 0 : elapsedMs / 1000 / cycleSeconds

    return {
      x: 0,
      y: sampleVerticalWave(progress, waveDown, waveUp),
      scale: 1,
      rotation: 0
    }
  }

  const seed = hashString(item.itemId) % 997
  const phase = ((now / 1000) / cycleSeconds + seed * 0.0007) * Math.PI * 2
  const baseX = clamp(item.position?.x ?? 0.5, -0.2, 1.2) * STAGE_WIDTH
  const baseY = clamp(item.position?.y ?? 0.5, -0.2, 1.2) * STAGE_HEIGHT

  switch (motionMode) {
    case 'left':
    case 'right': {
      const margin = 260
      const travel = STAGE_WIDTH + margin * 2
      const raw = ((now / 1000) / speedToCycleSeconds(item.moveSpeed, 8.5) + seed * 0.013) % 1
      const progress = motionMode === 'right' ? raw : 1 - raw
      const targetX = -margin + travel * progress
      const waveCount = 7
      const amplitude = percent * STAGE_HEIGHT * 0.5
      const waveY = Math.sin(progress * Math.PI * 2 * waveCount) * amplitude
      return {
        x: targetX - baseX,
        y: waveY,
        scale: 1,
        rotation: 0
      }
    }

    case 'orbit': {
      const radiusX = percent * STAGE_WIDTH * 0.34
      const radiusY = percent * STAGE_HEIGHT * 0.18
      const x = Math.cos(phase) * radiusX
      const y = Math.sin(phase) * radiusY
      const depth = (Math.sin(phase) + 1) / 2
      return {
        x,
        y,
        scale: lerp(0.82, 1.2, depth),
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

const drawMissingItem = (item, x, y) => {
  context.save()
  context.translate(x, y)
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

const getEffectiveAnimation = (item, now) => {
  const override = animationOverrides.get(runtimeState.activeGroupId, item)
  if (override) {
    return {
      animationId: override.activeAnimationId,
      timeSeconds: Math.max(0, now - override.startedAt) / 1000
    }
  }

  const preview = runtimeState.preview ?? {}
  const mode = getDynamicAnimationMode(item)
  let animationId = 0
  if (preview.enabled) {
    animationId = Number(
      preview.resolvedAnimationIds?.[item.itemId]
      ?? resolveDynamicAnimationId(
        mode,
        item.animationId,
        DYNAMIC_ANIMATION_IDS,
        `${preview.groupId ?? runtimeState.activeGroupId ?? ''}:${item.itemId}:${preview.replayId ?? 0}`
      )
    )
  } else if (mode === 'fixed') {
    animationId = Number(item.animationId ?? 0)
  }

  return {
    animationId,
    timeSeconds: preview.enabled
      ? Math.max(0, now - previewStartTime) / 1000
      : now / 1000
  }
}

const getItemRenderState = (item, itemIndex, now, image) => {
  const effectiveAnimation = getEffectiveAnimation(item, now)
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
  const motion = getMotionTransform(item, itemIndex, now)
  const baseX = clamp(item.position?.x ?? 0.5, -0.5, 1.5) * STAGE_WIDTH
  const baseY = clamp(item.position?.y ?? 0.5, -0.5, 1.5) * STAGE_HEIGHT
  const numericScale = Number(item.scale ?? 1)
  const baseScale = Number.isFinite(numericScale) ? numericScale : 1
  const flipX = item.flipX ? -1 : 1
  const flipY = item.flipY ? -1 : 1
  const appearAlpha = getPreviewAppearAlpha(item, itemIndex, now)

  return {
    x: baseX + motion.x + animation.offsetX,
    y: baseY + motion.y + animation.offsetY,
    rotation: degToRad(Number(item.rotation ?? 0) + motion.rotation + animation.rotation),
    skewX: animation.skewX,
    skewY: animation.skewY,
    scaleX: flipX * baseScale * motion.scale * animation.scaleX,
    scaleY: flipY * baseScale * motion.scale * animation.scaleY,
    alpha: clamp(appearAlpha * animation.alpha, 0, 1),
    appearAlpha,
    animationId: effectiveAnimation.animationId,
    animationTimeSeconds: effectiveAnimation.timeSeconds,
    size: getBaseImageSize(image)
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

const drawItem = (item, itemIndex, now) => {
  if (item.isVisible === false) return

  const asset = getAsset(item.assetId)
  const image = getImage(asset)
  const renderState = getItemRenderState(item, itemIndex, now, image)

  if (!image?.loaded) {
    drawMissingItem(item, renderState.x, renderState.y)
    return
  }

  context.save()
  context.globalAlpha = renderState.alpha
  applyItemRenderTransform(context, renderState)
  drawItemImage(context, image, renderState)
  context.restore()
}

const getOrderedItems = (group) => {
  return (group?.items ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

const isPointOverItem = (item, itemIndex, now, stagePoint) => {
  if (item.isVisible === false || !hitContext) return false

  const image = getImage(getAsset(item.assetId))
  if (!image?.loaded) return false

  const renderState = getItemRenderState(item, itemIndex, now, image)
  if (renderState.appearAlpha <= 0.04) return false

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
      drawItemImage(hitContext, image, renderState)
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

const findTopmostItemAtPoint = (group, now, stagePoint) => {
  const items = getOrderedItems(group)
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (isPointOverItem(items[index], index, now, stagePoint)) {
      return items[index]
    }
  }
  return null
}

const handleStagePointerDown = (event) => {
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
  const hitItem = findTopmostItemAtPoint(group, now, stagePoint)
  if (!hitItem) {
    addBackgroundRipple(stagePoint.x, stagePoint.y, now)
    return
  }

  const override = animationOverrides.cycle(runtimeState.activeGroupId, hitItem, now)
  if (override) interactionAudio.playImageClick(override.activeAnimationId)
}

const drawFrame = (now) => {
  const dpr = window.devicePixelRatio || 1
  const group = getActiveGroup()
  backgroundSourceContext.setTransform(1, 0, 0, 1, 0, 0)
  backgroundSourceContext.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  const backgroundFrame = drawBackground(backgroundSourceContext, group, now)
  ripples = ripples.filter((ripple) => now - ripple.startedAt < RIPPLE_DURATION_MS)

  const backgroundRendered = waterRippleRenderer.render({
    sourceCanvas: backgroundSourceCanvas,
    textureKey: backgroundFrame.textureKey,
    textureIsDynamic: backgroundFrame.textureIsDynamic,
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

  if (group?.items?.length) {
    getOrderedItems(group)
      .forEach((item, index) => drawItem(item, index, now))
  }

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
    case 'GroupSelectAndSync':
    case 'GroupStateSync':
      animationOverrides.clearGroup(event.groupId)
      break

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
  const previousPreview = previousState.preview ?? {}
  const nextPreview = state.preview ?? {}
  const activeGroupChanged = previousState.activeGroupId !== state.activeGroupId
  const previewRestarted = Boolean(nextPreview.enabled) && (
    !previousPreview.enabled
    || previousPreview.replayId !== nextPreview.replayId
  )

  runtimeState = state
  if (activeGroupChanged || previewRestarted) animationOverrides.clearAll()
  if (activeGroupChanged) ripples = []
  applyStateEventToInteractions(runtimeState)
  animationOverrides.reconcile(runtimeState)
  clearUnusedMedia()

  const preview = runtimeState.preview ?? {}
  const key = `${preview.enabled}:${preview.replayId}:${preview.groupId}:${preview.appearMode}:${preview.intervalMs}:${preview.backgroundPlayMode}:${preview.backgroundIntervalMs}`
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

window.addEventListener('resize', resizeCanvas)
canvas.addEventListener('pointerdown', handleStagePointerDown)
resizeCanvas()

window.runtimeApi?.onState(receiveState)
window.runtimeApi?.onServerStatus(receiveServerStatus)
window.runtimeApi?.requestState()

requestAnimationFrame(drawFrame)
