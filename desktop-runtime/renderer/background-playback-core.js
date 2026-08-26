import { getDynamicPlaybackItemsForBackground } from './advanced-appearance-timeline.js'

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
