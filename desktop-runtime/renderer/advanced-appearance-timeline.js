export const DYNAMIC_LINKED_APPEARANCE_MODES = Object.freeze(['none', 'showAfter', 'hideAfter'])

export const APPEARANCE_FADE_DURATION_MS = 420
export const APPEARANCE_DROP_DURATION_MS = 620
export const APPEARANCE_TRACK_SLIDE_DURATION_MS = 560
export const MAX_LINKED_APPEARANCE_DELAY_MS = 600000
export const MAX_DYNAMIC_APPEARANCE_TIME_MS = 86400000
export const DYNAMIC_APPEARANCE_EASING = 'cubic-bezier(0.333333, 0, 0.666667, 1)'

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

const getItemId = (item) => String(item?.id ?? item?.itemId ?? '')

export const normalizeDynamicAppearAnimation = (value) => (
  value === 'drop' || value === 'trackSlide' ? value : 'none'
)

export const getDynamicAppearanceDurationMs = (appearAnimation) => {
  const normalized = normalizeDynamicAppearAnimation(appearAnimation)
  if (normalized === 'drop') return APPEARANCE_DROP_DURATION_MS
  if (normalized === 'trackSlide') return APPEARANCE_TRACK_SLIDE_DURATION_MS
  return APPEARANCE_FADE_DURATION_MS
}

export const normalizeDynamicLinkedAppearance = (
  value,
  itemId = '',
  validItemIds
) => {
  if (!value || typeof value !== 'object') return undefined

  const triggerItemId = String(value.triggerItemId ?? '').trim()
  const mode = value.mode === 'showAfter' || value.mode === 'hideAfter'
    ? value.mode
    : 'none'
  if (!triggerItemId || triggerItemId === itemId || mode === 'none') return undefined
  if (validItemIds && !validItemIds.has(triggerItemId)) return undefined

  const delayValue = Number(value.delayMs)
  const delayMs = clamp(
    Number.isFinite(delayValue) ? Math.round(delayValue) : 0,
    0,
    MAX_LINKED_APPEARANCE_DELAY_MS
  )
  return { triggerItemId, mode, delayMs }
}

export const normalizeDynamicAppearanceTimeMs = (value, fallback = 0) => {
  const numericValue = Number(value)
  const numericFallback = Number(fallback)
  return clamp(
    Number.isFinite(numericValue)
      ? Math.round(numericValue)
      : Number.isFinite(numericFallback)
        ? Math.round(numericFallback)
        : 0,
    0,
    MAX_DYNAMIC_APPEARANCE_TIME_MS
  )
}

const getExplicitAppearanceTimeMs = (item, field) => {
  const sourceValue = item?.[field]
  if (sourceValue === null || sourceValue === undefined || sourceValue === '') return null
  const value = Number(sourceValue)
  return Number.isFinite(value)
    ? normalizeDynamicAppearanceTimeMs(value)
    : null
}

const getNormalizedLinkMap = (items) => {
  const validItemIds = new Set(items.map(getItemId).filter(Boolean))
  return new Map(items.map((item) => {
    const itemId = getItemId(item)
    return [
      itemId,
      normalizeDynamicLinkedAppearance(item?.linkedAppearance, itemId, validItemIds)
    ]
  }).filter(([itemId, link]) => itemId && link))
}

const linkPathHasCycle = (itemId, linkByItemId) => {
  const visited = new Set([itemId])
  let currentId = itemId

  while (linkByItemId.has(currentId)) {
    const triggerItemId = linkByItemId.get(currentId).triggerItemId
    if (visited.has(triggerItemId)) return true
    visited.add(triggerItemId)
    currentId = triggerItemId
  }
  return false
}

const getValidNormalizedLinkMap = (items) => {
  const candidateLinkByItemId = getNormalizedLinkMap(items)
  return new Map(
    Array.from(candidateLinkByItemId.entries()).filter(([itemId]) => (
      !linkPathHasCycle(itemId, candidateLinkByItemId)
    ))
  )
}

