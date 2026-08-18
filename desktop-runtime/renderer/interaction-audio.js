import { createBackgroundTransitionAudio } from './background-transition-audio.js'

export const createInteractionAudio = () => {
  let audioContext = null
  let activeVoices = 0

  const getContext = () => {
    if (audioContext) return audioContext

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null

    try {
      audioContext = new AudioContextClass()
    } catch {
      audioContext = null
    }
    return audioContext
  }

  const backgroundTransitionAudio = createBackgroundTransitionAudio(getContext)

  const unlock = () => {
    const context = getContext()
    if (context?.state === 'suspended') {
      context.resume().catch(() => {})
    }
  }

  const playTone = (animationId) => {
    const context = getContext()
    if (!context || activeVoices >= 4) return

    const now = context.currentTime
    const duration = 0.11
    const baseFrequency = 390 + (Number(animationId ?? 1) % 9) * 18
    const oscillator = context.createOscillator()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()

    activeVoices += 1
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(baseFrequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 1.42, now + duration)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1800, now)
    filter.Q.setValueAtTime(0.8, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.105, now + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    oscillator.connect(filter)
    filter.connect(gain)
    gain.connect(context.destination)
    oscillator.addEventListener('ended', () => {
      activeVoices = Math.max(0, activeVoices - 1)
      oscillator.disconnect()
      filter.disconnect()
      gain.disconnect()
    }, { once: true })
    oscillator.start(now)
    oscillator.stop(now + duration + 0.01)
  }

  const playImageClick = (animationId) => {
    const context = getContext()
    if (!context) return

    if (context.state === 'suspended') {
      context.resume().then(() => playTone(animationId)).catch(() => {})
      return
    }
    playTone(animationId)
  }

  const playBackgroundTransition = (kind) => backgroundTransitionAudio.play(kind)
  const stopBackgroundTransition = () => backgroundTransitionAudio.stop()

  return {
    unlock,
    playImageClick,
    playBackgroundTransition,
    playShutter: () => playBackgroundTransition('cameraFlash'),
    stopBackgroundTransition
  }
}
