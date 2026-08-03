import type { RefObject } from 'react'
import { ArrowLeft, RotateCcw, Sparkles } from 'lucide-react'
import type { InteractiveCardSize } from '../types.ts'
import { INTERACTIVE_THEMES, type InteractiveTheme } from './interactiveThemeData.ts'

interface InteractiveThemeSceneProps {
  rootRef: RefObject<HTMLElement>
  visible: boolean
  cardSize: InteractiveCardSize
  onBackHome: () => void
  onCardSizeChange: (size: InteractiveCardSize) => void
  onReplay: () => void
  onOpenTheme: (theme: InteractiveTheme, card: HTMLButtonElement) => void
  transitioning: boolean
}

const InteractiveThemeScene: React.FC<InteractiveThemeSceneProps> = ({
  rootRef,
  visible,
  cardSize,
  onBackHome,
  onCardSizeChange,
  onReplay,
  onOpenTheme,
  transitioning
}) => (
  <section
    ref={rootRef}
    className={`interactive-theme-scene card-size-${cardSize} ${visible ? 'is-visible' : ''}`}
    aria-label="互動藝術主題選擇"
    aria-hidden={!visible}
  >
    <div className="interactive-ambient" aria-hidden="true">
      <span className="ambient-rift rift-one" />
      <span className="ambient-rift rift-two" />
      <span className="ambient-thread thread-one" />
      <span className="ambient-thread thread-two" />
    </div>

    <header className="interactive-theme-header interactive-reveal">
      <button type="button" className="interactive-back-button" onClick={onBackHome}>
        <ArrowLeft aria-hidden="true" />
        <span>返回首頁</span>
      </button>
      <div className="interactive-heading">
        <p><Sparkles aria-hidden="true" /> MagicFloor</p>
        <h1>選擇快速上載類型</h1>
      </div>
      <span className="interactive-header-status">互動藝術</span>
    </header>

    <div className="interactive-theme-grid">
      {INTERACTIVE_THEMES.map((theme, index) => (
        <button
          key={theme.id}
          type="button"
          className={`interactive-theme-card theme-${theme.effect}`}
          style={{ '--theme-index': index } as React.CSSProperties}
          data-theme-id={theme.id}
          disabled={transitioning}
          onClick={(event) => onOpenTheme(theme, event.currentTarget)}
        >
          <span className="interactive-theme-media">
            <img src={theme.image} alt="" draggable={false} />
            <span className="interactive-theme-effect" aria-hidden="true">
              {theme.effect.startsWith('forest') && Array.from({ length: 8 }, (_, moteIndex) => (
                <i key={moteIndex} style={{ '--mote-index': moteIndex } as React.CSSProperties} />
              ))}
            </span>
          </span>
          <span className="interactive-theme-copy">
            <strong>{theme.title}</strong>
            <span className="interactive-theme-mask">{theme.maskLabel}</span>
          </span>
          <span className="interactive-theme-edge" aria-hidden="true" />
        </button>
      ))}
    </div>

    <div className="interactive-card-size-switch" role="group" aria-label="選擇項尺寸">
      <button
        type="button"
        className={cardSize === 'current' ? 'active' : ''}
        aria-pressed={cardSize === 'current'}
        onClick={() => onCardSizeChange('current')}
      >
        目前尺寸
      </button>
      <button
        type="button"
        className={cardSize === 'compact' ? 'active' : ''}
        aria-pressed={cardSize === 'compact'}
        onClick={() => onCardSizeChange('compact')}
      >
        緊湊目錄
      </button>
    </div>

    <button type="button" className="magic-replay-button interactive-reveal" onClick={onReplay}>
      <RotateCcw aria-hidden="true" />
      <span>重播魔幻轉場</span>
    </button>
  </section>
)

export default InteractiveThemeScene
