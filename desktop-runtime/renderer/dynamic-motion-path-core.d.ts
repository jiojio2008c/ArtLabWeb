export interface DynamicMotionPathPoint { x: number; y: number }
export interface DynamicMotionPath { version: 1; points: DynamicMotionPathPoint[] }
export const MAX_MOTION_PATH_POINTS: number
export const MOTION_PATH_VERSION: number
export function normalizeMotionPath(path: unknown): DynamicMotionPath | undefined
export function optimizeMotionPath(points: DynamicMotionPathPoint[], options?: { tolerance?: number; smoothing?: number; debounceDistance?: number }): DynamicMotionPath | undefined
export function getPathMetrics(path: unknown): { path: DynamicMotionPath; cumulative: number[]; length: number } | undefined
export function sampleMotionPath(path: unknown, progress: number): DynamicMotionPathPoint
