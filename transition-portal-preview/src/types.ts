export type PreviewView =
  | 'home'
  | 'transition'
  | 'library'
  | 'material-transition'
  | 'control'
  | 'interactive-transition'
  | 'interactive'
  | 'interactive-upload-transition'
  | 'interactive-upload'
export type TransitionMode = 'shared' | 'storybook'
export type InteractiveCardSize = 'current' | 'compact'
export type MaterialTransitionDirection = 'forward' | 'backward'

export interface PortalOrigin {
  left: number
  top: number
  width: number
  height: number
}
