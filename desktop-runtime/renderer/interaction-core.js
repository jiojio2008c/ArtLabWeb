export const INTERACTIVE_ANIMATION_MIN_ID = 1
export const INTERACTIVE_ANIMATION_MAX_ID = 9
export const RIPPLE_DURATION_MS = 1100

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const normalizeAnimationId = (value) => {
  const animationId = Number(value ?? 0)
  return Number.isFinite(animationId) ? Math.trunc(animationId) : 0
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
    if (override.authoritativeAnimationId !== authoritativeAnimationId) {
      overrides.delete(key)
      return null
    }

    return override
  }

  const cycle = (groupId, item, startedAt) => {
    if (!groupId || !item?.itemId) return null

    const existing = get(groupId, item)
    const authoritativeAnimationId = normalizeAnimationId(item.animationId)
    const activeAnimationId = getNextInteractiveAnimationId(
      existing?.activeAnimationId ?? authoritativeAnimationId
    )
    const override = {
      groupId,
      itemId: item.itemId,
      authoritativeAnimationId,
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
