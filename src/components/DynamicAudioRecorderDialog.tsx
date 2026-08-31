import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  Check,
  Clock3,
  LoaderCircle,
  Mic,
  RotateCcw,
  Square,
  X
} from 'lucide-react'
import {
  DynamicAudioRecordingError,
  isDynamicAudioRecordingSupported,
  startDynamicAudioRecording,
  type DynamicAudioRecordingErrorCode,
  type DynamicAudioRecordingResult,
  type DynamicAudioRecordingSession
} from '../services/dynamicAudioRecording.ts'
import './DynamicAudioRecorderDialog.css'

export interface DynamicAudioRecorderDialogProps {
  open?: boolean
  title?: string
  description?: string
  filename?: string
  maxDurationMs?: number
  busy?: boolean
  onCancel: () => void
  onSave: (recording: DynamicAudioRecordingResult) => void | Promise<void>
}

type DialogStatus = 'idle' | 'starting' | 'recording' | 'stopping' | 'recorded' | 'saving'

const formatRecordingDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

const getErrorCode = (error: unknown): DynamicAudioRecordingErrorCode => {
  if (error instanceof DynamicAudioRecordingError) return error.code
  return 'unknown'
}

const getErrorMessage = (
  error: unknown,
  translate: (key: string, fallback: string) => string
) => {
  const code = getErrorCode(error)
  switch (code) {
    case 'unsupported':
      return translate('control.audioRecordingUnsupported', '此裝置或瀏覽器不支援錄音。')
    case 'permission-denied':
      return translate('control.audioRecordingPermissionDenied', '請允許麥克風權限後再試一次。')
    case 'no-device':
      return translate('control.audioRecordingNoDevice', '找不到可用的麥克風。')
    case 'device-busy':
      return translate('control.audioRecordingDeviceBusy', '麥克風目前被其他程式使用中。')
    case 'security':
      return translate('control.audioRecordingSecurity', '目前頁面無法存取麥克風，請檢查裝置設定。')
    case 'constraint':
      return translate('control.audioRecordingConstraint', '目前麥克風不符合錄音需求。')
    case 'aborted':
      return translate('control.audioRecordingAborted', '麥克風啟動已中止，請再試一次。')
    case 'empty':
      return translate('control.audioRecordingEmpty', '沒有錄到聲音，請確認麥克風後再試一次。')
    case 'cancelled':
      return translate('control.audioRecordingCancelled', '錄音已取消。')
    case 'recorder':
      return translate('control.audioRecordingFailed', '錄音失敗，請再試一次。')
    default:
      return error instanceof Error && error.message
        ? error.message
        : translate('control.audioRecordingFailed', '錄音失敗，請再試一次。')
  }
}

