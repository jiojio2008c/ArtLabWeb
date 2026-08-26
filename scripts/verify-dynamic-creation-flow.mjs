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
import {
  DYNAMIC_GROUPS_KEY,
  setDynamicBackgroundBgm
} from '../src/services/dynamicArtStorage.ts'
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
    'control.objectLinkage': '出场排序',
    'flow.appearAll': '全部出现',
    'flow.appearSequence': '逐个出现',
    'flow.backgroundInheritedCardLabel': '{{child}}，跟随 {{parent}}',
    'flow.backgroundFollowsNamed': '跟随：{{parent}}',
    'settings.advancedFeaturesSummary': '创作流程、出场编排、音源、背景与进阶转场'
  }],
  ['zh-Hant', zhHant, {
    'control.appearanceOrder': '出場排序',
    'control.objectLinkage': '出場排序',
    'flow.appearAll': '全部出現',
    'flow.appearSequence': '逐個出現',
    'flow.backgroundInheritedCardLabel': '{{child}}，跟隨 {{parent}}',
    'flow.backgroundFollowsNamed': '跟隨：{{parent}}',
    'settings.advancedFeaturesSummary': '創作流程、出場編排、音源、背景與進階轉場'
  }],
  ['en', en, {
    'control.appearanceOrder': 'Entrance Order',
    'control.objectLinkage': 'Entrance Order',
    'flow.appearAll': 'Show All',
    'flow.appearSequence': 'One by One',
    'flow.backgroundInheritedCardLabel': '{{child}}, follows {{parent}}',
    'flow.backgroundFollowsNamed': 'Follows: {{parent}}',
    'settings.advancedFeaturesSummary': 'Creation flow, entrance sequencing, audio, backgrounds, and advanced transitions'
  }],
  ['pt-PT', ptPT, {
    'control.appearanceOrder': 'Ordem de entrada',
    'control.objectLinkage': 'Ordem de entrada',
    'flow.appearAll': 'Mostrar todos',
    'flow.appearSequence': 'Um a um',
    'flow.backgroundInheritedCardLabel': '{{child}}, segue os fundos de {{parent}}',
    'flow.backgroundFollowsNamed': 'Segue: {{parent}}',
    'settings.advancedFeaturesSummary': 'Fluxo de criação, ordem de entrada, áudio, fundos e transições avançadas'
  }],
  ['pl-PL', plPL, {
    'control.appearanceOrder': 'Kolejność wejścia',
    'control.objectLinkage': 'Kolejność wejścia',
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
  assert.equal(
    resource['control.appearanceOrder'],
    resource['control.objectLinkage'],
    `${locale} must consistently describe object linkage as entrance ordering.`
  )
}

for (const [locale, resource] of localizedFlowCopy) {
  for (const key of [
    'control.clearAllBackgroundMusic',
    'control.clearAllBackgroundMusicHint',
    'control.clearedAllBackgroundMusic'
  ]) {
    assert.equal(
      typeof resource[key] === 'string' && resource[key].trim().length > 0,
      true,
      `${locale} must provide user-facing copy for ${key}.`
    )
  }
}

const localizedLinkageEditorCopy = [
  ['zh-Hans', zhHans, {
    'control.linkageImmediate': '紧随其后',
    'control.linkageSourceAlias': '物件A',
    'control.linkageTargetAlias': '物件B',
    'control.linkageRouteAccessible': '物件A：{{source}}；物件B：{{target}}',
    'control.linkageSummaryImmediate': '{{source}} → {{target}} 紧随其后',
    'control.linkageNoSharedBackgroundTarget': '没有使用相同背景的物件。',
    'control.linkageBackgroundMismatch': '请选择使用相同背景的物件。'
  }],
  ['zh-Hant', zhHant, {
    'control.linkageImmediate': '緊隨其後',
    'control.linkageSourceAlias': '物件A',
    'control.linkageTargetAlias': '物件B',
    'control.linkageRouteAccessible': '物件A：{{source}}；物件B：{{target}}',
    'control.linkageSummaryImmediate': '{{source}} → {{target}} 緊隨其後',
    'control.linkageNoSharedBackgroundTarget': '沒有使用相同背景的物件。',
    'control.linkageBackgroundMismatch': '請選擇使用相同背景的物件。'
  }],
  ['en', en, {
    'control.linkageImmediate': 'Immediately After',
    'control.linkageSourceAlias': 'Object A',
    'control.linkageTargetAlias': 'Object B',
    'control.linkageRouteAccessible': 'Object A: {{source}}; Object B: {{target}}',
    'control.linkageSummaryImmediate': '{{source}} → {{target}} immediately after',
    'control.linkageNoSharedBackgroundTarget': 'No objects use the same background.',
    'control.linkageBackgroundMismatch': 'Choose an object that uses the same background.'
  }],
  ['pt-PT', ptPT, {
    'control.linkageImmediate': 'Logo a seguir',
    'control.linkageSourceAlias': 'Objeto A',
    'control.linkageTargetAlias': 'Objeto B',
    'control.linkageRouteAccessible': 'Objeto A: {{source}}; Objeto B: {{target}}',
    'control.linkageSummaryImmediate': '{{source}} → {{target}} logo a seguir',
    'control.linkageNoSharedBackgroundTarget': 'Nenhum objeto usa o mesmo fundo.',
    'control.linkageBackgroundMismatch': 'Escolha um objeto que use o mesmo fundo.'
  }],
  ['pl-PL', plPL, {
    'control.linkageImmediate': 'Bezpośrednio po',
    'control.linkageSourceAlias': 'Obiekt A',
    'control.linkageTargetAlias': 'Obiekt B',
    'control.linkageRouteAccessible': 'Obiekt A: {{source}}; Obiekt B: {{target}}',
    'control.linkageSummaryImmediate': '{{source}} → {{target}} bezpośrednio po',
    'control.linkageNoSharedBackgroundTarget': 'Brak obiektów używających tego samego tła.',
    'control.linkageBackgroundMismatch': 'Wybierz obiekt używający tego samego tła.'
  }]
]

for (const [locale, resource, expectedCopy] of localizedLinkageEditorCopy) {
  for (const [key, expectedValue] of Object.entries(expectedCopy)) {
    assert.equal(resource[key], expectedValue, `${locale} should use the approved linkage editor copy for ${key}.`)
  }
  assert.deepEqual(
    getTranslationPlaceholders(resource['control.linkageRouteAccessible']),
    ['source', 'target'],
    `${locale} must expose the real Object A and Object B names to assistive technology.`
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(resource, 'control.linkageNone'),
    false,
    `${locale} must not retain the misleading "not set" linkage option.`
  )
}

const localizedBubbleEditorResources = [
  ['zh-Hans', zhHans],
  ['zh-Hant', zhHant],
  ['en', en],
  ['pt-PT', ptPT],
  ['pl-PL', plPL]
]
const bubbleEditorKeys = Object.keys(zhHant).filter((key) => key.startsWith('bubbleEditor.'))

for (const [locale, resource] of localizedBubbleEditorResources) {
  for (const key of bubbleEditorKeys) {
    assert.equal(
      typeof resource[key] === 'string' && resource[key].trim().length > 0,
      true,
      `${locale} must provide user-facing bubble editor copy for ${key}.`
    )
  }
  assert.deepEqual(
    getTranslationPlaceholders(resource['bubbleEditor.image.selectedAlt']),
    ['name'],
    `${locale} selected-image copy must preserve the image name.`
  )
  assert.deepEqual(
    getTranslationPlaceholders(resource['bubbleEditor.editNamedAria']),
    ['name'],
    `${locale} bubble-editing label must preserve the object name.`
  )
}

assert.deepEqual(
  {
    add: zhHant['bubbleEditor.heading.add'],
    edit: zhHant['bubbleEditor.heading.edit'],
    thought: zhHant['bubbleEditor.type.thought'],
    title: zhHant['bubbleEditor.type.title'],
    underline: zhHant['bubbleEditor.style.titleUnderline'],
    imagePicker: zhHant['bubbleEditor.image.pickerHint'],
    imageFit: zhHant['bubbleEditor.image.fitStatus'],
    saving: zhHant['bubbleEditor.saving']
  },
  {
    add: '新增氣泡',
    edit: '編輯氣泡',
    thought: '想像氣泡',
    title: '標題遮罩',
    underline: '底線',
    imagePicker: '系統會開啟相簿、拍照或檔案',
    imageFit: '完整置中顯示',
    saving: '正在儲存…'
  },
  'Traditional Chinese bubble editing must use approved Traditional Chinese terminology.'
)

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

const makeStoredMedia = (id, type = 'image') => ({
  id,
  name: id,
  type,
  mimeType: type === 'audio' ? 'audio/mpeg' : 'image/png',
  url: '',
  updatedAt: 1
})
const backgroundBgmStorage = createMemoryStorage()
const backgroundBgmAudioLibrary = [
  { ...makeStoredMedia('music-a', 'audio'), durationMs: 1200 },
  { ...makeStoredMedia('music-b', 'audio'), durationMs: 3400 }
]
const backgroundBgmBackgrounds = [
  { ...makeStoredMedia('stage-a'), bgmAudioId: 'music-a' },
  { ...makeStoredMedia('stage-b'), bgmAudioId: 'music-b' },
  { ...makeStoredMedia('stage-c'), bgmAudioId: undefined }
]
const backgroundBgmGroup = makeGroup([], {
  background: backgroundBgmBackgrounds[1],
  backgrounds: backgroundBgmBackgrounds,
  activeBackgroundId: 'stage-b',
  audioLibrary: backgroundBgmAudioLibrary
})
backgroundBgmStorage.setItem(DYNAMIC_GROUPS_KEY, JSON.stringify([backgroundBgmGroup]))

const previousLocalStorage = globalThis.localStorage
globalThis.localStorage = backgroundBgmStorage
let clearedBackgroundBgmGroup
try {
  clearedBackgroundBgmGroup = await setDynamicBackgroundBgm(
    backgroundBgmGroup.id,
    backgroundBgmBackgrounds.map((background) => background.id),
    undefined
  )
} finally {
  if (previousLocalStorage === undefined) {
    delete globalThis.localStorage
  } else {
    globalThis.localStorage = previousLocalStorage
  }
}

assert.ok(clearedBackgroundBgmGroup, 'Clearing all background music must return the updated group.')
assert.deepEqual(
  clearedBackgroundBgmGroup.backgrounds.map((background) => background.bgmAudioId),
  [undefined, undefined, undefined],
  'Clearing all background music must remove every background BGM assignment.'
)
assert.equal(
  clearedBackgroundBgmGroup.background?.bgmAudioId,
  undefined,
  'The active background mirror must also lose its BGM assignment.'
)
assert.deepEqual(
  clearedBackgroundBgmGroup.backgrounds.map(({ id, name }) => ({ id, name })),
  backgroundBgmBackgrounds.map(({ id, name }) => ({ id, name })),
  'Clearing all BGM must preserve the background collection and its order.'
)
assert.equal(
  clearedBackgroundBgmGroup.activeBackgroundId,
  backgroundBgmGroup.activeBackgroundId,
  'Clearing all BGM must preserve the active background.'
)
assert.deepEqual(
  clearedBackgroundBgmGroup.audioLibrary.map(({ id, name, durationMs }) => ({ id, name, durationMs })),
  backgroundBgmAudioLibrary.map(({ id, name, durationMs }) => ({ id, name, durationMs })),
  'Clearing background assignments must preserve every reusable audio-library asset.'
)
const storedBackgroundBgmGroup = JSON.parse(backgroundBgmStorage.getItem(DYNAMIC_GROUPS_KEY))[0]
assert.ok(
  storedBackgroundBgmGroup.backgrounds.every((background) => !background.bgmAudioId),
  'Cleared background BGM assignments must be persisted.'
)
assert.deepEqual(
  storedBackgroundBgmGroup.audioLibrary.map((audio) => audio.id),
  ['music-a', 'music-b'],
  'Persisting cleared BGM assignments must not delete audio-library records.'
)

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
const dynamicBubbleEditorSource = readFileSync(
  new URL('../src/components/DynamicBubbleEditor.tsx', import.meta.url),
  'utf8'
)
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const dynamicGroupsSource = readFileSync(
  new URL('../src/components/DynamicGroupsPage.tsx', import.meta.url),
  'utf8'
)
const appSettingsSource = readFileSync(
  new URL('../src/services/appSettings.ts', import.meta.url),
  'utf8'
)
const dynamicStorageSource = readFileSync(
  new URL('../src/services/dynamicArtStorage.ts', import.meta.url),
  'utf8'
)
const desktopPlayerSource = readFileSync(
  new URL('../desktop-runtime/renderer/player.js', import.meta.url),
  'utf8'
)

assert.doesNotMatch(
  dynamicBubbleEditorSource,
  /\p{Script=Han}/u,
  'The shared add/edit bubble dialog must not contain hard-coded Chinese copy.'
)
assert.match(
  dynamicBubbleEditorSource,
  /t\(mode === 'edit' \? 'bubbleEditor\.heading\.edit' : 'bubbleEditor\.heading\.add'\)/,
  'The shared bubble dialog must localize both add and edit modes.'
)
for (const simplifiedCopy of [
  '关闭新增物件菜单',
  '选择物件类型',
  '上传物件',
  '相册、拍照或文件',
  '添加气泡',
  '对话、想象或标题',
  '编辑标题遮罩',
  '编辑气泡'
]) {
  assert.equal(
    dynamicControlSource.includes(simplifiedCopy),
    false,
    `The control-page bubble entry must not hard-code Simplified Chinese copy: ${simplifiedCopy}`
  )
}

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
  /const resolveDynamicEditorExperience = \(_experience: DynamicCreationFlowExperience\) => 'free' as const/,
  'Every route into the control page must use the single free-editing experience.'
)
assert.match(
  dynamicControlSource,
  /const editorExperience(?:\s*:\s*DynamicCreationFlowExperience)?\s*=\s*'free'(?:\s+as\s+DynamicCreationFlowExperience)?/,
  'A saved creation-flow session must not override the single free-editing experience.'
)
assert.match(
  dynamicControlSource,
  /const layerRelationTree: DynamicAppearanceRelationTreeNode\[\] = advancedFeaturesEnabled[\s\S]*?buildVisibleLayerRelationTree/,
  'Free editing must retain the parent-child layer tree.'
)
assert.doesNotMatch(
  dynamicControlSource,
  /dynamic-editor-experience-switch/,
  'The creation-flow/free-editing switch must remain hidden.'
)
assert.doesNotMatch(
  dynamicGroupsSource,
  /dynamic-library-advanced-toggle/,
  'The archived advanced-features switch must remain hidden.'
)
assert.match(
  appSettingsSource,
  /const DEFAULT_ADVANCED_FEATURES_ENABLED = true[\s\S]*advancedFeaturesEnabled: DEFAULT_ADVANCED_FEATURES_ENABLED/,
  'Existing and new installations must use the single advanced free-editing runtime.'
)
assert.match(
  indexCss,
  /\.dynamic-control-screen:not\(\.dynamic-flow-mode\)\s*{[\s\S]*--control-layer-width:\s*clamp\(328px, 28vw, 392px\)/,
  'Free editing must use the creation-flow panel proportions.'
)
assert.match(
  dynamicControlSource,
  /className="dynamic-stage-watermark-mark"[\s\S]*MagicFloor[\s\S]*preview/,
  'The control-stage watermark must use the centered two-line preview mark.'
)
assert.match(
  indexCss,
  /\.dynamic-control-screen \.dynamic-stage-watermark-mark\s*{\s*opacity:\s*0\.44;/,
  'The control-stage watermark must remain 44% opaque.'
)
assert.match(
  indexCss,
  /\.dynamic-control-screen \.dynamic-stage-watermark-lines\s*{[\s\S]*stroke-dasharray:\s*30px 20px;[\s\S]*drop-shadow/,
  'The control-stage watermark lines must remain dashed and readable over light backgrounds.'
)
const watermarkLines = [...dynamicControlSource.matchAll(
  /<line x1="(\d+)" y1="(\d+)" x2="(\d+)" y2="(\d+)"\s*\/>/g
)].map((match) => match.slice(1).map(Number))
assert.equal(watermarkLines.length, 2, 'The control-stage watermark must use exactly two diagonal lines.')
watermarkLines.forEach(([x1, y1, x2, y2]) => {
  assert.deepEqual(
    [(x1 + x2) / 2, (y1 + y2) / 2],
    [960, 540],
    'Each watermark diagonal must pass through the exact stage center.'
  )
})
assert.ok(
  (watermarkLines[0][3] - watermarkLines[0][1])
    * (watermarkLines[1][3] - watermarkLines[1][1]) < 0,
  'The two watermark diagonals must cross in opposite directions.'
)
assert.match(
  dynamicControlSource,
  /className="dynamic-stage-watermark-copy" transform="translate\(960 540\)"/,
  'The two-line watermark label must be centered on the diagonal intersection.'
)
const watermarkMarkup = dynamicControlSource.match(
  /{watermarkEnabled && \(\s*(<svg[\s\S]*?<\/svg>)\s*\)}/
)?.[1]
assert.ok(watermarkMarkup, 'The enabled watermark must render as one self-contained SVG.')
const watermarkMaskMatch = watermarkMarkup.match(
  /<mask\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/mask>/
)
assert.ok(watermarkMaskMatch, 'The watermark diagonals must define a center safe-zone mask.')
const [, watermarkMaskId, watermarkMaskMarkup] = watermarkMaskMatch
assert.match(
  watermarkMaskMarkup,
  /<rect(?=[^>]*\bx="0")(?=[^>]*\by="0")(?=[^>]*\bwidth="1920")(?=[^>]*\bheight="1080")(?=[^>]*\bfill="white")[^>]*\/>/,
  'The watermark mask must begin with a fully visible stage-sized surface.'
)
const watermarkSafeZoneTag = [...watermarkMaskMarkup.matchAll(/<rect\b[^>]*\/>/g)]
  .map((match) => match[0])
  .find((tag) => /\bfill="(?:black|#000(?:000)?)"/.test(tag))
assert.ok(watermarkSafeZoneTag, 'The watermark mask must cut out an opaque-black center safe zone.')
const getSvgNumber = (tag, attribute) => Number(
  tag.match(new RegExp(`\\b${attribute}="([0-9.]+)"`))?.[1]
)
const safeZoneX = getSvgNumber(watermarkSafeZoneTag, 'x')
const safeZoneY = getSvgNumber(watermarkSafeZoneTag, 'y')
const safeZoneWidth = getSvgNumber(watermarkSafeZoneTag, 'width')
const safeZoneHeight = getSvgNumber(watermarkSafeZoneTag, 'height')
assert.ok(
  safeZoneX < 960
    && safeZoneX + safeZoneWidth > 960
    && safeZoneY < 540
    && safeZoneY + safeZoneHeight > 540,
  'The watermark cutout must contain the exact center label anchor.'
)
assert.ok(
  safeZoneWidth >= 500 && safeZoneHeight >= 220,
  'The watermark cutout must leave readable breathing room around both label lines.'
)
const escapedWatermarkMaskId = watermarkMaskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
assert.match(
  watermarkMarkup,
  new RegExp(`<g(?=[^>]*className="dynamic-stage-watermark-lines")(?=[^>]*mask="url\\(#${escapedWatermarkMaskId}\\)")[^>]*>`),
  'The center cutout must apply to the dashed diagonals themselves.'
)
assert.doesNotMatch(
  watermarkMarkup,
  new RegExp(`<g(?=[^>]*className="dynamic-stage-watermark-copy")(?=[^>]*mask="url\\(#${escapedWatermarkMaskId}\\)")[^>]*>`),
  'The center cutout must not hide the MagicFloor preview label.'
)
assert.match(
  dynamicControlSource,
  /const hasAssignedBackgroundBgm = backgrounds\.some\(\(background\) => Boolean\(background\.bgmAudioId\)\)/,
  'The clear-all BGM action must be enabled only while at least one background has music.'
)
const clearAllBackgroundBgmHandler = dynamicControlSource.match(
  /const clearAllBackgroundBgm = async \(\) => \{([\s\S]*?)\r?\n  }\r?\n\r?\n  const applyBackgroundTransition/
)?.[1]
assert.ok(clearAllBackgroundBgmHandler, 'The background editor must expose a dedicated clear-all BGM handler.')
assert.match(
  clearAllBackgroundBgmHandler,
  /const targetIds = backgrounds\.map\(\(background\) => background\.id\)/,
  'Clearing all BGM must target every background, not only the current selection.'
)
assert.match(
  clearAllBackgroundBgmHandler,
  /setDynamicBackgroundBgm\(group\.id, targetIds, undefined\)/,
  'Clearing all BGM must remove assignments through the background-only storage operation.'
)
assert.doesNotMatch(
  clearAllBackgroundBgmHandler,
  /selectedBackgroundIds|deleteDynamicAudio|audioLibrary\s*=/,
  'Clearing all BGM must neither limit itself to selected backgrounds nor delete reusable audio assets.'
)
assert.match(
  clearAllBackgroundBgmHandler,
  /stopAudioPreview\(\)[\s\S]*stopBgmPlayback\(false\)/,
  'Clearing all BGM must immediately stop both audio preview and active background playback.'
)
assert.match(
  clearAllBackgroundBgmHandler,
  /setBackgroundBgmDraftAudioId\(''\)[\s\S]*sendGroupStateSync\(nextGroup\)/,
  'Clearing all BGM must reset the editor draft and synchronize the updated group.'
)
const clearAllBackgroundBgmButton = dynamicControlSource.match(
  /<button(?=[^>]*className="ipad-button dynamic-background-bgm-clear-all")[^>]*>[\s\S]*?<\/button>/
)?.[0]
assert.ok(clearAllBackgroundBgmButton, 'The background-music panel must render a one-click clear-all button.')
assert.match(
  clearAllBackgroundBgmButton,
  /disabled={!hasAssignedBackgroundBgm}[\s\S]*onClick={\(\) => void clearAllBackgroundBgm\(\)}/,
  'The clear-all BGM button must be disabled when unnecessary and invoke the dedicated action directly.'
)
assert.match(
  clearAllBackgroundBgmButton,
  /title={t\('control\.clearAllBackgroundMusicHint'\)}[\s\S]*{t\('control\.clearAllBackgroundMusic'\)}/,
  'The clear-all BGM button must provide a concise visible label and an explanatory accessible hint.'
)
assert.match(
  dynamicControlSource,
  /const selectedItemHasIncomingLink = Boolean\(selectedItem\?\.linkedAppearance\?\.triggerItemId\)[\s\S]*id !== 'background' \|\| !selectedItemHasIncomingLink/,
  'A linked child object must not expose the inherited background property tab.'
)
assert.match(
  dynamicControlSource,
  /type LinkageEditorMode = 'immediate' \| Exclude<DynamicLinkedAppearanceMode, 'none'>/,
  'The editor must separate the immediate UI choice from the persisted linkage modes.'
)
assert.match(
  dynamicControlSource,
  /!linkedAppearance \|\| \(linkedAppearance\.mode === 'showAfter' && linkedAppearance\.delayMs === 0\)[\s\S]*\? 'immediate'[\s\S]*: linkedAppearance\.mode/,
  'A stored zero-delay appearance must reopen as the immediate option.'
)
assert.match(
  dynamicControlSource,
  /const persistedMode:[\s\S]*pendingLinkedAppearanceMode === 'hideAfter'[\s\S]*\? 'hideAfter'[\s\S]*: 'showAfter'[\s\S]*const delayMs = pendingLinkedAppearanceMode === 'immediate'[\s\S]*\? 0/,
  'The immediate option must persist as showAfter with a zero-millisecond delay.'
)
assert.match(
  dynamicControlSource,
  /\['immediate', 'control\.linkageImmediate'\],[\s\S]*\['showAfter', 'control\.linkageShowAfter'\],[\s\S]*\['hideAfter', 'control\.linkageHideAfter'\]/,
  'The linkage editor must offer immediate, timed entrance, and timed hide choices in that order.'
)
assert.doesNotMatch(
  dynamicControlSource,
  /\['none', 'control\.linkageNone'\]/,
  'Removing an order must remain a dedicated action instead of a misleading mode choice.'
)
assert.match(
  dynamicControlSource,
  /pendingLinkedAppearanceMode !== 'immediate'[\s\S]*className="dynamic-linkage-delay-field"/,
  'The immediate option must not ask the user for an irrelevant delay.'
)
assert.match(
  dynamicControlSource,
  /<strong>{t\('control\.linkageSourceAlias'\)}<\/strong>[\s\S]*pendingLinkTargetItem \? t\('control\.linkageTargetAlias'\)/,
  'The relationship diagram must use Object A and Object B aliases without renaming stored objects.'
)
assert.match(
  dynamicControlSource,
  /const removeEditedLink = \(\) => {[\s\S]*persistLinkedAppearanceRelation\([\s\S]*'none',[\s\S]*0/,
  'The dedicated remove-from-order action must continue to clear the stored relationship.'
)
const stageHitResolverStart = dynamicControlSource.indexOf('const resolveStageItemIdAtPoint = (clientPoint: Point) => {')
const stageHitResolverEnd = dynamicControlSource.indexOf('const handleStagePointerDown', stageHitResolverStart)
const stageHitResolverSource = stageHitResolverStart >= 0 && stageHitResolverEnd > stageHitResolverStart
  ? dynamicControlSource.slice(stageHitResolverStart, stageHitResolverEnd)
  : ''
assert.ok(stageHitResolverSource, 'The stage hit resolver must remain available for interaction checks.')
assert.match(
  stageHitResolverSource,
  /const itemsByHitPriority = \[\.\.\.displayedItems\][\s\S]*sort\(\(first, second\) => second\.order - first\.order\)/,
  'Stage hit testing must only consider objects that are actually rendered on the current background.'
)
assert.doesNotMatch(
  stageHitResolverSource,
  /latestGroupRef\.current\.items|selectedIndex|unshift\(selected\)/,
  'Hidden-background objects and the previously selected object must not override visual layer hit priority.'
)
assert.match(
  dynamicControlSource,
  /const dynamicItemsShareEffectiveBackground = \([\s\S]*availableBackgroundIds\.size === 0\) return true[\s\S]*getDynamicEffectiveBackgroundIds\(items, sourceItemId\)[\s\S]*getDynamicEffectiveBackgroundIds\(items, targetItemId\)[\s\S]*sourceBackgroundIds\.length === 0 \|\| targetBackgroundIds\.length === 0\) return true[\s\S]*availableBackgroundIds\.has\(backgroundId\) && targetBackgroundIdSet\.has\(backgroundId\)/,
  'Link candidates must share a real effective background, while all-background and no-background projects remain compatible.'
)
assert.match(
  dynamicControlSource,
  /const eligibleLinkTargetItems = selectedItem[\s\S]*cycleSafeLinkTargetItems\.filter\(\(item\) => dynamicItemsShareEffectiveBackground\([\s\S]*selectedItem\.id,[\s\S]*item\.id/,
  'The following-object list must combine cycle prevention with effective-background overlap.'
)
assert.equal(
  [...dynamicControlSource.matchAll(/= getDynamicLinkTargetValidationError\(/g)].length,
  2,
  'Background and cycle eligibility must be rechecked both when selecting and when saving a following object.'
)
assert.match(
  dynamicControlSource,
  /eligibleLinkTargetItems\.length === 0 \? linkageTargetEmptyStateKey[\s\S]*t\(linkageTargetEmptyStateKey\)/,
  'An empty candidate list must explain when no object shares the current background.'
)
assert.match(
  dynamicControlSource,
  /visibleActiveTab === 'background' && advancedFeaturesEnabled && !selectedItemHasIncomingLink/,
  'A linked child object must not render the inherited background property content.'
)
assert.doesNotMatch(
  dynamicStorageSource,
  /return synchronizeDynamicLinkedBackgrounds\(validatedItems\)/,
  'Normalizing or saving a linked child must preserve its own background assignment history.'
)
assert.match(
  dynamicControlSource,
  /const sortedItems = \[\.\.\.group\.items\][\s\S]*?getDynamicPlaybackItemsForBackground\(sortedItems, displayedBackgroundId\)/,
  'The editor must keep stored background assignments while resolving inherited visibility at runtime.'
)
assert.match(
  dynamicControlSource,
  /displayedItems\.forEach\(\(item\) => \{\s*if \(item\.isVisible === false\) return/,
  'Preview audio must skip objects explicitly hidden by the shared playback state.'
)
assert.match(
  dynamicControlSource,
  /const nextDisplayedItemIds = new Set\(\s*displayedItems\s*\.filter\(\(item\) => item\.isVisible !== false\)/,
  'Preview audio timers must be cleared when an object becomes hidden.'
)
assert.match(
  dynamicControlSource,
  /if \(item\?\.isVisible !== false && item\?\.audioTrigger === 'targetArrival'\)/,
  'Target arrival must not trigger audio for an explicitly hidden object.'
)
assert.match(
  dynamicControlSource,
  /displayedItems\.map\(\(item, index\) => \{\s*if \(previewMode && item\.isVisible === false\) return null/,
  'Preview rendering must hide objects marked invisible while keeping them available to the editor.'
)
assert.match(
  desktopPlayerSource,
  /items\.forEach\(\(item, itemIndex\) => \{\s*if \(item\.isVisible === false \|\| !item\.audioId\) return/,
  'Desktop playback must not play audio for an explicitly hidden object.'
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
  /case 'orbit':\s*{[\s\S]*?sampleDynamicOrbitMotion[\s\S]*?return\s*{\s*x:\s*point\.x,\s*y:\s*point\.y,\s*scale:\s*1,\s*rotation:\s*0\s*}/,
  'Desktop orbit playback must preserve the same configured object size as the editor and web preview.'
)

console.log('Dynamic creation flow verification passed.')
