const DEFAULT_MOVE_SPEED = 50
const MIN_MOVE_SPEED = 0
const MAX_MOVE_SPEED = 100
const SLOW_SPEED_THRESHOLD = 50
const MAX_SLOWDOWN_FACTOR = 2.5

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

const normalizeDynamicMoveSpeed = (speed) => {
  if (speed === null || speed === undefined) return DEFAULT_MOVE_SPEED
  const numericSpeed = Number(speed)
  if (!Number.isFinite(numericSpeed)) return DEFAULT_MOVE_SPEED
  return clamp(numericSpeed, MIN_MOVE_SPEED, MAX_MOVE_SPEED)
}

const getDynamicMoveSpeedSlowdownFactor = (speed) => {
  const normalizedSpeed = normalizeDynamicMoveSpeed(speed)
  if (normalizedSpeed >= SLOW_SPEED_THRESHOLD) return 1
  const slowSpeedRatio = (SLOW_SPEED_THRESHOLD - normalizedSpeed) / SLOW_SPEED_THRESHOLD
  return 1 + (MAX_SLOWDOWN_FACTOR - 1) * slowSpeedRatio ** 2
}

const getDynamicMoveDurationSeconds = (speed, baseSeconds = 5.5) => {
  const normalizedSpeed = normalizeDynamicMoveSpeed(speed)
  const numericBaseSeconds = Number(baseSeconds)
  const safeBaseSeconds = Number.isFinite(numericBaseSeconds)
    ? Math.max(0, numericBaseSeconds)
    : 5.5
  const legacySpeedRatio = Math.max(1, normalizedSpeed) / 100
  const legacyDurationSeconds = safeBaseSeconds * (1.55 - 1.09 * legacySpeedRatio)
  return Math.max(0, legacyDurationSeconds * getDynamicMoveSpeedSlowdownFactor(normalizedSpeed))
}

export {
  DEFAULT_MOVE_SPEED,
  MIN_MOVE_SPEED,
  MAX_MOVE_SPEED,
  SLOW_SPEED_THRESHOLD,
  MAX_SLOWDOWN_FACTOR,
  normalizeDynamicMoveSpeed,
  getDynamicMoveSpeedSlowdownFactor,
  getDynamicMoveDurationSeconds
}
