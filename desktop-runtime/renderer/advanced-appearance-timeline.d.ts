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
  backgroundIds?: string[]
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

export function normalizeDynamicAppearAnimation(value: unknown): DynamicAppearAnimation
export function getDynamicAppearanceDurationMs(value: unknown): number
export function normalizeDynamicLinkedAppearance(
  value: unknown,
  itemId?: string,
  validItemIds?: Set<string>
): DynamicLinkedAppearance | undefined
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
}): Record<string, DynamicAppearanceSchedule>
export function sampleDynamicAppearanceTimeline(
  schedule: DynamicAppearanceSchedule | undefined,
  elapsedMs: number
): {
  alpha: number
  active: boolean
  interactive: boolean
  animationElapsedMs: number
}
