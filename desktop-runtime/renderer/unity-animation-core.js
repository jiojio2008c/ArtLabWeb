import { UNITY_ANIMATION_CURVES } from './unity-animation-curves.js'

export const UNITY_EXTRA_ANIMATION_MIN_ID = 10
export const UNITY_EXTRA_ANIMATION_MAX_ID = 17

export const UNITY_EXTRA_ANIMATION_DEFINITIONS = Object.freeze([
  { id: 10, clipName: 'Dance02Anim', duration: 0.650000036, loop: true },
  { id: 11, clipName: 'DanceAnim', duration: 0.483333349, loop: true },
  { id: 12, clipName: 'JellyJumpAnim', duration: 0.9833334, loop: false },
  { id: 13, clipName: 'JumpFlipAnim', duration: 1.1500001, loop: false },
  { id: 14, clipName: 'PullRightAnimation', duration: 1.98333347, loop: false },
  { id: 15, clipName: 'RaiseHandAnimation', duration: 1.31666672, loop: false },
  { id: 16, clipName: 'RollingAnimation', duration: 0.650000036, loop: false },
  { id: 17, clipName: 'WaveAnimation', duration: 0.650000036, loop: false }
])

const GRID_COLUMNS = 7
const GRID_ROWS = 9
const TRIANGLE_CLIP_OVERDRAW_CSS_PX = 0.75

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))
const smoothstep = (edge0, edge1, value) => {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return amount * amount * (3 - 2 * amount)
}

const clipExportByName = new Map(UNITY_ANIMATION_CURVES.map((clip) => [clip.name, clip]))
const clipByAnimationId = new Map(UNITY_EXTRA_ANIMATION_DEFINITIONS.map((definition) => {
  const exportedClip = clipExportByName.get(definition.clipName)
  const curves = new Map((exportedClip?.curves ?? []).map((curve) => [curve.property, curve.keys]))
  return [definition.id, { ...definition, curves }]
}))

const sampleUnityHermiteCurve = (keys, timeSeconds) => {
  if (!keys?.length) return 0
  if (timeSeconds <= keys[0].time) return keys[0].value

  const lastKey = keys[keys.length - 1]
  if (timeSeconds >= lastKey.time) return lastKey.value

  let low = 0
  let high = keys.length - 1
  while (low + 1 < high) {
    const middle = (low + high) >> 1
    if (keys[middle].time <= timeSeconds) low = middle
    else high = middle
  }

  const left = keys[low]
  const right = keys[high]
  const duration = right.time - left.time
  const amount = duration > 0 ? (timeSeconds - left.time) / duration : 0
  const amount2 = amount * amount
  const amount3 = amount2 * amount
  const h00 = 2 * amount3 - 3 * amount2 + 1
  const h10 = amount3 - 2 * amount2 + amount
  const h01 = -2 * amount3 + 3 * amount2
  const h11 = amount3 - amount2

  return h00 * left.value
    + h10 * duration * left.outTangent
    + h01 * right.value
    + h11 * duration * right.inTangent
}

const resolveClipTime = (clip, timeSeconds) => {
  const time = Math.max(0, Number(timeSeconds) || 0)
  if (!clip.loop) return Math.min(time, clip.duration)
  const wrapped = time % clip.duration
  return wrapped < 0 ? wrapped + clip.duration : wrapped
}

const getCurveValue = (clip, property, timeSeconds) => (
  sampleUnityHermiteCurve(clip.curves.get(property), timeSeconds)
)

const getNormalizedCurveValue = (clip, property, timeSeconds) => (
  clamp(getCurveValue(clip, property, timeSeconds) / 100, -1.5, 1.5)
)

const getRootRotationDegrees = (clip, timeSeconds) => {
  const x = getCurveValue(clip, 'm_LocalRotation.x', timeSeconds)
  const w = getCurveValue(clip, 'm_LocalRotation.w', timeSeconds)
  if (!Number.isFinite(x) || !Number.isFinite(w) || Math.hypot(x, w) < 0.0001) return 0

  const degrees = 2 * Math.atan2(x, w) * 180 / Math.PI + 90
  return ((degrees % 360) + 360) % 360
}

