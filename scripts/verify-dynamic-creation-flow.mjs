import assert from 'node:assert/strict'

import {
  DYNAMIC_CREATION_FLOW_STEP_IDS,
  DYNAMIC_CREATION_FLOW_STEPS,
  buildDynamicAppearanceRelationTree,
  convertDynamicPlaybackOrderToLayerOrder,
  getDynamicAppearanceRelations,
  getDynamicCreationFlowIssues,
  getDynamicCreationFlowSummary,
  getDynamicPlaybackOrder,
  normalizeDynamicCreationFlowSession
} from '../src/services/dynamicCreationFlowCore.js'
import {
  DYNAMIC_CREATION_FLOW_STORAGE_KEY,
  clearDynamicCreationFlowSessions,
  loadDynamicCreationFlowSession,
  removeDynamicCreationFlowSession,
  saveDynamicCreationFlowSession,
  updateDynamicCreationFlowSession
} from '../src/services/dynamicCreationFlowStorage.ts'

const makeItem = (id, order, overrides = {}) => ({
  id,
  name: id.toUpperCase(),
  order,
  createdAt: order,
  position: { x: 0.5, y: 0.5 },
  targetMode: 'loop',
  backgroundIds: [],
  isVisible: true,
  ...overrides
})

const makeGroup = (items, overrides = {}) => ({
  id: 'group-1',
  name: 'Flow test',
  items,
  backgrounds: [],
  audioLibrary: [],
  appearMode: 'sequence',
  appearIntervalMs: 800,
  appearAnimation: 'none',
  ...overrides
})

const createMemoryStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  }
}

assert.deepEqual(
  DYNAMIC_CREATION_FLOW_STEP_IDS,
  ['objects', 'layout', 'appearance', 'backgrounds', 'audio', 'review']
)
assert.deepEqual(
  DYNAMIC_CREATION_FLOW_STEPS.filter((step) => step.optional).map((step) => step.id),
  ['backgrounds', 'audio']
)

const repairedSession = normalizeDynamicCreationFlowSession({
  version: 1,
  groupId: 'wrong-group',
  experience: 'flow',
  step: 'review',
  selectedItemId: 'deleted-item',
  layoutSubstep: 'unknown',
  checkedItemIds: ['deleted-item', 'survivor', 'survivor'],
  skippedSteps: ['objects', 'backgrounds', 'audio', 'unknown'],
  updatedAt: 123
}, {
  groupId: 'group-1',
  itemIds: ['survivor', 'second'],
  now: 999
})

assert.deepEqual(repairedSession, {
  version: 1,
  groupId: 'group-1',
  experience: 'flow',
  step: 'review',
  selectedItemId: 'survivor',
  layoutSubstep: 'placement',
  checkedItemIds: ['survivor'],
  skippedSteps: ['backgrounds', 'audio'],
  updatedAt: 123
})

assert.deepEqual(
  normalizeDynamicCreationFlowSession({
    version: 0,
    groupId: 'group-1',
    experience: 'flow',
    step: 'review',
    selectedItemId: 'first'
  }, {
    groupId: 'group-1',
    itemIds: ['first'],
    defaultExperience: 'free',
    now: 456
  }),
  {
    version: 1,
    groupId: 'group-1',
    experience: 'free',
    step: 'objects',
    selectedItemId: 'first',
    layoutSubstep: 'placement',
    checkedItemIds: [],
    skippedSteps: [],
    updatedAt: 456
  }
)

const emptySession = normalizeDynamicCreationFlowSession({
  version: 1,
  groupId: 'group-1',
  experience: 'free',
  step: 'audio',
  selectedItemId: 'removed'
}, {
  groupId: 'group-1',
  itemIds: [],
  now: 789
})
assert.equal(emptySession.step, 'objects')
assert.equal(emptySession.selectedItemId, undefined)
assert.equal(emptySession.experience, 'free')

const unorderedItems = [
  makeItem('front', 20),
  makeItem('back', 0),
  makeItem('middle', 10)
]
assert.deepEqual(getDynamicPlaybackOrder(unorderedItems), ['back', 'middle', 'front'])
assert.deepEqual(
  convertDynamicPlaybackOrderToLayerOrder(['back', 'middle'], ['back', 'middle', 'front']),
  ['front', 'middle', 'back']
)
assert.deepEqual(
  convertDynamicPlaybackOrderToLayerOrder(['back', 'back', '', 'front']),
  ['front', 'back']
)

