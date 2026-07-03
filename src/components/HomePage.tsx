import React, { useEffect, useRef, useState } from 'react'

interface HomePageProps {
  onSelectObject: (index: number, existingImage?: StoredArtwork) => void
  wsIp: string
  onWsIpChange: (ip: string) => void
}

const STORAGE_KEY = 'artlab_ip_thumbnails'
const MAX_IP_GROUPS = 3
const ARTWORK_DB_NAME = 'artlab_artwork_cache'
const ARTWORK_DB_VERSION = 1
const ARTWORK_STORE_NAME = 'artworks'

interface IpThumbnailGroup {
  ip: string
  thumbnails: Record<number, string>
  images?: Record<number, StoredArtwork>
}

interface StoredArtwork {
  name: string
  url: string
  storageKey?: string
}

interface ArtworkRecord {
  key: string
  name: string
  blob: Blob
  updatedAt: number
}

const makeArtworkStorageKey = (ip: string, index: number) => `${ip.trim()}::${index}`

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

  let storageKey = blob ? makeArtworkStorageKey(ip, index) : artwork.storageKey
  if (blob && storageKey) {
    try {
      await putArtworkBlob(storageKey, artwork.name, blob)
    } catch (error) {
      console.error('Failed to persist artwork blob:', error)
      storageKey = undefined
    }
  }

  group.images[index] = {
    ...artwork,
    storageKey
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

  if (artwork.storageKey) {
    try {
      const cachedArtwork = await getArtworkBlob(artwork.storageKey)
      if (cachedArtwork?.blob) {
        return {
          name: artwork.name || cachedArtwork.name,
          url: URL.createObjectURL(cachedArtwork.blob),
          storageKey: artwork.storageKey
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

const HomePage: React.FC<HomePageProps> = ({ onSelectObject, wsIp, onWsIpChange }) => {
  const [thumbnails, setThumbnails] = useState<Record<number, string>>(() => {
    if (wsIp.trim()) return loadThumbnailsForIp(wsIp.trim())
    return {}
  })
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const slotTimerRef = useRef<number | null>(null)
  const selectionTokenRef = useRef(0)

  useEffect(() => {
    return () => {
      if (slotTimerRef.current !== null) {
        window.clearTimeout(slotTimerRef.current)
      }
    }
  }, [])

  const handleLoadConfig = () => {
    const ip = wsIp.trim()
    if (!ip) return
    setThumbnails(loadThumbnailsForIp(ip))
  }

  const sendHttpMessage = async (message: string) => {
    if (!wsIp) return
    const url = `http://${wsIp}:8080`
    try {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url, true)
      xhr.setRequestHeader('Content-Type', 'text/plain')
      xhr.send(message)
    } catch (error) {
      console.error('HTTP POST failed:', error)
    }
  }

  const handleObjectClick = (index: number) => {
    sendHttpMessage(`GameObject:${index}`)
    setSelectedSlot(index)
    const selectionToken = selectionTokenRef.current + 1
    selectionTokenRef.current = selectionToken
    if (slotTimerRef.current !== null) {
      window.clearTimeout(slotTimerRef.current)
    }
    slotTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const storedArtwork = await loadArtworkForIp(wsIp.trim(), index)
        const fallbackArtwork = thumbnails[index]
          ? { name: `slot-${index}.png`, url: thumbnails[index] }
          : undefined
        if (selectionToken !== selectionTokenRef.current) return
        onSelectObject(index, storedArtwork ?? fallbackArtwork)
      })()
    }, 140)
  }

  return (
    <main className="ipad-screen home-screen apple-container">
      <header className="ipad-topbar">
        <div className="min-w-0">
          <p className="eyebrow">Art Lab</p>
          <h1 className="screen-title">作品上載</h1>
        </div>

        <div className="topbar-controls">
          <div className="ip-control">
            <span className="control-label">HTTP</span>
            <input
              type="text"
              value={wsIp}
              onChange={(e) => onWsIpChange(e.target.value)}
              placeholder="伺服器 IP"
              className="ipad-input ip-input"
            />
            <button onClick={handleLoadConfig} className="ipad-button compact-button">
              載入
            </button>
            <span className="port-chip">:8080</span>
          </div>
          <span className="status-pill">HTTP 直送</span>
        </div>
      </header>

      <section className="home-workspace">
        <div className="showcase-panel">
          <video src="fish.mp4" autoPlay loop muted playsInline className="showcase-video" />
          <div className="showcase-shade" />
          <div className="showcase-content">
            <p className="eyebrow light">Artwork to Life</p>
            <h2>選擇一個作品位置</h2>
            <p>已有作品的位置會直接進入控制頁，空位置會進入上傳流程。</p>
          </div>
        </div>

        <div className="slot-workspace">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Object Slots</p>
              <h2>作品位置</h2>
            </div>
            <span className="status-pill">{Object.keys(thumbnails).length}/20 已有縮圖</span>
          </div>

          <div className="slot-grid">
            {Array.from({ length: 20 }, (_, i) => i).map((idx) => (
              <button
                key={idx}
                onClick={() => handleObjectClick(idx)}
                className={`slot-tile ${thumbnails[idx] ? 'has-thumbnail' : ''} ${selectedSlot === idx ? 'is-selected' : ''}`}
                aria-label={`選擇作品位置 ${idx}`}
              >
                {thumbnails[idx] ? (
                  <img src={thumbnails[idx]} alt={`作品位置 ${idx}`} />
                ) : (
                  <span className="slot-empty">{String(idx).padStart(2, '0')}</span>
                )}
                <span className="slot-number">{idx}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default HomePage

export { saveThumbnailToIp, saveArtworkToIp, loadThumbnailsForIp, loadArtworkForIp, STORAGE_KEY }
