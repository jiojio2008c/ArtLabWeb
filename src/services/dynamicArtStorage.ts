import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

const DYNAMIC_GROUPS_KEY = 'magicfloor_dynamic_groups_v1'
const DYNAMIC_DB_NAME = 'magicfloor_dynamic_media'
const DYNAMIC_DB_VERSION = 1
const DYNAMIC_STORE_NAME = 'media'
const DYNAMIC_DIRECTORY = Directory.Data
const MAX_DYNAMIC_ITEMS_PER_GROUP = 30
const GRID_COLUMNS = 16
const GRID_ROWS = 9
const DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS = 800
const MIN_DYNAMIC_APPEAR_INTERVAL_MS = 100
const MAX_DYNAMIC_APPEAR_INTERVAL_MS = 5000
const DEFAULT_DYNAMIC_MOVE_SPEED = 50

type DynamicMediaType = 'image' | 'video'
type DynamicMoveMode = 'none' | 'verticalWave' | 'left' | 'right' | 'orbit' | 'random'
type DynamicMoveTrack = 'top' | 'middle' | 'bottom'
type DynamicAppearMode = 'sequence' | 'all'

interface DynamicMedia {
  id: string
  name: string
  type: DynamicMediaType
  mimeType: string
  url: string
  filePath?: string
  storageKey?: string
  updatedAt: number
}

interface DynamicBackground extends DynamicMedia {}

interface DynamicItem {
  id: string
  name: string
  media: DynamicMedia
  position: {
    x: number
    y: number
  }
  gridIndex: number
  scale: number
  rotation: number
  flipX: boolean
  flipY: boolean
  animationId: number
  moveMode: DynamicMoveMode
  movePercent: number
  moveSpeed: number
  moveTrack: DynamicMoveTrack
  isVisible: boolean
  order: number
  createdAt: number
  updatedAt: number
}

interface DynamicGroup {
  id: string
  name: string
  thumbnail?: DynamicMedia
  background?: DynamicBackground
  backgrounds?: DynamicBackground[]
  activeBackgroundId?: string
  appearMode: DynamicAppearMode
  appearIntervalMs: number
  items: DynamicItem[]
  createdAt: number
  updatedAt: number
}

interface DynamicMediaRecord {
  key: string
  name: string
  type: DynamicMediaType
  mimeType: string
  blob: Blob
  updatedAt: number
}

const isNativeStorage = () => Capacitor.isNativePlatform()

