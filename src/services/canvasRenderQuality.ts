const MAX_CANVAS_PIXEL_RATIO = 4
const MAX_CANVAS_BITMAP_PIXELS = 8 * 1024 * 1024
const MAX_CANVAS_BITMAP_EDGE = 4096
const IOS_MAX_CANVAS_PIXEL_RATIO = 2
const IOS_MAX_CANVAS_BITMAP_PIXELS = 4 * 1024 * 1024
const IOS_MAX_CANVAS_BITMAP_EDGE = 3072
const MIN_MESH_AXIS_BITMAP_PIXELS = 12
const MAX_MESH_AXIS_SCALE_MULTIPLIER = 12

interface CanvasBitmapScaleOptions {
  width: number
  height: number
  renderScale?: number
  sourceWidth?: number
  sourceHeight?: number
  contentWidth?: number
  contentHeight?: number
}

const isIosCanvasDevice = () => {
  if (typeof navigator === 'undefined') return false

  const platform = navigator.platform || ''
  const userAgent = navigator.userAgent || ''
  return /iPad|iPhone|iPod/i.test(`${platform} ${userAgent}`)
    || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

const resolveCanvasPixelRatio = (
  width: number,
  height: number,
  renderScale = 1
) => {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1)
  const effectiveRenderScale = Math.max(1, Math.abs(renderScale) || 1)
  const iosCanvasDevice = isIosCanvasDevice()
  const maxPixelRatio = iosCanvasDevice
    ? IOS_MAX_CANVAS_PIXEL_RATIO
    : MAX_CANVAS_PIXEL_RATIO
  const maxBitmapPixels = iosCanvasDevice
    ? IOS_MAX_CANVAS_BITMAP_PIXELS
    : MAX_CANVAS_BITMAP_PIXELS
  const maxBitmapEdge = iosCanvasDevice
    ? IOS_MAX_CANVAS_BITMAP_EDGE
    : MAX_CANVAS_BITMAP_EDGE
  const desiredRatio = Math.min(
    maxPixelRatio,
    devicePixelRatio * effectiveRenderScale
  )
  const pixelBudgetRatio = Math.sqrt(
    maxBitmapPixels / (safeWidth * safeHeight)
  )
  const edgeBudgetRatio = Math.min(
    maxBitmapEdge / safeWidth,
    maxBitmapEdge / safeHeight
  )

  return Math.max(1, Math.min(desiredRatio, pixelBudgetRatio, edgeBudgetRatio))
}

const resolveCanvasBitmapScale = ({
  width,
  height,
  renderScale = 1,
  sourceWidth = 0,
  sourceHeight = 0,
  contentWidth = width,
  contentHeight = height
}: CanvasBitmapScaleOptions) => {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const baseScale = resolveCanvasPixelRatio(safeWidth, safeHeight, renderScale)
  const validSource = Number.isFinite(sourceWidth)
    && Number.isFinite(sourceHeight)
    && sourceWidth > 0
    && sourceHeight > 0
  let scaleX = baseScale
  let scaleY = baseScale

  if (validSource) {
    const safeContentWidth = Math.max(1, contentWidth)
    const safeContentHeight = Math.max(1, contentHeight)
    const containScale = Math.min(
      safeContentWidth / sourceWidth,
      safeContentHeight / sourceHeight
    )
    const containedWidth = sourceWidth * containScale
    const containedHeight = sourceHeight * containScale
    scaleX = Math.max(
      baseScale,
      Math.min(
        baseScale * MAX_MESH_AXIS_SCALE_MULTIPLIER,
        MIN_MESH_AXIS_BITMAP_PIXELS / Math.max(Number.EPSILON, containedWidth)
      )
    )
    scaleY = Math.max(
      baseScale,
      Math.min(
        baseScale * MAX_MESH_AXIS_SCALE_MULTIPLIER,
        MIN_MESH_AXIS_BITMAP_PIXELS / Math.max(Number.EPSILON, containedHeight)
      )
    )
  }

  const iosCanvasDevice = isIosCanvasDevice()
  const maxBitmapPixels = iosCanvasDevice
    ? IOS_MAX_CANVAS_BITMAP_PIXELS
    : MAX_CANVAS_BITMAP_PIXELS
  const maxBitmapEdge = iosCanvasDevice
    ? IOS_MAX_CANVAS_BITMAP_EDGE
    : MAX_CANVAS_BITMAP_EDGE
  scaleX = Math.min(scaleX, maxBitmapEdge / safeWidth)
  scaleY = Math.min(scaleY, maxBitmapEdge / safeHeight)

  const bitmapPixels = safeWidth * scaleX * safeHeight * scaleY
  if (bitmapPixels > maxBitmapPixels) {
    const budgetScale = Math.sqrt(maxBitmapPixels / bitmapPixels)
    scaleX *= budgetScale
    scaleY *= budgetScale
  }

  return {
    x: Math.max(Number.EPSILON, scaleX),
    y: Math.max(Number.EPSILON, scaleY)
  }
}

export { resolveCanvasBitmapScale, resolveCanvasPixelRatio }
export type { CanvasBitmapScaleOptions }
