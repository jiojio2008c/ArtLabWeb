export const ITEM_ANIMATION_MIN_ID: 1
export const ITEM_ANIMATION_MAX_ID: 8

export interface ItemAnimationTransform {
  scaleX: number
  scaleY: number
  rotation: number
  alpha: number
  offsetX: number
  offsetY: number
  skewX: number
  skewY: number
}

export function sampleItemAnimation(
  animationId: number,
  itemId: string,
  timeSeconds: number
): ItemAnimationTransform

export function subscribeItemAnimationFrame(
  subscriber: (timeSeconds: number) => void
): () => void
