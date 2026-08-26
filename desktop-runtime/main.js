const { app, BrowserWindow, ipcMain } = require('electron')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const {
  DEFAULT_ITEM_SETTINGS_COPY_FIELDS,
  applyItemSettingsCopy
} = require('./renderer/item-settings-copy-core.cjs')
const {
  DEFAULT_WATERMARK_ENABLED,
  DESKTOP_ADVANCED_FEATURES_ENABLED,
  isWatermarkSettingsEvent,
  resolveWatermarkEnabled,
  resolveWatermarkEnabledForEvent
} = require('./runtime-display-settings-core.cjs')
const {
  isValidRevision,
  shouldApplyGroupStateRevision,
  shouldApplyGroupUploadSideEffect,
  shouldApplySelectionRevision
} = require('./group-state-revision-core.cjs')

const CONTROL_PORT = 8080
const MAX_BODY_BYTES = 512 * 1024 * 1024
const DEFAULT_GROUP_ID = 'default_group'
const VERTICAL_DISPLAY_FLIP = process.env.MAGICFLOOR_VERTICAL_FLIP === '1'

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

let mainWindow = null
let server = null
let dataDir = ''
let assetsDir = ''
let stateFile = ''
let dynamicEventSequence = 0
let lastDynamicEvent = null

const DYNAMIC_STATE_REVISION_EVENTS = new Set([
  'GroupCreate',
  'GroupUpdate',
  'GroupDelete',
  'GroupAppearMode',
  'GroupStateSync',
  'GroupSelectAndSync',
  'BackgroundSet',
  'BackgroundDelete',
  'BackgroundPlayback',
  'ItemCreate',
  'ItemUpdate',
  'ItemDelete',
  'ItemTransform',
  'ItemDeform',
  'ItemAnimation',
  'ItemMotion',
  'ItemSettingsCopy'
])
const DYNAMIC_SELECTION_EVENTS = new Set([
  'GroupSelect',
  'PreviewMode'
])
const DYNAMIC_FULL_STATE_EVENTS = new Set(['GroupStateSync', 'GroupSelectAndSync'])

const runtimeState = {
  activeGroupId: null,
  selectionRevision: 0,
  groupStateRevisions: {},
  groups: {},
  assets: {},
  watermarkEnabled: DEFAULT_WATERMARK_ENABLED,
  view: {
    mode: 'archive',
    mirror: {
      replayId: null,
      startedAt: 0,
      elapsedMs: 0,
      receivedAt: 0,
      capturedAt: 0,
      transition: 'none',
      width: 0,
      height: 0,
      snapshotDataUrl: '',
      source: {
        dataUrl: '',
        width: 0,
        height: 0,
        capturedAt: 0,
        origin: null
      }
    }
  },
  preview: {
    enabled: false,
    groupId: null,
    advancedFeaturesEnabled: DESKTOP_ADVANCED_FEATURES_ENABLED,
    appearMode: 'all',
    intervalMs: 800,
    backgroundPlayMode: 'fixed',
    backgroundIntervalMs: 5000,
    replayId: 0,
    startedAt: Date.now()
  },
  server: {
    status: 'starting',
    port: CONTROL_PORT,
    addresses: []
  }
}

const safeSegment = (value) => {
  return String(value || 'asset').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'asset'
}

