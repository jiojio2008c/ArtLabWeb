import {
  DYNAMIC_CLICK_ANIMATION_NONE_ID,
  normalizeDynamicClickAnimationIds
} from './dynamic-animation-catalog.js'

export const INTERACTIVE_ANIMATION_MIN_ID = 1
export const INTERACTIVE_ANIMATION_MAX_ID = 17
export const RIPPLE_DURATION_MS = 1100
export const WATER_RIPPLE_FALLBACK_PROFILE = Object.freeze({
  ringAlpha: 0.48,
  centerAlpha: 0.24
})

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const normalizeAnimationId = (value) => {
  const animationId = Number(value ?? 0)
  return Number.isFinite(animationId) ? Math.trunc(animationId) : 0
}

const normalizeAnimationIds = (value, legacy = false) => {
  return normalizeDynamicClickAnimationIds(value, legacy)
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
  const cursors = new Map()

  const matchesItem = (override, item) => {
    const authoritativeAnimationId = normalizeAnimationId(item.animationId)
    const legacyRange = !Array.isArray(item.clickAnimationIds)
    const authoritativeAnimationIds = normalizeAnimationIds(item.clickAnimationIds, legacyRange)
    return override.authoritativeAnimationId === authoritativeAnimationId
      && override.authoritativeAnimationMode === (item.animationMode ?? 'fixed')
      && JSON.stringify(override.authoritativeAnimationIds) === JSON.stringify(authoritativeAnimationIds)
  }

  const get = (groupId, item) => {
    if (!groupId || !item?.itemId) return null

    const key = makeOverrideKey(groupId, item.itemId)
    const override = overrides.get(key)
    if (!override) return null

    if (!matchesItem(override, item)) {
      overrides.delete(key)
      cursors.delete(key)
      return null
    }

    return override
  }

  const cycle = (groupId, item, startedAt) => {
    if (!groupId || !item?.itemId) return null

    const key = makeOverrideKey(groupId, item.itemId)
    const existing = get(groupId, item)
    const cursor = cursors.get(key)
    const previous = existing ?? (cursor && matchesItem(cursor, item) ? cursor : null)
    if (cursor && !previous) cursors.delete(key)
    const authoritativeAnimationId = normalizeAnimationId(item.animationId)
    const authoritativeAnimationMode = item.animationMode ?? (
      authoritativeAnimationId === 0 ? 'none' : 'fixed'
    )
    const authoritativeAnimationIds = normalizeAnimationIds(
      item.clickAnimationIds,
      !Array.isArray(item.clickAnimationIds)
    )
    if (
      authoritativeAnimationIds.length === 1
      && authoritativeAnimationIds[0] === DYNAMIC_CLICK_ANIMATION_NONE_ID
    ) {
      overrides.delete(key)
      cursors.delete(key)
      return null
    }
    const currentIndex = authoritativeAnimationIds.indexOf(
      previous?.activeAnimationId ?? authoritativeAnimationId
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

    overrides.set(key, override)
    cursors.set(key, override)
    return override
  }

  const complete = (groupId, itemId, startedAt) => {
    if (!groupId || !itemId) return false
    const key = makeOverrideKey(groupId, itemId)
    const override = overrides.get(key)
    if (!override || (startedAt !== undefined && override.startedAt !== startedAt)) return false
    overrides.delete(key)
    return true
  }

  const clearAll = () => {
    overrides.clear()
    cursors.clear()
  }

  const clearGroup = (groupId) => {
    for (const entries of [overrides, cursors]) {
      entries.forEach((override, key) => {
        if (override.groupId === groupId) entries.delete(key)
      })
    }
  }

  const clearItem = (groupId, itemId) => {
    if (!groupId || !itemId) return
    const key = makeOverrideKey(groupId, itemId)
    overrides.delete(key)
    cursors.delete(key)
  }

  const reconcile = (state) => {
    for (const entries of [overrides, cursors]) {
      entries.forEach((override, key) => {
        const group = state?.groups?.[override.groupId]
        const item = group?.items?.find((candidate) => candidate.itemId === override.itemId)
        if (!item || !matchesItem(override, item)) entries.delete(key)
      })
    }
  }

  return {
    get,
    cycle,
    complete,
    clearAll,
    clearGroup,
    clearItem,
    reconcile,
    get size() {
      return overrides.size
    }
  }
}

export const isAnimationOverrideComplete = (override, now, durationSeconds) => {
  const startedAt = Number(override?.startedAt)
  const currentTime = Number(now)
  const duration = Number(durationSeconds)
  if (!Number.isFinite(startedAt) || !Number.isFinite(currentTime) || !Number.isFinite(duration) || duration < 0) {
    return false
  }
  return currentTime - startedAt >= duration * 1000
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
        alpha: Math.pow(1 - progress, 1.75) * (WATER_RIPPLE_FALLBACK_PROFILE.ringAlpha - index * 0.07),
        lineWidth: 4.2 - index * 0.7
      }
    })
    .filter(Boolean)

  return {
    x: ripple.x,
    y: ripple.y,
    centerRadius: 8 + clamp(elapsed / 180, 0, 1) * 24,
    centerAlpha: Math.pow(1 - elapsed / RIPPLE_DURATION_MS, 2) * WATER_RIPPLE_FALLBACK_PROFILE.centerAlpha,
    rings
  }
}
