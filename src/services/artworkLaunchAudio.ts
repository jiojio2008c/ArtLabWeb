interface ArtworkLaunchPlayback {
  sources: Set<AudioScheduledSourceNode>
  nodes: Set<AudioNode>
  master: GainNode
}

let audioContext: AudioContext | null = null
let activePlayback: ArtworkLaunchPlayback | null = null

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
)

const disconnectNode = (node: AudioNode) => {
  try {
    node.disconnect()
  } catch {
    return
  }
}

const stopPlayback = (playback: ArtworkLaunchPlayback) => {
  playback.sources.forEach((source) => {
    source.onended = null
    try {
      source.stop()
    } catch {
      return
    } finally {
      disconnectNode(source)
    }
  })
  playback.sources.clear()
  playback.nodes.forEach(disconnectNode)
  playback.nodes.clear()
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
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => undefined)
  }
  return audioContext
}

const createPlayback = (context: AudioContext, volume: number): ArtworkLaunchPlayback => {
  const master = context.createGain()
  const compressor = context.createDynamicsCompressor()
  const now = context.currentTime

  master.gain.setValueAtTime(volume, now)
  compressor.threshold.setValueAtTime(-18, now)
  compressor.knee.setValueAtTime(18, now)
  compressor.ratio.setValueAtTime(5, now)
  compressor.attack.setValueAtTime(0.003, now)
  compressor.release.setValueAtTime(0.22, now)
  master.connect(compressor)
  compressor.connect(context.destination)

  return {
    sources: new Set<AudioScheduledSourceNode>(),
    nodes: new Set<AudioNode>([master, compressor]),
    master
  }
}

const trackSource = (playback: ArtworkLaunchPlayback, source: AudioScheduledSourceNode) => {
  playback.sources.add(source)
  source.onended = () => {
    playback.sources.delete(source)
    disconnectNode(source)
    if (playback.sources.size > 0) return

    playback.nodes.forEach(disconnectNode)
    playback.nodes.clear()
    if (activePlayback === playback) activePlayback = null
  }
}

const scheduleTone = (
  context: AudioContext,
  playback: ArtworkLaunchPlayback,
  start: number,
  frequency: number,
  endFrequency: number,
  duration: number,
  level: number,
  type: OscillatorType = 'sine'
) => {
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(level, start + Math.min(0.035, duration * 0.18))
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  oscillator.connect(gain)
  gain.connect(playback.master)
  playback.nodes.add(gain)
  trackSource(playback, oscillator)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

const scheduleAirLift = (
  context: AudioContext,
  playback: ArtworkLaunchPlayback,
  start: number
) => {
  const duration = 0.72
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration))
  const buffer = context.createBuffer(1, frameCount, context.sampleRate)
  const channel = buffer.getChannelData(0)

  for (let index = 0; index < frameCount; index += 1) {
    const progress = index / frameCount
    const envelope = Math.sin(Math.PI * progress) * (0.45 + progress * 0.55)
    channel[index] = (Math.random() * 2 - 1) * envelope
  }

  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  source.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(480, start)
  filter.frequency.exponentialRampToValueAtTime(2400, start + duration)
  filter.Q.value = 0.72
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.072, start + 0.12)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(playback.master)
  playback.nodes.add(filter)
  playback.nodes.add(gain)
  trackSource(playback, source)
  source.start(start)
  source.stop(start + duration)
}

const playArtworkLaunchSound = (volume = 1) => {
  try {
    stopActivePlayback()
    const normalizedVolume = Number.isFinite(volume) ? clamp(volume, 0, 1) : 1
    if (normalizedVolume === 0) return

    const context = getAudioContext()
    if (!context) return

    const playback = createPlayback(context, normalizedVolume)
    activePlayback = playback
    const now = context.currentTime + 0.012

    scheduleTone(context, playback, now, 210, 330, 0.18, 0.075, 'triangle')
    scheduleTone(context, playback, now + 0.15, 270, 1120, 0.72, 0.105)
    scheduleTone(context, playback, now + 0.18, 150, 640, 0.66, 0.052, 'triangle')
    scheduleAirLift(context, playback, now + 0.18)

    ;[880, 1175, 1480].forEach((frequency, index) => {
      scheduleTone(
        context,
        playback,
        now + 0.34 + index * 0.105,
        frequency,
        frequency * 1.08,
        0.17,
        0.036
      )
    })
  } catch {
    stopActivePlayback()
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
