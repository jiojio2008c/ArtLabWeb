const DEFAULT_STYLE_ID = 'dialogue-rounded-right'

const STYLE_ALIASES = Object.freeze({
  'dialogue-rounded': 'dialogue-rounded-right',
  'dialogue-soft': 'dialogue-soft-right',
  'dialogue-comic': 'dialogue-comic-right',
  'thought-cloud': 'thought-cloud-right',
  'thought-soft': 'thought-cloud-right',
  'thought-soft-left': 'thought-cloud-left',
  'thought-soft-right': 'thought-cloud-right'
})

const freezeCommands = (commands) => Object.freeze(
  commands.map((command) => Object.freeze([...command]))
)

const freezeDecorations = (decorations = []) => Object.freeze(
  decorations.map((decoration) => Object.freeze({ ...decoration }))
)

const BASE_SHAPES = Object.freeze({
  'dialogue-rounded': Object.freeze({
    viewBox: Object.freeze({ x: 0, y: 0, width: 1080, height: 480 }),
    bodyCommands: freezeCommands([
      ['M', 96, 42],
      ['C', 51, 45, 31, 73, 39, 116],
      ['L', 92, 337],
      ['C', 102, 378, 130, 398, 173, 396],
      ['L', 667, 382],
      ['L', 724, 455],
      ['L', 753, 382],
      ['L', 950, 372],
      ['C', 1001, 369, 1028, 340, 1032, 294],
      ['L', 1042, 120],
      ['C', 1046, 70, 1012, 40, 960, 38],
      ['Z']
    ]),
    contentRect: Object.freeze({ x: 132, y: 84, width: 802, height: 250 }),
    defaultWidth: 1080,
    defaultHeight: 480,
    defaultOutlineWidth: 3,
    defaultSurfaceColor: '#fffef6',
    defaultOutlineColor: '#3b9089'
  }),
  'dialogue-soft': Object.freeze({
    viewBox: Object.freeze({ x: 0, y: 0, width: 1080, height: 480 }),
    bodyCommands: freezeCommands([
      ['M', 540, 34],
      ['C', 805, 34, 1024, 107, 1024, 220],
      ['C', 1024, 316, 880, 365, 818, 374],
      ['L', 866, 455],
      ['L', 737, 389],
      ['C', 500, 417, 75, 380, 62, 235],
      ['C', 49, 101, 270, 34, 540, 34],
      ['Z']
    ]),
    contentRect: Object.freeze({ x: 132, y: 88, width: 816, height: 244 }),
    defaultWidth: 1080,
    defaultHeight: 480,
    defaultOutlineWidth: 3,
    defaultSurfaceColor: '#e9f8f5',
    defaultOutlineColor: '#84b7c0'
  }),
  'dialogue-comic': Object.freeze({
    viewBox: Object.freeze({ x: 0, y: 0, width: 1080, height: 480 }),
    bodyCommands: freezeCommands([
      ['M', 84, 48],
      ['L', 1012, 58],
      ['L', 944, 350],
      ['L', 822, 350],
      ['L', 744, 452],
      ['L', 765, 348],
      ['L', 148, 340],
      ['Z']
    ]),
    contentRect: Object.freeze({ x: 160, y: 92, width: 742, height: 204 }),
    defaultWidth: 1080,
    defaultHeight: 480,
    defaultOutlineWidth: 5,
    defaultSurfaceColor: '#1f3635',
    defaultOutlineColor: '#d9e3df'
  }),
  'thought-cloud': Object.freeze({
    viewBox: Object.freeze({ x: 0, y: 0, width: 940, height: 680 }),
    bodyCommands: freezeCommands([
      ['M', 158, 516],
      ['C', 82, 515, 32, 460, 48, 389],
      ['C', 4, 337, 25, 254, 96, 229],
      ['C', 73, 151, 141, 87, 218, 100],
      ['C', 258, 34, 357, 29, 407, 84],
      ['C', 473, 22, 578, 38, 604, 102],
      ['C', 692, 60, 784, 103, 786, 178],
      ['C', 871, 184, 915, 252, 880, 319],
      ['C', 930, 374, 900, 464, 825, 481],
      ['C', 782, 545, 684, 557, 621, 514],
      ['C', 560, 576, 451, 574, 394, 520],
      ['C', 321, 566, 216, 559, 158, 516],
      ['Z']
    ]),
    decorations: freezeDecorations([
      { kind: 'circle', cx: 750, cy: 548, radius: 42 },
      { kind: 'circle', cx: 832, cy: 612, radius: 25 },
      { kind: 'circle', cx: 887, cy: 653, radius: 13 }
    ]),
    contentRect: Object.freeze({ x: 142, y: 146, width: 656, height: 306 }),
    defaultWidth: 940,
    defaultHeight: 680,
    defaultOutlineWidth: 3,
    defaultSurfaceColor: '#fffffd',
    defaultOutlineColor: '#6c9fa0'
  })
})

