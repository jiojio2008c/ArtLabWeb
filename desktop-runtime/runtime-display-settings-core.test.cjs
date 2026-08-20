'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const {
  DEFAULT_WATERMARK_ENABLED,
  WATERMARK_SETTINGS_EVENT_NAMES,
  normalizeWatermarkEnabled,
  resolveWatermarkEnabled,
  resolveWatermarkEnabledForEvent
} = require('./runtime-display-settings-core.cjs')

test('watermark defaults to enabled for new and legacy stored state', () => {
  assert.equal(DEFAULT_WATERMARK_ENABLED, true)
  assert.equal(normalizeWatermarkEnabled(undefined), true)
  assert.equal(resolveWatermarkEnabled(undefined, {}), true)
})

test('explicit watermark settings support both switch values', () => {
  assert.equal(resolveWatermarkEnabled(true, { watermarkEnabled: false }), false)
  assert.equal(resolveWatermarkEnabled(false, { watermarkEnabled: true }), true)
})

test('missing or invalid fields preserve the current watermark setting', () => {
  assert.equal(resolveWatermarkEnabled(false, {}), false)
  assert.equal(resolveWatermarkEnabled(true, { watermarkEnabled: 'false' }), true)
  assert.equal(resolveWatermarkEnabled(false, null), false)
})

test('only supported desktop protocol events may update watermark state', () => {
  assert.deepEqual(WATERMARK_SETTINGS_EVENT_NAMES, [
    'DisplaySettings',
    'GroupStateSync',
    'GroupSelectAndSync',
    'PreviewMode'
  ])

  let enabled = resolveWatermarkEnabledForEvent(true, 'DisplaySettings', { watermarkEnabled: false })
  assert.equal(enabled, false)
  enabled = resolveWatermarkEnabledForEvent(enabled, 'GroupStateSync', {})
  assert.equal(enabled, false)
  enabled = resolveWatermarkEnabledForEvent(enabled, 'GroupSelectAndSync', { watermarkEnabled: true })
  assert.equal(enabled, true)
  enabled = resolveWatermarkEnabledForEvent(enabled, 'PreviewMode', { watermarkEnabled: false })
  assert.equal(enabled, false)
  enabled = resolveWatermarkEnabledForEvent(enabled, 'ItemUpdate', { watermarkEnabled: true })
  assert.equal(enabled, false)
})

test('standard and flipped builds package the shared presentation cores', () => {
  const runtimeRoot = __dirname
  const standardConfig = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'package.json'), 'utf8')).build
  const flippedConfig = JSON.parse(fs.readFileSync(
    path.join(runtimeRoot, 'electron-builder.vertical-flip.json'),
    'utf8'
  ))

  for (const config of [standardConfig, flippedConfig]) {
    assert.ok(config.files.includes('runtime-display-settings-core.cjs'))
    assert.ok(config.files.includes('renderer/**/*'))
  }
})
