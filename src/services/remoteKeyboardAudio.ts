type RemoteKnobSize = 'small' | 'large'

interface RemoteKeyboardAudioGraph {
  context: AudioContext
  output: AudioNode
  noise: AudioBuffer
}

let graph: RemoteKeyboardAudioGraph | null = null

const createNoiseBuffer = (context: AudioContext) => {
  const duration = 0.12
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration))
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
  const channel = buffer.getChannelData(0)

  for (let index = 0; index < sampleCount; index += 1) {
    channel[index] = Math.random() * 2 - 1
  }

  return buffer
}

const getAudioGraph = () => {
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null

  if (!graph) {
    const context = new AudioContextClass()
    const compressor = context.createDynamicsCompressor()
    const output = context.createGain()

    compressor.threshold.setValueAtTime(-20, context.currentTime)
    compressor.knee.setValueAtTime(14, context.currentTime)
    compressor.ratio.setValueAtTime(6, context.currentTime)
    compressor.attack.setValueAtTime(0.002, context.currentTime)
    compressor.release.setValueAtTime(0.09, context.currentTime)
    output.gain.setValueAtTime(1.18, context.currentTime)
    compressor.connect(output)
    output.connect(context.destination)

    const nextGraph: RemoteKeyboardAudioGraph = {
      context,
      output: compressor,
      noise: createNoiseBuffer(context)
    }
    graph = nextGraph
  }

  const currentGraph = graph
  if (currentGraph.context.state === 'suspended') {
    void currentGraph.context.resume()
  }

  return currentGraph
}

const primeRemoteKeyboardAudio = () => {
  try {
    const currentGraph = getAudioGraph()
    if (!currentGraph) return

    const { context, output } = currentGraph
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const now = context.currentTime

    gain.gain.setValueAtTime(0.0001, now)
    oscillator.connect(gain)
    gain.connect(output)
    oscillator.start(now)
    oscillator.stop(now + 0.008)
  } catch {
    // Tactile audio is optional; remote commands must remain available without WebAudio.
  }
}

const playNoiseTransient = (
  currentGraph: RemoteKeyboardAudioGraph,
  startTime: number,
  frequency: number,
  peak: number,
  duration: number,
  filterType: BiquadFilterType = 'bandpass'
) => {
  const { context, noise, output } = currentGraph
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()

  source.buffer = noise
  source.playbackRate.setValueAtTime(0.94 + Math.random() * 0.12, startTime)
  filter.type = filterType
  filter.frequency.setValueAtTime(frequency * (0.96 + Math.random() * 0.08), startTime)
  filter.Q.setValueAtTime(filterType === 'bandpass' ? 1.1 : 0.7, startTime)
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.linearRampToValueAtTime(peak, startTime + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(output)
  source.start(startTime)
  source.stop(startTime + Math.min(0.115, duration + 0.012))
}

const playToneTransient = (
  currentGraph: RemoteKeyboardAudioGraph,
  startTime: number,
  frequency: number,
  peak: number,
  duration: number,
  oscillatorType: OscillatorType
) => {
  const { context, output } = currentGraph
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = oscillatorType
  oscillator.frequency.setValueAtTime(frequency * (0.97 + Math.random() * 0.06), startTime)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(42, frequency * 0.72), startTime + duration)
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  oscillator.connect(gain)
  gain.connect(output)
  oscillator.start(startTime)
  oscillator.stop(startTime + duration + 0.012)
}

const playRemoteKeyDown = (weight = 0.5) => {
  try {
    const currentGraph = getAudioGraph()
    if (!currentGraph) return
    const now = currentGraph.context.currentTime
    const normalizedWeight = Math.min(1, Math.max(0, weight))

    playToneTransient(currentGraph, now, 176 - normalizedWeight * 28, 0.13, 0.058, 'triangle')
    playNoiseTransient(currentGraph, now, 1320, 0.15, 0.035)
    playNoiseTransient(currentGraph, now + 0.012, 520, 0.075, 0.052, 'lowpass')
  } catch {
    // Keep key input functional if audio creation fails.
  }
}

const playRemoteKeyUp = (weight = 0.5) => {
  try {
    const currentGraph = getAudioGraph()
    if (!currentGraph) return
    const now = currentGraph.context.currentTime
    const normalizedWeight = Math.min(1, Math.max(0, weight))

    playNoiseTransient(currentGraph, now, 1760, 0.075, 0.026)
    playToneTransient(currentGraph, now, 330 - normalizedWeight * 24, 0.045, 0.036, 'sine')
  } catch {
    // Keep key input functional if audio creation fails.
  }
}

const playRemoteKnobTick = (size: RemoteKnobSize, steps = 1) => {
  try {
    const currentGraph = getAudioGraph()
    if (!currentGraph) return
    const count = Math.min(3, Math.max(1, Math.round(steps)))
    const baseFrequency = size === 'large' ? 720 : 1120
    const toneFrequency = size === 'large' ? 245 : 390
    const noisePeak = size === 'large' ? 0.12 : 0.095

    for (let index = 0; index < count; index += 1) {
      const startTime = currentGraph.context.currentTime + index * 0.026
      playNoiseTransient(currentGraph, startTime, baseFrequency, noisePeak, 0.026)
      playToneTransient(currentGraph, startTime, toneFrequency, size === 'large' ? 0.065 : 0.04, 0.03, 'triangle')
    }
  } catch {
    // Keep knob input functional if audio creation fails.
  }
}

const playRemoteKnobRelease = (size: RemoteKnobSize) => {
  try {
    const currentGraph = getAudioGraph()
    if (!currentGraph) return
    const now = currentGraph.context.currentTime
    playNoiseTransient(currentGraph, now, size === 'large' ? 520 : 760, 0.045, 0.028)
  } catch {
    // Keep knob input functional if audio creation fails.
  }
}

export type { RemoteKnobSize }
export {
  playRemoteKeyDown,
  playRemoteKeyUp,
  playRemoteKnobRelease,
  playRemoteKnobTick,
  primeRemoteKeyboardAudio
}