const linkedItems = [
  makeItem('a', 0),
  makeItem('b', 1, {
    linkedAppearance: { triggerItemId: 'a', mode: 'showAfter', delayMs: 500 }
  }),
  makeItem('d', 2, {
    linkedAppearance: { triggerItemId: 'a', mode: 'hideAfter', delayMs: 5000 }
  }),
  makeItem('c', 3, {
    linkedAppearance: { triggerItemId: 'b', mode: 'hideAfter', delayMs: 250 }
  }),
  makeItem('e', 4)
]
const relationTree = buildDynamicAppearanceRelationTree(linkedItems)

assert.deepEqual(relationTree.map((node) => node.itemId), ['a', 'e'])
assert.deepEqual(relationTree[0].children.map((node) => node.itemId), ['b', 'd'])
assert.equal(relationTree[0].children[0].children[0].itemId, 'c')
assert.equal(relationTree[0].children[0].relation.action, 'show')
assert.equal(relationTree[0].children[0].relation.targetInitiallyVisible, false)
assert.equal(relationTree[0].children[1].relation.action, 'hide')
assert.equal(relationTree[0].children[1].relation.targetInitiallyVisible, true)
assert.equal(getDynamicAppearanceRelations(linkedItems).length, 3)

const cyclicGroup = makeGroup([
  makeItem('cycle-a', 0, {
    linkedAppearance: { triggerItemId: 'cycle-b', mode: 'showAfter', delayMs: 0 }
  }),
  makeItem('cycle-b', 1, {
    linkedAppearance: { triggerItemId: 'cycle-a', mode: 'hideAfter', delayMs: 0 }
  })
])
assert.deepEqual(
  buildDynamicAppearanceRelationTree(cyclicGroup).map((node) => node.itemId),
  ['cycle-a', 'cycle-b']
)
assert.equal(
  getDynamicCreationFlowIssues(cyclicGroup).filter((issue) => issue.code === 'appearance.cycle').length,
  2
)

const emptySummary = getDynamicCreationFlowSummary(makeGroup([]))
assert.equal(emptySummary.readyForPreview, false)
assert.equal(emptySummary.stepStatus.objects.ready, false)
assert.equal(emptySummary.stepStatus.backgrounds.optional, true)
assert.equal(emptySummary.stepStatus.audio.configured, false)
assert.ok(emptySummary.issues.some((issue) => issue.code === 'objects.empty'))
assert.ok(emptySummary.issues.some((issue) => issue.code === 'backgrounds.empty'))
assert.equal(
  emptySummary.issues.some((issue) => issue.code.startsWith('audio.') && issue.severity === 'blocking'),
  false,
  'A work without sound must remain skippable.'
)

const sharedAudioOnlySummary = getDynamicCreationFlowSummary(makeGroup([
  makeItem('silent-object', 0)
], {
  backgrounds: [{ id: 'silent-stage', name: 'Silent Stage' }],
  audioLibrary: [{ id: 'shared-audio', name: 'Shared Audio' }]
}))
assert.equal(sharedAudioOnlySummary.audioAssetCount, 1)
assert.equal(sharedAudioOnlySummary.itemAudioCount, 0)
assert.equal(sharedAudioOnlySummary.backgroundAudioCount, 0)
assert.equal(sharedAudioOnlySummary.stepStatus.audio.configured, false)

const reusedAudioSummary = getDynamicCreationFlowSummary(makeGroup([
  makeItem('sounding-object', 0, {
    audioId: 'shared-audio',
    audioTrigger: 'appearance'
  })
], {
  backgrounds: [{ id: 'sounding-stage', name: 'Sounding Stage', bgmAudioId: 'shared-audio' }],
  audioLibrary: [{ id: 'shared-audio', name: 'Shared Audio' }]
}))
assert.equal(reusedAudioSummary.audioAssetCount, 1)
assert.equal(reusedAudioSummary.itemAudioCount, 1)
assert.equal(reusedAudioSummary.backgroundAudioCount, 1)
assert.equal(reusedAudioSummary.stepStatus.audio.configured, true)
assert.equal(
  reusedAudioSummary.issues.some((issue) => issue.code === 'audio.missingItemAsset'),
  false
)
assert.equal(
  reusedAudioSummary.issues.some((issue) => issue.code === 'audio.missingBackgroundAsset'),
  false
)

const danglingAudioIssues = getDynamicCreationFlowIssues(makeGroup([
  makeItem('dangling-object', 0, {
    audioId: 'missing-item-audio',
    audioTrigger: 'appearance'
  })
], {
  backgrounds: [{ id: 'dangling-stage', name: 'Dangling Stage', bgmAudioId: 'missing-background-audio' }]
}))
assert.ok(danglingAudioIssues.some((issue) => (
  issue.code === 'audio.missingItemAsset' && issue.severity === 'warning'
)))
assert.ok(danglingAudioIssues.some((issue) => (
  issue.code === 'audio.missingBackgroundAsset' && issue.severity === 'warning'
)))

