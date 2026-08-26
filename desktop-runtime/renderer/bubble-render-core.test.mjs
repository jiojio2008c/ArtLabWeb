import assert from 'node:assert/strict'

import {
  BUBBLE_SHAPE_STYLE_IDS,
  bubbleShapeCommandsToSvgPath,
  deriveBubbleOutlineColor,
  getBubbleShapeDefinition,
  getBubbleShapeDirection,
  normalizeBubbleColor
} from './bubble-shape-catalog.js'
import {
  BUBBLE_PALETTE_IDS,
  BUBBLE_STYLE_IDS,
  BUBBLE_TITLE_MASK_IDS,
  BUBBLE_TITLE_STYLE_IDS,
  drawBubble,
  getBubbleAssetId,
  getBubbleSize,
  getBubbleSurface,
  getContainRect,
  getGraphemes,
  getVisibleBubbleText,
  isBubbleItem,
  normalizeBubble
} from './bubble-render-core.js'

assert.deepEqual(BUBBLE_STYLE_IDS, [
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
assert.deepEqual(BUBBLE_PALETTE_IDS, ['ink', 'ocean', 'coral', 'sun', 'violet'])
assert.deepEqual(BUBBLE_TITLE_MASK_IDS, ['rounded', 'pill', 'ticket', 'underline', 'none'])
assert.deepEqual(BUBBLE_TITLE_STYLE_IDS, [
  'title-rounded',
  'title-pill',
  'title-ticket',
  'title-underline',
  'title-none'
])
assert.deepEqual(BUBBLE_SHAPE_STYLE_IDS, [
  'dialogue-rounded-left',
  'dialogue-rounded-right',
  'dialogue-soft-left',
  'dialogue-soft-right',
  'dialogue-comic-left',
  'dialogue-comic-right',
  'thought-cloud-left',
  'thought-cloud-right'
])

BUBBLE_SHAPE_STYLE_IDS.forEach((styleId) => {
  const definition = getBubbleShapeDefinition(styleId)
  const svgPath = bubbleShapeCommandsToSvgPath(definition.bodyCommands)
  assert.equal(definition.styleId, styleId)
  assert.equal(definition.direction, getBubbleShapeDirection(styleId))
  assert.ok(svgPath.startsWith('M '))
  assert.ok(svgPath.endsWith('Z'))
  assert.equal(svgPath.includes('NaN'), false)
  assert.ok(definition.contentRect.x >= definition.viewBox.x)
  assert.ok(definition.contentRect.y >= definition.viewBox.y)
  assert.ok(definition.contentRect.x + definition.contentRect.width <= definition.viewBox.width)
  assert.ok(definition.contentRect.y + definition.contentRect.height <= definition.viewBox.height)
})

const roundedRightShape = getBubbleShapeDefinition('dialogue-rounded-right')
const roundedLeftShape = getBubbleShapeDefinition('dialogue-rounded-left')
assert.equal(
  roundedRightShape.bodyCommands[0][1] + roundedLeftShape.bodyCommands[0][1],
  roundedRightShape.viewBox.width
)
assert.equal(getBubbleShapeDefinition('thought-soft-left').styleId, 'thought-cloud-left')
assert.equal(getBubbleShapeDefinition('thought-soft-right').styleId, 'thought-cloud-right')
assert.equal(normalizeBubbleColor('#AbC'), '#aabbcc')
assert.equal(normalizeBubbleColor('#12345678'), '#12345678')
assert.equal(normalizeBubbleColor('not-a-color', '#102030'), '#102030')
assert.match(deriveBubbleOutlineColor('#fefefe'), /^#[0-9a-f]{6}$/)
assert.notEqual(deriveBubbleOutlineColor('#fefefe'), deriveBubbleOutlineColor('#101010'))

const dialogue = normalizeBubble({
  bubbleType: 'dialogue',
  styleId: 'unknown-style',
  paletteId: 'unknown-palette',
  bodyText: '你好',
  revealMode: 'typewriter',
  revealIntervalMs: 80,
  widthPx: 640,
  heightPx: 320
})
assert.equal(dialogue.schemaVersion, 1)
assert.equal(dialogue.styleId, 'dialogue-rounded-right')
assert.equal(dialogue.titleMaskId, 'rounded')
assert.equal(dialogue.paletteId, 'ocean')
assert.deepEqual(getBubbleSize(dialogue), { width: 640, height: 320 })
assert.equal(getVisibleBubbleText(dialogue, 0), '')
assert.equal(getVisibleBubbleText(dialogue, 79), '')
assert.equal(getVisibleBubbleText(dialogue, 80), '你')
assert.equal(getVisibleBubbleText(dialogue, 160), '你好')

const thought = normalizeBubble({
  version: 1,
  bubbleType: 'thought',
  styleId: 'dialogue-comic',
  bodyText: '想到了 👨‍👩‍👧‍👦！',
  imageAssetId: 'asset-thought'
})
assert.equal(thought.schemaVersion, 1)
assert.equal(thought.styleId, 'thought-cloud-right')
assert.equal(thought.paletteId, 'ink')
assert.deepEqual(getBubbleSize(thought), { width: 940, height: 680 })
assert.equal(getBubbleAssetId({ bubble: thought }), 'asset-thought')
assert.equal(isBubbleItem({ kind: 'bubble' }), true)
assert.equal(isBubbleItem({ kind: 'media' }), false)
assert.equal(getGraphemes('A👨‍👩‍👧‍👦B').length, 3)
assert.notEqual(getBubbleSurface({ bubbleType: 'dialogue', styleId: 'dialogue-rounded' }).surface, getBubbleSurface({ bubbleType: 'dialogue', styleId: 'dialogue-comic' }).surface)
assert.equal(normalizeBubble({ bubbleType: 'dialogue', styleId: 'dialogue-soft' }).styleId, 'dialogue-soft-right')
assert.equal(normalizeBubble({ bubbleType: 'thought', styleId: 'thought-soft' }).styleId, 'thought-cloud-right')
assert.equal(normalizeBubble({ bubbleType: 'thought', styleId: 'thought-soft-left' }).styleId, 'thought-cloud-left')
assert.deepEqual(
  getBubbleSurface({
    bubbleType: 'dialogue',
    styleId: 'dialogue-rounded-right',
    surfaceColor: '#abcdef',
    outlineColor: '#123456'
  }),
  { surface: '#abcdef', border: '#123456' }
)
assert.equal(
  normalizeBubble({ surfaceColor: '#ffffff' }).outlineColor,
  deriveBubbleOutlineColor('#ffffff')
)
assert.equal(normalizeBubble({ titleMaskId: 'invalid-mask' }).titleMaskId, 'rounded')

const standaloneTitle = normalizeBubble({
  bubbleType: 'title',
  styleId: 'title-ticket',
  title: '旧标题字段',
  paletteId: 'coral',
  maskOpacity: 0.64,
  imageAssetId: 'ignored-title-image'
})
assert.equal(standaloneTitle.bubbleType, 'title')
assert.equal(standaloneTitle.styleId, 'title-ticket')
assert.equal(standaloneTitle.title, '')
assert.equal(standaloneTitle.bodyText, '旧标题字段')
assert.equal(standaloneTitle.maskColor, '#dd6859')
assert.equal(standaloneTitle.maskOpacity, 0.64)
assert.equal(standaloneTitle.imageAssetId, null)
assert.deepEqual(getBubbleSize(standaloneTitle), { width: 900, height: 220 })
assert.equal(normalizeBubble({ bubbleType: 'title', styleId: 'dialogue-rounded-right' }).styleId, 'title-rounded')
assert.equal(normalizeBubble({ bubbleType: 'title', maskOpacity: null }).maskOpacity, 0.92)
assert.equal(normalizeBubble({ bubbleType: 'title', maskOpacity: -2 }).maskOpacity, 0)
assert.equal(normalizeBubble({ bubbleType: 'title', maskOpacity: 200 }).maskOpacity, 1)

const wideImage = getContainRect(4000, 500, 400, 240)
assert.deepEqual(wideImage, { x: 0, y: 95, width: 400, height: 50 })

const tallImage = getContainRect(500, 4000, 400, 240)
assert.deepEqual(tallImage, { x: 185, y: 0, width: 30, height: 240 })

const squareImage = getContainRect(1000, 1000, 400, 240)
assert.deepEqual(squareImage, { x: 80, y: 0, width: 240, height: 240 })

const createRenderContext = () => {
  const drawImageCalls = []
  const fillCalls = []
  const strokeCalls = []
  const moveToCalls = []
  const lineToCalls = []
  const quadraticCurveToCalls = []
  const bezierCurveToCalls = []
  const arcCalls = []
  const ellipseCalls = []
  const roundRectCalls = []
  const fillTextCalls = []
  const fillTextStates = []
  const transformCalls = []
  const stateStack = []
  return {
    drawImageCalls,
    fillCalls,
    strokeCalls,
    moveToCalls,
    lineToCalls,
    quadraticCurveToCalls,
    bezierCurveToCalls,
    arcCalls,
    ellipseCalls,
    roundRectCalls,
    fillTextCalls,
    fillTextStates,
    transformCalls,
    get strokeCount() { return strokeCalls.length },
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetY: 0,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    save() {
      stateStack.push({
        globalAlpha: this.globalAlpha,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        lineCap: this.lineCap,
        lineJoin: this.lineJoin,
        shadowColor: this.shadowColor,
        shadowBlur: this.shadowBlur,
        shadowOffsetY: this.shadowOffsetY,
        font: this.font,
        textAlign: this.textAlign,
        textBaseline: this.textBaseline
      })
    },
    restore() {
      const state = stateStack.pop()
      if (state) Object.assign(this, state)
    },
    beginPath() {},
    closePath() {},
    moveTo(...args) { moveToCalls.push(args) },
    lineTo(...args) { lineToCalls.push(args) },
    quadraticCurveTo(...args) { quadraticCurveToCalls.push(args) },
    bezierCurveTo(...args) { bezierCurveToCalls.push(args) },
    roundRect(...args) { roundRectCalls.push(args) },
    arc(...args) { arcCalls.push(args) },
    ellipse(...args) { ellipseCalls.push(args) },
    fill() { fillCalls.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha }) },
    stroke() {
      strokeCalls.push({
        strokeStyle: this.strokeStyle,
        globalAlpha: this.globalAlpha,
        lineWidth: this.lineWidth,
        lineCap: this.lineCap,
        lineJoin: this.lineJoin
      })
    },
    setLineDash() {},
    fillText(...args) {
      fillTextCalls.push(args)
      fillTextStates.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, font: this.font })
    },
    scale(...args) { transformCalls.push(['scale', ...args]) },
    transform(...args) { transformCalls.push(['transform', ...args]) },
    setTransform(...args) { transformCalls.push(['setTransform', ...args]) },
    measureText(value) { return { width: getGraphemes(value).length * 24 } },
    drawImage(...args) { drawImageCalls.push(args) }
  }
}

