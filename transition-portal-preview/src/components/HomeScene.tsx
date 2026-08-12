import type { RefObject } from 'react'
import { Settings } from 'lucide-react'

interface HomeSceneProps {
  rootRef: RefObject<HTMLElement>
  dynamicCardRef: RefObject<HTMLButtonElement>
  interactiveCardRef: RefObject<HTMLButtonElement>
  transitioning: boolean
  transitionKind?: 'dynamic' | 'interactive'
  onOpenDynamic: () => void
  onOpenInteractive: () => void
}

const HomeScene: React.FC<HomeSceneProps> = ({
  rootRef,
  dynamicCardRef,
  interactiveCardRef,
  transitioning,
  transitionKind,
  onOpenDynamic,
  onOpenInteractive
}) => (
  <section
    ref={rootRef}
    className={`home-scene paper-world ${transitioning ? 'is-transitioning' : ''} ${transitionKind ? `transitioning-${transitionKind}` : ''}`}
    aria-label="MagicFloor 首頁"
  >
    <span className="home-background-plane home-fade" aria-hidden="true" />

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

      <button
        ref={interactiveCardRef}
        type="button"
        className="art-entry-card interactive-card home-fade"
        onClick={onOpenInteractive}
        disabled={transitioning}
      >
        <span className="entry-image-shell">
          <img src="/assets/Magic_floor_UI_art.png" alt="" draggable={false} />
          <span className="hologram-grid" aria-hidden="true" />
        </span>
        <strong>互動藝術</strong>
        <span className="card-portal-corners" aria-hidden="true" />
      </button>
    </div>
  </section>
)

export default HomeScene
