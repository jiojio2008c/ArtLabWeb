export type DynamicBackgroundPlaybackMode = 'fixed' | 'random' | 'sequence'

export interface DynamicBackgroundPlaybackEntry {
  id?: string
  assetId?: string
}

export function getDynamicStageItemsForBackground<T>(
  items?: T[],
  background?: DynamicBackgroundPlaybackEntry
): T[]

export function getDynamicBackgroundPlaybackStartIndex(
  backgrounds?: DynamicBackgroundPlaybackEntry[],
  activeBackgroundId?: string,
  mode?: DynamicBackgroundPlaybackMode
): number

export interface DynamicFixedBackgroundEpoch {
  key: string
  changedAt: number
}

export function getDynamicFixedBackgroundEpochKey(options?: {
  sessionKey?: string
  groupId?: string
  replayId?: number | string
  backgroundId?: string
}): string

export function resolveDynamicFixedBackgroundEpoch(
  previousEpoch: DynamicFixedBackgroundEpoch | undefined,
  key: string,
  now: number
): DynamicFixedBackgroundEpoch

export interface DynamicBackgroundPlaybackEpoch {
  key: string
  startedAt: number
}

export function resolveDynamicBackgroundPlaybackEpoch(
  previousEpoch: DynamicBackgroundPlaybackEpoch | undefined,
  key: string,
  now: number
): DynamicBackgroundPlaybackEpoch
