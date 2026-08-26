import {
  deriveBubbleOutlineColor,
  drawBubbleShape,
  getBubbleShapeDefinition,
  normalizeBubbleColor
} from './bubble-shape-catalog.js'

const DEFAULT_BUBBLE_WIDTH = 1080
const DEFAULT_BUBBLE_HEIGHT = 480
const MIN_BUBBLE_WIDTH = 220
const MAX_BUBBLE_WIDTH = 1600
const MIN_BUBBLE_HEIGHT = 140
const MAX_BUBBLE_HEIGHT = 1000
const DEFAULT_TITLE_WIDTH = 900
const DEFAULT_TITLE_HEIGHT = 220

export const BUBBLE_STYLE_IDS = Object.freeze([
  'dialogue-rounded-left',
  'dialogue-rounded-right',
  'dialogue-soft-left',
  'dialogue-soft-right',
  'dialogue-comic-left',
  'dialogue-comic-right',
  'thought-cloud-left',
  'thought-cloud-right',
  'thought-soft-left',
  'thought-soft-right',
  'title-rounded',
  'title-pill',
  'title-ticket',
  'title-underline',
  'title-none'
])

export const BUBBLE_TITLE_STYLE_IDS = Object.freeze([
  'title-rounded',
  'title-pill',
  'title-ticket',
  'title-underline',
  'title-none'
])

export const BUBBLE_TITLE_MASK_IDS = Object.freeze([
  'rounded',
  'pill',
  'ticket',
  'underline',
  'none'
])

export const BUBBLE_PALETTE_IDS = Object.freeze([
  'ink',
  'ocean',
  'coral',
  'sun',
  'violet'
])

const STYLE_BY_TYPE = Object.freeze({
  dialogue: 'dialogue-rounded-right',
  thought: 'thought-cloud-right',
  title: 'title-rounded'
})

const LEGACY_STYLE_ALIASES = Object.freeze({
  'dialogue-rounded': 'dialogue-rounded-right',
  'dialogue-soft': 'dialogue-soft-right',
  'dialogue-comic': 'dialogue-comic-right',
  'thought-cloud': 'thought-cloud-right',
  'thought-soft': 'thought-cloud-right',
  'thought-soft-left': 'thought-cloud-left',
  'thought-soft-right': 'thought-cloud-right'
})

