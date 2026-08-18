export type BackgroundTransitionSoundKind = 'curtain' | 'cameraFlash' | 'shadowPlay'

export const BACKGROUND_TRANSITION_SOUND_DURATION_MS: Readonly<Record<BackgroundTransitionSoundKind, number>>

export interface BackgroundTransitionAudio {
  play: (kind: BackgroundTransitionSoundKind) => number
  stop: () => void
  getDuration: (kind: BackgroundTransitionSoundKind) => number
}

export function createBackgroundTransitionAudio(
  getContext: () => AudioContext | null
): BackgroundTransitionAudio
