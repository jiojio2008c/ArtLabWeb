import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Check, ImagePlus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { playUiSound } from '../services/uiFeedback.ts'
import { waitForImageElement, waitForStablePaint } from '../services/transitionPerformance.ts'

interface DirectUploadCompletePageProps {
  result: {
    name: string
    url: string
  } | null
  onBackToOptions: () => void
  onReupload: () => void
}

const DirectUploadCompletePage: React.FC<DirectUploadCompletePageProps> = ({
  result,
  onBackToOptions,
  onReupload
}) => {
  const { t } = useTranslation()
  const previewRef = useRef<HTMLImageElement>(null)
  const reuploadTriggerRef = useRef<HTMLButtonElement>(null)
  const reuploadDialogRef = useRef<HTMLElement>(null)
  const reuploadCancelRef = useRef<HTMLButtonElement>(null)
  const reuploadCloseTimerRef = useRef<number | null>(null)
  const reuploadDialogTitleId = useId()
  const reuploadDialogSafetyId = useId()
  const reuploadDialogDestinationId = useId()
  const [mediaReady, setMediaReady] = useState(false)
  const [reuploadConfirmOpen, setReuploadConfirmOpen] = useState(false)
  const [reuploadConfirmClosing, setReuploadConfirmClosing] = useState(false)

  const openReuploadConfirm = () => {
    if (reuploadConfirmOpen) return
    setReuploadConfirmClosing(false)
    setReuploadConfirmOpen(true)
  }

  const closeReuploadConfirm = useCallback((shouldReupload = false) => {
    if (!reuploadConfirmOpen || reuploadConfirmClosing) return

    setReuploadConfirmClosing(true)
    if (reuploadCloseTimerRef.current !== null) {
      window.clearTimeout(reuploadCloseTimerRef.current)
    }

    reuploadCloseTimerRef.current = window.setTimeout(() => {
      reuploadCloseTimerRef.current = null
      setReuploadConfirmOpen(false)
      setReuploadConfirmClosing(false)

      if (shouldReupload) {
        onReupload()
      } else {
        window.requestAnimationFrame(() => reuploadTriggerRef.current?.focus())
      }
    }, 180)
  }, [onReupload, reuploadConfirmClosing, reuploadConfirmOpen])

  useEffect(() => {
    let cancelled = false

    const prepareResult = async () => {
      const preview = previewRef.current
      if (preview) await waitForImageElement(preview, 1200)
      await waitForStablePaint(2)
      if (!cancelled) setMediaReady(true)
    }

    void prepareResult()
    return () => {
      cancelled = true
    }
  }, [result?.url])

  useEffect(() => {
    if (!mediaReady) return
    const timer = window.setTimeout(() => playUiSound('artwork-arrived'), 180)
    return () => window.clearTimeout(timer)
  }, [mediaReady])

  useEffect(() => {
    return () => {
      if (reuploadCloseTimerRef.current !== null) {
        window.clearTimeout(reuploadCloseTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!reuploadConfirmOpen) return

    const focusFrame = window.requestAnimationFrame(() => reuploadCancelRef.current?.focus())
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeReuploadConfirm(false)
        return
      }

      if (event.key !== 'Tab' || reuploadConfirmClosing) return

      const dialog = reuploadDialogRef.current
      if (!dialog) return

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.getAttribute('aria-hidden') !== 'true')

      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleDialogKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleDialogKeyDown)
    }
  }, [closeReuploadConfirm, reuploadConfirmClosing, reuploadConfirmOpen])

  return (
    <main className={`ipad-screen direct-complete-screen apple-container ${mediaReady ? 'is-media-ready' : 'is-media-preparing'}`}>
      <header className="ipad-topbar">
        <div className="min-w-0">
          <p className="eyebrow">{t('directComplete.eyebrow')}</p>
          <h1 className="screen-title">{t('directComplete.title')}</h1>
        </div>
      </header>

      <section className="direct-complete-workspace">
        <div className="complete-preview-panel">
          {result?.url ? (
            <img ref={previewRef} src={result.url} alt={t('directComplete.previewAlt')} className="complete-preview-image" />
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
        <button type="button" className="ipad-button secondary-button" onClick={onBackToOptions}>
          {t('directComplete.backToOptions')}
        </button>
        <button
          ref={reuploadTriggerRef}
          type="button"
          className="ipad-button primary-button"
          onClick={openReuploadConfirm}
        >
          {t('directComplete.uploadAgain')}
        </button>
      </div>

      {reuploadConfirmOpen && (
        <div className={`direct-reupload-confirm-overlay ${reuploadConfirmClosing ? 'is-closing' : ''}`}>
          <div className="direct-reupload-confirm-scrim" aria-hidden="true" />
          <section
            ref={reuploadDialogRef}
            className="direct-reupload-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={reuploadDialogTitleId}
            aria-describedby={`${reuploadDialogSafetyId} ${reuploadDialogDestinationId}`}
            tabIndex={-1}
          >
            <div className="direct-reupload-confirm-heading">
              <span className="direct-reupload-confirm-icon" aria-hidden="true">
                <ImagePlus />
              </span>
              <button
                type="button"
                className="direct-reupload-confirm-close"
                onClick={() => closeReuploadConfirm(false)}
                aria-label={t('common.close')}
                title={t('common.close')}
                disabled={reuploadConfirmClosing}
              >
                <X />
              </button>
            </div>

            <div className="direct-reupload-confirm-copy">
              <h2 id={reuploadDialogTitleId}>{t('directComplete.reuploadDialogTitle')}</h2>
              <p id={reuploadDialogSafetyId}>{t('directComplete.reuploadDialogSafety')}</p>
              <p id={reuploadDialogDestinationId}>{t('directComplete.reuploadDialogDestination')}</p>
            </div>

            <div className="direct-reupload-confirm-actions">
              <button
                ref={reuploadCancelRef}
                type="button"
                className="ipad-button secondary-button"
                onClick={() => closeReuploadConfirm(false)}
                disabled={reuploadConfirmClosing}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="ipad-button primary-button"
                onClick={() => closeReuploadConfirm(true)}
                disabled={reuploadConfirmClosing}
              >
                {t('directComplete.startUpload')}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default DirectUploadCompletePage
