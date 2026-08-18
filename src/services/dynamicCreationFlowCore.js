export const DYNAMIC_CREATION_FLOW_SESSION_VERSION = 1

export const DYNAMIC_CREATION_FLOW_EXPERIENCES = Object.freeze(['flow', 'free'])

export const DYNAMIC_CREATION_FLOW_STEP_IDS = Object.freeze([
  'objects',
  'layout',
  'appearance',
  'backgrounds',
  'audio',
  'review'
])

export const DYNAMIC_CREATION_FLOW_LAYOUT_SUBSTEPS = Object.freeze([
  'placement',
  'motion',
  'animation',
  'transform'
])

export const DYNAMIC_CREATION_FLOW_STEPS = Object.freeze([
  Object.freeze({ id: 'objects', index: 0, optional: false, requiresItems: false }),
  Object.freeze({ id: 'layout', index: 1, optional: false, requiresItems: true }),
  Object.freeze({ id: 'appearance', index: 2, optional: false, requiresItems: true }),
  Object.freeze({ id: 'backgrounds', index: 3, optional: true, requiresItems: true }),
  Object.freeze({ id: 'audio', index: 4, optional: true, requiresItems: true }),
  Object.freeze({ id: 'review', index: 5, optional: false, requiresItems: true })
])

const FLOW_STEP_ID_SET = new Set(DYNAMIC_CREATION_FLOW_STEP_IDS)
const OPTIONAL_FLOW_STEP_ID_SET = new Set(
  DYNAMIC_CREATION_FLOW_STEPS.filter((step) => step.optional).map((step) => step.id)
)
const FLOW_EXPERIENCE_SET = new Set(DYNAMIC_CREATION_FLOW_EXPERIENCES)
const LAYOUT_SUBSTEP_SET = new Set(DYNAMIC_CREATION_FLOW_LAYOUT_SUBSTEPS)
const LINKED_APPEARANCE_MODE_SET = new Set(['showAfter', 'hideAfter'])

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const toTrimmedString = (value) => typeof value === 'string' ? value.trim() : ''

const toFiniteNumber = (value, fallback = 0) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const toNonNegativeInteger = (value, fallback = 0) => (
  Math.max(0, Math.round(toFiniteNumber(value, fallback)))
)

const uniqueStrings = (value) => {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(toTrimmedString).filter(Boolean)))
}

const getItemId = (item) => toTrimmedString(item?.id ?? item?.itemId)

const getItemName = (item) => toTrimmedString(item?.name) || getItemId(item)

const getItems = (groupOrItems) => {
  if (Array.isArray(groupOrItems)) return groupOrItems
  return Array.isArray(groupOrItems?.items) ? groupOrItems.items : []
}

const getBackgrounds = (group) => {
  const candidates = Array.isArray(group?.backgrounds) ? [...group.backgrounds] : []
  if (group?.background) candidates.push(group.background)

  const seenIds = new Set()
  return candidates.filter((background) => {
    const backgroundId = toTrimmedString(background?.id)
    if (!backgroundId || seenIds.has(backgroundId)) return false
    seenIds.add(backgroundId)
    return true
  })
}

const getAudioLibrary = (group) => {
  const seenIds = new Set()
  return (Array.isArray(group?.audioLibrary) ? group.audioLibrary : []).filter((audio) => {
    const audioId = toTrimmedString(audio?.id)
    if (!audioId || seenIds.has(audioId)) return false
    seenIds.add(audioId)
    return true
  })
}

const getPlaybackEntries = (groupOrItems) => getItems(groupOrItems)
  .map((item, sourceIndex) => ({
    item,
    sourceIndex,
    itemId: getItemId(item),
    order: toFiniteNumber(item?.order, sourceIndex),
    createdAt: toFiniteNumber(item?.createdAt, 0)
  }))
  .filter((entry) => entry.itemId)
  .sort((left, right) => (
    left.order - right.order
    || left.createdAt - right.createdAt
    || left.sourceIndex - right.sourceIndex
  ))

const hasNormalizedPosition = (position) => {
  if (!isRecord(position)) return false
  const x = Number(position.x)
  const y = Number(position.y)
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1
}

