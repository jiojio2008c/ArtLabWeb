export type DynamicAppearAnimation = 'none' | 'drop' | 'trackSlide'
export type DynamicLinkedAppearanceMode = 'none' | 'showAfter' | 'hideAfter'

export interface DynamicLinkedAppearance {
  triggerItemId: string
  mode: Exclude<DynamicLinkedAppearanceMode, 'none'>
  delayMs: number
}

export interface DynamicAppearanceItem {
  id?: string
  itemId?: string
  linkedAppearance?: DynamicLinkedAppearance
  appearanceDelayMs?: number
  appearanceHideMs?: number | null
  hideAfterTarget?: boolean
  backgroundIds?: string[]
  appearanceByBackground?: Record<string, DynamicAppearanceTiming>
}

export interface DynamicAppearanceTiming {
  appearanceDelayMs?: number
  appearanceHideMs?: number | null
}

export interface DynamicBackgroundAppearance {
  appearMode: 'sequence' | 'all'
  appearIntervalMs: number
  appearAnimation: DynamicAppearAnimation
}

export interface DynamicAppearanceGroup {
  appearMode?: 'sequence' | 'all'
  appearIntervalMs?: number
  appearAnimation?: DynamicAppearAnimation
}

export interface DynamicAppearanceBackground {
  appearance?: Partial<DynamicBackgroundAppearance> & {
    mode?: 'sequence' | 'all'
    intervalMs?: number
    animation?: DynamicAppearAnimation
  }
}

export interface DynamicAppearanceSchedule {
  itemId: string
  kind: 'normal' | 'showAfter' | 'hideAfter'
  linked: boolean
  triggerItemId: string | null
  delayMs: number
  appearAnimation: DynamicAppearAnimation
  entranceStartMs: number
  entranceDurationMs: number
  appearanceCompleteMs: number
  activeStartMs: number
  hideStartMs: number | null
  hideCompleteMs: number | null
  sequenceIndex: number
}

export const DYNAMIC_LINKED_APPEARANCE_MODES: readonly DynamicLinkedAppearanceMode[]
export const APPEARANCE_FADE_DURATION_MS: number
export const APPEARANCE_DROP_DURATION_MS: number
export const APPEARANCE_TRACK_SLIDE_DURATION_MS: number
export const MAX_LINKED_APPEARANCE_DELAY_MS: number
export const MAX_DYNAMIC_APPEARANCE_TIME_MS: number
export const DYNAMIC_APPEARANCE_EASING: string

export function normalizeDynamicAppearAnimation(value: unknown): DynamicAppearAnimation
export function getDynamicAppearanceDurationMs(value: unknown): number
export function normalizeDynamicLinkedAppearance(
  value: unknown,
  itemId?: string,
  validItemIds?: Set<string>
): DynamicLinkedAppearance | undefined
export function normalizeDynamicAppearanceTimeMs(value: unknown, fallback?: number): number
export function getDynamicAppearanceTimingForBackground(
  item: DynamicAppearanceItem,
  backgroundId?: string
): DynamicAppearanceTiming | undefined
export function resolveDynamicItemAppearanceForBackground<T extends DynamicAppearanceItem>(
  item: T,
  backgroundId?: string
): T
export function getDynamicBackgroundAppearanceForGroup(
  group?: DynamicAppearanceGroup,
  background?: DynamicAppearanceBackground
): DynamicBackgroundAppearance
export function getDynamicAppearanceConfigForBackground(
  background?: DynamicAppearanceBackground,
  fallback?: DynamicAppearanceGroup
): DynamicBackgroundAppearance
export function wouldCreateDynamicLinkedAppearanceCycle(
  items: DynamicAppearanceItem[],
  itemId: string,
  triggerItemId: string
): boolean
export function isDynamicItemBoundToBackground(
  item: DynamicAppearanceItem,
  backgroundId?: string
): boolean
export function getDynamicEffectiveBackgroundIds(
  items: DynamicAppearanceItem[],
  itemId: string
): string[]
export function synchronizeDynamicLinkedBackgrounds<T extends DynamicAppearanceItem>(
  items?: T[]
): T[]
export function getDynamicPlaybackItemsForBackground<T extends DynamicAppearanceItem>(
  items?: T[],
  backgroundId?: string
): T[]
export function buildDynamicAppearanceTimeline(options?: {
  items?: DynamicAppearanceItem[]
  appearMode?: 'sequence' | 'all'
  intervalMs?: number
  appearAnimation?: DynamicAppearAnimation
  activeItemIds?: string[] | Set<string>
  backgroundId?: string
}): Record<string, DynamicAppearanceSchedule>
export function convertDynamicLinkedAppearanceToIndependentTiming<T extends DynamicAppearanceItem>(options?: {
  items?: T[]
  appearMode?: 'sequence' | 'all'
  intervalMs?: number
  appearAnimation?: DynamicAppearAnimation
}): Array<T & {
  appearanceDelayMs: number
  appearanceHideMs?: number | null
  hideAfterTarget: boolean
  linkedAppearance?: undefined
}>
export function sampleDynamicAppearanceTimeline(
  schedule: DynamicAppearanceSchedule | undefined,
  elapsedMs: number
): {
  alpha: number
  active: boolean
  interactive: boolean
  animationElapsedMs: number
}
export function getDynamicAppearanceAnimationSeekMs(
  schedule: DynamicAppearanceSchedule | undefined,
  elapsedMs: number
): number
export function canContinueDynamicAppearanceEpoch(
  item: DynamicAppearanceItem,
  previousEpoch: { schedule?: DynamicAppearanceSchedule } | undefined,
  options?: {
    sameSession?: boolean
    rootActive?: boolean
    triggerContinues?: boolean
    schedule?: DynamicAppearanceSchedule
  }
): boolean
export function getContinuableDynamicAppearanceItemIds(options?: {
  items?: DynamicAppearanceItem[]
  previousEpochs?: Map<string, { schedule?: DynamicAppearanceSchedule }> | Record<string, { schedule?: DynamicAppearanceSchedule }>
  timeline?: Record<string, DynamicAppearanceSchedule>
  activeItemIds?: Set<string> | string[]
  sameSession?: boolean
}): Set<string>
