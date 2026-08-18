import type { DynamicGroup, DynamicItem } from './dynamicArtStorage'

export type DynamicCreationFlowExperience = 'flow' | 'free'
export type DynamicCreationFlowStepId = 'objects' | 'layout' | 'appearance' | 'backgrounds' | 'audio' | 'review'
export type DynamicCreationFlowLayoutSubstep = 'placement' | 'motion' | 'animation' | 'transform'
export type DynamicCreationFlowIssueSeverity = 'blocking' | 'warning'
export type DynamicCreationFlowRelationMode = 'showAfter' | 'hideAfter'

export interface DynamicCreationFlowStep {
  id: DynamicCreationFlowStepId
  index: number
  optional: boolean
  requiresItems: boolean
}

export interface DynamicCreationFlowSession {
  version: 1
  groupId: string
  experience: DynamicCreationFlowExperience
  step: DynamicCreationFlowStepId
  selectedItemId?: string
  layoutSubstep: DynamicCreationFlowLayoutSubstep
  checkedItemIds: string[]
  skippedSteps: DynamicCreationFlowStepId[]
  updatedAt: number
}

export interface NormalizeDynamicCreationFlowSessionOptions {
  groupId?: string
  itemIds?: string[]
  now?: number
  defaultExperience?: DynamicCreationFlowExperience
}

export interface DynamicCreationFlowIssue {
  code: string
  severity: DynamicCreationFlowIssueSeverity
  step: DynamicCreationFlowStepId
  messageKey: string
  itemId?: string
  backgroundId?: string
  params?: Record<string, string | number>
}

export interface DynamicAppearanceRelation {
  sourceItemId: string
  sourceItemName: string
  targetItemId: string
  targetItemName: string
  mode: DynamicCreationFlowRelationMode
  action: 'show' | 'hide'
  delayMs: number
  targetInitiallyVisible: boolean
}

export interface DynamicAppearanceRelationTreeNode {
  itemId: string
  name: string
  order: number
  relation?: DynamicAppearanceRelation
  children: DynamicAppearanceRelationTreeNode[]
}

export interface DynamicCreationFlowStepStatus {
  id: DynamicCreationFlowStepId
  optional: boolean
  configured: boolean
  ready: boolean
  complete: boolean
  blockingIssueCount: number
  warningCount: number
}

export interface DynamicCreationFlowPlaybackItem {
  itemId: string
  name: string
  order: number
}

export interface DynamicCreationFlowSummary {
  itemCount: number
  visibleItemCount: number
  targetItemCount: number
  backgroundCount: number
  audioAssetCount: number
  itemAudioCount: number
  backgroundAudioCount: number
  linkedAppearanceCount: number
  showAfterCount: number
  hideAfterCount: number
  appearMode: 'sequence' | 'all'
  appearIntervalMs: number
  appearAnimation: 'none' | 'drop' | 'trackSlide'
  playbackOrder: DynamicCreationFlowPlaybackItem[]
  relationTree: DynamicAppearanceRelationTreeNode[]
  issues: DynamicCreationFlowIssue[]
  stepStatus: Record<DynamicCreationFlowStepId, DynamicCreationFlowStepStatus>
  blockingIssueCount: number
  warningCount: number
  readyForPreview: boolean
}

export const DYNAMIC_CREATION_FLOW_SESSION_VERSION: 1
export const DYNAMIC_CREATION_FLOW_EXPERIENCES: readonly DynamicCreationFlowExperience[]
export const DYNAMIC_CREATION_FLOW_STEP_IDS: readonly DynamicCreationFlowStepId[]
export const DYNAMIC_CREATION_FLOW_LAYOUT_SUBSTEPS: readonly DynamicCreationFlowLayoutSubstep[]
export const DYNAMIC_CREATION_FLOW_STEPS: readonly DynamicCreationFlowStep[]

export function isDynamicCreationFlowStep(value: unknown): value is DynamicCreationFlowStepId
export function getDynamicCreationFlowStep(value: unknown): DynamicCreationFlowStep | undefined
export function normalizeDynamicCreationFlowSession(
  value: unknown,
  options?: NormalizeDynamicCreationFlowSessionOptions
): DynamicCreationFlowSession
export function getDynamicPlaybackOrder(groupOrItems: DynamicGroup | DynamicItem[]): string[]
export function convertDynamicPlaybackOrderToLayerOrder(
  playbackItemIds: string[],
  allItemIds?: string[]
): string[]
export const convertDynamicPlaybackOrderToFrontLayerOrder: typeof convertDynamicPlaybackOrderToLayerOrder
export const playbackOrderToLayerOrder: typeof convertDynamicPlaybackOrderToLayerOrder
export function getDynamicAppearanceRelations(groupOrItems: DynamicGroup | DynamicItem[]): DynamicAppearanceRelation[]
export function buildDynamicAppearanceRelationTree(
  groupOrItems: DynamicGroup | DynamicItem[]
): DynamicAppearanceRelationTreeNode[]
export function getDynamicCreationFlowIssues(group: DynamicGroup): DynamicCreationFlowIssue[]
export const deriveDynamicCreationFlowIssues: typeof getDynamicCreationFlowIssues
export function getDynamicCreationFlowSummary(group: DynamicGroup): DynamicCreationFlowSummary
export const deriveDynamicCreationFlowSummary: typeof getDynamicCreationFlowSummary