export const sampleUnityAnimation = (animationId, timeSeconds) => {
  const id = Number(animationId)
  const clip = clipByAnimationId.get(id)
  if (!clip) {
    return {
      animationId: id,
      clipTime: 0,
      duration: 0,
      loop: false,
      offsetXRatio: 0,
      offsetYRatio: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      channels: {}
    }
  }

  const clipTime = resolveClipTime(clip, timeSeconds)
  const channels = {}
  clip.curves.forEach((_keys, property) => {
    channels[property] = property.startsWith('blendShape.')
      ? getNormalizedCurveValue(clip, property, clipTime)
      : getCurveValue(clip, property, clipTime)
  })

  let offsetXRatio = 0
  let offsetYRatio = 0
  let rotation = 0
  let scaleX = 1
  let scaleY = 1

  if (id === 10) {
    const direction = (channels['blendShape.Shapekey02'] ?? 0) - (channels['blendShape.Shapekey01'] ?? 0)
    offsetXRatio = direction * 0.018
    offsetYRatio = -Math.abs(direction) * 0.012
    rotation = direction * 4.5
  } else if (id === 11) {
    const direction = (channels['blendShape.Shapekey08'] ?? 0) - (channels['blendShape.Shapekey07'] ?? 0)
    offsetXRatio = direction * 0.025
    offsetYRatio = -Math.abs(direction) * 0.02
    rotation = direction * 6
  } else if (id === 12) {
    const squash = channels['blendShape.Shapekey03'] ?? 0
    const stretch = channels['blendShape.Shapekey04'] ?? 0
    offsetYRatio = -stretch * 0.08 + squash * 0.018
    scaleX = 1 + squash * 0.08 - stretch * 0.05
    scaleY = 1 - squash * 0.06 + stretch * 0.09
  } else if (id === 13) {
    const rootZ = Number(channels['m_LocalPosition.z'] ?? 0)
    offsetYRatio = clamp(rootZ / 5, -1, 0) * 0.28
    rotation = getRootRotationDegrees(clip, clipTime)
  } else if (id === 16) {
    const rootZ = Math.abs(Number(channels['m_LocalPosition.z'] ?? 0))
    offsetYRatio = -clamp(rootZ, 0, 1) * 0.055
    rotation = getRootRotationDegrees(clip, clipTime)
  }

  return {
    animationId: id,
    clipTime,
    duration: clip.duration,
    loop: clip.loop,
    offsetXRatio,
    offsetYRatio,
    rotation,
    scaleX,
    scaleY,
    channels
  }
}

const getSourceWidth = (source) => source.naturalWidth || source.videoWidth || source.width || 1
const getSourceHeight = (source) => source.naturalHeight || source.videoHeight || source.height || 1

const getTriangleClipOverdraw = (context) => {
  const transform = context.getTransform()
  const transformScale = Math.max(
    Math.hypot(transform.a, transform.b),
    Math.hypot(transform.c, transform.d),
    0.000001
  )
  const canvas = context.canvas
  const cssWidth = Number(canvas?.clientWidth) || Number(canvas?.width) || 1
  const bitmapWidth = Number(canvas?.width) || cssWidth
  const pixelRatio = bitmapWidth / cssWidth
  return TRIANGLE_CLIP_OVERDRAW_CSS_PX * pixelRatio / transformScale
}

const expandTriangleVertex = (x, y, centerX, centerY, amount) => {
  const offsetX = x - centerX
  const offsetY = y - centerY
  const distance = Math.hypot(offsetX, offsetY)
  if (distance < 0.000001) return { x, y }
  return { x: x + offsetX / distance * amount, y: y + offsetY / distance * amount }
}

