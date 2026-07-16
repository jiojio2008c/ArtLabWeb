import React, { useEffect, useRef, useState } from 'react'
import { loadArtworkForIp, loadThumbnailsForIp, type StoredArtwork } from '../services/artworkStorage.ts'
import { saveLastWsIp } from '../services/appSettings.ts'
import { CONTROL_PORT } from '../services/networkConfig.ts'

interface HomePageProps {
  onSelectObject: (index: number, existingImage?: StoredArtwork) => void
  wsIp: string
  onWsIpChange: (ip: string) => void
  onBackToEntry: () => void
}

const HomePage: React.FC<HomePageProps> = ({ onSelectObject, wsIp, onWsIpChange, onBackToEntry }) => {
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

    saveLastWsIp(ip)
    setThumbnails(loadThumbnailsForIp(ip))
  }

  const sendHttpMessage = async (message: string) => {
    const ip = wsIp.trim()
    if (!ip) return

    const url = `http://${ip}:${CONTROL_PORT}`
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
    const ip = wsIp.trim()
    if (ip) {
      saveLastWsIp(ip)
    }

    sendHttpMessage(`GameObject:${index}`)
    setSelectedSlot(index)

    const selectionToken = selectionTokenRef.current + 1
    selectionTokenRef.current = selectionToken
    if (slotTimerRef.current !== null) {
      window.clearTimeout(slotTimerRef.current)
    }

    slotTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const storedArtwork = await loadArtworkForIp(ip, index)
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
        <div className="topbar-title-row">
          <button type="button" onClick={onBackToEntry} className="ipad-button ghost-button">
            返回入口
          </button>
          <div className="min-w-0">
            <p className="eyebrow">MagicFloor</p>
            <h1 className="screen-title">作品控制上載</h1>
          </div>
        </div>

        <div className="topbar-controls">
          <div className="ip-control">
            <span className="control-label">HTTP</span>
            <input
              type="text"
              value={wsIp}
              onChange={(event) => onWsIpChange(event.target.value)}
              placeholder="藝術畫廊 IP"
              className="ipad-input ip-input"
            />
            <button type="button" onClick={handleLoadConfig} className="ipad-button compact-button">
              載入
            </button>
            <span className="port-chip">:{CONTROL_PORT}</span>
          </div>
          <span className="status-pill">HTTP 直送</span>
        </div>
      </header>

      <section className="home-workspace">
        <div className="showcase-panel">
          <video src="fish.mp4" autoPlay loop muted playsInline className="showcase-video" />
          <div className="showcase-shade" />
          <div className="showcase-content">
            <p className="eyebrow light">MagicFloor</p>
            <h2>選擇一個作品槽位</h2>
            <p>進入已有作品可直接打開控制頁；空槽位會進入上載流程。</p>
          </div>
        </div>

        <div className="slot-workspace">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">作品槽位</p>
              <h2>作品槽位</h2>
            </div>
            <span className="status-pill">{Object.keys(thumbnails).length}/20 已快取</span>
          </div>

          <div className="slot-grid">
            {Array.from({ length: 20 }, (_, index) => index).map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleObjectClick(index)}
                className={`slot-tile ${thumbnails[index] ? 'has-thumbnail' : ''} ${selectedSlot === index ? 'is-selected' : ''}`}
                aria-label={`選擇作品槽位 ${index}`}
              >
                {thumbnails[index] ? (
                  <img src={thumbnails[index]} alt={`作品槽位 ${index}`} />
                ) : (
                  <span className="slot-empty">{String(index).padStart(2, '0')}</span>
                )}
                <span className="slot-number">{index}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default HomePage
