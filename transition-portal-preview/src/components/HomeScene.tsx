import type { RefObject } from 'react'
import { Settings } from 'lucide-react'

interface HomeSceneProps {
  rootRef: RefObject<HTMLElement>
  dynamicCardRef: RefObject<HTMLButtonElement>
  transitioning: boolean
  onOpenDynamic: () => void
}

const HomeScene: React.FC<HomeSceneProps> = ({
  rootRef,
  dynamicCardRef,
  transitioning,
  onOpenDynamic
}) => (
  <section
    ref={rootRef}
    className={`home-scene paper-world ${transitioning ? 'is-transitioning' : ''}`}
    aria-label="MagicFloor 首頁"
  >
    <header className="home-topbar home-fade">
      <img src="/assets/Right_Logo.png" className="brand-logo" alt="MagicFloor" draggable={false} />
      <button type="button" className="icon-button settings-button" aria-label="設定">
        <Settings aria-hidden="true" />
      </button>
    </header>

    <div className="home-card-row">
      <button
        ref={dynamicCardRef}
        type="button"
        className="art-entry-card dynamic-card"
        onClick={onOpenDynamic}
        disabled={transitioning}
      >
        <span className="entry-image-shell">
          <img src="/assets/8080.png" alt="" draggable={false} />
          <span className="hologram-grid" aria-hidden="true" />
        </span>
        <strong>動態藝術</strong>
        <span className="card-portal-corners" aria-hidden="true" />
      </button>

      <button type="button" className="art-entry-card interactive-card home-fade">
        <span className="entry-image-shell">
          <img src="/assets/Magic_floor_UI_art.png" alt="" draggable={false} />
        </span>
        <strong>互動藝術</strong>
      </button>
    </div>
  </section>
)

export default HomeScene
