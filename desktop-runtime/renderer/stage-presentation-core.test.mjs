import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  DEFAULT_STAGE_WATERMARK_ENABLED,
  DEFAULT_STAGE_WATERMARK_OPACITY,
  configureHighQualityImageSmoothing,
  drawMagicFloorWatermarkPattern,
  drawStageWatermarkLayer
} from './stage-presentation-core.js'

const createRecordingContext = () => {
  const calls = []
  return {
    calls,
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    beginPath: () => calls.push(['beginPath']),
    rect: (...args) => calls.push(['rect', ...args]),
    clip: () => calls.push(['clip']),
    translate: (...args) => calls.push(['translate', ...args]),
    rotate: (...args) => calls.push(['rotate', ...args]),
    strokeText: (...args) => calls.push(['strokeText', ...args]),
    fillText: (...args) => calls.push(['fillText', ...args]),
    drawImage: (...args) => calls.push(['drawImage', ...args])
  }
}

test('stage image rendering explicitly requests high quality smoothing', () => {
  const renderContext = {}
  assert.equal(configureHighQualityImageSmoothing(renderContext), true)
  assert.equal(renderContext.imageSmoothingEnabled, true)
  assert.equal(renderContext.imageSmoothingQuality, 'high')
})

test('watermark pattern is clipped, diagonal, and repeated across the stage', () => {
  const renderContext = createRecordingContext()
  const drawCount = drawMagicFloorWatermarkPattern(renderContext, {
    width: 1920,
    height: 1080
  })

  assert.ok(drawCount > 20)
  assert.deepEqual(renderContext.calls.find((call) => call[0] === 'rect'), ['rect', 0, 0, 1920, 1080])
  assert.ok(renderContext.calls.some((call) => call[0] === 'clip'))
  assert.ok(renderContext.calls.some((call) => call[0] === 'rotate' && call[1] < 0))
  const labels = renderContext.calls.filter((call) => call[0] === 'fillText')
  assert.equal(labels.length, drawCount)
  assert.ok(labels.every((call) => call[1] === 'MagicFloor'))
  assert.equal(DEFAULT_STAGE_WATERMARK_OPACITY, 0.44)
  assert.equal(renderContext.globalAlpha, DEFAULT_STAGE_WATERMARK_OPACITY)
  assert.equal(renderContext.calls[0][0], 'save')
  assert.equal(renderContext.calls.at(-1)[0], 'restore')
})

test('watermark layer follows the switch and never paints outside stage clipping', () => {
  const renderContext = createRecordingContext()
  const watermarkLayer = { id: 'watermark-layer' }

  assert.equal(DEFAULT_STAGE_WATERMARK_ENABLED, true)
  assert.equal(drawStageWatermarkLayer(renderContext, watermarkLayer, { enabled: false }), false)
  assert.equal(drawStageWatermarkLayer(renderContext, watermarkLayer, { stageActive: false }), false)
  assert.equal(renderContext.calls.length, 0)

  assert.equal(drawStageWatermarkLayer(renderContext, watermarkLayer, {
    enabled: true,
    stageActive: true,
    width: 1920,
    height: 1080
  }), true)
  assert.deepEqual(renderContext.calls.find((call) => call[0] === 'rect'), ['rect', 0, 0, 1920, 1080])
  assert.ok(renderContext.calls.some((call) => call[0] === 'clip'))
  assert.deepEqual(
    renderContext.calls.find((call) => call[0] === 'drawImage'),
    ['drawImage', watermarkLayer, 0, 0, 1920, 1080]
  )
})

test('player composites the watermark after items and background transition', () => {
  const playerSource = fs.readFileSync(new URL('./player.js', import.meta.url), 'utf8')
  const itemDrawIndex = playerSource.indexOf('visibleItems.forEach((item, index) => drawItem')
  const transitionDrawIndex = playerSource.indexOf('drawBackgroundTransition(context, playbackFrame)')
  const watermarkDrawIndex = playerSource.indexOf('drawStageWatermarkLayer(context, watermarkCanvas')
  const stageRestoreIndex = playerSource.indexOf('context.restore()', watermarkDrawIndex)

  assert.ok(itemDrawIndex >= 0)
  assert.ok(transitionDrawIndex > itemDrawIndex)
  assert.ok(watermarkDrawIndex > transitionDrawIndex)
  assert.ok(stageRestoreIndex > watermarkDrawIndex)
})
