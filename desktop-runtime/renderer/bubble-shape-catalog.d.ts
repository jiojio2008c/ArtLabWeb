export type BubbleShapeDirection = 'left' | 'right'

export type BubbleShapeCommand =
  | readonly ['M' | 'L', number, number]
  | readonly ['Q', number, number, number, number]
  | readonly ['C', number, number, number, number, number, number]
  | readonly ['Z']

export interface BubbleShapeCircleDecoration {
  readonly kind: 'circle'
  readonly cx: number
  readonly cy: number
  readonly radius: number
}

export interface BubbleShapeRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface BubbleShapeDefinition {
  readonly styleId: string
  readonly baseStyleId: string
  readonly direction: BubbleShapeDirection
  readonly viewBox: BubbleShapeRect
  readonly bodyCommands: readonly BubbleShapeCommand[]
  readonly decorations: readonly BubbleShapeCircleDecoration[]
  readonly contentRect: BubbleShapeRect
  readonly defaultWidth: number
  readonly defaultHeight: number
  readonly defaultOutlineWidth: number
  readonly defaultSurfaceColor: string
  readonly defaultOutlineColor: string
}

export interface DrawBubbleShapeOptions {
  surfaceColor?: string
  outlineColor?: string
  lineWidth?: number
}

export interface DrawBubbleShapeResult {
  definition: BubbleShapeDefinition
  surfaceColor: string
  outlineColor: string
}

export const BUBBLE_SHAPE_STYLE_IDS: readonly string[]

export function getBubbleShapeDefinition(styleId: string): BubbleShapeDefinition
export function bubbleShapeCommandsToSvgPath(commands: readonly BubbleShapeCommand[]): string
export function getBubbleShapeDirection(styleId: string): BubbleShapeDirection
export function normalizeBubbleColor(value: unknown, fallback?: string): string
export function deriveBubbleOutlineColor(surfaceColor: string): string
export function drawBubbleShape(
  context: CanvasRenderingContext2D,
  styleId: string,
  width: number,
  height: number,
  options?: DrawBubbleShapeOptions
): DrawBubbleShapeResult
