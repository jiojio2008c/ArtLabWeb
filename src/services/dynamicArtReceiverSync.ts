import {
  getDynamicMediaFile,
  type DynamicBackground,
  type DynamicGroup,
  type DynamicItem,
  type DynamicMedia,
  type DynamicAudioMedia,
  isDynamicBubbleItem,
  isDynamicMediaItem
} from './dynamicArtStorage.ts'
import {
  reserveDynamicGroupStateRevision,
  reserveDynamicSelectionRevision,
  sendDynamicEventAsync,
  uploadUnityAssetAsync
} from './unityBridge.ts'
import { loadNetworkSettings } from './appSettings.ts'
import {
  getDynamicAnimationMode,
  getDynamicClickAnimationIds
} from '../../desktop-runtime/renderer/dynamic-animation-catalog.js'

const DYNAMIC_RECEIVER_SYNC_KEY = 'magicfloor_dynamic_receiver_sync_v1'

interface ReceiverGroupSyncRecord {
  syncedAt: number
  assetSignature: string
  stateSignature?: string
}

interface ReceiverSyncState {
  forcedAtByReceiver: Record<string, number>
  groupsByReceiver: Record<string, Record<string, ReceiverGroupSyncRecord>>
}

interface SyncStatus {
  phase: 'starting' | 'background' | 'item' | 'audio' | 'parameters'
  current?: number
  total?: number
}

interface SyncDynamicGroupOptions {
  group: DynamicGroup
  ip: string
  port: number
  advancedFeaturesEnabled?: boolean
  watermarkEnabled?: boolean
  onStatus?: (status: SyncStatus) => void
}

interface GroupSyncRevisionOptions {
  stateRevision?: number
  selectionRevision?: number
}

const inFlightSyncs = new Map<string, Promise<boolean>>()

const getBackgrounds = (group: DynamicGroup) => {
  if (group.backgrounds?.length) return group.backgrounds
  return group.background ? [group.background] : []
}

const cloneDynamicMedia = <T extends DynamicMedia | DynamicAudioMedia>(media: T): T => ({
  ...media
})

const cloneDynamicBackground = (background: DynamicBackground): DynamicBackground => ({
  ...cloneDynamicMedia(background),
  backgroundTransition: background.backgroundTransition
})

const snapshotDynamicGroupForSync = (group: DynamicGroup): DynamicGroup => ({
  ...group,
  thumbnail: group.thumbnail ? cloneDynamicMedia(group.thumbnail) : group.thumbnail,
  background: group.background ? cloneDynamicBackground(group.background) : group.background,
  backgrounds: group.backgrounds?.map(cloneDynamicBackground),
  audioLibrary: group.audioLibrary?.map((audio) => cloneDynamicMedia(audio)),
  items: group.items.map((item) => {
    const baseItem = {
      ...item,
      position: item.position ? { ...item.position } : { x: 0.5, y: 0.5 },
      targetPosition: item.targetPosition ? { ...item.targetPosition } : item.targetPosition,
      clickAnimationIds: Array.isArray(item.clickAnimationIds) ? [...item.clickAnimationIds] : [],
      linkedAppearance: item.linkedAppearance ? { ...item.linkedAppearance } : item.linkedAppearance,
      backgroundIds: Array.isArray(item.backgroundIds) ? [...item.backgroundIds] : item.backgroundIds
    }

    if (isDynamicBubbleItem(item)) {
      return {
        ...baseItem,
        bubble: {
          ...item.bubble,
          image: item.bubble.image ? cloneDynamicMedia(item.bubble.image) : item.bubble.image
        }
      }
    }

    return {
      ...baseItem,
      media: cloneDynamicMedia(item.media)
    }
  })
})

const getActiveBackground = (group: DynamicGroup, backgrounds = getBackgrounds(group)) => (
  backgrounds.find((background) => background.id === group.activeBackgroundId)
    ?? group.background
    ?? backgrounds[0]
)

