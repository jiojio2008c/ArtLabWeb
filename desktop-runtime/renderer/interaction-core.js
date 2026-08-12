export const INTERACTIVE_ANIMATION_MIN_ID = 1
export const INTERACTIVE_ANIMATION_MAX_ID = 17
export const RIPPLE_DURATION_MS = 1100

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const normalizeAnimationId = (value) => {
  const animationId = Number(value ?? 0)
  return Number.isFinite(animationId) ? Math.trunc(animationId) : 0
}

const normalizeAnimationIds = (value, legacy = false) => {
  const fallback = legacy
    ? [1, 2, 3, 4, 5, 6, 7, 8, 9]
    : Array.from({ length: INTERACTIVE_ANIMATION_MAX_ID }, (_unused, index) => index + 1)
  const source = Array.isArray(value) ? value : []
  const ids = [...new Set(source
    .map((id) => normalizeAnimationId(id))
    .filter((id) => id >= 1 && id <= INTERACTIVE_ANIMATION_MAX_ID))]
    .sort((first, second) => first - second)
  return ids.length > 0 ? ids : fallback
}

const makeOverrideKey = (groupId, itemId) => `${groupId}\u0000${itemId}`

export const getNextInteractiveAnimationId = (animationId) => {
  const current = normalizeAnimationId(animationId)
  if (current < INTERACTIVE_ANIMATION_MIN_ID || current >= INTERACTIVE_ANIMATION_MAX_ID) {
    return INTERACTIVE_ANIMATION_MIN_ID
  }
  return current + 1
}

export const mapClientPointToStage = ({
  clientX,
  clientY,
  stageScale,
  stageOffsetX,
  stageOffsetY,
  stageWidth,
  stageHeight
}) => {
  if (!Number.isFinite(stageScale) || stageScale <= 0) return null

  const x = (clientX - stageOffsetX) / stageScale
  const y = (clientY - stageOffsetY) / stageScale
  if (x < 0 || x > stageWidth || y < 0 || y > stageHeight) return null

  return { x, y }
}

export const createAnimationOverrideStore = () => {
  const overrides = new Map()

  const get = (groupId, item) => {
    if (!groupId || !item?.itemId) return null

    const key = makeOverrideKey(groupId, item.itemId)
    const override = overrides.get(key)
    if (!override) return null

    const authoritativeAnimationId = normalizeAnimationId(item.animationId)
    const legacyRange = !Array.isArray(item.clickAnimationIds)
    const authoritativeAnimationIds = normalizeAnimationIds(item.clickAnimationIds, legacyRange)
    if (
      override.authoritativeAnimationId !== authoritativeAnimationId
      || override.authoritativeAnimationMode !== (item.animationMode ?? 'fixed')
      || JSON.stringify(override.authoritativeAnimationIds) !== JSON.stringify(authoritativeAnimationIds)
    ) {
      overrides.delete(key)
      return null
    }

    return override
  }

  const cycle = (groupId, item, startedAt) => {
    if (!groupId || !item?.itemId) return null

    const existing = get(groupId, item)
    const authoritativeAnimationId = normalizeAnimationId(item.animationId)
    const authoritativeAnimationMode = item.animationMode ?? (
      authoritativeAnimationId === 0 ? 'none' : 'fixed'
    )
    const authoritativeAnimationIds = normalizeAnimationIds(
      item.clickAnimationIds,
      !Array.isArray(item.clickAnimationIds)
    )
    const currentIndex = authoritativeAnimationIds.indexOf(
      existing?.activeAnimationId ?? authoritativeAnimationId
    )
    const activeAnimationId = authoritativeAnimationIds[
      currentIndex >= 0 ? (currentIndex + 1) % authoritativeAnimationIds.length : 0
    ]
    const override = {
      groupId,
      itemId: item.itemId,
      authoritativeAnimationId,
      authoritativeAnimationMode,
      authoritativeAnimationIds,
      activeAnimationId,
      startedAt
    }

    overrides.set(makeOverrideKey(groupId, item.itemId), override)
    return override
  }

  const clearAll = () => {
    overrides.clear()
  }

  const clearGroup = (groupId) => {
    overrides.forEach((override, key) => {
      if (override.groupId === groupId) overrides.delete(key)
    })
  }

  const clearItem = (groupId, itemId) => {
    if (!groupId || !itemId) return
    overrides.delete(makeOverrideKey(groupId, itemId))
  }

  const reconcile = (state) => {
    overrides.forEach((override, key) => {
      const group = state?.groups?.[override.groupId]
      const item = group?.items?.find((candidate) => candidate.itemId === override.itemId)
      if (
        !item
        || normalizeAnimationId(item.animationId) !== override.authoritativeAnimationId
        || (item.animationMode ?? 'fixed') !== override.authoritativeAnimationMode
        || JSON.stringify(normalizeAnimationIds(item.clickAnimationIds, !Array.isArray(item.clickAnimationIds)))
          !== JSON.stringify(override.authoritativeAnimationIds)
      ) {
        overrides.delete(key)
      }
    })
  }

  return {
    get,
    cycle,
    clearAll,
    clearGroup,
    clearItem,
    reconcile,
    get size() {
      return overrides.size
    }
  }
}

export const sampleRipple = (ripple, now) => {
  const elapsed = now - ripple.startedAt
  if (elapsed < 0 || elapsed >= RIPPLE_DURATION_MS) return null

  const ringDelays = [0, 72, 144]
  const rings = ringDelays
    .map((delay, index) => {
      const progress = clamp((elapsed - delay) / (RIPPLE_DURATION_MS - delay), 0, 1)
      if (elapsed < delay) return null

      const eased = 1 - Math.pow(1 - progress, 3)
      return {
        radius: 18 + eased * (132 + index * 18),
        alpha: Math.pow(1 - progress, 1.75) * (0.42 - index * 0.07),
        lineWidth: 4.2 - index * 0.7
      }
    })
    .filter(Boolean)

  return {
    x: ripple.x,
    y: ripple.y,
    centerRadius: 8 + clamp(elapsed / 180, 0, 1) * 24,
    centerAlpha: Math.pow(1 - elapsed / RIPPLE_DURATION_MS, 2) * 0.2,
    rings
  }
}