const getCandidateLinkState = (groupOrItems) => {
  const items = getItems(groupOrItems)
  const validItemIds = new Set(items.map(getItemId).filter(Boolean))
  const candidateLinkByTargetId = new Map()

  items.forEach((item) => {
    const targetItemId = getItemId(item)
    const linkedAppearance = item?.linkedAppearance
    if (!targetItemId || !isRecord(linkedAppearance)) return

    const triggerItemId = toTrimmedString(linkedAppearance.triggerItemId)
    const mode = toTrimmedString(linkedAppearance.mode)
    if (
      !triggerItemId
      || triggerItemId === targetItemId
      || !validItemIds.has(triggerItemId)
      || !LINKED_APPEARANCE_MODE_SET.has(mode)
    ) return

    candidateLinkByTargetId.set(targetItemId, {
      triggerItemId,
      mode,
      delayMs: toNonNegativeInteger(linkedAppearance.delayMs)
    })
  })

  const cycleAffectedTargetIds = new Set()
  candidateLinkByTargetId.forEach((_link, targetItemId) => {
    const visitedItemIds = new Set([targetItemId])
    let currentItemId = targetItemId

    while (candidateLinkByTargetId.has(currentItemId)) {
      const triggerItemId = candidateLinkByTargetId.get(currentItemId).triggerItemId
      if (visitedItemIds.has(triggerItemId)) {
        cycleAffectedTargetIds.add(targetItemId)
        break
      }
      visitedItemIds.add(triggerItemId)
      currentItemId = triggerItemId
    }
  })

  const validLinkByTargetId = new Map(
    Array.from(candidateLinkByTargetId.entries()).filter(([targetItemId]) => (
      !cycleAffectedTargetIds.has(targetItemId)
    ))
  )

  return {
    candidateLinkByTargetId,
    cycleAffectedTargetIds,
    validItemIds,
    validLinkByTargetId
  }
}

export const isDynamicCreationFlowStep = (value) => FLOW_STEP_ID_SET.has(value)

export const getDynamicCreationFlowStep = (value) => (
  DYNAMIC_CREATION_FLOW_STEPS.find((step) => step.id === value)
)

export const normalizeDynamicCreationFlowSession = (value, options = {}) => {
  const requestedGroupId = toTrimmedString(options.groupId)
  const fallbackExperience = FLOW_EXPERIENCE_SET.has(options.defaultExperience)
    ? options.defaultExperience
    : 'flow'
  const now = toNonNegativeInteger(options.now, Date.now())
  const source = isRecord(value)
    && Number(value.version) === DYNAMIC_CREATION_FLOW_SESSION_VERSION
    ? value
    : {}
  const groupId = requestedGroupId || toTrimmedString(source.groupId)
  const suppliedItemIds = Array.isArray(options.itemIds)
    ? uniqueStrings(options.itemIds)
    : undefined
  const knownItemIds = suppliedItemIds ?? uniqueStrings([
    source.selectedItemId,
    source.currentItemId,
    ...(Array.isArray(source.checkedItemIds) ? source.checkedItemIds : [])
  ])
  const knownItemIdSet = new Set(knownItemIds)
  const requestedSelectedItemId = toTrimmedString(source.selectedItemId ?? source.currentItemId)
  const selectedItemId = requestedSelectedItemId && knownItemIdSet.has(requestedSelectedItemId)
    ? requestedSelectedItemId
    : knownItemIds[0]
  const requestedStep = toTrimmedString(source.step ?? source.currentStep)
  const step = knownItemIds.length === 0
    ? 'objects'
    : FLOW_STEP_ID_SET.has(requestedStep) ? requestedStep : 'objects'
  const requestedExperience = toTrimmedString(source.experience ?? source.mode)
  const experience = FLOW_EXPERIENCE_SET.has(requestedExperience)
    ? requestedExperience
    : fallbackExperience
  const requestedLayoutSubstep = toTrimmedString(source.layoutSubstep ?? source.layoutSection)
  const layoutSubstep = LAYOUT_SUBSTEP_SET.has(requestedLayoutSubstep)
    ? requestedLayoutSubstep
    : 'placement'
  const checkedItemIds = uniqueStrings(source.checkedItemIds).filter((itemId) => knownItemIdSet.has(itemId))
  const skippedSteps = uniqueStrings(source.skippedSteps).filter((stepId) => OPTIONAL_FLOW_STEP_ID_SET.has(stepId))
  const sourceUpdatedAt = Number(source.updatedAt)

  return {
    version: DYNAMIC_CREATION_FLOW_SESSION_VERSION,
    groupId,
    experience,
    step,
    selectedItemId,
    layoutSubstep,
    checkedItemIds,
    skippedSteps,
    updatedAt: Number.isFinite(sourceUpdatedAt) && sourceUpdatedAt >= 0
      ? Math.round(sourceUpdatedAt)
      : now
  }
}