const toBackgroundPayload = (background?: DynamicBackground) => (
  background
    ? {
        assetId: background.id,
        name: background.name,
        mediaType: background.type,
        mimeType: background.mimeType,
        bgmAudioId: background.bgmAudioId,
        backgroundTransition: background.backgroundTransition ?? 'none'
      }
    : null
)

const toItemPayload = (item: DynamicItem) => {
  const commonPayload = {
    itemId: item.id,
    kind: item.kind,
    name: item.name,
    gridIndex: item.gridIndex,
    position: item.position,
    scale: item.scale,
    rotation: item.rotation,
    flipX: item.flipX ?? false,
    flipY: item.flipY ?? false,
    animationMode: getDynamicAnimationMode(item),
    animationId: item.animationId,
    clickAnimationIds: getDynamicClickAnimationIds(item),
    moveMode: item.moveMode,
    movePercent: item.movePercent,
    moveSpeed: item.moveSpeed,
    moveTrack: item.moveTrack,
    targetMode: item.targetMode ?? 'loop',
    targetLoop: item.targetLoop === true,
    targetPosition: item.targetPosition ?? null,
    audioId: item.audioId ?? null,
    audioTrigger: item.audioTrigger ?? 'appearance',
    audioDelayMs: item.audioDelayMs ?? 0,
    linkedAppearance: item.linkedAppearance ?? null,
    backgroundIds: item.backgroundIds ?? [],
    isVisible: item.isVisible !== false,
    order: item.order
  }

  if (isDynamicBubbleItem(item)) {
    const imageAssetId = item.bubble.bubbleType === 'thought'
      ? item.bubble.image?.id ?? null
      : null
    return {
      ...commonPayload,
      assetId: null,
      imageAssetId,
      mediaType: 'bubble',
      mimeType: 'application/vnd.magicfloor.bubble+json',
      bubble: {
        schemaVersion: item.bubble.schemaVersion,
        bubbleType: item.bubble.bubbleType,
        styleId: item.bubble.styleId,
        title: item.bubble.title,
        bodyText: item.bubble.bodyText,
        revealMode: item.bubble.revealMode,
        revealIntervalMs: item.bubble.revealIntervalMs,
        fontSizePx: item.bubble.fontSizePx,
        textColor: item.bubble.textColor,
        surfaceColor: item.bubble.surfaceColor,
        outlineColor: item.bubble.outlineColor,
        surfaceId: item.bubble.surfaceId,
        titleMaskId: item.bubble.titleMaskId,
        paletteId: item.bubble.paletteId,
        maskColor: item.bubble.maskColor,
        maskOpacity: item.bubble.maskOpacity,
        widthPx: item.bubble.widthPx,
        heightPx: item.bubble.heightPx,
        imageAssetId
      }
    }
  }

  return {
    ...commonPayload,
    assetId: item.media.id,
    imageAssetId: null,
    mediaType: item.media.type,
    mimeType: item.media.mimeType,
    bubble: null
  }
}

const buildGroupSyncPayload = (
  group: DynamicGroup,
  _advancedFeaturesEnabled = loadNetworkSettings().advancedFeaturesEnabled,
  watermarkEnabled = loadNetworkSettings().watermarkEnabled,
  revisionOptions: GroupSyncRevisionOptions = {}
) => {
  const backgrounds = getBackgrounds(group)
  const activeBackground = getActiveBackground(group, backgrounds)
  const stateRevision = Number.isFinite(revisionOptions.stateRevision)
    && Number(revisionOptions.stateRevision) > 0
    ? Math.floor(Number(revisionOptions.stateRevision))
    : reserveDynamicGroupStateRevision(group.id, group.updatedAt)
  const selectionRevision = Number.isFinite(revisionOptions.selectionRevision)
    && Number(revisionOptions.selectionRevision) > 0
    ? Math.floor(Number(revisionOptions.selectionRevision))
    : reserveDynamicSelectionRevision()

  return {
    groupId: group.id,
    name: group.name,
    stateRevision,
    selectionRevision,
    linkedAppearanceModelVersion: group.linkedAppearanceModelVersion,
    advancedFeaturesEnabled: true,
    watermarkEnabled,
    appearMode: group.appearMode,
    appearIntervalMs: group.appearIntervalMs,
    appearAnimation: group.appearAnimation ?? 'none',
    backgroundPlayMode: group.backgroundPlayMode,
    backgroundIntervalMs: group.backgroundIntervalMs,
    backgroundTransition: group.backgroundTransition ?? 'none',
    activeBackgroundId: group.activeBackgroundId ?? activeBackground?.id,
    background: toBackgroundPayload(activeBackground),
    backgrounds: backgrounds.map((background) => toBackgroundPayload(background)),
    audioLibrary: (group.audioLibrary ?? []).map((audio) => ({
      assetId: audio.id,
      name: audio.name,
      mediaType: 'audio',
      mimeType: audio.mimeType,
      durationMs: audio.durationMs
    })),
    items: group.items.map(toItemPayload)
  }
}

