import {
  getDynamicMediaFile,
  type DynamicBackground,
  type DynamicGroup,
  type DynamicItem,
  type DynamicMedia
} from './dynamicArtStorage.ts'
import { sendDynamicEventAsync, uploadUnityAssetAsync } from './unityBridge.ts'

const DYNAMIC_RECEIVER_SYNC_KEY = 'magicfloor_dynamic_receiver_sync_v1'

interface ReceiverGroupSyncRecord {
  syncedAt: number
  assetSignature: string
}

interface ReceiverSyncState {
  forcedAtByReceiver: Record<string, number>
  groupsByReceiver: Record<string, Record<string, ReceiverGroupSyncRecord>>
}

interface SyncStatus {
  phase: 'starting' | 'background' | 'item' | 'parameters'
  current?: number
  total?: number
}

interface SyncDynamicGroupOptions {
  group: DynamicGroup
  ip: string
  port: number
  onStatus?: (status: SyncStatus) => void
}

const inFlightSyncs = new Map<string, Promise<boolean>>()

const getBackgrounds = (group: DynamicGroup) => {
  if (group.backgrounds?.length) return group.backgrounds
  return group.background ? [group.background] : []
}

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
        mimeType: background.mimeType
      }
    : null
)

const toItemPayload = (item: DynamicItem) => ({
  itemId: item.id,
  assetId: item.media.id,
  name: item.name,
  gridIndex: item.gridIndex,
  position: item.position,
  scale: item.scale,
  rotation: item.rotation,
  flipX: item.flipX ?? false,
  flipY: item.flipY ?? false,
  animationId: item.animationId,
  moveMode: item.moveMode,
  movePercent: item.movePercent,
  moveSpeed: item.moveSpeed,
  moveTrack: item.moveTrack,
  order: item.order,
  mediaType: item.media.type,
  mimeType: item.media.mimeType
})

const buildGroupSyncPayload = (group: DynamicGroup) => {
  const backgrounds = getBackgrounds(group)
  const activeBackground = getActiveBackground(group, backgrounds)

  return {
    groupId: group.id,
    name: group.name,
    appearMode: group.appearMode,
    appearIntervalMs: group.appearIntervalMs,
    backgroundPlayMode: group.backgroundPlayMode,
    backgroundIntervalMs: group.backgroundIntervalMs,
    activeBackgroundId: group.activeBackgroundId ?? activeBackground?.id,
    background: toBackgroundPayload(activeBackground),
    backgrounds: backgrounds.map((background) => toBackgroundPayload(background)),
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

const getMediaSignaturePart = (media: DynamicMedia) => [
  media.id,
  media.updatedAt,
  media.filePath ?? '',
  media.storageKey ?? '',
  media.width ?? '',
  media.height ?? ''
].join(':')

const getGroupAssetSignature = (group: DynamicGroup) => {
  const backgroundParts = getBackgrounds(group)
    .map((background) => `background:${getMediaSignaturePart(background)}`)
  const itemParts = group.items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => `item:${item.id}:${item.order}:${getMediaSignaturePart(item.media)}`)

  return [...backgroundParts, ...itemParts].join('|')
}

const hasGroupAssets = (group: DynamicGroup) => getBackgrounds(group).length > 0 || group.items.length > 0

const shouldSyncGroup = (
  state: ReceiverSyncState,
  receiverKey: string,
  groupId: string,
  _assetSignature: string
) => {
  if (!_assetSignature) return false

  const record = state.groupsByReceiver[receiverKey]?.[groupId]
  const forcedAt = state.forcedAtByReceiver[receiverKey] ?? 0
  if (!record) return true
  return forcedAt > record.syncedAt
}

const markDynamicReceiverNeedsResync = (ip: string, port: number) => {
  if (!ip.trim()) return

  const receiverKey = getReceiverKey(ip, port)

  const state = loadSyncState()
  state.forcedAtByReceiver[receiverKey] = Date.now()
  saveSyncState(state)
}

const markGroupSynced = (receiverKey: string, groupId: string, assetSignature: string) => {
  const state = loadSyncState()
  const receiverGroups = state.groupsByReceiver[receiverKey] ?? {}
  receiverGroups[groupId] = {
    syncedAt: Date.now(),
    assetSignature
  }
  state.groupsByReceiver[receiverKey] = receiverGroups
  saveSyncState(state)
}

const uploadMediaForSync = async (
  media: DynamicMedia,
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
  onStatus
}: SyncDynamicGroupOptions) => {
  const receiverKey = getReceiverKey(ip, port)
  if (!ip.trim() || !hasGroupAssets(group)) return false

  const assetSignature = getGroupAssetSignature(group)
  const state = loadSyncState()
  if (!shouldSyncGroup(state, receiverKey, group.id, assetSignature)) return false

  const syncKey = `${receiverKey}:${group.id}:${assetSignature}`
  const currentSync = inFlightSyncs.get(syncKey)
  if (currentSync) return currentSync

  const syncPromise = (async () => {
    const backgrounds = getBackgrounds(group)
    const total = backgrounds.length + group.items.length
    let current = 0

    onStatus?.({ phase: 'starting', current, total })

    for (const background of backgrounds) {
      current += 1
      onStatus?.({ phase: 'background', current, total })
      await uploadMediaForSync(background, {
        role: 'background',
        groupId: group.id,
        assetId: background.id,
        mediaType: background.type,
        mimeType: background.mimeType
      }, ip, port)
    }

    const sortedItems = group.items.slice().sort((a, b) => a.order - b.order)
    for (const item of sortedItems) {
      current += 1
      onStatus?.({ phase: 'item', current, total })
      await uploadMediaForSync(item.media, {
        role: 'item',
        groupId: group.id,
        itemId: item.id,
        assetId: item.media.id,
        mediaType: item.media.type,
        mimeType: item.media.mimeType
      }, ip, port)
    }

    onStatus?.({ phase: 'parameters', current: total, total })
    await sendDynamicEventAsync(ip, port, 'GroupSelectAndSync', buildGroupSyncPayload(group))
    markGroupSynced(receiverKey, group.id, assetSignature)
    return true
  })()

  inFlightSyncs.set(syncKey, syncPromise)

  try {
    return await syncPromise
  } finally {
    inFlightSyncs.delete(syncKey)
  }
}

export type { SyncStatus }
export {
  DYNAMIC_RECEIVER_SYNC_KEY,
  buildGroupSyncPayload,
  markDynamicReceiverNeedsResync,
  syncDynamicGroupToReceiver
}
