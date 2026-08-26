interface ArtworkLaunchPlayback {
  element: HTMLAudioElement
  source: MediaElementAudioSourceNode | null
  master: GainNode | null
  limiter: DynamicsCompressorNode | null
}

const ARTWORK_LAUNCH_AUDIO_URL = new URL('../../466.mp3', import.meta.url).href
const DEFAULT_ARTWORK_LAUNCH_VOLUME = 1.3
const MAX_WEB_AUDIO_GAIN = 2

let audioContext: AudioContext | null = null
let activePlayback: ArtworkLaunchPlayback | null = null

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
)

const disconnectNode = (node: AudioNode | null) => {
  if (!node) return

  try {
    node.disconnect()
  } catch {
    return
  }
}

const releaseElement = (element: HTMLAudioElement) => {
  element.onended = null
  element.onerror = null
  try {
    element.pause()
    element.currentTime = 0
  } catch {
  }
  element.removeAttribute('src')
  element.load()
}

const stopPlayback = (playback: ArtworkLaunchPlayback) => {
  releaseElement(playback.element)
  disconnectNode(playback.source)
  disconnectNode(playback.master)
  disconnectNode(playback.limiter)
}

const stopActivePlayback = () => {
  const playback = activePlayback
  activePlayback = null
  if (playback) stopPlayback(playback)
}

const getAudioContext = () => {
  if (typeof window === 'undefined') return null

  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextConstructor) return null

  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextConstructor()
  }
  return audioContext
}

const createAudioElement = () => {
  const element = new Audio(ARTWORK_LAUNCH_AUDIO_URL)
  element.preload = 'auto'
  element.setAttribute('playsinline', '')
  return element
}

const registerPlayback = (playback: ArtworkLaunchPlayback) => {
  activePlayback = playback
  playback.element.onended = () => {
    if (activePlayback === playback) activePlayback = null
    stopPlayback(playback)
  }
  playback.element.onerror = () => {
    if (activePlayback === playback) activePlayback = null
    stopPlayback(playback)
  }
}

const playFallback = (normalizedVolume: number) => {
  const element = createAudioElement()
  element.volume = clamp(normalizedVolume, 0, 1)
  const playback: ArtworkLaunchPlayback = {
    element,
    source: null,
    master: null,
    limiter: null
  }

  registerPlayback(playback)
  void element.play().catch(() => {
    if (activePlayback === playback) activePlayback = null
    stopPlayback(playback)
  })
}

const playWithWebAudio = (context: AudioContext, normalizedVolume: number) => {
  const element = createAudioElement()
  element.volume = 1

  const source = context.createMediaElementSource(element)
  const master = context.createGain()
  const limiter = context.createDynamicsCompressor()
  const now = context.currentTime

  master.gain.setValueAtTime(normalizedVolume, now)
  limiter.threshold.setValueAtTime(-1, now)
  limiter.knee.setValueAtTime(0, now)
  limiter.ratio.setValueAtTime(20, now)
  limiter.attack.setValueAtTime(0.003, now)
  limiter.release.setValueAtTime(0.2, now)

  source.connect(master)
  master.connect(limiter)
  limiter.connect(context.destination)

  const playback: ArtworkLaunchPlayback = {
    element,
    source,
    master,
    limiter
  }

  registerPlayback(playback)
  const resumePromise = context.state === 'suspended'
    ? context.resume()
    : Promise.resolve()
  const playPromise = element.play()

  void Promise.all([resumePromise, playPromise]).catch(() => {
    if (activePlayback !== playback) return
    activePlayback = null
    stopPlayback(playback)
    playFallback(normalizedVolume)
  })
}

const playArtworkLaunchSound = (volume = DEFAULT_ARTWORK_LAUNCH_VOLUME) => {
  try {
    stopActivePlayback()
    const normalizedVolume = Number.isFinite(volume)
      ? clamp(volume, 0, MAX_WEB_AUDIO_GAIN)
      : DEFAULT_ARTWORK_LAUNCH_VOLUME
    if (normalizedVolume === 0) return

    const context = getAudioContext()
    if (!context) {
      playFallback(normalizedVolume)
      return
    }

    playWithWebAudio(context, normalizedVolume)
  } catch {
    stopActivePlayback()
    playFallback(DEFAULT_ARTWORK_LAUNCH_VOLUME)
  }
}

const stopArtworkLaunchSound = () => {
  try {
    stopActivePlayback()
  } catch {
    activePlayback = null
  }
}

export { playArtworkLaunchSound, stopArtworkLaunchSound }