const getReceiverKey = (ip: string, port: number) => `${ip.trim()}:${port}`

const getEmptyState = (): ReceiverSyncState => ({
  forcedAtByReceiver: {},
  groupsByReceiver: {}
})

const canUseLocalStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage)

const loadSyncState = (): ReceiverSyncState => {
  if (!canUseLocalStorage()) return getEmptyState()

  try {
    const raw = localStorage.getItem(DYNAMIC_RECEIVER_SYNC_KEY)
    if (!raw) return getEmptyState()
    const parsed = JSON.parse(raw) as Partial<ReceiverSyncState>
    return {
      forcedAtByReceiver: parsed.forcedAtByReceiver ?? {},
      groupsByReceiver: parsed.groupsByReceiver ?? {}
    }
  } catch {
    return getEmptyState()
  }
}

const saveSyncState = (state: ReceiverSyncState) => {
  if (!canUseLocalStorage()) return

  try {
    localStorage.setItem(DYNAMIC_RECEIVER_SYNC_KEY, JSON.stringify(state))
  } catch {
    // Receiver sync can be retried later if the marker cannot be saved.
  }
}

const getMediaSignaturePart = (media: DynamicMedia | DynamicAudioMedia) => [
  media.id,
  media.name,
  media.type,
  media.mimeType,
  media.updatedAt,
  media.filePath ?? '',
  media.storageKey ?? '',
  media.width ?? '',
  media.height ?? ''
].join(':')

const getGroupAssetSignature = (group: DynamicGroup) => {
  const backgroundParts = getBackgrounds(group)
    .map((background) => `background:${getMediaSignaturePart(background)}`)
  const itemParts = group.items.map((item) => {
    if (isDynamicMediaItem(item)) {
      return `item:${getMediaSignaturePart(item.media)}`
    }
    const image = item.bubble.bubbleType === 'thought' ? item.bubble.image : undefined
    return image ? `bubble-image:${getMediaSignaturePart(image)}` : ''
  })
  const audioParts = (group.audioLibrary ?? [])
    .map((audio) => `audio:${getMediaSignaturePart(audio)}`)

  return JSON.stringify(
    [...backgroundParts, ...itemParts, ...audioParts]
      .filter(Boolean)
      .sort()
  )
}

