const clampUnit = (value) => Math.min(1, Math.max(0, value))

const smoothstep = (value) => {
  const progress = clampUnit(value)
  return progress * progress * (3 - 2 * progress)
}

const sampleDesktopEntranceProgress = (schedule, elapsedMs, fallbackProgress = 1) => {
  const numericElapsedMs = Number(elapsedMs)
  if (!schedule || !Number.isFinite(numericElapsedMs)) {
    const numericFallback = Number(fallbackProgress)
    return clampUnit(Number.isFinite(numericFallback) ? numericFallback : 1)
  }

  const entranceStartMs = Math.max(0, Number(schedule.entranceStartMs) || 0)
  const entranceDurationMs = Math.max(0, Number(schedule.entranceDurationMs) || 0)
  if (entranceDurationMs <= 0) return numericElapsedMs >= entranceStartMs ? 1 : 0

  return smoothstep((numericElapsedMs - entranceStartMs) / entranceDurationMs)
}

const getDesktopTrackSlideOffsetX = ({
  positionX,
  stageWidth,
  halfWidth,
  edgePadding = 72,
  entranceProgress
}) => {
  const numericPositionX = Number(positionX)
  const normalizedPositionX = Math.min(
    1.5,
    Math.max(-0.5, Number.isFinite(numericPositionX) ? numericPositionX : 0.5)
  )
  const numericStageWidth = Number(stageWidth)
  const normalizedStageWidth = Number.isFinite(numericStageWidth) ? Math.max(0, numericStageWidth) : 0
  const numericHalfWidth = Number(halfWidth)
  const normalizedHalfWidth = Number.isFinite(numericHalfWidth) ? Math.max(0, numericHalfWidth) : 0
  const numericEdgePadding = Number(edgePadding)
  const normalizedEdgePadding = Number.isFinite(numericEdgePadding) ? Math.max(0, numericEdgePadding) : 0
  const numericProgress = Number(entranceProgress)
  const normalizedProgress = clampUnit(Number.isFinite(numericProgress) ? numericProgress : 1)
  const fromRight = normalizedPositionX >= 0.5
  const initialOffsetX = fromRight
    ? (1 - normalizedPositionX) * normalizedStageWidth + normalizedHalfWidth + normalizedEdgePadding
    : -(normalizedPositionX * normalizedStageWidth + normalizedHalfWidth + normalizedEdgePadding)

  return initialOffsetX * (1 - normalizedProgress)
}

export {
  getDesktopTrackSlideOffsetX,
  sampleDesktopEntranceProgress
}
