import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildGroupSyncPayload,
  getGroupAssetSignature,
  getGroupSyncSignature,
  snapshotDynamicGroupForSync
} from '../src/services/dynamicArtReceiverSync.ts'
import { makeDynamicEventMessage } from '../src/services/unityBridge.ts'
import {
  DYNAMIC_GROUPS_KEY,
  loadDynamicGroups
} from '../src/services/dynamicArtStorage.ts'

const now = 1_700_000_000_000
const background = {
  id: 'background-1',
  name: 'Stage',
  type: 'image',
  mimeType: 'image/png',
  url: 'data:image/png;base64,stage',
  width: 1920,
  height: 1080,
  backgroundTransition: 'curtain',
  updatedAt: now
}
const media = {
  id: 'media-1',
  name: 'Object',
  type: 'image',
  mimeType: 'image/png',
  url: 'data:image/png;base64,object',
  width: 640,
  height: 480,
  updatedAt: now
}
const item = {
  id: 'item-1',
  kind: 'media',
  name: 'Object',
  media,
  position: { x: 0.4, y: 0.6 },
  gridIndex: 76,
  scale: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
  animationMode: 'fixed',
  animationId: 2,
  clickAnimationIds: [1, 2, 3],
  moveMode: 'right',
  movePercent: 45,
  moveSpeed: 60,
  moveTrack: 'middle',
  targetMode: 'target',
  targetPosition: { x: 0.8, y: 0.3 },
  targetLoop: false,
  audioId: 'audio-1',
  audioTrigger: 'appearanceDelay',
  audioDelayMs: 1200,
  backgroundIds: ['background-1'],
  isVisible: true,
  order: 0,
  createdAt: now,
  updatedAt: now
}
const bubbleItem = {
  id: 'bubble-1',
  kind: 'bubble',
  name: 'Dialogue',
  position: { x: 0.55, y: 0.45 },
  gridIndex: 71,
  scale: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
  animationMode: 'none',
  animationId: 0,
  clickAnimationIds: [1, 2, 3],
  moveMode: 'none',
  movePercent: 50,
  moveSpeed: 50,
  moveTrack: 'middle',
  targetMode: 'loop',
  targetLoop: false,
  audioTrigger: 'appearance',
  audioDelayMs: 0,
  backgroundIds: ['background-1'],
  isVisible: true,
  order: 1,
  createdAt: now,
  updatedAt: now,
  bubble: {
    schemaVersion: 2,
    bubbleType: 'dialogue',
    styleId: 'dialogue-rounded-right',
    title: '',
    bodyText: 'Hello',
    revealMode: 'all',
    revealIntervalMs: 80,
    fontSizePx: 52,
    textColor: '#172033',
    surfaceColor: '#fffef6',
    outlineColor: '#3b9089',
    surfaceId: 'light',
    titleMaskId: 'rounded',
    paletteId: 'ocean',
    maskColor: '#0c8fa4',
    maskOpacity: 0.92,
    widthPx: 1080,
    heightPx: 480
  }
}
const group = {
  id: 'group-1',
  name: 'Sync fixture',
  background,
  backgrounds: [background],
  activeBackgroundId: background.id,
  backgroundPlayMode: 'sequence',
  backgroundIntervalMs: 4500,
  backgroundTransition: 'curtain',
  appearMode: 'sequence',
  appearIntervalMs: 750,
  appearAnimation: 'trackSlide',
  audioLibrary: [{
    id: 'audio-1',
    name: 'Effect',
    type: 'audio',
    mimeType: 'audio/mpeg',
    url: 'data:audio/mpeg;base64,effect',
    durationMs: 3200,
    updatedAt: now
  }],
  linkedAppearanceModelVersion: 3,
  items: [item, bubbleItem],
  createdAt: now,
  updatedAt: now
}

const storageValues = new Map()
globalThis.localStorage = {
  getItem: (key) => storageValues.get(key) ?? null,
  setItem: (key, value) => storageValues.set(key, String(value)),
  removeItem: (key) => storageValues.delete(key),
  clear: () => storageValues.clear(),
  key: (index) => [...storageValues.keys()][index] ?? null,
  get length() { return storageValues.size }
}

