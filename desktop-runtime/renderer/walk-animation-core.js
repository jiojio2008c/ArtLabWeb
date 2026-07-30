export const WALK_ANIMATION_ID = 9
export const WALK_DURATION_SECONDS = 0.8166667

const GRID_COLUMNS = 7
const GRID_ROWS = 9
const TRIANGLE_CLIP_OVERDRAW_CSS_PX = 0.75

const KEY_23_CURVE = [
  { time: 0, value: 100, inTangent: -28.03253, outTangent: -28.03253 },
  { time: 0.100000009, value: 85.4847946, inTangent: -261.8877, outTangent: -261.8877 },
  { time: 0.383333355, value: 1.81760621, inTangent: -105.215462, outTangent: -105.215462 },
  { time: 0.400000036, value: 0.467204064, inTangent: -54.5281525, outTangent: -54.5281525 },
  { time: 0.4166667, value: 0.000000428571525, inTangent: 1.10392952, outTangent: 1.10392952 },
  { time: 0.433333367, value: 0.5040026, inTangent: 58.75209, outTangent: 58.75209 },
  { time: 0.533333361, value: 20.46241, inTangent: 307.5841, outTangent: 307.5841 },
  { time: 0.8000001, value: 99.0288, inTangent: 58.75181, outTangent: 58.75181 },
  { time: WALK_DURATION_SECONDS, value: 99.53282, inTangent: 30.24127, outTangent: 30.24127 }
]