export const BUBBLE_SHAPE_STYLE_IDS = Object.freeze([
  'dialogue-rounded-left',
  'dialogue-rounded-right',
  'dialogue-soft-left',
  'dialogue-soft-right',
  'dialogue-comic-left',
  'dialogue-comic-right',
  'thought-cloud-left',
  'thought-cloud-right'
])

const getCanonicalStyleId = (styleId) => {
  const requestedStyleId = String(styleId ?? '').trim()
  const aliasedStyleId = STYLE_ALIASES[requestedStyleId] ?? requestedStyleId
  return BUBBLE_SHAPE_STYLE_IDS.includes(aliasedStyleId)
    ? aliasedStyleId
    : DEFAULT_STYLE_ID
}

export const getBubbleShapeDirection = (styleId) => (
  getCanonicalStyleId(styleId).endsWith('-left') ? 'left' : 'right'
)

const mirrorCommands = (commands, viewBoxWidth) => freezeCommands(commands.map((command) => {
  const [operation, ...values] = command
  if (operation === 'M' || operation === 'L') {
    return [operation, viewBoxWidth - values[0], values[1]]
  }
  if (operation === 'Q') {
    return [operation, viewBoxWidth - values[0], values[1], viewBoxWidth - values[2], values[3]]
  }
  if (operation === 'C') {
    return [
      operation,
      viewBoxWidth - values[0],
      values[1],
      viewBoxWidth - values[2],
      values[3],
      viewBoxWidth - values[4],
      values[5]
    ]
  }
  return [operation]
}))

const mirrorDecorations = (decorations, viewBoxWidth) => freezeDecorations(
  decorations.map((decoration) => decoration.kind === 'circle'
    ? { ...decoration, cx: viewBoxWidth - decoration.cx }
    : decoration)
)

const mirrorRect = (rect, viewBoxWidth) => Object.freeze({
  ...rect,
  x: viewBoxWidth - rect.x - rect.width
})

const createDefinition = (styleId) => {
  const baseStyleId = styleId.replace(/-(left|right)$/, '')
  const baseShape = BASE_SHAPES[baseStyleId] ?? BASE_SHAPES['dialogue-rounded']
  const direction = styleId.endsWith('-left') ? 'left' : 'right'
  const shouldMirror = direction === 'left'
  return Object.freeze({
    styleId,
    baseStyleId,
    direction,
    viewBox: baseShape.viewBox,
    bodyCommands: shouldMirror
      ? mirrorCommands(baseShape.bodyCommands, baseShape.viewBox.width)
      : baseShape.bodyCommands,
    decorations: shouldMirror
      ? mirrorDecorations(baseShape.decorations ?? [], baseShape.viewBox.width)
      : baseShape.decorations ?? freezeDecorations(),
    contentRect: shouldMirror
      ? mirrorRect(baseShape.contentRect, baseShape.viewBox.width)
      : baseShape.contentRect,
    defaultWidth: baseShape.defaultWidth,
    defaultHeight: baseShape.defaultHeight,
    defaultOutlineWidth: baseShape.defaultOutlineWidth,
    defaultSurfaceColor: baseShape.defaultSurfaceColor,
    defaultOutlineColor: baseShape.defaultOutlineColor
  })
}