const PALETTE_BY_ID = Object.freeze({
  ink: {
    text: '#152033',
    title: '#ffffff',
    titleSurface: '#263a3b'
  },
  ocean: {
    text: '#123149',
    title: '#ffffff',
    titleSurface: '#0c8fa4'
  },
  coral: {
    text: '#4c2324',
    title: '#ffffff',
    titleSurface: '#dd6859'
  },
  sun: {
    text: '#44320b',
    title: '#ffffff',
    titleSurface: '#c88722'
  },
  violet: {
    text: '#2e1a4a',
    title: '#ffffff',
    titleSurface: '#7567b4'
  }
})

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const finiteNumber = (value, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export const normalizeBubble = (value = {}) => {
  const bubbleType = value.bubbleType === 'thought'
    ? 'thought'
    : value.bubbleType === 'title'
      ? 'title'
      : 'dialogue'
  const requestedStyle = String(value.styleId || '').trim()
  const canonicalStyle = LEGACY_STYLE_ALIASES[requestedStyle] ?? requestedStyle
  const hasMatchingStyle = bubbleType === 'thought'
    ? canonicalStyle.startsWith('thought-')
    : bubbleType === 'title'
      ? BUBBLE_TITLE_STYLE_IDS.includes(canonicalStyle)
      : canonicalStyle.startsWith('dialogue-')
  const styleId = BUBBLE_STYLE_IDS.includes(canonicalStyle)
    && hasMatchingStyle
    ? canonicalStyle
    : STYLE_BY_TYPE[bubbleType]
  const paletteId = BUBBLE_PALETTE_IDS.includes(value.paletteId) ? value.paletteId : (bubbleType === 'thought' ? 'ink' : 'ocean')
  const palette = PALETTE_BY_ID[paletteId] ?? PALETTE_BY_ID.ocean
  const titleMaskId = BUBBLE_TITLE_MASK_IDS.includes(value.titleMaskId) ? value.titleMaskId : 'rounded'
  const revealMode = value.revealMode === 'typewriter' || value.revealMode === 'character'
    ? 'typewriter'
    : 'all'
  const rawMaskOpacity = value.maskOpacity === undefined || value.maskOpacity === null || value.maskOpacity === ''
    ? 0.92
    : finiteNumber(value.maskOpacity, 0.92)
  const maskOpacity = clamp(rawMaskOpacity, 0, 1)
  const legacyTitle = String(value.title ?? '').slice(0, 120)
  const requestedBodyText = String(value.bodyText ?? value.text ?? '').slice(0, 4000)
  const shapeDefinition = bubbleType === 'title' ? null : getBubbleShapeDefinition(styleId)
  const surfaceColor = bubbleType === 'title'
    ? normalizeBubbleColor(value.surfaceColor, value.maskColor || palette.titleSurface)
    : normalizeBubbleColor(value.surfaceColor, shapeDefinition.defaultSurfaceColor)
  const outlineColor = bubbleType === 'title'
    ? normalizeBubbleColor(value.outlineColor, surfaceColor)
    : normalizeBubbleColor(
        value.outlineColor,
        typeof value.surfaceColor === 'string' && value.surfaceColor.trim()
          ? deriveBubbleOutlineColor(surfaceColor)
          : shapeDefinition.defaultOutlineColor || deriveBubbleOutlineColor(surfaceColor)
      )
  const defaultWidth = bubbleType === 'thought'
    ? 940
    : bubbleType === 'title'
      ? DEFAULT_TITLE_WIDTH
      : DEFAULT_BUBBLE_WIDTH
  const defaultHeight = bubbleType === 'thought'
    ? 680
    : bubbleType === 'title'
      ? DEFAULT_TITLE_HEIGHT
      : DEFAULT_BUBBLE_HEIGHT
  return {
    schemaVersion: Math.max(1, Math.round(finiteNumber(value.schemaVersion ?? value.version, 1))),
    bubbleType,
    styleId,
    title: bubbleType === 'title' ? '' : legacyTitle,
    bodyText: bubbleType === 'title' && !requestedBodyText.trim() ? legacyTitle : requestedBodyText,
    revealMode,
    revealIntervalMs: clamp(Math.round(finiteNumber(value.revealIntervalMs, 80)), 20, 1000),
    fontSizePx: clamp(Math.round(finiteNumber(value.fontSizePx, 52)), 18, 120),
    textColor: typeof value.textColor === 'string' && value.textColor.trim()
      ? value.textColor.trim().slice(0, 32)
      : '',
    surfaceColor,
    outlineColor,
    titleMaskId,
    paletteId,
    maskColor: typeof value.maskColor === 'string' && value.maskColor.trim()
      ? value.maskColor.trim().slice(0, 32)
      : palette.titleSurface,
    maskOpacity,
    widthPx: clamp(Math.round(finiteNumber(value.widthPx, defaultWidth)), MIN_BUBBLE_WIDTH, MAX_BUBBLE_WIDTH),
    heightPx: clamp(Math.round(finiteNumber(value.heightPx, defaultHeight)), MIN_BUBBLE_HEIGHT, MAX_BUBBLE_HEIGHT),
    imageAssetId: bubbleType !== 'title' && typeof value.imageAssetId === 'string' && value.imageAssetId.trim()
      ? value.imageAssetId.trim()
      : null
  }
}

export const isBubbleItem = (item) => item?.kind === 'bubble' || Boolean(item?.bubble)

export const getBubbleSize = (bubble) => {
  const normalized = normalizeBubble(bubble)
  return { width: normalized.widthPx, height: normalized.heightPx }
}

export const getBubblePalette = (bubble) => PALETTE_BY_ID[normalizeBubble(bubble).paletteId] ?? PALETTE_BY_ID.ocean

export const getBubbleSurface = (bubble) => {
  const normalized = normalizeBubble(bubble)
  if (normalized.bubbleType === 'title') {
    return { surface: normalized.maskColor, border: 'transparent' }
  }
  return { surface: normalized.surfaceColor, border: normalized.outlineColor }
}

export const getGraphemes = (value) => {
  const text = String(value ?? '')
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), (entry) => entry.segment)
  }
  return Array.from(text)
}

