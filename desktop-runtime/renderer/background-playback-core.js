import { getDynamicPlaybackItemsForBackground } from './advanced-appearance-timeline.js'

export const DEFAULT_DYNAMIC_BACKGROUND_PLAYBACK_LOOP = true

export const normalizeDynamicBackgroundPlaybackLoop = (
  value,
  fallback = DEFAULT_DYNAMIC_BACKGROUND_PLAYBACK_LOOP
) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 0) return false
    if (value === 1) return true
  }
  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase()
    if (['false', '0', 'off', 'no'].includes(normalizedValue)) return false
    if (['true', '1', 'on', 'yes'].includes(normalizedValue)) return true
  }
  if (fallback === false || fallback === 0) return false
  if (typeof fallback === 'string') {
    return !['false', '0', 'off', 'no'].includes(fallback.trim().toLowerCase())
  }
  return true
}

const getBackgroundId = (background) => String(
  background?.id ?? background?.assetId ?? ''
)

export const getDynamicStageItemsForBackground = (items = [], background) => {
  const sourceItems = Array.isArray(items) ? items : []
  const backgroundId = getBackgroundId(background)
  return backgroundId
    ? getDynamicPlaybackItemsForBackground(sourceItems, backgroundId)
    : sourceItems
}

export const getDynamicBackgroundPlaybackStartIndex = (
  backgrounds = [],
  activeBackgroundId = '',
  mode = 'fixed'
) => {
  if (!Array.isArray(backgrounds) || backgrounds.length === 0) return -1
  if (mode === 'sequence') return 0

  const activeId = String(activeBackgroundId ?? '')
  const activeIndex = backgrounds.findIndex((background) => (
    getBackgroundId(background) === activeId
  ))
  return activeIndex >= 0 ? activeIndex : 0
}

const hashString = (value) => {
  let hash = 0
  const text = String(value ?? '')
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

const mixHash = (value) => {
  let mixed = value | 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d)
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b)
  return (mixed ^ (mixed >>> 16)) >>> 0
}

export const getDynamicBackgroundPlaybackRoundLength = (backgrounds = [], mode = 'fixed') => {
  if (!Array.isArray(backgrounds) || backgrounds.length === 0) return 0
  return mode === 'random' || mode === 'sequence' ? backgrounds.length : 1
}

const getRawRandomBackgroundPlaybackOrder = (
  backgrounds,
  activeIndex,
  seed,
  round
) => {
  const indexes = backgrounds.map((background, index) => index)
  if (indexes.length <= 1) return indexes

  const normalizedActiveIndex = indexes.includes(activeIndex) ? activeIndex : 0
  const normalizedSeed = String(seed ?? '')
  const normalizedRound = Math.max(0, Math.floor(Number(round) || 0))
  const shuffle = (values) => {
    const order = values.slice()
    for (let cursor = order.length - 1; cursor > 0; cursor -= 1) {
      const swapIndex = mixHash(hashString([
        normalizedSeed,
        normalizedRound,
        cursor,
        ...order.map((index) => getBackgroundId(backgrounds[index]))
      ].join(':'))) % (cursor + 1)
      const swappedIndex = order[cursor]
      order[cursor] = order[swapIndex]
      order[swapIndex] = swappedIndex
    }
    return order
  }

  if (normalizedRound === 0) {
    const rest = shuffle(indexes.filter((index) => index !== normalizedActiveIndex))
    return [normalizedActiveIndex, ...rest]
  }

  return shuffle(indexes)
}

