export type DynamicBackgroundTransitionDurationType = 'curtain' | 'shadowPlay'
export type DynamicBackgroundTransitionDurations = Partial<Record<DynamicBackgroundTransitionDurationType, number>>
export type DynamicBackgroundTransition = 'none' | 'curtain' | 'cameraFlash' | 'shadowPlay'

export const DYNAMIC_BACKGROUND_TRANSITION_DURATION_TYPES: readonly DynamicBackgroundTransitionDurationType[]
export const DEFAULT_DYNAMIC_BACKGROUND_TRANSITION_DURATIONS: Readonly<{
  curtain: number
  shadowPlay: number
}>
export const MIN_DYNAMIC_BACKGROUND_TRANSITION_DURATION_MS: number
export const MAX_DYNAMIC_BACKGROUND_TRANSITION_DURATION_MS: number

export function normalizeDynamicBackgroundTransitionDuration(
  transition: DynamicBackgroundTransition,
  value: unknown,
  fallback?: unknown
): number

export function normalizeDynamicBackgroundTransitionDurations(
  value?: unknown,
  fallback?: DynamicBackgroundTransitionDurations
): {
  curtain: number
  shadowPlay: number
}

export function getDynamicBackgroundTransitionDuration(
  transition: DynamicBackgroundTransition,
  durations?: DynamicBackgroundTransitionDurations,
  fallback?: unknown
): number

export interface DynamicBackgroundTransitionTiming {
  closeMs: number
  openMs: number
  durationMs: number
}

export function getDynamicBackgroundTransitionTiming(
  transition: DynamicBackgroundTransition,
  durations?: DynamicBackgroundTransitionDurations
): DynamicBackgroundTransitionTiming

export function isDynamicBackgroundTransitionDurationType(
  transition: unknown
): transition is DynamicBackgroundTransitionDurationType