export const isDynamicItemBoundToBackground = (item, backgroundId = '') => (
  !Array.isArray(item?.backgroundIds)
  || item.backgroundIds.length === 0
  || item.backgroundIds.includes(backgroundId)
)

const normalizeBackgroundIds = (value) => (
  Array.isArray(value)
    ? Array.from(new Set(value.map((backgroundId) => String(backgroundId ?? '').trim()).filter(Boolean)))
    : []
)

const backgroundIdsMatch = (left, right) => (
  left.length === right.length
  && left.every((backgroundId, index) => backgroundId === right[index])
)

const getEffectiveBackgroundState = (items) => {
  const itemById = new Map(items.map((item) => [getItemId(item), item]).filter(([itemId]) => itemId))
  const validLinkByTargetId = getValidNormalizedLinkMap(items)
  const effectiveIdsByItemId = new Map()

  const resolveBackgroundIds = (itemId, visited = new Set()) => {
    if (effectiveIdsByItemId.has(itemId)) return effectiveIdsByItemId.get(itemId)

    const item = itemById.get(itemId)
    if (!item) return []

    const ownBackgroundIds = normalizeBackgroundIds(item.backgroundIds)
    if (visited.has(itemId)) return ownBackgroundIds

    const link = validLinkByTargetId.get(itemId)
    const inheritedBackgroundIds = link && itemById.has(link.triggerItemId)
      ? resolveBackgroundIds(link.triggerItemId, new Set([...visited, itemId]))
      : ownBackgroundIds
    effectiveIdsByItemId.set(itemId, inheritedBackgroundIds)
    return inheritedBackgroundIds
  }

  itemById.forEach((_item, itemId) => resolveBackgroundIds(itemId))
  return { effectiveIdsByItemId, validLinkByTargetId }
}

export const getDynamicEffectiveBackgroundIds = (items = [], itemId = '') => {
  const validItems = Array.isArray(items) ? items.filter((item) => getItemId(item)) : []
  const { effectiveIdsByItemId } = getEffectiveBackgroundState(validItems)
  return [...(effectiveIdsByItemId.get(String(itemId ?? '')) ?? [])]
}

export const synchronizeDynamicLinkedBackgrounds = (items = []) => {
  const sourceItems = Array.isArray(items) ? items : []
  const validItems = sourceItems.filter((item) => getItemId(item))
  const { effectiveIdsByItemId, validLinkByTargetId } = getEffectiveBackgroundState(validItems)

  return sourceItems.map((item) => {
    const itemId = getItemId(item)
    if (!itemId || !validLinkByTargetId.has(itemId)) return item

    const inheritedBackgroundIds = [...(effectiveIdsByItemId.get(itemId) ?? [])]
    const currentBackgroundIds = normalizeBackgroundIds(item.backgroundIds)
    return backgroundIdsMatch(currentBackgroundIds, inheritedBackgroundIds)
      ? item
      : { ...item, backgroundIds: inheritedBackgroundIds }
  })
}

export const getDynamicPlaybackItemsForBackground = (items = [], backgroundId = '') => {
  const validItems = Array.isArray(items) ? items.filter((item) => getItemId(item)) : []
  const { effectiveIdsByItemId } = getEffectiveBackgroundState(validItems)

  return validItems.filter((item) => {
    const effectiveBackgroundIds = effectiveIdsByItemId.get(getItemId(item)) ?? []
    return effectiveBackgroundIds.length === 0 || effectiveBackgroundIds.includes(backgroundId)
  })
}

export const wouldCreateDynamicLinkedAppearanceCycle = (
  items,
  itemId,
  triggerItemId
) => {
  if (!itemId || !triggerItemId || itemId === triggerItemId) return true

  const linkByItemId = getNormalizedLinkMap(items)
  linkByItemId.set(itemId, {
    triggerItemId,
    mode: 'showAfter',
    delayMs: 0
  })
  return linkPathHasCycle(itemId, linkByItemId)
}

