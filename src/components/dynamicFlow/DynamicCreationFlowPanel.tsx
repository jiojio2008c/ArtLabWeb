import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Image as ImageIcon,
  Layers3,
  Link2,
  LockKeyhole,
  Move,
  Music2,
  Play,
  Plus,
  Sparkles,
  Square,
  Target,
  Timer,
  Upload,
  Volume2
} from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import IntervalWheel from '../IntervalWheel.tsx'
import './DynamicCreationFlow.css'
import type {
  DynamicCreationAppearAnimation,
  DynamicCreationFlowIssue,
  DynamicCreationFlowPanelProps,
  DynamicCreationFlowPanelStep,
  DynamicCreationItemAudioTrigger,
  DynamicCreationStep
} from './types.ts'

type DynamicCreationFlowAppearanceNode = DynamicCreationFlowPanelProps['appearanceTree'][number]

const APPEAR_INTERVAL_MIN_MS = 100
const APPEAR_INTERVAL_MAX_MS = 5000
const APPEAR_INTERVAL_STEP_MS = 100

const PANEL_STEPS: Array<{
  id: DynamicCreationFlowPanelStep
  titleKey: string
}> = [
  { id: 'appearance', titleKey: 'flow.step3Title' },
  { id: 'backgrounds', titleKey: 'flow.step4Title' },
  { id: 'audio', titleKey: 'flow.step5Title' },
  { id: 'review', titleKey: 'flow.step6Title' }
]

const ISSUE_STEP_LABELS: Record<DynamicCreationStep, string> = {
  objects: 'flow.step1Title',
  layout: 'flow.step2Title',
  appearance: 'flow.step3Title',
  backgrounds: 'flow.step4Title',
  audio: 'flow.step5Title',
  review: 'flow.step6Title'
}

const APPEAR_ANIMATIONS: Array<{
  id: DynamicCreationAppearAnimation
  labelKey: string
  icon: typeof Sparkles
}> = [
  { id: 'none', labelKey: 'flow.appearAnimationNone', icon: Sparkles },
  { id: 'drop', labelKey: 'flow.appearAnimationDrop', icon: ArrowDown },
  { id: 'trackSlide', labelKey: 'flow.appearAnimationTrackSlide', icon: Move }
]

const AUDIO_TRIGGER_OPTIONS: Array<{
  id: DynamicCreationItemAudioTrigger
  labelKey: string
}> = [
  { id: 'appearance', labelKey: 'control.audioOnAppearance' },
  { id: 'appearanceDelay', labelKey: 'control.audioAfterDelay' },
  { id: 'targetArrival', labelKey: 'control.audioOnArrival' }
]

const formatSeconds = (milliseconds: number) => {
  const seconds = Math.max(0, milliseconds) / 1000
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1)
}

