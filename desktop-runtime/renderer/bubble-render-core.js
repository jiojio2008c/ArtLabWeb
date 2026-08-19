const DEFAULT_BUBBLE_WIDTH = 1080
const DEFAULT_BUBBLE_HEIGHT = 480
const MIN_BUBBLE_WIDTH = 220
const MAX_BUBBLE_WIDTH = 1600
const MIN_BUBBLE_HEIGHT = 140
const MAX_BUBBLE_HEIGHT = 1000

export const BUBBLE_STYLE_IDS = Object.freeze([
  'dialogue-rounded',
  'dialogue-soft',
  'dialogue-comic',
  'thought-cloud',
  'thought-soft'
])

export const BUBBLE_PALETTE_IDS = Object.freeze([
  'ink',
  'ocean',
  'coral',
  'sun',
  'violet'
])

const STYLE_BY_TYPE = Object.freeze({
  dialogue: 'dialogue-rounded',
  thought: 'thought-cloud'
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

const SURFACE_BY_STYLE = Object.freeze({
  'dialogue-rounded': { surface: '#fffef6', border: '#3b9089' },
  'dialogue-soft': { surface: '#e9f8f5', border: '#84b7c0' },
  'dialogue-comic': { surface: '#1f3635', border: '#d9e3df' },
  'thought-cloud': { surface: '#fffffd', border: '#6c9fa0' },
  'thought-soft': { surface: '#f5edfc', border: '#aa91c9' }
})

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const finiteNumber = (value, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export const normalizeBubble = (value = {}) => {
  const bubbleType = value.bubbleType === 'thought' ? 'thought' : 'dialogue'
  const requestedStyle = String(value.styleId || '').trim()
  const styleId = BUBBLE_STYLE_IDS.includes(requestedStyle)
    && (bubbleType === 'thought' ? requestedStyle.startsWith('thought-') : requestedStyle.startsWith('dialogue-'))
    ? requestedStyle
    : STYLE_BY_TYPE[bubbleType]
  const paletteId = BUBBLE_PALETTE_IDS.includes(value.paletteId) ? value.paletteId : (bubbleType === 'thought' ? 'ink' : 'ocean')
  const revealMode = value.revealMode === 'typewriter' || value.revealMode === 'character'
    ? 'typewriter'
    : 'all'
  return {
    schemaVersion: Math.max(1, Math.round(finiteNumber(value.schemaVersion ?? value.version, 1))),
    bubbleType,
    styleId,
    title: String(value.title ?? '').slice(0, 120),
    bodyText: String(value.bodyText ?? value.text ?? '').slice(0, 4000),
    revealMode,
    revealIntervalMs: clamp(Math.round(finiteNumber(value.revealIntervalMs, 80)), 20, 1000),
    fontSizePx: clamp(Math.round(finiteNumber(value.fontSizePx, 52)), 18, 120),
    textColor: typeof value.textColor === 'string' && value.textColor.trim()
      ? value.textColor.trim().slice(0, 32)
      : '',
    paletteId,
    widthPx: clamp(Math.round(finiteNumber(value.widthPx, bubbleType === 'thought' ? 940 : DEFAULT_BUBBLE_WIDTH)), MIN_BUBBLE_WIDTH, MAX_BUBBLE_WIDTH),
    heightPx: clamp(Math.round(finiteNumber(value.heightPx, bubbleType === 'thought' ? 680 : DEFAULT_BUBBLE_HEIGHT)), MIN_BUBBLE_HEIGHT, MAX_BUBBLE_HEIGHT),
    imageAssetId: typeof value.imageAssetId === 'string' && value.imageAssetId.trim()
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
  return SURFACE_BY_STYLE[normalized.styleId] ?? SURFACE_BY_STYLE[STYLE_BY_TYPE[normalized.bubbleType]]
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

const drawTail = (context, bubble, surface, width, height) => {
  if (bubble.styleId === 'dialogue-soft') {
    context.beginPath()
    context.moveTo(width * 0.74, height - 3)
    context.quadraticCurveTo(width * 0.77, height + 38, width * 0.62, height + 4)
    context.closePath()
  } else if (bubble.styleId === 'dialogue-comic') {
    context.beginPath()
    context.moveTo(width * 0.2, height - 2)
    context.lineTo(width * 0.1, height + 35)
    context.lineTo(width * 0.34, height - 1)
    context.closePath()
  } else {
    context.beginPath()
    context.moveTo(width * 0.22, height - 2)
    context.quadraticCurveTo(width * 0.18, height + 30, width * 0.37, height - 2)
    context.closePath()
  }
  context.fillStyle = surface.surface
  context.fill()
  context.strokeStyle = surface.border
  context.stroke()
}

const drawThoughtCloud = (context, surface, width, height) => {
  const circles = [
    [width * 0.22, height * 0.96, height * 0.09],
    [width * 0.14, height * 1.08, height * 0.055],
    [width * 0.08, height * 1.16, height * 0.032]
  ]
  circles.forEach(([x, y, radius]) => {
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fillStyle = surface.surface
    context.fill()
    context.strokeStyle = surface.border
    context.stroke()
  })
}

const drawBubbleSurface = (context, bubble, surface, width, height) => {
  if (bubble.styleId === 'thought-cloud') {
    context.beginPath()
    context.moveTo(width * 0.16, height * 0.86)
    context.bezierCurveTo(width * 0.02, height * 0.83, width * 0.02, height * 0.58, width * 0.13, height * 0.51)
    context.bezierCurveTo(width * 0.04, height * 0.33, width * 0.18, height * 0.13, width * 0.34, height * 0.17)
    context.bezierCurveTo(width * 0.43, height * 0.02, width * 0.66, height * 0.02, width * 0.72, height * 0.18)
    context.bezierCurveTo(width * 0.91, height * 0.13, width * 1.01, height * 0.34, width * 0.91, height * 0.5)
    context.bezierCurveTo(width * 1.01, height * 0.67, width * 0.88, height * 0.88, width * 0.73, height * 0.84)
    context.bezierCurveTo(width * 0.59, height * 0.99, width * 0.34, height * 0.98, width * 0.25, height * 0.85)
    context.closePath()
  } else {
    const radius = bubble.styleId === 'dialogue-comic'
      ? 28
      : bubble.styleId === 'dialogue-soft'
        ? 70
        : 48
    roundedPath(context, 0, 0, width, height, radius)
  }
  context.fillStyle = surface.surface
  context.fill()
  context.shadowColor = 'transparent'
  context.strokeStyle = surface.border
  context.stroke()
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
  roundedPath(context, x + padding * 0.45, y + padding * 0.42, titleWidth, titleHeight, titleRadius)
  context.save()
  context.globalAlpha *= 0.52
  context.fillStyle = palette.titleSurface
  context.fill()
  context.restore()
  context.fillStyle = palette.title
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
  context.fillText(visibleTitle, x + padding * 0.45 + titleHorizontalPadding, y + padding * 0.42 + titleHeight / 2)
  return titleHeight + padding * 0.55
}

const drawBodyText = (context, text, bubble, palette, x, y, width, height, padding) => {
  const color = bubble.styleId === 'dialogue-comic' ? '#ffffff' : bubble.textColor || palette.text
  context.fillStyle = color
  context.font = `500 ${bubble.fontSizePx}px Microsoft JhengHei, PingFang TC, sans-serif`
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

export const drawBubble = (context, bubbleValue, imageEntry = null, elapsedMs = Number.POSITIVE_INFINITY) => {
  const bubble = normalizeBubble(bubbleValue)
  const palette = getBubblePalette(bubble)
  const surface = getBubbleSurface(bubble)
  const width = bubble.widthPx
  const height = bubble.heightPx
  const padding = clamp(
    Math.max(bubble.fontSizePx * 0.72, width * (bubble.bubbleType === 'thought' ? 0.1 : 0.075)),
    18,
    120
  )
  const borderWidth = bubble.styleId === 'dialogue-comic' ? 5 : 3
  const bodyTop = 0
  const bodyHeight = height

  context.save()
  context.lineWidth = borderWidth
  context.shadowColor = 'rgba(9, 18, 38, 0.25)'
  context.shadowBlur = bubble.styleId === 'dialogue-comic' ? 16 : 10
  context.shadowOffsetY = 8
  drawBubbleSurface(context, bubble, surface, width, bodyHeight)
  if (bubble.bubbleType === 'thought') drawThoughtCloud(context, surface, width, height)
  else drawTail(context, bubble, surface, width, height)

  let contentTop = 0
  if (bubble.title.trim()) contentTop = drawTitle(context, bubble, palette, 0, 0, width, padding)

  const contentX = padding
  const contentWidth = width - padding * 2
  const contentY = contentTop + padding * 0.45
  const contentHeight = Math.max(1, height - contentY - padding)
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
    if (visibleText) drawBodyText(context, visibleText, bubble, palette, 0, contentTop, width, height - contentTop, padding)
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