export const buildDynamicAppearanceTimeline = ({
  items = [],
  appearMode = 'all',
  intervalMs = 800,
  appearAnimation = 'none',
  activeItemIds = []
} = {}) => {
  const normalizedAnimation = normalizeDynamicAppearAnimation(appearAnimation)
  const entranceDurationMs = getDynamicAppearanceDurationMs(normalizedAnimation)
  const normalizedIntervalMs = clamp(Number(intervalMs) || 800, 100, 5000)
  const itemById = new Map(items.map((item) => [getItemId(item), item]).filter(([itemId]) => itemId))
  const alreadyActiveItemIds = activeItemIds instanceof Set
    ? activeItemIds
    : new Set(activeItemIds)
  const validLinkByItemId = getValidNormalizedLinkMap(items)
  const independentItemIds = new Set(items
    .filter((item) => getExplicitAppearanceTimeMs(item, 'appearanceDelayMs') !== null)
    .map(getItemId)
    .filter(Boolean))
  const normalItemIds = items
    .map(getItemId)
    .filter((itemId) => (
      itemId
      && !alreadyActiveItemIds.has(itemId)
      && (!validLinkByItemId.has(itemId) || independentItemIds.has(itemId))
    ))
  const normalIndexByItemId = new Map(normalItemIds.map((itemId, index) => [itemId, index]))
  const timelineByItemId = new Map()

  const resolveSchedule = (itemId) => {
    const existing = timelineByItemId.get(itemId)
    if (existing) return existing

    const item = itemById.get(itemId)
    if (!item) return undefined

    const explicitAppearanceDelayMs = getExplicitAppearanceTimeMs(item, 'appearanceDelayMs')
    const explicitAppearanceHideMs = getExplicitAppearanceTimeMs(item, 'appearanceHideMs')
    const link = explicitAppearanceDelayMs === null
      ? validLinkByItemId.get(itemId)
      : undefined

    if (alreadyActiveItemIds.has(itemId) && !link) {
      const hideStartMs = explicitAppearanceHideMs
      const schedule = {
        itemId,
        kind: hideStartMs === null ? 'normal' : 'hideAfter',
        linked: false,
        triggerItemId: null,
        delayMs: 0,
        appearAnimation: 'none',
        entranceStartMs: 0,
        entranceDurationMs: 0,
        appearanceCompleteMs: 0,
        activeStartMs: 0,
        hideStartMs,
        hideCompleteMs: hideStartMs === null
          ? null
          : hideStartMs + APPEARANCE_FADE_DURATION_MS,
        sequenceIndex: -1
      }
      timelineByItemId.set(itemId, schedule)
      return schedule
    }

    if (link) {
      const triggerSchedule = resolveSchedule(link.triggerItemId)
      if (triggerSchedule) {
        if (link.mode === 'showAfter') {
          const entranceStartMs = triggerSchedule.appearanceCompleteMs + link.delayMs
          const schedule = {
            itemId,
            kind: 'showAfter',
            linked: true,
            triggerItemId: link.triggerItemId,
            delayMs: link.delayMs,
            appearAnimation: 'none',
            entranceStartMs,
            entranceDurationMs: APPEARANCE_FADE_DURATION_MS,
            appearanceCompleteMs: entranceStartMs + APPEARANCE_FADE_DURATION_MS,
            activeStartMs: entranceStartMs,
            hideStartMs: null,
            hideCompleteMs: null,
            sequenceIndex: -1
          }
          timelineByItemId.set(itemId, schedule)
          return schedule
        }

        const hideStartMs = triggerSchedule.appearanceCompleteMs + link.delayMs
        const schedule = {
          itemId,
          kind: 'hideAfter',
          linked: true,
          triggerItemId: link.triggerItemId,
          delayMs: link.delayMs,
          appearAnimation: 'none',
          entranceStartMs: 0,
          entranceDurationMs: 0,
          appearanceCompleteMs: 0,
          activeStartMs: 0,
          hideStartMs,
          hideCompleteMs: hideStartMs + APPEARANCE_FADE_DURATION_MS,
          sequenceIndex: -1
        }
        timelineByItemId.set(itemId, schedule)
        return schedule
      }
    }

    const sequenceIndex = normalIndexByItemId.get(itemId) ?? 0
    const entranceStartMs = explicitAppearanceDelayMs ?? (
      appearMode === 'sequence'
        ? sequenceIndex * normalizedIntervalMs
        : 0
    )
    const hideStartMs = explicitAppearanceHideMs
    const itemEntranceDurationMs = hideStartMs !== null && entranceStartMs === 0
      ? 0
      : entranceDurationMs
    const schedule = {
      itemId,
      kind: hideStartMs === null ? 'normal' : 'hideAfter',
      linked: false,
      triggerItemId: null,
      delayMs: 0,
      appearAnimation: itemEntranceDurationMs > 0 ? normalizedAnimation : 'none',
      entranceStartMs,
      entranceDurationMs: itemEntranceDurationMs,
      appearanceCompleteMs: entranceStartMs + itemEntranceDurationMs,
      activeStartMs: entranceStartMs,
      hideStartMs,
      hideCompleteMs: hideStartMs === null
        ? null
        : hideStartMs + APPEARANCE_FADE_DURATION_MS,
      sequenceIndex
    }
    timelineByItemId.set(itemId, schedule)
    return schedule
  }

  items.forEach((item) => resolveSchedule(getItemId(item)))
  return Object.fromEntries(timelineByItemId)
}

