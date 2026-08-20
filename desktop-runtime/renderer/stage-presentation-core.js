export const DEFAULT_STAGE_WATERMARK_ENABLED = true
export const DEFAULT_STAGE_WATERMARK_LABEL = 'MagicFloor'
export const DEFAULT_STAGE_WATERMARK_OPACITY = 0.44

const finitePositiveNumber = (value, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export const configureHighQualityImageSmoothing = (renderContext) => {
  if (!renderContext) return false

  try {
    renderContext.imageSmoothingEnabled = true
  } catch {
    return false
  }

  try {
    renderContext.imageSmoothingQuality = 'high'
  } catch {}

  return true
}

export const drawMagicFloorWatermarkPattern = (renderContext, options = {}) => {
  if (!renderContext) return 0

  const width = finitePositiveNumber(options.width, 1920)
  const height = finitePositiveNumber(options.height, 1080)
  const label = String(options.label || DEFAULT_STAGE_WATERMARK_LABEL).trim()
  if (!label) return 0

  const angle = Number.isFinite(Number(options.angleRadians))
    ? Number(options.angleRadians)
    : -28 * Math.PI / 180
  const fontSize = finitePositiveNumber(options.fontSize, 44)
  const columnSpacing = finitePositiveNumber(options.columnSpacing, 470)
  const rowSpacing = finitePositiveNumber(options.rowSpacing, 260)
  const cosine = Math.abs(Math.cos(angle))
  const sine = Math.abs(Math.sin(angle))
  const halfRotatedWidth = (width * cosine + height * sine) / 2
  const halfRotatedHeight = (width * sine + height * cosine) / 2

  renderContext.save()
  renderContext.beginPath()
  renderContext.rect(0, 0, width, height)
  renderContext.clip()
  renderContext.translate(width / 2, height / 2)
  renderContext.rotate(angle)
  renderContext.globalAlpha = DEFAULT_STAGE_WATERMARK_OPACITY
  renderContext.fillStyle = '#ffffff'
  renderContext.strokeStyle = '#030c16'
  renderContext.lineWidth = 1.5
  renderContext.font = `700 ${fontSize}px "Segoe UI", Arial, sans-serif`
  renderContext.textAlign = 'center'
  renderContext.textBaseline = 'middle'

  let drawCount = 0
  let rowIndex = 0
  for (
    let y = -halfRotatedHeight - rowSpacing;
    y <= halfRotatedHeight + rowSpacing;
    y += rowSpacing
  ) {
    const rowOffset = rowIndex % 2 === 0 ? 0 : columnSpacing / 2
    for (
      let x = -halfRotatedWidth - columnSpacing;
      x <= halfRotatedWidth + columnSpacing;
      x += columnSpacing
    ) {
      const drawX = x + rowOffset
      if (typeof renderContext.strokeText === 'function') {
        renderContext.strokeText(label, drawX, y)
      }
      renderContext.fillText(label, drawX, y)
      drawCount += 1
    }
    rowIndex += 1
  }

  renderContext.restore()
  return drawCount
}

export const drawStageWatermarkLayer = (renderContext, watermarkLayer, options = {}) => {
  const enabled = options.enabled ?? DEFAULT_STAGE_WATERMARK_ENABLED
  const stageActive = options.stageActive ?? true
  if (!renderContext || !watermarkLayer || enabled !== true || stageActive !== true) return false

  const width = finitePositiveNumber(options.width, 1920)
  const height = finitePositiveNumber(options.height, 1080)
  renderContext.save()
  renderContext.beginPath()
  renderContext.rect(0, 0, width, height)
  renderContext.clip()
  renderContext.drawImage(watermarkLayer, 0, 0, width, height)
  renderContext.restore()
  return true
}
