export const DEFAULT_MOVE_SPEED: number
export const MIN_MOVE_SPEED: number
export const MAX_MOVE_SPEED: number
export const SLOW_SPEED_THRESHOLD: number
export const MAX_SLOWDOWN_FACTOR: number

export function normalizeDynamicMoveSpeed(speed: unknown): number

export function getDynamicMoveSpeedSlowdownFactor(speed: unknown): number

export function getDynamicMoveDurationSeconds(
  speed: unknown,
  baseSeconds?: unknown
): number
