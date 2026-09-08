const IPAD_CONTROL_IDLE_MS = 5 * 60 * 1000

const shouldReturnFromIpadControl = (controller, lastActivityAt, now = Date.now()) => (
  controller === 'ipad'
  && Number.isFinite(Number(lastActivityAt))
  && Number(lastActivityAt) > 0
  && now - Number(lastActivityAt) >= IPAD_CONTROL_IDLE_MS
)

module.exports = {
  IPAD_CONTROL_IDLE_MS,
  shouldReturnFromIpadControl
}
