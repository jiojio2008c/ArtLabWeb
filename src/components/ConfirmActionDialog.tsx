import { useCallback, useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type ConfirmActionResult = boolean | void

interface ConfirmActionDialogProps {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  icon?: ReactNode
  cancelLabel: ReactNode
  confirmLabel: ReactNode
  pendingLabel?: ReactNode
  pending?: boolean
  autoCloseOnConfirm?: boolean
  tone?: 'primary' | 'danger'
  classNamePrefix?: string
  onCancel: () => void
  onConfirm: () => ConfirmActionResult | Promise<ConfirmActionResult>
}

const ConfirmActionDialog: React.FC<ConfirmActionDialogProps> = ({
  title,
  description,
  eyebrow,
  icon,
  cancelLabel,
  confirmLabel,
  pendingLabel,
  pending = false,
  autoCloseOnConfirm = true,
  tone = 'primary',
  classNamePrefix = 'confirm-action',
  onCancel,
  onConfirm
}) => {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const pendingRef = useRef(pending)
  const internalPendingRef = useRef(false)
  const closingRef = useRef(false)
  const mountedRef = useRef(true)
  const titleId = useId()
  const descriptionId = useId()
  const [closing, setClosing] = useState(false)
  const [internalPending, setInternalPending] = useState(false)

  const isPending = pending || internalPending
  pendingRef.current = isPending
  internalPendingRef.current = internalPending
  closingRef.current = closing

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])

  const finishClose = useCallback(() => {
    clearCloseTimer()
    onCancel()
    window.requestAnimationFrame(() => previousFocusRef.current?.focus({ preventScroll: true }))
  }, [clearCloseTimer, onCancel])

  const closeDialog = useCallback(() => {
    if (pendingRef.current || closingRef.current) return

    closingRef.current = true
    setClosing(true)
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      finishClose()
    }, 180)
  }, [clearCloseTimer, finishClose])

  const handleConfirm = useCallback(async () => {
    if (pendingRef.current || closingRef.current) return

    if (!autoCloseOnConfirm) {
      onConfirm()
      return
    }

    internalPendingRef.current = true
    pendingRef.current = true
    setInternalPending(true)
    try {
      const result = await onConfirm()
      if (!mountedRef.current) return
      if (result === false) {
        internalPendingRef.current = false
        pendingRef.current = pending
        setInternalPending(false)
        return
      }
      internalPendingRef.current = false
      pendingRef.current = false
      setInternalPending(false)
      closeDialog()
    } catch {
      if (mountedRef.current) {
        internalPendingRef.current = false
        pendingRef.current = pending
        setInternalPending(false)
      }
    }
  }, [autoCloseOnConfirm, closeDialog, onConfirm, pending])

  useEffect(() => {
    mountedRef.current = true
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const focusFrame = window.requestAnimationFrame(() => cancelRef.current?.focus({ preventScroll: true }))

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
      mountedRef.current = false
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleDialogKeyDown)
    }
  }, [closeDialog])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeDialog()
  }

  const descriptionClassName = `${classNamePrefix}-copy-description confirm-action-copy-description`
  const overlayClassName = `confirm-action-overlay ${classNamePrefix}-overlay${closing ? ' is-closing' : ''}`
  const scrimClassName = `confirm-action-scrim ${classNamePrefix}-scrim`
  const dialogClassName = `confirm-action-dialog ${classNamePrefix}-dialog ${tone === 'danger' ? 'is-danger' : 'is-primary'}`
  const headingClassName = `confirm-action-heading ${classNamePrefix}-heading`
  const iconClassName = `confirm-action-icon ${classNamePrefix}-icon ${tone === 'danger' ? 'is-danger' : 'is-primary'}`
  const closeClassName = `confirm-action-close ${classNamePrefix}-close`
  const copyClassName = `confirm-action-copy ${classNamePrefix}-copy`
  const actionsClassName = `confirm-action-actions ${classNamePrefix}-actions`
  const confirmClassName = `ipad-button ${tone === 'danger' ? 'danger-button' : 'primary-button'} confirm-action-confirm`

  return (
    <div className={overlayClassName} onClick={handleOverlayClick}>
      <div className={scrimClassName} aria-hidden="true" onClick={closeDialog} />
      <section
        ref={dialogRef}
        className={dialogClassName}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...(description !== undefined && description !== null ? { 'aria-describedby': descriptionId } : {})}
        aria-busy={isPending}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={headingClassName}>
          {icon ? (
            <span className={iconClassName} aria-hidden="true">{icon}</span>
          ) : (
            <span className={`${iconClassName} is-empty`} aria-hidden="true" />
          )}
          <button
            type="button"
            className={closeClassName}
            onClick={closeDialog}
            aria-label={t('common.close')}
            title={t('common.close')}
            disabled={isPending || closing}
          >
            <X />
          </button>
        </div>

        <div className={copyClassName}>
          {eyebrow !== undefined && eyebrow !== null && (
            <p className="confirm-action-eyebrow">{eyebrow}</p>
          )}
          <h2 id={titleId}>{title}</h2>
          {description !== undefined && description !== null && (
            <p id={descriptionId} className={descriptionClassName}>{description}</p>
          )}
        </div>

        <div className={actionsClassName}>
          <button
            ref={cancelRef}
            type="button"
            className="ipad-button secondary-button"
            onClick={closeDialog}
            disabled={isPending || closing}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmClassName}
            onClick={() => void handleConfirm()}
            disabled={isPending || closing}
          >
            {isPending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

export default ConfirmActionDialog
export type { ConfirmActionDialogProps, ConfirmActionResult }
