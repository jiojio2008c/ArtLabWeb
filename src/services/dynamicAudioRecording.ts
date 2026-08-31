export type DynamicAudioRecordingErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'no-device'
  | 'device-busy'
  | 'security'
  | 'constraint'
  | 'aborted'
  | 'empty'
  | 'recorder'
  | 'cancelled'
  | 'unknown'

export class DynamicAudioRecordingError extends Error {
  readonly code: DynamicAudioRecordingErrorCode
  readonly cause?: unknown

  constructor(
    code: DynamicAudioRecordingErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message)
    this.name = 'DynamicAudioRecordingError'
    this.code = code
    this.cause = cause
  }
}

export interface DynamicAudioRecordingResult {
  blob: Blob
  file: File
  mimeType: string
  durationMs: number
  sizeBytes: number
  startedAt: number
  endedAt: number
}

export interface DynamicAudioRecordingOptions {
  filename?: string
  maxDurationMs?: number
  onElapsed?: (durationMs: number) => void
  onStopped?: (result: DynamicAudioRecordingResult) => void
  onError?: (error: DynamicAudioRecordingError) => void
}

export interface DynamicAudioRecordingSession {
  readonly stream: MediaStream
  readonly recorder: MediaRecorder
  readonly mimeType: string
  readonly startedAt: number
  readonly state: DynamicAudioRecordingSessionState
  getElapsedMs: () => number
  stop: () => Promise<DynamicAudioRecordingResult>
  cancel: () => void
}

export type DynamicAudioRecordingSessionState =
  | 'recording'
  | 'stopping'
  | 'stopped'
  | 'cancelled'
  | 'error'

const AUDIO_MIME_CANDIDATES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/wav'
] as const

const FALLBACK_MIME_TYPE = 'audio/webm'

const getMediaRecorderConstructor = (): typeof MediaRecorder | undefined => {
  if (typeof MediaRecorder !== 'undefined') return MediaRecorder

  if (typeof window !== 'undefined') {
    const windowWithRecorder = window as typeof window & {
      webkitMediaRecorder?: typeof MediaRecorder
    }
    return windowWithRecorder.webkitMediaRecorder
  }

  return undefined
}

const supportsMimeType = (constructor: typeof MediaRecorder, mimeType: string) => {
  if (typeof constructor.isTypeSupported !== 'function') return true

  try {
    return constructor.isTypeSupported(mimeType)
  } catch {
    return false
  }
}

export const isDynamicAudioRecordingSupported = () => (
  typeof navigator !== 'undefined'
  && Boolean(navigator.mediaDevices?.getUserMedia)
  && Boolean(getMediaRecorderConstructor())
)

export const getDynamicAudioRecordingMimeType = () => {
  const constructor = getMediaRecorderConstructor()
  if (!constructor) return undefined
  return AUDIO_MIME_CANDIDATES.find((mimeType) => supportsMimeType(constructor, mimeType))
}

const mapRecordingError = (error: unknown): DynamicAudioRecordingError => {
  const name = typeof DOMException !== 'undefined' && error instanceof DOMException
    ? error.name
    : typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name ?? '')
      : ''

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return new DynamicAudioRecordingError(
        'permission-denied',
        'Microphone permission was denied.',
        error
      )
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new DynamicAudioRecordingError(
        'no-device',
        'No microphone is available.',
        error
      )
    case 'NotReadableError':
    case 'TrackStartError':
      return new DynamicAudioRecordingError(
        'device-busy',
        'The microphone is already in use or cannot be read.',
        error
      )
    case 'SecurityError':
      return new DynamicAudioRecordingError(
        'security',
        'Microphone access is unavailable in this context.',
        error
      )
    case 'OverconstrainedError':
      return new DynamicAudioRecordingError(
        'constraint',
        'The microphone does not satisfy the requested settings.',
        error
      )
    case 'AbortError':
      return new DynamicAudioRecordingError('aborted', 'Microphone access was aborted.', error)
    case 'NotSupportedError':
      return new DynamicAudioRecordingError('unsupported', 'Audio recording is not supported.', error)
    default:
      return new DynamicAudioRecordingError(
        'unknown',
        error instanceof Error && error.message ? error.message : 'Audio recording failed.',
        error
      )
  }
}

const stopTracks = (stream: MediaStream) => {
  stream.getTracks().forEach((track) => {
    try {
      track.stop()
    } catch {}
  })
}

const getMonotonicTime = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
)

const getExtensionForMimeType = (mimeType: string) => {
  const normalizedMimeType = mimeType.toLowerCase().split(';', 1)[0]
  if (normalizedMimeType === 'audio/mp4' || normalizedMimeType === 'audio/aac') return 'm4a'
  if (normalizedMimeType === 'audio/ogg') return 'ogg'
  if (normalizedMimeType === 'audio/wav' || normalizedMimeType === 'audio/x-wav') return 'wav'
  return 'webm'
}