const getRandomBackgroundPlaybackOrder = (
  backgrounds,
  activeIndex,
  seed,
  round
) => {
  const rawOrder = getRawRandomBackgroundPlaybackOrder(backgrounds, activeIndex, seed, round)
  if (rawOrder.length <= 1 || Number(round) <= 0) return rawOrder
  if (rawOrder.length === 2) {
    const normalizedActiveIndex = backgrounds
      .map((background, index) => index)
      .includes(activeIndex)
      ? activeIndex
      : 0
    return [
      normalizedActiveIndex,
      rawOrder.find((index) => index !== normalizedActiveIndex) ?? rawOrder[0]
    ]
  }

  const previousRawOrder = getRawRandomBackgroundPlaybackOrder(
    backgrounds,
    activeIndex,
    seed,
    Math.max(0, Math.floor(Number(round) || 0) - 1)
  )
  const previousLastIndex = previousRawOrder[previousRawOrder.length - 1]
  const order = rawOrder.slice()
  if (order[0] === previousLastIndex) {
    [order[0], order[1]] = [order[1], order[0]]
  }
  return order
}

export const getDynamicBackgroundPlaybackOrder = (
  backgrounds = [],
  activeBackgroundId = '',
  mode = 'fixed',
  seed = '',
  round = 0
) => {
  if (!Array.isArray(backgrounds) || backgrounds.length === 0) return []
  const normalizedMode = mode === 'sequence' || mode === 'random' ? mode : 'fixed'
  const activeIndex = getDynamicBackgroundPlaybackStartIndex(
    backgrounds,
    activeBackgroundId,
    normalizedMode
  )
  if (normalizedMode === 'sequence') {
    return backgrounds.map((background, index) => index)
  }
  if (normalizedMode === 'fixed') {
    return [activeIndex >= 0 ? activeIndex : 0]
  }
  return getRandomBackgroundPlaybackOrder(
    backgrounds,
    activeIndex,
    seed || backgrounds.map(getBackgroundId).join(','),
    round
  )
}

export const getDynamicBackgroundPlaybackIndexAtCycle = (
  backgrounds = [],
  activeBackgroundId = '',
  mode = 'fixed',
  cycle = 0,
  loop = DEFAULT_DYNAMIC_BACKGROUND_PLAYBACK_LOOP,
  seed = ''
) => {
  if (!Array.isArray(backgrounds) || backgrounds.length === 0) return -1
  const normalizedMode = mode === 'sequence' || mode === 'random' ? mode : 'fixed'
  const normalizedCycle = Math.max(0, Math.floor(Number(cycle) || 0))
  const normalizedLoop = normalizeDynamicBackgroundPlaybackLoop(loop)
  const roundLength = getDynamicBackgroundPlaybackRoundLength(backgrounds, normalizedMode)
  if (!normalizedLoop && normalizedCycle >= roundLength) return -1

  if (normalizedMode === 'sequence') {
    return normalizedCycle % backgrounds.length
  }
  if (normalizedMode === 'fixed') {
    return getDynamicBackgroundPlaybackStartIndex(backgrounds, activeBackgroundId, 'fixed')
  }

  const round = Math.floor(normalizedCycle / backgrounds.length)
  const offset = normalizedCycle % backgrounds.length
  const order = getDynamicBackgroundPlaybackOrder(
    backgrounds,
    activeBackgroundId,
    'random',
    seed || backgrounds.map(getBackgroundId).join(','),
    round
  )
  return order[offset] ?? -1
}

export const getDynamicFixedBackgroundEpochKey = ({
  sessionKey = '',
  groupId = '',
  replayId = 0,
  backgroundId = ''
} = {}) => [
  String(sessionKey ?? ''),
  String(groupId ?? ''),
  String(replayId ?? 0),
  String(backgroundId ?? 'none')
].join(':')

export const resolveDynamicFixedBackgroundEpoch = (previousEpoch, key, now) => {
  if (
    previousEpoch?.key === key
    && Number.isFinite(Number(previousEpoch.changedAt))
  ) {
    return previousEpoch
  }

  const numericNow = Number(now)
  return {
    key,
    changedAt: Number.isFinite(numericNow) ? numericNow : 0
  }
}

export const resolveDynamicBackgroundPlaybackEpoch = (previousEpoch, key, now) => {
  if (
    previousEpoch?.key === key
    && Number.isFinite(Number(previousEpoch.startedAt))
  ) {
    return previousEpoch
  }

  const numericNow = Number(now)
  return {
    key,
    startedAt: Number.isFinite(numericNow) ? numericNow : 0
  }
}
