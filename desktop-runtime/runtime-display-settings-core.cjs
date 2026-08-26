'use strict'

const DEFAULT_WATERMARK_ENABLED = true
const DESKTOP_STAGE_WATERMARK_ENABLED = false
const DESKTOP_ADVANCED_FEATURES_ENABLED = true
const WATERMARK_SETTINGS_EVENT_NAMES = Object.freeze([
  'DisplaySettings',
  'GroupStateSync',
  'GroupSelectAndSync',
  'PreviewMode'
])
const WATERMARK_SETTINGS_EVENT_SET = new Set(WATERMARK_SETTINGS_EVENT_NAMES)

const normalizeWatermarkEnabled = (value, fallback = DEFAULT_WATERMARK_ENABLED) => {
  if (typeof value === 'boolean') return value
  return typeof fallback === 'boolean' ? fallback : DEFAULT_WATERMARK_ENABLED
}

const resolveWatermarkEnabled = (currentValue, payload) => {
  const current = normalizeWatermarkEnabled(currentValue)
  if (!payload || typeof payload !== 'object') return current
  if (!Object.prototype.hasOwnProperty.call(payload, 'watermarkEnabled')) return current
  return normalizeWatermarkEnabled(payload.watermarkEnabled, current)
}

const isWatermarkSettingsEvent = (eventName) => WATERMARK_SETTINGS_EVENT_SET.has(eventName)

const resolveWatermarkEnabledForEvent = (currentValue, eventName, payload) => (
  isWatermarkSettingsEvent(eventName)
    ? resolveWatermarkEnabled(currentValue, payload)
    : normalizeWatermarkEnabled(currentValue)
)

module.exports = {
  DEFAULT_WATERMARK_ENABLED,
  DESKTOP_STAGE_WATERMARK_ENABLED,
  DESKTOP_ADVANCED_FEATURES_ENABLED,
  WATERMARK_SETTINGS_EVENT_NAMES,
  isWatermarkSettingsEvent,
  normalizeWatermarkEnabled,
  resolveWatermarkEnabled,
  resolveWatermarkEnabledForEvent
}
