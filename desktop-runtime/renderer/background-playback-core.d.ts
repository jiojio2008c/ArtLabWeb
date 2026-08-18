export type DynamicBackgroundPlaybackMode = 'fixed' | 'random' | 'sequence'

export interface DynamicBackgroundPlaybackEntry {
  id?: string
  assetId?: string
}

export function getDynamicBackgroundPlaybackStartIndex(
  backgrounds?: DynamicBackgroundPlaybackEntry[],
  activeBackgroundId?: string,
  mode?: DynamicBackgroundPlaybackMode
): number
