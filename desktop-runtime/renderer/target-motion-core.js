import { getDynamicMoveDurationSeconds } from './dynamic-speed-core.js'

const clampUnit = (value) => Math.min(1, Math.max(0, value))

const TARGET_MOTION_KEYFRAME_SEGMENTS = 32

const getTargetMotionDurationMs = (moveSpeed, baseSeconds = 3.8) => {
  const numericBaseSeconds = Number(baseSeconds)
  const safeBaseSeconds = Number.isFinite(numericBaseSeconds)
    ? Math.max(0, numericBaseSeconds)
    : 3.8
  return Math.max(1, getDynamicMoveDurationSeconds(moveSpeed, safeBaseSeconds) * 1000)
}

const easeInOutCubic = (value) => {
  const progress = clampUnit(value)
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2
}

const sampleTargetPingPongProgress = (elapsedMs, oneWayDurationMs) => {
  const duration = Math.max(1, Number(oneWayDurationMs) || 1)
  const cycleDuration = duration * 2
  const elapsed = Math.max(0, Number(elapsedMs) || 0)
  const cycleElapsed = elapsed % cycleDuration
  const linearProgress = cycleElapsed <= duration
    ? cycleElapsed / duration
    : (cycleDuration - cycleElapsed) / duration
  return easeInOutCubic(linearProgress)
}

const sampleTargetOneWayProgress = (elapsedMs, oneWayDurationMs) => {
  const duration = Math.max(1, Number(oneWayDurationMs) || 1)
  const elapsed = Math.max(0, Number(elapsedMs) || 0)
  return easeInOutCubic(elapsed / duration)
}

const sampleTargetMotionProgress = (elapsedMs, oneWayDurationMs, loop) => {
  const duration = Math.max(1, Number(oneWayDurationMs) || 1)
  const animationDuration = loop ? duration * 2 : duration
  const elapsed = Math.max(0, Number(elapsedMs) || 0)
  const normalizedTime = loop
    ? (elapsed % animationDuration) / animationDuration
    : clampUnit(elapsed / animationDuration)
  const scaled = normalizedTime * TARGET_MOTION_KEYFRAME_SEGMENTS
  const lowerIndex = Math.min(TARGET_MOTION_KEYFRAME_SEGMENTS - 1, Math.floor(scaled))
  const upperIndex = lowerIndex + 1
  const ratio = scaled - lowerIndex
  const sampleAtIndex = (index) => {
    const keyframeElapsed = animationDuration * index / TARGET_MOTION_KEYFRAME_SEGMENTS
    return loop
      ? sampleTargetPingPongProgress(keyframeElapsed, duration)
      : sampleTargetOneWayProgress(keyframeElapsed, duration)
  }
  const lower = sampleAtIndex(lowerIndex)
  const upper = sampleAtIndex(upperIndex)
  return lower + (upper - lower) * ratio
}

const sampleTargetMotionState = (
  elapsedMs,
  oneWayDurationMs,
  { loop = false, hideAfterTarget = false, settleMs = 80 } = {}
) => {
  const durationMs = Math.max(1, Number(oneWayDurationMs) || 1)
  const elapsed = Math.max(0, Number(elapsedMs) || 0)
  const arrivalMs = durationMs + Math.max(0, Number(settleMs) || 0)
  const arrived = !loop && elapsed >= arrivalMs
  const hidden = hideAfterTarget === true && arrived
  return {
    progress: sampleTargetMotionProgress(elapsed, durationMs, loop),
    arrived,
    hidden,
    visible: !hidden,
    interactive: !hidden,
    arrivalMs
  }
}

export {
  TARGET_MOTION_KEYFRAME_SEGMENTS,
  getTargetMotionDurationMs,
  sampleTargetMotionProgress,
  sampleTargetMotionState,
  sampleTargetOneWayProgress,
  sampleTargetPingPongProgress
}