const makeId = (prefix) => {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`
}

const normalizeAppearAnimation = (value) => (
  value === 'drop' || value === 'trackSlide' ? value : 'none'
)

const DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION = 4
const MAX_DYNAMIC_APPEARANCE_TIME_MS = 86400000
const APPEARANCE_FADE_DURATION_MS = 420

const normalizeAppearanceTime = (value, fallback = 0) => {
  const numericValue = Number(value)
  const numericFallback = Number(fallback)
  return Math.min(
    MAX_DYNAMIC_APPEARANCE_TIME_MS,
    Math.max(0, Math.round(
      Number.isFinite(numericValue)
        ? numericValue
        : Number.isFinite(numericFallback)
          ? numericFallback
          : 0
    ))
  )
}

const getAppearanceAnimationDuration = (value) => {
  if (value === 'drop') return 620
  if (value === 'trackSlide') return 560
  return APPEARANCE_FADE_DURATION_MS
}

const normalizeBackgroundTransition = (value, fallback = 'none') => (
  value === 'curtain' || value === 'cameraFlash' || value === 'shadowPlay' || value === 'none'
    ? value
    : fallback
)

const normalizeLinkedAppearance = (value, itemId, validItemIds) => {
  if (!value || typeof value !== 'object') return null
  const triggerItemId = String(value.triggerItemId ?? '').trim()
  const mode = value.mode === 'showAfter' || value.mode === 'hideAfter' ? value.mode : 'none'
  if (!triggerItemId || triggerItemId === itemId || mode === 'none') return null
  if (validItemIds && !validItemIds.has(triggerItemId)) return null
  return {
    triggerItemId,
    mode,
    delayMs: Math.min(600000, Math.max(0, Math.round(Number(value.delayMs) || 0)))
  }
}

const normalizeGroupItemLinks = (items = []) => {
  const validItemIds = new Set(items.map((item) => item.itemId).filter(Boolean))
  const nextItems = items.map((item) => ({
    ...item,
    linkedAppearance: normalizeLinkedAppearance(item.linkedAppearance, item.itemId, validItemIds)
  }))
  const linkByItemId = new Map(nextItems
    .filter((item) => item.linkedAppearance)
    .map((item) => [item.itemId, item.linkedAppearance]))

  const hasCycle = (itemId) => {
    const visited = new Set([itemId])
    let currentId = itemId
    while (linkByItemId.has(currentId)) {
      const triggerItemId = linkByItemId.get(currentId).triggerItemId
      if (visited.has(triggerItemId)) return true
      visited.add(triggerItemId)
      currentId = triggerItemId
    }
    return false
  }

  const validatedItems = nextItems.map((item) => ({
    ...item,
    linkedAppearance: item.linkedAppearance && !hasCycle(item.itemId)
      ? item.linkedAppearance
      : null
  }))

  const itemById = new Map(validatedItems.map((item) => [item.itemId, item]).filter(([itemId]) => itemId))
  const validLinkByItemId = new Map(validatedItems
    .filter((item) => item.linkedAppearance)
    .map((item) => [item.itemId, item.linkedAppearance]))
  const effectiveBackgroundIds = new Map()
  const normalizeBackgroundIds = (value) => (
    Array.isArray(value)
      ? Array.from(new Set(value.map((backgroundId) => String(backgroundId ?? '').trim()).filter(Boolean)))
      : []
  )
  const resolveBackgroundIds = (itemId, visited = new Set()) => {
    if (effectiveBackgroundIds.has(itemId)) return effectiveBackgroundIds.get(itemId)
    const item = itemById.get(itemId)
    if (!item) return []

    const ownBackgroundIds = normalizeBackgroundIds(item.backgroundIds)
    if (visited.has(itemId)) return ownBackgroundIds
    const link = validLinkByItemId.get(itemId)
    const resolvedIds = link && itemById.has(link.triggerItemId)
      ? resolveBackgroundIds(link.triggerItemId, new Set([...visited, itemId]))
      : ownBackgroundIds
    effectiveBackgroundIds.set(itemId, resolvedIds)
    return resolvedIds
  }

  return validatedItems.map((item) => (
    item.linkedAppearance
      ? { ...item, backgroundIds: [...resolveBackgroundIds(item.itemId)] }
      : item
  ))
}

const normalizeGroupItemLinksForModel = (group, items = []) => {
  const modelVersion = Number(group.linkedAppearanceModelVersion)
  if (Number.isFinite(modelVersion) && modelVersion >= DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION) {
    group.linkedAppearanceModelVersion = modelVersion
    return items.map((item) => ({
      ...item,
      appearanceDelayMs: item.appearanceDelayMs === null || item.appearanceDelayMs === undefined
        ? undefined
        : normalizeAppearanceTime(item.appearanceDelayMs),
      appearanceHideMs: item.appearanceHideMs === null || item.appearanceHideMs === undefined
        ? undefined
        : normalizeAppearanceTime(item.appearanceHideMs),
      hideAfterTarget: item.hideAfterTarget === true,
      linkedAppearance: null
    }))
  }

  let linkedItems = items
  if (!Number.isFinite(modelVersion) || modelVersion < 3) {
    const validItemIds = new Set(items.map((item) => item.itemId).filter(Boolean))
    linkedItems = items.map((item) => ({ ...item, linkedAppearance: null }))
    const targetIndexById = new Map(linkedItems.map((item, index) => [item.itemId, index]))

    items
      .map((sourceItem) => ({
        sourceItem,
        legacyLink: normalizeLinkedAppearance(
          sourceItem.linkedAppearance,
          sourceItem.itemId,
          validItemIds
        )
      }))
      .filter(({ legacyLink }) => legacyLink)
      .sort((left, right) => (
        (right.sourceItem.updatedAt ?? 0) - (left.sourceItem.updatedAt ?? 0)
        || (left.sourceItem.order ?? 0) - (right.sourceItem.order ?? 0)
      ))
      .forEach(({ sourceItem, legacyLink }) => {
        const targetIndex = targetIndexById.get(legacyLink.triggerItemId)
        if (targetIndex === undefined || linkedItems[targetIndex].linkedAppearance) return
        linkedItems[targetIndex] = {
          ...linkedItems[targetIndex],
          linkedAppearance: {
            triggerItemId: sourceItem.itemId,
            mode: legacyLink.mode,
            delayMs: legacyLink.delayMs
          }
        }
      })
  }

  const synchronizedItems = normalizeGroupItemLinks(linkedItems)
  const itemById = new Map(synchronizedItems.map((item) => [item.itemId, item]))
  const rootItems = synchronizedItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.linkedAppearance)
    .sort((left, right) => {
      const leftOrder = Number(left.item.order)
      const rightOrder = Number(right.item.order)
      const normalizedLeftOrder = Number.isFinite(leftOrder) ? leftOrder : 0
      const normalizedRightOrder = Number.isFinite(rightOrder) ? rightOrder : 0
      return normalizedLeftOrder - normalizedRightOrder || left.index - right.index
    })
    .map(({ item }) => item)
  const rootIndexById = new Map(rootItems.map((item, index) => [item.itemId, index]))
  const numericAppearIntervalMs = Number(group.appearIntervalMs)
  const normalizedAppearIntervalMs = Math.min(
    5000,
    Math.max(
      100,
      Number.isFinite(numericAppearIntervalMs)
        ? Math.round(numericAppearIntervalMs)
        : 800
    )
  )
  const schedules = new Map()
  const resolveSchedule = (itemId, visiting = new Set()) => {
    if (schedules.has(itemId)) return schedules.get(itemId)
    const item = itemById.get(itemId)
    if (!item || visiting.has(itemId)) return null
    const explicitDelay = item.appearanceDelayMs === null || item.appearanceDelayMs === undefined
      ? null
      : normalizeAppearanceTime(item.appearanceDelayMs)
    const explicitHide = item.appearanceHideMs === null || item.appearanceHideMs === undefined
      ? null
      : normalizeAppearanceTime(item.appearanceHideMs)
    const link = explicitDelay === null ? item.linkedAppearance : null
    let schedule
    if (link) {
      const triggerSchedule = resolveSchedule(link.triggerItemId, new Set([...visiting, itemId]))
      if (triggerSchedule) {
        const triggerCompleteMs = triggerSchedule.appearanceCompleteMs
        if (link.mode === 'hideAfter') {
          schedule = {
            appearanceDelayMs: 0,
            appearanceCompleteMs: 0,
            appearanceHideMs: normalizeAppearanceTime(triggerCompleteMs + link.delayMs)
          }
        } else {
          const appearanceDelayMs = normalizeAppearanceTime(triggerCompleteMs + link.delayMs)
          schedule = {
            appearanceDelayMs,
            appearanceCompleteMs: normalizeAppearanceTime(appearanceDelayMs + APPEARANCE_FADE_DURATION_MS),
            appearanceHideMs: explicitHide
          }
        }
      }
    }
    if (!schedule) {
      const appearanceDelayMs = explicitDelay ?? (
        group.appearMode === 'sequence'
          ? (rootIndexById.get(itemId) ?? 0) * normalizedAppearIntervalMs
          : 0
      )
      const entranceDurationMs = explicitHide === null
        ? getAppearanceAnimationDuration(group.appearAnimation)
        : 0
      schedule = {
        appearanceDelayMs: normalizeAppearanceTime(appearanceDelayMs),
        appearanceCompleteMs: normalizeAppearanceTime(appearanceDelayMs + entranceDurationMs),
        appearanceHideMs: explicitHide
      }
    }
    schedules.set(itemId, schedule)
    return schedule
  }

  synchronizedItems.forEach((item) => resolveSchedule(item.itemId))
  group.linkedAppearanceModelVersion = DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION
  return synchronizedItems.map((item) => {
    const schedule = schedules.get(item.itemId)
    return {
      ...item,
      appearanceDelayMs: schedule?.appearanceDelayMs ?? 0,
      appearanceHideMs: schedule?.appearanceHideMs ?? null,
      hideAfterTarget: item.hideAfterTarget === true,
      linkedAppearance: null
    }
  })
}

const getLocalAddresses = () => {
  const interfaces = os.networkInterfaces()
  const addresses = []

  Object.values(interfaces).forEach((entries) => {
    entries?.forEach((entry) => {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address)
      }
    })
  })

  return addresses
}

const getExtension = (name, mimeType) => {
  const ext = path.extname(name || '').toLowerCase()
  if (/^\.[a-z0-9]+$/.test(ext)) return ext
  if (mimeType === 'image/jpeg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/gif') return '.gif'
  if (mimeType === 'audio/mpeg') return '.mp3'
  if (mimeType === 'audio/mp4' || mimeType === 'audio/x-m4a') return '.m4a'
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') return '.wav'
  if (mimeType === 'audio/ogg') return '.ogg'
  if (String(mimeType || '').startsWith('audio/')) return '.m4a'
  if (mimeType === 'video/quicktime') return '.mov'
  if (String(mimeType || '').startsWith('video/')) return '.mp4'
  return '.png'
}

const detectMediaType = (mimeType, name) => {
  if (String(mimeType || '').startsWith('audio/')) return 'audio'
  if (/\.(mp3|m4a|wav|ogg|aac)$/i.test(name || '')) return 'audio'
  if (String(mimeType || '').startsWith('video/')) return 'video'
  if (/\.(mp4|mov|webm)$/i.test(name || '')) return 'video'
  return 'image'
}

const ensureRuntimeDirs = () => {
  dataDir = path.join(app.getPath('userData'), 'runtime-data')
  assetsDir = path.join(dataDir, 'assets')
  stateFile = path.join(dataDir, 'runtime-state.json')
  fs.mkdirSync(assetsDir, { recursive: true })
}

const loadState = () => {
  try {
    if (!fs.existsSync(stateFile)) return
    const loaded = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    runtimeState.activeGroupId = loaded.activeGroupId ?? null
    runtimeState.selectionRevision = isValidRevision(loaded.selectionRevision)
      ? Number(loaded.selectionRevision)
      : 0
    runtimeState.groups = loaded.groups ?? {}
    runtimeState.groupStateRevisions = loaded.groupStateRevisions ?? {}
    runtimeState.assets = loaded.assets ?? {}
    runtimeState.watermarkEnabled = resolveWatermarkEnabled(runtimeState.watermarkEnabled, loaded)
    runtimeState.view = {
      mode: 'archive',
      mirror: {
        replayId: null,
        startedAt: 0,
        elapsedMs: 0,
        receivedAt: 0,
        capturedAt: 0,
        transition: 'none',
        width: 0,
        height: 0,
        snapshotDataUrl: '',
        source: {
          dataUrl: '',
          width: 0,
          height: 0,
          capturedAt: 0,
          origin: null
        }
      }
    }
    runtimeState.preview = {
      ...runtimeState.preview,
      ...(loaded.preview ?? {}),
      advancedFeaturesEnabled: DESKTOP_ADVANCED_FEATURES_ENABLED,
      enabled: false,
      startedAt: Date.now()
    }
    normalizeStoredRuntimeState()
  } catch (error) {
    console.error('Failed to load runtime state:', error)
  }
}

const saveState = () => {
  try {
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        activeGroupId: runtimeState.activeGroupId,
        selectionRevision: runtimeState.selectionRevision,
        groupStateRevisions: runtimeState.groupStateRevisions,
        groups: runtimeState.groups,
        assets: runtimeState.assets,
        watermarkEnabled: runtimeState.watermarkEnabled,
        preview: {
          ...runtimeState.preview,
          enabled: false
        }
      }, null, 2)
    )
  } catch (error) {
    console.error('Failed to save runtime state:', error)
  }
}

const assetUrl = (asset) => {
  if (!asset?.assetId) return ''
  const version = asset.updatedAt ?? 0
  return `http://127.0.0.1:${CONTROL_PORT}/assets/${encodeURIComponent(asset.assetId)}?v=${version}`
}