const drawImageTriangle = (
  context,
  source,
  sx0,
  sy0,
  sx1,
  sy1,
  sx2,
  sy2,
  dx0,
  dy0,
  dx1,
  dy1,
  dx2,
  dy2
) => {
  const denominator = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1)
  if (Math.abs(denominator) < 0.000001) return

  const a = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / denominator
  const b = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / denominator
  const c = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / denominator
  const d = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / denominator
  const e = (
    dx0 * (sx1 * sy2 - sx2 * sy1)
    + dx1 * (sx2 * sy0 - sx0 * sy2)
    + dx2 * (sx0 * sy1 - sx1 * sy0)
  ) / denominator
  const f = (
    dy0 * (sx1 * sy2 - sx2 * sy1)
    + dy1 * (sx2 * sy0 - sx0 * sy2)
    + dy2 * (sx0 * sy1 - sx1 * sy0)
  ) / denominator

  const overdraw = getTriangleClipOverdraw(context)
  const centerX = (dx0 + dx1 + dx2) / 3
  const centerY = (dy0 + dy1 + dy2) / 3
  const point0 = expandTriangleVertex(dx0, dy0, centerX, centerY, overdraw)
  const point1 = expandTriangleVertex(dx1, dy1, centerX, centerY, overdraw)
  const point2 = expandTriangleVertex(dx2, dy2, centerX, centerY, overdraw)

  context.save()
  context.beginPath()
  context.moveTo(point0.x, point0.y)
  context.lineTo(point1.x, point1.y)
  context.lineTo(point2.x, point2.y)
  context.closePath()
  context.clip()
  context.transform(a, b, c, d, e, f)
  context.drawImage(source, 0, 0)
  context.restore()
}

const getDeformedVertex = (animationId, u, v, width, height, sample) => {
  const channels = sample.channels
  const baseX = (u - 0.5) * width
  const baseY = (v - 0.5) * height
  let x = baseX
  let y = baseY

  if (animationId === 10 || animationId === 11) {
    const firstKey = animationId === 10 ? 'blendShape.Shapekey01' : 'blendShape.Shapekey07'
    const secondKey = animationId === 10 ? 'blendShape.Shapekey02' : 'blendShape.Shapekey08'
    const direction = (channels[secondKey] ?? 0) - (channels[firstKey] ?? 0)
    const torso = Math.sin(Math.PI * v)
    const shoulders = 1 - smoothstep(0.18, 0.72, v)
    const hips = smoothstep(0.42, 0.92, v)
    const strength = animationId === 10 ? 0.06 : 0.082
    x += width * direction * torso * strength * (0.45 + v)
    x += width * direction * (shoulders - hips) * 0.02
    y += height * direction * (u - 0.5) * torso * (animationId === 10 ? 0.026 : 0.038)
  } else if (animationId === 12 || animationId === 13) {
    const squash = channels['blendShape.Shapekey03'] ?? 0
    const stretch = channels['blendShape.Shapekey04'] ?? 0
    const horizontalScale = 1 + squash * 0.12 - stretch * 0.075
    const verticalScale = 1 - squash * 0.1 + stretch * 0.15
    x = baseX * horizontalScale
    y = height / 2 + (baseY - height / 2) * verticalScale
    y += Math.sin(Math.PI * u) * height * (squash - stretch) * 0.018
  } else if (animationId === 14) {
    const pull = clamp(Math.max(channels['blendShape.Key 21'] ?? 0, channels['blendShape.Key 22'] ?? 0), 0, 1)
    const direction = (channels['blendShape.Key 22'] ?? 0) - (channels['blendShape.Key 21'] ?? 0)
    x = -width / 2 + u * width * (1 + pull * 0.24)
    y += height * direction * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * 0.035
  } else if (animationId === 15) {
    const leftRaise = channels['blendShape.Key 10'] ?? 0
    const rightRaise = channels['blendShape.Key 11'] ?? 0
    const upperBody = 1 - smoothstep(0.32, 0.7, v)
    const leftSide = 1 - smoothstep(0.2, 0.55, u)
    const rightSide = smoothstep(0.45, 0.8, u)
    const raise = leftRaise * leftSide + rightRaise * rightSide
    y -= height * upperBody * raise * 0.17
    x += width * upperBody * (rightRaise * rightSide - leftRaise * leftSide) * 0.055
  } else if (animationId === 17) {
    const leftWave = channels['blendShape.Key 19'] ?? 0
    const rightWave = channels['blendShape.Key 20'] ?? 0
    const upperBody = 1 - smoothstep(0.3, 0.72, v)
    const side = Math.tanh((u - 0.5) * 6)
    const direction = rightWave - leftWave
    x += width * upperBody * direction * (0.04 + Math.abs(side) * 0.04)
    y -= height * upperBody * Math.abs(direction) * Math.abs(side) * 0.045
  }

  return { x, y }
}

