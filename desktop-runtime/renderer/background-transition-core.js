export const DYNAMIC_BACKGROUND_TRANSITION_DURATION_TYPES = Object.freeze([
  'curtain',
  'shadowPlay'
])

export const DEFAULT_DYNAMIC_BACKGROUND_TRANSITION_DURATIONS = Object.freeze({
  curtain: 1200,
  shadowPlay: 1400
})

export const MIN_DYNAMIC_BACKGROUND_TRANSITION_DURATION_MS = 200
export const MAX_DYNAMIC_BACKGROUND_TRANSITION_DURATION_MS = 60000

const FIXED_BACKGROUND_TRANSITION_TIMINGS = Object.freeze({
  cameraFlash: { closeMs: 150, openMs: 330 },
  none: { closeMs: 0, openMs: 0 }
})

const DEFAULT_PHASE_RATIOS = Object.freeze({
  curtain: { close: 520 / 1200, open: 680 / 1200 },
  shadowPlay: { close: 650 / 1400, open: 750 / 1400 }
})

const isDurationType = (transition) => (
  transition === 'curtain' || transition === 'shadowPlay'
)

const getFallbackDuration = (transition, fallback) => {
  const numericFallback = Number(fallback)
  if (Number.isFinite(numericFallback)) return numericFallback
  return DEFAULT_DYNAMIC_BACKGROUND_TRANSITION_DURATIONS[transition] ?? 0
}

export const normalizeDynamicBackgroundTransitionDuration = (
  transition,
  value,
  fallback
) => {
  if (!isDurationType(transition)) return 0
  const numericValue = Number(value)
  const candidate = Number.isFinite(numericValue)
    ? numericValue
    : getFallbackDuration(transition, fallback)
  return Math.min(
    MAX_DYNAMIC_BACKGROUND_TRANSITION_DURATION_MS,
    Math.max(
      MIN_DYNAMIC_BACKGROUND_TRANSITION_DURATION_MS,
      Math.round(candidate)
    )
  )
}

export const normalizeDynamicBackgroundTransitionDurations = (
  value,
  fallback = DEFAULT_DYNAMIC_BACKGROUND_TRANSITION_DURATIONS
) => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
  const fallbackSource = fallback && typeof fallback === 'object' && !Array.isArray(fallback)
    ? fallback
    : DEFAULT_DYNAMIC_BACKGROUND_TRANSITION_DURATIONS
  return {
    curtain: normalizeDynamicBackgroundTransitionDuration(
      'curtain',
      source.curtain,
      fallbackSource.curtain
    ),
    shadowPlay: normalizeDynamicBackgroundTransitionDuration(
      'shadowPlay',
      source.shadowPlay,
      fallbackSource.shadowPlay
    )
  }
}

export const getDynamicBackgroundTransitionDuration = (
  transition,
  durations,
  fallback
) => normalizeDynamicBackgroundTransitionDuration(
  transition,
  durations && typeof durations === 'object' ? durations[transition] : undefined,
  fallback
)

export const getDynamicBackgroundTransitionTiming = (
  transition,
  durations
) => {
  if (!isDurationType(transition)) {
    const fixedTiming = FIXED_BACKGROUND_TRANSITION_TIMINGS[transition]
    return fixedTiming
      ? { ...fixedTiming, durationMs: fixedTiming.closeMs + fixedTiming.openMs }
      : { closeMs: 0, openMs: 0, durationMs: 0 }
  }

  const durationMs = getDynamicBackgroundTransitionDuration(transition, durations)
  const ratio = DEFAULT_PHASE_RATIOS[transition]
  const closeMs = Math.max(1, Math.round(durationMs * ratio.close))
  const openMs = Math.max(1, durationMs - closeMs)
  return {
    closeMs,
    openMs,
    durationMs: closeMs + openMs
  }
}

export const isDynamicBackgroundTransitionDurationType = isDurationType