BUBBLE_STYLE_IDS.forEach((styleId) => {
  const bubbleType = styleId.startsWith('thought-')
    ? 'thought'
    : styleId.startsWith('title-')
      ? 'title'
      : 'dialogue'
  const renderContext = createRenderContext()
  drawBubble(renderContext, {
    bubbleType,
    styleId,
    titleMaskId: BUBBLE_TITLE_MASK_IDS[0],
    title: '标题',
    bodyText: '气泡内容',
    widthPx: bubbleType === 'thought' ? 940 : bubbleType === 'title' ? 900 : 1080,
    heightPx: bubbleType === 'thought' ? 680 : bubbleType === 'title' ? 220 : 480
  })
})

const titleMaskContexts = new Map()
BUBBLE_TITLE_MASK_IDS.forEach((titleMaskId) => {
  const renderContext = createRenderContext()
  drawBubble(renderContext, {
    bubbleType: 'dialogue',
    styleId: 'dialogue-rounded-right',
    titleMaskId,
    title: '标题',
    bodyText: '内容',
    widthPx: 1080,
    heightPx: 480
  })
  assert.equal(renderContext.fillTextCalls.length, 2)
  titleMaskContexts.set(titleMaskId, renderContext)
})
assert.equal(titleMaskContexts.get('rounded').roundRectCalls.length, 1)
assert.equal(titleMaskContexts.get('pill').roundRectCalls.length, 1)
assert.ok(titleMaskContexts.get('pill').roundRectCalls.at(-1)[4] > titleMaskContexts.get('rounded').roundRectCalls.at(-1)[4])
assert.equal(titleMaskContexts.get('ticket').roundRectCalls.length, 0)
assert.equal(
  titleMaskContexts.get('ticket').lineToCalls.length,
  titleMaskContexts.get('rounded').lineToCalls.length + 5
)
assert.equal(titleMaskContexts.get('underline').roundRectCalls.length, 0)
assert.equal(
  titleMaskContexts.get('underline').lineToCalls.length,
  titleMaskContexts.get('rounded').lineToCalls.length + 1
)
assert.equal(titleMaskContexts.get('none').roundRectCalls.length, 0)
assert.equal(
  titleMaskContexts.get('none').lineToCalls.length,
  titleMaskContexts.get('rounded').lineToCalls.length
)

