type IntervalWheelDirection = -1 | 1

let audioContext: AudioContext | null = null
let audioOutput: GainNode | null = null
let lastTickTime = -Infinity
let resumePromise: Promise<void> | null = null
let pendingTickDirection: IntervalWheelDirection | null = null
let pendingSelection = false

const getAudioContext = () => {
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null

  if (audioContext?.state === 'closed') {
    audioContext = null
    audioOutput = null
    resumePromise = null
  }

  audioContext = audioContext ?? new AudioContextClass()
  return audioContext
}

const getAudioOutput = (context: AudioContext) => {
  if (audioOutput) return audioOutput

  const output = context.createGain()
  const compressor = context.createDynamicsCompressor()

  output.gain.setValueAtTime(1.12, context.currentTime)
  compressor.threshold.setValueAtTime(-18, context.currentTime)
  compressor.knee.setValueAtTime(14, context.currentTime)
  compressor.ratio.setValueAtTime(8, context.currentTime)
  compressor.attack.setValueAtTime(0.002, context.currentTime)
  compressor.release.setValueAtTime(0.1, context.currentTime)
  output.connect(compressor)
  compressor.connect(context.destination)
  audioOutput = output
  return output
}

const playTickNow = (context: AudioContext, direction: IntervalWheelDirection) => {
  const now = context.currentTime
  if (now - lastTickTime < 0.024) return
  lastTickTime = now

  const output = getAudioOutput(context)
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const accent = context.createOscillator()
  const accentGain = context.createGain()
  const frequency = direction > 0 ? 1080 : 900

  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(frequency, now)
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.88, now + 0.044)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.105, now + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055)

  accent.type = 'triangle'
  accent.frequency.setValueAtTime(frequency * 1.72, now)
  accent.frequency.exponentialRampToValueAtTime(frequency * 1.46, now + 0.024)
  accentGain.gain.setValueAtTime(0.0001, now)
  accentGain.gain.exponentialRampToValueAtTime(0.038, now + 0.002)
  accentGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028)

  oscillator.connect(gain)
  gain.connect(output)
  accent.connect(accentGain)
  accentGain.connect(output)
  oscillator.start(now)
  oscillator.stop(now + 0.062)
  accent.start(now)
  accent.stop(now + 0.032)
}

const playSelectionNow = (context: AudioContext) => {
  const now = context.currentTime
  const output = getAudioOutput(context)

  ;[560, 820].forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const startTime = now + index * 0.032

    oscillator.type = index === 0 ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(frequency, startTime)
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.045, startTime + 0.105)
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.078 : 0.108, startTime + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.14)

    oscillator.connect(gain)
    gain.connect(output)
    oscillator.start(startTime)
    oscillator.stop(startTime + 0.15)
  })
}

const flushPendingFeedback = (context: AudioContext) => {
  if (context.state !== 'running') return

  const tickDirection = pendingTickDirection
  const shouldPlaySelection = pendingSelection
  pendingTickDirection = null
  pendingSelection = false

  if (tickDirection !== null) playTickNow(context, tickDirection)
  if (!shouldPlaySelection) return

  if (tickDirection !== null) {
    window.setTimeout(() => {
      if (context.state === 'running') playSelectionNow(context)
    }, 72)
  } else {
    playSelectionNow(context)
  }
}

const ensureAudioReady = (context: AudioContext) => {
  if (context.state === 'running') return Promise.resolve()
  if (resumePromise) return resumePromise

  resumePromise = context.resume()
    .then(() => flushPendingFeedback(context))
    .catch(() => {
      // A later direct gesture can retry the browser audio unlock.
    })
    .finally(() => {
      resumePromise = null
    })

  return resumePromise
}

const prepareIntervalWheelAudio = () => {
  try {
    const context = getAudioContext()
    if (!context) return
    const output = getAudioOutput(context)

    if (context.state !== 'running') {
      const unlockSource = context.createBufferSource()
      unlockSource.buffer = context.createBuffer(1, 1, 22050)
      unlockSource.connect(output)
      unlockSource.start()
      void ensureAudioReady(context)
    }
  } catch {
    // Audio feedback is optional and must never interrupt wheel input.
  }
}

const playIntervalWheelTick = (direction: IntervalWheelDirection) => {
  try {
    const context = getAudioContext()
    if (!context) return

    if (context.state !== 'running') {
      pendingTickDirection = direction
      void ensureAudioReady(context)
      return
    }

    playTickNow(context, direction)
  } catch {
    // Audio feedback is optional and must never interrupt wheel input.
  }
}

const playIntervalWheelSelection = () => {
  try {
    const context = getAudioContext()
    if (!context) return

    if (context.state !== 'running') {
      pendingSelection = true
      void ensureAudioReady(context)
      return
    }

    playSelectionNow(context)
  } catch {
    // Audio feedback is optional and must never interrupt wheel input.
  }
}

export type { IntervalWheelDirection }
export {
  playIntervalWheelSelection,
  playIntervalWheelTick,
  prepareIntervalWheelAudio
}