const KEY_24_CURVE = [
  { time: 0, value: 0, inTangent: 28.0319977, outTangent: 28.0319977 },
  { time: 0.0166666675, value: 0.467199981, inTangent: 54.5279961, outTangent: 54.5279961 },
  { time: 0.13333334, value: 24.166399, inTangent: 312.576, outTangent: 312.576 },
  { time: 0.433333367, value: 99.496, inTangent: -58.7519379, outTangent: -58.7519379 },
  { time: 0.783333361, value: 2.42557335, inTangent: -113.183334, outTangent: -113.183334 },
  { time: 0.8000001, value: 0.971195936, inTangent: -58.7516632, outTangent: -58.7516632 },
  { time: WALK_DURATION_SECONDS, value: 0.4671812, inTangent: -30.2409134, outTangent: -30.2409134 }
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const smoothstep = (edge0, edge1, value) => {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return amount * amount * (3 - 2 * amount)
}

const resolveLoopTime = (timeSeconds) => {
  const wrapped = timeSeconds % WALK_DURATION_SECONDS
  return wrapped < 0 ? wrapped + WALK_DURATION_SECONDS : wrapped
}

const sampleUnityHermiteCurve = (keys, timeSeconds) => {
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
  const amount = (timeSeconds - left.time) / duration
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

export const sampleWalkAnimation = (timeSeconds) => {
  const clipTime = resolveLoopTime(timeSeconds)
  return {
    clipTime,
    key23: clamp(sampleUnityHermiteCurve(KEY_23_CURVE, clipTime) / 100, 0, 1),
    key24: clamp(sampleUnityHermiteCurve(KEY_24_CURVE, clipTime) / 100, 0, 1)
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
  return {
    x: x + offsetX / distance * amount,
    y: y + offsetY / distance * amount
  }
}

const getVertexX = (u, v, x, width, key23, key24) => {
  const direction = key24 - key23
  const side = Math.tanh((u - 0.5) * 5)
  const edge = Math.sin(Math.PI * u)
  const lowerBody = smoothstep(0.48, 0.96, v)
  const upperBody = 1 - smoothstep(0.18, 0.64, v)
  const body = Math.sin(Math.PI * v)
  const stride = side * lowerBody * 0.058
  const counterSwing = -side * upperBody * 0.026
  const bodySway = body * 0.014
  return x + u * width + width * edge * direction * (stride + counterSwing + bodySway)
}

const getVertexY = (u, v, y, height, key23, key24) => {
  const direction = key24 - key23
  const crossing = clamp(1 - Math.abs(direction), 0, 1)
  const side = Math.tanh((u - 0.5) * 5)
  const edge = Math.sin(Math.PI * v)
  const lowerBody = smoothstep(0.5, 0.97, v)
  const upperBody = 1 - smoothstep(0.18, 0.62, v)
  const body = Math.sin(Math.PI * v)
  const activeLeg = Math.max(0, direction * side)
  const passiveLeg = Math.max(0, -direction * side)
  const stepLift = -lowerBody * activeLeg * 0.035
  const stepSettle = lowerBody * passiveLeg * 0.009
  const shoulderTilt = upperBody * direction * side * 0.011
  const bodyLift = -body * crossing * 0.012
  return y + v * height + height * edge * (stepLift + stepSettle + shoulderTilt + bodyLift)
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

  // A tiny clip overlap hides transparent antialias gaps between adjacent mesh triangles.
  const clipOverdraw = getTriangleClipOverdraw(context)
  const clipCenterX = (dx0 + dx1 + dx2) / 3
  const clipCenterY = (dy0 + dy1 + dy2) / 3
  const clip0 = expandTriangleVertex(dx0, dy0, clipCenterX, clipCenterY, clipOverdraw)
  const clip1 = expandTriangleVertex(dx1, dy1, clipCenterX, clipCenterY, clipOverdraw)
  const clip2 = expandTriangleVertex(dx2, dy2, clipCenterX, clipCenterY, clipOverdraw)

  context.save()
  context.beginPath()
  context.moveTo(clip0.x, clip0.y)
  context.lineTo(clip1.x, clip1.y)
  context.lineTo(clip2.x, clip2.y)
  context.closePath()
  context.clip()
  context.transform(a, b, c, d, e, f)
  context.drawImage(source, 0, 0)
  context.restore()
}

export const drawWalkImage = (context, source, x, y, width, height, timeSeconds) => {
  if (!source || width <= 0 || height <= 0) return

  const sourceWidth = getSourceWidth(source)
  const sourceHeight = getSourceHeight(source)
  if (sourceWidth <= 0 || sourceHeight <= 0) return

  const containScale = Math.min(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * containScale
  const drawHeight = sourceHeight * containScale
  const drawX = x + (width - drawWidth) / 2
  const drawY = y + (height - drawHeight) / 2
  const { key23, key24 } = sampleWalkAnimation(timeSeconds)
  const columnCount = GRID_COLUMNS - 1
  const rowCount = GRID_ROWS - 1

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
      const dx00 = getVertexX(u0, v0, drawX, drawWidth, key23, key24)
      const dy00 = getVertexY(u0, v0, drawY, drawHeight, key23, key24)
      const dx10 = getVertexX(u1, v0, drawX, drawWidth, key23, key24)
      const dy10 = getVertexY(u1, v0, drawY, drawHeight, key23, key24)
      const dx01 = getVertexX(u0, v1, drawX, drawWidth, key23, key24)
      const dy01 = getVertexY(u0, v1, drawY, drawHeight, key23, key24)
      const dx11 = getVertexX(u1, v1, drawX, drawWidth, key23, key24)
      const dy11 = getVertexY(u1, v1, drawY, drawHeight, key23, key24)

      drawImageTriangle(
        context,
        source,
        sx0,
        sy0,
        sx1,
        sy0,
        sx0,
        sy1,
        dx00,
        dy00,
        dx10,
        dy10,
        dx01,
        dy01
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
        dx10,
        dy10,
        dx11,
        dy11,
        dx01,
        dy01
      )
    }
  }
}

const frameSubscribers = new Set()
let frameRequestId = 0

const runAnimationFrame = (timestamp) => {
  frameSubscribers.forEach((subscriber) => subscriber(timestamp / 1000))
  frameRequestId = frameSubscribers.size > 0 ? requestAnimationFrame(runAnimationFrame) : 0
}

export const subscribeWalkAnimation = (subscriber) => {
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