const {
  surfaceColor: _legacySurfaceColor,
  outlineColor: _legacyOutlineColor,
  ...legacyBubbleContent
} = bubbleItem.bubble
const legacyStyleCases = [
  ['dialogue-rounded-left', 'dialogue-rounded-left', '#fffef6', '#3b9089'],
  ['dialogue-soft-right', 'dialogue-soft-right', '#e9f8f5', '#84b7c0'],
  ['dialogue-comic-left', 'dialogue-comic-left', '#1f3635', '#d9e3df'],
  ['thought-soft-left', 'thought-cloud-left', '#fffffd', '#6c9fa0'],
  ['thought-soft-right', 'thought-cloud-right', '#fffffd', '#6c9fa0']
]
const legacyGroup = {
  ...group,
  id: 'legacy-group',
  linkedAppearanceModelVersion: undefined,
  background: undefined,
  backgrounds: [],
  activeBackgroundId: undefined,
  audioLibrary: [],
  items: legacyStyleCases.map(([legacyStyleId], index) => ({
    ...bubbleItem,
    id: `legacy-bubble-${index}`,
    order: index,
    bubble: {
      ...legacyBubbleContent,
      schemaVersion: 1,
      bubbleType: legacyStyleId.startsWith('thought-') ? 'thought' : 'dialogue',
      styleId: legacyStyleId
    }
  }))
}
storageValues.set(DYNAMIC_GROUPS_KEY, JSON.stringify([legacyGroup]))
const [migratedLegacyGroup] = await loadDynamicGroups()
legacyStyleCases.forEach(([, expectedStyleId, expectedSurfaceColor, expectedOutlineColor], index) => {
  const bubble = migratedLegacyGroup.items[index].bubble
  assert.equal(bubble.schemaVersion, 2)
  assert.equal(bubble.styleId, expectedStyleId)
  assert.equal(bubble.surfaceColor, expectedSurfaceColor)
  assert.equal(bubble.outlineColor, expectedOutlineColor)
})
const [persistedLegacyGroup] = JSON.parse(storageValues.get(DYNAMIC_GROUPS_KEY))
assert.ok(persistedLegacyGroup.items.every(({ bubble }) => bubble.schemaVersion === 2))

const makeRelationItem = (id, name, linkedAppearance, order) => ({
  ...item,
  id,
  name,
  media: { ...media, id: `media-${id}` },
  linkedAppearance,
  order
})

const currentRelationGroup = {
  ...group,
  id: 'current-relation-group-number',
  linkedAppearanceModelVersion: 3,
  items: [
    makeRelationItem('current-source', 'Current source', undefined, 0),
    makeRelationItem(
      'current-target',
      'Current target',
      { triggerItemId: 'current-source', mode: 'showAfter', delayMs: 300 },
      1
    )
  ]
}
const currentRelationGroups = [
  currentRelationGroup,
  {
    ...currentRelationGroup,
    id: 'current-relation-group-string',
    linkedAppearanceModelVersion: '3'
  }
]
storageValues.set(DYNAMIC_GROUPS_KEY, JSON.stringify(currentRelationGroups))
const loadedCurrentRelationGroups = await loadDynamicGroups()
loadedCurrentRelationGroups.forEach((loadedGroup) => {
  assert.equal(loadedGroup.linkedAppearanceModelVersion, 3)
  assert.equal(loadedGroup.items[0].linkedAppearance, undefined)
  assert.deepEqual(loadedGroup.items[1].linkedAppearance, {
    triggerItemId: 'current-source',
    mode: 'showAfter',
    delayMs: 300
  })
})

