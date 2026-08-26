const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

const lerp = (from, to, ratio) => from + (to - from) * ratio

const REFERENCE_PREVIEW_STAGE_HEIGHT = 540
const VERTICAL_TRACK_EDGE_PADDING_RATIO = 28 / REFERENCE_PREVIEW_STAGE_HEIGHT
const VERTICAL_OUT_PADDING_RATIO = Math.max(0.22, 120 / REFERENCE_PREVIEW_STAGE_HEIGHT)
const HORIZONTAL_STAGE_MARGIN = 260
const HORIZONTAL_WAVE_CYCLES = 7
const HORIZONTAL_KEYFRAMES_PER_WAVE = 20
const HORIZONTAL_MOTION_FRAME_COUNT = HORIZONTAL_WAVE_CYCLES * HORIZONTAL_KEYFRAMES_PER_WAVE
const DYNAMIC_VERTICAL_WAVE_EASING = 'cubic-bezier(0.333333, 0, 0.666667, 1)'

const smoothstep = (value) => {
  const ratio = clamp(value, 0, 1)
  return ratio * ratio * (3 - 2 * ratio)
}

const getStageSize = (stageSize = {}) => ({
  width: Number(stageSize.width) > 0 ? Number(stageSize.width) : 960,
  height: Number(stageSize.height) > 0 ? Number(stageSize.height) : 540
})

const getTrackBounds = (track) => {
  if (track === 'top') return { start: 0, end: 1 / 3 }
  if (track === 'bottom') return { start: 2 / 3, end: 1 }
  return { start: 1 / 3, end: 2 / 3 }
}

const getItemTrack = (item) => {
  if (item?.moveTrack === 'top' || item?.moveTrack === 'middle' || item?.moveTrack === 'bottom') {
    return item.moveTrack
  }
  const positionY = Number(item?.position?.y ?? 0.5)
  if (positionY < 1 / 3) return 'top'
  if (positionY > 2 / 3) return 'bottom'
  return 'middle'
}