export const getDynamicPlaybackOrder = (groupOrItems) => (
  getPlaybackEntries(groupOrItems).map((entry) => entry.itemId)
)

export const convertDynamicPlaybackOrderToLayerOrder = (playbackItemIds, allItemIds = []) => {
  const normalizedPlaybackItemIds = uniqueStrings(playbackItemIds)
  const orderedItemIds = [...normalizedPlaybackItemIds]

  uniqueStrings(allItemIds).forEach((itemId) => {
    if (!orderedItemIds.includes(itemId)) orderedItemIds.push(itemId)
  })

  return orderedItemIds.reverse()
}

export const convertDynamicPlaybackOrderToFrontLayerOrder = convertDynamicPlaybackOrderToLayerOrder
export const playbackOrderToLayerOrder = convertDynamicPlaybackOrderToLayerOrder

export const getDynamicAppearanceRelations = (groupOrItems) => {
  const playbackEntries = getPlaybackEntries(groupOrItems)
  const itemById = new Map(playbackEntries.map((entry) => [entry.itemId, entry.item]))
  const { validLinkByTargetId } = getCandidateLinkState(groupOrItems)

  return playbackEntries.flatMap((entry) => {
    const link = validLinkByTargetId.get(entry.itemId)
    if (!link) return []

    return [{
      sourceItemId: link.triggerItemId,
      sourceItemName: getItemName(itemById.get(link.triggerItemId)),
      targetItemId: entry.itemId,
      targetItemName: getItemName(entry.item),
      mode: link.mode,
      action: link.mode === 'showAfter' ? 'show' : 'hide',
      delayMs: link.delayMs,
      targetInitiallyVisible: link.mode === 'hideAfter'
    }]
  })
}

export const buildDynamicAppearanceRelationTree = (groupOrItems) => {
  const playbackEntries = getPlaybackEntries(groupOrItems)
  const itemById = new Map(playbackEntries.map((entry) => [entry.itemId, entry.item]))
  const entryById = new Map(playbackEntries.map((entry) => [entry.itemId, entry]))
  const { validLinkByTargetId } = getCandidateLinkState(groupOrItems)
  const childrenBySourceId = new Map()

  validLinkByTargetId.forEach((link, targetItemId) => {
    const childIds = childrenBySourceId.get(link.triggerItemId) ?? []
    childIds.push(targetItemId)
    childrenBySourceId.set(link.triggerItemId, childIds)
  })

  const compareItemIds = (leftItemId, rightItemId) => {
    const left = entryById.get(leftItemId)
    const right = entryById.get(rightItemId)
    if (!left || !right) return 0
    return left.order - right.order
      || left.createdAt - right.createdAt
      || left.sourceIndex - right.sourceIndex
  }

  childrenBySourceId.forEach((childIds) => childIds.sort(compareItemIds))

  const buildNode = (itemId) => {
    const entry = entryById.get(itemId)
    const link = validLinkByTargetId.get(itemId)
    const relation = link ? {
      sourceItemId: link.triggerItemId,
      sourceItemName: getItemName(itemById.get(link.triggerItemId)),
      targetItemId: itemId,
      targetItemName: getItemName(entry?.item),
      mode: link.mode,
      action: link.mode === 'showAfter' ? 'show' : 'hide',
      delayMs: link.delayMs,
      targetInitiallyVisible: link.mode === 'hideAfter'
    } : undefined

    return {
      itemId,
      name: getItemName(entry?.item),
      order: entry?.order ?? 0,
      relation,
      children: (childrenBySourceId.get(itemId) ?? []).map(buildNode)
    }
  }

  return playbackEntries
    .filter((entry) => !validLinkByTargetId.has(entry.itemId))
    .map((entry) => buildNode(entry.itemId))
}