const getPublicState = () => {
  const assets = {}
  Object.entries(runtimeState.assets).forEach(([assetId, asset]) => {
    assets[assetId] = {
      assetId,
      role: asset.role,
      groupId: asset.groupId,
      itemId: asset.itemId,
      name: asset.name,
      mediaType: asset.mediaType,
      mimeType: asset.mimeType,
      updatedAt: asset.updatedAt,
      url: fs.existsSync(asset.filePath || '') ? assetUrl(asset) : ''
    }
  })

  const publicView = runtimeState.view.mode === 'stage'
    ? {
        ...runtimeState.view,
        mirror: {
          ...runtimeState.view.mirror,
          snapshotDataUrl: '',
          source: {
            ...runtimeState.view.mirror.source,
            dataUrl: ''
          }
        }
      }
    : runtimeState.view

  return {
    activeGroupId: runtimeState.activeGroupId,
    selectionRevision: runtimeState.selectionRevision,
    groupStateRevisions: runtimeState.groupStateRevisions,
    groups: runtimeState.groups,
    assets,
    watermarkEnabled: runtimeState.watermarkEnabled,
    watermarkVisible: false,
    view: publicView,
    preview: runtimeState.preview,
    server: runtimeState.server,
    lastEvent: lastDynamicEvent
  }
}

const broadcastState = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('runtime-state', getPublicState())
}

const broadcastServerStatus = () => {
  runtimeState.server.addresses = getLocalAddresses()
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('server-status', runtimeState.server)
}

const ensureGroup = (groupId = DEFAULT_GROUP_ID, name = '作品檔案') => {
  const id = groupId || DEFAULT_GROUP_ID
  const storedRevision = isValidRevision(runtimeState.groupStateRevisions[id])
    ? Number(runtimeState.groupStateRevisions[id])
    : 0
  if (!runtimeState.groups[id]) {
    runtimeState.groups[id] = {
      groupId: id,
      name: name || '作品檔案',
      activeBackgroundId: null,
      backgrounds: [],
      backgroundPlayMode: 'fixed',
      backgroundIntervalMs: 5000,
      backgroundTransition: 'none',
      advancedFeaturesEnabled: DESKTOP_ADVANCED_FEATURES_ENABLED,
      stateRevision: storedRevision,
      linkedAppearanceModelVersion: DYNAMIC_LINKED_APPEARANCE_MODEL_VERSION,
      audioLibrary: [],
      items: [],
      appearMode: 'all',
      appearIntervalMs: 800,
      appearAnimation: 'none',
      updatedAt: Date.now()
    }
  }
  runtimeState.groups[id].advancedFeaturesEnabled = DESKTOP_ADVANCED_FEATURES_ENABLED
  runtimeState.groups[id].stateRevision = Math.max(
    storedRevision,
    isValidRevision(runtimeState.groups[id].stateRevision)
      ? Number(runtimeState.groups[id].stateRevision)
      : 0
  )
  return runtimeState.groups[id]
}

