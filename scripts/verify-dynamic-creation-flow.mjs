import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
import en from '../src/i18n/locales/en.ts'
import plPL from '../src/i18n/locales/pl-PL.ts'
import ptPT from '../src/i18n/locales/pt-PT.ts'
import zhHans from '../src/i18n/locales/zh-Hans.ts'
import zhHant from '../src/i18n/locales/zh-Hant.ts'

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

const localizedFlowCopy = [
  ['zh-Hans', zhHans, {
    'control.appearanceOrder': '出场排序',
    'control.objectLinkage': '物件联动',
    'flow.appearAll': '全部出现',
    'flow.appearSequence': '逐个出现',
    'flow.backgroundInheritedCardLabel': '{{child}}，跟随 {{parent}}',
    'flow.backgroundFollowsNamed': '跟随：{{parent}}',
    'settings.advancedFeaturesSummary': '创作流程、出场编排、音源、背景与进阶转场'
  }],
  ['zh-Hant', zhHant, {
    'control.appearanceOrder': '出場排序',
    'control.objectLinkage': '物件聯動',
    'flow.appearAll': '全部出現',
    'flow.appearSequence': '逐個出現',
    'flow.backgroundInheritedCardLabel': '{{child}}，跟隨 {{parent}}',
    'flow.backgroundFollowsNamed': '跟隨：{{parent}}',
    'settings.advancedFeaturesSummary': '創作流程、出場編排、音源、背景與進階轉場'
  }],
  ['en', en, {
    'control.appearanceOrder': 'Entrance Order',
    'control.objectLinkage': 'Object Link',
    'flow.appearAll': 'Show All',
    'flow.appearSequence': 'One by One',
    'flow.backgroundInheritedCardLabel': '{{child}}, follows {{parent}}',
    'flow.backgroundFollowsNamed': 'Follows: {{parent}}',
    'settings.advancedFeaturesSummary': 'Creation flow, entrance sequencing, audio, backgrounds, and advanced transitions'
  }],
  ['pt-PT', ptPT, {
    'control.appearanceOrder': 'Ordem de entrada',
    'control.objectLinkage': 'Ligação de objetos',
    'flow.appearAll': 'Mostrar todos',
    'flow.appearSequence': 'Um a um',
    'flow.backgroundInheritedCardLabel': '{{child}}, segue os fundos de {{parent}}',
    'flow.backgroundFollowsNamed': 'Segue: {{parent}}',
    'settings.advancedFeaturesSummary': 'Fluxo de criação, ordem de entrada, áudio, fundos e transições avançadas'
  }],
  ['pl-PL', plPL, {
    'control.appearanceOrder': 'Kolejność wejścia',
    'control.objectLinkage': 'Powiązanie obiektu',
    'flow.appearAll': 'Pokaż wszystkie',
    'flow.appearSequence': 'Po kolei',
    'flow.backgroundInheritedCardLabel': '{{child}}, przejmuje tła od {{parent}}',
    'flow.backgroundFollowsNamed': 'Przejmuje od: {{parent}}',
    'settings.advancedFeaturesSummary': 'Proces tworzenia, kolejność pojawiania, dźwięk, tła i zaawansowane przejścia'
  }]
]

const getTranslationPlaceholders = (value) => (
  [...value.matchAll(/{{([^}]+)}}/g)].map((match) => match[1]).sort()
)

for (const [locale, resource, expectedCopy] of localizedFlowCopy) {
  for (const [key, expectedValue] of Object.entries(expectedCopy)) {
    assert.equal(resource[key], expectedValue, `${locale} should use the approved copy for ${key}.`)
  }
  assert.deepEqual(
    getTranslationPlaceholders(resource['flow.backgroundInheritedCardLabel']),
    ['child', 'parent'],
    `${locale} inherited-background card label should identify both objects.`
  )
  assert.deepEqual(
    getTranslationPlaceholders(resource['flow.backgroundFollowsNamed']),
    ['parent'],
    `${locale} inherited-background status should identify its parent.`
  )
  assert.notEqual(
    resource['control.appearanceOrder'],
    resource['control.objectLinkage'],
    `${locale} entrance-order copy must not replace the existing object-linkage copy.`
  )
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

const indexCss = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const dynamicControlSource = readFileSync(
  new URL('../src/components/DynamicControlPage.tsx', import.meta.url),
  'utf8'
)
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const desktopPlayerSource = readFileSync(
  new URL('../desktop-runtime/renderer/player.js', import.meta.url),
  'utf8'
)

assert.match(
  indexCss,
  /\.page-frame\.page-portal\.page-view-dynamicControl \.dynamic-control-workspace\s*{\s*animation:\s*none !important;\s*}/,
  'The artwork-transition handoff must not restart the control workspace entrance animation.'
)
assert.match(
  dynamicControlSource,
  /if \(video\.readyState < HTMLMediaElement\.HAVE_CURRENT_DATA\)\s*{\s*video\.load\(\)\s*}\s*else\s*{\s*playVideo\(\)\s*}/,
  'A ready stage video must resume without resetting its visible frame.'
)

assert.match(
  appSource,
  /const resolveDynamicEditorExperience = \(experience: DynamicCreationFlowExperience\) => \(\s*networkSettings\.advancedFeaturesEnabled \? experience : 'free'\s*\)/,
  'Every route into the control page must fall back to free editing when advanced features are disabled.'
)
assert.match(
  dynamicControlSource,
  /const savedEditorExperience = flowSession\.experience\s*const editorExperience: DynamicCreationFlowExperience = advancedFeaturesEnabled\s*\? savedEditorExperience\s*: 'free'/,
  'A saved creation-flow session must not override the basic free-editing experience.'
)
assert.match(
  dynamicControlSource,
  /const layerRelationTree: DynamicAppearanceRelationTreeNode\[\] = advancedFeaturesEnabled[\s\S]*?: layerItems\.map\(\(item\) => \(\{[\s\S]*?children: \[\][\s\S]*?}\)\)/,
  'Basic editing must flatten every visible layer into a root card.'
)
assert.match(
  dynamicControlSource,
  /{advancedFeaturesEnabled && \(\s*<div className="dynamic-editor-experience-switch"/,
  'The creation-flow/free-editing switch must only be shown with advanced features.'
)

const orbitKeyframes = indexCss.match(/@keyframes dynamic-preview-orbit\s*{([\s\S]*?)\n}/)?.[1]
assert.ok(orbitKeyframes, 'The orbit preview animation must remain defined.')
assert.doesNotMatch(
  orbitKeyframes,
  /scale\(/,
  'Orbit motion must preserve the configured object size throughout preview playback.'
)
assert.doesNotMatch(
  dynamicControlSource,
  /--move-orbit-scale-/,
  'Orbit preview styling must not reintroduce hidden depth scaling.'
)
assert.match(
  desktopPlayerSource,
  /case 'orbit':\s*{[\s\S]*?return\s*{\s*x,\s*y,\s*scale:\s*1,\s*rotation:\s*0\s*}/,
  'Desktop orbit playback must preserve the same configured object size as the editor and web preview.'
)

console.log('Dynamic creation flow verification passed.')