const generateId = (prefix: string) => {
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`
}

const safePathSegment = (value: string) => value.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'default'

const getMediaType = (file: File): DynamicMediaType => file.type.startsWith('video/') ? 'video' : 'image'

const getFileExtension = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension && /^[a-z0-9]+$/.test(extension)) return extension

  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  if (file.type === 'video/quicktime') return 'mov'
  if (file.type.startsWith('video/')) return 'mp4'
  return 'png'
}

const calculateGridIndex = (x: number, y: number) => {
  const col = Math.min(GRID_COLUMNS - 1, Math.max(0, Math.floor(x * GRID_COLUMNS)))
  const row = Math.min(GRID_ROWS - 1, Math.max(0, (GRID_ROWS - 1) - Math.floor(y * GRID_ROWS)))
  return row * GRID_COLUMNS + col
}

const getDynamicMoveTrackFromPosition = (y: number): DynamicMoveTrack => {
  if (y < 1 / 3) return 'top'
  if (y > 2 / 3) return 'bottom'
  return 'middle'
}

const getDynamicMoveTrackCenter = (track: DynamicMoveTrack) => {
  if (track === 'top') return 1 / 6
  if (track === 'bottom') return 5 / 6
  return 1 / 2
}

const getDynamicMoveSpeedFromItem = (item: DynamicItem) => {
  if (item.moveSpeed !== undefined) return item.moveSpeed
  if (item.moveMode === 'left' || item.moveMode === 'right') return item.movePercent
  return DEFAULT_DYNAMIC_MOVE_SPEED
}

const getDynamicAppearIntervalFromGroup = (group: DynamicGroup) => {
  const interval = Number(group.appearIntervalMs)
  if (!Number.isFinite(interval)) return DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS
  return Math.min(MAX_DYNAMIC_APPEAR_INTERVAL_MS, Math.max(MIN_DYNAMIC_APPEAR_INTERVAL_MS, Math.round(interval)))
}

const blobToBase64 = (blob: Blob) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read dynamic media blob'))
    reader.readAsDataURL(blob)
  })
}

const toDataUrl = (data: string, mimeType: string) => {
  if (data.startsWith('data:')) return data
  return `data:${mimeType};base64,${data}`
}

const openDynamicDb = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available'))
      return
    }

    const request = window.indexedDB.open(DYNAMIC_DB_NAME, DYNAMIC_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DYNAMIC_STORE_NAME)) {
        db.createObjectStore(DYNAMIC_STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open dynamic media cache'))
  })
}

const putDynamicBlob = async (record: DynamicMediaRecord) => {
  const db = await openDynamicDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(DYNAMIC_STORE_NAME, 'readwrite')
      transaction.objectStore(DYNAMIC_STORE_NAME).put(record)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to save dynamic media blob'))
    })
  } finally {
    db.close()
  }
}

const getDynamicBlob = async (key: string) => {
  const db = await openDynamicDb()
  try {
    return await new Promise<DynamicMediaRecord | undefined>((resolve, reject) => {
      const transaction = db.transaction(DYNAMIC_STORE_NAME, 'readonly')
      const request = transaction.objectStore(DYNAMIC_STORE_NAME).get(key)
      request.onsuccess = () => resolve(request.result as DynamicMediaRecord | undefined)
      request.onerror = () => reject(request.error ?? new Error('Failed to load dynamic media blob'))
    })
  } finally {
    db.close()
  }
}

const deleteDynamicBlob = async (key: string) => {
  const db = await openDynamicDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(DYNAMIC_STORE_NAME, 'readwrite')
      transaction.objectStore(DYNAMIC_STORE_NAME).delete(key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to delete dynamic media blob'))
    })
  } finally {
    db.close()
  }
}

const saveFileToFilesystem = async (file: File, mediaId: string, scope: string) => {
  const extension = getFileExtension(file)
  const path = `dynamic-art/${safePathSegment(scope)}/${safePathSegment(mediaId)}.${extension}`
  const data = await blobToBase64(file)
  await Filesystem.writeFile({
    path,
    data,
    directory: DYNAMIC_DIRECTORY,
    recursive: true
  })
  return path
}

const resolveMediaUrl = async (media: DynamicMedia): Promise<DynamicMedia> => {
  if (media.filePath && isNativeStorage()) {
    try {
      if (media.type === 'video') {
        const result = await Filesystem.getUri({
          path: media.filePath,
          directory: DYNAMIC_DIRECTORY
        })

        return {
          ...media,
          url: Capacitor.convertFileSrc(result.uri)
        }
      }

      const result = await Filesystem.readFile({
        path: media.filePath,
        directory: DYNAMIC_DIRECTORY
      })

      const url = result.data instanceof Blob
        ? URL.createObjectURL(result.data)
        : toDataUrl(result.data, media.mimeType)

      return { ...media, url }
    } catch (error) {
      console.error('Failed to resolve dynamic media file:', error)
    }
  }

  if (media.storageKey) {
    try {
      const record = await getDynamicBlob(media.storageKey)
      if (record?.blob) {
        return {
          ...media,
          name: media.name || record.name,
          type: media.type || record.type,
          mimeType: media.mimeType || record.mimeType,
          url: URL.createObjectURL(record.blob)
        }
      }
    } catch (error) {
      console.error('Failed to resolve dynamic media blob:', error)
    }
  }

  return {
    ...media,
    url: media.url ?? ''
  }
}

const loadRawGroups = (): DynamicGroup[] => {
  try {
    const raw = localStorage.getItem(DYNAMIC_GROUPS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const serializeMediaForStorage = <T extends DynamicMedia>(media?: T): T | undefined => {
  if (!media) return undefined

  const { url: _url, ...storedMedia } = media
  return {
    ...storedMedia,
    url: ''
  } as T
}

const serializeGroupForStorage = (group: DynamicGroup): DynamicGroup => ({
  ...group,
  thumbnail: serializeMediaForStorage(group.thumbnail),
  background: serializeMediaForStorage(group.background),
  backgrounds: getGroupBackgrounds(group).map((background) => (
    serializeMediaForStorage(background) as DynamicBackground
  )),
  items: group.items.map((item) => ({
    ...item,
    media: serializeMediaForStorage(item.media) ?? item.media
  }))
})

const saveDynamicGroups = (groups: DynamicGroup[]) => {
  const storageGroups = groups.map(serializeGroupForStorage)
  localStorage.setItem(DYNAMIC_GROUPS_KEY, JSON.stringify(storageGroups))
}

const getGroupBackgrounds = (group: DynamicGroup) => {
  if (group.backgrounds?.length) return group.backgrounds
  return group.background ? [group.background] : []
}

const mergeMediaPersistentFields = <T extends DynamicMedia>(media?: T, existingMedia?: DynamicMedia): T | undefined => {
  if (!media) return undefined
  if (!existingMedia || existingMedia.id !== media.id) return media

  return {
    ...existingMedia,
    ...media,
    filePath: media.filePath ?? existingMedia.filePath,
    storageKey: media.storageKey ?? existingMedia.storageKey,
    url: media.url || existingMedia.url || ''
  } as T
}

const mergeGroupPersistentMedia = (group: DynamicGroup, existingGroup?: DynamicGroup): DynamicGroup => {
  if (!existingGroup) return group

  const existingMediaById = new Map<string, DynamicMedia>()
  const collectMedia = (media?: DynamicMedia) => {
    if (media) existingMediaById.set(media.id, media)
  }

  collectMedia(existingGroup.thumbnail)
  getGroupBackgrounds(existingGroup).forEach(collectMedia)
  existingGroup.items.forEach((item) => collectMedia(item.media))

  return {
    ...group,
    thumbnail: mergeMediaPersistentFields(group.thumbnail, group.thumbnail ? existingMediaById.get(group.thumbnail.id) : undefined),
    background: mergeMediaPersistentFields(group.background, group.background ? existingMediaById.get(group.background.id) : undefined),
    backgrounds: getGroupBackgrounds(group).map((background) => (
      mergeMediaPersistentFields(background, existingMediaById.get(background.id)) as DynamicBackground
    )),
    items: group.items.map((item) => ({
      ...item,
      media: mergeMediaPersistentFields(item.media, existingMediaById.get(item.media.id)) ?? item.media
    }))
  }
}

const getActiveBackground = (group: DynamicGroup, backgrounds = getGroupBackgrounds(group)) => {
  return backgrounds.find((background) => background.id === group.activeBackgroundId)
    ?? group.background
    ?? backgrounds[0]
}

const hydrateGroup = async (group: DynamicGroup): Promise<DynamicGroup> => {
  const sourceBackgrounds = getGroupBackgrounds(group)
  const [thumbnail, backgrounds, items] = await Promise.all([
    group.thumbnail ? resolveMediaUrl(group.thumbnail) : Promise.resolve(undefined),
    Promise.all(sourceBackgrounds.map(resolveMediaUrl)),
    Promise.all(
      group.items.map(async (item) => ({
        ...item,
        media: await resolveMediaUrl(item.media),
        flipX: item.flipX ?? false,
        flipY: item.flipY ?? false,
        moveSpeed: getDynamicMoveSpeedFromItem(item),
        moveTrack: item.moveTrack ?? getDynamicMoveTrackFromPosition(item.position.y)
      }))
    )
  ])

  const background = getActiveBackground(group, backgrounds)

  return {
    ...group,
    thumbnail,
    background,
    backgrounds,
    activeBackgroundId: background?.id,
    appearIntervalMs: getDynamicAppearIntervalFromGroup(group),
    items
  }
}

const loadDynamicGroups = async () => {
  const groups = loadRawGroups()
  if (groups.length > 0) {
    saveDynamicGroups(groups)
  }
  return Promise.all(groups.map(hydrateGroup))
}

const persistDynamicMedia = async (file: File, scope: string): Promise<DynamicMedia> => {
  const mediaId = generateId('media')
  const type = getMediaType(file)
  const mimeType = file.type || (type === 'video' ? 'video/mp4' : 'image/png')
  let filePath: string | undefined
  let storageKey: string | undefined

  if (isNativeStorage()) {
    try {
      filePath = await saveFileToFilesystem(file, mediaId, scope)
    } catch (error) {
      console.error('Failed to persist dynamic media file:', error)
    }
  }

  if (!filePath) {
    storageKey = mediaId
    try {
      await putDynamicBlob({
        key: storageKey,
        name: file.name,
        type,
        mimeType,
        blob: file,
        updatedAt: Date.now()
      })
    } catch (error) {
      console.error('Failed to persist dynamic media blob:', error)
      storageKey = undefined
    }
  }

  return {
    id: mediaId,
    name: file.name,
    type,
    mimeType,
    url: URL.createObjectURL(file),
    filePath,
    storageKey,
    updatedAt: Date.now()
  }
}

const deleteDynamicMedia = async (media?: DynamicMedia) => {
  if (!media) return

  if (media.filePath && isNativeStorage()) {
    try {
      await Filesystem.deleteFile({
        path: media.filePath,
        directory: DYNAMIC_DIRECTORY
      })
    } catch (error) {
      console.error('Failed to delete dynamic media file:', error)
    }
  }

  if (media.storageKey) {
    try {
      await deleteDynamicBlob(media.storageKey)
    } catch (error) {
      console.error('Failed to delete dynamic media blob:', error)
    }
  }
}

const isMediaUsedByOtherGroups = (groups: DynamicGroup[], groupId: string, mediaId?: string) => {
  if (!mediaId) return false

  return groups.some((group) => {
    if (group.id === groupId) return false
    if (group.thumbnail?.id === mediaId) return true
    if (getGroupBackgrounds(group).some((background) => background.id === mediaId)) return true
    return group.items.some((item) => item.media.id === mediaId)
  })
}

const isMediaUsedByOtherEntity = (groups: DynamicGroup[], groupId: string, itemId: string, mediaId?: string) => {
  if (!mediaId) return false

  return groups.some((group) => {
    if (group.thumbnail?.id === mediaId) return true
    if (getGroupBackgrounds(group).some((background) => background.id === mediaId)) return true
    return group.items.some((item) => {
      if (group.id === groupId && item.id === itemId) return false
      return item.media.id === mediaId
    })
  })
}

const collectDynamicGroupMedia = (group: DynamicGroup) => {
  const mediaById = new Map<string, DynamicMedia>()
  const addMedia = (media?: DynamicMedia) => {
    if (media) mediaById.set(media.id, media)
  }

  addMedia(group.thumbnail)
  getGroupBackgrounds(group).forEach(addMedia)
  group.items.forEach((item) => addMedia(item.media))

  return Array.from(mediaById.values())
}

const createDynamicGroup = async (name: string, thumbnailFile?: File, background?: DynamicBackground) => {
  const now = Date.now()
  const groupId = generateId('group')
  const thumbnail = thumbnailFile ? await persistDynamicMedia(thumbnailFile, `${groupId}/thumbnail`) : undefined
  const nextGroup: DynamicGroup = {
    id: groupId,
    name: name.trim() || '未命名作品檔案',
    thumbnail,
    background,
    backgrounds: background ? [background] : [],
    activeBackgroundId: background?.id,
    appearMode: 'all',
    appearIntervalMs: DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS,
    items: [],
    createdAt: now,
    updatedAt: now
  }

  const groups = loadRawGroups()
  const nextGroups = [nextGroup, ...groups]
  saveDynamicGroups(nextGroups)
  return hydrateGroup(nextGroup)
}

const updateDynamicGroupMeta = async (groupId: string, values: { name: string; thumbnailFile?: File }) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const previousThumbnail = group.thumbnail
  group.name = values.name.trim() || group.name || '未命名作品檔案'

  if (values.thumbnailFile) {
    group.thumbnail = await persistDynamicMedia(values.thumbnailFile, `${groupId}/thumbnail`)

    if (
      previousThumbnail
      && previousThumbnail.id !== group.thumbnail.id
      && !isMediaUsedByOtherGroups(groups, groupId, previousThumbnail.id)
    ) {
      await deleteDynamicMedia(previousThumbnail)
    }
  }

  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const deleteDynamicGroup = async (groupId: string) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return loadDynamicGroups()

  await Promise.all(
    collectDynamicGroupMedia(group)
      .filter((media) => !isMediaUsedByOtherGroups(groups, groupId, media.id))
      .map(deleteDynamicMedia)
  )

  const nextGroups = groups.filter((item) => item.id !== groupId)
  saveDynamicGroups(nextGroups)
  return Promise.all(nextGroups.map(hydrateGroup))
}

const upsertDynamicGroup = (group: DynamicGroup) => {
  const groups = loadRawGroups()
  const index = groups.findIndex((item) => item.id === group.id)
  const existingGroup = index >= 0 ? groups[index] : undefined
  const nextGroup = mergeGroupPersistentMedia({
    ...group,
    appearIntervalMs: getDynamicAppearIntervalFromGroup(group),
    updatedAt: Date.now()
  }, existingGroup)

  if (index >= 0) {
    groups[index] = nextGroup
  } else {
    groups.unshift(nextGroup)
  }

  saveDynamicGroups(groups)
  return nextGroup
}

const setDynamicBackground = async (groupId: string, file: File) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const background = await persistDynamicMedia(file, `${groupId}/background`) as DynamicBackground
  const currentBackgrounds = getGroupBackgrounds(group)
  group.backgrounds = [background, ...currentBackgrounds.filter((item) => item.id !== background.id)]
  group.background = background
  group.activeBackgroundId = background.id
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const setActiveDynamicBackground = async (groupId: string, backgroundId: string) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const backgrounds = getGroupBackgrounds(group)
  const background = backgrounds.find((item) => item.id === backgroundId)
  if (!background) return hydrateGroup(group)

  group.backgrounds = backgrounds
  group.background = background
  group.activeBackgroundId = background.id
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const deleteDynamicBackgrounds = async (groupId: string, backgroundIds: string[]) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group || backgroundIds.length === 0) return undefined

  const deleteSet = new Set(backgroundIds)
  const currentBackgrounds = getGroupBackgrounds(group)
  const remainingBackgrounds = currentBackgrounds.filter((background) => !deleteSet.has(background.id))

  if (remainingBackgrounds.length === currentBackgrounds.length) {
    return hydrateGroup(group)
  }

  await Promise.all(
    currentBackgrounds
      .filter((background) => deleteSet.has(background.id))
      .map(async (background) => {
        if (!isMediaUsedByOtherGroups(groups, groupId, background.id)) {
          await deleteDynamicMedia(background)
        }
      })
  )

  const activeBackground = remainingBackgrounds.find((background) => background.id === group.activeBackgroundId)
    ?? remainingBackgrounds[0]

  group.backgrounds = remainingBackgrounds
  group.background = activeBackground
  group.activeBackgroundId = activeBackground?.id
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const addDynamicItem = async (groupId: string, file: File, itemName?: string) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group || group.items.length >= MAX_DYNAMIC_ITEMS_PER_GROUP) return undefined

  const media = await persistDynamicMedia(file, `${groupId}/items`)
  const now = Date.now()
  const item: DynamicItem = {
    id: generateId('item'),
    name: itemName?.trim() || file.name,
    media,
    position: { x: 0.5, y: 0.5 },
    gridIndex: calculateGridIndex(0.5, 0.5),
    scale: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
    animationId: 0,
    moveMode: 'none',
    movePercent: 50,
    moveSpeed: DEFAULT_DYNAMIC_MOVE_SPEED,
    moveTrack: 'middle',
    isVisible: true,
    order: group.items.length,
    createdAt: now,
    updatedAt: now
  }

  group.items.push(item)
  group.updatedAt = now
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const updateDynamicItemMeta = async (
  groupId: string,
  itemId: string,
  values: { name: string; file?: File }
) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const item = group.items.find((nextItem) => nextItem.id === itemId)
  if (!item) return undefined

  const previousMedia = item.media
  item.name = values.name.trim() || item.name || values.file?.name || '未命名物件'

  if (values.file) {
    item.media = await persistDynamicMedia(values.file, `${groupId}/items`)

    if (
      previousMedia.id !== item.media.id
      && !isMediaUsedByOtherEntity(groups, groupId, itemId, previousMedia.id)
    ) {
      await deleteDynamicMedia(previousMedia)
    }
  }

  item.updatedAt = Date.now()
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const updateDynamicItem = (groupId: string, itemId: string, updater: (item: DynamicItem) => DynamicItem) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  group.items = group.items.map((item) => (
    item.id === itemId ? { ...updater(item), updatedAt: Date.now() } : item
  ))
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return group
}

const deleteDynamicItem = async (groupId: string, itemId: string) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  const item = group.items.find((nextItem) => nextItem.id === itemId)
  await deleteDynamicMedia(item?.media)

  group.items = group.items
    .filter((nextItem) => nextItem.id !== itemId)
    .map((nextItem, index) => ({ ...nextItem, order: index, updatedAt: Date.now() }))
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const copyDynamicItemSettings = async (
  groupId: string,
  targetItemId: string,
  sourceItemId: string,
  currentGroup?: DynamicGroup
) => {
  const groups = loadRawGroups()
  const groupIndex = groups.findIndex((item) => item.id === groupId)
  const storedGroup = groupIndex >= 0 ? groups[groupIndex] : undefined
  const group = currentGroup?.id === groupId
    ? mergeGroupPersistentMedia(currentGroup, storedGroup)
    : storedGroup
  if (!group) return undefined

  const source = group.items.find((item) => item.id === sourceItemId)
  if (!source) return undefined

  const sourceTrack = source.moveTrack ?? getDynamicMoveTrackFromPosition(source.position.y)
  group.items = group.items.map((item) => {
    if (item.id !== targetItemId) return item
    const position = {
      x: item.position.x,
      y: getDynamicMoveTrackCenter(sourceTrack)
    }
    return {
      ...item,
      position,
      gridIndex: calculateGridIndex(position.x, position.y),
      scale: source.scale,
      rotation: source.rotation,
      flipX: source.flipX ?? false,
      flipY: source.flipY ?? false,
      animationId: source.animationId,
      moveMode: source.moveMode,
      movePercent: source.movePercent,
      moveSpeed: getDynamicMoveSpeedFromItem(source),
      moveTrack: sourceTrack,
      updatedAt: Date.now()
    }
  })
  group.updatedAt = Date.now()

  if (groupIndex >= 0) {
    groups[groupIndex] = group
  } else {
    groups.unshift(group)
  }

  saveDynamicGroups(groups)
  return hydrateGroup(group)
}

const updateDynamicGroupAppearMode = (
  groupId: string,
  appearMode: DynamicAppearMode,
  appearIntervalMs?: number
) => {
  const groups = loadRawGroups()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return undefined

  group.appearMode = appearMode
  group.appearIntervalMs = getDynamicAppearIntervalFromGroup({
    ...group,
    appearIntervalMs: appearIntervalMs ?? group.appearIntervalMs
  })
  group.updatedAt = Date.now()
  saveDynamicGroups(groups)
  return group
}

export type {
  DynamicAppearMode,
  DynamicBackground,
  DynamicGroup,
  DynamicItem,
  DynamicMedia,
  DynamicMediaType,
  DynamicMoveMode,
  DynamicMoveTrack
}
export {
  DYNAMIC_GROUPS_KEY,
  DEFAULT_DYNAMIC_APPEAR_INTERVAL_MS,
  MAX_DYNAMIC_APPEAR_INTERVAL_MS,
  MAX_DYNAMIC_ITEMS_PER_GROUP,
  MIN_DYNAMIC_APPEAR_INTERVAL_MS,
  addDynamicItem,
  calculateGridIndex,
  copyDynamicItemSettings,
  createDynamicGroup,
  deleteDynamicBackgrounds,
  deleteDynamicGroup,
  deleteDynamicItem,
  getDynamicMoveTrackCenter,
  getDynamicMoveTrackFromPosition,
  loadDynamicGroups,
  persistDynamicMedia,
  saveDynamicGroups,
  setActiveDynamicBackground,
  setDynamicBackground,
  updateDynamicGroupAppearMode,
  updateDynamicGroupMeta,
  updateDynamicItemMeta,
  updateDynamicItem,
  upsertDynamicGroup
}
