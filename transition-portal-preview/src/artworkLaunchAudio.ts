let audioContext: AudioContext | null = null

const getAudioContext = () => {
  if (typeof window === 'undefined') return null

  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextConstructor) return null
  audioContext ??= new AudioContextConstructor()
  void audioContext.resume()
  return audioContext
}

const scheduleTone = (
  context: AudioContext,
  start: number,
  frequency: number,
  endFrequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
) => {
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.035, duration * 0.18))
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

const scheduleAirLift = (context: AudioContext, start: number) => {
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
  gain.connect(context.destination)
  source.start(start)
  source.stop(start + duration)
}

export const playArtworkLaunchSound = () => {
  const context = getAudioContext()
  if (!context) return

  const now = context.currentTime + 0.012
  scheduleTone(context, now, 210, 330, 0.18, 0.075, 'triangle')
  scheduleTone(context, now + 0.15, 270, 1120, 0.72, 0.105, 'sine')
  scheduleTone(context, now + 0.18, 150, 640, 0.66, 0.052, 'triangle')
  scheduleAirLift(context, now + 0.18)

  ;[880, 1175, 1480].forEach((frequency, index) => {
    scheduleTone(context, now + 0.34 + index * 0.105, frequency, frequency * 1.08, 0.17, 0.036, 'sine')
  })
}

export const playArtworkArrivalSound = () => {
  const context = getAudioContext()
  if (!context) return

  const now = context.currentTime + 0.012
  scheduleTone(context, now, 523.25, 523.25, 0.24, 0.07, 'sine')
  scheduleTone(context, now + 0.09, 659.25, 659.25, 0.28, 0.072, 'sine')
  scheduleTone(context, now + 0.18, 783.99, 830.61, 0.38, 0.08, 'sine')
}
