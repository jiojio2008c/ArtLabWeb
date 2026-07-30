export const WALK_ANIMATION_ID: 9
export const WALK_DURATION_SECONDS: number

export interface WalkAnimationSample {
  clipTime: number
  key23: number
  key24: number
}

export function sampleWalkAnimation(timeSeconds: number): WalkAnimationSample

export function drawWalkImage(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  timeSeconds: number
): void

export function subscribeWalkAnimation(subscriber: (timeSeconds: number) => void): () => void
