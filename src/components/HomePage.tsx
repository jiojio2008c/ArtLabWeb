import React, { useEffect, useRef, useState } from 'react'

interface HomePageProps {
  onSelectObject: (index: number, existingImage?: StoredArtwork) => void
  wsIp: string
  onWsIpChange: (ip: string) => void
}

const STORAGE_KEY = 'artlab_ip_thumbnails'
const MAX_IP_GROUPS = 3

interface IpThumbnailGroup {
  ip: string
  thumbnails: Record<number, string>
  images?: Record<number, StoredArtwork>
}

interface StoredArtwork {
  name: string
  url: string
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

const saveArtworkToIp = (ip: string, index: number, artwork: StoredArtwork) => {
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
  group.images[index] = artwork
  saveAllGroups(groups)
}

const loadThumbnailsForIp = (ip: string): Record<number, string> => {
  const group = findGroupByIp(ip)
  return group ? { ...group.thumbnails } : {}
}

const loadArtworkForIp = (ip: string, index: number): StoredArtwork | undefined => {
  const group = findGroupByIp(ip)
  return group?.images?.[index]
}

const HomePage: React.FC<HomePageProps> = ({ onSelectObject, wsIp, onWsIpChange }) => {
  const [thumbnails, setThumbnails] = useState<Record<number, string>>(() => {
    if (wsIp.trim()) return loadThumbnailsForIp(wsIp.trim())
    return {}
  })
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const slotTimerRef = useRef<number | null>(null)

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
    if (slotTimerRef.current !== null) {
      window.clearTimeout(slotTimerRef.current)
    }
    slotTimerRef.current = window.setTimeout(() => {
      const storedArtwork = loadArtworkForIp(wsIp.trim(), index)
      const fallbackArtwork = thumbnails[index]
        ? { name: `slot-${index}.png`, url: thumbnails[index] }
        : undefined
      onSelectObject(index, storedArtwork ?? fallbackArtwork)
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