const defaultItem = (payload, order = 0) => {
  const kind = payload.kind === 'bubble' ? 'bubble' : 'media'
  const hasImageAssetId = Object.prototype.hasOwnProperty.call(payload, 'imageAssetId')
  const hasNestedImageAssetId = Object.prototype.hasOwnProperty.call(payload.bubble ?? {}, 'imageAssetId')
  const imageAssetId = kind === 'bubble'
    ? hasImageAssetId
      ? payload.imageAssetId || null
      : hasNestedImageAssetId
        ? payload.bubble.imageAssetId || null
        : payload.bubble?.image?.id ?? null
    : null
  const bubble = kind === 'bubble'
    ? { ...(payload.bubble ?? {}), imageAssetId }
    : null
  const hasAppearanceDelayMs = Object.prototype.hasOwnProperty.call(payload, 'appearanceDelayMs')
  const hasAppearanceHideMs = Object.prototype.hasOwnProperty.call(payload, 'appearanceHideMs')
  return {
    itemId: payload.itemId,
    kind,
    assetId: kind === 'media' ? payload.assetId ?? null : null,
    imageAssetId,
    bubble,
    name: payload.name ?? payload.itemId ?? '物件',
    gridIndex: payload.gridIndex ?? 72,
    position: payload.position ?? { x: 0.5, y: 0.5 },
    scale: payload.scale ?? 1,
    rotation: payload.rotation ?? 0,
    flipX: payload.flipX ?? false,
    flipY: payload.flipY ?? false,
    animationMode: payload.animationMode ?? (
      Number(payload.animationId ?? 0) === 0 ? 'none' : 'fixed'
    ),
    animationId: payload.animationId ?? 0,
    clickAnimationIds: Array.isArray(payload.clickAnimationIds)
      ? payload.clickAnimationIds
      : [1, 2, 3, 4, 5, 6, 7, 8, 9],
    moveMode: payload.moveMode ?? 'none',
    movePercent: payload.movePercent ?? 50,
    moveSpeed: payload.moveSpeed ?? 50,
    moveTrack: payload.moveTrack ?? 'middle',
    targetMode: payload.targetMode === 'target' && payload.targetPosition ? 'target' : 'loop',
    targetLoop: payload.targetLoop === true,
    targetPosition: payload.targetPosition ?? null,
    audioId: payload.audioId ?? null,
    audioTrigger: payload.audioTrigger ?? 'appearance',
    audioDelayMs: Math.max(0, Number(payload.audioDelayMs) || 0),
    appearanceDelayMs: hasAppearanceDelayMs
      ? normalizeAppearanceTime(payload.appearanceDelayMs)
      : undefined,
    appearanceHideMs: hasAppearanceHideMs
      && payload.appearanceHideMs !== null
      && Number.isFinite(Number(payload.appearanceHideMs))
      ? normalizeAppearanceTime(payload.appearanceHideMs)
      : hasAppearanceHideMs ? null : undefined,
    hideAfterTarget: payload.hideAfterTarget === true,
    linkedAppearance: normalizeLinkedAppearance(payload.linkedAppearance, payload.itemId),
    backgroundIds: Array.isArray(payload.backgroundIds) ? payload.backgroundIds.filter(Boolean) : [],
    isVisible: payload.isVisible ?? true,
    order: payload.order ?? order,
    updatedAt: Number.isFinite(Number(payload.updatedAt))
      ? Number(payload.updatedAt)
      : Date.now()
  }
}

const normalizeStoredRuntimeState = () => {
  Object.values(runtimeState.groups).forEach((group) => {
    group.advancedFeaturesEnabled = DESKTOP_ADVANCED_FEATURES_ENABLED
    group.stateRevision = isValidRevision(group.stateRevision) ? Number(group.stateRevision) : 0
    runtimeState.groupStateRevisions[group.groupId] = Math.max(
      Number(runtimeState.groupStateRevisions[group.groupId]) || 0,
      group.stateRevision
    )
    group.appearAnimation = normalizeAppearAnimation(group.appearAnimation)
    group.backgroundTransition = normalizeBackgroundTransition(group.backgroundTransition)
    group.audioLibrary = Array.isArray(group.audioLibrary) ? group.audioLibrary : []
    group.backgrounds = (group.backgrounds ?? []).map((background) => ({
      ...background,
      backgroundTransition: group.backgroundTransition,
      appearAnimation: undefined
    }))
    group.items = normalizeGroupItemLinksForModel(
      group,
      (group.items ?? []).map((item, index) => defaultItem(item, item.order ?? index))
    )
  })
}

const findItem = (group, itemId) => {
  return group.items.find((item) => item.itemId === itemId)
}

const upsertAssetMetadata = (metadata) => {
  if (!metadata.assetId) return
  const assetId = metadata.assetId
  const previous = runtimeState.assets[assetId]
  const nextMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  )
  runtimeState.assets[assetId] = {
    ...(previous ?? {}),
    ...nextMetadata,
    updatedAt: metadata.updatedAt
      ?? previous?.updatedAt
      ?? Date.now()
  }
}

const upsertItemAssetMetadata = (group, item) => {
  if (!item) return
  if (item.kind === 'bubble') {
    const imageAssetId = item.imageAssetId ?? item.bubble?.imageAssetId
    const existingAsset = runtimeState.assets[imageAssetId] ?? {}
    upsertAssetMetadata({
      assetId: imageAssetId,
      role: 'bubbleImage',
      groupId: group.groupId,
      itemId: item.itemId,
      name: existingAsset.name || `${item.name || item.itemId || 'bubble'} image`,
      mediaType: existingAsset.mediaType || 'image',
      mimeType: existingAsset.mimeType || ''
    })
    return
  }
  const existingAsset = runtimeState.assets[item.assetId] ?? {}
  upsertAssetMetadata({
    assetId: item.assetId,
    role: 'item',
    groupId: group.groupId,
    itemId: item.itemId,
    name: item.name || existingAsset.name,
    mediaType: item.mediaType ?? existingAsset.mediaType ?? 'image',
    mimeType: item.mimeType ?? existingAsset.mimeType ?? ''
  })
}

const upsertBackground = (group, payload) => {
  if (!payload?.assetId) return
  const background = {
    assetId: payload.assetId,
    name: payload.name ?? payload.assetId,
    mediaType: payload.mediaType ?? payload.type ?? 'image',
    mimeType: payload.mimeType ?? '',
    bgmAudioId: payload.bgmAudioId ?? null,
    backgroundTransition: normalizeBackgroundTransition(
      payload.backgroundTransition,
      group.backgroundTransition
    )
  }

  group.backgrounds = [
    background,
    ...group.backgrounds.filter((item) => item.assetId !== background.assetId)
  ]
  group.activeBackgroundId = payload.activeBackgroundId ?? background.assetId

  upsertAssetMetadata({
    assetId: background.assetId,
    role: 'background',
    groupId: group.groupId,
    name: background.name,
    mediaType: background.mediaType,
    mimeType: background.mimeType
  })
}

const parseDynamicMessage = (message) => {
  const prefix = 'MF|DynamicArt|'
  if (!message.startsWith(prefix)) return null

  const rest = message.slice(prefix.length)
  const separatorIndex = rest.indexOf('|')
  if (separatorIndex < 0) return null

  const eventName = rest.slice(0, separatorIndex)
  const jsonText = rest.slice(separatorIndex + 1)
  return {
    eventName,
    payload: jsonText ? JSON.parse(jsonText) : {}
  }
}

const setActiveGroup = (groupId, name) => {
  const group = ensureGroup(groupId, name)
  runtimeState.activeGroupId = group.groupId
  return group
}

const normalizeArchiveReplayId = (value) => String(value || '').trim().slice(0, 160)

const clearArchiveSnapshot = () => {
  runtimeState.view.mirror.snapshotDataUrl = ''
  runtimeState.view.mirror.capturedAt = 0
  runtimeState.view.mirror.width = 0
  runtimeState.view.mirror.height = 0
}

const clearArchiveSource = () => {
  runtimeState.view.mirror.source = {
    dataUrl: '',
    width: 0,
    height: 0,
    capturedAt: 0,
    origin: null
  }
}

const normalizeArchiveSource = (value) => {
  const dataUrl = typeof value?.dataUrl === 'string' ? value.dataUrl : ''
  if (!dataUrl.startsWith('data:image/') || dataUrl.length > 24 * 1024 * 1024) return null

  const width = Math.max(1, Number(value.width) || 1)
  const height = Math.max(1, Number(value.height) || 1)
  const origin = value.origin ?? {}
  return {
    dataUrl,
    width,
    height,
    capturedAt: Number(value.capturedAt) || Date.now(),
    origin: {
      left: Math.max(0, Number(origin.left) || 0),
      top: Math.max(0, Number(origin.top) || 0),
      width: Math.max(1, Number(origin.width) || 1),
      height: Math.max(1, Number(origin.height) || 1)
    }
  }
}

