const normalizeRevision = (value) => {
  const revision = Number(value)
  return Number.isFinite(revision) && revision > 0 ? revision : 0
}

const isValidRevision = (value) => normalizeRevision(value) > 0

const shouldApplyGroupStateRevision = (currentRevision, incomingRevision) => {
  const incoming = normalizeRevision(incomingRevision)
  const current = normalizeRevision(currentRevision)
  if (incoming <= 0) return current <= 0
  if (current <= 0) return true
  return incoming > current
}

const isSameGroupStateRevision = (currentRevision, incomingRevision) => {
  const incoming = normalizeRevision(incomingRevision)
  const current = Number(currentRevision)
  return incoming > 0 && Number.isFinite(current) && incoming === current
}

const shouldApplySelectionRevision = (currentRevision, incomingRevision) => {
  const incoming = normalizeRevision(incomingRevision)
  const current = normalizeRevision(currentRevision)
  if (incoming <= 0) return current <= 0
  if (current <= 0) return true
  return incoming > current
}

const shouldApplyGroupUploadSideEffect = (currentRevision, incomingRevision) => {
  const incoming = normalizeRevision(incomingRevision)
  const current = normalizeRevision(currentRevision)
  if (incoming <= 0) return current <= 0
  if (current <= 0) return true
  return incoming >= current
}

module.exports = {
  isSameGroupStateRevision,
  isValidRevision,
  normalizeRevision,
  shouldApplyGroupStateRevision,
  shouldApplyGroupUploadSideEffect,
  shouldApplySelectionRevision
}