const createFlowIssue = (code, severity, step, details = {}) => ({
  code,
  severity,
  step,
  messageKey: `flow.issue.${code}`,
  ...details
})

export const getDynamicCreationFlowIssues = (group) => {
  const items = getItems(group)
  const backgrounds = getBackgrounds(group)
  const audioLibrary = getAudioLibrary(group)
  const itemIdCounts = new Map()
  const backgroundIdSet = new Set(backgrounds.map((background) => toTrimmedString(background.id)))
  const audioIdSet = new Set(audioLibrary.map((audio) => toTrimmedString(audio.id)))
  const issues = []

  if (items.length === 0) {
    issues.push(createFlowIssue('objects.empty', 'blocking', 'objects'))
  }

  items.forEach((item, itemIndex) => {
    const itemId = getItemId(item)
    const itemName = getItemName(item) || String(itemIndex + 1)
    if (!itemId) {
      issues.push(createFlowIssue('objects.missingId', 'blocking', 'objects', {
        params: { itemName }
      }))
      return
    }

    itemIdCounts.set(itemId, (itemIdCounts.get(itemId) ?? 0) + 1)

    if (!hasNormalizedPosition(item?.position)) {
      issues.push(createFlowIssue('layout.invalidPosition', 'blocking', 'layout', {
        itemId,
        params: { itemName }
      }))
    }

    if (item?.targetMode === 'target' && !hasNormalizedPosition(item?.targetPosition)) {
      issues.push(createFlowIssue('layout.targetMissing', 'blocking', 'layout', {
        itemId,
        params: { itemName }
      }))
    }

    const assignedBackgroundIds = uniqueStrings(item?.backgroundIds)
    const missingBackgroundIds = assignedBackgroundIds.filter((backgroundId) => !backgroundIdSet.has(backgroundId))
    if (missingBackgroundIds.length > 0) {
      issues.push(createFlowIssue('backgrounds.missingAssignment', 'warning', 'backgrounds', {
        itemId,
        params: { itemName, count: missingBackgroundIds.length }
      }))
    }

    const itemAudioId = toTrimmedString(item?.audioId)
    if (itemAudioId && !audioIdSet.has(itemAudioId)) {
      issues.push(createFlowIssue('audio.missingItemAsset', 'warning', 'audio', {
        itemId,
        params: { itemName }
      }))
    }

    if (
      itemAudioId
      && item?.audioTrigger === 'targetArrival'
      && (item?.targetMode !== 'target' || !hasNormalizedPosition(item?.targetPosition))
    ) {
      issues.push(createFlowIssue('audio.targetMissing', 'blocking', 'audio', {
        itemId,
        params: { itemName }
      }))
    }
  })

  itemIdCounts.forEach((count, itemId) => {
    if (count <= 1) return
    issues.push(createFlowIssue('objects.duplicateId', 'blocking', 'objects', {
      itemId,
      params: { count }
    }))
  })

  const { candidateLinkByTargetId, cycleAffectedTargetIds, validItemIds } = getCandidateLinkState(group)
  items.forEach((item) => {
    const targetItemId = getItemId(item)
    const linkedAppearance = item?.linkedAppearance
    if (!targetItemId || !isRecord(linkedAppearance)) return

    const triggerItemId = toTrimmedString(linkedAppearance.triggerItemId)
    const mode = toTrimmedString(linkedAppearance.mode)
    const itemName = getItemName(item)
    if (!triggerItemId || !validItemIds.has(triggerItemId)) {
      issues.push(createFlowIssue('appearance.missingTrigger', 'blocking', 'appearance', {
        itemId: targetItemId,
        params: { itemName }
      }))
    } else if (triggerItemId === targetItemId) {
      issues.push(createFlowIssue('appearance.selfLink', 'blocking', 'appearance', {
        itemId: targetItemId,
        params: { itemName }
      }))
    } else if (!LINKED_APPEARANCE_MODE_SET.has(mode)) {
      issues.push(createFlowIssue('appearance.invalidMode', 'blocking', 'appearance', {
        itemId: targetItemId,
        params: { itemName }
      }))
    } else if (cycleAffectedTargetIds.has(targetItemId)) {
      issues.push(createFlowIssue('appearance.cycle', 'blocking', 'appearance', {
        itemId: targetItemId,
        params: { itemName }
      }))
    } else if (candidateLinkByTargetId.has(targetItemId) && Number(linkedAppearance.delayMs) < 0) {
      issues.push(createFlowIssue('appearance.negativeDelay', 'warning', 'appearance', {
        itemId: targetItemId,
        params: { itemName }
      }))
    }
  })

  if (backgrounds.length === 0) {
    issues.push(createFlowIssue('backgrounds.empty', 'warning', 'backgrounds'))
  }

  backgrounds.forEach((background) => {
    const backgroundId = toTrimmedString(background?.id)
    const audioId = toTrimmedString(background?.bgmAudioId)
    if (audioId && !audioIdSet.has(audioId)) {
      issues.push(createFlowIssue('audio.missingBackgroundAsset', 'warning', 'audio', {
        backgroundId,
        params: { backgroundName: toTrimmedString(background?.name) || backgroundId }
      }))
    }
  })

  if (items.length > 0 && items.every((item) => item?.isVisible === false)) {
    issues.push(createFlowIssue('review.noVisibleObjects', 'warning', 'review'))
  }

  return issues
}

