import type { PointerEvent } from 'react'
import {
  createBackgroundTransitionAudio,
  type BackgroundTransitionSoundKind
} from '../../desktop-runtime/renderer/background-transition-audio.js'

type UiSoundKind = 'tap' | 'success' | 'danger' | 'shutter' | 'artwork-send' | 'artwork-arrived'

let audioContext: AudioContext | null = null

const getAudioContext = () => {
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null

  audioContext = audioContext ?? new AudioContextClass()
  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }
  return audioContext
}

const backgroundTransitionAudio = createBackgroundTransitionAudio(getAudioContext)

const playBackgroundTransitionSound = (kind: BackgroundTransitionSoundKind) => (
  backgroundTransitionAudio.play(kind)
)

const stopBackgroundTransitionSound = () => {
  backgroundTransitionAudio.stop()
}

const playUiSound = (kind: UiSoundKind = 'tap') => {
  try {
    const context = getAudioContext()
    if (!context) return

    if (kind === 'artwork-send') {
      const now = context.currentTime
      const duration = 0.24
      const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration))
      const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
      const channel = buffer.getChannelData(0)

      for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        const progress = sampleIndex / sampleCount
        channel[sampleIndex] = (Math.random() * 2 - 1) * Math.sin(Math.PI * progress)
      }

      const noise = context.createBufferSource()
      const noiseFilter = context.createBiquadFilter()
      const noiseGain = context.createGain()
      const tone = context.createOscillator()
      const toneGain = context.createGain()

      noise.buffer = buffer
      noiseFilter.type = 'bandpass'
      noiseFilter.frequency.setValueAtTime(620, now)
      noiseFilter.frequency.exponentialRampToValueAtTime(1900, now + 0.18)
      noiseFilter.Q.setValueAtTime(0.8, now)
      noiseGain.gain.setValueAtTime(0.0001, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.025, now + 0.035)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

      tone.type = 'sine'
      tone.frequency.setValueAtTime(300, now)
      tone.frequency.exponentialRampToValueAtTime(540, now + 0.16)
      toneGain.gain.setValueAtTime(0.0001, now)
      toneGain.gain.exponentialRampToValueAtTime(0.018, now + 0.025)
      toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)

      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(context.destination)
      tone.connect(toneGain)
      toneGain.connect(context.destination)
      noise.start(now)
      noise.stop(now + duration)
      tone.start(now)
      tone.stop(now + duration)
      return
    }

    if (kind === 'artwork-arrived') {
      const now = context.currentTime
      const frequencies = [620, 880]

      frequencies.forEach((frequency, index) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const startTime = now + index * 0.075

        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, startTime)
        gain.gain.setValueAtTime(0.0001, startTime)
        gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.026 : 0.032, startTime + 0.008)
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.14)

        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(startTime)
        oscillator.stop(startTime + 0.16)
      })
      return
    }

    if (kind === 'shutter') {
      const now = context.currentTime
      const duration = 0.12
      const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration))
      const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
      const channel = buffer.getChannelData(0)

      for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        const progress = sampleIndex / sampleCount
        channel[sampleIndex] = (Math.random() * 2 - 1) * Math.pow(1 - progress, 2.4)
      }

      const source = context.createBufferSource()
      const filter = context.createBiquadFilter()
      const gain = context.createGain()

      source.buffer = buffer
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1650, now)
      filter.Q.setValueAtTime(0.75, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.085, now + 0.004)
      gain.gain.exponentialRampToValueAtTime(0.008, now + 0.032)
      gain.gain.setValueAtTime(0.0001, now + 0.04)
      gain.gain.linearRampToValueAtTime(0.052, now + 0.045)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.105)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(context.destination)
      source.start(now)
      source.stop(now + duration)
      return
    }

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const now = context.currentTime
    const frequency = kind === 'success' ? 720 : kind === 'danger' ? 180 : 420
    const peak = kind === 'success' ? 0.045 : kind === 'danger' ? 0.04 : 0.032

    oscillator.type = kind === 'danger' ? 'sawtooth' : 'sine'
    oscillator.frequency.setValueAtTime(frequency, now)
    if (kind === 'success') {
      oscillator.frequency.exponentialRampToValueAtTime(940, now + 0.055)
    }

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.08)
  } catch {
    // Button audio is optional; UI interactions must keep working if WebAudio is unavailable.
  }
}

const pulseButton = (button: HTMLButtonElement) => {
  button.classList.add('ui-pressed')
  window.setTimeout(() => {
    button.classList.remove('ui-pressed')
  }, 170)
}

const getButtonSoundKind = (button: HTMLButtonElement): UiSoundKind => {
  if (button.classList.contains('danger-button') || button.classList.contains('danger-inline-button')) return 'danger'
  if (button.classList.contains('success-button')) return 'success'
  return 'tap'
}

const handleGlobalButtonPointerDown = (event: PointerEvent<HTMLElement>) => {
  const target = event.target as HTMLElement
  const button = target.closest<HTMLButtonElement>('button')
  if (!button || button.disabled || !event.currentTarget.contains(button)) return
  if (button.dataset.uiFeedback === 'none') return

  pulseButton(button)
  if (button.dataset.silent !== 'true') {
    playUiSound(getButtonSoundKind(button))
  }
}

export type { BackgroundTransitionSoundKind, UiSoundKind }
export {
  handleGlobalButtonPointerDown,
  playBackgroundTransitionSound,
  playUiSound,
  stopBackgroundTransitionSound
}