export const drawUnityAnimationImage = (
  context,
  source,
  x,
  y,
  width,
  height,
  animationId,
  timeSeconds
) => {
  if (!source || width <= 0 || height <= 0) return
  const id = Number(animationId)
  if (id < UNITY_EXTRA_ANIMATION_MIN_ID || id > UNITY_EXTRA_ANIMATION_MAX_ID) return

  const sourceWidth = getSourceWidth(source)
  const sourceHeight = getSourceHeight(source)
  if (sourceWidth <= 0 || sourceHeight <= 0) return

  const containScale = Math.min(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * containScale
  const drawHeight = sourceHeight * containScale
  const sample = sampleUnityAnimation(id, timeSeconds)
  const columnCount = GRID_COLUMNS - 1
  const rowCount = GRID_ROWS - 1

  context.save()
  context.translate(
    x + width / 2 + sample.offsetXRatio * drawWidth,
    y + height / 2 + sample.offsetYRatio * drawHeight
  )
  context.rotate(sample.rotation * Math.PI / 180)
  context.scale(sample.scaleX, sample.scaleY)

  for (let row = 0; row < rowCount; row += 1) {
    const v0 = row / rowCount
    const v1 = (row + 1) / rowCount
    const sy0 = v0 * sourceHeight
    const sy1 = v1 * sourceHeight

    for (let column = 0; column < columnCount; column += 1) {
      const u0 = column / columnCount
      const u1 = (column + 1) / columnCount
      const sx0 = u0 * sourceWidth
      const sx1 = u1 * sourceWidth
      const point00 = getDeformedVertex(id, u0, v0, drawWidth, drawHeight, sample)
      const point10 = getDeformedVertex(id, u1, v0, drawWidth, drawHeight, sample)
      const point01 = getDeformedVertex(id, u0, v1, drawWidth, drawHeight, sample)
      const point11 = getDeformedVertex(id, u1, v1, drawWidth, drawHeight, sample)

      drawImageTriangle(
        context,
        source,
        sx0,
        sy0,
        sx1,
        sy0,
        sx0,
        sy1,
        point00.x,
        point00.y,
        point10.x,
        point10.y,
        point01.x,
        point01.y
      )
      drawImageTriangle(
        context,
        source,
        sx1,
        sy0,
        sx1,
        sy1,
        sx0,
        sy1,
        point10.x,
        point10.y,
        point11.x,
        point11.y,
        point01.x,
        point01.y
      )
    }
  }
  context.restore()
}

const frameSubscribers = new Set()
let frameRequestId = 0

const runAnimationFrame = (timestamp) => {
  frameSubscribers.forEach((subscriber) => subscriber(timestamp / 1000))
  frameRequestId = frameSubscribers.size > 0 ? requestAnimationFrame(runAnimationFrame) : 0
}

export const subscribeUnityAnimationFrame = (subscriber) => {
  frameSubscribers.add(subscriber)
  if (!frameRequestId) frameRequestId = requestAnimationFrame(runAnimationFrame)

  return () => {
    frameSubscribers.delete(subscriber)
    if (frameSubscribers.size === 0 && frameRequestId) {
      cancelAnimationFrame(frameRequestId)
      frameRequestId = 0
    }
  }
}