const standaloneTitleContexts = new Map()
BUBBLE_TITLE_STYLE_IDS.forEach((styleId) => {
  const renderContext = createRenderContext()
  drawBubble(renderContext, {
    bubbleType: 'title',
    styleId,
    bodyText: '独立标题',
    widthPx: 760,
    heightPx: 220,
    fontSizePx: 54,
    textColor: '#abcdef',
    maskColor: '#123456',
    maskOpacity: 0.35
  })
  assert.equal(renderContext.fillTextCalls.length, 1)
  assert.equal(renderContext.fillTextCalls[0][0], '独立标题')
  assert.equal(renderContext.fillTextStates[0].fillStyle, '#abcdef')
  assert.equal(renderContext.fillTextStates[0].globalAlpha, 1)
  assert.equal(renderContext.globalAlpha, 1)
  assert.equal(renderContext.quadraticCurveToCalls.length, 0)
  assert.equal(renderContext.bezierCurveToCalls.length, 0)
  assert.equal(renderContext.arcCalls.length, 0)
  assert.equal(renderContext.drawImageCalls.length, 0)
  standaloneTitleContexts.set(styleId, renderContext)
})

const roundedTitleContext = standaloneTitleContexts.get('title-rounded')
const pillTitleContext = standaloneTitleContexts.get('title-pill')
const ticketTitleContext = standaloneTitleContexts.get('title-ticket')
const underlineTitleContext = standaloneTitleContexts.get('title-underline')
const plainTitleContext = standaloneTitleContexts.get('title-none')