const getGroupSyncSignature = (group: DynamicGroup) => {
  const backgroundParts = getBackgrounds(group)
    .map((background) => JSON.stringify([
      'background',
      getMediaSignaturePart(background),
      background.bgmAudioId ?? '',
      background.backgroundTransition ?? 'none'
    ]))
  const itemParts = group.items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const common = [
        item.id,
        item.kind,
        item.name,
        item.order,
        item.gridIndex,
        item.position?.x,
        item.position?.y,
        item.scale,
        item.rotation,
        item.flipX ?? false,
        item.flipY ?? false,
        item.animationMode ?? '',
        item.animationId ?? 0,
        getDynamicAnimationMode(item),
        getDynamicClickAnimationIds(item),
        item.moveMode ?? '',
        item.movePercent ?? 0,
        item.moveSpeed ?? 0,
        item.moveTrack ?? '',
        item.targetMode ?? 'loop',
        item.targetLoop === true,
        item.targetPosition?.x ?? null,
        item.targetPosition?.y ?? null,
        item.audioId ?? '',
        item.audioTrigger ?? 'appearance',
        item.audioDelayMs ?? 0,
        item.linkedAppearance ?? null,
        item.backgroundIds ?? [],
        item.isVisible ?? true
      ]
      if (isDynamicBubbleItem(item)) {
        const { image: bubbleImage, ...bubbleContent } = item.bubble
        const image = item.bubble.bubbleType === 'thought' ? bubbleImage : undefined
        return JSON.stringify([
          ...common,
          'bubble',
          JSON.stringify(bubbleContent),
          image ? getMediaSignaturePart(image) : ''
        ])
      }
      return JSON.stringify([
        ...common,
        'media',
        getMediaSignaturePart(item.media)
      ])
    })

  const audioParts = (group.audioLibrary ?? [])
    .map((audio) => JSON.stringify([
      'audio',
      getMediaSignaturePart(audio),
      audio.durationMs ?? null
    ]))

  return JSON.stringify({
    group: [
      group.id,
      group.name,
      group.activeBackgroundId ?? '',
      group.appearMode ?? 'all',
      group.appearIntervalMs ?? 0,
      group.appearAnimation ?? 'none',
      group.backgroundPlayMode ?? 'fixed',
      group.backgroundIntervalMs ?? 0,
      group.backgroundTransition ?? 'none',
      group.linkedAppearanceModelVersion ?? 0
    ],
    backgrounds: backgroundParts,
    items: itemParts,
    audio: audioParts
  })
}

const shouldSyncGroup = (
  state: ReceiverSyncState,
  receiverKey: string,
  groupId: string,
  assetSignature: string,
  stateSignature: string
) => {
  if (!assetSignature || !stateSignature) return { assets: false, state: false }

  const record = state.groupsByReceiver[receiverKey]?.[groupId]
  const forcedAt = state.forcedAtByReceiver[receiverKey] ?? 0
  const forced = !record || forcedAt > record.syncedAt
  return {
    assets: forced || record.assetSignature !== assetSignature,
    state: forced || record.stateSignature !== stateSignature
  }
}

const markDynamicReceiverNeedsResync = (ip: string, port: number) => {
  if (!ip.trim()) return

  const receiverKey = getReceiverKey(ip, port)

  const state = loadSyncState()
  state.forcedAtByReceiver[receiverKey] = Date.now()
  saveSyncState(state)
}

const markGroupSynced = (
  receiverKey: string,
  groupId: string,
  assetSignature: string,
  stateSignature: string
) => {
  const state = loadSyncState()
  const receiverGroups = state.groupsByReceiver[receiverKey] ?? {}
  receiverGroups[groupId] = {
    syncedAt: Date.now(),
    assetSignature,
    stateSignature
  }
  state.groupsByReceiver[receiverKey] = receiverGroups
  saveSyncState(state)
}

const uploadMediaForSync = async (
  media: DynamicMedia | DynamicAudioMedia,
  fields: Record<string, string | number | boolean | undefined>,
  ip: string,
  port: number
) => {
  const file = await getDynamicMediaFile(media)
  if (!file) {
    throw new Error(`Missing local media cache: ${media.name || media.id}`)
  }

  await uploadUnityAssetAsync({
    ip,
    port,
    file,
    fields
  })
}