const legacyRelationGroup = {
  ...group,
  id: 'legacy-relation-group',
  linkedAppearanceModelVersion: undefined,
  items: [
    makeRelationItem(
      'legacy-source',
      'Legacy source',
      { triggerItemId: 'legacy-target', mode: 'hideAfter', delayMs: 450 },
      0
    ),
    makeRelationItem('legacy-target', 'Legacy target', undefined, 1)
  ]
}
storageValues.set(DYNAMIC_GROUPS_KEY, JSON.stringify([legacyRelationGroup]))
const [migratedLegacyRelationGroup] = await loadDynamicGroups()
assert.equal(migratedLegacyRelationGroup.linkedAppearanceModelVersion, 3)
assert.equal(migratedLegacyRelationGroup.items[0].linkedAppearance, undefined)
assert.deepEqual(migratedLegacyRelationGroup.items[1].linkedAppearance, {
  triggerItemId: 'legacy-source',
  mode: 'hideAfter',
  delayMs: 450
})

const futureRelationGroup = {
  ...currentRelationGroup,
  id: 'future-relation-group',
  linkedAppearanceModelVersion: 4,
  items: currentRelationGroup.items.map((nextItem) => (
    nextItem.id === 'current-target'
      ? {
          ...nextItem,
          id: 'future-target',
          linkedAppearance: {
            ...nextItem.linkedAppearance,
            triggerItemId: 'future-source',
            futureToken: 'preserve-me'
          }
        }
      : { ...nextItem, id: 'future-source' }
  ))
}
storageValues.set(DYNAMIC_GROUPS_KEY, JSON.stringify([futureRelationGroup]))
const [loadedFutureRelationGroup] = await loadDynamicGroups()
assert.equal(loadedFutureRelationGroup.linkedAppearanceModelVersion, 4)
assert.equal(loadedFutureRelationGroup.items[1].linkedAppearance?.triggerItemId, 'future-source')
const [persistedFutureRelationGroup] = JSON.parse(storageValues.get(DYNAMIC_GROUPS_KEY))
assert.equal(persistedFutureRelationGroup.linkedAppearanceModelVersion, 4)
assert.equal(persistedFutureRelationGroup.items[1].linkedAppearance.triggerItemId, 'future-source')
assert.equal(persistedFutureRelationGroup.items[1].linkedAppearance.futureToken, 'preserve-me')

const payload = buildGroupSyncPayload(group, false, true)
assert.equal(payload.advancedFeaturesEnabled, true)
assert.equal(payload.watermarkEnabled, true)
assert.equal(payload.stateRevision, group.updatedAt)
assert.ok(payload.selectionRevision > 0)
assert.equal(payload.items[0].scale, 1)
assert.deepEqual(payload.items[0].targetPosition, { x: 0.8, y: 0.3 })
assert.equal(
  buildGroupSyncPayload({ ...group, items: [{ ...item, isVisible: false }] }).items[0].isVisible,
  false,
  'Hidden object state must reach the EXE receiver.'
)
assert.equal(
  buildGroupSyncPayload({ ...group, items: [{ ...item, isVisible: true }] }).items[0].isVisible,
  true,
  'Explicitly visible object state must reach the EXE receiver.'
)
assert.equal(
  buildGroupSyncPayload({
    ...group,
    items: [{ ...item, isVisible: undefined }]
  }).items[0].isVisible,
  true,
  'Items without a visibility field must be sent as visible.'
)
const refreshedDesktopItem = {
  ...payload.items[0],
  isVisible: false,
  ...buildGroupSyncPayload({
    ...group,
    items: [{ ...item, isVisible: true }]
  }).items[0]
}
assert.equal(
  refreshedDesktopItem.isVisible,
  true,
  'A full-state payload must overwrite stale hidden state in the desktop cache.'
)
assert.equal(payload.items[1].bubble.schemaVersion, 2)
assert.equal(payload.items[1].bubble.surfaceColor, '#fffef6')
assert.equal(payload.items[1].bubble.outlineColor, '#3b9089')
assert.equal(payload.backgroundTransition, 'curtain')
assert.equal(payload.backgroundIntervalMs, 4500)