assert.deepEqual(roundedTitleContext.roundRectCalls[0].slice(0, 4), [0, 0, 760, 220])
assert.equal(roundedTitleContext.fillCalls.length, 1)
assert.deepEqual(roundedTitleContext.fillCalls[0], { fillStyle: '#123456', globalAlpha: 0.35 })
assert.equal(roundedTitleContext.strokeCalls.length, 0)
assert.equal(pillTitleContext.roundRectCalls.length, 1)
assert.ok(pillTitleContext.roundRectCalls[0][4] > roundedTitleContext.roundRectCalls[0][4])
assert.deepEqual(pillTitleContext.fillCalls[0], { fillStyle: '#123456', globalAlpha: 0.35 })
assert.equal(ticketTitleContext.roundRectCalls.length, 0)
assert.equal(ticketTitleContext.lineToCalls.length, 5)
assert.deepEqual(ticketTitleContext.fillCalls[0], { fillStyle: '#123456', globalAlpha: 0.35 })
assert.equal(underlineTitleContext.roundRectCalls.length, 0)
assert.equal(underlineTitleContext.fillCalls.length, 0)
assert.equal(underlineTitleContext.lineToCalls.length, 1)
assert.deepEqual(underlineTitleContext.strokeCalls[0], {
  strokeStyle: '#123456',
  globalAlpha: 0.35,
  lineWidth: 9.9,
  lineCap: 'round',
  lineJoin: 'miter'
})
assert.equal(plainTitleContext.roundRectCalls.length, 0)
assert.equal(plainTitleContext.fillCalls.length, 0)
assert.equal(plainTitleContext.strokeCalls.length, 0)
assert.equal(plainTitleContext.moveToCalls.length, 0)
assert.equal(plainTitleContext.lineToCalls.length, 0)

