import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

const STORAGE_KEY = 'artlab_ip_thumbnails'
const MAX_IP_GROUPS = 3
const ARTWORK_DB_NAME = 'artlab_artwork_cache'
const ARTWORK_DB_VERSION = 1
const ARTWORK_STORE_NAME = 'artworks'
const ARTWORK_DIRECTORY = Directory.Data

interface StoredArtwork {
  name: string
  url: string
  filePath?: string
  mimeType?: string
  storageKey?: string
  updatedAt?: number
}

interface IpThumbnailGroup {
  ip: string
  thumbnails: Record<number, string>
  images?: Record<number, StoredArtwork>
}

interface ArtworkRecord {
  key: string
  name: string
  blob: Blob
  updatedAt: number
}

const isNativeStorage = () => Capacitor.isNativePlatform()

const safePathSegment = (value: string) => value.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'default'

const getMimeType = (name: string, blob?: Blob) => {
  if (blob?.type) return blob.type
  const extension = name.split('.').pop()?.toLowerCase()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'webp') return 'image/webp'
  return 'image/png'
}

const getFileExtension = (name: string, blob?: Blob) => {
  const extension = name.split('.').pop()?.toLowerCase()
  if (extension && /^[a-z0-9]+$/.test(extension)) return extension

  const mimeType = getMimeType(name, blob)
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/webp') return 'webp'
  return 'png'
}

const makeArtworkStorageKey = (ip: string, index: number) => `${ip.trim()}::${index}`

const makeArtworkFilePath = (ip: string, index: number, name: string, blob?: Blob) => {
  const safeIp = safePathSegment(ip)
  const extension = getFileExtension(name, blob)
  return `artworks/${safeIp}/${index}.${extension}`
}

const blobToBase64 = (blob: Blob) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read artwork blob'))
    reader.readAsDataURL(blob)
  })
}

const toDataUrl = (data: string, mimeType: string) => {
  if (data.startsWith('data:')) return data
  return `data:${mimeType};base64,${data}`
}

const openArtworkDb = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available'))
      return
    }

    const request = window.indexedDB.open(ARTWORK_DB_NAME, ARTWORK_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ARTWORK_STORE_NAME)) {
        db.createObjectStore(ARTWORK_STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open artwork cache'))
  })
}

const putArtworkBlob = async (key: string, name: string, blob: Blob) => {
  const db = await openArtworkDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(ARTWORK_STORE_NAME, 'readwrite')
      transaction.objectStore(ARTWORK_STORE_NAME).put({
        key,
        name,
        blob,
        updatedAt: Date.now()
      } satisfies ArtworkRecord)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to save artwork blob'))
    })
  } finally {
    db.close()
  }
}

const getArtworkBlob = async (key: string) => {
  const db = await openArtworkDb()
  try {
    return await new Promise<ArtworkRecord | undefined>((resolve, reject) => {
      const transaction = db.transaction(ARTWORK_STORE_NAME, 'readonly')
      const request = transaction.objectStore(ARTWORK_STORE_NAME).get(key)

      request.onsuccess = () => resolve(request.result as ArtworkRecord | undefined)
      request.onerror = () => reject(request.error ?? new Error('Failed to load artwork blob'))
    })
  } finally {
    db.close()
  }
}

const saveArtworkBlobToFilesystem = async (ip: string, index: number, name: string, blob: Blob) => {
  const filePath = makeArtworkFilePath(ip, index, name, blob)
  const data = await blobToBase64(blob)
  await Filesystem.writeFile({
    path: filePath,
    data,
    directory: ARTWORK_DIRECTORY,
    recursive: true
  })
  return filePath
}

const loadArtworkFromFilesystem = async (artwork: StoredArtwork) => {
  if (!artwork.filePath) return undefined

  const result = await Filesystem.readFile({
    path: artwork.filePath,
    directory: ARTWORK_DIRECTORY
  })

  if (result.data instanceof Blob) {
    return URL.createObjectURL(result.data)
  }

  return toDataUrl(result.data, artwork.mimeType || getMimeType(artwork.name))
}

const loadAllGroups = (): IpThumbnailGroup[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveAllGroups = (groups: IpThumbnailGroup[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
}

const findGroupByIp = (ip: string): IpThumbnailGroup | undefined => {
  return loadAllGroups().find(g => g.ip === ip)
}

const saveThumbnailToIp = (ip: string, index: number, dataUrl: string) => {
  const groups = loadAllGroups()
  let group = groups.find(g => g.ip === ip)
  if (!group) {
    if (groups.length >= MAX_IP_GROUPS) {
      groups.shift()
    }
    group = { ip, thumbnails: {} }
    groups.push(group)
  }
  group.thumbnails[index] = dataUrl
  saveAllGroups(groups)
}

const saveArtworkToIp = async (ip: string, index: number, artwork: StoredArtwork, blob?: Blob) => {
  const groups = loadAllGroups()
  let group = groups.find(g => g.ip === ip)
  if (!group) {
    if (groups.length >= MAX_IP_GROUPS) {
      groups.shift()
    }
    group = { ip, thumbnails: {}, images: {} }
    groups.push(group)
  }
  if (!group.images) {
    group.images = {}
  }

  let filePath: string | undefined
  let storageKey = artwork.storageKey
  const mimeType = blob ? getMimeType(artwork.name, blob) : artwork.mimeType

  if (blob && isNativeStorage()) {
    try {
      filePath = await saveArtworkBlobToFilesystem(ip, index, artwork.name, blob)
      storageKey = undefined
    } catch (error) {
      console.error('Failed to persist artwork file:', error)
    }
  }

  if (blob && !filePath) {
    storageKey = makeArtworkStorageKey(ip, index)
    try {
      await putArtworkBlob(storageKey, artwork.name, blob)
    } catch (error) {
      console.error('Failed to persist artwork blob:', error)
      storageKey = undefined
    }
  }

  group.images[index] = {
    ...artwork,
    filePath,
    mimeType,
    storageKey,
    updatedAt: Date.now()
  }
  saveAllGroups(groups)
}

const loadThumbnailsForIp = (ip: string): Record<number, string> => {
  const group = findGroupByIp(ip)
  return group ? { ...group.thumbnails } : {}
}

const loadArtworkForIp = async (ip: string, index: number): Promise<StoredArtwork | undefined> => {
  const group = findGroupByIp(ip)
  const artwork = group?.images?.[index]
  if (!artwork) return undefined

  if (artwork.filePath && isNativeStorage()) {
    try {
      const url = await loadArtworkFromFilesystem(artwork)
      if (url) {
        return { ...artwork, url }
      }
    } catch (error) {
      console.error('Failed to load artwork file:', error)
    }
  }

  if (artwork.storageKey) {
    try {
      const cachedArtwork = await getArtworkBlob(artwork.storageKey)
      if (cachedArtwork?.blob) {
        return {
          ...artwork,
          name: artwork.name || cachedArtwork.name,
          url: URL.createObjectURL(cachedArtwork.blob)
        }
      }
    } catch (error) {
      console.error('Failed to load cached artwork:', error)
    }
  }

  if (artwork.url && !artwork.url.startsWith('blob:')) {
    return artwork
  }

  return undefined
}

export type { StoredArtwork }
export { STORAGE_KEY, loadArtworkForIp, loadThumbnailsForIp, saveArtworkToIp, saveThumbnailToIp }