export const getVisibleBubbleText = (bubbleValue, elapsedMs) => {
  const bubble = normalizeBubble(bubbleValue)
  if (bubble.revealMode !== 'typewriter') return bubble.bodyText
  const graphemes = getGraphemes(bubble.bodyText)
  if (!graphemes.length) return ''
  const showAll = elapsedMs === Number.POSITIVE_INFINITY
  const elapsed = Math.max(0, finiteNumber(elapsedMs, 0))
  const count = showAll
    ? graphemes.length
    : clamp(Math.floor(elapsed / bubble.revealIntervalMs), 0, graphemes.length)
  return graphemes.slice(0, count).join('')
}

export const getContainRect = (sourceWidth, sourceHeight, boxWidth, boxHeight) => {
  const width = Math.max(1, finiteNumber(sourceWidth, 1))
  const height = Math.max(1, finiteNumber(sourceHeight, 1))
  const boxW = Math.max(1, finiteNumber(boxWidth, 1))
  const boxH = Math.max(1, finiteNumber(boxHeight, 1))
  const ratio = Math.min(boxW / width, boxH / height)
  const drawWidth = width * ratio
  const drawHeight = height * ratio
  return {
    x: (boxW - drawWidth) / 2,
    y: (boxH - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight
  }
}

export const wrapBubbleText = (context, text, maxWidth) => {
  const lines = []
  const paragraphs = String(text ?? '').split(/\r?\n/)
  paragraphs.forEach((paragraph) => {
    if (!paragraph) {
      lines.push('')
      return
    }
    let line = ''
    getGraphemes(paragraph).forEach((grapheme) => {
      const candidate = line + grapheme
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line)
        line = grapheme
      } else {
        line = candidate
      }
    })
    if (line) lines.push(line)
  })
  return lines.length ? lines : ['']
}

const roundedPath = (context, x, y, width, height, radius) => {
  const r = Math.min(Math.max(0, radius), Math.min(width, height) / 2)
  context.beginPath()
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, width, height, r)
    return
  }
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.quadraticCurveTo(x + width, y, x + width, y + r)
  context.lineTo(x + width, y + height - r)
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  context.lineTo(x + r, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

const drawTitleMask = (context, bubble, palette, x, y, width, height, radius) => {
  if (bubble.titleMaskId === 'none') return

  if (bubble.titleMaskId === 'underline') {
    context.save()
    context.beginPath()
    context.moveTo(x, y + height)
    context.lineTo(x + width, y + height)
    context.strokeStyle = palette.titleSurface
    context.lineWidth = clamp(height * 0.08, 3, 10)
    context.stroke()
    context.restore()
    return
  }

  if (bubble.titleMaskId === 'ticket') {
    const notch = Math.min(width * 0.06, height * 0.42)
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + width - notch, y)
    context.lineTo(x + width, y + height / 2)
    context.lineTo(x + width - notch, y + height)
    context.lineTo(x, y + height)
    context.lineTo(x + notch, y + height / 2)
    context.closePath()
  } else {
    roundedPath(context, x, y, width, height, bubble.titleMaskId === 'pill' ? height / 2 : radius)
  }

  context.save()
  context.globalAlpha *= 0.52
  context.fillStyle = palette.titleSurface
  context.fill()
  context.restore()
}