const SHAPE_DEFINITIONS = Object.freeze(Object.fromEntries(
  BUBBLE_SHAPE_STYLE_IDS.map((styleId) => [styleId, createDefinition(styleId)])
))

export const getBubbleShapeDefinition = (styleId) => (
  SHAPE_DEFINITIONS[getCanonicalStyleId(styleId)]
)

const formatPathNumber = (value) => Number(value.toFixed(3)).toString()

export const bubbleShapeCommandsToSvgPath = (commands) => commands.map((command) => {
  const [operation, ...values] = command
  return values.length
    ? `${operation} ${values.map(formatPathNumber).join(' ')}`
    : operation
}).join(' ')

const normalizeHexColor = (value) => {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/.test(candidate)) return candidate
  if (/^#[0-9a-f]{3,4}$/.test(candidate)) {
    return `#${candidate.slice(1).split('').map((channel) => channel.repeat(2)).join('')}`
  }
  return ''
}

export const normalizeBubbleColor = (value, fallback = '#fffef6') => (
  normalizeHexColor(value) || normalizeHexColor(fallback) || '#fffef6'
)

const mixChannel = (channel, target, weight) => Math.round(channel + (target - channel) * weight)

export const deriveBubbleOutlineColor = (surfaceColor) => {
  const normalized = normalizeBubbleColor(surfaceColor).slice(1, 7)
  const channels = [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16))
  const luminance = (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) / 255
  const target = luminance < 0.38 ? 255 : 0
  const weight = luminance < 0.38 ? 0.62 : 0.44
  const mixed = channels.map((channel) => mixChannel(channel, target, weight))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

const traceCommands = (context, commands, scaleX, scaleY) => {
  commands.forEach(([operation, ...values]) => {
    if (operation === 'M') context.moveTo(values[0] * scaleX, values[1] * scaleY)
    else if (operation === 'L') context.lineTo(values[0] * scaleX, values[1] * scaleY)
    else if (operation === 'Q') {
      context.quadraticCurveTo(
        values[0] * scaleX,
        values[1] * scaleY,
        values[2] * scaleX,
        values[3] * scaleY
      )
    } else if (operation === 'C') {
      context.bezierCurveTo(
        values[0] * scaleX,
        values[1] * scaleY,
        values[2] * scaleX,
        values[3] * scaleY,
        values[4] * scaleX,
        values[5] * scaleY
      )
    } else if (operation === 'Z') context.closePath()
  })
}

export const drawBubbleShape = (context, styleId, width, height, options = {}) => {
  const definition = getBubbleShapeDefinition(styleId)
  const targetWidth = Math.max(1, Number(width) || definition.defaultWidth)
  const targetHeight = Math.max(1, Number(height) || definition.defaultHeight)
  const scaleX = targetWidth / definition.viewBox.width
  const scaleY = targetHeight / definition.viewBox.height
  const surfaceColor = normalizeBubbleColor(options.surfaceColor, definition.defaultSurfaceColor)
  const outlineColor = normalizeBubbleColor(
    options.outlineColor,
    typeof options.surfaceColor === 'string' && options.surfaceColor.trim()
      ? deriveBubbleOutlineColor(surfaceColor)
      : definition.defaultOutlineColor || deriveBubbleOutlineColor(surfaceColor)
  )

  context.fillStyle = surfaceColor
  context.strokeStyle = outlineColor
  context.lineWidth = Number.isFinite(options.lineWidth)
    ? Math.max(0, options.lineWidth)
    : definition.defaultOutlineWidth
  context.lineJoin = 'round'
  context.lineCap = 'round'

  context.beginPath()
  traceCommands(context, definition.bodyCommands, scaleX, scaleY)
  context.fill()
  context.stroke()

  definition.decorations.forEach((decoration) => {
    if (decoration.kind !== 'circle') return
    context.beginPath()
    context.ellipse(
      decoration.cx * scaleX,
      decoration.cy * scaleY,
      decoration.radius * scaleX,
      decoration.radius * scaleY,
      0,
      0,
      Math.PI * 2
    )
    context.fill()
    context.stroke()
  })

  return { definition, surfaceColor, outlineColor }
}
