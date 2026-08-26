export const TARGET_MOTION_KEYFRAME_SEGMENTS: number

export function sampleTargetMotionProgress(
  elapsedMs: number,
  oneWayDurationMs: number,
  loop: boolean
): number

export function sampleTargetOneWayProgress(
  elapsedMs: number,
  oneWayDurationMs: number
): number

export function sampleTargetPingPongProgress(
  elapsedMs: number,
  oneWayDurationMs: number
): number
