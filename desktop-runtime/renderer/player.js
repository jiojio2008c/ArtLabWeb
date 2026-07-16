const STAGE_WIDTH = 1920
const STAGE_HEIGHT = 1080

const canvas = document.getElementById('stage')
const context = canvas.getContext('2d')
const statusPanel = document.getElementById('statusPanel')
const statusText = document.getElementById('statusText')
const groupText = document.getElementById('groupText')

let runtimeState = {
  activeGroupId: null,
  groups: {},
  assets: {},
  preview: {
    enabled: false,
    replayId: 0,
    startedAt: Date.now(),
    appearMode: 'all',
    intervalMs: 800
  },
  server: {
    status: 'starting',
    port: 8080,
    addresses: []
  }
}

let serverStatus = runtimeState.server
let stageScale = 1
let stageOffsetX = 0
let stageOffsetY = 0
let lastPreviewKey = ''
let previewStartTime = performance.now()

const imageCache = new Map()
const videoCache = new Map()

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
  image.src = asset.url
  imageCache.set(asset.url, entry)
  return entry
}

const getVideo = (asset) => {
  if (!asset?.url) return null
  const cached = videoCache.get(asset.url)
  if (cached) return cached

  const video = document.createElement('video')
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

const drawCover = (source, sourceWidth, sourceHeight) => {
  if (!source || !sourceWidth || !sourceHeight) return

  const scale = Math.max(STAGE_WIDTH / sourceWidth, STAGE_HEIGHT / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  const x = (STAGE_WIDTH - width) / 2
  const y = (STAGE_HEIGHT - height) / 2
  context.drawImage(source, x, y, width, height)
}

const drawPlaceholderBackground = (time) => {
  const gradient = context.createLinearGradient(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  gradient.addColorStop(0, '#07111d')
  gradient.addColorStop(0.48, '#0f1a24')
  gradient.addColorStop(1, '#04070b')
  context.fillStyle = gradient
  context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  context.save()
  context.globalAlpha = 0.14
  context.strokeStyle = '#9cc9ff'
  context.lineWidth = 1
  const drift = (time * 0.02) % 80
  for (let x = -80 + drift; x < STAGE_WIDTH + 80; x += 80) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x + 160, STAGE_HEIGHT)
    context.stroke()
  }
  context.restore()
}

const drawBackground = (group, time) => {
  const activeBackground = group?.backgrounds?.find((item) => item.assetId === group.activeBackgroundId)
    ?? group?.backgrounds?.[0]
  const asset = getAsset(activeBackground?.assetId)

  if (!asset?.url) {
    drawPlaceholderBackground(time)
    return
  }

  if (asset.mediaType === 'video') {
    const video = getVideo(asset)
    if (video?.loaded && video.element.readyState >= 2) {
      drawCover(video.element, video.width, video.height)
      return
    }
  } else {
    const image = getImage(asset)
    if (image?.loaded) {
      drawCover(image.element, image.width, image.height)
      return
    }
  }

  drawPlaceholderBackground(time)
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

const getMotionTransform = (item, now) => {
  const preview = runtimeState.preview ?? {}
  if (!preview.enabled || item.moveMode === 'none') {
    return {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0
    }
  }

  const seed = hashString(item.itemId) % 997
  const percent = clamp(Number(item.movePercent ?? 50), 0, 100) / 100
  const cycleSeconds = speedToCycleSeconds(item.moveSpeed)
  const phase = ((now / 1000) / cycleSeconds + seed * 0.0007) * Math.PI * 2
  const baseX = clamp(item.position?.x ?? 0.5, -0.2, 1.2) * STAGE_WIDTH
  const baseY = clamp(item.position?.y ?? 0.5, -0.2, 1.2) * STAGE_HEIGHT

  switch (item.moveMode) {
    case 'verticalWave': {
      const amplitude = percent * STAGE_HEIGHT * 0.58
      return {
        x: 0,
        y: Math.sin(phase) * amplitude,
        scale: 1,
        rotation: 0
      }
    }

    case 'left':
    case 'right': {
      const margin = 260
      const travel = STAGE_WIDTH + margin * 2
      const raw = ((now / 1000) / speedToCycleSeconds(item.moveSpeed, 8.5) + seed * 0.013) % 1
      const progress = item.moveMode === 'right' ? raw : 1 - raw
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

    case 'random': {
      const amplitudeX = percent * STAGE_WIDTH * 0.22
      const amplitudeY = percent * STAGE_HEIGHT * 0.2
      return {
        x: Math.sin(phase * 0.71 + seed) * amplitudeX + Math.sin(phase * 1.27) * amplitudeX * 0.35,
        y: Math.cos(phase * 0.83 + seed) * amplitudeY + Math.sin(phase * 1.41) * amplitudeY * 0.35,
        scale: 1 + Math.sin(phase * 0.7) * 0.05,
        rotation: Math.sin(phase * 0.9) * 4
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

const getAnimationTransform = (item, now) => {
  const id = Number(item.animationId ?? 0)
  const seed = (hashString(item.itemId) % 360) * Math.PI / 180
  const t = now / 1000 + seed

  const base = {
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    alpha: 1,
    offsetX: 0,
    offsetY: 0,
    skewX: 0,
    skewY: 0
  }

  switch (id) {
    case 1: {
      const pulse = Math.sin(t * 2.2)
      return {
        ...base,
        scaleX: 1 + pulse * 0.08,
        scaleY: 1 + pulse * 0.08
      }
    }

    case 2:
      return {
        ...base,
        rotation: Math.sin(t * 4.2) * 9,
        offsetX: Math.sin(t * 3.8) * 8
      }

    case 3:
      return {
        ...base,
        alpha: 0.38 + (Math.sin(t * 6.4) + 1) * 0.31
      }

    case 4:
      return {
        ...base,
        rotation: Math.sin(t * 2.4) * 18
      }

    case 5: {
      const bounce = Math.abs(Math.sin(t * 4.1))
      return {
        ...base,
        offsetY: -bounce * 70,
        scaleX: 1 + bounce * 0.05,
        scaleY: 1 - bounce * 0.08
      }
    }

    case 6:
      return {
        ...base,
        skewX: Math.sin(t * 4.6) * 0.18,
        scaleY: 1 + Math.sin(t * 5.2) * 0.06,
        offsetY: Math.sin(t * 3.2) * 10
      }

    case 7: {
      const flip = Math.cos(t * 5.6)
      return {
        ...base,
        scaleX: flip,
        skewY: Math.sin(t * 5.6) * 0.18,
        rotation: Math.sin(t * 2.7) * 5
      }
    }

    case 8:
      return {
        ...base,
        alpha: 0.58 + (Math.sin(t * 3.3) + 1) * 0.21,
        scaleX: 1 + Math.sin(t * 3.3) * 0.035,
        scaleY: 1 + Math.sin(t * 3.3) * 0.035
      }

    case 9:
      return {
        ...base,
        scaleX: 1 + Math.sin(t * 2.1) * 0.09,
        scaleY: 1 + Math.sin(t * 2.1) * 0.09,
        rotation: Math.sin(t * 3.1) * 8,
        alpha: 0.78 + (Math.sin(t * 4.2) + 1) * 0.11,
        offsetY: Math.sin(t * 2.7) * 26,
        skewX: Math.sin(t * 3.6) * 0.08
      }

    default:
      return base
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

const drawItem = (item, itemIndex, now) => {
  if (item.isVisible === false) return

  const asset = getAsset(item.assetId)
  const image = getImage(asset)
  const baseX = clamp(item.position?.x ?? 0.5, -0.5, 1.5) * STAGE_WIDTH
  const baseY = clamp(item.position?.y ?? 0.5, -0.5, 1.5) * STAGE_HEIGHT
  const motion = getMotionTransform(item, now)
  const animation = getAnimationTransform(item, now)
  const appearAlpha = getPreviewAppearAlpha(item, itemIndex, now)
  const x = baseX + motion.x + animation.offsetX
  const y = baseY + motion.y + animation.offsetY

  if (!image?.loaded) {
    drawMissingItem(item, x, y)
    return
  }

  const size = getBaseImageSize(image)
  const baseScale = Number(item.scale ?? 1)
  const flipX = item.flipX ? -1 : 1
  const flipY = item.flipY ? -1 : 1

  context.save()
  context.globalAlpha = clamp(appearAlpha * animation.alpha, 0, 1)
  context.translate(x, y)
  context.rotate(degToRad(Number(item.rotation ?? 0) + motion.rotation + animation.rotation))
  context.transform(1, animation.skewY, animation.skewX, 1, 0, 0)
  context.scale(
    flipX * baseScale * motion.scale * animation.scaleX,
    flipY * baseScale * motion.scale * animation.scaleY
  )
  context.drawImage(
    image.element,
    -size.width / 2,
    -size.height / 2,
    size.width,
    size.height
  )
  context.restore()
}

const drawFrame = (now) => {
  const dpr = window.devicePixelRatio || 1
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#05070a'
  context.fillRect(0, 0, window.innerWidth, window.innerHeight)

  context.save()
  context.translate(stageOffsetX, stageOffsetY)
  context.scale(stageScale, stageScale)

  const group = getActiveGroup()
  drawBackground(group, now)

  if (group?.items?.length) {
    group.items
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
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

const receiveState = (state) => {
  runtimeState = state
  clearUnusedMedia()

  const preview = runtimeState.preview ?? {}
  const key = `${preview.enabled}:${preview.replayId}:${preview.groupId}:${preview.appearMode}:${preview.intervalMs}`
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
resizeCanvas()

window.runtimeApi?.onState(receiveState)
window.runtimeApi?.onServerStatus(receiveServerStatus)
window.runtimeApi?.requestState()

requestAnimationFrame(drawFrame)