const applyDynamicEvent = (eventName, payload) => {
  let selectionAccepted = true
  if (DYNAMIC_SELECTION_EVENTS.has(eventName) || DYNAMIC_FULL_STATE_EVENTS.has(eventName)) {
    selectionAccepted = shouldApplySelectionRevision(
      runtimeState.selectionRevision,
      payload.selectionRevision
    )
    if (!selectionAccepted && DYNAMIC_SELECTION_EVENTS.has(eventName)) {
      return
    }
  }

  const eventGroupId = String(payload.groupId ?? '').trim()
  if (eventGroupId && DYNAMIC_STATE_REVISION_EVENTS.has(eventName)) {
    const currentRevision = runtimeState.groups[eventGroupId]?.stateRevision
      ?? runtimeState.groupStateRevisions[eventGroupId]
    if (!shouldApplyGroupStateRevision(currentRevision, payload.stateRevision)) {
      return
    }
    if (isValidRevision(payload.stateRevision)) {
      runtimeState.groupStateRevisions[eventGroupId] = Number(payload.stateRevision)
    }
  }

  const selectionEvent = DYNAMIC_SELECTION_EVENTS.has(eventName)
    || eventName === 'GroupSelectAndSync'
  if (selectionEvent && selectionAccepted && isValidRevision(payload.selectionRevision)) {
    runtimeState.selectionRevision = Number(payload.selectionRevision)
  }

  runtimeState.watermarkEnabled = resolveWatermarkEnabledForEvent(
    runtimeState.watermarkEnabled,
    eventName,
    payload
  )

  switch (eventName) {
    case 'ArchiveEnter': {
      const replayId = normalizeArchiveReplayId(payload.replayId)
      if (!replayId) break

      const duplicateReplay = runtimeState.view.mirror.replayId === replayId
      if (duplicateReplay) return

      runtimeState.view.mode = 'archive'
      if (!duplicateReplay) {
        clearArchiveSnapshot()
        clearArchiveSource()
      }
      runtimeState.view.mirror.replayId = replayId
      runtimeState.view.mirror.startedAt = Number(payload.startedAt) || Date.now()
      runtimeState.view.mirror.elapsedMs = Math.max(0, Number(payload.elapsedMs) || 0)
      runtimeState.view.mirror.receivedAt = Date.now()
      runtimeState.view.mirror.transition = 'portal'
      runtimeState.view.mirror.source = normalizeArchiveSource(payload.source)
        ?? runtimeState.view.mirror.source
      runtimeState.preview.enabled = false
      break
    }

    case 'ArchiveReturn': {
      const replayId = normalizeArchiveReplayId(payload.replayId)
      if (!replayId) break
      if (
        runtimeState.view.mode === 'archive'
        && runtimeState.view.mirror.replayId === replayId
        && runtimeState.view.mirror.transition === 'none'
      ) return

      runtimeState.view.mode = 'archive'
      runtimeState.view.mirror.replayId = replayId
      runtimeState.view.mirror.startedAt = Number(payload.startedAt) || Date.now()
      runtimeState.view.mirror.elapsedMs = 0
      runtimeState.view.mirror.receivedAt = Date.now()
      runtimeState.view.mirror.capturedAt = 0
      runtimeState.view.mirror.transition = 'none'
      runtimeState.preview.enabled = false
      break
    }

    case 'ArchiveSnapshot': {
      const replayId = normalizeArchiveReplayId(payload.replayId)
      const snapshotDataUrl = typeof payload.dataUrl === 'string' ? payload.dataUrl : ''
      if (!replayId || !snapshotDataUrl.startsWith('data:image/') || snapshotDataUrl.length > 24 * 1024 * 1024) break

      const duplicateReplay = runtimeState.view.mirror.replayId === replayId
      const capturedAt = Number(payload.capturedAt) || Date.now()
      if (duplicateReplay && runtimeState.view.mode === 'stage') return
      if (duplicateReplay && capturedAt <= runtimeState.view.mirror.capturedAt) return
      if (
        !duplicateReplay
        && runtimeState.view.mode === 'archive'
        && runtimeState.view.mirror.replayId
      ) return
      if (
        !duplicateReplay
        && runtimeState.view.mode === 'stage'
        && capturedAt <= runtimeState.view.mirror.capturedAt
      ) return

      if (!duplicateReplay) {
        runtimeState.view.mode = 'archive'
        runtimeState.view.mirror.replayId = replayId
        runtimeState.view.mirror.startedAt = capturedAt
        runtimeState.view.mirror.receivedAt = Date.now()
        runtimeState.view.mirror.transition = payload.transition === 'portal' ? 'portal' : 'none'
      }
      runtimeState.view.mirror.snapshotDataUrl = snapshotDataUrl
      runtimeState.view.mirror.capturedAt = capturedAt
      runtimeState.view.mirror.width = Math.max(1, Number(payload.width) || 1)
      runtimeState.view.mirror.height = Math.max(1, Number(payload.height) || 1)
      runtimeState.preview.enabled = false
      break
    }

    case 'GroupCreate': {
      const group = ensureGroup(payload.groupId, payload.name)
      group.name = payload.name ?? group.name
      group.updatedAt = Date.now()
      if (!runtimeState.activeGroupId) runtimeState.activeGroupId = group.groupId
      break
    }

    case 'GroupSelect': {
      setActiveGroup(payload.groupId, payload.name)
      break
    }

    case 'DisplaySettings': {
      break
    }

    case 'GroupUpdate': {
      const group = ensureGroup(payload.groupId, payload.name)
      group.name = payload.name ?? group.name
      group.thumbnailAssetId = payload.thumbnailAssetId ?? group.thumbnailAssetId
      group.updatedAt = Date.now()
      break
    }

    case 'GroupDelete': {
      delete runtimeState.groups[payload.groupId]
      if (runtimeState.activeGroupId === payload.groupId) {
        runtimeState.activeGroupId = null
        runtimeState.preview.enabled = false
      }
      break
    }

    case 'GroupSelectAndSync':
    case 'GroupStateSync': {
      const activatesGroup = eventName === 'GroupSelectAndSync' && selectionAccepted
      const group = activatesGroup
        ? setActiveGroup(payload.groupId, payload.name)
        : ensureGroup(payload.groupId, payload.name)
      if (activatesGroup) {
        runtimeState.view.mode = 'stage'
        runtimeState.preview.enabled = false
        runtimeState.preview.groupId = group.groupId
      }
      group.name = payload.name ?? group.name
      group.linkedAppearanceModelVersion = Number(payload.linkedAppearanceModelVersion) || 0
      group.advancedFeaturesEnabled = DESKTOP_ADVANCED_FEATURES_ENABLED
      group.appearMode = payload.appearMode ?? group.appearMode ?? 'all'
      group.appearIntervalMs = payload.appearIntervalMs ?? group.appearIntervalMs ?? 800
      group.appearAnimation = normalizeAppearAnimation(payload.appearAnimation ?? group.appearAnimation)
      group.backgroundPlayMode = payload.backgroundPlayMode ?? group.backgroundPlayMode ?? 'fixed'
      group.backgroundIntervalMs = payload.backgroundIntervalMs ?? group.backgroundIntervalMs ?? 5000
      group.backgroundTransition = normalizeBackgroundTransition(
        payload.backgroundTransition,
        group.backgroundTransition ?? 'none'
      )
      group.activeBackgroundId = payload.activeBackgroundId ?? group.activeBackgroundId

      const backgrounds = Array.isArray(payload.backgrounds)
        ? payload.backgrounds
        : payload.background
          ? [payload.background]
          : []

      group.backgrounds = backgrounds
        .filter((background) => background?.assetId)
        .map((background) => {
          upsertAssetMetadata({
            assetId: background.assetId,
            role: 'background',
            groupId: group.groupId,
            name: background.name ?? background.assetId,
            mediaType: background.mediaType ?? background.type ?? 'image',
            mimeType: background.mimeType ?? ''
          })
          return {
            assetId: background.assetId,
            name: background.name ?? background.assetId,
            mediaType: background.mediaType ?? background.type ?? 'image',
            mimeType: background.mimeType ?? '',
            bgmAudioId: background.bgmAudioId ?? null,
            backgroundTransition: group.backgroundTransition
          }
        })

      group.audioLibrary = (payload.audioLibrary ?? [])
        .filter((audio) => audio?.assetId)
        .map((audio) => {
          upsertAssetMetadata({
            assetId: audio.assetId,
            role: 'audio',
            groupId: group.groupId,
            name: audio.name ?? audio.assetId,
            mediaType: 'audio',
            mimeType: audio.mimeType ?? ''
          })
          return {
            assetId: audio.assetId,
            name: audio.name ?? audio.assetId,
            mediaType: 'audio',
            mimeType: audio.mimeType ?? '',
            durationMs: audio.durationMs ?? null
          }
        })

      if (!group.activeBackgroundId && group.backgrounds[0]) {
        group.activeBackgroundId = group.backgrounds[0].assetId
      }

      const existingItems = new Map(group.items.map((item) => [item.itemId, item]))
      const incomingItems = (payload.items ?? []).map((itemPayload, index) => {
        const existing = existingItems.get(itemPayload.itemId) ?? {}
        const nextItem = defaultItem({
          ...existing,
          ...itemPayload,
          bubble: (itemPayload.kind ?? existing.kind) === 'bubble'
            ? { ...(existing.bubble ?? {}), ...(itemPayload.bubble ?? {}) }
            : itemPayload.bubble
        }, index)

        upsertItemAssetMetadata(group, nextItem)

        return nextItem
      })
      group.items = normalizeGroupItemLinksForModel(group, incomingItems)
      group.updatedAt = Number.isFinite(Number(payload.updatedAt))
        ? Number(payload.updatedAt)
        : Date.now()
      if (isValidRevision(payload.stateRevision)) {
        group.stateRevision = Math.max(group.stateRevision ?? 0, Number(payload.stateRevision))
        runtimeState.groupStateRevisions[group.groupId] = group.stateRevision
      }
      break
    }

    case 'GroupAppearMode': {
      const group = ensureGroup(payload.groupId)
      group.appearMode = payload.mode ?? payload.appearMode ?? group.appearMode
      group.appearIntervalMs = payload.intervalMs ?? payload.appearIntervalMs ?? group.appearIntervalMs
      group.updatedAt = Date.now()
      break
    }

    case 'PreviewMode': {
      const groupId = payload.groupId ?? runtimeState.activeGroupId
      if (groupId) setActiveGroup(groupId)
      runtimeState.preview = {
        enabled: Boolean(payload.enabled),
        groupId,
        advancedFeaturesEnabled: DESKTOP_ADVANCED_FEATURES_ENABLED,
        appearMode: payload.appearMode ?? ensureGroup(groupId).appearMode ?? 'all',
        intervalMs: payload.intervalMs ?? ensureGroup(groupId).appearIntervalMs ?? 800,
        appearAnimation: payload.appearAnimation ?? ensureGroup(groupId).appearAnimation ?? 'none',
        backgroundPlayMode: payload.backgroundPlayMode ?? ensureGroup(groupId).backgroundPlayMode ?? 'fixed',
        backgroundIntervalMs: payload.backgroundIntervalMs ?? ensureGroup(groupId).backgroundIntervalMs ?? 5000,
        backgroundTransition: payload.backgroundTransition ?? ensureGroup(groupId).backgroundTransition ?? 'none',
        replayId: payload.replayId ?? runtimeState.preview.replayId + 1,
        resolvedAnimationIds: payload.resolvedAnimationIds ?? {},
        startedAt: Date.now()
      }
      runtimeState.view.mode = 'stage'
      break
    }

    case 'BackgroundSet': {
      const group = ensureGroup(payload.groupId)
      upsertBackground(group, payload)
      group.updatedAt = Date.now()
      break
    }

    case 'BackgroundDelete': {
      const group = ensureGroup(payload.groupId)
      const deleteIds = new Set(payload.assetIds ?? [])
      group.backgrounds = group.backgrounds.filter((background) => !deleteIds.has(background.assetId))
      group.items = group.items.map((item) => ({
        ...item,
        backgroundIds: Array.isArray(item.backgroundIds)
          ? item.backgroundIds.filter((backgroundId) => !deleteIds.has(backgroundId))
          : []
      }))
      group.activeBackgroundId = payload.nextActiveAssetId ?? group.backgrounds[0]?.assetId ?? null
      group.updatedAt = Date.now()
      break
    }

    case 'BackgroundPlayback': {
      const group = ensureGroup(payload.groupId)
      group.backgroundPlayMode = payload.mode ?? payload.backgroundPlayMode ?? group.backgroundPlayMode ?? 'fixed'
      group.backgroundIntervalMs = payload.intervalMs ?? payload.backgroundIntervalMs ?? group.backgroundIntervalMs ?? 5000
      group.updatedAt = Date.now()
      break
    }

    case 'ItemCreate': {
      const group = ensureGroup(payload.groupId)
      const existing = findItem(group, payload.itemId)
      if (existing) {
        Object.assign(existing, defaultItem({
          ...existing,
          ...payload,
          bubble: (payload.kind ?? existing.kind) === 'bubble'
            ? { ...(existing.bubble ?? {}), ...(payload.bubble ?? {}) }
            : payload.bubble
        }, existing.order))
      } else {
        group.items.push(defaultItem(payload, group.items.length))
      }
      upsertItemAssetMetadata(group, findItem(group, payload.itemId))
      group.updatedAt = Date.now()
      break
    }

    case 'ItemUpdate': {
      const group = ensureGroup(payload.groupId)
      const item = findItem(group, payload.itemId)
      if (item) {
        Object.assign(item, defaultItem({
          ...item,
          ...payload,
          bubble: (payload.kind ?? item.kind) === 'bubble'
            ? { ...(item.bubble ?? {}), ...(payload.bubble ?? {}) }
            : payload.bubble
        }, item.order))
      }
      upsertItemAssetMetadata(group, item)
      group.updatedAt = Date.now()
      break
    }

    case 'ItemDelete': {
      const group = ensureGroup(payload.groupId)
      group.items = group.items
        .filter((item) => item.itemId !== payload.itemId)
        .map((item) => ({
          ...item,
          linkedAppearance: item.linkedAppearance?.triggerItemId === payload.itemId
            ? null
            : item.linkedAppearance
        }))
      group.items.forEach((item, index) => {
        item.order = index
      })
      group.updatedAt = Date.now()
      break
    }

    case 'ItemSelect': {
      const group = ensureGroup(payload.groupId)
      group.activeItemId = payload.itemId
      break
    }

    case 'ItemTransform': {
      const group = ensureGroup(payload.groupId)
      const item = findItem(group, payload.itemId)
      if (item) {
        item.gridIndex = payload.gridIndex ?? item.gridIndex
        item.position = payload.position ?? item.position
        item.scale = payload.scale ?? item.scale
        item.rotation = payload.rotation ?? item.rotation
        item.updatedAt = Date.now()
      }
      group.updatedAt = Date.now()
      break
    }

    case 'ItemDeform': {
      const group = ensureGroup(payload.groupId)
      const item = findItem(group, payload.itemId)
      if (item) {
        item.flipX = payload.flipX ?? item.flipX
        item.flipY = payload.flipY ?? item.flipY
        item.updatedAt = Date.now()
      }
      break
    }

    case 'ItemAnimation': {
      const group = ensureGroup(payload.groupId)
      const item = findItem(group, payload.itemId)
      if (item) {
        item.animationMode = payload.animationMode ?? item.animationMode ?? (
          Number(payload.animationId ?? item.animationId ?? 0) === 0 ? 'none' : 'fixed'
        )
        item.animationId = payload.animationId ?? item.animationId
        if (Array.isArray(payload.clickAnimationIds)) {
          item.clickAnimationIds = payload.clickAnimationIds
        }
        item.updatedAt = Date.now()
      }
      break
    }

    case 'ItemMotion': {
      const group = ensureGroup(payload.groupId)
      const item = findItem(group, payload.itemId)
      if (item) {
        item.moveMode = payload.mode ?? payload.moveMode ?? item.moveMode
        item.movePercent = payload.percent ?? payload.movePercent ?? item.movePercent
        item.moveSpeed = payload.speed ?? payload.moveSpeed ?? item.moveSpeed
        item.moveTrack = payload.track ?? payload.moveTrack ?? item.moveTrack
        if (Object.prototype.hasOwnProperty.call(payload, 'targetMode')) item.targetMode = payload.targetMode
        if (Object.prototype.hasOwnProperty.call(payload, 'targetLoop')) item.targetLoop = payload.targetLoop === true
        if (Object.prototype.hasOwnProperty.call(payload, 'targetPosition')) item.targetPosition = payload.targetPosition
        if (Object.prototype.hasOwnProperty.call(payload, 'appearanceDelayMs')) {
          item.appearanceDelayMs = normalizeAppearanceTime(payload.appearanceDelayMs)
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'appearanceHideMs')) {
          item.appearanceHideMs = payload.appearanceHideMs === null
            ? null
            : normalizeAppearanceTime(payload.appearanceHideMs)
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'hideAfterTarget')) {
          item.hideAfterTarget = payload.hideAfterTarget === true
        }
        item.updatedAt = Date.now()
      }
      break
    }

    case 'ItemSettingsCopy': {
      const group = ensureGroup(payload.groupId)
      const source = findItem(group, payload.sourceItemId)
      const target = findItem(group, payload.targetItemId)
      if (source && target) {
        applyItemSettingsCopy(
          source,
          target,
          payload.fields ?? DEFAULT_ITEM_SETTINGS_COPY_FIELDS
        )
        target.updatedAt = Date.now()
        group.items = normalizeGroupItemLinksForModel(group, group.items)
      }
      break
    }

    default:
      console.log('Unhandled dynamic event:', eventName, payload)
  }

  const reportedEventName = DYNAMIC_FULL_STATE_EVENTS.has(eventName) && !selectionAccepted
    ? 'GroupStateCached'
    : eventName
  lastDynamicEvent = {
    sequence: ++dynamicEventSequence,
    eventName: reportedEventName,
    groupId: payload.groupId ?? runtimeState.activeGroupId ?? null,
    itemId: payload.itemId ?? null,
    enabled: eventName === 'PreviewMode' ? Boolean(payload.enabled) : undefined,
    replayId: eventName === 'PreviewMode' ? payload.replayId ?? runtimeState.preview.replayId : undefined,
    watermarkEnabled: isWatermarkSettingsEvent(eventName)
      ? runtimeState.watermarkEnabled
      : undefined
  }

  if (!['ArchiveEnter', 'ArchiveReturn', 'ArchiveSnapshot'].includes(eventName)) {
    saveState()
  }
  broadcastState()
}