const typewriterTitleContext = createRenderContext()
drawBubble(typewriterTitleContext, {
  bubbleType: 'title',
  styleId: 'title-rounded',
  bodyText: '甲乙丙丁',
  revealMode: 'typewriter',
  revealIntervalMs: 100,
  widthPx: 900,
  heightPx: 220
}, null, 200)
assert.equal(typewriterTitleContext.fillTextCalls.length, 1)
assert.equal(typewriterTitleContext.fillTextCalls[0][0], '甲乙')

const hiddenTypewriterTitleContext = createRenderContext()
drawBubble(hiddenTypewriterTitleContext, {
  bubbleType: 'title',
  styleId: 'title-rounded',
  bodyText: '甲乙丙丁',
  revealMode: 'typewriter',
  revealIntervalMs: 100
}, null, 99)
assert.equal(hiddenTypewriterTitleContext.fillTextCalls.length, 0)
assert.equal(hiddenTypewriterTitleContext.fillCalls.length, 1)

const rightDialogueContext = createRenderContext()
const leftDialogueContext = createRenderContext()
drawBubble(rightDialogueContext, {
  bubbleType: 'dialogue',
  styleId: 'dialogue-rounded-right',
  bodyText: '方向',
  widthPx: 1000,
  heightPx: 400
})
drawBubble(leftDialogueContext, {
  bubbleType: 'dialogue',
  styleId: 'dialogue-rounded-left',
  bodyText: '方向',
  widthPx: 1000,
  heightPx: 400
})
assert.equal(rightDialogueContext.moveToCalls[0][0], 96 / 1080 * 1000)
assert.equal(leftDialogueContext.moveToCalls[0][0], (1080 - 96) / 1080 * 1000)
assert.ok(rightDialogueContext.lineToCalls.some(([x, y]) => (
  Math.abs(x - 724 / 1080 * 1000) < 1e-9
  && Math.abs(y - 455 / 480 * 400) < 1e-9
)))
assert.ok(leftDialogueContext.lineToCalls.some(([x, y]) => (
  Math.abs(x - (1080 - 724) / 1080 * 1000) < 1e-9
  && Math.abs(y - 455 / 480 * 400) < 1e-9
)))
assert.equal(rightDialogueContext.fillTextCalls[0][0], leftDialogueContext.fillTextCalls[0][0])
assert.ok(Math.abs(
  rightDialogueContext.fillTextCalls[0][1] + leftDialogueContext.fillTextCalls[0][1] - 1000
) < 1e-9)
assert.equal(rightDialogueContext.fillTextCalls[0][2], leftDialogueContext.fillTextCalls[0][2])
assert.deepEqual(rightDialogueContext.transformCalls, [])
assert.deepEqual(leftDialogueContext.transformCalls, [])

