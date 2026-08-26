import type { RefObject } from 'react'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DIRECT_UPLOAD_THEMES, type DirectUploadTheme } from '../services/directUploadThemes.ts'

interface DirectUploadSelectPageProps {
  rootRef: RefObject<HTMLElement>
  selectedThemeId: string
  transitioning: boolean
  onBackToEntry: () => void
  onSelectTheme: (theme: DirectUploadTheme, card: HTMLButtonElement) => void
}

const MASK_CATEGORY_LABEL_KEYS: Record<DirectUploadTheme['maskPrefix'], 'directSelect.animals' | 'directSelect.buildings' | 'directSelect.fish'> = {
  A: 'directSelect.animals',
  B: 'directSelect.buildings',
  C: 'directSelect.fish'
}

const DirectUploadSelectPage: React.FC<DirectUploadSelectPageProps> = ({
  rootRef,
  selectedThemeId,
  transitioning,
  onBackToEntry,
  onSelectTheme
}) => {
  const { t } = useTranslation()
  return (
    <main ref={rootRef} className="ipad-screen direct-select-screen apple-container">
      <div className="direct-magic-ambient" aria-hidden="true">
        <span className="direct-ambient-rift rift-one" />
        <span className="direct-ambient-rift rift-two" />
        <span className="direct-ambient-thread thread-one" />
        <span className="direct-ambient-thread thread-two" />
      </div>

      <header className="ipad-topbar direct-magic-header direct-magic-reveal">
        <button
          type="button"
          onClick={onBackToEntry}
          className="direct-magic-back-button"
          disabled={transitioning}
        >
          <ArrowLeft aria-hidden="true" />
          <span>{t('directSelect.back')}</span>
        </button>
        <div className="direct-magic-heading">
          <p><Sparkles aria-hidden="true" /> MagicFloor</p>
          <h1>{t('directSelect.title')}</h1>
        </div>
        <span className="direct-magic-status">{t('directSelect.section')}</span>
      </header>

      <section className="direct-select-workspace">
        {DIRECT_UPLOAD_THEMES.map((theme) => (
          <div key={theme.id} className="direct-theme-card-motion" data-theme-motion-id={theme.id}>
            <button
              type="button"
              className={`direct-theme-card direct-theme-${theme.id} ${selectedThemeId === theme.id ? 'active' : ''}`}
              data-theme-id={theme.id}
              disabled={transitioning}
              onClick={(event) => onSelectTheme(theme, event.currentTarget)}
            >
              <span className="direct-theme-media">
                <img src={theme.cover} alt={t(theme.labelKey)} className="direct-theme-image" />
                <span className="direct-theme-effect" aria-hidden="true">
                  {theme.id.startsWith('forest') && Array.from({ length: 8 }, (_, index) => (
                    <i key={index} style={{ '--mote-index': index } as React.CSSProperties} />
                  ))}
                </span>
                <span className="direct-theme-shade" />
              </span>
              <span className="direct-theme-content">
                <strong>{t(theme.labelKey)}</strong>
                <span className="direct-theme-mask">{t(MASK_CATEGORY_LABEL_KEYS[theme.maskPrefix])}</span>
              </span>
              <span className="direct-theme-edge" aria-hidden="true" />
            </button>
          </div>
        ))}
      </section>
    </main>
  )
}

export default DirectUploadSelectPage
