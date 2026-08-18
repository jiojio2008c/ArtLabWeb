import type { DynamicAppearanceRelationTreeNode } from '../../services/dynamicCreationFlowCore.js'

export type DynamicCreationStep =
  | 'objects'
  | 'layout'
  | 'appearance'
  | 'backgrounds'
  | 'audio'
  | 'review'

export type DynamicCreationFlowPanelStep = Extract<
  DynamicCreationStep,
  'appearance' | 'backgrounds' | 'audio' | 'review'
>

export type DynamicCreationAppearMode = 'sequence' | 'all'
export type DynamicCreationAppearAnimation = 'none' | 'drop' | 'trackSlide'
export type DynamicCreationRelationMode = 'showAfter' | 'hideAfter'
export type DynamicCreationMoveDirection = 'up' | 'down'
export type DynamicCreationItemAudioTrigger = 'appearance' | 'appearanceDelay' | 'targetArrival'
export type DynamicCreationIssueSeverity = 'error' | 'warning'
export type DynamicCreationBackgroundType = 'image' | 'video'

export interface DynamicCreationFlowLinkedAppearance {
  sourceId: string
  sourceName: string
  mode: DynamicCreationRelationMode
  delayMs: number
}

export interface DynamicCreationFlowItem {
  id: string
  name: string
  imageUrl: string
  order: number
  moveLabel: string
  animationLabel: string
  targetConfigured: boolean
  audioId?: string
  audioTrigger: DynamicCreationItemAudioTrigger
  audioDelayMs: number
  audioTargetMissing: boolean
  audioLabel: string
  backgroundIds: string[]
  backgroundLabel: string
  linkedAppearance?: DynamicCreationFlowLinkedAppearance
  linkedTargetCount: number
}

export interface DynamicCreationFlowBackground {
  id: string
  name: string
  previewUrl: string
  type: DynamicCreationBackgroundType
}

export interface DynamicCreationFlowAudio {
  id: string
  name: string
  durationLabel: string
}

export interface DynamicCreationFlowSummary {
  itemCount: number
  backgroundCount: number
  audioCount: number
  relationCount: number
}

export interface DynamicCreationFlowIssue {
  id: string
  severity: DynamicCreationIssueSeverity
  title: string
  description: string
  step: DynamicCreationStep
  itemId?: string
  actionable?: boolean
}

export interface DynamicCreationFlowPanelProps {
  step: DynamicCreationFlowPanelStep
  items: DynamicCreationFlowItem[]
  backgrounds: DynamicCreationFlowBackground[]
  audioLibrary: DynamicCreationFlowAudio[]
  selectedItemId: string | null
  advancedFeaturesEnabled: boolean
  isAddingAudio: boolean
  previewingAudioId: string
  appearMode: DynamicCreationAppearMode
  appearIntervalMs: number
  appearAnimation: DynamicCreationAppearAnimation
  appearanceTree: DynamicAppearanceRelationTreeNode[]
  summary: DynamicCreationFlowSummary
  issues: DynamicCreationFlowIssue[]
  syncLabel: string
  onSelectItem: (itemId: string) => void
  onMoveAppearance: (itemId: string, direction: DynamicCreationMoveDirection) => void
  onAddRelation: (sourceId: string) => void
  onEditRelation: (targetId: string) => void
  onSetItemBackgrounds: (itemId: string, backgroundIds: string[]) => void
  onManageBackgrounds: () => void
  onUploadAudio: () => void
  onPreviewAudio: (audioId: string) => void
  onSetItemAudio: (itemId: string, audioId?: string) => void
  onSetItemAudioTrigger: (itemId: string, trigger: DynamicCreationItemAudioTrigger) => void
  onSetItemAudioDelay: (itemId: string, delayMs: number) => void
  onSetAppearMode: (mode: DynamicCreationAppearMode) => void
  onSetAppearInterval: (intervalMs: number) => void
  onSetAppearAnimation: (animation: DynamicCreationAppearAnimation) => void
  onStartPreview: () => void
  onGoToIssue: (issue: DynamicCreationFlowIssue) => void
}