export const deriveDynamicCreationFlowIssues = getDynamicCreationFlowIssues

export const getDynamicCreationFlowSummary = (group) => {
  const items = getItems(group)
  const backgrounds = getBackgrounds(group)
  const audioLibrary = getAudioLibrary(group)
  const issues = getDynamicCreationFlowIssues(group)
  const relations = getDynamicAppearanceRelations(group)
  const itemAudioCount = items.filter((item) => toTrimmedString(item?.audioId)).length
  const backgroundAudioCount = backgrounds.filter((background) => toTrimmedString(background?.bgmAudioId)).length
  const targetItemCount = items.filter((item) => (
    item?.targetMode === 'target' && hasNormalizedPosition(item?.targetPosition)
  )).length
  const playbackOrder = getPlaybackEntries(group).map((entry) => ({
    itemId: entry.itemId,
    name: getItemName(entry.item),
    order: entry.order
  }))
  const stepStatus = Object.fromEntries(DYNAMIC_CREATION_FLOW_STEPS.map((step) => {
    const stepIssues = step.id === 'review'
      ? issues
      : issues.filter((issue) => issue.step === step.id)
    const blockingIssueCount = stepIssues.filter((issue) => issue.severity === 'blocking').length
    const warningCount = stepIssues.length - blockingIssueCount
    let configured = true

    if (step.id === 'objects' || step.id === 'layout' || step.id === 'appearance') configured = items.length > 0
    if (step.id === 'backgrounds') configured = backgrounds.length > 0
    if (step.id === 'audio') configured = itemAudioCount + backgroundAudioCount > 0
    if (step.id === 'review') configured = items.length > 0

    return [step.id, {
      id: step.id,
      optional: step.optional,
      configured,
      ready: blockingIssueCount === 0,
      complete: configured && blockingIssueCount === 0,
      blockingIssueCount,
      warningCount
    }]
  }))
  const blockingIssueCount = issues.filter((issue) => issue.severity === 'blocking').length
  const warningCount = issues.length - blockingIssueCount

  return {
    itemCount: items.length,
    visibleItemCount: items.filter((item) => item?.isVisible !== false).length,
    targetItemCount,
    backgroundCount: backgrounds.length,
    audioAssetCount: audioLibrary.length,
    itemAudioCount,
    backgroundAudioCount,
    linkedAppearanceCount: relations.length,
    showAfterCount: relations.filter((relation) => relation.mode === 'showAfter').length,
    hideAfterCount: relations.filter((relation) => relation.mode === 'hideAfter').length,
    appearMode: group?.appearMode === 'sequence' ? 'sequence' : 'all',
    appearIntervalMs: toNonNegativeInteger(group?.appearIntervalMs, 800),
    appearAnimation: group?.appearAnimation === 'drop' || group?.appearAnimation === 'trackSlide'
      ? group.appearAnimation
      : 'none',
    playbackOrder,
    relationTree: buildDynamicAppearanceRelationTree(group),
    issues,
    stepStatus,
    blockingIssueCount,
    warningCount,
    readyForPreview: items.length > 0 && blockingIssueCount === 0
  }
}

export const deriveDynamicCreationFlowSummary = getDynamicCreationFlowSummary