const splitHeaderParameters = (value) => {
  const result = {}
  String(value || '').split(';').forEach((part) => {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (!rawKey) return
    const key = rawKey.trim()
    const joinedValue = rawValue.join('=').trim()
    result[key] = joinedValue.replace(/^"|"$/g, '')
  })
  return result
}

const parseMultipart = (buffer, contentType) => {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '')
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2]
  if (!boundary) throw new Error('Missing multipart boundary')

  const boundaryBuffer = Buffer.from(`--${boundary}`)
  const fields = {}
  let file = null
  let cursor = 0

  while (cursor < buffer.length) {
    const boundaryIndex = buffer.indexOf(boundaryBuffer, cursor)
    if (boundaryIndex < 0) break

    let partStart = boundaryIndex + boundaryBuffer.length
    if (buffer[partStart] === 45 && buffer[partStart + 1] === 45) break
    if (buffer[partStart] === 13 && buffer[partStart + 1] === 10) partStart += 2

    const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, partStart)
    if (nextBoundaryIndex < 0) break

    let part = buffer.slice(partStart, nextBoundaryIndex)
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.slice(0, -2)
    }

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd >= 0) {
      const headerText = part.slice(0, headerEnd).toString('utf8')
      const body = part.slice(headerEnd + 4)
      const headers = {}
      headerText.split('\r\n').forEach((line) => {
        const separator = line.indexOf(':')
        if (separator > 0) {
          headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim()
        }
      })

      const disposition = splitHeaderParameters(headers['content-disposition'])
      const name = disposition.name
      if (name) {
        if (disposition.filename !== undefined) {
          file = {
            fieldName: name,
            filename: disposition.filename || 'upload',
            contentType: headers['content-type'] || 'application/octet-stream',
            data: body
          }
        } else {
          fields[name] = body.toString('utf8')
        }
      }
    }

    cursor = nextBoundaryIndex
  }

  return { fields, file }
}