const rightThoughtContext = createRenderContext()
const leftThoughtContext = createRenderContext()
drawBubble(rightThoughtContext, {
  bubbleType: 'thought',
  styleId: 'thought-cloud-right',
  bodyText: '想象',
  widthPx: 1000,
  heightPx: 600
})
drawBubble(leftThoughtContext, {
  bubbleType: 'thought',
  styleId: 'thought-cloud-left',
  bodyText: '想象',
  widthPx: 1000,
  heightPx: 600
})
assert.equal(rightThoughtContext.ellipseCalls.length, 3)
assert.equal(leftThoughtContext.ellipseCalls.length, 3)
rightThoughtContext.ellipseCalls.forEach(([x, , radiusX, radiusY], index) => {
  const expectedX = getBubbleShapeDefinition('thought-cloud-right').decorations[index].cx / 940 * 1000
  assert.ok(Math.abs(x - expectedX) < 1e-9)
  assert.ok(Math.abs(radiusX - getBubbleShapeDefinition('thought-cloud-right').decorations[index].radius / 940 * 1000) < 1e-9)
  assert.ok(Math.abs(radiusY - getBubbleShapeDefinition('thought-cloud-right').decorations[index].radius / 680 * 600) < 1e-9)
  assert.notEqual(radiusX, radiusY)
})
leftThoughtContext.ellipseCalls.forEach(([x], index) => {
  const expectedX = getBubbleShapeDefinition('thought-cloud-left').decorations[index].cx / 940 * 1000
  assert.ok(Math.abs(x - expectedX) < 1e-9)
})
assert.deepEqual(rightThoughtContext.fillTextCalls, leftThoughtContext.fillTextCalls)
assert.deepEqual(rightThoughtContext.transformCalls, [])
assert.deepEqual(leftThoughtContext.transformCalls, [])

const imageRenderContext = createRenderContext()
drawBubble(imageRenderContext, {
  bubbleType: 'thought',
  styleId: 'thought-cloud-right',
  bodyText: '',
  widthPx: 940,
  heightPx: 680
}, {
  loaded: true,
  width: 4000,
  height: 500,
  element: { id: 'wide-image' }
})
assert.equal(imageRenderContext.drawImageCalls.length, 1)
const [, imageX, imageY, imageWidth, imageHeight] = imageRenderContext.drawImageCalls[0]
assert.ok(imageX >= 0 && imageY >= 0)
assert.ok(imageX + imageWidth <= 940 && imageY + imageHeight <= 680)
assert.equal(imageWidth / imageHeight, 8)

const leftImageRenderContext = createRenderContext()
drawBubble(leftImageRenderContext, {
  bubbleType: 'thought',
  styleId: 'thought-cloud-left',
  bodyText: '',
  widthPx: 940,
  heightPx: 680
}, {
  loaded: true,
  width: 4000,
  height: 500,
  element: { id: 'wide-image' }
})
assert.deepEqual(leftImageRenderContext.drawImageCalls, imageRenderContext.drawImageCalls)
assert.deepEqual(leftImageRenderContext.transformCalls, [])

const customColorContext = createRenderContext()
drawBubble(customColorContext, {
  bubbleType: 'dialogue',
  styleId: 'dialogue-comic-right',
  bodyText: 'Custom',
  textColor: '#abcdef',
  surfaceColor: '#fedcba',
  outlineColor: '#654321'
})
assert.equal(customColorContext.fillCalls[0].fillStyle, '#fedcba')
assert.equal(customColorContext.strokeCalls[0].strokeStyle, '#654321')
assert.equal(customColorContext.strokeCalls[0].lineWidth, 5)
assert.equal(customColorContext.strokeCalls[0].lineCap, 'round')
assert.equal(customColorContext.strokeCalls[0].lineJoin, 'round')
assert.equal(customColorContext.fillTextStates[0].fillStyle, '#abcdef')

console.log('Bubble rendering core verification passed.')
