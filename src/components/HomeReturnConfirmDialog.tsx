import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type HomeReturnScope = 'dynamic-art' | 'interactive-art'

interface HomeReturnConfirmDialogProps {
  scope: HomeReturnScope
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}

const HomeReturnConfirmDialog: React.FC<HomeReturnConfirmDialogProps> = ({
  scope,
  pending,
  onCancel,
  onConfirm
}) => {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const pendingRef = useRef(pending)
  const closingRef = useRef(false)
  const titleId = useId()
  const descriptionId = useId()
  const [closing, setClosing] = useState(false)

  pendingRef.current = pending
  closingRef.current = closing

  const closeDialog = useCallback(() => {
    if (pendingRef.current || closingRef.current) return

    setClosing(true)
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
    }

    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      onCancel()
      window.requestAnimationFrame(() => previousFocusRef.current?.focus())
    }, 180)
  }, [onCancel])

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const focusFrame = window.requestAnimationFrame(() => cancelRef.current?.focus())

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDialog()
        return
      }

      if (event.key !== 'Tab' || pendingRef.current || closingRef.current) return

      const dialog = dialogRef.current
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
  }, [closeDialog])

  useEffect(() => () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeDialog()
  }

  const descriptionKey = scope === 'dynamic-art'
    ? 'homeReturn.dynamicDescription'
    : 'homeReturn.interactiveDescription'

  return (
    <div
      className={`home-return-confirm-overlay${closing ? ' is-closing' : ''}`}
      onClick={handleOverlayClick}
    >
      <div className="home-return-confirm-scrim" aria-hidden="true" onClick={closeDialog} />
      <section
        ref={dialogRef}
        className="home-return-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={pending}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="home-return-confirm-heading">
          <span className="home-return-confirm-icon" aria-hidden="true">
            <ArrowLeft />
          </span>
          <button
            type="button"
            className="home-return-confirm-close"
            onClick={closeDialog}
            aria-label={t('common.close')}
            title={t('common.close')}
            disabled={pending || closing}
          >
            <X />
          </button>
        </div>

        <div className="home-return-confirm-copy">
          <h2 id={titleId}>{t('homeReturn.title')}</h2>
          <p id={descriptionId}>{t(descriptionKey)}</p>
        </div>

        <div className="home-return-confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="ipad-button secondary-button"
            onClick={closeDialog}
            disabled={pending || closing}
          >
            {t('homeReturn.stay')}
          </button>
          <button
            type="button"
            className="ipad-button primary-button"
            onClick={onConfirm}
            disabled={pending || closing}
          >
            {pending ? t('homeReturn.returning') : t('homeReturn.confirm')}
          </button>
        </div>
      </section>
    </div>
  )
}

export default HomeReturnConfirmDialog
export type { HomeReturnScope }
