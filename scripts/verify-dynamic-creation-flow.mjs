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
  addDynamicBubble,
  DYNAMIC_GROUPS_KEY,
  setDynamicBackgroundBgm
} from '../src/services/dynamicArtStorage.ts'
import {
  buildDynamicAppearanceTimeline,
  getDynamicAppearanceTimingForBackground,
  getDynamicPlaybackItemsForBackground
} from '../desktop-runtime/renderer/advanced-appearance-timeline.js'
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
    'control.clearedAllBackgroundMusic',
    'control.quickBackgroundSwitch',
    'control.playSelectedBackground'
  ]) {
    assert.equal(
      typeof resource[key] === 'string' && resource[key].trim().length > 0,
      true,
      `${locale} must provide user-facing copy for ${key}.`
    )
  }
}

const localizedAppearanceEditorResources = [
  ['zh-Hans', zhHans],
  ['zh-Hant', zhHant],
  ['en', en],
  ['pt-PT', ptPT],
  ['pl-PL', plPL]
]
const appearanceEditorKeys = [
  'control.appearanceSettings',
  'control.closeAppearanceSettings',
  'control.appearanceMode',
  'control.appearanceObjects',
  'control.appearanceObjectCount',
  'control.appearanceTimingMode',
  'control.appearanceTimingUniform',
  'control.appearanceTimingIndividual',
  'control.appearanceInterval',
  'control.appearanceImmediate',
  'control.appearanceEmpty',
  'control.appearanceObjectTime',
  'control.appearanceTimeSummary',
  'control.appearAll',
  'control.appearSequence',
  'control.appearAnimation',
  'control.appearAnimationNone',
  'control.appearAnimationDrop',
  'control.appearAnimationTrackSlide'
]

for (const [locale, resource] of localizedAppearanceEditorResources) {
  for (const key of appearanceEditorKeys) {
    assert.equal(
      typeof resource[key] === 'string' && resource[key].trim().length > 0,
      true,
      `${locale} must provide user-facing appearance-editor copy for ${key}.`
    )
  }
  assert.deepEqual(
    getTranslationPlaceholders(resource['control.appearanceObjectCount']),
    ['count'],
    `${locale} appearance object count must preserve the count placeholder.`
  )
  assert.deepEqual(
    getTranslationPlaceholders(resource['control.appearanceObjectTime']),
    ['name'],
    `${locale} appearance wheel label must identify the object by name.`
  )
  assert.deepEqual(
    getTranslationPlaceholders(resource['control.appearanceTimeSummary']),
    ['value'],
    `${locale} appearance card summary must preserve the time value.`
  )
}

assert.equal(zhHans['control.appearanceSettings'], '出场设定')
assert.equal(zhHans['control.appearAll'], '全部出场')
assert.equal(zhHans['control.appearSequence'], '逐个出场')
assert.equal(zhHant['control.appearanceSettings'], '出場設定')
assert.equal(zhHant['control.appearAll'], '全部出場')
assert.equal(zhHant['control.appearSequence'], '逐個出場')

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

const abBackgroundItems = [
  makeItem('shared-object', 0),
  makeItem('a-only-object', 1, {
    backgroundIds: ['background-a'],
    appearanceDelayMs: 100,
    appearanceByBackground: {
      'background-a': { appearanceDelayMs: 1400 }
    }
  }),
  makeItem('b-only-object', 2, {
    backgroundIds: ['background-b'],
    appearanceByBackground: {
      'background-b': { appearanceDelayMs: 350 }
    }
  })
]
const backgroundAItems = getDynamicPlaybackItemsForBackground(abBackgroundItems, 'background-a')
const backgroundBItems = getDynamicPlaybackItemsForBackground(abBackgroundItems, 'background-b')
assert.deepEqual(
  backgroundAItems.map((item) => item.id ?? item.itemId),
  ['shared-object', 'a-only-object'],
  'Background A appearance settings must list only global and A-bound objects.'
)
assert.deepEqual(
  backgroundBItems.map((item) => item.id ?? item.itemId),
  ['shared-object', 'b-only-object'],
  'Background B appearance settings must list only global and B-bound objects.'
)
const backgroundATimeline = buildDynamicAppearanceTimeline({
  items: backgroundAItems,
  backgroundId: 'background-a',
  appearMode: 'sequence',
  intervalMs: 800,
  appearAnimation: 'none'
})
const backgroundBTimeline = buildDynamicAppearanceTimeline({
  items: backgroundBItems,
  backgroundId: 'background-b',
  appearMode: 'sequence',
  intervalMs: 800,
  appearAnimation: 'none'
})
assert.equal(
  backgroundATimeline['a-only-object'].entranceStartMs,
  1400,
  'Background A must use its own object entrance delay.'
)
assert.equal(
  backgroundBTimeline['b-only-object'].entranceStartMs,
  350,
  'Background B must use its own object entrance delay.'
)
assert.equal(
  getDynamicAppearanceTimingForBackground(abBackgroundItems[1], 'background-b'),
  undefined,
  'An A-only timing record must not leak into Background B.'
)

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