const DynamicCreationFlowPanel = ({
  step,
  items,
  backgrounds,
  audioLibrary,
  selectedItemId,
  advancedFeaturesEnabled,
  isAddingAudio,
  previewingAudioId,
  appearMode,
  appearIntervalMs,
  appearAnimation,
  appearanceTree,
  summary,
  issues,
  syncLabel,
  onSelectItem,
  onMoveAppearance,
  onAddRelation,
  onEditRelation,
  onSetItemBackgrounds,
  onManageBackgrounds,
  onUploadAudio,
  onPreviewAudio,
  onSetItemAudio,
  onSetItemAudioTrigger,
  onSetItemAudioDelay,
  onSetAppearMode,
  onSetAppearInterval,
  onSetAppearAnimation,
  onStartPreview,
  onGoToIssue
}: DynamicCreationFlowPanelProps) => {
  const { t } = useTranslation()
  const [collapsedAppearanceItemIds, setCollapsedAppearanceItemIds] = useState<Set<string>>(() => new Set())
  const [collapsedBackgroundItemIds, setCollapsedBackgroundItemIds] = useState<Set<string>>(() => new Set())
  const audioObjectRailRef = useRef<HTMLDivElement>(null)
  const audioDelayLabelId = useId()
  const activeStep = PANEL_STEPS.find((entry) => entry.id === step) ?? PANEL_STEPS[0]
  const orderedItems = [...items].sort((first, second) => first.order - second.order)
  const itemById = new Map(orderedItems.map((item) => [item.id, item]))
  const backgroundRootItemIdById = new Map<string, string>()
  const indexBackgroundTree = (node: DynamicCreationFlowAppearanceNode, rootItemId: string) => {
    backgroundRootItemIdById.set(node.itemId, rootItemId)
    node.children.forEach((child) => indexBackgroundTree(child, rootItemId))
  }
  appearanceTree.forEach((node) => indexBackgroundTree(node, node.itemId))
  const availableAudioIds = new Set(audioLibrary.map((audio) => audio.id))
  const selectedFlowItem = orderedItems.find((item) => item.id === selectedItemId) ?? orderedItems[0]
  const selectedFlowItemId = selectedFlowItem?.id
  const selectedBackgroundRootItemId = selectedFlowItem
    ? backgroundRootItemIdById.get(selectedFlowItem.id)
    : undefined
  const resolvedBackgroundOwnerItem = selectedBackgroundRootItemId
    ? itemById.get(selectedBackgroundRootItemId)
    : undefined
  const backgroundOwnerItem = resolvedBackgroundOwnerItem ?? selectedFlowItem
  const backgroundOwnerItemId = backgroundOwnerItem?.id
  const hasResolvedBackgroundParent = Boolean(
    selectedFlowItemId
    && backgroundOwnerItemId
    && selectedFlowItemId !== backgroundOwnerItemId
  )
  const hasBackgroundInheritanceFallback = Boolean(
    selectedFlowItem?.linkedAppearance && !hasResolvedBackgroundParent
  )
  const selectedAudioAvailable = Boolean(
    selectedFlowItem?.audioId && availableAudioIds.has(selectedFlowItem.audioId)
  )
  const errorIssues = issues.filter((issue) => issue.severity === 'error')
  const warningIssues = issues.filter((issue) => issue.severity === 'warning')
  const normalizedInterval = Math.min(
    APPEAR_INTERVAL_MAX_MS,
    Math.max(APPEAR_INTERVAL_MIN_MS, appearIntervalMs)
  )

  useEffect(() => {
    if (step !== 'audio' || !selectedFlowItemId) return
    const selectedButton = Array.from(
      audioObjectRailRef.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]') ?? []
    ).find((button) => button.dataset.itemId === selectedFlowItemId)
    selectedButton?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  }, [selectedFlowItemId, step])

  useEffect(() => {
    if (
      step !== 'backgrounds'
      || !selectedFlowItemId
      || !backgroundOwnerItemId
      || selectedFlowItemId === backgroundOwnerItemId
      || hasBackgroundInheritanceFallback
    ) return
    onSelectItem(backgroundOwnerItemId)
  }, [
    backgroundOwnerItemId,
    hasBackgroundInheritanceFallback,
    onSelectItem,
    selectedFlowItemId,
    step
  ])

  const handleRadioKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    orientation: 'horizontal' | 'vertical'
  ) => {
    const buttons = Array.from(
      event.currentTarget.closest('[role="radiogroup"]')
        ?.querySelectorAll<HTMLButtonElement>('button[role="radio"]:not(:disabled)') ?? []
    )
    const currentIndex = buttons.indexOf(event.currentTarget)
    if (currentIndex < 0 || buttons.length === 0) return

    const previousKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
    let nextIndex: number

    if (event.key === previousKey) nextIndex = (currentIndex - 1 + buttons.length) % buttons.length
    else if (event.key === nextKey) nextIndex = (currentIndex + 1) % buttons.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = buttons.length - 1
    else return

    event.preventDefault()
    const nextButton = buttons[nextIndex]
    nextButton?.focus({ preventScroll: true })
    nextButton?.click()
    nextButton?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  }

  const renderEmptyItems = () => (
    <div className="dynamic-flow-empty" role="status">
      <span className="dynamic-flow-empty-icon"><Layers3 aria-hidden="true" /></span>
      <strong>{t('flow.noObjects')}</strong>
      <p>{t('flow.noObjectsDescription')}</p>
    </div>
  )

  const toggleAppearanceChildren = (itemId: string) => {
    setCollapsedAppearanceItemIds((currentIds) => {
      const nextIds = new Set(currentIds)
      if (nextIds.has(itemId)) nextIds.delete(itemId)
      else nextIds.add(itemId)
      return nextIds
    })
  }

  const toggleBackgroundChildren = (itemId: string) => {
    setCollapsedBackgroundItemIds((currentIds) => {
      const nextIds = new Set(currentIds)
      if (nextIds.has(itemId)) nextIds.delete(itemId)
      else nextIds.add(itemId)
      return nextIds
    })
  }

  const handleAddRelation = (itemId: string) => {
    setCollapsedAppearanceItemIds((currentIds) => {
      if (!currentIds.has(itemId)) return currentIds
      const nextIds = new Set(currentIds)
      nextIds.delete(itemId)
      return nextIds
    })
    onAddRelation(itemId)
  }

  const renderAppearanceNode = (
    node: DynamicCreationFlowAppearanceNode,
    depth: number,
    rootIndex?: number
  ) => {
    const item = itemById.get(node.itemId)
    if (!item) return null
    const selected = item.id === selectedItemId
    const isChild = Boolean(node.relation)
    const children = [...node.children].sort((first, second) => (
      (first.relation?.delayMs ?? 0) - (second.relation?.delayMs ?? 0)
      || first.order - second.order
    ))
    const childrenExpanded = !collapsedAppearanceItemIds.has(item.id)
    const childrenId = `dynamic-flow-appearance-children-${item.id}`
    const relationSummaryKey = node.relation?.mode === 'hideAfter'
      ? 'flow.childRelationHide'
      : 'flow.childRelationShow'

    return (
      <li
        key={node.itemId}
        className={`dynamic-flow-appearance-node depth-${Math.min(depth, 3)} ${isChild ? 'is-child' : 'is-root'}`}
      >
        {node.relation && (
          <button
            type="button"
            className={`dynamic-flow-parent-link ${node.relation.mode === 'hideAfter' ? 'is-hide-relation' : ''}`}
            onClick={() => onEditRelation(item.id)}
            disabled={!advancedFeaturesEnabled}
            aria-label={t(node.relation.mode === 'showAfter'
              ? 'flow.continuationShowSummary'
              : 'flow.continuationHideSummary', {
              source: node.relation.sourceItemName,
              seconds: formatSeconds(node.relation.delayMs),
              target: item.name
            })}
          >
            <span className="dynamic-flow-parent-link-branch" aria-hidden="true" />
            <Link2 aria-hidden="true" />
            <span>
              <small>{t(relationSummaryKey, { seconds: formatSeconds(node.relation.delayMs) })}</small>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
        )}

        <article
          className={`dynamic-flow-item-card ${selected ? 'is-selected' : ''} ${isChild ? 'is-child-card' : ''}`}
          aria-current={selected ? 'true' : undefined}
        >
          <button
            type="button"
            className="dynamic-flow-item-select"
            onClick={() => onSelectItem(item.id)}
            aria-label={t('flow.currentObject', { name: item.name })}
          >
            <span className={`dynamic-flow-order-number ${isChild ? 'is-child' : ''}`}>
              {isChild ? <Link2 aria-hidden="true" /> : (rootIndex ?? 0) + 1}
            </span>
            <img src={item.imageUrl} alt="" loading="lazy" />
            <span className="dynamic-flow-item-copy">
              <strong>{item.name}</strong>
              <small>{item.moveLabel} · {item.animationLabel}</small>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>

          <div className="dynamic-flow-item-meta">
            <span className={isChild ? 'is-linked' : ''}>
              {isChild ? <Link2 aria-hidden="true" /> : <Layers3 aria-hidden="true" />}
              {t(isChild ? 'flow.childObject' : 'flow.mainObject')}
            </span>
            <span className={item.targetConfigured ? 'is-ready' : ''}>
              <Target aria-hidden="true" />
              {item.targetConfigured ? t('flow.statusConfigured') : t('flow.statusDefault')}
            </span>
            {children.length > 0 && (
              <button
                type="button"
                className="dynamic-flow-children-toggle"
                aria-expanded={childrenExpanded}
                aria-controls={childrenId}
                aria-label={t(
                  childrenExpanded ? 'flow.collapseChildren' : 'flow.expandChildren',
                  { count: children.length }
                )}
                onClick={() => toggleAppearanceChildren(item.id)}
              >
                <Link2 aria-hidden="true" />
                <span>{t('flow.childCount', { count: children.length })}</span>
                {childrenExpanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
            )}
          </div>

          <div className={`dynamic-flow-item-actions ${isChild ? 'is-child-actions' : ''}`}>
            {!isChild && (
              <>
                <button
                  type="button"
                  className="dynamic-flow-icon-button"
                  disabled={rootIndex === 0}
                  onClick={() => onMoveAppearance(item.id, 'up')}
                  aria-label={t('flow.previous')}
                >
                  <ArrowUp aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="dynamic-flow-icon-button"
                  disabled={rootIndex === appearanceTree.length - 1}
                  onClick={() => onMoveAppearance(item.id, 'down')}
                  aria-label={t('flow.next')}
                >
                  <ArrowDown aria-hidden="true" />
                </button>
              </>
            )}
            <button
              type="button"
              className="dynamic-flow-relation-button"
              disabled={!advancedFeaturesEnabled}
              onClick={() => handleAddRelation(item.id)}
            >
              <Plus aria-hidden="true" />
              <span>{t('flow.addChildObject')}</span>
            </button>
          </div>
        </article>

        {children.length > 0 && (
          <ol
            id={childrenId}
            className="dynamic-flow-appearance-children"
            hidden={!childrenExpanded}
          >
            {children.map((child) => renderAppearanceNode(child, depth + 1))}
          </ol>
        )}
      </li>
    )
  }

  const renderBackgroundNode = (
    node: DynamicCreationFlowAppearanceNode,
    depth: number
  ) => {
    const item = itemById.get(node.itemId)
    if (!item) return null
    const children = [...node.children].sort((first, second) => first.order - second.order)
    const isRoot = depth === 0 && !node.relation
    const isEditableRoot = isRoot && !item.linkedAppearance
    const selected = isEditableRoot && item.id === backgroundOwnerItemId
    const childrenExpanded = !collapsedBackgroundItemIds.has(item.id)
    const childrenId = `dynamic-flow-background-children-${item.id}`
    const parentName = node.relation?.sourceItemName ?? item.linkedAppearance?.sourceName
    const backgroundStatus = isEditableRoot
      ? item.backgroundLabel
      : parentName
        ? t('flow.backgroundFollowsNamed', { parent: parentName })
        : t('flow.backgroundInheritedTitle')
    const inheritedCardLabel = parentName
      ? t('flow.backgroundInheritedCardLabel', { child: item.name, parent: parentName })
      : `${item.name}. ${backgroundStatus}`
    const cardContent = (
      <>
        <img src={item.imageUrl} alt="" loading="lazy" />
        <span className="dynamic-flow-background-object-copy">
          <strong>{item.name}</strong>
          <small>{backgroundStatus}</small>
        </span>
        {isEditableRoot
          ? selected
            ? <Check className="dynamic-flow-object-status-icon is-selected" aria-hidden="true" />
            : <ChevronRight className="dynamic-flow-object-status-icon" aria-hidden="true" />
          : <LockKeyhole className="dynamic-flow-object-status-icon is-locked" aria-hidden="true" />}
      </>
    )

    return (
      <li
        key={node.itemId}
        className={`dynamic-flow-background-node depth-${Math.min(depth, 3)} ${isRoot ? 'is-root' : 'is-child'}`}
      >
        <article className={`dynamic-flow-background-object-card ${selected ? 'is-selected' : ''} ${isEditableRoot ? '' : 'is-inherited'}`}>
          {isEditableRoot ? (
            <button
              type="button"
              className="dynamic-flow-background-object-select"
              aria-pressed={selected}
              onClick={() => onSelectItem(item.id)}
            >
              {cardContent}
            </button>
          ) : (
            <div
              className="dynamic-flow-background-object-summary"
              aria-label={inheritedCardLabel}
            >
              {cardContent}
            </div>
          )}

          {children.length > 0 && (
            <button
              type="button"
              className="dynamic-flow-background-children-toggle"
              aria-expanded={childrenExpanded}
              aria-controls={childrenId}
              aria-label={t(
                childrenExpanded ? 'flow.collapseChildren' : 'flow.expandChildren',
                { count: children.length }
              )}
              onClick={() => toggleBackgroundChildren(item.id)}
            >
              <Link2 aria-hidden="true" />
              <span>{t('flow.childCount', { count: children.length })}</span>
              {childrenExpanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
            </button>
          )}
        </article>

        {children.length > 0 && (
          <ol
            id={childrenId}
            className="dynamic-flow-background-children"
            hidden={!childrenExpanded}
          >
            {children.map((child) => renderBackgroundNode(child, depth + 1))}
          </ol>
        )}
      </li>
    )
  }

  const renderAppearance = () => (
    <div className="dynamic-flow-view dynamic-flow-appearance-view">
      <section className="dynamic-flow-section">
        <div className="dynamic-flow-section-heading is-compact">
          <span className="dynamic-flow-section-icon"><Move aria-hidden="true" /></span>
          <div>
            <h3>{t('flow.appearancePlan')}</h3>
          </div>
          <span className="dynamic-flow-count">{orderedItems.length}</span>
        </div>

        {orderedItems.length === 0 ? renderEmptyItems() : (
          <ol className="dynamic-flow-appearance-tree">
            {appearanceTree.map((node, index) => renderAppearanceNode(node, 0, index))}
          </ol>
        )}
      </section>

      <section className="dynamic-flow-section dynamic-flow-settings-card">
        <div className="dynamic-flow-section-heading">
          <span className="dynamic-flow-section-icon"><Layers3 aria-hidden="true" /></span>
          <div>
            <h3>{t('flow.mainOrder')}</h3>
          </div>
        </div>

        <div
          className="dynamic-flow-mode-grid"
          role="radiogroup"
          aria-label={t('flow.mainOrder')}
          aria-orientation="horizontal"
        >
          <button
            type="button"
            role="radio"
            aria-checked={appearMode === 'all'}
            className={appearMode === 'all' ? 'is-active' : ''}
            onClick={() => onSetAppearMode('all')}
            onKeyDown={(event) => handleRadioKeyDown(event, 'horizontal')}
            tabIndex={appearMode === 'all' ? 0 : -1}
          >
            <Layers3 aria-hidden="true" />
            <span>{t('flow.appearAll')}</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={appearMode === 'sequence'}
            className={appearMode === 'sequence' ? 'is-active' : ''}
            onClick={() => onSetAppearMode('sequence')}
            onKeyDown={(event) => handleRadioKeyDown(event, 'horizontal')}
            tabIndex={appearMode === 'sequence' ? 0 : -1}
          >
            <Timer aria-hidden="true" />
            <span>{t('flow.appearSequence')}</span>
          </button>
        </div>

        <label className={`dynamic-flow-interval ${appearMode === 'all' ? 'is-disabled' : ''}`}>
          <span>
            <strong>{t('flow.appearInterval')}</strong>
            <output>{t('flow.secondsValue', { seconds: formatSeconds(normalizedInterval) })}</output>
          </span>
          <input
            type="range"
            min={APPEAR_INTERVAL_MIN_MS}
            max={APPEAR_INTERVAL_MAX_MS}
            step={APPEAR_INTERVAL_STEP_MS}
            value={normalizedInterval}
            disabled={appearMode === 'all'}
            onChange={(event) => onSetAppearInterval(Number(event.currentTarget.value))}
          />
        </label>

        <div className={`dynamic-flow-animation-settings ${advancedFeaturesEnabled ? '' : 'is-disabled'}`}>
          <div className="dynamic-flow-inline-heading">
            <strong>{t('flow.appearAnimation')}</strong>
            {!advancedFeaturesEnabled && <span>{t('flow.statusDefault')}</span>}
          </div>
          <div className="dynamic-flow-animation-grid" role="radiogroup" aria-label={t('flow.appearAnimation')}>
            {APPEAR_ANIMATIONS.map((option) => {
              const OptionIcon = option.icon
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={appearAnimation === option.id}
                  className={appearAnimation === option.id ? 'is-active' : ''}
                  disabled={!advancedFeaturesEnabled}
                  onClick={() => onSetAppearAnimation(option.id)}
                >
                  <OptionIcon aria-hidden="true" />
                  <span>{t(option.labelKey)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )

  const renderBackgrounds = () => (
    <div className="dynamic-flow-view dynamic-flow-background-view">
      <section className="dynamic-flow-section">
        <div className="dynamic-flow-section-heading is-compact">
          <span className="dynamic-flow-task-number" aria-hidden="true">1</span>
          <div>
            <h3>{t('flow.backgroundChooseObject')}</h3>
          </div>
          <span className="dynamic-flow-count">{orderedItems.length}</span>
        </div>

        {orderedItems.length === 0 ? renderEmptyItems() : (
          <ol className="dynamic-flow-background-object-list dynamic-flow-background-tree">
            {appearanceTree.map((node) => renderBackgroundNode(node, 0))}
          </ol>
        )}
      </section>

      {backgroundOwnerItem && (
        <section className="dynamic-flow-section dynamic-flow-background-assignment">
          <div className="dynamic-flow-section-heading is-compact">
            <span className="dynamic-flow-task-number" aria-hidden="true">2</span>
            <div>
              <h3 aria-live="polite">{t('flow.backgroundChooseStageDescription', { name: backgroundOwnerItem.name })}</h3>
            </div>
          </div>

          {hasBackgroundInheritanceFallback && selectedFlowItem?.linkedAppearance ? (
            <div className="dynamic-flow-background-inherited">
              <span><LockKeyhole aria-hidden="true" /></span>
              <div>
                <strong>{t('flow.backgroundInheritedTitle')}</strong>
                <p>{t('flow.backgroundInheritedDescription', {
                  parent: selectedFlowItem.linkedAppearance.sourceName
                })}</p>
                <button
                  type="button"
                  onClick={() => onSelectItem(selectedFlowItem.linkedAppearance!.sourceId)}
                >
                  {t('flow.backgroundEditParent')}
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : backgrounds.length === 0 ? (
            <div className="dynamic-flow-background-first-action">
              <ImageIcon aria-hidden="true" />
              <div>
                <strong>{t('flow.backgroundAddFirst')}</strong>
                <p>{t('flow.backgroundAddFirstDescription')}</p>
              </div>
              <button
                type="button"
                onClick={onManageBackgrounds}
                disabled={!advancedFeaturesEnabled}
                aria-haspopup="dialog"
              >
                {t('flow.editBackgrounds')}
              </button>
            </div>
          ) : (
            <>
              <div className="dynamic-flow-background-scope" role="radiogroup" aria-label={t('flow.backgroundChooseStage')}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={backgroundOwnerItem.backgroundIds.length === 0}
                  className={backgroundOwnerItem.backgroundIds.length === 0 ? 'is-active' : ''}
                  disabled={!advancedFeaturesEnabled}
                  onClick={() => onSetItemBackgrounds(backgroundOwnerItem.id, [])}
                >
                  <Layers3 aria-hidden="true" />
                  <span>
                    <strong>{t('control.allBackgrounds')}</strong>
                    <small>{t('flow.backgroundAllDescription')}</small>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={backgroundOwnerItem.backgroundIds.length > 0}
                  className={backgroundOwnerItem.backgroundIds.length > 0 ? 'is-active' : ''}
                  disabled={!advancedFeaturesEnabled}
                  onClick={() => onSetItemBackgrounds(
                    backgroundOwnerItem.id,
                    backgroundOwnerItem.backgroundIds.length > 0
                      ? backgroundOwnerItem.backgroundIds
                      : [backgrounds[0].id]
                  )}
                >
                  <ImageIcon aria-hidden="true" />
                  <span>
                    <strong>{t('control.specifiedBackgrounds')}</strong>
                    <small>{t('flow.backgroundSelectedDescription')}</small>
                  </span>
                </button>
              </div>

              {backgroundOwnerItem.backgroundIds.length > 0 && (
                <div className="dynamic-flow-background-choice-grid" role="group" aria-label={t('control.specifiedBackgrounds')}>
                  {backgrounds.map((background) => {
                    const checked = backgroundOwnerItem.backgroundIds.includes(background.id)
                    const onlySelected = checked && backgroundOwnerItem.backgroundIds.length === 1
                    return (
                      <button
                        key={background.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        className={checked ? 'is-selected' : ''}
                        disabled={!advancedFeaturesEnabled || onlySelected}
                        onClick={() => onSetItemBackgrounds(
                          backgroundOwnerItem.id,
                          checked
                            ? backgroundOwnerItem.backgroundIds.filter((backgroundId) => backgroundId !== background.id)
                            : [...backgroundOwnerItem.backgroundIds, background.id]
                        )}
                      >
                        <span className="dynamic-flow-background-choice-preview">
                          {background.type === 'video' ? (
                            <video src={background.previewUrl} muted playsInline preload="metadata" />
                          ) : (
                            <img src={background.previewUrl} alt="" loading="lazy" />
                          )}
                          <i aria-hidden="true"><Check /></i>
                        </span>
                        <strong>{background.name}</strong>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {backgrounds.length > 0 && (
        <section className="dynamic-flow-section dynamic-flow-stage-backgrounds">
          <div className="dynamic-flow-section-heading is-compact">
            <span className="dynamic-flow-section-icon"><ImageIcon aria-hidden="true" /></span>
            <div>
              <h3>{t('flow.stageBackgrounds')}</h3>
              <p>{t('flow.backgroundCount', { count: backgrounds.length })}</p>
            </div>
            <button
              type="button"
              className="dynamic-flow-heading-action"
              onClick={onManageBackgrounds}
              disabled={!advancedFeaturesEnabled}
              aria-haspopup="dialog"
            >
              <span>{t('flow.editBackgrounds')}</span>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </section>
      )}
    </div>
  )

  const renderAudio = () => (
    <div className="dynamic-flow-view dynamic-flow-audio-view">
      <div className="dynamic-flow-section dynamic-flow-audio-background-entry">
        <button
          type="button"
          className="dynamic-flow-audio-background-button"
          onClick={onManageBackgrounds}
          disabled={!advancedFeaturesEnabled}
          aria-label={`${t('flow.backgroundMusic')}, ${t('flow.setBackgroundMusic')}`}
          aria-haspopup="dialog"
        >
          <span className="dynamic-flow-section-icon"><Music2 aria-hidden="true" /></span>
          <strong>{t('flow.backgroundMusic')}</strong>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <section className="dynamic-flow-section dynamic-flow-audio-object-section">
        <div className="dynamic-flow-audio-section-title">
          <span className="dynamic-flow-section-icon"><Volume2 aria-hidden="true" /></span>
          <h3>{t('flow.objectAudio')}</h3>
        </div>

        {orderedItems.length === 0 ? renderEmptyItems() : (
          <>
            <div
              ref={audioObjectRailRef}
              className="dynamic-flow-audio-object-rail"
              role="radiogroup"
              aria-label={t('flow.audioChooseObject')}
              aria-orientation="horizontal"
            >
              {orderedItems.map((item) => {
                const itemSelected = item.id === selectedFlowItem?.id
                const itemAudioAvailable = Boolean(item.audioId && availableAudioIds.has(item.audioId))
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={itemSelected}
                    className={itemSelected ? 'is-selected' : ''}
                    disabled={!advancedFeaturesEnabled}
                    onClick={() => onSelectItem(item.id)}
                    onKeyDown={(event) => handleRadioKeyDown(event, 'horizontal')}
                    tabIndex={itemSelected ? 0 : -1}
                    aria-label={`${item.name}. ${item.audioLabel}${item.audioTargetMissing ? `. ${t('control.targetAudioNeedsDestination')}` : ''}`}
                    data-item-id={item.id}
                    title={item.name}
                  >
                    <span className="dynamic-flow-audio-object-preview">
                      <img src={item.imageUrl} alt="" loading="lazy" />
                      {itemSelected && (
                        <span className="dynamic-flow-audio-object-check" aria-hidden="true"><Check /></span>
                      )}
                      {item.audioTargetMissing && (
                        <span className="dynamic-flow-audio-object-status is-warning" aria-hidden="true"><AlertTriangle /></span>
                      )}
                      {!item.audioTargetMissing && itemAudioAvailable && (
                        <span className="dynamic-flow-audio-object-status" aria-hidden="true"><Music2 /></span>
                      )}
                    </span>
                    <strong>{item.name}</strong>
                  </button>
                )
              })}
            </div>
            {selectedFlowItem && (
              <div className="dynamic-flow-audio-assignment">
                <div className="dynamic-flow-audio-source-heading">
                  <h4>{t('flow.audioChooseSource')}</h4>
                  <button
                    type="button"
                    className="dynamic-flow-audio-upload"
                    disabled={!advancedFeaturesEnabled || isAddingAudio}
                    onClick={onUploadAudio}
                    aria-busy={isAddingAudio || undefined}
                  >
                    <Upload aria-hidden="true" />
                    <span>{t(isAddingAudio ? 'control.audioUploading' : 'control.uploadAudio')}</span>
                  </button>
                </div>

                <div
                  className="dynamic-flow-audio-source-list"
                  role="radiogroup"
                  aria-label={`${selectedFlowItem.name}. ${t('flow.audioChooseSource')}`}
                  aria-orientation="vertical"
                >
                  <div className={`dynamic-flow-audio-source-row is-none ${!selectedAudioAvailable ? 'is-selected' : ''}`} role="presentation">
                    <button
                      type="button"
                      className="dynamic-flow-audio-source-select"
                      role="radio"
                      aria-checked={!selectedAudioAvailable}
                      onClick={() => onSetItemAudio(selectedFlowItem.id)}
                      onKeyDown={(event) => handleRadioKeyDown(event, 'vertical')}
                      disabled={!advancedFeaturesEnabled}
                      tabIndex={!selectedAudioAvailable ? 0 : -1}
                    >
                      <Ban aria-hidden="true" />
                      <span><strong>{t('control.noAudio')}</strong></span>
                      {!selectedAudioAvailable && <Check aria-hidden="true" />}
                    </button>
                  </div>

                  {audioLibrary.map((audio) => {
                    const audioSelected = selectedFlowItem.audioId === audio.id
                    const audioPreviewing = previewingAudioId === audio.id
                    return (
                      <div
                        key={audio.id}
                        className={`dynamic-flow-audio-source-row ${audioSelected ? 'is-selected' : ''}`}
                        role="presentation"
                      >
                        <button
                          type="button"
                          className="dynamic-flow-audio-source-select"
                          role="radio"
                          aria-checked={audioSelected}
                          onClick={() => onSetItemAudio(selectedFlowItem.id, audio.id)}
                          onKeyDown={(event) => handleRadioKeyDown(event, 'vertical')}
                          disabled={!advancedFeaturesEnabled}
                          tabIndex={audioSelected ? 0 : -1}
                          title={audio.name}
                        >
                          <Music2 aria-hidden="true" />
                          <span>
                            <strong>{audio.name}</strong>
                            <small>{audio.durationLabel || t('control.audioFile')}</small>
                          </span>
                          {audioSelected && <Check aria-hidden="true" />}
                        </button>
                        <button
                          type="button"
                          className="dynamic-flow-audio-source-preview"
                          onClick={() => onPreviewAudio(audio.id)}
                          aria-label={`${t(audioPreviewing ? 'common.stop' : 'control.previewAudio')}: ${audio.name}`}
                          title={t(audioPreviewing ? 'common.stop' : 'control.previewAudio')}
                        >
                          {audioPreviewing ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {selectedAudioAvailable && (
                  <div className="dynamic-flow-audio-playback">
                    <h4>{t('control.audioPlayback')}</h4>
                    <div
                      className="dynamic-flow-audio-trigger-options"
                      role="radiogroup"
                      aria-label={t('control.audioPlayback')}
                      aria-orientation="horizontal"
                    >
                      {AUDIO_TRIGGER_OPTIONS.map((option) => {
                        const triggerSelected = selectedFlowItem.audioTrigger === option.id
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={triggerSelected}
                            className={triggerSelected ? 'is-selected' : ''}
                            onClick={() => onSetItemAudioTrigger(selectedFlowItem.id, option.id)}
                            onKeyDown={(event) => handleRadioKeyDown(event, 'horizontal')}
                            disabled={!advancedFeaturesEnabled}
                            tabIndex={triggerSelected ? 0 : -1}
                          >
                            <span>{t(option.labelKey)}</span>
                          </button>
                        )
                      })}
                    </div>

                    {selectedFlowItem.audioTrigger === 'appearanceDelay' && (
                      <div
                        className={`dynamic-flow-audio-delay-field ${advancedFeaturesEnabled ? '' : 'is-disabled'}`}
                        role="group"
                        aria-labelledby={audioDelayLabelId}
                        aria-disabled={!advancedFeaturesEnabled}
                      >
                        <span id={audioDelayLabelId}>{t('control.delaySeconds')}</span>
                        <div className="dynamic-flow-audio-delay-control">
                          {advancedFeaturesEnabled ? (
                            <IntervalWheel
                              className="dynamic-flow-audio-delay-wheel"
                              value={Number((selectedFlowItem.audioDelayMs / 1000).toFixed(1))}
                              min={0}
                              max={600}
                              step={0.1}
                              inputMode="decimal"
                              allowDirectInput={false}
                              onChange={(seconds) => onSetItemAudioDelay(
                                selectedFlowItem.id,
                                seconds * 1000
                              )}
                              ariaLabel={t('control.delaySeconds')}
                            />
                          ) : (
                            <output className="dynamic-flow-audio-delay-value">
                              {Number((selectedFlowItem.audioDelayMs / 1000).toFixed(1))}
                            </output>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedFlowItem.audioTrigger === 'targetArrival' && selectedFlowItem.audioTargetMissing && (
                      <div className="dynamic-flow-audio-target-warning" role="status">
                        <AlertTriangle aria-hidden="true" />
                        <span>{t('control.targetAudioNeedsDestination')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )

  const renderIssueGroup = (
    titleKey: string,
    groupIssues: DynamicCreationFlowIssue[],
    severity: 'error' | 'warning'
  ) => {
    if (groupIssues.length === 0) return null
    const SeverityIcon = severity === 'error' ? CircleAlert : AlertTriangle
    return (
      <section className={`dynamic-flow-issue-group is-${severity}`}>
        <div className="dynamic-flow-issue-heading">
          <SeverityIcon aria-hidden="true" />
          <h3>{t(titleKey)}</h3>
          <span>{groupIssues.length}</span>
        </div>
        <div className="dynamic-flow-issue-list">
          {groupIssues.map((issue) => {
            const content = (
              <>
              <span className="dynamic-flow-issue-icon"><SeverityIcon aria-hidden="true" /></span>
              <span>
                <small>{t(ISSUE_STEP_LABELS[issue.step])}</small>
                <strong>{issue.title}</strong>
                <em>{issue.description}</em>
              </span>
              {issue.actionable !== false && (
                <span className="dynamic-flow-fix-action">
                  {t('flow.goFix')}
                  <ChevronRight aria-hidden="true" />
                </span>
              )}
              </>
            )
            return issue.actionable === false ? (
              <article key={issue.id}>{content}</article>
            ) : (
              <button key={issue.id} type="button" onClick={() => onGoToIssue(issue)}>{content}</button>
            )
          })}
        </div>
      </section>
    )
  }

  const renderReview = () => (
    <div className="dynamic-flow-view dynamic-flow-review-view">
      <section className="dynamic-flow-section">
        <div className="dynamic-flow-section-heading is-compact">
          <span className="dynamic-flow-section-icon"><ClipboardCheck aria-hidden="true" /></span>
          <div>
            <h3>{t('flow.reviewSummary')}</h3>
            <p>{t('flow.step6Description')}</p>
          </div>
        </div>

        <div className="dynamic-flow-summary-grid">
          <article>
            <span><Layers3 aria-hidden="true" /></span>
            <strong>{summary.itemCount}</strong>
            <small>{t('flow.step1Title')}</small>
          </article>
          <article>
            <span><ImageIcon aria-hidden="true" /></span>
            <strong>{summary.backgroundCount}</strong>
            <small>{t('flow.step4Title')}</small>
          </article>
          <article>
            <span><Volume2 aria-hidden="true" /></span>
            <strong>{summary.audioCount}</strong>
            <small>{t('flow.step5Title')}</small>
          </article>
          <article>
            <span><Link2 aria-hidden="true" /></span>
            <strong>{summary.relationCount}</strong>
            <small>{t('flow.continuationActions')}</small>
          </article>
        </div>
      </section>

      {issues.length === 0 ? (
        <section className="dynamic-flow-all-clear" role="status">
          <span><CheckCircle2 aria-hidden="true" /></span>
          <div>
            <strong>{t('flow.noIssues')}</strong>
            <small>{t('flow.issueCount', { count: 0 })} · {t('flow.warningCount', { count: 0 })}</small>
          </div>
        </section>
      ) : (
        <div className="dynamic-flow-issues">
          {renderIssueGroup('flow.needsAttention', errorIssues, 'error')}
          {renderIssueGroup('flow.warnings', warningIssues, 'warning')}
        </div>
      )}

      <section className="dynamic-flow-preview-card">
        <span className="dynamic-flow-preview-orbit" aria-hidden="true"><Play /></span>
        <div>
          <strong>{t('flow.startPreview')}</strong>
          <small>{t('flow.syncStatus', { status: syncLabel })}</small>
        </div>
        <button type="button" onClick={onStartPreview}>
          <Play aria-hidden="true" />
          <span>{t('flow.startPreview')}</span>
        </button>
      </section>
    </div>
  )

  return (
    <aside className="dynamic-tool-panel side-right dynamic-flow-panel" data-step={step} aria-labelledby="dynamic-flow-panel-title">
      <header className="dynamic-flow-header is-minimal">
        <h2 id="dynamic-flow-panel-title" data-flow-step-heading tabIndex={-1}>{t(activeStep.titleKey)}</h2>
      </header>

      <div className="dynamic-flow-scroll-region">
        {step === 'appearance' && renderAppearance()}
        {step === 'backgrounds' && renderBackgrounds()}
        {step === 'audio' && renderAudio()}
        {step === 'review' && renderReview()}
      </div>
    </aside>
  )
}

export type {
  DynamicCreationFlowBackground,
  DynamicCreationFlowIssue,
  DynamicCreationFlowItem,
  DynamicCreationFlowLinkedAppearance,
  DynamicCreationFlowPanelProps,
  DynamicCreationFlowSummary
} from './types.ts'
export default DynamicCreationFlowPanel