export const convertDynamicLinkedAppearanceToIndependentTiming = ({
  items = [],
  appearMode = 'all',
  intervalMs = 800,
  appearAnimation = 'none'
} = {}) => {
  const synchronizedItems = synchronizeDynamicLinkedBackgrounds(items)
  const orderedTimelineItems = synchronizedItems
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftOrder = Number(left.item?.order)
      const rightOrder = Number(right.item?.order)
      const normalizedLeftOrder = Number.isFinite(leftOrder) ? leftOrder : 0
      const normalizedRightOrder = Number.isFinite(rightOrder) ? rightOrder : 0
      return normalizedLeftOrder - normalizedRightOrder || left.index - right.index
    })
    .map(({ item }) => item)
  const timeline = buildDynamicAppearanceTimeline({
    items: orderedTimelineItems,
    appearMode,
    intervalMs,
    appearAnimation
  })

  return synchronizedItems.map((item) => {
    const itemId = getItemId(item)
    const schedule = timeline[itemId]
    const explicitDelayMs = getExplicitAppearanceTimeMs(item, 'appearanceDelayMs')
    const explicitHideMs = getExplicitAppearanceTimeMs(item, 'appearanceHideMs')
    return {
      ...item,
      appearanceDelayMs: explicitDelayMs ?? normalizeDynamicAppearanceTimeMs(schedule?.entranceStartMs),
      appearanceHideMs: explicitHideMs
        ?? (schedule?.hideStartMs === null || schedule?.hideStartMs === undefined
          ? undefined
          : normalizeDynamicAppearanceTimeMs(schedule.hideStartMs)),
      hideAfterTarget: item?.hideAfterTarget === true,
      linkedAppearance: undefined
    }
  })
}

const smoothstep = (value) => {
  const ratio = clamp(value, 0, 1)
  return ratio * ratio * (3 - 2 * ratio)
}

export const sampleDynamicAppearanceTimeline = (schedule, elapsedMs) => {
  if (!schedule) {
    return { alpha: 1, active: true, interactive: true, animationElapsedMs: Math.max(0, elapsedMs) }
  }

  const elapsed = Number(elapsedMs) || 0
  const entranceAlpha = schedule.entranceDurationMs <= 0
    ? (elapsed >= schedule.entranceStartMs ? 1 : 0)
    : smoothstep((elapsed - schedule.entranceStartMs) / schedule.entranceDurationMs)
  const hideAlpha = schedule.hideStartMs === null
    ? 1
    : 1 - smoothstep((elapsed - schedule.hideStartMs) / APPEARANCE_FADE_DURATION_MS)
  const alpha = entranceAlpha * hideAlpha
  return {
    alpha,
    active: elapsed >= schedule.activeStartMs && alpha > 0.001,
    interactive: elapsed >= schedule.activeStartMs && alpha > 0.04,
    animationElapsedMs: Math.max(0, elapsed - schedule.activeStartMs)
  }
}