const readRequestBody = (request) => {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0

    request.on('data', (chunk) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })

    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

const hashBuffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex')

const hashFile = (filePath) => {
  const hash = crypto.createHash('sha256')
  const descriptor = fs.openSync(filePath, 'r')
  const chunk = Buffer.allocUnsafe(1024 * 1024)
  try {
    let bytesRead = 0
    do {
      bytesRead = fs.readSync(descriptor, chunk, 0, chunk.length, null)
      if (bytesRead > 0) hash.update(chunk.subarray(0, bytesRead))
    } while (bytesRead > 0)
  } finally {
    fs.closeSync(descriptor)
  }
  return hash.digest('hex')
}

const removeSupersededAssetFile = (previousFilePath, nextFilePath) => {
  if (!previousFilePath || previousFilePath === nextFilePath || !fs.existsSync(previousFilePath)) return
  try {
    fs.unlinkSync(previousFilePath)
  } catch (error) {
    console.warn('Failed to remove superseded asset file:', error)
  }
}

const handleUpload = (buffer, contentType) => {
  const { fields, file } = parseMultipart(buffer, contentType)
  if (!file) throw new Error('Missing multipart file')

  const assetId = fields.assetId || makeId('media')
  const groupId = fields.groupId || DEFAULT_GROUP_ID
  const name = fields.name || file.filename || assetId
  const mimeType = fields.mimeType || file.contentType || 'application/octet-stream'
  const mediaType = fields.mediaType || detectMediaType(mimeType, name)
  const knownGroupRevision = runtimeState.groups[groupId]?.stateRevision
    ?? runtimeState.groupStateRevisions[groupId]
  const shouldUpdateGroup = shouldApplyGroupUploadSideEffect(
    knownGroupRevision,
    fields.stateRevision
  )

  if (!shouldUpdateGroup) {
    return {
      ok: true,
      assetId,
      role: fields.role || 'item',
      groupId,
      stateIgnored: true
    }
  }

  const existingAsset = runtimeState.assets[assetId]
  if (!shouldApplyGroupUploadSideEffect(existingAsset?.stateRevision, fields.stateRevision)) {
    return {
      ok: true,
      assetId,
      role: fields.role || 'item',
      groupId,
      stateIgnored: true
    }
  }

  const extension = getExtension(name, mimeType)
  const nextFilePath = path.join(assetsDir, `${safeSegment(assetId)}${extension}`)
  const incomingContentHash = hashBuffer(file.data)
  const existingFileAvailable = Boolean(
    existingAsset?.filePath
    && fs.existsSync(existingAsset.filePath)
  )
  const existingContentHash = existingFileAvailable
    ? existingAsset.contentHash || hashFile(existingAsset.filePath)
    : ''
  const bytesChanged = !existingFileAvailable || existingContentHash !== incomingContentHash
  const filePath = bytesChanged ? nextFilePath : existingAsset.filePath

  if (bytesChanged) {
    fs.writeFileSync(filePath, file.data)
    removeSupersededAssetFile(existingAsset?.filePath, filePath)
  }

  const asset = {
    assetId,
    role: fields.role || 'item',
    groupId,
    itemId: fields.itemId || null,
    name,
    mediaType,
    mimeType,
    filePath,
    contentHash: incomingContentHash,
    stateRevision: isValidRevision(fields.stateRevision)
      ? Number(fields.stateRevision)
      : 0,
    updatedAt: bytesChanged
      ? Math.max(Date.now(), Number(existingAsset?.updatedAt ?? 0) + 1)
      : existingAsset.updatedAt ?? Date.now()
  }

  runtimeState.assets[assetId] = asset

  const group = ensureGroup(groupId)

  if (asset.role === 'background') {
    upsertBackground(group, {
      assetId,
      name,
      mediaType,
      mimeType
    })
  } else if (asset.role === 'audio') {
    group.audioLibrary = [
      {
        assetId,
        name,
        mediaType: 'audio',
        mimeType
      },
      ...(group.audioLibrary ?? []).filter((audio) => audio.assetId !== assetId)
    ]
  } else if ((asset.role === 'bubbleImage' || asset.role === 'bubble-image') && fields.itemId) {
    const item = findItem(group, fields.itemId)
    if (item?.kind === 'bubble') {
      item.imageAssetId = assetId
      item.bubble = { ...(item.bubble ?? {}), imageAssetId: assetId }
      item.updatedAt = Date.now()
    }
  } else if (asset.role === 'item' && fields.itemId) {
    const item = findItem(group, fields.itemId)
    if (item) {
      item.assetId = assetId
      item.name = item.name || name
      item.updatedAt = Date.now()
    }
  }

  saveState()
  broadcastState()

  return { ok: true, assetId, role: asset.role, groupId }
}

