export interface DynamicMotionStageSize {
  width: number
  height: number
}

export function getDynamicHorizontalMotionPoint(
  moveMode: string,
  timelineProgress: number,
  movePercent: number,
  stageSize: DynamicMotionStageSize
): { x: number; y: number }
export function getDynamicHorizontalMotionKeyframes(
  moveMode: string,
  movePercent: number,
  stageSize: DynamicMotionStageSize
): Array<{ offset: number; x: number; y: number }>
export function sampleDynamicHorizontalMotion(
  moveMode: string,
  progress: number,
  movePercent: number,
  stageSize: DynamicMotionStageSize
): { x: number; y: number }

export function getDynamicVerticalWaveOffsets(item: {
  position?: { y?: number }
  movePercent?: number
  moveTrack?: string
}, stageHeight: number): {
  localUpLimit: number
  localDownLimit: number
  waveUp: number
  waveDown: number
}

export function sampleDynamicVerticalWave(
  progress: number,
  waveDown: number,
  waveUp: number
): number

export function getDynamicVerticalWaveKeyframes(item: {
  position?: { y?: number }
  movePercent?: number
  moveTrack?: string
}, stageSize: DynamicMotionStageSize): Array<{
  offset: number
  y: number
  easing?: string
}>

export function getDynamicOrbitGeometry(item: {
  position?: { x?: number; y?: number }
  movePercent?: number
  moveTrack?: string
}, stageSize: DynamicMotionStageSize): Record<string, number>

export function getDynamicOrbitKeyframes(item: unknown, stageSize: DynamicMotionStageSize): Array<{
  offset: number
  x: number
  y: number
}>

export function sampleDynamicOrbitMotion(item: unknown, progress: number, stageSize: DynamicMotionStageSize): {
  x: number
  y: number
}

export const HORIZONTAL_KEYFRAMES_PER_WAVE: number
export const HORIZONTAL_MOTION_FRAME_COUNT: number
export const HORIZONTAL_STAGE_MARGIN: number
export const HORIZONTAL_WAVE_CYCLES: number
export const DYNAMIC_VERTICAL_WAVE_EASING: string