export const getDynamicAppearanceAnimationSeekMs = (schedule, elapsedMs) => {
  if (!schedule) return 0

  const numericElapsed = Number(elapsedMs)
  const elapsed = Number.isFinite(numericElapsed) ? Math.max(0, numericElapsed) : 0
  if (
    schedule.hideStartMs !== null
    && elapsed >= schedule.hideStartMs
  ) {
    const hideStartMs = Number(schedule.hideStartMs)
    if (!Number.isFinite(hideStartMs)) return 0
    return clamp(elapsed - hideStartMs, 0, APPEARANCE_FADE_DURATION_MS)
  }

  const entranceStartMs = Number(schedule.entranceStartMs)
  const entranceDurationMs = Number(schedule.entranceDurationMs)
  if (!Number.isFinite(entranceStartMs) || !Number.isFinite(entranceDurationMs)) return 0
  return clamp(
    elapsed - entranceStartMs,
    0,
    Math.max(0, entranceDurationMs)
  )
}

export const canContinueDynamicAppearanceEpoch = (
  item,
  previousEpoch,
  {
    sameSession = true,
    rootActive = false,
    triggerContinues = false,
    schedule
  } = {}
) => {
  if (!sameSession || !previousEpoch?.schedule) return false

  const previousSchedule = previousEpoch.schedule
  const currentSchedule = schedule
  const linkedAppearance = item?.linkedAppearance
  const currentLinked = currentSchedule
    ? currentSchedule.linked === true
    : Boolean(linkedAppearance)

  if (!currentLinked) {
    return rootActive && previousSchedule.linked !== true
  }

  const triggerItemId = currentSchedule?.triggerItemId ?? linkedAppearance?.triggerItemId
  const kind = currentSchedule?.kind ?? linkedAppearance?.mode
  const delayMs = currentSchedule?.delayMs ?? linkedAppearance?.delayMs
  return triggerContinues
    && previousSchedule.linked === true
    && previousSchedule.triggerItemId === triggerItemId
    && previousSchedule.kind === kind
    && previousSchedule.delayMs === delayMs
}

export const getContinuableDynamicAppearanceItemIds = ({
  items = [],
  previousEpochs,
  timeline = {},
  activeItemIds = [],
  sameSession = true
} = {}) => {
  if (!sameSession) return new Set()

  const itemById = new Map(items.map((item) => [getItemId(item), item]).filter(([itemId]) => itemId))
  const activeIds = activeItemIds instanceof Set ? activeItemIds : new Set(activeItemIds)
  const continuationByItemId = new Map()
  const resolvingItemIds = new Set()
  const getPreviousEpoch = (itemId) => (
    typeof previousEpochs?.get === 'function'
      ? previousEpochs.get(itemId)
      : previousEpochs?.[itemId]
  )

  const resolveContinuation = (itemId) => {
    if (continuationByItemId.has(itemId)) return continuationByItemId.get(itemId)
    if (resolvingItemIds.has(itemId)) return false

    const item = itemById.get(itemId)
    const schedule = timeline[itemId]
    const previousEpoch = getPreviousEpoch(itemId)
    if (!item || !schedule || !previousEpoch) {
      continuationByItemId.set(itemId, false)
      return false
    }

    resolvingItemIds.add(itemId)
    const triggerContinues = schedule.linked === true
      ? resolveContinuation(schedule.triggerItemId)
      : false
    const continues = canContinueDynamicAppearanceEpoch(item, previousEpoch, {
      sameSession,
      rootActive: activeIds.has(itemId),
      triggerContinues,
      schedule
    })
    resolvingItemIds.delete(itemId)
    continuationByItemId.set(itemId, continues)
    return continues
  }

  itemById.forEach((_item, itemId) => resolveContinuation(itemId))
  return new Set(
    Array.from(continuationByItemId.entries())
      .filter(([, continues]) => continues)
      .map(([itemId]) => itemId)
  )
}
