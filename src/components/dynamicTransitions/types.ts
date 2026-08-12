export interface DynamicTransitionOrigin {
  left: number
  top: number
  width: number
  height: number
}

export type DynamicPortalVariant = 'dynamic' | 'interactive'

export type DynamicArtworkTransitionDirection = 'forward' | 'backward'

export interface DynamicArtworkTransitionRequest {
  direction: DynamicArtworkTransitionDirection
  groupId: string
  groupName: string
  previewUrl?: string
  previewType?: 'image' | 'video'
  origin?: DynamicTransitionOrigin
}
