import assert from 'node:assert/strict'

import {
  APPEARANCE_FADE_DURATION_MS,
  APPEARANCE_DROP_DURATION_MS,
  APPEARANCE_TRACK_SLIDE_DURATION_MS,
  MAX_LINKED_APPEARANCE_DELAY_MS,
  buildDynamicAppearanceTimeline,
  getDynamicEffectiveBackgroundIds,
  getDynamicPlaybackItemsForBackground,
  normalizeDynamicLinkedAppearance,
  sampleDynamicAppearanceTimeline,
  synchronizeDynamicLinkedBackgrounds,
  wouldCreateDynamicLinkedAppearanceCycle
} from '../renderer/advanced-appearance-timeline.js'

const linkedItems = [
  { itemId: 'first' },
  {
    itemId: 'linked-show',
    linkedAppearance: {
      triggerItemId: 'first',
      mode: 'showAfter',
      delayMs: 1000
    }
  },
  { itemId: 'second' },
  {
    itemId: 'linked-hide',
    linkedAppearance: {
      triggerItemId: 'linked-show',
      mode: 'hideAfter',
      delayMs: 500
    }
  }
]

const linkedTimeline = buildDynamicAppearanceTimeline({
  items: linkedItems,
  appearMode: 'sequence',
  intervalMs: 900,
  appearAnimation: 'drop'
})

assert.equal(linkedTimeline.first.entranceStartMs, 0)
assert.equal(linkedTimeline.second.entranceStartMs, 900)
assert.equal(linkedTimeline.first.entranceDurationMs, APPEARANCE_DROP_DURATION_MS)
assert.equal(
  linkedTimeline['linked-show'].entranceStartMs,
  linkedTimeline.first.appearanceCompleteMs + 1000
)
assert.equal(
  linkedTimeline['linked-show'].appearanceCompleteMs,
  linkedTimeline['linked-show'].entranceStartMs + APPEARANCE_FADE_DURATION_MS
)
assert.equal(
  linkedTimeline['linked-hide'].hideStartMs,
  linkedTimeline['linked-show'].appearanceCompleteMs + 500
)
assert.equal(
  sampleDynamicAppearanceTimeline(
    linkedTimeline['linked-show'],
    linkedTimeline['linked-show'].entranceStartMs - 1
  ).active,
  false
)
assert.equal(
  sampleDynamicAppearanceTimeline(
    linkedTimeline['linked-hide'],
    linkedTimeline['linked-hide'].hideCompleteMs + 1
  ).interactive,
  false
)

const continuedTimeline = buildDynamicAppearanceTimeline({
  items: [{ itemId: 'continued' }],
  activeItemIds: ['continued'],
  appearAnimation: 'trackSlide'
})

assert.equal(continuedTimeline.continued.appearAnimation, 'none')
assert.equal(continuedTimeline.continued.entranceDurationMs, 0)
assert.equal(sampleDynamicAppearanceTimeline(continuedTimeline.continued, 0).interactive, true)

const fadeTimeline = buildDynamicAppearanceTimeline({
  items: [{ itemId: 'fade' }],
  appearAnimation: 'none'
})
const trackSlideTimeline = buildDynamicAppearanceTimeline({
  items: [{ itemId: 'track-slide' }],
  appearAnimation: 'trackSlide'
})

assert.equal(fadeTimeline.fade.appearAnimation, 'none')
assert.equal(fadeTimeline.fade.entranceDurationMs, APPEARANCE_FADE_DURATION_MS)
assert.equal(trackSlideTimeline['track-slide'].appearAnimation, 'trackSlide')
assert.equal(
  trackSlideTimeline['track-slide'].entranceDurationMs,
  APPEARANCE_TRACK_SLIDE_DURATION_MS
)

const missingTriggerTimeline = buildDynamicAppearanceTimeline({
  items: [{
    itemId: 'orphan',
    linkedAppearance: {
      triggerItemId: 'not-on-this-background',
      mode: 'showAfter',
      delayMs: 1000
    }
  }],
  appearAnimation: 'drop'
})

assert.equal(missingTriggerTimeline.orphan.kind, 'normal')
assert.equal(missingTriggerTimeline.orphan.appearAnimation, 'drop')

const crossBackgroundItems = [
  { itemId: 'source', backgroundIds: ['forest'] },
  {
    itemId: 'temporary-target',
    backgroundIds: ['ocean'],
    linkedAppearance: { triggerItemId: 'source', mode: 'showAfter', delayMs: 250 }
  },
  {
    itemId: 'temporary-chain',
    backgroundIds: ['city'],
    linkedAppearance: { triggerItemId: 'temporary-target', mode: 'hideAfter', delayMs: 500 }
  },
  { itemId: 'unrelated', backgroundIds: ['ocean'] }
]

const originalBackgroundAssignments = crossBackgroundItems.map((item) => ({
  itemId: item.itemId,
  backgroundIds: [...(item.backgroundIds ?? [])]
}))

const forestPlaybackItems = getDynamicPlaybackItemsForBackground(crossBackgroundItems, 'forest')
const oceanPlaybackItems = getDynamicPlaybackItemsForBackground(crossBackgroundItems, 'ocean')

