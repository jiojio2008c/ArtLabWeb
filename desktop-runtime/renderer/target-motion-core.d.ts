export const TARGET_MOTION_KEYFRAME_SEGMENTS: number

export function getTargetMotionDurationMs(
  moveSpeed: number,
  baseSeconds?: number
): number

export function sampleTargetMotionProgress(
  elapsedMs: number,
  oneWayDurationMs: number,
  loop: boolean
): number

export function sampleTargetMotionState(
  elapsedMs: number,
  oneWayDurationMs: number,
  options?: {
    loop?: boolean
    hideAfterTarget?: boolean
    settleMs?: number
  }
): {
  progress: number
  arrived: boolean
  hidden: boolean
  visible: boolean
  interactive: boolean
  arrivalMs: number
}

export function sampleTargetOneWayProgress(
  elapsedMs: number,
  oneWayDurationMs: number
): number

export function sampleTargetPingPongProgress(
  elapsedMs: number,
  oneWayDurationMs: number
): number
