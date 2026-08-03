import { useEffect, useRef, useState, type RefObject } from 'react'
import { Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { saveLastWsIp } from '../services/appSettings.ts'
import type { DynamicGroup, DynamicMedia } from '../services/dynamicArtStorage.ts'
import type { DynamicTransitionOrigin } from './dynamicTransitions/types.ts'
import { preloadInteractiveTransitionAssets } from './interactiveTransitions/preloadInteractiveAssets.ts'

interface EntryPageProps {
  wsIp: string
  dynamicGroups: DynamicGroup[]
  onOpenDynamicArt: () => void
  onOpenDynamicGroup: (group: DynamicGroup, origin?: DynamicTransitionOrigin) => void
  onOpenInteractiveArt: () => void
  onOpenSettings: () => void
  rootRef?: RefObject<HTMLElement>
  dynamicCardRef?: RefObject<HTMLButtonElement>
  interactiveCardRef?: RefObject<HTMLButtonElement>
  transitioning?: boolean
  transitionType?: 'dynamic' | 'interactive'
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
  onOpenSettings,
  rootRef,
  dynamicCardRef,
  interactiveCardRef,
  transitioning = false,
  transitionType
}) => {
  const { t } = useTranslation()
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const [dynamicPeekOpen, setDynamicPeekOpen] = useState(false)
  const previewGroups = dynamicGroups.slice(0, MAX_PREVIEW_GROUPS)

  useEffect(() => {
    const preloadTimer = window.setTimeout(() => {
      void preloadInteractiveTransitionAssets()
    }, 120)

    return () => window.clearTimeout(preloadTimer)
  }, [])

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

  const handleGroupBubbleClick = (group: DynamicGroup, target: HTMLElement) => {
    clearLongPressTimer()
    longPressTriggeredRef.current = false
    setDynamicPeekOpen(false)
    const rect = target.getBoundingClientRect()
    handleEnter(() => onOpenDynamicGroup(group, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    }))
  }

  return (
    <main
      ref={rootRef}
      className={`ipad-screen entry-screen apple-container ${transitionType === 'dynamic' ? 'dynamic-home-transitioning' : ''} ${transitionType === 'interactive' ? 'interactive-home-transitioning' : ''}`}
    >
      <header className="ipad-topbar entry-topbar dynamic-home-fade">
        <img className="entry-brand-logo" src={RIGHT_LOGO_URL} alt="MagicFloor" draggable={false} />

        <button
          type="button"
          className="settings-icon-button"
          onClick={onOpenSettings}
          disabled={transitioning}
          aria-label={t('home.settings')}
        >
          <Settings aria-hidden="true" />
        </button>
      </header>

      <section className={`entry-choice-workspace ${dynamicPeekOpen ? 'dynamic-peek-open' : ''}`}>
        <div className="entry-choice-node dynamic-choice-node">
          <button
            ref={dynamicCardRef}
            type="button"
            className="entry-choice-card dynamic-choice-card dynamic-portal-card"
            onPointerDown={handleDynamicPointerDown}
            onPointerUp={handleDynamicPointerEnd}
            onPointerCancel={handleDynamicPointerEnd}
            onPointerLeave={handleDynamicPointerEnd}
            onContextMenu={handleDynamicContextMenu}
            onClick={handleDynamicClick}
            disabled={transitioning}
          >
            <span className="entry-choice-image-shell">
              <img src="/MainIcon/8080.png" alt="" className="entry-choice-icon" draggable={false} />
            </span>
            <span className="entry-choice-title">{t('home.dynamicArt')}</span>
            <i className="dynamic-portal-card-grid" aria-hidden="true" />
            <i className="dynamic-portal-card-corners" aria-hidden="true" />
          </button>

          {dynamicPeekOpen && (
            <div className="entry-dynamic-peek" aria-label={t('home.archivePreview')}>
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
                      onClick={(event) => handleGroupBubbleClick(group, event.currentTarget)}
                      aria-label={t('home.openArchive', { name: group.name })}
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
                  <strong>{t('home.newArchive')}</strong>
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
          ref={interactiveCardRef}
          type="button"
          className="entry-choice-card interactive-choice-card dynamic-home-fade"
          disabled={transitioning}
          onClick={() => {
            setDynamicPeekOpen(false)
            handleEnter(onOpenInteractiveArt)
          }}
        >
          <span className="entry-choice-image-shell">
            <img src="/MainIcon/Magic_floor_UI_art.png" alt="" className="entry-choice-icon" draggable={false} />
          </span>
          <span className="entry-choice-title">{t('home.interactiveArt')}</span>
          <i className="interactive-magic-card-aura" aria-hidden="true" />
        </button>
      </section>
    </main>
  )
}

export default EntryPage
