import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  APPEARANCE_FADE_DURATION_MS,
  APPEARANCE_DROP_DURATION_MS,
  APPEARANCE_TRACK_SLIDE_DURATION_MS,
  DYNAMIC_APPEARANCE_EASING,
  MAX_LINKED_APPEARANCE_DELAY_MS,
  buildDynamicAppearanceTimeline,
  canContinueDynamicAppearanceEpoch,
  getContinuableDynamicAppearanceItemIds,
  getDynamicEffectiveBackgroundIds,
  getDynamicAppearanceAnimationSeekMs,
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

const immediateTimeline = buildDynamicAppearanceTimeline({
  items: [
    { itemId: 'immediate-source' },
    {
      itemId: 'immediate-target',
      linkedAppearance: {
        triggerItemId: 'immediate-source',
        mode: 'showAfter',
        delayMs: 0
      }
    }
  ],
  appearAnimation: 'trackSlide'
})

assert.equal(
  immediateTimeline['immediate-target'].entranceStartMs,
  immediateTimeline['immediate-source'].appearanceCompleteMs,
  'A zero-delay showAfter relation must start immediately after its source finishes appearing.'
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
assert.equal(
  DYNAMIC_APPEARANCE_EASING,
  'cubic-bezier(0.333333, 0, 0.666667, 1)'
)
assert.equal(
  getDynamicAppearanceAnimationSeekMs(trackSlideTimeline['track-slide'], 250),
  250,
  'An entrance animation seeks to the elapsed time within its active window.'
)
assert.equal(
  getDynamicAppearanceAnimationSeekMs(trackSlideTimeline['track-slide'], -1),
  0,
  'An entrance animation does not seek before its start.'
)
assert.equal(
  getDynamicAppearanceAnimationSeekMs(trackSlideTimeline['track-slide'], 10000),
  APPEARANCE_TRACK_SLIDE_DURATION_MS,
  'An entrance animation seek is clamped after completion.'
)
assert.equal(
  getDynamicAppearanceAnimationSeekMs(linkedTimeline['linked-hide'], linkedTimeline['linked-hide'].hideStartMs + 180),
  180,
  'A hide-after animation seeks from its hide start.'
)
assert.equal(
  getDynamicAppearanceAnimationSeekMs(linkedTimeline['linked-hide'], linkedTimeline['linked-hide'].hideCompleteMs + 1),
  APPEARANCE_FADE_DURATION_MS,
  'A hide-after animation seek is clamped after completion.'
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

const continuationParent = { itemId: 'parent' }
const continuationChild = {
  itemId: 'child',
  linkedAppearance: { triggerItemId: 'parent', mode: 'showAfter', delayMs: 500 }
}
const continuationTimeline = buildDynamicAppearanceTimeline({
  items: [continuationParent, continuationChild],
  appearAnimation: 'drop'
})
const continuationEpoch = {
  key: 'preview:child:1',
  startedAt: 1000,
  schedule: continuationTimeline.child
}
assert.equal(
  canContinueDynamicAppearanceEpoch(continuationChild, continuationEpoch, {
    triggerContinues: true,
    schedule: continuationTimeline.child
  }),
  true,
  'A linked child keeps its epoch when the background changes.'
)
assert.equal(
  canContinueDynamicAppearanceEpoch({
    ...continuationChild,
    linkedAppearance: { ...continuationChild.linkedAppearance, delayMs: 600 }
  }, continuationEpoch, { triggerContinues: true }),
  false,
  'Changing a link creates a new appearance epoch.'
)
assert.equal(
  canContinueDynamicAppearanceEpoch(continuationParent, {
    schedule: continuationTimeline.parent
  }, { rootActive: true, schedule: continuationTimeline.parent }),
  true,
  'An active root keeps its epoch when the background changes.'
)

const pendingParentItems = [
  { itemId: 'active-root' },
  { itemId: 'pending-parent' },
  {
    itemId: 'show-child',
    linkedAppearance: { triggerItemId: 'pending-parent', mode: 'showAfter', delayMs: 500 }
  },
  {
    itemId: 'hide-child',
    linkedAppearance: { triggerItemId: 'pending-parent', mode: 'hideAfter', delayMs: 500 }
  }
]
const pendingParentPreviousTimeline = buildDynamicAppearanceTimeline({
  items: pendingParentItems,
  appearMode: 'sequence',
  intervalMs: 2000,
  appearAnimation: 'drop'
})
const pendingParentEpochs = Object.fromEntries(pendingParentItems.map((item) => [
  item.itemId,
  { schedule: pendingParentPreviousTimeline[item.itemId] }
]))
const pendingParentNextTimeline = buildDynamicAppearanceTimeline({
  items: pendingParentItems,
  appearMode: 'sequence',
  intervalMs: 2000,
  appearAnimation: 'drop',
  activeItemIds: ['active-root']
})
const pendingParentContinuations = getContinuableDynamicAppearanceItemIds({
  items: pendingParentItems,
  previousEpochs: pendingParentEpochs,
  timeline: pendingParentNextTimeline,
  activeItemIds: ['active-root']
})
assert.deepEqual(
  [...pendingParentContinuations],
  ['active-root'],
  'Children must restart when their pending trigger parent starts a new background epoch.'
)

const threeLevelItems = [
  { itemId: 'chain-root' },
  {
    itemId: 'chain-middle',
    linkedAppearance: { triggerItemId: 'chain-root', mode: 'showAfter', delayMs: 250 }
  },
  {
    itemId: 'chain-leaf',
    linkedAppearance: { triggerItemId: 'chain-middle', mode: 'showAfter', delayMs: 350 }
  }
]
const threeLevelTimeline = buildDynamicAppearanceTimeline({
  items: threeLevelItems,
  appearAnimation: 'trackSlide'
})
const threeLevelEpochs = new Map(threeLevelItems.map((item) => [
  item.itemId,
  { schedule: threeLevelTimeline[item.itemId] }
]))
assert.deepEqual(
  [...getContinuableDynamicAppearanceItemIds({
    items: threeLevelItems,
    previousEpochs: threeLevelEpochs,
    timeline: buildDynamicAppearanceTimeline({
      items: threeLevelItems,
      appearAnimation: 'trackSlide',
      activeItemIds: ['chain-root']
    }),
    activeItemIds: ['chain-root']
  })],
  ['chain-root', 'chain-middle', 'chain-leaf'],
  'A three-level chain continues only through an unbroken trigger continuation path.'
)

const changedMiddleItems = threeLevelItems.map((item) => (
  item.itemId === 'chain-middle'
    ? { ...item, linkedAppearance: { ...item.linkedAppearance, delayMs: 450 } }
    : item
))
assert.deepEqual(
  [...getContinuableDynamicAppearanceItemIds({
    items: changedMiddleItems,
    previousEpochs: threeLevelEpochs,
    timeline: buildDynamicAppearanceTimeline({
      items: changedMiddleItems,
      appearAnimation: 'trackSlide',
      activeItemIds: ['chain-root']
    }),
    activeItemIds: ['chain-root']
  })],
  ['chain-root'],
  'Changing a middle link restarts that item and every linked descendant.'
)

const dynamicControlSource = await readFile(
  new URL('../../src/components/DynamicControlPage.tsx', import.meta.url),
  'utf8'
)
assert.match(
  dynamicControlSource,
  /getDynamicAppearanceAnimationSeekMs/,
  'The Web appearance component must seek rebuilt animations.'
)
assert.match(
  dynamicControlSource,
  /animation\.currentTime\s*=/,
  'The Web appearance component must restore animation progress after a resize or ready update.'
)
assert.match(
  dynamicControlSource,
  /DYNAMIC_APPEARANCE_EASING/,
  'The Web appearance component must use the shared desktop easing.'
)

console.log('Advanced appearance timeline verification passed.')