const writeCorsHeaders = (response) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const sendJson = (response, statusCode, data) => {
  writeCorsHeaders(response)
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(data))
}

const handleAssetRequest = (request, response, pathname) => {
  const assetId = decodeURIComponent(pathname.replace(/^\/assets\//, ''))
  const asset = runtimeState.assets[assetId]

  if (!asset?.filePath || !fs.existsSync(asset.filePath)) {
    sendJson(response, 404, { ok: false, error: 'Asset not found' })
    return
  }

  writeCorsHeaders(response)
  response.writeHead(200, {
    'Content-Type': asset.mimeType || 'application/octet-stream',
    'Cache-Control': 'no-store'
  })
  fs.createReadStream(asset.filePath).pipe(response)
}

const requestHandler = async (request, response) => {
  writeCorsHeaders(response)

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

  try {
    if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
      handleAssetRequest(request, response, url.pathname)
      return
    }

    if (request.method === 'GET' && url.pathname === '/status') {
      sendJson(response, 200, getPublicState())
      return
    }

    if (request.method !== 'POST') {
      sendJson(response, 404, { ok: false, error: 'Not found' })
      return
    }

    const contentType = String(request.headers['content-type'] || '')
    const body = await readRequestBody(request)

    if (contentType.includes('multipart/form-data')) {
      const result = handleUpload(body, contentType)
      sendJson(response, 200, result)
      return
    }

    const message = body.toString('utf8').trim()
    const dynamicEvent = parseDynamicMessage(message)
    if (dynamicEvent) {
      applyDynamicEvent(dynamicEvent.eventName, dynamicEvent.payload)
      sendJson(response, 200, { ok: true, eventName: dynamicEvent.eventName })
      return
    }

    sendJson(response, 200, { ok: true, ignored: true })
  } catch (error) {
    console.error('HTTP request failed:', error)
    sendJson(response, 500, {
      ok: false,
      error: error.message || 'Request failed'
    })
  }
}

const startServer = () => {
  server = http.createServer(requestHandler)
  server.on('error', (error) => {
    runtimeState.server.status = 'error'
    runtimeState.server.error = error.message
    broadcastServerStatus()
  })
  server.listen(CONTROL_PORT, '0.0.0.0', () => {
    runtimeState.server.status = 'listening'
    runtimeState.server.error = ''
    broadcastServerStatus()
    broadcastState()
  })
}

const createWindow = () => {
  const windowedForTesting = process.env.MAGICFLOOR_WINDOWED === '1'

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: !windowedForTesting,
    frame: windowedForTesting,
    show: false,
    backgroundColor: '#05070a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setMenuBarVisibility(false)
  mainWindow.loadFile(
    path.join(__dirname, 'renderer', 'index.html'),
    VERTICAL_DISPLAY_FLIP
      ? { query: { displayFlip: 'both', pointerFlip: 'none' } }
      : undefined
  )
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (!windowedForTesting) mainWindow.setFullScreen(true)
    mainWindow.show()
    mainWindow.focus()
  })
  mainWindow.webContents.once('did-finish-load', () => {
    broadcastServerStatus()
    broadcastState()
  })
}

app.whenReady().then(() => {
  ensureRuntimeDirs()
  loadState()
  createWindow()
  startServer()
})

ipcMain.on('request-runtime-state', () => {
  broadcastServerStatus()
  broadcastState()
})

app.on('window-all-closed', () => {
  if (server) server.close()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
