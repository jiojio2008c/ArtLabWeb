export type DynamicAnimationMode = 'none' | 'fixed' | 'random'

export interface DynamicAnimationDefinition {
  id: number
  key: string
  labelKey: string
  shortLabelKey: string
  className: string
}

export const DYNAMIC_ANIMATION_MIN_ID: 0
export const DYNAMIC_ANIMATION_MAX_ID: 17
export const DYNAMIC_FIXED_ANIMATION_MIN_ID: 1
export const LEGACY_DYNAMIC_ANIMATION_MAX_ID: 9
export const DYNAMIC_ANIMATION_IDS: readonly number[]
export const LEGACY_DYNAMIC_ANIMATION_IDS: readonly number[]
export const DYNAMIC_ANIMATION_CATALOG: readonly DynamicAnimationDefinition[]

export function normalizeDynamicAnimationId(value: unknown): number
export function normalizeDynamicAnimationMode(value: unknown, animationId?: unknown): DynamicAnimationMode
export function getDefaultClickAnimationIds(legacy?: boolean): number[]
export function normalizeDynamicClickAnimationIds(value: unknown, legacy?: boolean): number[]
export function getDynamicAnimationMode(item?: { animationMode?: unknown; animationId?: unknown }): DynamicAnimationMode
export function getDynamicClickAnimationIds(item?: { clickAnimationIds?: unknown }): number[]
export function resolveDynamicAnimationId(
  mode: unknown,
  animationId: unknown,
  availableAnimationIds?: unknown,
  seed?: unknown
): number
export function getDynamicAnimationDefinition(animationId: unknown): DynamicAnimationDefinition
