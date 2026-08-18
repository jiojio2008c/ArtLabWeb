const assert = require('node:assert/strict')
const {
  DEFAULT_ITEM_SETTINGS_COPY_FIELDS,
  applyItemSettingsCopy
} = require('../renderer/item-settings-copy-core.cjs')

const source = {
  position: { x: 0.36, y: 0.18 },
  gridIndex: 39,
  scale: 1.4,
  rotation: 18,
  flipX: true,
  flipY: false,
  animationMode: 'random',
  animationId: 9,
  clickAnimationIds: [1, 4, 9],
  moveMode: 'left',
  movePercent: 72,
  moveSpeed: 64,
  moveTrack: 'top',
  targetMode: 'target',
  targetLoop: true,
  targetPosition: { x: 0.82, y: 0.24 },
  audioId: 'audio-1',
  audioTrigger: 'appearanceDelay',
  audioDelayMs: 1800,
  backgroundIds: ['background-1', 'background-3'],
  linkedAppearance: { triggerItemId: 'item-a', mode: 'showAfter', delayMs: 900 }
}
const target = {
  targetPosition: { x: 0.1, y: 0.1 },
  backgroundIds: [],
  linkedAppearance: null
}

applyItemSettingsCopy(source, target)

DEFAULT_ITEM_SETTINGS_COPY_FIELDS.forEach((field) => {
  assert.deepEqual(target[field], source[field])
})
assert.notStrictEqual(target.clickAnimationIds, source.clickAnimationIds)
assert.notStrictEqual(target.position, source.position)
assert.notStrictEqual(target.targetPosition, source.targetPosition)
assert.notStrictEqual(target.backgroundIds, source.backgroundIds)
assert.notStrictEqual(target.linkedAppearance, source.linkedAppearance)

const clearedTarget = { audioId: 'old-audio' }
applyItemSettingsCopy({}, clearedTarget, ['audioId'])
assert.equal('audioId' in clearedTarget, false)

console.log('Complete item settings copy verified.')
