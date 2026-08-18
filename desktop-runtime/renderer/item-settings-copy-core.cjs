const DEFAULT_ITEM_SETTINGS_COPY_FIELDS = Object.freeze([
  'position',
  'gridIndex',
  'scale',
  'rotation',
  'flipX',
  'flipY',
  'animationMode',
  'animationId',
  'clickAnimationIds',
  'moveMode',
  'movePercent',
  'moveSpeed',
  'moveTrack',
  'targetMode',
  'targetLoop',
  'targetPosition',
  'audioId',
  'audioTrigger',
  'audioDelayMs',
  'backgroundIds',
  'linkedAppearance'
])

const cloneItemSettingValue = (value) => {
  if (Array.isArray(value)) return [...value]
  if (value && typeof value === 'object') return { ...value }
  return value
}

const applyItemSettingsCopy = (
  source,
  target,
  fields = DEFAULT_ITEM_SETTINGS_COPY_FIELDS
) => {
  fields.forEach((field) => {
    if (!(field in source)) {
      delete target[field]
      return
    }
    target[field] = cloneItemSettingValue(source[field])
  })
  return target
}

module.exports = {
  DEFAULT_ITEM_SETTINGS_COPY_FIELDS,
  applyItemSettingsCopy
}
