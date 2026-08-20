const MAX_CANVAS_PIXEL_RATIO = 4
const MAX_CANVAS_BITMAP_PIXELS = 8 * 1024 * 1024
const MAX_CANVAS_BITMAP_EDGE = 4096

const resolveCanvasPixelRatio = (
  width: number,
  height: number,
  renderScale = 1
) => {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1)
  const effectiveRenderScale = Math.max(1, Math.abs(renderScale) || 1)
  const desiredRatio = Math.min(
    MAX_CANVAS_PIXEL_RATIO,
    devicePixelRatio * effectiveRenderScale
  )
  const pixelBudgetRatio = Math.sqrt(
    MAX_CANVAS_BITMAP_PIXELS / (safeWidth * safeHeight)
  )
  const edgeBudgetRatio = Math.min(
    MAX_CANVAS_BITMAP_EDGE / safeWidth,
    MAX_CANVAS_BITMAP_EDGE / safeHeight
  )

  return Math.max(1, Math.min(desiredRatio, pixelBudgetRatio, edgeBudgetRatio))
}

export { resolveCanvasPixelRatio }
