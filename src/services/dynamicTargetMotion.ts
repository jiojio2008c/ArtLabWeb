const clampUnit = (value: number) => Math.min(1, Math.max(0, value))

const easeInOutCubic = (value: number) => {
  const progress = clampUnit(value)
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2
}

const sampleTargetPingPongProgress = (elapsedMs: number, oneWayDurationMs: number) => {
  const duration = Math.max(1, Number(oneWayDurationMs) || 1)
  const cycleDuration = duration * 2
  const elapsed = Math.max(0, Number(elapsedMs) || 0)
  const cycleElapsed = elapsed % cycleDuration
  const linearProgress = cycleElapsed <= duration
    ? cycleElapsed / duration
    : (cycleDuration - cycleElapsed) / duration
  return easeInOutCubic(linearProgress)
}

const sampleTargetOneWayProgress = (elapsedMs: number, oneWayDurationMs: number) => {
  const duration = Math.max(1, Number(oneWayDurationMs) || 1)
  const elapsed = Math.max(0, Number(elapsedMs) || 0)
  return easeInOutCubic(elapsed / duration)
}

const sampleTargetMotionProgress = (
  elapsedMs: number,
  oneWayDurationMs: number,
  loop: boolean
) => loop
  ? sampleTargetPingPongProgress(elapsedMs, oneWayDurationMs)
  : sampleTargetOneWayProgress(elapsedMs, oneWayDurationMs)

export {
  sampleTargetMotionProgress,
  sampleTargetOneWayProgress,
  sampleTargetPingPongProgress
}
