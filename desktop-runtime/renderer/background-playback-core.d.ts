export type DynamicBackgroundPlaybackMode = 'fixed' | 'random' | 'sequence'

export const DEFAULT_DYNAMIC_BACKGROUND_PLAYBACK_LOOP: true

export function normalizeDynamicBackgroundPlaybackLoop(
  value: unknown,
  fallback?: boolean
): boolean

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

export function getDynamicBackgroundPlaybackOrder(
  backgrounds?: DynamicBackgroundPlaybackEntry[],
  activeBackgroundId?: string,
  mode?: DynamicBackgroundPlaybackMode,
  seed?: string,
  round?: number
): number[]

export function getDynamicBackgroundPlaybackRoundLength(
  backgrounds?: DynamicBackgroundPlaybackEntry[],
  mode?: DynamicBackgroundPlaybackMode
): number

export function getDynamicBackgroundPlaybackIndexAtCycle(
  backgrounds?: DynamicBackgroundPlaybackEntry[],
  activeBackgroundId?: string,
  mode?: DynamicBackgroundPlaybackMode,
  cycle?: number,
  loop?: boolean,
  seed?: string
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
