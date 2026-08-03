import { useEffect } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { playUiSound } from '../services/uiFeedback.ts'

interface DirectUploadCompletePageProps {
  result: {
    name: string
    url: string
  } | null
  onBackToEntry: () => void
  onReupload: () => void
}

const DirectUploadCompletePage: React.FC<DirectUploadCompletePageProps> = ({
  result,
  onBackToEntry,
  onReupload
}) => {
  const { t } = useTranslation()
  useEffect(() => {
    const timer = window.setTimeout(() => playUiSound('artwork-arrived'), 180)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <main className="ipad-screen direct-complete-screen apple-container">
      <header className="ipad-topbar">
        <div className="min-w-0">
          <p className="eyebrow">{t('directComplete.eyebrow')}</p>
          <h1 className="screen-title">{t('directComplete.title')}</h1>
        </div>
      </header>

      <section className="direct-complete-workspace">
        <div className="complete-preview-panel">
          {result?.url ? (
            <img src={result.url} alt={t('directComplete.previewAlt')} className="complete-preview-image" />
          ) : (
            <div className="complete-empty-preview">{t('directComplete.title')}</div>
          )}
        </div>

        <aside className="complete-summary-panel" role="status" aria-live="polite">
          <div className="complete-mark" aria-hidden="true">
            <Check />
          </div>
          <p className="eyebrow">{t('directComplete.result')}</p>
          <h2>{t('directComplete.sent')}</h2>
          <div className="complete-meta">
            <span>{t('common.file')}</span>
            <strong>{result?.name ?? t('directComplete.unknownFile')}</strong>
          </div>
        </aside>
      </section>

      <div className="direct-complete-actions">
        <button type="button" className="ipad-button secondary-button" onClick={onBackToEntry}>
          {t('common.backHome')}
        </button>
        <button type="button" className="ipad-button primary-button" onClick={onReupload}>
          {t('directComplete.uploadAgain')}
        </button>
      </div>
    </main>
  )
}

export default DirectUploadCompletePage
