import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  createAnimationOverrideStore,
  isAnimationOverrideComplete,
  sampleRipple,
  WATER_RIPPLE_FALLBACK_PROFILE
} from './interaction-core.js'
import {
  DYNAMIC_CLICK_ANIMATION_NONE_ID,
  getDefaultClickAnimationIds,
  getDynamicClickAnimationIds,
  normalizeDynamicClickAnimationIds,
  resolveDynamicAnimationId
} from './dynamic-animation-catalog.js'
import { WATER_RIPPLE_LIGHTING_PROFILE } from './water-ripple-renderer.js'

const item = {
  itemId: 'item-a',
  animationMode: 'fixed',
  animationId: 10,
  clickAnimationIds: [10, 12, 17]
}

test('completed one-shot overrides release without resetting click rotation', () => {
  const store = createAnimationOverrideStore()
  const first = store.cycle('group-a', item, 1000)

  assert.equal(first.activeAnimationId, 12)
  assert.equal(store.size, 1)
  assert.equal(store.complete('group-a', item.itemId, 999), false)
  assert.equal(store.get('group-a', item), first)
  assert.equal(store.complete('group-a', item.itemId, first.startedAt), true)
  assert.equal(store.get('group-a', item), null)
  assert.equal(store.size, 0)

  const second = store.cycle('group-a', item, 2000)
  assert.equal(second.activeAnimationId, 17)
  assert.equal(store.complete('group-a', item.itemId, second.startedAt), true)

  const third = store.cycle('group-a', item, 3000)
  assert.equal(third.activeAnimationId, 10)
})

test('one-shot completion uses the clip duration while looping animations stay active', () => {
  const override = { startedAt: 1000 }

  assert.equal(isAnimationOverrideComplete(override, 1983, 0.9833334), false)
  assert.equal(isAnimationOverrideComplete(override, 1983.3334, 0.9833334), true)
  assert.equal(isAnimationOverrideComplete(override, 5000, undefined), false)
})

test('authoritative animation changes invalidate active overrides and rotation cursors', () => {
  const store = createAnimationOverrideStore()
  const override = store.cycle('group-a', item, 1000)
  assert.equal(override.activeAnimationId, 12)
  assert.equal(store.complete('group-a', item.itemId, override.startedAt), true)

  const changedItem = { ...item, clickAnimationIds: [10, 17] }
  store.reconcile({ groups: { 'group-a': { items: [changedItem] } } })

  const next = store.cycle('group-a', changedItem, 2000)
  assert.equal(next.activeAnimationId, 17)
})

test('explicit click-animation none sentinel disables the desktop cycle', () => {
  assert.deepEqual(normalizeDynamicClickAnimationIds([DYNAMIC_CLICK_ANIMATION_NONE_ID]), [0])
  assert.deepEqual(normalizeDynamicClickAnimationIds([0, 4, 9]), [0])
  assert.deepEqual(getDynamicClickAnimationIds({ clickAnimationIds: [0] }), [0])
  assert.deepEqual(
    normalizeDynamicClickAnimationIds(undefined, true),
    getDefaultClickAnimationIds(true)
  )
  assert.deepEqual(
    normalizeDynamicClickAnimationIds([], false),
    getDefaultClickAnimationIds(false)
  )

  const store = createAnimationOverrideStore()
  const disabledItem = { ...item, clickAnimationIds: [DYNAMIC_CLICK_ANIMATION_NONE_ID] }

  assert.equal(store.cycle('group-a', disabledItem, 1000), null)
  assert.equal(store.get('group-a', disabledItem), null)
  assert.equal(store.size, 0)

  const activeOverride = store.cycle('group-a', item, 2000)
  assert.ok(activeOverride)
  assert.equal(store.size, 1)
  assert.equal(store.cycle('group-a', disabledItem, 3000), null)
  assert.equal(store.get('group-a', disabledItem), null)
  assert.equal(store.size, 0)
})

test('click-animation none sentinel does not become a regular random animation candidate', () => {
  const resolved = resolveDynamicAnimationId('random', 1, [0, 1], 'seed')
  assert.equal(resolved, 1)
})

test('desktop playback releases only non-looping Unity click animations', () => {
  const playerSource = fs.readFileSync(new URL('./player.js', import.meta.url), 'utf8')

  assert.match(
    playerSource,
    /UNITY_CLICK_ONE_SHOT_DURATION_BY_ID\s*=\s*new Map\([\s\S]*?\.filter\(\(definition\)\s*=>\s*!definition\.loop\)/
  )
  assert.match(
    playerSource,
    /isAnimationOverrideComplete\(override, now, oneShotDuration\)[\s\S]*?animationOverrides\.complete\(runtimeState\.activeGroupId, item\.itemId, override\.startedAt\)/
  )
})

test('water ripple refraction uses the enhanced projector-safe lighting profile', () => {
  const rendererSource = fs.readFileSync(new URL('./water-ripple-renderer.js', import.meta.url), 'utf8')
  const initialRipple = sampleRipple({ x: 960, y: 540, startedAt: 0 }, 0)

  assert.deepEqual(WATER_RIPPLE_LIGHTING_PROFILE, {
    displacementStrengthPixels: 9,
    maxDisplacementPixels: 14.5,
    crestHighlightStrength: 0.115,
    waveHighlightStrength: 0.026,
    shadowStrength: 0.065,
    impactHighlightStrength: 0.15
  })
  assert.deepEqual(WATER_RIPPLE_FALLBACK_PROFILE, {
    ringAlpha: 0.48,
    centerAlpha: 0.24
  })
  assert.equal(initialRipple.rings[0].alpha, WATER_RIPPLE_FALLBACK_PROFILE.ringAlpha)
  assert.equal(initialRipple.centerAlpha, WATER_RIPPLE_FALLBACK_PROFILE.centerAlpha)
  Object.keys(WATER_RIPPLE_LIGHTING_PROFILE).forEach((key) => {
    assert.match(rendererSource, new RegExp(`WATER_RIPPLE_LIGHTING_PROFILE\\.${key}`))
  })
})
