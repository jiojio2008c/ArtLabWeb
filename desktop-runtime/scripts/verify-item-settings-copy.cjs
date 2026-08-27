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
  appearanceDelayMs: 1250,
  appearanceHideMs: 4800,
  appearanceByBackground: {
    'background-1': { appearanceDelayMs: 300, appearanceHideMs: null },
    'background-3': { appearanceDelayMs: 1700 }
  },
  hideAfterTarget: true,
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
assert.notStrictEqual(target.appearanceByBackground, source.appearanceByBackground)
assert.notStrictEqual(
  target.appearanceByBackground['background-1'],
  source.appearanceByBackground['background-1']
)

target.appearanceByBackground['background-1'].appearanceDelayMs = 999
assert.equal(source.appearanceByBackground['background-1'].appearanceDelayMs, 300)

const clearedTarget = { audioId: 'old-audio' }
applyItemSettingsCopy({}, clearedTarget, ['audioId'])
assert.equal('audioId' in clearedTarget, false)

console.log('Complete item settings copy verified.')