assert.deepEqual(
  forestPlaybackItems.map((item) => item.itemId),
  ['source', 'temporary-target', 'temporary-chain']
)
assert.deepEqual(
  oceanPlaybackItems.map((item) => item.itemId),
  ['unrelated']
)
assert.deepEqual(
  getDynamicPlaybackItemsForBackground(crossBackgroundItems, 'city').map((item) => item.itemId),
  []
)
assert.deepEqual(
  getDynamicEffectiveBackgroundIds(crossBackgroundItems, 'temporary-target'),
  ['forest']
)
assert.deepEqual(
  getDynamicEffectiveBackgroundIds(crossBackgroundItems, 'temporary-chain'),
  ['forest']
)
assert.deepEqual(
  crossBackgroundItems.map((item) => ({
    itemId: item.itemId,
    backgroundIds: [...(item.backgroundIds ?? [])]
  })),
  originalBackgroundAssignments,
  'Background-aware playback must not mutate persistent background assignments.'
)

const synchronizedCrossBackgroundItems = synchronizeDynamicLinkedBackgrounds(crossBackgroundItems)
assert.deepEqual(
  synchronizedCrossBackgroundItems.map((item) => [item.itemId, item.backgroundIds]),
  [
    ['source', ['forest']],
    ['temporary-target', ['forest']],
    ['temporary-chain', ['forest']],
    ['unrelated', ['ocean']]
  ]
)
assert.deepEqual(
  crossBackgroundItems.find((item) => item.itemId === 'temporary-target').backgroundIds,
  ['ocean'],
  'Background inheritance must not mutate the caller\'s item objects.'
)
const unlinkedTargetItems = synchronizeDynamicLinkedBackgrounds(
  synchronizedCrossBackgroundItems.map((item) => (
    item.itemId === 'temporary-target'
      ? { ...item, linkedAppearance: undefined }
      : item
  ))
)
assert.deepEqual(
  unlinkedTargetItems.find((item) => item.itemId === 'temporary-target').backgroundIds,
  ['forest'],
  'Removing a link must leave the target on its last inherited background so it can be edited independently.'
)

const forestTimeline = buildDynamicAppearanceTimeline({
  items: forestPlaybackItems,
  appearMode: 'all',
  appearAnimation: 'trackSlide'
})

assert.equal(forestTimeline.source.kind, 'normal')
assert.equal(forestTimeline['temporary-target'].kind, 'showAfter')
assert.equal(
  forestTimeline['temporary-target'].entranceStartMs,
  forestTimeline.source.appearanceCompleteMs + 250
)
assert.equal(forestTimeline['temporary-chain'].kind, 'hideAfter')
assert.equal(
  forestTimeline['temporary-chain'].hideStartMs,
  forestTimeline['temporary-target'].appearanceCompleteMs + 500
)

const oceanTimeline = buildDynamicAppearanceTimeline({
  items: oceanPlaybackItems,
  appearMode: 'all',
  appearAnimation: 'drop'
})

assert.equal(oceanTimeline.unrelated.kind, 'normal')
assert.equal(oceanTimeline.unrelated.appearAnimation, 'drop')
assert.equal(oceanTimeline['temporary-target'], undefined)

const globalLinkedItems = [
  { itemId: 'global-source', backgroundIds: [] },
  {
    itemId: 'global-target',
    backgroundIds: ['city'],
    linkedAppearance: { triggerItemId: 'global-source', mode: 'showAfter', delayMs: 0 }
  }
]
assert.deepEqual(
  getDynamicPlaybackItemsForBackground(globalLinkedItems, 'forest').map((item) => item.itemId),
  ['global-source', 'global-target']
)
assert.deepEqual(
  synchronizeDynamicLinkedBackgrounds(globalLinkedItems)[1].backgroundIds,
  []
)

const cycleDirectionItems = [
  { itemId: 'a' },
  {
    itemId: 'b',
    linkedAppearance: { triggerItemId: 'a', mode: 'showAfter', delayMs: 0 }
  },
  { itemId: 'c' }
]

assert.equal(
  wouldCreateDynamicLinkedAppearanceCycle(cycleDirectionItems, 'a', 'b'),
  true,
  'Adding B -> A when A -> B already exists must be rejected.'
)
assert.equal(
  wouldCreateDynamicLinkedAppearanceCycle(cycleDirectionItems, 'c', 'b'),
  false,
  'Adding B -> C after A -> B must remain valid.'
)

const cyclicTimeline = buildDynamicAppearanceTimeline({
  items: [
    {
      itemId: 'cycle-a',
      linkedAppearance: { triggerItemId: 'cycle-b', mode: 'showAfter', delayMs: 0 }
    },
    {
      itemId: 'cycle-b',
      linkedAppearance: { triggerItemId: 'cycle-a', mode: 'hideAfter', delayMs: 0 }
    }
  ],
  appearMode: 'sequence',
  intervalMs: 700
})

assert.equal(cyclicTimeline['cycle-a'].kind, 'normal')
assert.equal(cyclicTimeline['cycle-b'].kind, 'normal')
assert.equal(cyclicTimeline['cycle-b'].entranceStartMs, 700)

assert.deepEqual(
  normalizeDynamicLinkedAppearance({
    triggerItemId: 'trigger',
    mode: 'showAfter',
    delayMs: MAX_LINKED_APPEARANCE_DELAY_MS + 10000
  }, 'target', new Set(['target', 'trigger'])),
  {
    triggerItemId: 'trigger',
    mode: 'showAfter',
    delayMs: MAX_LINKED_APPEARANCE_DELAY_MS
  }
)

console.log('Advanced appearance timeline verification passed.')
