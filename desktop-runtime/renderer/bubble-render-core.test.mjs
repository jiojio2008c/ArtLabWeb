import assert from 'node:assert/strict'

import {
  BUBBLE_PALETTE_IDS,
  BUBBLE_STYLE_IDS,
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
  'dialogue-rounded',
  'dialogue-soft',
  'dialogue-comic',
  'thought-cloud',
  'thought-soft'
])
assert.deepEqual(BUBBLE_PALETTE_IDS, ['ink', 'ocean', 'coral', 'sun', 'violet'])

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
assert.equal(dialogue.styleId, 'dialogue-rounded')
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
assert.equal(thought.styleId, 'thought-cloud')
assert.equal(thought.paletteId, 'ink')
assert.deepEqual(getBubbleSize(thought), { width: 940, height: 680 })
assert.equal(getBubbleAssetId({ bubble: thought }), 'asset-thought')
assert.equal(isBubbleItem({ kind: 'bubble' }), true)
assert.equal(isBubbleItem({ kind: 'media' }), false)
assert.equal(getGraphemes('A👨‍👩‍👧‍👦B').length, 3)
assert.notEqual(getBubbleSurface({ bubbleType: 'dialogue', styleId: 'dialogue-rounded' }).surface, getBubbleSurface({ bubbleType: 'dialogue', styleId: 'dialogue-comic' }).surface)

const wideImage = getContainRect(4000, 500, 400, 240)
assert.deepEqual(wideImage, { x: 0, y: 95, width: 400, height: 50 })

const tallImage = getContainRect(500, 4000, 400, 240)
assert.deepEqual(tallImage, { x: 185, y: 0, width: 30, height: 240 })

const squareImage = getContainRect(1000, 1000, 400, 240)
assert.deepEqual(squareImage, { x: 80, y: 0, width: 240, height: 240 })

const createRenderContext = () => {
  const drawImageCalls = []
  return {
    drawImageCalls,
    globalAlpha: 1,
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    roundRect() {},
    arc() {},
    fill() {},
    stroke() {},
    setLineDash() {},
    fillText() {},
    measureText(value) { return { width: getGraphemes(value).length * 24 } },
    drawImage(...args) { drawImageCalls.push(args) }
  }
}

BUBBLE_STYLE_IDS.forEach((styleId) => {
  const bubbleType = styleId.startsWith('thought-') ? 'thought' : 'dialogue'
  const renderContext = createRenderContext()
  drawBubble(renderContext, {
    bubbleType,
    styleId,
    title: '标题',
    bodyText: '气泡内容',
    widthPx: bubbleType === 'thought' ? 940 : 1080,
    heightPx: bubbleType === 'thought' ? 680 : 480
  })
})

const imageRenderContext = createRenderContext()
drawBubble(imageRenderContext, {
  bubbleType: 'thought',
  styleId: 'thought-cloud',
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

console.log('Bubble rendering core verification passed.')
