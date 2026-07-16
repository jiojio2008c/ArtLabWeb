import type { PointerEvent } from 'react'

type UiSoundKind = 'tap' | 'success' | 'danger'

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

const playUiSound = (kind: UiSoundKind = 'tap') => {
  try {
    const context = getAudioContext()
    if (!context) return

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
  if (button.dataset.silent === 'true') return

  playUiSound(getButtonSoundKind(button))
  pulseButton(button)
}

export type { UiSoundKind }
export {
  handleGlobalButtonPointerDown,
  playUiSound
}
