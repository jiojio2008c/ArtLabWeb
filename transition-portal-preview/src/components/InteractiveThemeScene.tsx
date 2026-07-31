import type { RefObject } from 'react'
import { ArrowLeft, RotateCcw, Sparkles } from 'lucide-react'
import type { InteractiveCardSize } from '../types.ts'

interface InteractiveThemeSceneProps {
  rootRef: RefObject<HTMLElement>
  visible: boolean
  cardSize: InteractiveCardSize
  onBackHome: () => void
  onCardSizeChange: (size: InteractiveCardSize) => void
  onReplay: () => void
}

const themes = [
  {
    id: 'ocean',
    title: '美麗海洋',
    mask: '多種魚類',
    image: '/assets/interactive-ocean.jpg',
    effect: 'ocean'
  },
  {
    id: 'forest-1',
    title: '魔幻森林1',
    mask: '多種動物',
    image: '/assets/interactive-forest-1.jpg',
    effect: 'forest-one'
  },
  {
    id: 'forest-2',
    title: '魔幻森林2',
    mask: '多種動物',
    image: '/assets/interactive-forest-2.jpg',
    effect: 'forest-two'
  },
  {
    id: 'painting',
    title: '畫境成真',
    mask: '繽紛建築',
    image: '/assets/interactive-painting.png',
    effect: 'painting'
  }
]

const InteractiveThemeScene: React.FC<InteractiveThemeSceneProps> = ({
  rootRef,
  visible,
  cardSize,
  onBackHome,
  onCardSizeChange,
  onReplay
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
      {themes.map((theme, index) => (
        <button
          key={theme.id}
          type="button"
          className={`interactive-theme-card theme-${theme.effect}`}
          style={{ '--theme-index': index } as React.CSSProperties}
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
            <span className="interactive-theme-mask">{theme.mask}</span>
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