const drawTitle = (context, bubble, palette, x, y, width, padding) => {
  if (!bubble.title.trim()) return 0
  const titleFontSize = Math.min(bubble.fontSizePx * 1.02, 120)
  const titleVerticalPadding = clamp(titleFontSize * 0.28, 8, 20)
  const titleHorizontalPadding = clamp(titleFontSize * 0.75, 20, 50)
  const titleHeight = titleFontSize + titleVerticalPadding * 2
  const titleRadius = titleHeight * 0.28
  context.font = `700 ${titleFontSize}px Microsoft JhengHei, PingFang TC, sans-serif`
  const titleWidth = clamp(
    context.measureText(bubble.title).width + titleHorizontalPadding * 2,
    width * 0.35,
    width * 0.88
  )
  const titleX = x + padding * 0.45
  const titleY = y + padding * 0.42
  drawTitleMask(context, bubble, palette, titleX, titleY, titleWidth, titleHeight, titleRadius)
  context.fillStyle = bubble.titleMaskId === 'none' || bubble.titleMaskId === 'underline'
    ? palette.titleSurface
    : palette.title
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  const availableTitleWidth = Math.max(1, titleWidth - titleHorizontalPadding * 2)
  const titleGraphemes = getGraphemes(bubble.title)
  let visibleTitle = ''
  for (const grapheme of titleGraphemes) {
    const candidate = visibleTitle + grapheme
    if (context.measureText(candidate).width <= availableTitleWidth) {
      visibleTitle = candidate
      continue
    }
    while (visibleTitle && context.measureText(`${visibleTitle}…`).width > availableTitleWidth) {
      visibleTitle = getGraphemes(visibleTitle).slice(0, -1).join('')
    }
    visibleTitle = `${visibleTitle}…`
    break
  }
  context.fillText(visibleTitle, titleX + titleHorizontalPadding, titleY + titleHeight / 2)
  return titleHeight + padding * 0.55
}

const drawBodyText = (context, text, bubble, palette, x, y, width, height, padding) => {
  const color = bubble.textColor || palette.text
  context.fillStyle = color
  context.font = `700 ${bubble.fontSizePx}px Microsoft JhengHei, PingFang TC, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'top'
  const lineHeight = bubble.fontSizePx * 1.42
  const lines = wrapBubbleText(context, text, width - padding * 2)
  const maxLines = Math.max(1, Math.floor((height - padding * 2) / lineHeight))
  const visibleLines = lines.slice(0, maxLines)
  const startY = y + Math.max(padding, (height - visibleLines.length * lineHeight) / 2)
  visibleLines.forEach((line, index) => {
    context.fillText(line, x + width / 2, startY + index * lineHeight)
  })
}

const drawStandaloneTitleMask = (context, bubble, width, height) => {
  if (bubble.styleId === 'title-none') return

  context.save()
  context.globalAlpha *= bubble.maskOpacity
  context.fillStyle = bubble.maskColor
  context.strokeStyle = bubble.maskColor
  context.shadowColor = 'rgba(9, 18, 38, 0.22)'
  context.shadowBlur = 10
  context.shadowOffsetY = 6

  if (bubble.styleId === 'title-underline') {
    const inset = clamp(width * 0.08, 18, 72)
    const lineY = height - clamp(height * 0.16, 16, 42)
    context.beginPath()
    context.moveTo(inset, lineY)
    context.lineTo(width - inset, lineY)
    context.lineWidth = clamp(height * 0.045, 4, 12)
    context.lineCap = 'round'
    context.stroke()
    context.restore()
    return
  }

  if (bubble.styleId === 'title-ticket') {
    const notch = Math.min(width * 0.055, height * 0.42)
    context.beginPath()
    context.moveTo(0, 0)
    context.lineTo(width - notch, 0)
    context.lineTo(width, height / 2)
    context.lineTo(width - notch, height)
    context.lineTo(0, height)
    context.lineTo(notch, height / 2)
    context.closePath()
  } else {
    const radius = bubble.styleId === 'title-pill'
      ? height / 2
      : clamp(height * 0.2, 18, 52)
    roundedPath(context, 0, 0, width, height, radius)
  }

  context.fill()
  context.restore()
}

const drawStandaloneTitleText = (context, text, bubble, palette, width, height) => {
  if (!text) return
  const padding = clamp(Math.max(bubble.fontSizePx * 0.65, width * 0.045), 16, 80)
  const lineHeight = bubble.fontSizePx * 1.3
  context.font = `700 ${bubble.fontSizePx}px Microsoft JhengHei, PingFang TC, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.fillStyle = bubble.textColor || (
    bubble.styleId === 'title-none' || bubble.styleId === 'title-underline'
      ? bubble.maskColor
      : palette.title
  )
  const lines = wrapBubbleText(context, text, Math.max(1, width - padding * 2))
  const maxLines = Math.max(1, Math.floor((height - padding * 2) / lineHeight))
  const visibleLines = lines.slice(0, maxLines)
  const startY = Math.max(padding, (height - visibleLines.length * lineHeight) / 2)
  visibleLines.forEach((line, index) => {
    context.fillText(line, width / 2, startY + index * lineHeight)
  })
}

