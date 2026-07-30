import { useRef, useState, type RefObject } from 'react'
import { gsap } from 'gsap'
import {
  ArrowLeft,
  ChevronRight,
  FilePlus2,
  FolderPlus,
  Grid2X2,
  List,
  MoreHorizontal,
  RotateCcw
} from 'lucide-react'
import { BaoIllustration } from './StoryIllustrations.tsx'
import type { PortalOrigin, TransitionMode } from '../types.ts'

interface LibrarySceneProps {
  rootRef: RefObject<HTMLElement>
  visible: boolean
  mode: TransitionMode
  onBackHome: () => void
  onReplay: () => void
  onOpenMaterial: (origin: PortalOrigin) => void
}

const folders = [
  { name: '我們這一家', count: '1 個素材', tone: 'sunny' },
  { name: '小學一班', count: '2 個素材', tone: 'mint' }
]

const LibraryScene: React.FC<LibrarySceneProps> = ({
  rootRef,
  visible,
  mode,
  onBackHome,
  onReplay,
  onOpenMaterial
}) => {
  const [depth, setDepth] = useState<'root' | 'family'>('root')
  const [transitioning, setTransitioning] = useState(false)
  const rootLayerRef = useRef<HTMLDivElement>(null)
  const folderLayerRef = useRef<HTMLDivElement>(null)
  const breadcrumbRef = useRef<HTMLElement>(null)
  const materialCardRef = useRef<HTMLElement>(null)

  const clearLayerStyles = () => {
    const targets = [
      rootLayerRef.current,
      folderLayerRef.current,
      breadcrumbRef.current,
      ...Array.from(rootLayerRef.current?.querySelectorAll('.folder-card, .folder-lid') ?? []),
      ...Array.from(folderLayerRef.current?.querySelectorAll('.material-card') ?? [])
    ].filter(Boolean)
    gsap.set(targets, { clearProps: 'all' })
  }

  const openFolder = (selectedCard: HTMLElement) => {
    if (transitioning || !rootLayerRef.current || !folderLayerRef.current || !breadcrumbRef.current) return
    setTransitioning(true)
    const folderLayer = folderLayerRef.current
    const breadcrumb = breadcrumbRef.current
    const cards = Array.from(rootLayerRef.current.querySelectorAll<HTMLElement>('.folder-card'))
    const otherCards = cards.filter((card) => card !== selectedCard)
    const lid = selectedCard.querySelector('.folder-lid')
    const material = folderLayer.querySelector('.material-card')

    gsap.set(folderLayer, { visibility: 'visible', pointerEvents: 'none' })
    gsap.set(breadcrumb, { visibility: 'visible' })

    const timeline = gsap.timeline({
      onComplete: () => {
        setDepth('family')
        setTransitioning(false)
        gsap.set(rootLayerRef.current, { visibility: 'hidden', pointerEvents: 'none' })
        gsap.set(folderLayer, { clearProps: 'pointerEvents', visibility: 'visible' })
      }
    })

    if (mode === 'storybook') {
      timeline
        .to(selectedCard, { scale: 0.96, duration: 0.11, ease: 'power2.out' }, 0)
        .to(lid, { rotationY: -15, rotationX: -34, y: -5, duration: 0.18, ease: 'power2.out' }, 0.03)
        .to(otherCards, { opacity: 0, x: 50, duration: 0.18, ease: 'power2.in' }, 0.08)
        .to(selectedCard, { opacity: 0, y: -10, duration: 0.16, ease: 'power2.in' }, 0.14)
        .fromTo(breadcrumb, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, 0.15)
        .fromTo(material, { opacity: 0, scale: 0.8, y: 24 }, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.28,
          ease: 'back.out(1.35)'
        }, 0.18)
    } else {
      const selectedRect = selectedCard.getBoundingClientRect()
      const layerRect = folderLayer.getBoundingClientRect()
      const offsetX = selectedRect.left + selectedRect.width / 2 - (layerRect.left + 150)
      const offsetY = selectedRect.top + selectedRect.height / 2 - (layerRect.top + 92)
      timeline
        .to(selectedCard, {
          scale: 1.025,
          y: -8,
          boxShadow: '0 18px 36px rgba(19, 71, 80, .26)',
          duration: 0.16,
          ease: 'power2.out'
        }, 0)
        .to(otherCards, { opacity: 0, scale: 0.96, y: 10, duration: 0.22, ease: 'power2.in' }, 0.08)
        .to(selectedCard, { opacity: 0, scale: 1.06, duration: 0.2, ease: 'power2.in' }, 0.16)
        .fromTo(breadcrumb, { opacity: 0, x: -18 }, { opacity: 1, x: 0, duration: 0.24, ease: 'power2.out' }, 0.15)
        .fromTo(material, { opacity: 0, x: offsetX, y: offsetY, scale: 0.72 }, {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          duration: 0.38,
          ease: 'power3.out'
        }, 0.14)
    }
  }

  const closeFolder = () => {
    if (transitioning || !rootLayerRef.current || !folderLayerRef.current || !breadcrumbRef.current) return
    setTransitioning(true)
    const rootLayer = rootLayerRef.current
    const folderLayer = folderLayerRef.current
    const cards = Array.from(rootLayer.querySelectorAll<HTMLElement>('.folder-card'))
    const material = folderLayer.querySelector('.material-card')

    gsap.set(rootLayer, { visibility: 'visible', pointerEvents: 'none' })
    const timeline = gsap.timeline({
      onComplete: () => {
        setDepth('root')
        setTransitioning(false)
        clearLayerStyles()
        gsap.set(folderLayer, { visibility: 'hidden', pointerEvents: 'none' })
      }
    })

    timeline
      .to(material, {
        opacity: 0,
        scale: mode === 'storybook' ? 0.82 : 0.72,
        y: mode === 'storybook' ? 20 : 8,
        duration: 0.2,
        ease: 'power2.in'
      }, 0)
      .to(breadcrumbRef.current, { opacity: 0, x: -12, duration: 0.18, ease: 'power2.in' }, 0)
      .fromTo(cards, { opacity: 0, y: 12, scale: 0.96 }, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.28,
        stagger: 0.045,
        ease: 'power2.out'
      }, 0.13)
  }

  const handleBack = () => {
    if (depth === 'family') closeFolder()
    else onBackHome()
  }

  const handleOpenMaterial = () => {
    if (transitioning || !materialCardRef.current) return
    const rect = materialCardRef.current.getBoundingClientRect()
    onOpenMaterial({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
  }

  return (
    <section
      ref={rootRef}
      className={`library-scene paper-world ${visible ? 'is-visible' : ''} depth-${depth}`}
      aria-label="作品檔案"
      aria-hidden={!visible}
    >
      <header className="library-topbar library-reveal">
        <div className="library-title-block">
          <button type="button" className="toolbar-button back-button" onClick={handleBack} disabled={transitioning}>
            <ArrowLeft aria-hidden="true" />
            <span>{depth === 'family' ? '上一層' : '返回'}</span>
          </button>
          <div>
            <p>動態藝術</p>
            <h1>作品檔案</h1>
          </div>
        </div>

        <div className="library-actions">
          <div className="view-switch" aria-label="檢視方式">
            <button type="button" className="active" aria-label="圖示模式"><Grid2X2 /></button>
            <button type="button" aria-label="詳細模式"><List /></button>
          </div>
          <label className="sort-control">
            <span>排序</span>
            <select defaultValue="updated" aria-label="排序方式">
              <option value="updated">修改日期</option>
              <option value="name">名稱</option>
            </select>
          </label>
          <button type="button" className="toolbar-button secondary-action">
            <FolderPlus aria-hidden="true" />
            <span>新建資料夾</span>
          </button>
          <button type="button" className="toolbar-button primary-action">
            <FilePlus2 aria-hidden="true" />
            <span>新建素材</span>
          </button>
        </div>
      </header>

      <nav ref={breadcrumbRef} className="library-breadcrumbs" aria-label="目前路徑">
        <button type="button" onClick={closeFolder}>作品檔案</button>
        <ChevronRight aria-hidden="true" />
        <strong>我們這一家</strong>
      </nav>

      <div className="library-content-stage">
        <div ref={rootLayerRef} className="library-depth-layer root-library-layer">
          <div className="library-grid" aria-label="作品素材庫">
            {folders.map((folder, index) => (
              <article
                key={folder.name}
                className={`folder-card library-item root-folder-card ${folder.tone}`}
                style={{ '--item-index': index } as React.CSSProperties}
              >
                <button
                  type="button"
                  className="folder-card-main"
                  onClick={(event) => {
                    if (index === 0) openFolder(event.currentTarget.closest<HTMLElement>('.folder-card')!)
                  }}
                >
                  <span className="folder-art">
                    <span className="folder-symbol" aria-hidden="true">
                      <span className="folder-tab" />
                      <span className="folder-body" />
                      <span className="folder-lid" />
                    </span>
                    <span className="folder-scan" aria-hidden="true" />
                  </span>
                  <span className="folder-copy">
                    <strong>{folder.name}</strong>
                    <small>{folder.count}</small>
                  </span>
                </button>
                <button type="button" className="more-button" aria-label={`${folder.name} 選單`}>
                  <MoreHorizontal aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        </div>

        <div ref={folderLayerRef} className="library-depth-layer folder-library-layer">
          <div className="folder-material-grid">
            <article ref={materialCardRef} className="material-card">
              <button type="button" className="material-card-main" onClick={handleOpenMaterial}>
                <span className="material-preview">
                  <BaoIllustration className="material-bao" />
                  <span className="material-preview-glow" aria-hidden="true" />
                </span>
                <span className="material-copy">
                  <strong>gggg</strong>
                  <small>2 個物件</small>
                </span>
              </button>
              <button type="button" className="more-button" aria-label="gggg 選單">
                <MoreHorizontal aria-hidden="true" />
              </button>
            </article>
          </div>
        </div>
      </div>

      {depth === 'root' && (
        <button type="button" className="replay-button library-reveal" onClick={onReplay}>
          <RotateCcw aria-hidden="true" />
          <span>重播首頁轉場</span>
        </button>
      )}
    </section>
  )
}

export default LibraryScene