export const getDynamicVerticalWaveOffsets = (item, stageHeight) => {
  const safeStageHeight = stageHeight || 540
  const amplitudeRatio = clamp(Number(item?.movePercent ?? 50), 0, 100) / 100
  const localRatio = Math.min(amplitudeRatio / 0.5, 1)
  const fullRatio = Math.max((amplitudeRatio - 0.5) / 0.5, 0)
  const positionYValue = Number(item?.position?.y ?? 0.5)
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

export const sampleDynamicVerticalWave = (progress, waveDown, waveUp) => {
  const cycleProgress = ((Number(progress) || 0) % 1 + 1) % 1
  if (cycleProgress < 0.35) {
    return lerp(0, waveDown, smoothstep(cycleProgress / 0.35))
  }
  if (cycleProgress < 0.7) {
    return lerp(waveDown, waveUp, smoothstep((cycleProgress - 0.35) / 0.35))
  }
  return lerp(waveUp, 0, smoothstep((cycleProgress - 0.7) / 0.3))
}

export const getDynamicVerticalWaveKeyframes = (item, stageSize) => {
  const { height } = getStageSize(stageSize)
  const { waveDown, waveUp } = getDynamicVerticalWaveOffsets(item, height)
  return [
    { offset: 0, y: 0, easing: DYNAMIC_VERTICAL_WAVE_EASING },
    { offset: 0.35, y: waveDown, easing: DYNAMIC_VERTICAL_WAVE_EASING },
    { offset: 0.7, y: waveUp, easing: DYNAMIC_VERTICAL_WAVE_EASING },
    { offset: 1, y: 0 }
  ]
}

export const getDynamicHorizontalMotionPoint = (
  moveMode,
  timelineProgress,
  movePercent,
  stageSize
) => {
  const { width: stageWidth, height: stageHeight } = getStageSize(stageSize)
  const margin = stageWidth * HORIZONTAL_STAGE_MARGIN / 1920
  const travel = stageWidth + margin * 2
  const pathProgress = moveMode === 'left' ? 1 - timelineProgress : timelineProgress
  const amplitude = clamp(Number(movePercent ?? 50), 0, 100) / 100 * stageHeight * 0.5

  return {
    x: -margin + travel * pathProgress,
    y: Math.sin(pathProgress * Math.PI * 2 * HORIZONTAL_WAVE_CYCLES) * amplitude
  }
}

export const getDynamicHorizontalMotionKeyframes = (
  moveMode,
  movePercent,
  stageSize
) => Array.from({ length: HORIZONTAL_MOTION_FRAME_COUNT + 1 }, (_, index) => {
  const offset = index / HORIZONTAL_MOTION_FRAME_COUNT
  return {
    offset,
    ...getDynamicHorizontalMotionPoint(moveMode, offset, movePercent, stageSize)
  }
})

export const sampleDynamicHorizontalMotion = (
  moveMode,
  progress,
  movePercent,
  stageSize
) => {
  const normalizedProgress = ((Number(progress) || 0) % 1 + 1) % 1
  const scaled = normalizedProgress * HORIZONTAL_MOTION_FRAME_COUNT
  const lowerIndex = Math.min(HORIZONTAL_MOTION_FRAME_COUNT - 1, Math.floor(scaled))
  const upperIndex = lowerIndex + 1
  const ratio = scaled - lowerIndex
  const lower = getDynamicHorizontalMotionPoint(
    moveMode,
    lowerIndex / HORIZONTAL_MOTION_FRAME_COUNT,
    movePercent,
    stageSize
  )
  const upper = getDynamicHorizontalMotionPoint(
    moveMode,
    upperIndex / HORIZONTAL_MOTION_FRAME_COUNT,
    movePercent,
    stageSize
  )
  return {
    x: lerp(lower.x, upper.x, ratio),
    y: lerp(lower.y, upper.y, ratio)
  }
}

export const getDynamicOrbitGeometry = (item, stageSize) => {
  const { width: stageWidth, height: stageHeight } = getStageSize(stageSize)
  const amplitudeRatio = clamp(Number(item?.movePercent ?? 50), 0, 100) / 100
  const localRatio = Math.min(amplitudeRatio / 0.5, 1)
  const fullRatio = Math.max((amplitudeRatio - 0.5) / 0.5, 0)
  const { localUpLimit, localDownLimit } = getDynamicVerticalWaveOffsets(item, stageHeight)
  const positionX = Number(item?.position?.x ?? 0.5)
  const positionY = Number(item?.position?.y ?? 0.5)
  const localOrbitY = Math.max(Math.min(localUpLimit, localDownLimit) * localRatio, 0)
  const localOrbitX = Math.min(stageWidth * 0.28, Math.max(stageWidth * 0.08 * localRatio, localOrbitY * 2.2))
  const fullOrbitY = Math.max(positionY, 1 - positionY) * stageHeight
  const edgeAwareOrbitX = Math.max(
    Math.min(positionX, 1 - positionX) * stageWidth + stageWidth * 0.18,
    stageWidth * 0.28
  )
  const fullOrbitX = Math.min(
    stageWidth * 0.6,
    edgeAwareOrbitX,
    Math.max(stageWidth * 0.3, fullOrbitY * 1.35)
  )
  const orbitX = Math.round(lerp(localOrbitX, fullOrbitX, fullRatio))
  const orbitY = Math.round(lerp(localOrbitY, fullOrbitY, fullRatio))

  return {
    orbitX,
    orbitY,
    orbitX92: Math.round(orbitX * 0.924),
    orbitX71: Math.round(orbitX * 0.707),
    orbitX38: Math.round(orbitX * 0.383),
    orbitY92: Math.round(orbitY * 0.924),
    orbitY71: Math.round(orbitY * 0.707),
    orbitY38: Math.round(orbitY * 0.383)
  }
}

export const getDynamicOrbitKeyframes = (item, stageSize) => {
  const geometry = getDynamicOrbitGeometry(item, stageSize)
  const {
    orbitX,
    orbitY,
    orbitX92,
    orbitX71,
    orbitX38,
    orbitY92,
    orbitY71,
    orbitY38
  } = geometry

  return [
    [orbitX, 0],
    [orbitX92, orbitY38],
    [orbitX71, orbitY71],
    [orbitX38, orbitY92],
    [0, orbitY],
    [-orbitX38, orbitY92],
    [-orbitX71, orbitY71],
    [-orbitX92, orbitY38],
    [-orbitX, 0],
    [-orbitX92, -orbitY38],
    [-orbitX71, -orbitY71],
    [-orbitX38, -orbitY92],
    [0, -orbitY],
    [orbitX38, -orbitY92],
    [orbitX71, -orbitY71],
    [orbitX92, -orbitY38],
    [orbitX, 0]
  ].map(([x, y], index, points) => ({
    offset: index / (points.length - 1),
    x,
    y
  }))
}

export const sampleDynamicOrbitMotion = (item, progress, stageSize) => {
  const keyframes = getDynamicOrbitKeyframes(item, stageSize)
  const normalizedProgress = ((Number(progress) || 0) % 1 + 1) % 1
  const scaled = normalizedProgress * (keyframes.length - 1)
  const lowerIndex = Math.min(keyframes.length - 2, Math.floor(scaled))
  const upperIndex = lowerIndex + 1
  const ratio = scaled - lowerIndex
  const lower = keyframes[lowerIndex]
  const upper = keyframes[upperIndex]
  return {
    x: lerp(lower.x, upper.x, ratio),
    y: lerp(lower.y, upper.y, ratio)
  }
}

export {
  HORIZONTAL_KEYFRAMES_PER_WAVE,
  HORIZONTAL_MOTION_FRAME_COUNT,
  HORIZONTAL_STAGE_MARGIN,
  HORIZONTAL_WAVE_CYCLES,
  DYNAMIC_VERTICAL_WAVE_EASING
}
