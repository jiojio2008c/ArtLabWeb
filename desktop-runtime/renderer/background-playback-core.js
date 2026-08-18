const getBackgroundId = (background) => String(
  background?.id ?? background?.assetId ?? ''
)

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