const targetAudioGroup = makeGroup([
  makeItem('speaker', 0, {
    targetMode: 'target',
    targetPosition: undefined,
    audioId: 'voice',
    audioTrigger: 'targetArrival'
  })
], {
  backgrounds: [{ id: 'stage', name: 'Stage' }],
  audioLibrary: [{ id: 'voice', name: 'Voice' }]
})
const targetAudioIssues = getDynamicCreationFlowIssues(targetAudioGroup)
assert.ok(targetAudioIssues.some((issue) => issue.code === 'layout.targetMissing'))
assert.ok(targetAudioIssues.some((issue) => issue.code === 'audio.targetMissing'))
const targetAudioSummary = getDynamicCreationFlowSummary(targetAudioGroup)
assert.equal(targetAudioSummary.readyForPreview, false)
assert.equal(targetAudioSummary.stepStatus.review.ready, false)
assert.equal(targetAudioSummary.stepStatus.review.blockingIssueCount, 2)

const completeGroup = makeGroup(linkedItems.map((item) => (
  item.id === 'e'
    ? {
        ...item,
        targetMode: 'target',
        targetPosition: { x: 0.75, y: 0.25 },
        audioId: 'effect',
        audioTrigger: 'targetArrival',
        backgroundIds: ['stage']
      }
    : { ...item, backgroundIds: ['stage'] }
)), {
  backgrounds: [{ id: 'stage', name: 'Stage', bgmAudioId: 'music' }],
  audioLibrary: [
    { id: 'effect', name: 'Effect' },
    { id: 'music', name: 'Music' }
  ],
  appearAnimation: 'drop'
})
const completeSummary = getDynamicCreationFlowSummary(completeGroup)
assert.equal(completeSummary.itemCount, 5)
assert.equal(completeSummary.targetItemCount, 1)
assert.equal(completeSummary.linkedAppearanceCount, 3)
assert.equal(completeSummary.showAfterCount, 1)
assert.equal(completeSummary.hideAfterCount, 2)
assert.equal(completeSummary.itemAudioCount, 1)
assert.equal(completeSummary.backgroundAudioCount, 1)
assert.equal(completeSummary.readyForPreview, true)

const freelyEditedGroup = {
  ...completeGroup,
  items: completeGroup.items.filter((item) => item.id !== 'e'),
  backgrounds: []
}
const recalculatedSummary = getDynamicCreationFlowSummary(freelyEditedGroup)
assert.equal(recalculatedSummary.itemCount, 4)
assert.equal(recalculatedSummary.targetItemCount, 0)
assert.equal(recalculatedSummary.backgroundCount, 0)
assert.ok(recalculatedSummary.issues.some((issue) => issue.code === 'backgrounds.empty'))

const memoryStorage = createMemoryStorage()
memoryStorage.setItem(DYNAMIC_CREATION_FLOW_STORAGE_KEY, '{broken json')
const recoveredStoredSession = loadDynamicCreationFlowSession('group-1', {
  storage: memoryStorage,
  itemIds: ['a'],
  defaultExperience: 'free',
  now: 100
})
assert.equal(recoveredStoredSession.experience, 'free')
assert.equal(recoveredStoredSession.selectedItemId, 'a')

const savedSession = saveDynamicCreationFlowSession({
  ...recoveredStoredSession,
  experience: 'flow',
  step: 'appearance'
}, {
  storage: memoryStorage,
  itemIds: ['a'],
  now: 200
})
assert.equal(savedSession.updatedAt, 200)
assert.equal(
  loadDynamicCreationFlowSession('group-1', {
    storage: memoryStorage,
    itemIds: ['a'],
    now: 300
  }).step,
  'appearance'
)

const updatedSession = updateDynamicCreationFlowSession('group-1', {
  step: 'audio',
  skippedSteps: ['audio']
}, {
  storage: memoryStorage,
  itemIds: ['a'],
  now: 400
})
assert.equal(updatedSession.step, 'audio')
assert.deepEqual(updatedSession.skippedSteps, ['audio'])
assert.equal(removeDynamicCreationFlowSession('group-1', memoryStorage), true)
assert.equal(
  loadDynamicCreationFlowSession('group-1', {
    storage: memoryStorage,
    itemIds: [],
    now: 500
  }).step,
  'objects'
)
assert.equal(clearDynamicCreationFlowSessions(memoryStorage), true)

console.log('Dynamic creation flow verification passed.')