const drawStandaloneTitle = (context, bubble, palette, elapsedMs) => {
  const width = bubble.widthPx
  const height = bubble.heightPx
  const visibleText = getVisibleBubbleText(bubble, elapsedMs)
  context.save()
  drawStandaloneTitleMask(context, bubble, width, height)
  context.shadowColor = 'transparent'
  drawStandaloneTitleText(context, visibleText, bubble, palette, width, height)
  context.restore()
}

export const drawBubble = (context, bubbleValue, imageEntry = null, elapsedMs = Number.POSITIVE_INFINITY) => {
  const bubble = normalizeBubble(bubbleValue)
  const palette = getBubblePalette(bubble)
  if (bubble.bubbleType === 'title') {
    drawStandaloneTitle(context, bubble, palette, elapsedMs)
    return
  }
  const surface = getBubbleSurface(bubble)
  const width = bubble.widthPx
  const height = bubble.heightPx
  const shapeDefinition = getBubbleShapeDefinition(bubble.styleId)
  const scaleX = width / shapeDefinition.viewBox.width
  const scaleY = height / shapeDefinition.viewBox.height
  const safeRect = {
    x: shapeDefinition.contentRect.x * scaleX,
    y: shapeDefinition.contentRect.y * scaleY,
    width: shapeDefinition.contentRect.width * scaleX,
    height: shapeDefinition.contentRect.height * scaleY
  }
  const padding = clamp(Math.max(bubble.fontSizePx * 0.36, safeRect.width * 0.025), 12, 64)
  const borderWidth = shapeDefinition.defaultOutlineWidth

  context.save()
  context.lineWidth = borderWidth
  context.shadowColor = 'rgba(9, 18, 38, 0.25)'
  context.shadowBlur = shapeDefinition.baseStyleId === 'dialogue-comic' ? 16 : 10
  context.shadowOffsetY = 8
  drawBubbleShape(context, bubble.styleId, width, height, {
    surfaceColor: surface.surface,
    outlineColor: surface.border,
    lineWidth: borderWidth
  })
  context.shadowColor = 'transparent'

  let contentTop = safeRect.y
  if (bubble.title.trim()) {
    contentTop += drawTitle(
      context,
      bubble,
      palette,
      safeRect.x,
      safeRect.y,
      safeRect.width,
      padding
    )
  }

  const contentX = safeRect.x
  const contentWidth = safeRect.width
  const contentY = contentTop
  const contentHeight = Math.max(1, safeRect.y + safeRect.height - contentY)
  if (bubble.bubbleType === 'thought' && imageEntry?.loaded) {
    const visibleText = getVisibleBubbleText(bubble, elapsedMs)
    const imageHeight = visibleText
      ? Math.min(contentHeight * 0.48, Math.max(90, contentWidth * 0.58))
      : contentHeight
    const imageBox = getContainRect(imageEntry.width, imageEntry.height, contentWidth, imageHeight)
    context.drawImage(imageEntry.element, contentX + imageBox.x, contentY + imageBox.y, imageBox.width, imageBox.height)
    if (visibleText) {
      drawBodyText(context, visibleText, bubble, palette, contentX, contentY + imageHeight, contentWidth, contentHeight - imageHeight, padding * 0.72)
    }
  } else {
    const visibleText = getVisibleBubbleText(bubble, elapsedMs)
    if (visibleText) {
      drawBodyText(
        context,
        visibleText,
        bubble,
        palette,
        contentX,
        contentY,
        contentWidth,
        contentHeight,
        padding
      )
    }
  }
  context.restore()
}

export const getBubbleAssetId = (item) => {
  const value = item?.imageAssetId ?? item?.bubble?.imageAssetId ?? item?.bubble?.image?.id
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export const BUBBLE_DEFAULTS = Object.freeze({
  widthPx: DEFAULT_BUBBLE_WIDTH,
  heightPx: DEFAULT_BUBBLE_HEIGHT,
  fontSizePx: 52,
  revealIntervalMs: 80
})
