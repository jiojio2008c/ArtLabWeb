export type PreviewView = 'home' | 'transition' | 'library' | 'material-transition' | 'control'
export type TransitionMode = 'shared' | 'storybook'
export type MaterialTransitionDirection = 'forward' | 'backward'

export interface PortalOrigin {
  left: number
  top: number
  width: number
  height: number
}