const normalizeFilename = (filename: string | undefined, mimeType: string) => {
  const fallback = `recording-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const source = filename?.trim() || fallback
  const safe = source.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || fallback
  const extension = getExtensionForMimeType(mimeType)
  return /\.[a-z0-9]{2,5}$/i.test(safe) ? safe : `${safe}.${extension}`
}

const instantiateRecorder = (
  constructor: typeof MediaRecorder,
  stream: MediaStream
): { recorder: MediaRecorder; mimeType: string } => {
  const supportedCandidates = AUDIO_MIME_CANDIDATES.filter((mimeType) => (
    supportsMimeType(constructor, mimeType)
  ))

  for (const mimeType of supportedCandidates) {
    try {
      const recorder = new constructor(stream, { mimeType })
      return {
        recorder,
        mimeType: recorder.mimeType || mimeType
      }
    } catch {}
  }

  try {
    const recorder = new constructor(stream)
    return {
      recorder,
      mimeType: recorder.mimeType || FALLBACK_MIME_TYPE
    }
  } catch (error) {
    throw new DynamicAudioRecordingError(
      'unsupported',
      'This device cannot create an audio recorder.',
      error
    )
  }
}

class DynamicAudioRecordingSessionImpl implements DynamicAudioRecordingSession {
  readonly stream: MediaStream
  readonly recorder: MediaRecorder
  readonly mimeType: string
  readonly startedAt: number

  private currentState: DynamicAudioRecordingSessionState = 'recording'
  private readonly startedAtMonotonic: number
  private readonly options: DynamicAudioRecordingOptions
  private readonly chunks: Blob[] = []
  private elapsedMs = 0
  private elapsedTimer: ReturnType<typeof setInterval> | undefined
  private maxDurationTimer: ReturnType<typeof setTimeout> | undefined
  private stopPromise: Promise<DynamicAudioRecordingResult> | undefined
  private completedResult: DynamicAudioRecordingResult | undefined
  private terminalError: DynamicAudioRecordingError | undefined
  private resolveStop: ((result: DynamicAudioRecordingResult) => void) | undefined
  private rejectStop: ((error: unknown) => void) | undefined

  constructor(
    stream: MediaStream,
    recorder: MediaRecorder,
    mimeType: string,
    options: DynamicAudioRecordingOptions
  ) {
    this.stream = stream
    this.recorder = recorder
    this.mimeType = mimeType || FALLBACK_MIME_TYPE
    this.options = options
    this.startedAt = Date.now()
    this.startedAtMonotonic = getMonotonicTime()

    recorder.addEventListener('dataavailable', this.handleDataAvailable)
    recorder.addEventListener('stop', this.handleStop)
    recorder.addEventListener('error', this.handleError)

    this.notifyElapsed(0)
    this.elapsedTimer = setInterval(() => {
      this.elapsedMs = this.getElapsedMs()
      this.notifyElapsed(this.elapsedMs)
    }, 100)

    const maxDurationMs = Number(this.options.maxDurationMs)
    if (Number.isFinite(maxDurationMs) && maxDurationMs >= 250) {
      this.maxDurationTimer = setTimeout(() => {
        void this.stop().catch(() => undefined)
      }, maxDurationMs)
    }
  }

  get state() {
    return this.currentState
  }

  getElapsedMs = () => {
    if (this.currentState === 'stopped' || this.currentState === 'cancelled' || this.currentState === 'error') {
      return this.elapsedMs
    }
    return Math.max(0, Math.round(getMonotonicTime() - this.startedAtMonotonic))
  }

  stop = (): Promise<DynamicAudioRecordingResult> => {
    if (this.currentState === 'stopped' && this.completedResult) return Promise.resolve(this.completedResult)
    if (this.currentState === 'stopping' && this.stopPromise) return this.stopPromise
    if (this.currentState === 'cancelled') {
      return Promise.reject(new DynamicAudioRecordingError('cancelled', 'Recording was cancelled.'))
    }
    if (this.currentState === 'error') {
      return Promise.reject(this.terminalError ?? new DynamicAudioRecordingError('recorder', 'The audio recorder failed.'))
    }

    this.currentState = 'stopping'
    this.elapsedMs = this.getElapsedMs()
    this.stopPromise = new Promise<DynamicAudioRecordingResult>((resolve, reject) => {
      this.resolveStop = resolve
      this.rejectStop = reject

      try {
        if (this.recorder.state === 'inactive') {
          this.handleStop()
        } else {
          this.recorder.stop()
        }
      } catch (error) {
        this.handleError(error)
      }
    })

    return this.stopPromise
  }

  cancel = () => {
    if (this.currentState === 'stopped' || this.currentState === 'cancelled') return

    this.currentState = 'cancelled'
    this.cleanup()
    try {
      if (this.recorder.state !== 'inactive') this.recorder.stop()
    } catch {}

    this.rejectStop?.(new DynamicAudioRecordingError('cancelled', 'Recording was cancelled.'))
    this.resolveStop = undefined
    this.rejectStop = undefined
  }

  private readonly handleDataAvailable = (event: Event) => {
    const data = (event as BlobEvent).data
    if (data && data.size > 0) this.chunks.push(data)
  }

  private readonly handleStop = () => {
    if (this.currentState === 'cancelled') return

    this.elapsedMs = Math.max(this.elapsedMs, this.getElapsedMs())
    this.currentState = 'stopped'
    this.cleanup()

    if (this.chunks.length === 0) {
      this.terminalError = new DynamicAudioRecordingError('empty', 'No audio was captured.')
      this.currentState = 'error'
      this.notifyError(this.terminalError)
      this.rejectStop?.(this.terminalError)
      this.resolveStop = undefined
      this.rejectStop = undefined
      return
    }

    const blobType = this.chunks.find((chunk) => chunk.type)?.type || this.mimeType || FALLBACK_MIME_TYPE
    const blob = new Blob(this.chunks, { type: blobType })
    const endedAt = Date.now()
    const file = new File([blob], normalizeFilename(this.options.filename, blob.type), {
      type: blob.type,
      lastModified: endedAt
    })
    const result: DynamicAudioRecordingResult = {
      blob,
      file,
      mimeType: blob.type,
      durationMs: this.elapsedMs,
      sizeBytes: blob.size,
      startedAt: this.startedAt,
      endedAt
    }

    this.completedResult = result
    try {
      this.options.onStopped?.(result)
    } catch {}
    this.resolveStop?.(result)
    this.resolveStop = undefined
    this.rejectStop = undefined
  }

  private readonly handleError = (error: unknown) => {
    if (this.currentState === 'cancelled' || this.currentState === 'stopped') return

    this.currentState = 'error'
    this.cleanup()
    const normalizedError = error instanceof DynamicAudioRecordingError
      ? error
      : new DynamicAudioRecordingError('recorder', 'The audio recorder failed.', error)
    this.terminalError = normalizedError
    this.notifyError(normalizedError)
    this.rejectStop?.(normalizedError)
    this.resolveStop = undefined
    this.rejectStop = undefined
  }

  private cleanup = () => {
    if (this.elapsedTimer !== undefined) {
      clearInterval(this.elapsedTimer)
      this.elapsedTimer = undefined
    }
    if (this.maxDurationTimer !== undefined) {
      clearTimeout(this.maxDurationTimer)
      this.maxDurationTimer = undefined
    }
    stopTracks(this.stream)
    this.recorder.removeEventListener('dataavailable', this.handleDataAvailable)
    this.recorder.removeEventListener('stop', this.handleStop)
    this.recorder.removeEventListener('error', this.handleError)
  }

  private notifyError = (error: DynamicAudioRecordingError) => {
    try {
      this.options.onError?.(error)
    } catch {}
  }

  private notifyElapsed = (durationMs: number) => {
    try {
      this.options.onElapsed?.(durationMs)
    } catch {}
  }
}

export const startDynamicAudioRecording = async (
  options: DynamicAudioRecordingOptions = {}
): Promise<DynamicAudioRecordingSession> => {
  const constructor = getMediaRecorderConstructor()
  if (!constructor || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new DynamicAudioRecordingError(
      'unsupported',
      'This browser does not support microphone recording.'
    )
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (error) {
    throw mapRecordingError(error)
  }

  let recorder: MediaRecorder
  let mimeType: string
  try {
    const instantiated = instantiateRecorder(constructor, stream)
    recorder = instantiated.recorder
    mimeType = instantiated.mimeType
  } catch (error) {
    stopTracks(stream)
    if (error instanceof DynamicAudioRecordingError) throw error
    throw new DynamicAudioRecordingError('recorder', 'The audio recorder could not start.', error)
  }

  const session = new DynamicAudioRecordingSessionImpl(stream, recorder, mimeType, options)
  try {
    recorder.start()
  } catch (error) {
    session.cancel()
    throw new DynamicAudioRecordingError('recorder', 'The audio recorder could not start.', error)
  }

  return session
}

export const createDynamicAudioRecording = startDynamicAudioRecording

export const stopDynamicAudioRecording = (
  session: DynamicAudioRecordingSession
) => session.stop()

export const cancelDynamicAudioRecording = (
  session: DynamicAudioRecordingSession
) => session.cancel()

export { AUDIO_MIME_CANDIDATES }
