export const UNITY_EXTRA_ANIMATION_MIN_ID: 10
export const UNITY_EXTRA_ANIMATION_MAX_ID: 17

export interface UnityAnimationDefinition {
  id: number
  clipName: string
  duration: number
  loop: boolean
}

export interface UnityAnimationSample {
  animationId: number
  clipTime: number
  duration: number
  loop: boolean
  offsetXRatio: number
  offsetYRatio: number
  rotation: number
  scaleX: number
  scaleY: number
  channels: Record<string, number>
}

export const UNITY_EXTRA_ANIMATION_DEFINITIONS: readonly UnityAnimationDefinition[]
export function sampleUnityAnimation(animationId: number, timeSeconds: number): UnityAnimationSample
export function drawUnityAnimationImage(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  animationId: number,
  timeSeconds: number
): void
export function subscribeUnityAnimationFrame(subscriber: (timeSeconds: number) => void): () => void
