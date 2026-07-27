import { useRef, useState } from 'react'
import { saveLastWsIp } from '../services/appSettings.ts'
import type { DynamicGroup, DynamicMedia } from '../services/dynamicArtStorage.ts'

interface EntryPageProps {
  wsIp: string
  dynamicGroups: DynamicGroup[]
  onOpenDynamicArt: () => void
  onOpenDynamicGroup: (group: DynamicGroup) => void
  onOpenInteractiveArt: () => void
  onOpenSettings: () => void
}

const LONG_PRESS_MS = 430
const MAX_PREVIEW_GROUPS = 4
const MAX_PREVIEW_ITEMS_PER_GROUP = 5
const RIGHT_LOGO_URL = new URL('../../Right_Logo.png', import.meta.url).href

const getGroupPreviewMedia = (group: DynamicGroup): DynamicMedia | undefined => (
  group.thumbnail ?? group.background ?? group.items[0]?.media
)

const EntryPage: React.FC<EntryPageProps> = ({
  wsIp,
  dynamicGroups,
  onOpenDynamicArt,
  onOpenDynamicGroup,
  onOpenInteractiveArt,
  onOpenSettings
}) => {
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const [dynamicPeekOpen, setDynamicPeekOpen] = useState(false)
  const previewGroups = dynamicGroups.slice(0, MAX_PREVIEW_GROUPS)

  const handleEnter = (next: () => void) => {
    const ip = wsIp.trim()
    if (ip) saveLastWsIp(ip)
    next()
  }

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const resetLongPressFlagSoon = () => {
    window.setTimeout(() => {
      longPressTriggeredRef.current = false
    }, 500)
  }

  const handleDynamicPointerDown = () => {
    longPressTriggeredRef.current = false
    clearLongPressTimer()
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true
      setDynamicPeekOpen(true)
    }, LONG_PRESS_MS)
  }

  const handleDynamicPointerEnd = () => {
    clearLongPressTimer()
    if (longPressTriggeredRef.current) {
      resetLongPressFlagSoon()
    }
  }

  const handleDynamicClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (longPressTriggeredRef.current) {
      event.preventDefault()
      event.stopPropagation()
      longPressTriggeredRef.current = false
      return
    }

    setDynamicPeekOpen(false)
    handleEnter(onOpenDynamicArt)
  }

  const handleDynamicContextMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    clearLongPressTimer()
    longPressTriggeredRef.current = true
    setDynamicPeekOpen(true)
    resetLongPressFlagSoon()
  }

  const handleGroupBubbleClick = (group: DynamicGroup) => {
    clearLongPressTimer()
    longPressTriggeredRef.current = false
    setDynamicPeekOpen(false)
    handleEnter(() => onOpenDynamicGroup(group))
  }

  return (
    <main className="ipad-screen entry-screen apple-container">
      <header className="ipad-topbar entry-topbar">
        <img className="entry-brand-logo" src={RIGHT_LOGO_URL} alt="MagicFloor" draggable={false} />

        <button
          type="button"
          className="settings-icon-button"
          onClick={onOpenSettings}
          aria-label="設定"
        >
          <span className="settings-gear-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.1-1.64-2-3.46-2.48 1a7.25 7.25 0 0 0-1.7-.98L15 3.28h-4l-.36 2.66c-.6.24-1.17.57-1.7.98l-2.48-1-2 3.46 2.1 1.64c-.04.32-.06.65-.06.98s.02.66.06.98l-2.1 1.64 2 3.46 2.48-1c.52.4 1.09.73 1.7.98L11 20.72h4l.35-2.66c.61-.25 1.18-.58 1.7-.98l2.48 1 2-3.46-2.1-1.64Z" />
              <circle cx="12" cy="12" r="3.2" />
            </svg>
          </span>
        </button>
      </header>

      <section className={`entry-choice-workspace ${dynamicPeekOpen ? 'dynamic-peek-open' : ''}`}>
        <div className="entry-choice-node dynamic-choice-node">
          <button
            type="button"
            className="entry-choice-card dynamic-choice-card"
            onPointerDown={handleDynamicPointerDown}
            onPointerUp={handleDynamicPointerEnd}
            onPointerCancel={handleDynamicPointerEnd}
            onPointerLeave={handleDynamicPointerEnd}
            onContextMenu={handleDynamicContextMenu}
            onClick={handleDynamicClick}
          >
            <img src="/MainIcon/8080.png" alt="" className="entry-choice-icon" draggable={false} />
            <span>動態藝術</span>
          </button>

          {dynamicPeekOpen && (
            <div className="entry-dynamic-peek" aria-label="作品檔案預覽">
              {previewGroups.length > 0 ? (
                previewGroups.map((group, groupIndex) => {
                  const media = getGroupPreviewMedia(group)
                  const previewItems = group.items.slice(0, MAX_PREVIEW_ITEMS_PER_GROUP)
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className="entry-group-bubble"
                      style={{ '--bubble-index': groupIndex } as React.CSSProperties}
                      onClick={() => handleGroupBubbleClick(group)}
                      aria-label={`開啟 ${group.name}`}
                    >
                      <div className="entry-group-thumb">
                        {media ? (
                          media.type === 'video' ? (
                            <video src={media.url} muted playsInline />
                          ) : (
                            <img src={media.url} alt={group.name} draggable={false} />
                          )
                        ) : (
                          <span>{group.name.slice(0, 1)}</span>
                        )}
                      </div>
                      <strong>{group.name}</strong>
                      <div className="entry-item-bubbles">
                        {previewItems.map((item, itemIndex) => (
                          <span
                            key={item.id}
                            className="entry-item-bubble"
                            style={{ '--item-index': itemIndex } as React.CSSProperties}
                          >
                            <img src={item.media.url} alt={item.name} draggable={false} />
                          </span>
                        ))}
                        {previewItems.length === 0 && (
                          <span className="entry-item-bubble empty" />
                        )}
                      </div>
                    </button>
                  )
                })
              ) : (
                <article className="entry-group-bubble empty">
                  <div className="entry-group-thumb">
                    <span>+</span>
                  </div>
                  <strong>新作品檔案</strong>
                  <div className="entry-item-bubbles">
                    <span className="entry-item-bubble empty" />
                    <span className="entry-item-bubble empty" />
                    <span className="entry-item-bubble empty" />
                  </div>
                </article>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="entry-choice-card interactive-choice-card"
          onClick={() => {
            setDynamicPeekOpen(false)
            handleEnter(onOpenInteractiveArt)
          }}
        >
          <img src="/MainIcon/Magic_floor_UI_art.png" alt="" className="entry-choice-icon" draggable={false} />
          <span>互動藝術</span>
        </button>
      </section>
    </main>
  )
}

export default EntryPage
