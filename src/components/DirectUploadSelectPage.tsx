import type { RefObject } from 'react'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { DIRECT_UPLOAD_THEMES, type DirectUploadTheme } from '../services/directUploadThemes.ts'

interface DirectUploadSelectPageProps {
  rootRef: RefObject<HTMLElement>
  selectedThemeId: string
  transitioning: boolean
  onBackToEntry: () => void
  onSelectTheme: (theme: DirectUploadTheme, card: HTMLButtonElement) => void
}

const MASK_CATEGORY_LABELS: Record<DirectUploadTheme['maskPrefix'], string> = {
  A: '多種動物',
  B: '繽紛建築',
  C: '多種魚類'
}

const DirectUploadSelectPage: React.FC<DirectUploadSelectPageProps> = ({
  rootRef,
  selectedThemeId,
  transitioning,
  onBackToEntry,
  onSelectTheme
}) => {
  return (
    <main ref={rootRef} className="ipad-screen direct-select-screen apple-container">
      <div className="direct-magic-ambient" aria-hidden="true">
        <span className="direct-ambient-rift rift-one" />
        <span className="direct-ambient-rift rift-two" />
        <span className="direct-ambient-thread thread-one" />
        <span className="direct-ambient-thread thread-two" />
      </div>

      <header className="ipad-topbar direct-magic-header direct-magic-reveal">
        <button type="button" onClick={onBackToEntry} className="direct-magic-back-button">
          <ArrowLeft aria-hidden="true" />
          <span>返回首頁</span>
        </button>
        <div className="direct-magic-heading">
          <p><Sparkles aria-hidden="true" /> MagicFloor</p>
          <h1>選擇快速上載類型</h1>
        </div>
        <span className="direct-magic-status">互動藝術</span>
      </header>

      <section className="direct-select-workspace">
        {DIRECT_UPLOAD_THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`direct-theme-card direct-theme-${theme.id} ${selectedThemeId === theme.id ? 'active' : ''}`}
            data-theme-id={theme.id}
            disabled={transitioning}
            onClick={(event) => onSelectTheme(theme, event.currentTarget)}
          >
            <span className="direct-theme-media">
              <img src={theme.cover} alt={theme.label} className="direct-theme-image" />
              <span className="direct-theme-effect" aria-hidden="true">
                {theme.id.startsWith('forest') && Array.from({ length: 8 }, (_, index) => (
                  <i key={index} style={{ '--mote-index': index } as React.CSSProperties} />
                ))}
              </span>
              <span className="direct-theme-shade" />
            </span>
            <span className="direct-theme-content">
              <strong>{theme.label}</strong>
              <span className="direct-theme-mask">{MASK_CATEGORY_LABELS[theme.maskPrefix]}</span>
            </span>
            <span className="direct-theme-edge" aria-hidden="true" />
          </button>
        ))}
      </section>
    </main>
  )
}

export default DirectUploadSelectPage