const DynamicAudioRecorderDialog: React.FC<DynamicAudioRecorderDialogProps> = ({
  open = false,
  title,
  description,
  filename,
  maxDurationMs,
  busy = false,
  onCancel,
  onSave
}) => {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLElement>(null)
  const firstActionRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const sessionRef = useRef<DynamicAudioRecordingSession | null>(null)
  const requestTokenRef = useRef(0)
  const titleId = useId()
  const descriptionId = useId()
  const [status, setStatus] = useState<DialogStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [recording, setRecording] = useState<DynamicAudioRecordingResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)

  const translate = useCallback((
    key: string,
    fallback: string,
    options?: Record<string, unknown>
  ) => t(key, { defaultValue: fallback, ...options }), [t])

  const cancelSession = useCallback(() => {
    requestTokenRef.current += 1
    sessionRef.current?.cancel()
    sessionRef.current = null
  }, [])

  const handleClose = useCallback(() => {
    if (status === 'saving' || busy) return
    cancelSession()
    onCancel()
    window.requestAnimationFrame(() => previousFocusRef.current?.focus())
  }, [busy, cancelSession, onCancel, status])

  useEffect(() => {
    if (!open) {
      cancelSession()
      setStatus('idle')
      setElapsedMs(0)
      setRecording(null)
      setPreviewUrl(null)
      setError(null)
      setIsPreviewPlaying(false)
      return
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const focusFrame = window.requestAnimationFrame(() => firstActionRef.current?.focus())
    return () => window.cancelAnimationFrame(focusFrame)
  }, [cancelSession, open])

  useEffect(() => () => {
    cancelSession()
    previousFocusRef.current?.focus()
  }, [cancelSession])

  useEffect(() => {
    if (!recording) {
      setPreviewUrl(null)
      return
    }

    const nextPreviewUrl = URL.createObjectURL(recording.blob)
    setPreviewUrl(nextPreviewUrl)
    return () => URL.revokeObjectURL(nextPreviewUrl)
  }, [recording])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
        return
      }

      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), audio[controls], [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleClose, open])

  const handleStart = async () => {
    if (status === 'starting' || status === 'recording' || status === 'stopping' || status === 'saving' || busy) return
    setError(null)
    setRecording(null)
    setElapsedMs(0)
    setIsPreviewPlaying(false)

    const requestToken = ++requestTokenRef.current
    setStatus('starting')
    try {
      const nextSession = await startDynamicAudioRecording({
        filename,
        maxDurationMs,
        onElapsed: (nextElapsedMs) => {
          if (requestToken === requestTokenRef.current) setElapsedMs(nextElapsedMs)
        },
        onStopped: (result) => {
          if (requestToken !== requestTokenRef.current) return
          sessionRef.current = null
          setRecording(result)
          setElapsedMs(result.durationMs)
          setStatus('recorded')
        },
        onError: (nextError) => {
          if (requestToken !== requestTokenRef.current) return
          sessionRef.current = null
          setStatus('idle')
          setError(nextError)
        }
      })

      if (requestToken !== requestTokenRef.current || !open) {
        nextSession.cancel()
        return
      }

      if (nextSession.state !== 'recording') return

      sessionRef.current = nextSession
      setStatus('recording')
    } catch (nextError) {
      if (requestToken !== requestTokenRef.current) return
      setStatus('idle')
      setError(nextError)
    }
  }

  const handleStop = async () => {
    const session = sessionRef.current
    if (!session || status !== 'recording') return

    setStatus('stopping')
    try {
      const result = await session.stop()
      if (sessionRef.current !== session) return
      sessionRef.current = null
      setRecording(result)
      setElapsedMs(result.durationMs)
      setStatus('recorded')
    } catch (nextError) {
      if (sessionRef.current !== session) return
      sessionRef.current = null
      setStatus('idle')
      setError(nextError)
    }
  }

  const handleRetake = () => {
    if (status === 'saving' || busy) return
    setRecording(null)
    setElapsedMs(0)
    setError(null)
    setIsPreviewPlaying(false)
    void handleStart()
  }

  const handleSave = async () => {
    if (!recording || status === 'saving' || busy) return
    setStatus('saving')
    setError(null)
    try {
      await onSave(recording)
      cancelSession()
      onCancel()
      window.requestAnimationFrame(() => previousFocusRef.current?.focus())
    } catch (nextError) {
      setStatus('recorded')
      setError(nextError)
    }
  }

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) handleClose()
  }

  if (!open || typeof document === 'undefined') return null

  const isStarting = status === 'starting'
  const isRecording = status === 'recording'
  const isStopping = status === 'stopping'
  const isSaving = status === 'saving' || busy
  const canClose = !isSaving
  const titleText = title ?? translate('control.audioRecordTitle', '錄製音源')
  const descriptionText = description ?? translate(
    'control.audioRecordDescription',
    '使用裝置麥克風錄製一段音源。錄音完成後可先试听，再儲存。'
  )
  const supportError = !isDynamicAudioRecordingSupported()
  const displayedError = supportError && !error
    ? translate('control.audioRecordingUnsupported', '此裝置或瀏覽器不支援錄音。')
    : error
      ? getErrorMessage(error, translate)
      : null

  return createPortal(
    <div className="dynamic-audio-recorder-overlay" onClick={handleOverlayClick}>
      <div
        className="dynamic-audio-recorder-scrim"
        aria-hidden="true"
        onClick={handleClose}
      />
      <section
        ref={dialogRef}
        className="dynamic-audio-recorder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isSaving || isStarting || isStopping}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dynamic-audio-recorder-header">
          <div className="dynamic-audio-recorder-heading-copy">
            <span className="dynamic-audio-recorder-icon" aria-hidden="true">
              <Mic size={21} strokeWidth={2.25} />
            </span>
            <div>
              <p className="eyebrow">{translate('control.audioSource', '音源')}</p>
              <h2 id={titleId}>{titleText}</h2>
            </div>
          </div>
          <button
            type="button"
            className="dynamic-audio-recorder-close"
            onClick={handleClose}
            disabled={!canClose}
            aria-label={translate('common.close', '關閉')}
            title={translate('common.close', '關閉')}
          >
            <X size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </header>

        <div className="dynamic-audio-recorder-content">
          <p id={descriptionId} className="dynamic-audio-recorder-description">{descriptionText}</p>

          {displayedError && (
            <div className="dynamic-audio-recorder-error" role="alert">
              <AlertCircle size={18} strokeWidth={2.2} aria-hidden="true" />
              <span>{displayedError}</span>
            </div>
          )}

          <div className={`dynamic-audio-recorder-meter ${isRecording ? 'is-recording' : ''}`}>
            <span className="dynamic-audio-recorder-meter-icon" aria-hidden="true">
              {isRecording ? <span className="dynamic-audio-recorder-pulse" /> : <Mic size={23} strokeWidth={2.2} />}
            </span>
            <div className="dynamic-audio-recorder-meter-copy">
              <strong>
                {isStarting
                  ? translate('control.audioRecordingStarting', '正在啟動麥克風…')
                  : isRecording
                    ? translate('upload.recording', '錄音中')
                    : isStopping
                      ? translate('control.audioRecordingStopping', '正在完成錄音…')
                      : recording
                        ? translate('control.audioRecordingReady', '錄音已完成')
                        : translate('control.audioRecordingReadyToStart', '準備開始錄音')}
              </strong>
              <span
                className="dynamic-audio-recorder-timer"
                aria-live="off"
                aria-label={translate('control.audioRecordingDuration', '錄音時長 {{value}}', { value: formatRecordingDuration(elapsedMs) })}
              >
                <Clock3 size={15} strokeWidth={2.1} aria-hidden="true" />
                {formatRecordingDuration(elapsedMs)}
              </span>
            </div>
          </div>

          <span className="dynamic-audio-recorder-visually-hidden" role="status" aria-live="polite">
            {isStarting
              ? translate('control.audioRecordingStarting', '正在啟動麥克風…')
              : isRecording
                ? translate('upload.recording', '錄音中')
                : isStopping
                  ? translate('control.audioRecordingStopping', '正在完成錄音…')
                  : recording
                    ? translate('control.audioRecordingReady', '錄音已完成')
                    : translate('control.audioRecordingReadyToStart', '準備開始錄音')}
          </span>

          {recording && (
            <div className="dynamic-audio-recorder-preview-card">
              <div className="dynamic-audio-recorder-preview-heading">
                <span>
                  <Check size={16} strokeWidth={2.6} aria-hidden="true" />
                  {translate('control.audioRecordingPreview', '试听录音')}
                </span>
                <small>{formatFileSize(recording.sizeBytes)}</small>
              </div>
              <audio
                controls
                preload="metadata"
                src={previewUrl ?? undefined}
                onPlay={() => setIsPreviewPlaying(true)}
                onPause={() => setIsPreviewPlaying(false)}
                onEnded={() => setIsPreviewPlaying(false)}
              />
              <span className="dynamic-audio-recorder-preview-status" aria-live="polite">
                {isPreviewPlaying
                  ? translate('control.audioPlaying', '播放中')
                  : translate('control.audioRecordingDuration', '{{value}}', { value: formatRecordingDuration(recording.durationMs) })}
              </span>
            </div>
          )}
        </div>

        <footer className="dynamic-audio-recorder-actions">
          <button
            type="button"
            className="ipad-button secondary-button dynamic-audio-recorder-cancel"
            onClick={handleClose}
            disabled={!canClose}
          >
            {translate('common.cancel', '取消')}
          </button>

          <div
            className={`dynamic-audio-recorder-primary-actions${recording && !isRecording && !isStopping ? '' : ' is-single-action'}`}
          >
            {!recording && !isRecording && !isStopping && (
              <button
                ref={firstActionRef}
                type="button"
                className="ipad-button primary-button dynamic-audio-recorder-record-button"
                onClick={() => void handleStart()}
                disabled={isStarting || isSaving || supportError}
              >
                {isStarting ? <LoaderCircle className="is-spinning" size={18} aria-hidden="true" /> : <Mic size={18} strokeWidth={2.3} aria-hidden="true" />}
                {isStarting
                  ? translate('control.audioRecordingStartingShort', '啟動中…')
                  : translate('upload.record', '開始錄音')}
              </button>
            )}

            {(isRecording || isStopping) && (
              <button
                ref={firstActionRef}
                type="button"
                className="ipad-button primary-button dynamic-audio-recorder-stop-button"
                onClick={() => void handleStop()}
                disabled={isStopping || isSaving}
              >
                {isStopping ? <LoaderCircle className="is-spinning" size={18} aria-hidden="true" /> : <Square size={17} fill="currentColor" strokeWidth={2.1} aria-hidden="true" />}
                {isStopping
                  ? translate('control.audioRecordingStoppingShort', '處理中…')
                  : translate('common.stop', '停止錄音')}
              </button>
            )}

            {recording && !isRecording && !isStopping && (
              <>
                <button
                  ref={firstActionRef}
                  type="button"
                  className="ipad-button secondary-button dynamic-audio-recorder-retake-button"
                  onClick={handleRetake}
                  disabled={isSaving}
                >
                  <RotateCcw size={17} strokeWidth={2.2} aria-hidden="true" />
                  {translate('upload.retake', '重新錄音')}
                </button>
                <button
                  type="button"
                  className="ipad-button primary-button dynamic-audio-recorder-save-button"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                >
                  {isSaving ? <LoaderCircle className="is-spinning" size={18} aria-hidden="true" /> : <Check size={18} strokeWidth={2.5} aria-hidden="true" />}
                  {isSaving ? translate('common.processing', '儲存中…') : translate('common.save', '儲存錄音')}
                </button>
              </>
            )}
          </div>
        </footer>
      </section>
    </div>,
    document.body
  )
}

export default DynamicAudioRecorderDialog
export { DynamicAudioRecorderDialog, formatFileSize, formatRecordingDuration }
