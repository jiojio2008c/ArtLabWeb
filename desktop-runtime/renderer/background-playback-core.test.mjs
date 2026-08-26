import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  getDynamicFixedBackgroundEpochKey,
  getDynamicStageItemsForBackground,
  resolveDynamicFixedBackgroundEpoch,
  resolveDynamicBackgroundPlaybackEpoch
} from './background-playback-core.js'

const stageItems = [
  { itemId: 'global', order: 0, backgroundIds: [] },
  { itemId: 'forest-root', order: 1, backgroundIds: ['forest'] },
  {
    itemId: 'forest-child',
    order: 2,
    backgroundIds: ['ocean'],
    linkedAppearance: {
      triggerItemId: 'forest-root',
      mode: 'showAfter',
      delayMs: 0
    }
  },
  { itemId: 'ocean-only', order: 3, backgroundIds: ['ocean'] }
]

assert.deepEqual(
  getDynamicStageItemsForBackground(stageItems, { assetId: 'forest' }).map((item) => item.itemId),
  ['global', 'forest-root', 'forest-child'],
  'The stage must use the active background scope even before preview starts.'
)
assert.deepEqual(
  getDynamicStageItemsForBackground(stageItems, { id: 'ocean' }).map((item) => item.itemId),
  ['global', 'ocean-only'],
  'Linked children must inherit the parent background in the static stage view.'
)
assert.deepEqual(
  getDynamicStageItemsForBackground(stageItems).map((item) => item.itemId),
  stageItems.map((item) => item.itemId),
  'A stage without a background keeps every item available.'
)

const playerSource = await readFile(new URL('./player.js', import.meta.url), 'utf8')
const visibleItemsFunction = playerSource.slice(
  playerSource.indexOf('const getVisibleItemsForPlayback'),
  playerSource.indexOf('const getAppearanceContextSignature')
)
assert.match(
  visibleItemsFunction,
  /const getVisibleItemsForPlayback = \(group, backgroundFrame\) => \{[\s\S]*?return getDynamicStageItemsForBackground\(items, backgroundFrame\?\.background\)[\s\S]*?\}/,
  'Both the static stage and preview must use the active background item scope.'
)
assert.doesNotMatch(
  visibleItemsFunction,
  /isAdvancedPreviewEnabled\(\)/,
  'Active-background filtering must not depend on preview mode.'
)
const effectiveAnimationFunction = playerSource.slice(
  playerSource.indexOf('const getEffectiveAnimation'),
  playerSource.indexOf('const getItemRenderState')
)
const overrideLookupIndex = effectiveAnimationFunction.indexOf(
  'const override = animationOverrides.get(runtimeState.activeGroupId, item)'
)
const oneShotCompletionIndex = effectiveAnimationFunction.indexOf(
  'if (isAnimationOverrideComplete(override, now, oneShotDuration))'
)
const staticFallbackIndex = effectiveAnimationFunction.indexOf('if (!preview.enabled)')

assert.ok(overrideLookupIndex >= 0, 'Click animation overrides must be read during stage rendering.')
assert.ok(
  overrideLookupIndex < staticFallbackIndex,
  'The editor stage must apply click animation overrides before its non-preview static fallback.'
)
assert.ok(
  oneShotCompletionIndex > overrideLookupIndex && oneShotCompletionIndex < staticFallbackIndex,
  'One-shot click animations must be completed before the non-preview static fallback is selected.'
)
assert.match(
  effectiveAnimationFunction,
  /if \(isAnimationOverrideComplete\(override, now, oneShotDuration\)\) \{[\s\S]*?animationOverrides\.complete\(runtimeState\.activeGroupId, item\.itemId, override\.startedAt\)[\s\S]*?\} else \{[\s\S]*?return \{[\s\S]*?animationId: override\.activeAnimationId,[\s\S]*?\}[\s\S]*?\}[\s\S]*?if \(!preview\.enabled\) \{[\s\S]*?animationId: 0,[\s\S]*?timeSeconds: 0/,
  'Completed one-shot overrides must fall through to the static non-preview state.'
)
assert.match(
  playerSource,
  /animationElapsedMs: preview\.enabled[\s\S]*?: Number\.POSITIVE_INFINITY/,
  'The editor stage must render typewriter bubbles in their complete static state.'
)

const firstKey = getDynamicFixedBackgroundEpochKey({
  sessionKey: 'group-a:1',
  groupId: 'group-a',
  replayId: 1,
  backgroundId: 'background-a'
})
const firstEpoch = resolveDynamicFixedBackgroundEpoch(undefined, firstKey, 1000)
assert.equal(firstEpoch.changedAt, 1000)

const continuedEpoch = resolveDynamicFixedBackgroundEpoch(firstEpoch, firstKey, 2400)
assert.deepEqual(continuedEpoch, firstEpoch)

const nextKey = getDynamicFixedBackgroundEpochKey({
  sessionKey: 'group-a:1',
  groupId: 'group-a',
  replayId: 1,
  backgroundId: 'background-b'
})
const switchedEpoch = resolveDynamicFixedBackgroundEpoch(firstEpoch, nextKey, 3200)
assert.equal(switchedEpoch.changedAt, 3200)
assert.notEqual(switchedEpoch.key, firstEpoch.key)

const playbackEpoch = resolveDynamicBackgroundPlaybackEpoch(undefined, 'sequence-a', 4000)
assert.equal(playbackEpoch.startedAt, 4000)
assert.deepEqual(
  resolveDynamicBackgroundPlaybackEpoch(playbackEpoch, 'sequence-a', 9000),
  playbackEpoch
)
assert.equal(
  resolveDynamicBackgroundPlaybackEpoch(playbackEpoch, 'sequence-b', 9800).startedAt,
  9800
)

console.log('Fixed-background appearance epoch continuity verified.')