const syncDynamicGroupToReceiver = async ({
  group,
  ip,
  port,
  advancedFeaturesEnabled = loadNetworkSettings().advancedFeaturesEnabled,
  watermarkEnabled = loadNetworkSettings().watermarkEnabled,
  onStatus
}: SyncDynamicGroupOptions) => {
  const receiverKey = getReceiverKey(ip, port)
  if (!ip.trim()) return false

  const groupSnapshot = snapshotDynamicGroupForSync(group)

  const syncKey = `${receiverKey}:${groupSnapshot.id}`
  const previousSync = inFlightSyncs.get(syncKey)
  const selectionRevision = reserveDynamicSelectionRevision()

  const syncPromise = (async () => {
    if (previousSync) {
      try {
        await previousSync
      } catch {}
    }

    const syncPayload = buildGroupSyncPayload(
      groupSnapshot,
      advancedFeaturesEnabled,
      watermarkEnabled,
      { selectionRevision }
    )
    const stateRevision = Number(syncPayload.stateRevision)
    const assetSignature = getGroupAssetSignature(groupSnapshot)
    const stateSignature = getGroupSyncSignature(groupSnapshot)
    const syncNeed = shouldSyncGroup(
      loadSyncState(),
      receiverKey,
      groupSnapshot.id,
      assetSignature,
      stateSignature
    )
    if (!syncNeed.assets && !syncNeed.state) {
      await sendDynamicEventAsync(
        ip,
        port,
        'GroupSelectAndSync',
        syncPayload
      )
      return false
    }

    const backgrounds = getBackgrounds(groupSnapshot)
    const audioLibrary = groupSnapshot.audioLibrary ?? []
    const itemAssetCount = groupSnapshot.items.reduce((count, item) => {
      if (isDynamicMediaItem(item)) return count + 1
      return count + (item.bubble.bubbleType === 'thought' && item.bubble.image ? 1 : 0)
    }, 0)
    const total = syncNeed.assets
      ? backgrounds.length + itemAssetCount + audioLibrary.length
      : 0
    let current = 0

    onStatus?.({ phase: 'starting', current, total })

    if (syncNeed.assets) {
      for (const background of backgrounds) {
        current += 1
        onStatus?.({ phase: 'background', current, total })
        await uploadMediaForSync(background, {
          role: 'background',
          groupId: groupSnapshot.id,
          assetId: background.id,
          mediaType: background.type,
          mimeType: background.mimeType,
          stateRevision
        }, ip, port)
      }

      const sortedItems = groupSnapshot.items.slice().sort((a, b) => a.order - b.order)
      for (const item of sortedItems) {
        const media = isDynamicMediaItem(item)
          ? item.media
          : item.bubble.bubbleType === 'thought'
            ? item.bubble.image
            : undefined
        if (!media) continue

        current += 1
        onStatus?.({ phase: 'item', current, total })
        await uploadMediaForSync(media, {
          role: isDynamicBubbleItem(item) ? 'bubbleImage' : 'item',
          groupId: groupSnapshot.id,
          itemId: item.id,
          assetId: media.id,
          mediaType: media.type,
          mimeType: media.mimeType,
          stateRevision
        }, ip, port)
      }

      for (const audio of audioLibrary) {
        current += 1
        onStatus?.({ phase: 'audio', current, total })
        await uploadMediaForSync(audio, {
          role: 'audio',
          groupId: groupSnapshot.id,
          assetId: audio.id,
          mediaType: 'audio',
          mimeType: audio.mimeType,
          stateRevision
        }, ip, port)
      }
    }

    onStatus?.({ phase: 'parameters', current: total, total })
    await sendDynamicEventAsync(
      ip,
      port,
      'GroupSelectAndSync',
      syncPayload
    )
    markGroupSynced(receiverKey, groupSnapshot.id, assetSignature, stateSignature)
    return true
  })()

  inFlightSyncs.set(syncKey, syncPromise)

  try {
    return await syncPromise
  } finally {
    if (inFlightSyncs.get(syncKey) === syncPromise) {
      inFlightSyncs.delete(syncKey)
    }
  }
}

export type { SyncStatus }
export {
  DYNAMIC_RECEIVER_SYNC_KEY,
  buildGroupSyncPayload,
  getGroupAssetSignature,
  getGroupSyncSignature,
  markDynamicReceiverNeedsResync,
  snapshotDynamicGroupForSync,
  syncDynamicGroupToReceiver
}