const baseSignature = getGroupSyncSignature(group)
const baseAssetSignature = getGroupAssetSignature(group)
const queuedSource = snapshotDynamicGroupForSync(group)
const queuedSnapshot = snapshotDynamicGroupForSync(queuedSource)
const queuedSnapshotSignature = getGroupSyncSignature(queuedSnapshot)
const queuedSnapshotAssetSignature = getGroupAssetSignature(queuedSnapshot)
queuedSource.items[0].position.x = 0.12
queuedSource.items[0].targetPosition.y = 0.91
queuedSource.items[0].linkedAppearance = {
  triggerItemId: 'new-trigger',
  mode: 'showAfter',
  delayMs: 999
}
queuedSource.items[0].media.updatedAt = now + 10
queuedSource.backgrounds[0].backgroundTransition = 'cameraFlash'
queuedSource.audioLibrary[0].name = 'Changed after enqueue'
queuedSource.items[1].bubble.bodyText = 'Changed after enqueue'
assert.equal(
  getGroupSyncSignature(queuedSnapshot),
  queuedSnapshotSignature,
  'Queued sync snapshots must keep animation/motion/linkage state stable.'
)
assert.equal(
  getGroupAssetSignature(queuedSnapshot),
  queuedSnapshotAssetSignature,
  'Queued sync snapshots must keep asset metadata stable.'
)
assert.equal(queuedSnapshot.items[0].position.x, 0.4)
assert.equal(queuedSnapshot.items[0].targetPosition.y, 0.3)
assert.equal(queuedSnapshot.items[1].bubble.bodyText, 'Hello')
assert.equal(queuedSnapshot.backgrounds[0].backgroundTransition, 'curtain')
assert.equal(queuedSnapshot.audioLibrary[0].name, 'Effect')
assert.equal(queuedSnapshot.items[0].media.updatedAt, now)
assert.notEqual(
  getGroupSyncSignature({
    ...group,
    items: [{ ...item, scale: 1.25 }]
  }),
  baseSignature,
  'Changing an object scale must trigger a complete receiver sync.'
)

const parseEventPayload = (message) => JSON.parse(message.split('|').slice(3).join('|'))
const firstMotionPayload = parseEventPayload(makeDynamicEventMessage('ItemMotion', {
  groupId: group.id,
  itemId: item.id,
  mode: 'right'
}))
const secondMotionPayload = parseEventPayload(makeDynamicEventMessage('ItemMotion', {
  groupId: group.id,
  itemId: item.id,
  mode: 'left'
}))
assert.ok(
  secondMotionPayload.stateRevision > firstMotionPayload.stateRevision,
  'State revisions must be strictly monotonic even for same-millisecond edits.'
)
const explicitRevisionPayload = parseEventPayload(makeDynamicEventMessage('GroupStateSync', {
  groupId: group.id,
  stateRevision: secondMotionPayload.stateRevision,
  selectionRevision: payload.selectionRevision
}))
assert.equal(explicitRevisionPayload.stateRevision, secondMotionPayload.stateRevision)
assert.equal(explicitRevisionPayload.selectionRevision, payload.selectionRevision)
const sharedRevisionPayload = buildGroupSyncPayload(
  group,
  false,
  true,
  { stateRevision: 9001, selectionRevision: 9002 }
)
assert.equal(sharedRevisionPayload.stateRevision, 9001)
assert.equal(sharedRevisionPayload.selectionRevision, 9002)
assert.equal(
  getGroupAssetSignature({
    ...group,
    items: [{ ...item, scale: 1.25 }]
  }),
  baseAssetSignature,
  'Changing an object scale must not re-upload unchanged media.'
)
assert.notEqual(
  getGroupSyncSignature({
    ...group,
    items: [{ ...item, position: { x: 0.5, y: 0.5 } }]
  }),
  baseSignature,
  'Changing an object position must trigger a complete receiver sync.'
)
assert.notEqual(
  getGroupSyncSignature({
    ...group,
    backgroundIntervalMs: 5200
  }),
  baseSignature,
  'Changing timeline timing must trigger a complete receiver sync.'
)
assert.notEqual(
  getGroupSyncSignature({
    ...group,
    backgroundTransition: 'cameraFlash'
  }),
  baseSignature,
  'Changing the global background transition must trigger a complete receiver sync.'
)
assert.notEqual(
  getGroupSyncSignature({
    ...group,
    audioLibrary: [{ ...group.audioLibrary[0], durationMs: 4100 }]
  }),
  baseSignature,
  'Changing cached audio duration must update receiver metadata.'
)
assert.equal(
  getGroupAssetSignature({
    ...group,
    audioLibrary: [{ ...group.audioLibrary[0], durationMs: 4100 }]
  }),
  baseAssetSignature,
  'Changing cached audio duration must not re-upload the same audio bytes.'
)
const recoloredBubbleItem = {
  ...bubbleItem,
  bubble: {
    ...bubbleItem.bubble,
    surfaceColor: '#ffe3a3'
  }
}
assert.notEqual(
  getGroupSyncSignature({
    ...group,
    items: [item, recoloredBubbleItem]
  }),
  baseSignature,
  'Changing a bubble surface color must trigger a complete receiver sync.'
)
assert.equal(
  getGroupAssetSignature({
    ...group,
    items: [item, recoloredBubbleItem]
  }),
  baseAssetSignature,
  'Changing a bubble surface color must not re-upload unchanged media.'
)
const reoutlinedBubbleItem = {
  ...bubbleItem,
  bubble: {
    ...bubbleItem.bubble,
    outlineColor: '#7a5120'
  }
}
assert.notEqual(
  getGroupSyncSignature({
    ...group,
    items: [item, reoutlinedBubbleItem]
  }),
  baseSignature,
  'Changing a bubble outline color must trigger a complete receiver sync.'
)
assert.equal(
  getGroupAssetSignature({
    ...group,
    items: [item, reoutlinedBubbleItem]
  }),
  baseAssetSignature,
  'Changing a bubble outline color must not re-upload unchanged media.'
)
assert.notEqual(
  getGroupAssetSignature({
    ...group,
    items: [{
      ...item,
      media: { ...media, updatedAt: now + 1 }
    }]
  }),
  baseAssetSignature,
  'Changing a media file must trigger an asset upload.'
)