const itemBackgroundStorage = createMemoryStorage()
const itemBackgroundStages = [makeStoredMedia('stage-a'), makeStoredMedia('stage-b')]
const itemBackgroundGroup = makeGroup([], {
  background: itemBackgroundStages[1],
  backgrounds: itemBackgroundStages,
  activeBackgroundId: 'stage-b'
})
itemBackgroundStorage.setItem(DYNAMIC_GROUPS_KEY, JSON.stringify([itemBackgroundGroup]))
globalThis.localStorage = itemBackgroundStorage
let scopedBubbleGroup
let legacyBubbleGroup
try {
  const bubbleInput = {
    name: 'Scoped bubble',
    bubbleType: 'dialogue',
    styleId: 'dialogue-rounded-right',
    title: '',
    bodyText: 'Hello',
    revealMode: 'instant',
    revealIntervalMs: 80,
    fontSizePx: 42,
    textColor: '#111111',
    paletteId: 'ocean',
    maskColor: '#ffffff',
    maskOpacity: 0.92,
    widthPx: 520,
    heightPx: 280
  }
  scopedBubbleGroup = await addDynamicBubble(itemBackgroundGroup.id, bubbleInput, 'stage-b')
  legacyBubbleGroup = await addDynamicBubble(itemBackgroundGroup.id, {
    ...bubbleInput,
    name: 'Legacy bubble'
  })
} finally {
  if (previousLocalStorage === undefined) {
    delete globalThis.localStorage
  } else {
    globalThis.localStorage = previousLocalStorage
  }
}
assert.deepEqual(
  scopedBubbleGroup?.items[0]?.backgroundIds,
  ['stage-b'],
  'A stage-created object must default to the explicitly supplied current background.'
)
assert.deepEqual(
  legacyBubbleGroup?.items[1]?.backgroundIds,
  [],
  'Creation calls without stage context must remain compatible with the all-background default.'
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
const intervalWheelSource = readFileSync(
  new URL('../src/components/IntervalWheel.tsx', import.meta.url),
  'utf8'
)
const walkAnimationCanvasSource = readFileSync(
  new URL('../src/components/WalkAnimationCanvas.tsx', import.meta.url),
  'utf8'
)
const unityAnimationCanvasSource = readFileSync(
  new URL('../src/components/UnityAnimationCanvas.tsx', import.meta.url),
  'utf8'
)
const canvasRenderSupportSource = readFileSync(
  new URL('../src/services/canvasRenderSupport.ts', import.meta.url),
  'utf8'
)
const canvasRenderQualitySource = readFileSync(
  new URL('../src/services/canvasRenderQuality.ts', import.meta.url),
  'utf8'
)
const brandLogoSource = readFileSync(
  new URL('../src/components/BrandLogo.tsx', import.meta.url),
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
const remoteKeyboardSource = readFileSync(
  new URL('../src/components/RemoteKeyboardPage.tsx', import.meta.url),
  'utf8'
)
const desktopPlayerSource = readFileSync(
  new URL('../desktop-runtime/renderer/player.js', import.meta.url),
  'utf8'
)

for (const [locale, resource] of localizedFlowCopy) {
  assert.equal(
    typeof resource['control.stopBackgroundPlayback'] === 'string'
      && resource['control.stopBackgroundPlayback'].trim().length > 0,
    true,
    `${locale} must provide user-facing copy for stopping current-stage playback.`
  )
}

assert.match(
  dynamicControlSource,
  /const showBackgroundQuickSwitcher = !previewMode && backgrounds\.length > 0 && visibleBackgrounds\.length >= 2/,
  'The background rail must appear only when at least two visible backgrounds are available.'
)
assert.match(
  dynamicControlSource,
  /className={`ipad-button dynamic-background-quick-play \$\{stagePlaybackActive \? 'is-playing' : ''\}`}/,
  'The current-background button must expose a dedicated playing state.'
)
const stagePlaybackHandler = dynamicControlSource.match(
  /const setStagePlaybackEnabled = \([\s\S]*?\n  const handleCurrentBackgroundPlayback/
)?.[0]
assert.ok(stagePlaybackHandler, 'The current-stage playback handler must remain available.')
assert.doesNotMatch(
  stagePlaybackHandler,
  /startPreviewReceiverSync|sendPreviewModeState/,
  'Current-stage playback must not switch the receiver into remote preview mode.'
)
assert.match(
  dynamicControlSource,
  /previewReplayIdRef\.current !== replayId\s*\|\| !previewModeRef\.current[\s\S]*?sendPreviewModeState\(true/,
  'A completed receiver sync must only enter remote preview while full preview is still active.'
)
assert.match(
  dynamicControlSource,
  /addDynamicItem\([\s\S]*?file\.name,[\s\S]*?initialBackgroundId[\s\S]*?\)/,
  'Media objects created on the stage must receive the current background ID.'
)
assert.match(
  dynamicControlSource,
  /sendDynamicEvent\(wsIp, dynamicPort, 'ItemCreate',[\s\S]*?backgroundIds: createdItem\.backgroundIds/,
  'New media object events must preserve the current-background assignment on the receiver.'
)
assert.match(
  dynamicControlSource,
  /addDynamicBubble\(currentGroup\.id, input, initialBackgroundId\)/,
  'Bubble objects created on the stage must receive the current background ID.'
)
assert.equal(
  (remoteKeyboardSource.match(/<Volume1\s*\/>/g) ?? []).length,
  1,
  'The volume knob must show one speaker icon in the shared icon column.'
)
assert.doesNotMatch(
  remoteKeyboardSource,
  /<Volume2\s*\/>/,
  'The volume knob must not restore the second speaker icon.'
)
assert.match(
  remoteKeyboardSource,
  /const travel = Math\.hypot[\s\S]*?if \(travel < 8\) return[\s\S]*?gesture\.rotating = true/,
  'Dragging from the center control must hand off to rotary input after a short threshold.'
)
assert.match(
  remoteKeyboardSource,
  /if \(dragRef\.current \|\| centerGestureRef\.current\) return/,
  'The rotary surface must ignore a second pointer while one gesture is active.'
)
assert.match(
  remoteKeyboardSource,
  /if \(centerGestureRef\.current \|\| dragRef\.current\) return/,
  'The center control must not replace an active rotary pointer.'
)
assert.match(
  remoteKeyboardSource,
  /onLostPointerCapture=\{\(event\) => \{\s*if \(!dragRef\.current \|\| dragRef\.current\.pointerId !== event\.pointerId\) return/,
  'Lost pointer capture must only finish the matching rotary gesture.'
)
assert.match(
  indexCss,
  /\.remote-knob-center-button\s*{[\s\S]*?width:\s*36%;[\s\S]*?min-width:\s*44px;/,
  'The center press target must stay compact while preserving an accessible minimum size.'
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
  indexCss,
  /\.page-frame\.page-view-entry\s*{(?=[^}]*background-color:\s*#69bbd6;)(?=[^}]*background-image:[\s\S]*?url\("\.\/assets\/magic-floor-background\.webp"\);)(?=[^}]*background-position:\s*center, center, center, center bottom;)(?=[^}]*background-size:\s*auto, auto, cover, cover;)[^}]*}/,
  'The homepage frame must retain the branded backdrop while the visible entry screen is made transparent for EXE capture.'
)
assert.match(
  indexCss,
  /:is\(\.entry-screen, \.dynamic-library-screen\)\.dynamic-archive-snapshot-capture\s*{(?=[^}]*background:\s*transparent !important;)(?=[^}]*background-image:\s*none !important;)[^}]*}/,
  'EXE archive captures must remain transparent even though the visible homepage now has a branded fallback layer.'
)
assert.match(
  indexCss,
  /:is\(\.entry-screen, \.dynamic-library-screen\)\.dynamic-archive-snapshot-capture,[\s\S]*?\.dynamic-archive-snapshot-capture \*::after\s*{(?=[^}]*animation-play-state:\s*paused !important;)(?=[^}]*transition:\s*none !important;)[^}]*}/,
  'Archive capture must pause the live animation timeline instead of destroying and replaying completed entrance animations.'
)
assert.doesNotMatch(
  indexCss,
  /:is\(\.entry-screen, \.dynamic-library-screen\)\.dynamic-archive-snapshot-capture,[\s\S]*?\.dynamic-archive-snapshot-capture \*::after\s*{[^}]*animation:\s*none !important;/,
  'Archive capture must not reset live homepage or library animations with animation: none.'
)
assert.match(
  dynamicGroupsSource,
  /const archivePortalArrivalRef = useRef\(portalArrival\)[\s\S]*?archivePortalArrivalRef\.current = portalArrival/,
  'The archive mirror must read portal arrival through a ref so the completed portal does not schedule a duplicate capture.'
)
assert.match(
  dynamicGroupsSource,
  /initialTimer = window\.setTimeout\([\s\S]*?archivePortalArrivalRef\.current \? 700 : 140[\s\S]*?\}, \[[\s\S]*?folderTransitioning,\s*transitionPrepared,/,
  'The library must capture once during portal arrival without rerunning solely when portalArrival clears.'
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
  /const renderLayerItem = \(item: DynamicItem\): React\.ReactNode => \{[\s\S]*?<li key=\{item\.id\} className="dynamic-layer-node is-root">/,
  'Free editing must render a flat layer list with one root card per object.'
)
assert.doesNotMatch(
  dynamicControlSource,
  /dynamic-layer-order/,
  'Layer cards must not render a visible numeric order badge.'
)
assert.doesNotMatch(
  indexCss,
  /dynamic-layer-order/,
  'Removed layer-order badges must not retain dead styling.'
)
assert.doesNotMatch(
  dynamicControlSource,
  /buildVisibleLayerRelationTree|layerRelationTree\s*:/,
  'The editor must not build a parent-child layer tree after independent appearance timing is enabled.'
)
assert.doesNotMatch(
  dynamicControlSource,
  /dynamic-appearance-delay-field|dynamic-appearance-delay-wheel/,
  'Object properties must not duplicate timing controls from the dedicated appearance editor.'
)
assert.doesNotMatch(
  indexCss,
  /dynamic-appearance-delay-(?:field|wheel)/,
  'Removed object-property appearance controls must not retain dead styling.'
)
assert.match(
  dynamicControlSource,
  /className=\{`ipad-button secondary-button control-action-button appear-action[^`]*`\}[\s\S]*?onClick=\{\(\) => appearancePanelOpen \? closeAppearanceEditor\(\) : openAppearanceEditor\(\)\}[\s\S]*?\{t\('control\.appearanceSettings'\)\}/,
  'Free editing must restore the top-right appearance settings action.'
)
assert.match(
  dynamicControlSource,
  /className="dynamic-background-modal dynamic-appearance-modal is-advanced"[\s\S]*?className="dynamic-background-editor-layout dynamic-appearance-editor-layout"/,
  'Appearance settings must use the same full modal container and two-pane structure as the background editor.'
)
assert.match(
  dynamicControlSource,
  /className=\{`dynamic-appearance-item-list[\s\S]*?className=\{`dynamic-appearance-item-card[\s\S]*?<DynamicItemThumbnail[\s\S]*?className="dynamic-appearance-item-thumbnail"/,
  'The appearance editor must render every object as a visual card.'
)
assert.match(
  dynamicControlSource,
  /if \(appearMode === 'all'\) \{\s*commitAppearanceTiming\('all', intervalMs, \(\) => 0\)/,
  'The all-at-once shortcut must make every object enter immediately.'
)
assert.match(
  dynamicControlSource,
  /const showIndividualWheel = appearanceEditorMode === 'sequence'[\s\S]*?&& appearanceSequenceTimingMode === 'individual'[\s\S]*?\{showIndividualWheel && \([\s\S]*?className="dynamic-appearance-item-wheel"/,
  'Per-object timing wheels must only appear for custom one-by-one timing.'
)
assert.match(
  dynamicControlSource,
  /appearanceEditorMode === 'all'[\s\S]*?t\('control\.layerAppearanceSimultaneous'\)[\s\S]*?appearanceEditorMode === 'sequence'[\s\S]*?className="dynamic-appearance-timing-grid"/,
  'All-at-once mode must remain simultaneous while one-by-one mode exposes timing choices.'
)
assert.doesNotMatch(
  dynamicControlSource,
  /dynamic-appearance-immediate-status/,
  'All-at-once mode must not render a redundant immediate-status bar.'
)
assert.doesNotMatch(
  indexCss,
  /\.dynamic-appearance-immediate-status/,
  'The removed all-at-once status bar must not retain dead styling.'
)
assert.match(
  dynamicControlSource,
  /className="dynamic-appearance-animation-grid"[\s\S]*?appearanceAnimationOptions\.map[\s\S]*?setAppearAnimation\(option\.id\)/,
  'The appearance modal must preserve the existing entrance-animation choices.'
)
assert.match(
  indexCss,
  /\.dynamic-appearance-item-list\s*{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*?overflow-y:\s*auto;/,
  'Appearance object cards must use one readable, independently scrollable column.'
)
assert.match(
  indexCss,
  /\.dynamic-appearance-item-card\s*{(?=[^}]*min-height:\s*82px;)(?=[^}]*grid-template-columns:\s*34px 88px minmax\(0, 1fr\) auto;)[^}]*}/,
  'Each appearance card must reserve clear regions for order, thumbnail, name, and optional timing.'
)
assert.match(
  indexCss,
  /@media \(max-width: 960px\), \(orientation: portrait\) and \(max-width: 1100px\)\s*{[\s\S]*?\.dynamic-appearance-editor-layout\s*{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
  'The appearance modal must collapse to one column on portrait and narrower displays.'
)
assert.match(
  dynamicControlSource,
  /const showBackgroundQuickSwitcher = !previewMode && backgrounds\.length > 0 && visibleBackgrounds\.length >= 2/,
  'The current-background controls must stay hidden during full preview and until at least two backgrounds are available.'
)
assert.match(
  dynamicControlSource,
  /className=\{`dynamic-stage-shell \$\{showBackgroundQuickSwitcher \? 'has-background-quick-switcher' : ''\}`\}[\s\S]*?\{showBackgroundQuickSwitcher && \([\s\S]*?className="dynamic-background-quick-switcher"/,
  'One or more backgrounds must render the compact switcher above the editable stage.'
)
assert.match(
  dynamicControlSource,
  /className="dynamic-background-quick-rail"[\s\S]*?visibleBackgrounds\.map\(\(background\) =>[\s\S]*?className=\{`dynamic-background-quick-card\s+\$\{active \? 'active' : ''\}[\s\S]*?aria-pressed=\{active\}/,
  'The quick switcher must expose each visible background as a clearly selectable card.'
)
assert.match(
  dynamicControlSource,
  /className=\{`ipad-button dynamic-background-quick-play \$\{stagePlaybackActive \? 'is-playing' : ''\}`\}[\s\S]*?onClick=\{handleCurrentBackgroundPlayback\}[\s\S]*?aria-pressed=\{stagePlaybackActive\}/,
  'The quick switcher must keep one accessible play/stop action in place during current-stage playback.'
)
assert.match(
  indexCss,
  /\.dynamic-background-quick-switcher\s*{(?=[^}]*--dynamic-background-quick-card-width:\s*174px;)(?=[^}]*width:\s*min\(100%, 930px\);)(?=[^}]*max-width:\s*100%;)(?=[^}]*height:\s*138px;)(?=[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 156px;)(?=[^}]*overflow:\s*hidden;)[^}]*}/,
  'The large-screen switcher must remain centered over the stage with the measured rail and play-area geometry.'
)
assert.match(
  indexCss,
  /\.dynamic-control-screen \.dynamic-editor-row\.right-panel-open \.dynamic-stage-shell\.has-background-quick-switcher\s*{(?=[^}]*align-self:\s*start;)(?=[^}]*padding-top:\s*8px;)[^}]*}/,
  'The background switcher shell must override the centered stage rule and align near the top of the open side panel.'
)
assert.match(
  indexCss,
  /\.dynamic-control-screen \.dynamic-stage-shell\.has-background-quick-switcher\s*{(?=[^}]*grid-template-rows:\s*138px auto;)(?=[^}]*gap:\s*10px;)[^}]*}/,
  'The large-screen switcher must reserve its measured height and a ten-pixel stage gap.'
)
assert.match(
  indexCss,
  /\.dynamic-background-quick-rail\s*{(?=[^}]*min-width:\s*0;)(?=[^}]*overflow-x:\s*scroll;)(?=[^}]*overflow-y:\s*hidden;)(?=[^}]*touch-action:\s*pan-x;)[^}]*}/,
  'The background-card rail must scroll horizontally without leaking vertical or page overflow.'
)
assert.match(
  indexCss,
  /\.dynamic-background-quick-card\s*{(?=[^}]*width:\s*var\(--dynamic-background-quick-card-width\);)(?=[^}]*min-width:\s*var\(--dynamic-background-quick-card-width\);)(?=[^}]*aspect-ratio:\s*5 \/ 3;)(?=[^}]*scroll-snap-align:\s*start;)(?=[^}]*border-radius:\s*12px;)[^}]*}/,
  'Background shortcuts must use uniform, touch-friendly 5:3 rounded thumbnail cards.'
)
assert.match(
  indexCss,
  /\.dynamic-background-quick-thumb > img,[\s\S]*?\.dynamic-background-quick-thumb > video\s*{(?=[^}]*object-fit:\s*contain;)(?=[^}]*object-position:\s*center;)[^}]*}/,
  'Every quick background thumbnail must remain fully visible and centered inside its widescreen card.'
)
assert.match(
  indexCss,
  /\.dynamic-background-quick-play::before\s*{(?=[^}]*left:\s*-15px;)(?=[^}]*background:\s*repeating-linear-gradient\([\s\S]*?rgba\(72, 78, 76, 0\.34\))[^}]*}/,
  'The selected-background play area must be separated from the thumbnail rail by a vertical dashed divider.'
)
assert.match(
  indexCss,
  /@media \(max-width: 1100px\), \(max-height: 820px\)\s*{[\s\S]*?\.dynamic-control-screen \.dynamic-stage-shell\.has-background-quick-switcher\s*{(?=[^}]*grid-template-rows:\s*112px auto;)(?=[^}]*gap:\s*8px;)[^}]*}[\s\S]*?\.dynamic-background-quick-switcher\s*{(?=[^}]*--dynamic-background-quick-card-width:\s*140px;)(?=[^}]*height:\s*112px;)(?=[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 128px;)[^}]*}[\s\S]*?\.dynamic-background-quick-play\s*{(?=[^}]*width:\s*128px;)(?=[^}]*height:\s*64px;)[^}]*}/,
  'The iPad Air layout must use the measured compact bar, card, play-button, and stage-gap dimensions.'
)
assert.match(
  indexCss,
  /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?\.dynamic-background-quick-rail\s*{\s*scroll-behavior:\s*auto;[\s\S]*?\.dynamic-background-quick-card,[\s\S]*?\.dynamic-background-quick-play\s*{\s*transition-duration:\s*1ms !important;/,
  'The quick background controls must respect reduced-motion preferences.'
)
assert.match(
  dynamicControlSource,
  /hideAfterTarget=\{targetEditingItemId === item\.id[\s\S]*?item\.hideAfterTarget === true/,
  'The target editor must pass the hide-after-arrival choice to the stage preview.'
)
assert.match(
  dynamicControlSource,
  /hideAfterTarget:\s*!targetDraftLoop && targetDraftHideAfterTarget/,
  'Saving a target must persist the hide-after-arrival choice and disable it for loops.'
)
assert.match(
  dynamicControlSource,
  /const activeAppearanceTiming = activeBackgroundId[\s\S]*?const appearancePayload = !activeBackgroundId \|\| activeAppearanceTiming/,
  'Item motion payloads must resolve independent appearance timing for the active background.'
)
assert.match(
  dynamicControlSource,
  /const hasAppearanceByBackground = Boolean\([\s\S]*?Object\.keys\(appearanceByBackground\)\.length > 0/,
  'Item motion payloads must not clear a receiver background timing map with an empty map.'
)
assert.match(
  dynamicControlSource,
  /backgroundId:\s*activeBackgroundId[\s\S]*?hasAppearanceByBackground\s*\?\s*\{\s*appearanceByBackground\s*\}\s*:\s*\{\}/,
  'Item motion payloads must preserve non-empty background timing maps.'
)
assert.match(
  dynamicControlSource,
  /\.\.\.appearancePayload[\s\S]*?hideAfterTarget:\s*item\.hideAfterTarget === true/,
  'Item motion payloads must include resolved appearance and target-visibility settings.'
)
assert.match(
  dynamicControlSource,
  /if \(field === 'motion'\) return \[[\s\S]*?'appearanceHideMs',\s*'appearanceByBackground',\s*'hideAfterTarget'/,
  'Item settings copy events must include per-background appearance timing in motion fields.'
)
assert.match(
  dynamicControlSource,
  /const appearanceItems = displayedBackgroundId\s*\n\s*\? getDynamicPlaybackItemsForBackground\(sortedItems, displayedBackgroundId\)\s*\n\s*:\s*sortedItems/,
  'The appearance editor must list only objects assigned to the currently selected background.'
)
assert.match(
  dynamicControlSource,
  /const activeBackground = getActiveBackgroundForGroup\(group\)[\s\S]*?const displayedBackground = playbackActive\s*\n\s*\? backgrounds\.find\(\(background\) => background\.id === previewBackgroundId\) \?\? activeBackground[\s\S]*?const displayedBackgroundId = displayedBackground\?\.id \?\? ''/,
  'Appearance filtering must follow the active or preview-selected background.'
)
assert.match(
  dynamicControlSource,
  /buildDynamicAppearanceTimeline\(\{[\s\S]*?backgroundId:\s*displayedBackgroundId/,
  'The control-page appearance timeline must be rebuilt with the selected background id.'
)
assert.match(
  dynamicControlSource,
  /appearanceByBackground:\s*\{[\s\S]*?\[activeBackgroundId\]:\s*nextTiming/,
  'Editing an object appearance time must persist it under the selected background.'
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
  brandLogoSource,
  /export const RIGHT_LOGO_URL = new URL\('\.\.\/\.\.\/Right_Logo\.png', import\.meta\.url\)\.href/,
  'The homepage logo URL must remain reusable by the control-stage watermark.'
)
assert.match(
  dynamicControlSource,
  /import BrandLogo, \{ RIGHT_LOGO_URL \} from '\.\/BrandLogo\.tsx'/,
  'The control-stage watermark must reuse the same logo asset as the homepage.'
)
assert.match(
  dynamicControlSource,
  /<image(?=[^>]*className="dynamic-stage-watermark-logo")(?=[^>]*href=\{RIGHT_LOGO_URL\})(?=[^>]*x="680")(?=[^>]*y="395")(?=[^>]*width="560")(?=[^>]*height="220")[^>]*\/>/,
  'The control-stage watermark must center the homepage logo inside the safe zone.'
)
assert.match(
  indexCss,
  /\.dynamic-control-screen \.dynamic-stage-watermark-mark\s*{\s*opacity:\s*0\.4;/,
  'The control-stage watermark must remain 40% opaque.'
)
const stageBackgroundZIndex = Number(indexCss.match(
  /\.dynamic-stage-background\s*{\s*z-index:\s*(\d+);/
)?.[1])
const stageWatermarkZIndex = Number(indexCss.match(
  /\.dynamic-control-screen \.dynamic-stage-watermark\s*{[\s\S]*?z-index:\s*(\d+);/
)?.[1])
const backgroundTransitionZIndex = Number(indexCss.match(
  /\.dynamic-control-screen \.dynamic-background-transition-layer\s*{[\s\S]*?z-index:\s*(\d+);/
)?.[1])
assert.ok(
  stageBackgroundZIndex < stageWatermarkZIndex
    && stageWatermarkZIndex < backgroundTransitionZIndex,
  'The stage watermark must sit above the background but below background-transition animation.'
)
const curtainTransitionLogoRule = indexCss.match(
  /\.dynamic-control-screen \.dynamic-background-transition-layer\.is-curtain \.dynamic-background-transition-logo\s*\{[\s\S]*?\}/
)
assert.ok(curtainTransitionLogoRule, 'The curtain transition must define a platform-safe logo rule.')
assert.match(
  curtainTransitionLogoRule[0],
  /filter:\s*none(?:\s*!important)?;[\s\S]*-webkit-filter:\s*none(?:\s*!important)?;/,
  'The curtain transition logo must avoid WebKit-inconsistent color filters.'
)
const transitionLogoRule = indexCss.match(
  /\.dynamic-control-screen \.dynamic-background-transition-logo\s*\{[\s\S]*?\}/
)
assert.ok(transitionLogoRule, 'The transition logo must define a shared visual rule.')
assert.doesNotMatch(
  transitionLogoRule[0],
  /brightness\(0\)|invert\(1\)/,
  'The shared transition logo rule must not recolor the already-white logo on WebKit.'
)
const cameraFlashLogoRule = indexCss.match(
  /\.dynamic-background-transition-layer\.is-cameraFlash \.dynamic-background-transition-logo\s*\{[\s\S]*?\}/
)
assert.ok(cameraFlashLogoRule, 'The camera-flash transition must define its logo contrast rule.')
assert.match(
  cameraFlashLogoRule[0],
  /brightness\(0\)/,
  'The camera-flash transition must retain its black logo contrast.'
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
const watermarkUpperRightMaskNotchTag = watermarkMaskMarkup.match(
  /<line(?=[^>]*className="dynamic-stage-watermark-upper-right-mask-notch")[^>]*\/>/
)?.[0]
assert.ok(
  watermarkUpperRightMaskNotchTag,
  'The watermark mask must reveal the upper-right dashed branch toward the logo.'
)
assert.match(
  watermarkUpperRightMaskNotchTag,
  /(?=[\s\S]*stroke="white")(?=[\s\S]*strokeWidth="64")(?=[\s\S]*strokeLinecap="butt")/,
  'The upper-right mask notch must reveal the full non-scaling dash width without extending its end caps.'
)
const upperRightMaskNotch = {
  x1: getSvgNumber(watermarkUpperRightMaskNotchTag, 'x1'),
  y1: getSvgNumber(watermarkUpperRightMaskNotchTag, 'y1'),
  x2: getSvgNumber(watermarkUpperRightMaskNotchTag, 'x2'),
  y2: getSvgNumber(watermarkUpperRightMaskNotchTag, 'y2')
}
assert.ok(
  upperRightMaskNotch.x1 > 960
    && upperRightMaskNotch.y1 < 540
    && upperRightMaskNotch.x2 > upperRightMaskNotch.x1
    && upperRightMaskNotch.y2 < upperRightMaskNotch.y1,
  'The watermark mask notch must point outward along only the upper-right branch.'
)
Object.entries({
  start: [upperRightMaskNotch.x1, upperRightMaskNotch.y1],
  end: [upperRightMaskNotch.x2, upperRightMaskNotch.y2]
}).forEach(([label, [x, y]]) => {
  assert.ok(
    Math.abs(9 * x + 16 * y - 17280) < 0.05,
    `The upper-right mask notch ${label} must remain on the original diagonal.`
  )
})
assert.ok(
  Math.hypot(upperRightMaskNotch.x1 - 960, upperRightMaskNotch.y1 - 540) >= 100
    && Math.hypot(upperRightMaskNotch.x1 - 960, upperRightMaskNotch.y1 - 540) <= 130,
  'The upper-right mask notch must begin close to the logo without touching the center.'
)
assert.ok(
  Math.hypot(upperRightMaskNotch.x2 - 960, upperRightMaskNotch.y2 - 540) >= 260
    && Math.hypot(upperRightMaskNotch.x2 - 960, upperRightMaskNotch.y2 - 540) <= 300,
  'The upper-right mask notch must extend through the safe-zone boundary.'
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
  'The watermark cutout must contain the exact logo center.'
)
assert.ok(
  safeZoneWidth >= 500 && safeZoneHeight >= 220,
  'The watermark cutout must leave readable breathing room around the centered logo.'
)
const escapedWatermarkMaskId = watermarkMaskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
assert.match(
  watermarkMarkup,
  new RegExp(`<g(?=[^>]*className="dynamic-stage-watermark-lines")(?=[^>]*mask="url\\(#${escapedWatermarkMaskId}\\)")[^>]*>`),
  'The center cutout must apply to the dashed diagonals themselves.'
)
assert.doesNotMatch(
  watermarkMarkup,
  /<image(?=[^>]*className="dynamic-stage-watermark-logo")(?=[^>]*mask=)[^>]*>/,
  'The center cutout must not hide the MagicFloor logo.'
)
assert.match(
  watermarkMarkup,
  /<text(?=[^>]*className="dynamic-stage-watermark-caption")(?=[^>]*x="960")(?=[^>]*y="684")[^>]*>\s*preview only\s*<\/text>/,
  'The control-stage watermark must label the logo as preview-only.'
)
assert.match(
  indexCss,
  /\.dynamic-control-screen \.dynamic-stage-watermark-caption\s*\{[\s\S]*font-size:\s*48px;[\s\S]*font-weight:\s*800;/,
  'The preview-only watermark caption must remain legible.'
)
assert.match(
  dynamicControlSource,
  /const hasAssignedBackgroundBgm = backgrounds\.some\(\(background\) => Boolean\(background\.bgmAudioId\)\)/,
  'The clear-all BGM action must be enabled only while at least one background has music.'
)
const clearAllBackgroundBgmHandler = dynamicControlSource.match(
  /const clearAllBackgroundBgm = async \([\s\S]*?\): Promise<boolean> => \{([\s\S]*?)\r?\n  }\r?\n\r?\n  const applyBackgroundTransition/
)?.[1]
assert.ok(clearAllBackgroundBgmHandler, 'The background editor must expose a dedicated clear-all BGM handler.')
assert.match(
  dynamicControlSource,
  /requestedBackgroundIds = backgrounds\.map\(\(background\) => background\.id\)/,
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
const clearAllBackgroundBgmButtonCss = indexCss.match(
  /\.dynamic-background-modal \.dynamic-background-bgm-clear-all\s*{([^}]*)}/
)?.[1]
assert.ok(clearAllBackgroundBgmButtonCss, 'The clear-all BGM button must keep its dedicated visual treatment.')
const backgroundActionButtonFontCss = indexCss.match(
  /\.dynamic-background-modal \.dynamic-background-entrance-controls > \.ipad-button,\s*\.dynamic-background-modal \.dynamic-background-bgm-controls > \.dynamic-background-bgm-clear-all\s*{([^}]*)}/
)?.[1]
assert.ok(
  backgroundActionButtonFontCss,
  'The background action controls must share one final font-size rule.'
)
assert.match(
  backgroundActionButtonFontCss,
  /font-size:\s*14px;/,
  'The clear-all BGM label must remain readable at the shared action font size.'
)
assert.doesNotMatch(
  dynamicControlSource,
  /className="dynamic-object-linkage-card"(?![^>]*hidden)/,
  'The object properties must not expose a visible binding card.'
)
assert.match(
  dynamicControlSource,
  /const handleAppearanceItemTimeChange = \([\s\S]*?\) => \{[\s\S]*?setAppearanceTimingDraft\(itemId, backgroundId, value\)/,
  'Independent appearance time changes must remain local drafts until the wheel settles.'
)
assert.match(
  dynamicControlSource,
  /onSettled=\{\(value\) => commitAppearanceItemTime\(item\.id, value, displayedBackgroundId\)\}[\s\S]*?onCancel=\{\(\) => clearAppearanceTimingDraft\(item\.id, displayedBackgroundId\)\}/,
  'Appearance timing must commit and clear drafts through the wheel settle lifecycle.'
)
assert.match(
  intervalWheelSource,
  /onSettled\?: \(value: number\) => void[\s\S]*?scheduleSettled\(drag\.lastValue, true\)/,
  'The interval wheel must expose a settle callback after a vertical drag collapses.'
)
assert.match(
  dynamicControlSource,
  /const ControlConfirmAction|type ControlConfirmAction[\s\S]*?delete-items[\s\S]*?ConfirmActionDialog/,
  'Destructive control actions must use the shared in-app confirmation dialog.'
)
assert.match(
  dynamicControlSource,
  /const getLayerSummary = \(item: DynamicItem\) => \{[\s\S]*appearanceOrderIndexById\.get\(item\.id\)[\s\S]*control\.layerAppearance(?:Simultaneous|Order)/,
  'Layer cards must show each object\'s entrance order rather than seconds.'
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
  /visibleActiveTab === 'background' && advancedFeaturesEnabled/,
  'Every independent object must retain access to its own background property content.'
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
  /displayedItems\.map\(\(item, index\) => \{\s*if \(playbackActive && item\.isVisible === false\) return null/,
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

for (const [locale, resource] of localizedAppearanceEditorResources) {
  for (const key of ['control.previewAudioOff', 'control.previewAudioOn']) {
    assert.equal(
      typeof resource[key] === 'string' && resource[key].trim().length > 0,
      true,
      `${locale} must provide full-preview iPad sound copy for ${key}.`
    )
  }
}

const dynamicControlTopbarStart = dynamicControlSource.indexOf(
  '<header className="ipad-topbar dynamic-control-topbar">'
)
const dynamicControlTopbarEnd = dynamicControlSource.indexOf('</header>', dynamicControlTopbarStart)
const dynamicControlTopbarSource = dynamicControlTopbarStart >= 0
  && dynamicControlTopbarEnd > dynamicControlTopbarStart
  ? dynamicControlSource.slice(dynamicControlTopbarStart, dynamicControlTopbarEnd)
  : ''
assert.ok(dynamicControlTopbarSource, 'The stage control top bar must remain available for preview checks.')
assert.match(
  dynamicControlTopbarSource,
  /{previewMode \? \([\s\S]*?className={`ipad-button preview-action preview-audio-toggle[\s\S]*?aria-pressed={previewAudioEnabled}[\s\S]*?control\.previewAudioOn[\s\S]*?control\.previewAudioOff/,
  'The iPad sound toggle must render inside the full-preview-only top-bar branch and expose its pressed state.'
)
assert.equal(
  (dynamicControlSource.match(/preview-audio-toggle/g) ?? []).length,
  1,
  'The iPad sound toggle must not be duplicated outside the full preview top bar.'
)

const previewBgmSource = dynamicControlSource.match(
  /const playPreviewBgm = useCallback\([\s\S]*?\n  const stopObjectAudioPlayback/
)?.[0]
assert.ok(previewBgmSource, 'The preview BGM playback handler must remain available.')
assert.match(
  previewBgmSource,
  /current\.element\.muted = previewModeRef\.current && !previewAudioEnabledRef\.current/,
  'An already active BGM must use the full-preview-only mute condition.'
)
assert.match(
  previewBgmSource,
  /const createdElement = new Audio\(audio\.url\)[\s\S]*?createdElement\.muted = previewModeRef\.current && !previewAudioEnabledRef\.current[\s\S]*?void createdElement\.play\(\)/,
  'A newly created BGM element must receive the full-preview mute state before playback starts.'
)

const objectAudioSource = dynamicControlSource.match(
  /const playObjectAudio = useCallback\([\s\S]*?\n  const updatePreviewAudioEnabled/
)?.[0]
assert.ok(objectAudioSource, 'The object-audio playback handler must remain available.')
assert.match(
  objectAudioSource,
  /const audio = new Audio\(audioMedia\.url\)[\s\S]*?audio\.muted = previewModeRef\.current && !previewAudioEnabledRef\.current[\s\S]*?void audio\.play\(\)/,
  'A newly created object-audio element must receive the full-preview mute state before playback starts.'
)
assert.doesNotMatch(
  dynamicControlSource,
  /\.muted\s*=\s*[^\n]*\bplaybackActive\b/,
  'Local media muting must never use playbackActive, because current-stage playback must retain its sound.'
)

const previewAudioToggleHandler = dynamicControlSource.match(
  /const updatePreviewAudioEnabled = useCallback\([\s\S]*?\n  const clearBackgroundTransitionPlayback/
)?.[0]
assert.ok(previewAudioToggleHandler, 'The full-preview sound toggle handler must remain available.')
assert.match(
  previewAudioToggleHandler,
  /if \(!previewModeRef\.current\) return[\s\S]*?setBackgroundTransitionSoundMuted\(muted\)/,
  'The full-preview sound toggle must control only the local background-transition audio instance.'
)

const previewModeStateSender = dynamicControlSource.match(
  /const sendPreviewModeState = \([\s\S]*?\n  const restartPreviewPlayback/
)?.[0]
assert.ok(previewModeStateSender, 'The receiver preview-state sender must remain available.')
assert.doesNotMatch(
  previewModeStateSender,
  /previewAudio|audioEnabled|soundMuted/i,
  'The local iPad sound preference must never be added to the receiver PreviewMode payload.'
)

const previewModeHandler = dynamicControlSource.match(
  /const setPreviewModeEnabled = \([\s\S]*?\n  const setStagePlaybackEnabled/
)?.[0]
assert.ok(previewModeHandler, 'The full-preview mode handler must remain available.')
assert.match(
  previewModeHandler,
  /if \(enabled\) {[\s\S]*?previewAudioEnabledRef\.current = false[\s\S]*?setBackgroundTransitionSoundMuted\(true\)[\s\S]*?previewModeRef\.current = false[\s\S]*?setBackgroundTransitionSoundMuted\(false\)/,
  'Full preview must default local transition sound off and restore it when preview exits.'
)
assert.match(
  dynamicControlSource,
  /const stageBackgroundVideoMuted = !\(previewMode && previewAudioEnabled\)/,
  'The stage background video must derive one shared full-preview mute state.'
)
assert.match(
  dynamicControlSource,
  /const video = stageBackgroundVideoRef\.current[\s\S]*?video\.muted = stageBackgroundVideoMuted[\s\S]*?\}, \[[^\]]*stageBackgroundVideoMuted[^\]]*\]\)/,
  'The background-video playback effect must apply and observe the shared mute state.'
)
assert.match(
  dynamicControlSource,
  /<video[\s\S]*?ref={stageBackgroundVideoRef}[\s\S]*?muted={stageBackgroundVideoMuted}[\s\S]*?className="dynamic-stage-background"/,
  'The rendered background video must use the same mute state as its playback effect.'
)

assert.match(
  dynamicControlSource,
  /const visualFrameSize = isDynamicMediaItem\(item\) \? compositorSize : itemPreviewSize/,
  'Media objects must use the minimum compositor surface while bubble objects preserve their measured preview size.'
)
assert.match(
  dynamicControlSource,
  /className="dynamic-stage-item-visual-frame"[\s\S]*?width: `\$\{visualFrameSize\.width}px`[\s\S]*?height: `\$\{visualFrameSize\.height}px`/,
  'The selected media-or-bubble visual frame size must reach the rendered compositor element.'
)

assert.match(
  indexCss,
  /\.dynamic-control-screen:is\(\.dynamic-previewing, \.dynamic-stage-playing\) \.dynamic-stage-item-user-transform\s*{(?=[^}]*backface-visibility:\s*visible;)(?=[^}]*-webkit-backface-visibility:\s*visible;)(?=[^}]*will-change:\s*auto;)[^}]*}/,
  'Preview and current-stage playback must stop forcing a hidden backface or permanent user-transform layer.'
)
assert.match(
  indexCss,
  /\.dynamic-control-screen:is\(\.dynamic-previewing, \.dynamic-stage-playing\) \.dynamic-stage-item-visual\s*{(?=[^}]*filter:\s*none;)(?=[^}]*backface-visibility:\s*visible;)(?=[^}]*-webkit-backface-visibility:\s*visible;)[^}]*}/,
  'Preview and current-stage playback must remove image filters and hidden backfaces from transparent media.'
)
assert.match(
  indexCss,
  /\.dynamic-control-screen:is\(\.dynamic-previewing, \.dynamic-stage-playing\) :is\(\s*\.dynamic-stage-item-walk,\s*\.dynamic-stage-item-unity\s*\)\s*{[^}]*transition:\s*none;[^}]*}/,
  'Walk and Unity canvases must not expose an 80ms transparent transition during local playback.'
)
assert.match(
  indexCss,
  /\.dynamic-control-screen:is\(\.dynamic-previewing, \.dynamic-stage-playing\) \.dynamic-stage-item-unity\s*{(?=[^}]*max-width:\s*none;)(?=[^}]*max-height:\s*none;)[^}]*}/,
  'Unity canvas overscan must not be clamped by the generic media max-size rule during playback.'
)
assert.match(
  indexCss,
  /\.dynamic-control-screen:is\(\.dynamic-previewing, \.dynamic-stage-playing\) \.dynamic-stage-item-motion\.move-none \.dynamic-stage-item-wave\s*{[^}]*will-change:\s*auto;[^}]*}/,
  'Static playback waves must not reserve another unnecessary compositor layer.'
)

assert.match(
  dynamicControlSource,
  /const handleCanvasFrameUnavailable = useCallback\(\(\) => setAnimatedCanvasReady\(false\), \[\]\)/,
  'A lost animation canvas frame must immediately restore the original media image.'
)
assert.equal(
  (dynamicControlSource.match(/onFrameUnavailable={handleCanvasFrameUnavailable}/g) ?? []).length,
  2,
  'Both Walk and Unity canvas renderers must report unavailable frames back to media readiness.'
)
const dynamicStageMediaSource = dynamicControlSource.match(
  /const DynamicStageMedia: React\.FC<DynamicStageMediaProps> = \([\s\S]*?\nconst DynamicStageMotion:/
)?.[0]
assert.ok(dynamicStageMediaSource, 'The shared dynamic-stage media renderer must remain available.')
assert.match(
  dynamicStageMediaSource,
  /const \[canvasSource, setCanvasSource\] = useState<[\s\S]*?const handleImageLoad = \(image: HTMLImageElement\) => {[\s\S]*?setCanvasSource\({ src, image }\)[\s\S]*?onImageLoad\(mediaId, image\)/,
  'The stage must retain its already decoded DOM image as the canvas animation source.'
)
assert.equal(
  (dynamicStageMediaSource.match(/sourceImage={canvasSource\?\.src === src \? canvasSource\.image : null}/g) ?? []).length,
  2,
  'Both Walk and Unity stage canvases must receive the already loaded DOM image.'
)
assert.doesNotMatch(
  dynamicStageMediaSource,
  /new Image\(|acquireCanvasImage/,
  'Stage playback must not start a second image decode for canvas animations.'
)
assert.match(
  canvasRenderSupportSource,
  /const MIN_VISIBLE_ALPHA_SAMPLES = 4[\s\S]*?const MIN_VISIBLE_ALPHA_TOTAL = 128[\s\S]*?const canvasHasVisibleAlpha = \(sourceCanvas: HTMLCanvasElement\) => {[\s\S]*?getImageData\([\s\S]*?let visibleSamples = 0[\s\S]*?let alphaTotal = 0[\s\S]*?visibleSamples \+= 1[\s\S]*?alphaTotal \+= alpha[\s\S]*?visibleSamples >= MIN_VISIBLE_ALPHA_SAMPLES[\s\S]*?alphaTotal >= MIN_VISIBLE_ALPHA_TOTAL/,
  'Canvas readiness must require multiple visible samples and a minimum total alpha value.'
)
assert.doesNotMatch(
  canvasRenderSupportSource,
  /if \(pixels\[index\] > 0\) return true/,
  'Canvas readiness must not accept one isolated non-transparent probe pixel.'
)
assert.match(
  canvasRenderSupportSource,
  /export { acquireCanvasImage, canvasHasVisibleAlpha }/,
  'The shared visible-alpha probe must remain available to both canvas animation renderers.'
)

for (const [rendererName, rendererSource] of [
  ['Walk', walkAnimationCanvasSource],
  ['Unity', unityAnimationCanvasSource]
]) {
  assert.match(
    rendererSource,
    /sourceImage\?: HTMLImageElement \| null[\s\S]*?if \(sourceImage !== undefined\) {[\s\S]*?sourceImage\.naturalWidth > 0 && sourceImage\.naturalHeight > 0[\s\S]*?useImage\(sourceImage\)[\s\S]*?const imageLease = acquireCanvasImage\(src\)/,
    `${rendererName} canvas must reuse a provided DOM image and reserve the shared lease for standalone callers.`
  )
  assert.match(
    rendererSource,
    /const bitmapScale = resolveCanvasBitmapScale\({[\s\S]*?sourceWidth: source\?\.naturalWidth,[\s\S]*?sourceHeight: source\?\.naturalHeight[\s\S]*?const bitmapWidth = Math\.max\(1, Math\.round\(width \* bitmapScale\.x\)\)[\s\S]*?const bitmapHeight = Math\.max\(1, Math\.round\(height \* bitmapScale\.y\)\)/,
    `${rendererName} canvas must size each bitmap axis from the source image's natural dimensions.`
  )
  assert.match(
    rendererSource,
    /sizeRef\.current = { width, height, scaleX: bitmapScale\.x, scaleY: bitmapScale\.y }[\s\S]*?const { width, height, scaleX, scaleY } = sizeRef\.current[\s\S]*?context\.setTransform\(scaleX, 0, 0, scaleY, 0, 0\)/,
    `${rendererName} canvas must preserve and apply independent horizontal and vertical bitmap scales.`
  )
  assert.match(
    rendererSource,
    /const invalidateFirstFrame = useCallback\(\(\) => {[\s\S]*?const wasReady = firstFrameDrawnRef\.current[\s\S]*?if \(wasReady\) {[\s\S]*?onFrameUnavailableRef\.current\?\.\(\)/,
    `${rendererName} canvas must notify its parent when a previously visible frame becomes unavailable.`
  )
  assert.match(
    rendererSource,
    /canvas\.addEventListener\('contextlost', handleContextLost\)[\s\S]*?canvas\.addEventListener\('contextrestored', handleContextRestored\)[\s\S]*?removeEventListener\('contextlost', handleContextLost\)[\s\S]*?removeEventListener\('contextrestored', handleContextRestored\)/,
    `${rendererName} canvas must recover readiness across WebKit canvas-context loss and restoration.`
  )
  assert.match(
    rendererSource,
    /const MAX_CANVAS_REBUILD_ATTEMPTS = 2[\s\S]*?const requestCanvasRebuild = useCallback\(\(\) => {[\s\S]*?canvasRebuildAttemptsRef\.current >= MAX_CANVAS_REBUILD_ATTEMPTS[\s\S]*?canvasRebuildAttemptsRef\.current \+= 1[\s\S]*?setCanvasGeneration\(\(current\) => current \+ 1\)/,
    `${rendererName} canvas must cap automatic DOM-canvas rebuilds at two attempts.`
  )
  assert.match(
    rendererSource,
    /const handleContextLost = \(event: Event\) => {[\s\S]*?contextLostRef\.current = true[\s\S]*?invalidateFirstFrame\(\)[\s\S]*?requestCanvasRebuild\(\)[\s\S]*?<canvas\s*key={canvasGeneration}/,
    `${rendererName} canvas must request a keyed DOM-canvas replacement after context loss.`
  )
  assert.match(
    rendererSource,
    /if \(!context \|\| recoverableContext\.isContextLost\?\.\(\)\) {[\s\S]*?invalidateFirstFrame\(\)[\s\S]*?requestCanvasRebuild\(\)[\s\S]*?} catch {[\s\S]*?invalidateFirstFrame\(\)[\s\S]*?requestCanvasRebuild\(\)/,
    `${rendererName} canvas must rebuild after null or lost contexts and after draw exceptions.`
  )
  assert.equal(
    (rendererSource.match(/requestCanvasRebuild\(\)/g) ?? []).length,
    3,
    `${rendererName} canvas must request rebuilds only from context loss, unavailable contexts, and draw failures.`
  )
  assert.match(
    rendererSource,
    /const FIRST_FRAME_VALIDATION_INTERVAL = 2[\s\S]*?const FIRST_FRAME_VALIDATION_ATTEMPTS = 8[\s\S]*?const FIRST_FRAME_VISIBLE_STREAK = 2/,
    `${rendererName} canvas must use bounded, spaced, consecutive visible-frame validation.`
  )
  assert.match(
    rendererSource,
    /firstFrameValidationAttemptsRef\.current >= FIRST_FRAME_VALIDATION_ATTEMPTS[\s\S]*?firstFrameValidationFramesRef\.current \+= 1[\s\S]*?firstFrameValidationFramesRef\.current % FIRST_FRAME_VALIDATION_INTERVAL !== 0[\s\S]*?firstFrameValidationAttemptsRef\.current \+= 1[\s\S]*?if \(canvasHasVisibleAlpha\(canvas\)\) {[\s\S]*?firstFrameVisibleStreakRef\.current \+= 1[\s\S]*?firstFrameVisibleStreakRef\.current = 0[\s\S]*?firstFrameVisibleStreakRef\.current >= FIRST_FRAME_VISIBLE_STREAK[\s\S]*?canvasRebuildAttemptsRef\.current = 0[\s\S]*?firstFrameDrawnRef\.current = true[\s\S]*?onFirstFrameRef\.current\?\.\(\)/,
    `${rendererName} canvas must require two consecutive visible probes and reset rebuild attempts after a valid frame.`
  )
  assert.doesNotMatch(
    rendererSource,
    /firstFrameValidationAttemptedRef/,
    `${rendererName} canvas must not regress to a single arbitrary first-frame probe.`
  )
}

assert.match(
  canvasRenderQualitySource,
  /const IOS_MAX_CANVAS_PIXEL_RATIO = 2[\s\S]*?const IOS_MAX_CANVAS_BITMAP_PIXELS = 4 \* 1024 \* 1024[\s\S]*?const IOS_MAX_CANVAS_BITMAP_EDGE = 3072[\s\S]*?const MIN_MESH_AXIS_BITMAP_PIXELS = 12[\s\S]*?const MAX_MESH_AXIS_SCALE_MULTIPLIER = 12/,
  'iPad bitmap scaling must target a 12-pixel mesh axis within its multiplier, 4MP, and 3072-edge budgets.'
)
assert.match(
  canvasRenderQualitySource,
  /const resolveCanvasBitmapScale = \({[\s\S]*?const containScale = Math\.min\([\s\S]*?const containedWidth = sourceWidth \* containScale[\s\S]*?const containedHeight = sourceHeight \* containScale[\s\S]*?MIN_MESH_AXIS_BITMAP_PIXELS \/ Math\.max\(Number\.EPSILON, containedWidth\)[\s\S]*?MIN_MESH_AXIS_BITMAP_PIXELS \/ Math\.max\(Number\.EPSILON, containedHeight\)/,
  'Bitmap scaling must derive independent axis boosts from the contained source dimensions.'
)
assert.match(
  canvasRenderQualitySource,
  /baseScale \* MAX_MESH_AXIS_SCALE_MULTIPLIER[\s\S]*?baseScale \* MAX_MESH_AXIS_SCALE_MULTIPLIER[\s\S]*?scaleX = Math\.min\(scaleX, maxBitmapEdge \/ safeWidth\)[\s\S]*?scaleY = Math\.min\(scaleY, maxBitmapEdge \/ safeHeight\)[\s\S]*?if \(bitmapPixels > maxBitmapPixels\) {[\s\S]*?Math\.sqrt\(maxBitmapPixels \/ bitmapPixels\)[\s\S]*?scaleX \*= budgetScale[\s\S]*?scaleY \*= budgetScale/,
  'Axis boosts must remain constrained by the multiplier, device edge, and total bitmap-pixel budgets.'
)
assert.match(
  canvasRenderQualitySource,
  /export { resolveCanvasBitmapScale, resolveCanvasPixelRatio }/,
  'The independent-axis bitmap scale resolver must remain exported for animation canvases.'
)
assert.equal(
  (walkAnimationCanvasSource.match(/resolveCanvasBitmapScale\(/g) ?? []).length,
  1,
  'Walk canvas must use the independent-axis bitmap scale resolver.'
)
assert.equal(
  (unityAnimationCanvasSource.match(/resolveCanvasBitmapScale\(/g) ?? []).length,
  1,
  'Unity canvas must use the independent-axis bitmap scale resolver.'
)
assert.match(
  unityAnimationCanvasSource,
  /resolveCanvasBitmapScale\({[\s\S]*?contentWidth: width \/ Math\.max\(1, overscanX\),[\s\S]*?contentHeight: height \/ Math\.max\(1, overscanY\)[\s\S]*?const contentWidth = width \/ Math\.max\(1, overscanX\)[\s\S]*?const contentHeight = height \/ Math\.max\(1, overscanY\)[\s\S]*?drawUnityAnimationImage\([\s\S]*?contentWidth,[\s\S]*?contentHeight/,
  'Unity must calculate bitmap scale and drawing geometry from the same overscan-adjusted content size.'
)

assert.match(
  dynamicControlSource,
  /className={`dynamic-stage-item-motion move-\$\{motionMode\}[^`]*`}\s*style={style}[\s\S]*?className={`dynamic-stage-item-entry \$\{stageEntering \? 'is-stage-entering' : ''\}`}[\s\S]*?--stage-entry-delay/,
  'Stage entry animation must run on an inner wrapper while the outer motion layer retains positioning styles.'
)
assert.doesNotMatch(
  dynamicControlSource,
  /dynamic-stage-item-motion move-\$\{motionMode\}[^`]*\$\{stageEntering \? 'is-stage-entering'/,
  'The stage-entry class must never return to the center-positioning motion layer.'
)
assert.match(
  indexCss,
  /\.dynamic-stage-item-motion\s*{(?=[^}]*transform:\s*translate\(-50%, -50%\);)[^}]*}/,
  'The stage motion layer must preserve center-based positioning.'
)
assert.match(
  indexCss,
  /\.dynamic-control-screen \.dynamic-stage-item-entry\s*{(?=[^}]*width:\s*100%;)(?=[^}]*height:\s*100%;)(?=[^}]*display:\s*grid;)(?=[^}]*place-items:\s*center;)[^}]*}[\s\S]*?\.dynamic-control-screen \.dynamic-stage-item-entry\.is-stage-entering\s*{[^}]*animation:\s*dynamic-control-stage-item-enter/,
  'The dedicated stage-entry wrapper must carry the entrance animation without replacing outer positioning transforms.'
)
assert.doesNotMatch(
  indexCss,
  /\.dynamic-control-screen \.dynamic-stage-item-motion\.is-stage-entering/,
  'CSS must not animate the same transform used to center stage objects.'
)

console.log('Dynamic creation flow verification passed.')