const storageSource = readFileSync(new URL('../src/services/dynamicArtStorage.ts', import.meta.url), 'utf8')
const getFunctionBody = (name, nextName) => {
  const start = storageSource.indexOf(`const ${name} =`)
  const end = nextName ? storageSource.indexOf(`\nconst ${nextName} =`, start) : storageSource.length
  assert.ok(start >= 0, `Storage function ${name} must remain present.`)
  return storageSource.slice(start, end >= 0 ? end : storageSource.length)
}

for (const [name, nextName, persistToken] of [
  ['setDynamicBackground', 'setActiveDynamicBackground', 'await persistDynamicMedia'],
  ['addDynamicItem', 'updateDynamicItemMeta', 'await persistDynamicMedia'],
  ['addDynamicBubble', 'updateDynamicBubble', 'await persistDynamicMedia'],
  ['updateDynamicBubble', 'updateDynamicItem', 'await persistDynamicMedia'],
  ['addDynamicAudio', 'setDynamicBackgroundBgm', 'await persistDynamicAudio']
]) {
  const body = getFunctionBody(name, nextName)
  const persistIndex = body.indexOf(persistToken)
  const loadIndex = body.indexOf('const groups = loadRawGroups()')
  assert.ok(persistIndex >= 0 && loadIndex > persistIndex, `${name} must load the latest group after media persistence.`)
}

for (const [name, nextName] of [
  ['deleteDynamicGroup', 'upsertDynamicGroup'],
  ['deleteDynamicBackgrounds', 'reorderDynamicBackgrounds'],
  ['deleteDynamicItems', 'deleteDynamicItem']
]) {
  const body = getFunctionBody(name, nextName)
  const saveIndex = body.indexOf('saveDynamicGroups(')
  const cleanupIndex = body.lastIndexOf('deleteDynamicMedia')
  assert.ok(saveIndex >= 0 && cleanupIndex > saveIndex, `${name} must persist the structural deletion before file cleanup.`)
}

console.log('Dynamic receiver sync verification passed.')
