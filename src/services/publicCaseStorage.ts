import {
  deleteDynamicGroup,
  deletePersistedDynamicMedia,
  hydrateDynamicGroup,
  persistDynamicAudio,
  persistDynamicMedia,
  upsertDynamicGroup,
  type DynamicAppearanceTiming,
  type DynamicAudioMedia,
  type DynamicBackground,
  type DynamicBackgroundPlayMode,
  type DynamicBackgroundTransition,
  type DynamicBackgroundTransitionDurations,
  type DynamicBubbleContent,
  type DynamicGroup,
  type DynamicItem,
  type DynamicItemAudioTrigger,
  type DynamicItemKind,
  type DynamicLinkedAppearance,
  type DynamicMedia,
  type DynamicMotionPath,
  type DynamicMoveMode,
  type DynamicMoveTrack,
  type DynamicTargetMode
} from './dynamicArtStorage.ts'

const PUBLIC_CASE_MANIFEST_URL = '/dynamic-cases/manifest.json'

type PublicCaseAssetRole = 'background' | 'item' | 'audio' | 'bubble-image' | 'thumbnail' | string
type PublicCaseMediaType = 'image' | 'video' | 'audio'
type PublicCaseImportPhase =
  | 'loading-manifest'
  | 'validating'
  | 'downloading'
  | 'persisting'
  | 'saving'
  | 'complete'
  | 'rolling-back'

type PublicCaseImportErrorCode =
  | 'manifest-unavailable'
  | 'manifest-invalid'
  | 'template-not-found'
  | 'template-invalid'
  | 'asset-unavailable'
  | 'asset-invalid'
  | 'asset-persistence-failed'
  | 'import-failed'

interface PublicCaseAsset {
  assetId: string
  role: PublicCaseAssetRole
  itemId?: string | null
  name: string
  mediaType: PublicCaseMediaType
  mimeType: string
  path: string
  size: number
  sha256: string
}

interface PublicCaseMediaDescriptor {
  assetId: string
  name: string
  mediaType: PublicCaseMediaType
  mimeType: string
}

interface PublicCaseBackgroundPayload extends PublicCaseMediaDescriptor {
  bgmAudioId?: string | null
  backgroundTransition?: DynamicBackgroundTransition
  backgroundTransitionDurationMs?: number
  appearance?: DynamicBackground['appearance']
}

interface PublicCaseAudioPayload extends PublicCaseMediaDescriptor {
  durationMs?: number
}

type PublicCaseBubblePayload = Omit<DynamicBubbleContent, 'image'> & {
  imageAssetId?: string | null
}

interface PublicCaseItemPayload {
  itemId: string
  kind?: DynamicItemKind
  assetId?: string | null
  imageAssetId?: string | null
  bubble?: PublicCaseBubblePayload | null
  name: string
  position: DynamicItem['position']
  gridIndex: number
  scale: number
  rotation: number
  flipX: boolean
  flipY: boolean
  animationMode: DynamicItem['animationMode']
  animationId: number
  clickAnimationIds: number[]
  moveMode: DynamicMoveMode
  movePercent: number
  moveSpeed: number
  moveTrack: DynamicMoveTrack
  targetMode?: DynamicTargetMode
  targetLoop?: boolean
  targetPosition?: DynamicItem['targetPosition'] | null
  motionPath?: DynamicMotionPath
  appearanceDelayMs?: number
  appearanceHideMs?: number | null
  hideAfterTarget?: boolean
  appearanceByBackground?: Record<string, DynamicAppearanceTiming>
  audioId?: string | null
  audioTrigger?: DynamicItemAudioTrigger
  audioDelayMs?: number
  linkedAppearance?: DynamicLinkedAppearance | null
  backgroundIds?: string[]
  isVisible: boolean
  order: number
  updatedAt?: number
}

interface PublicCaseGroupPayload {
  groupId: string
  name: string
  activeBackgroundId?: string | null
  backgrounds: PublicCaseBackgroundPayload[]
  background?: PublicCaseBackgroundPayload | null
  backgroundPlayMode?: DynamicBackgroundPlayMode
  backgroundIntervalMs?: number
  backgroundPlaybackLoop?: boolean
  appearMode?: DynamicGroup['appearMode']
  appearIntervalMs?: number
  appearAnimation?: DynamicGroup['appearAnimation']
  backgroundTransition?: DynamicBackgroundTransition
  backgroundTransitionDurationMs?: number
  backgroundTransitionDurations?: DynamicBackgroundTransitionDurations
  audioLibrary: PublicCaseAudioPayload[]
  linkedAppearanceModelVersion?: number
  items: PublicCaseItemPayload[]
}

interface PublicCaseTemplate {
  templateId: string
  version: number
  slug: string
  names: Record<string, string>
  source?: Record<string, unknown>
  poster?: string
  posterPath?: string
  posterAssetId?: string | null
  group: PublicCaseGroupPayload
  assets: PublicCaseAsset[]
}

interface PublicCaseManifest {
  schemaVersion: number
  catalogVersion: number
  templates: PublicCaseTemplate[]
}

interface PublicCaseImportProgress {
  phase: PublicCaseImportPhase
  templateId: string
  completedAssets: number
  totalAssets: number
  completedBytes: number
  totalBytes: number
  ratio: number
  asset?: PublicCaseAsset
}

interface PublicCaseImportOptions {
  locale?: string
  name?: string
  signal?: AbortSignal
  onProgress?: (progress: PublicCaseImportProgress) => void
}

class PublicCaseImportError extends Error {
  readonly code: PublicCaseImportErrorCode
  readonly templateId?: string
  readonly assetId?: string
  readonly originalError?: unknown

  constructor(
    code: PublicCaseImportErrorCode,
    message: string,
    details: { templateId?: string; assetId?: string; originalError?: unknown } = {}
  ) {
    super(message)
    this.name = 'PublicCaseImportError'
    this.code = code
    this.templateId = details.templateId
    this.assetId = details.assetId
    this.originalError = details.originalError
  }
}

type PersistedPublicCaseAsset = DynamicMedia | DynamicAudioMedia

let cachedManifest: PublicCaseManifest | undefined

const makeImportId = (prefix: 'group' | 'item') => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const throwIfAborted = (signal?: AbortSignal) => {
  if (!signal?.aborted) return

  if (typeof DOMException !== 'undefined') {
    throw new DOMException('The public case import was cancelled', 'AbortError')
  }
  throw new Error('The public case import was cancelled')
}

const reportProgress = (
  callback: PublicCaseImportOptions['onProgress'],
  progress: Omit<PublicCaseImportProgress, 'ratio'>
) => {
  if (!callback) return
  const ratio = progress.totalBytes > 0
    ? progress.completedBytes / progress.totalBytes
    : progress.totalAssets > 0
      ? progress.completedAssets / progress.totalAssets
      : progress.phase === 'complete' ? 1 : 0

  try {
    callback({
      ...progress,
      ratio: Math.min(1, Math.max(0, ratio))
    })
  } catch (error) {
    console.error('Public case progress callback failed:', error)
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const parseManifest = (value: unknown): PublicCaseManifest => {
  if (
    !isRecord(value)
    || !Number.isFinite(Number(value.schemaVersion))
    || !Number.isFinite(Number(value.catalogVersion))
    || !Array.isArray(value.templates)
  ) {
    throw new PublicCaseImportError('manifest-invalid', 'The public case manifest is invalid')
  }

  const templates = value.templates as unknown[]
  const hasInvalidTemplate = templates.some((template) => (
    !isRecord(template)
    || typeof template.templateId !== 'string'
    || typeof template.slug !== 'string'
    || !isRecord(template.names)
    || !isRecord(template.group)
    || !Array.isArray(template.assets)
  ))

  if (hasInvalidTemplate) {
    throw new PublicCaseImportError('manifest-invalid', 'The public case manifest contains an invalid template')
  }

  return value as unknown as PublicCaseManifest
}

const loadPublicCaseManifest = async (
  options: { signal?: AbortSignal; forceRefresh?: boolean } = {}
): Promise<PublicCaseManifest> => {
  if (cachedManifest && !options.forceRefresh) return cachedManifest
  throwIfAborted(options.signal)

  let response: Response
  try {
    response = await fetch(PUBLIC_CASE_MANIFEST_URL, {
      cache: 'no-cache',
      signal: options.signal
    })
  } catch (error) {
    throw new PublicCaseImportError(
      'manifest-unavailable',
      'The public case manifest could not be loaded',
      { originalError: error }
    )
  }

  if (!response.ok) {
    throw new PublicCaseImportError(
      'manifest-unavailable',
      `The public case manifest could not be loaded (${response.status})`
    )
  }

  try {
    cachedManifest = parseManifest(await response.json())
    return cachedManifest
  } catch (error) {
    if (error instanceof PublicCaseImportError) throw error
    throw new PublicCaseImportError(
      'manifest-invalid',
      'The public case manifest is not valid JSON',
      { originalError: error }
    )
  }
}

const normalizeTemplateLookupId = (value: string) => value.trim().toLowerCase()

const PUBLIC_CASE_TEMPLATE_ALIASES: Record<string, string> = {
  'tortoise-hare': 'magicfloor.tortoise-hare',
  'kindergarten-graduation': 'magicfloor.kindergarten-awards',
  'kindergarten-awards': 'magicfloor.kindergarten-awards',
  'underwater-adventure': 'magicfloor.undersea-adventure',
  'undersea-adventure': 'magicfloor.undersea-adventure',
  'city-traffic': 'magicfloor.city-traffic',
  'african-savanna': 'magicfloor.african-savanna'
}

const findPublicCaseTemplate = (manifest: PublicCaseManifest, templateId: string) => {
  const requestedId = normalizeTemplateLookupId(templateId)
  const canonicalId = PUBLIC_CASE_TEMPLATE_ALIASES[requestedId] ?? requestedId
  return manifest.templates.find((template) => (
    normalizeTemplateLookupId(template.templateId) === canonicalId
    || normalizeTemplateLookupId(template.slug) === requestedId
  ))
}

const getPublicCaseAssetUrl = (asset: PublicCaseAsset) => {
  const relativePath = asset.path.trim().replace(/\\/g, '/').replace(/^\/+/, '')
  const pathSegments: string[] = relativePath.split('/')
  if (!relativePath || pathSegments.some((segment) => segment === '..' || segment === '.')) {
    throw new PublicCaseImportError(
      'asset-invalid',
      `Public case asset has an invalid path: ${asset.assetId}`,
      { assetId: asset.assetId }
    )
  }

  return relativePath.startsWith('dynamic-cases/')
    ? `/${relativePath}`
    : `/dynamic-cases/${relativePath}`
}

const getPublicCaseName = (template: PublicCaseTemplate, locale?: string) => {
  const normalizedLocale = String(locale ?? '').trim().toLowerCase().replace(/_/g, '-')
  const nameKeys = normalizedLocale.startsWith('zh-hant')
    || normalizedLocale.startsWith('zh-tw')
    || normalizedLocale.startsWith('zh-hk')
    || normalizedLocale.startsWith('zh-mo')
    ? ['zhHant', 'zh-Hant', 'zh']
    : normalizedLocale.startsWith('zh')
      ? ['zhHans', 'zh-Hans', 'zh']
      : normalizedLocale.startsWith('pt')
        ? ['pt', 'pt-PT', 'pt-BR', 'en']
        : normalizedLocale.startsWith('pl')
          ? ['pl', 'pl-PL', 'en']
          : ['en', 'zhHant', 'zhHans']

  for (const key of nameKeys) {
    const name = template.names[key]
    if (typeof name === 'string' && name.trim()) return name.trim()
  }

  return Object.values(template.names).find((name) => typeof name === 'string' && name.trim())?.trim()
    || template.group.name.trim()
    || template.slug
}

const getBubbleImageAssetId = (item: PublicCaseItemPayload) => (
  item.imageAssetId ?? item.bubble?.imageAssetId ?? undefined
)

const validatePublicCaseTemplate = (template: PublicCaseTemplate) => {
  if (!template.templateId.trim() || !template.slug.trim()) {
    throw new PublicCaseImportError('template-invalid', 'The public case template has no identifier')
  }
  if (!Array.isArray(template.group.backgrounds) || !Array.isArray(template.group.audioLibrary) || !Array.isArray(template.group.items)) {
    throw new PublicCaseImportError(
      'template-invalid',
      'The public case template has an invalid group payload',
      { templateId: template.templateId }
    )
  }

  const assetsById = new Map<string, PublicCaseAsset>()
  template.assets.forEach((asset) => {
    if (
      !asset
      || typeof asset.assetId !== 'string'
      || !asset.assetId.trim()
      || typeof asset.path !== 'string'
      || !asset.path.trim()
      || !['image', 'video', 'audio'].includes(asset.mediaType)
    ) {
      throw new PublicCaseImportError(
        'template-invalid',
        'The public case template contains invalid asset metadata',
        { templateId: template.templateId }
      )
    }
    if (assetsById.has(asset.assetId)) {
      throw new PublicCaseImportError(
        'template-invalid',
        `The public case template contains a duplicate asset: ${asset.assetId}`,
        { templateId: template.templateId, assetId: asset.assetId }
      )
    }
    assetsById.set(asset.assetId, asset)
  })

  const backgroundIds = new Set(template.group.backgrounds.map((background) => background.assetId))
  const audioIds = new Set(template.group.audioLibrary.map((audio) => audio.assetId))
  const itemIds = new Set(template.group.items.map((item) => item.itemId))
  const requireAsset = (assetId: string | null | undefined, expectedType?: PublicCaseMediaType) => {
    if (!assetId) return
    const asset = assetsById.get(assetId)
    if (!asset || (expectedType && asset.mediaType !== expectedType)) {
      throw new PublicCaseImportError(
        'template-invalid',
        `The public case template references a missing or incompatible asset: ${assetId}`,
        { templateId: template.templateId, assetId }
      )
    }
  }

  template.group.backgrounds.forEach((background) => {
    requireAsset(background.assetId)
    if (assetsById.get(background.assetId)?.mediaType === 'audio') {
      throw new PublicCaseImportError(
        'template-invalid',
        `A public case background references audio: ${background.assetId}`,
        { templateId: template.templateId, assetId: background.assetId }
      )
    }
    if (background.bgmAudioId && !audioIds.has(background.bgmAudioId)) {
      throw new PublicCaseImportError('template-invalid', `A public case background references missing BGM: ${background.bgmAudioId}`)
    }
  })
  template.group.audioLibrary.forEach((audio) => requireAsset(audio.assetId, 'audio'))
  template.group.items.forEach((item) => {
    if (!item.itemId || (item.kind !== 'bubble' && !item.assetId)) {
      throw new PublicCaseImportError('template-invalid', 'The public case template contains an invalid item')
    }
    if (item.kind === 'bubble') {
      requireAsset(getBubbleImageAssetId(item))
    } else {
      requireAsset(item.assetId)
    }
    if (item.audioId && !audioIds.has(item.audioId)) {
      throw new PublicCaseImportError('template-invalid', `A public case item references missing audio: ${item.audioId}`)
    }
    item.backgroundIds?.forEach((backgroundId) => {
      if (!backgroundIds.has(backgroundId)) {
        throw new PublicCaseImportError('template-invalid', `A public case item references a missing background: ${backgroundId}`)
      }
    })
    Object.keys(item.appearanceByBackground ?? {}).forEach((backgroundId) => {
      if (!backgroundIds.has(backgroundId)) {
        throw new PublicCaseImportError('template-invalid', `A public case appearance references a missing background: ${backgroundId}`)
      }
    })
    if (item.linkedAppearance?.triggerItemId && !itemIds.has(item.linkedAppearance.triggerItemId)) {
      throw new PublicCaseImportError('template-invalid', `A public case item references a missing linked item: ${item.linkedAppearance.triggerItemId}`)
    }
  })
  requireAsset(template.posterAssetId)

  if (template.group.activeBackgroundId && !backgroundIds.has(template.group.activeBackgroundId)) {
    throw new PublicCaseImportError('template-invalid', 'The public case active background is missing')
  }
}

const calculateSha256 = async (blob: Blob) => {
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const downloadPublicCaseAsset = async (
  template: PublicCaseTemplate,
  asset: PublicCaseAsset,
  signal?: AbortSignal
) => {
  throwIfAborted(signal)
  let response: Response
  try {
    response = await fetch(getPublicCaseAssetUrl(asset), {
      cache: 'force-cache',
      signal
    })
  } catch (error) {
    throw new PublicCaseImportError(
      'asset-unavailable',
      `Public case asset could not be loaded: ${asset.name}`,
      { templateId: template.templateId, assetId: asset.assetId, originalError: error }
    )
  }

  if (!response.ok) {
    throw new PublicCaseImportError(
      'asset-unavailable',
      `Public case asset could not be loaded: ${asset.name} (${response.status})`,
      { templateId: template.templateId, assetId: asset.assetId }
    )
  }

  const sourceBlob = await response.blob()
  throwIfAborted(signal)
  if (Number.isFinite(asset.size) && asset.size >= 0 && sourceBlob.size !== asset.size) {
    throw new PublicCaseImportError(
      'asset-invalid',
      `Public case asset size does not match its manifest: ${asset.name}`,
      { templateId: template.templateId, assetId: asset.assetId }
    )
  }

  if (asset.sha256?.trim()) {
    const actualHash = await calculateSha256(sourceBlob)
    if (actualHash && actualHash !== asset.sha256.trim().toLowerCase()) {
      throw new PublicCaseImportError(
        'asset-invalid',
        `Public case asset checksum does not match its manifest: ${asset.name}`,
        { templateId: template.templateId, assetId: asset.assetId }
      )
    }
  }

  const mimeType = asset.mimeType || sourceBlob.type || 'application/octet-stream'
  return new File([sourceBlob], asset.name, {
    type: mimeType,
    lastModified: Date.now()
  })
}

const persistPublicCaseAsset = async (
  template: PublicCaseTemplate,
  asset: PublicCaseAsset,
  file: File,
  groupId: string
): Promise<PersistedPublicCaseAsset> => {
  let persisted: PersistedPublicCaseAsset
  try {
    persisted = asset.mediaType === 'audio'
      ? await persistDynamicAudio(file, `${groupId}/public-case/${template.slug}/audio`)
      : await persistDynamicMedia(file, `${groupId}/public-case/${template.slug}/${asset.role}`)
  } catch (error) {
    throw new PublicCaseImportError(
      'asset-persistence-failed',
      `Public case asset could not be saved: ${asset.name}`,
      { templateId: template.templateId, assetId: asset.assetId, originalError: error }
    )
  }

  if (!persisted.filePath && !persisted.storageKey) {
    URL.revokeObjectURL(persisted.url)
    throw new PublicCaseImportError(
      'asset-persistence-failed',
      `Public case asset was not saved to durable storage: ${asset.name}`,
      { templateId: template.templateId, assetId: asset.assetId }
    )
  }
  return persisted
}

const requirePersistedVisual = (
  persistedBySourceId: Map<string, PersistedPublicCaseAsset>,
  sourceId: string,
  templateId: string
) => {
  const media = persistedBySourceId.get(sourceId)
  if (!media || media.type === 'audio') {
    throw new PublicCaseImportError(
      'template-invalid',
      `The imported public case is missing visual media: ${sourceId}`,
      { templateId, assetId: sourceId }
    )
  }
  return media
}

const remapOptionalId = (sourceId: string | null | undefined, idMap: Map<string, string>) => (
  sourceId ? idMap.get(sourceId) : undefined
)

const remapAppearanceByBackground = (
  source: Record<string, DynamicAppearanceTiming> | undefined,
  backgroundIdMap: Map<string, string>
) => {
  if (!source) return undefined
  const entries = Object.entries(source).flatMap(([sourceBackgroundId, timing]) => {
    const backgroundId = backgroundIdMap.get(sourceBackgroundId)
    return backgroundId ? [[backgroundId, { ...timing }] as const] : []
  })
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

const createDynamicGroupFromTemplate = (
  template: PublicCaseTemplate,
  persistedBySourceId: Map<string, PersistedPublicCaseAsset>,
  groupId: string,
  groupName: string
): DynamicGroup => {
  const now = Date.now()
  const mediaIdMap = new Map(
    Array.from(persistedBySourceId, ([sourceId, media]) => [sourceId, media.id])
  )
  const itemIdMap = new Map(
    template.group.items.map((item) => [item.itemId, makeImportId('item')])
  )

  const backgrounds = template.group.backgrounds.map((source): DynamicBackground => {
    const media = requirePersistedVisual(persistedBySourceId, source.assetId, template.templateId)
    return {
      ...media,
      name: source.name || media.name,
      bgmAudioId: remapOptionalId(source.bgmAudioId, mediaIdMap),
      backgroundTransition: source.backgroundTransition,
      backgroundTransitionDurationMs: source.backgroundTransitionDurationMs,
      appearance: source.appearance ? { ...source.appearance } : undefined
    }
  })
  const backgroundIdMap = new Map(
    template.group.backgrounds.map((background, index) => [background.assetId, backgrounds[index].id])
  )
  const backgroundsById = new Map(backgrounds.map((background) => [background.id, background]))

  const audioLibrary = template.group.audioLibrary.map((source): DynamicAudioMedia => {
    const media = persistedBySourceId.get(source.assetId)
    if (!media || media.type !== 'audio') {
      throw new PublicCaseImportError(
        'template-invalid',
        `The imported public case is missing audio: ${source.assetId}`,
        { templateId: template.templateId, assetId: source.assetId }
      )
    }
    return {
      ...media,
      name: source.name || media.name,
      durationMs: source.durationMs
    }
  })

  const items = template.group.items.map((source): DynamicItem => {
    const id = itemIdMap.get(source.itemId) as string
    const commonItem = {
      id,
      name: source.name,
      position: { ...source.position },
      gridIndex: source.gridIndex,
      scale: source.scale,
      rotation: source.rotation,
      flipX: source.flipX,
      flipY: source.flipY,
      animationMode: source.animationMode,
      animationId: source.animationId,
      clickAnimationIds: [...source.clickAnimationIds],
      moveMode: source.moveMode,
      movePercent: source.movePercent,
      moveSpeed: source.moveSpeed,
      moveTrack: source.moveTrack,
      targetMode: source.targetMode,
      targetLoop: source.targetLoop === true,
      targetPosition: source.targetPosition ? { ...source.targetPosition } : undefined,
      motionPath: source.motionPath,
      appearanceDelayMs: source.appearanceDelayMs,
      appearanceHideMs: source.appearanceHideMs,
      hideAfterTarget: source.hideAfterTarget === true,
      appearanceByBackground: remapAppearanceByBackground(source.appearanceByBackground, backgroundIdMap),
      audioId: remapOptionalId(source.audioId, mediaIdMap),
      audioTrigger: source.audioTrigger,
      audioDelayMs: source.audioDelayMs,
      linkedAppearance: source.linkedAppearance
        ? {
            ...source.linkedAppearance,
            triggerItemId: itemIdMap.get(source.linkedAppearance.triggerItemId) as string
          }
        : undefined,
      backgroundIds: (source.backgroundIds ?? []).flatMap((sourceBackgroundId) => {
        const backgroundId = backgroundIdMap.get(sourceBackgroundId)
        return backgroundId ? [backgroundId] : []
      }),
      isVisible: source.isVisible,
      order: source.order,
      createdAt: now,
      updatedAt: now
    }

    if (source.kind === 'bubble') {
      if (!source.bubble) {
        throw new PublicCaseImportError('template-invalid', `A public case bubble has no content: ${source.itemId}`)
      }
      const imageAssetId = getBubbleImageAssetId(source)
      const image = imageAssetId
        ? requirePersistedVisual(persistedBySourceId, imageAssetId, template.templateId)
        : undefined
      const { imageAssetId: _imageAssetId, ...bubbleContent } = source.bubble
      return {
        ...commonItem,
        kind: 'bubble',
        bubble: {
          ...bubbleContent,
          image
        }
      }
    }

    if (!source.assetId) {
      throw new PublicCaseImportError('template-invalid', `A public case item has no media: ${source.itemId}`)
    }
    return {
      ...commonItem,
      kind: 'media',
      media: requirePersistedVisual(persistedBySourceId, source.assetId, template.templateId)
    }
  })

  const activeBackgroundId = remapOptionalId(template.group.activeBackgroundId, backgroundIdMap)
    ?? backgrounds[0]?.id
  const activeBackground = activeBackgroundId ? backgroundsById.get(activeBackgroundId) : undefined
  const poster = template.posterAssetId
    ? persistedBySourceId.get(template.posterAssetId)
    : undefined
  const thumbnail = poster?.type === 'audio' ? undefined : poster

  return {
    id: groupId,
    name: groupName,
    thumbnail,
    background: activeBackground,
    backgrounds,
    activeBackgroundId,
    backgroundPlayMode: template.group.backgroundPlayMode ?? 'fixed',
    backgroundIntervalMs: template.group.backgroundIntervalMs ?? 5000,
    backgroundPlaybackLoop: template.group.backgroundPlaybackLoop ?? true,
    appearMode: template.group.appearMode ?? 'all',
    appearIntervalMs: template.group.appearIntervalMs ?? 800,
    appearAnimation: template.group.appearAnimation ?? 'none',
    backgroundTransition: template.group.backgroundTransition ?? 'none',
    backgroundTransitionDurationMs: template.group.backgroundTransitionDurationMs,
    backgroundTransitionDurations: template.group.backgroundTransitionDurations,
    audioLibrary,
    linkedAppearanceModelVersion: template.group.linkedAppearanceModelVersion,
    items,
    createdAt: now,
    updatedAt: now
  }
}

const rollbackPersistedAssets = async (persistedAssets: PersistedPublicCaseAsset[]) => {
  await Promise.allSettled(persistedAssets.map(async (media) => {
    await deletePersistedDynamicMedia(media)
    if (media.url.startsWith('blob:')) URL.revokeObjectURL(media.url)
  }))
}

const importPublicCase = async (
  templateId: string,
  options: PublicCaseImportOptions = {}
): Promise<DynamicGroup> => {
  const requestedTemplateId = templateId.trim()
  if (!requestedTemplateId) {
    throw new PublicCaseImportError('template-not-found', 'A public case template ID is required')
  }

  const emptyProgress = {
    templateId: requestedTemplateId,
    completedAssets: 0,
    totalAssets: 0,
    completedBytes: 0,
    totalBytes: 0
  }
  reportProgress(options.onProgress, { phase: 'loading-manifest', ...emptyProgress })
  const manifest = await loadPublicCaseManifest({ signal: options.signal })
  const template = findPublicCaseTemplate(manifest, requestedTemplateId)
  if (!template) {
    throw new PublicCaseImportError(
      'template-not-found',
      `Public case template was not found: ${requestedTemplateId}`,
      { templateId: requestedTemplateId }
    )
  }

  const totalBytes = template.assets.reduce((sum, asset) => (
    sum + (Number.isFinite(asset.size) && asset.size > 0 ? asset.size : 0)
  ), 0)
  const progressBase = {
    templateId: template.templateId,
    completedAssets: 0,
    totalAssets: template.assets.length,
    completedBytes: 0,
    totalBytes
  }
  reportProgress(options.onProgress, { phase: 'validating', ...progressBase })
  validatePublicCaseTemplate(template)
  throwIfAborted(options.signal)

  const groupId = makeImportId('group')
  const persistedAssets: PersistedPublicCaseAsset[] = []
  const persistedBySourceId = new Map<string, PersistedPublicCaseAsset>()
  let groupSaved = false
  let completedBytes = 0

  try {
    for (let index = 0; index < template.assets.length; index += 1) {
      const asset = template.assets[index]
      const progress = {
        templateId: template.templateId,
        completedAssets: index,
        totalAssets: template.assets.length,
        completedBytes,
        totalBytes,
        asset
      }
      reportProgress(options.onProgress, { phase: 'downloading', ...progress })
      const file = await downloadPublicCaseAsset(template, asset, options.signal)
      reportProgress(options.onProgress, { phase: 'persisting', ...progress })
      const persisted = await persistPublicCaseAsset(template, asset, file, groupId)
      persistedAssets.push(persisted)
      persistedBySourceId.set(asset.assetId, persisted)
      completedBytes += asset.size > 0 ? asset.size : file.size
      reportProgress(options.onProgress, {
        phase: 'persisting',
        ...progress,
        completedAssets: index + 1,
        completedBytes
      })
      throwIfAborted(options.signal)
    }

    const group = createDynamicGroupFromTemplate(
      template,
      persistedBySourceId,
      groupId,
      options.name?.trim() || getPublicCaseName(template, options.locale)
    )
    reportProgress(options.onProgress, {
      phase: 'saving',
      templateId: template.templateId,
      completedAssets: template.assets.length,
      totalAssets: template.assets.length,
      completedBytes,
      totalBytes
    })
    throwIfAborted(options.signal)
    const savedGroup = upsertDynamicGroup(group)
    groupSaved = true
    const hydratedGroup = await hydrateDynamicGroup(savedGroup)
    reportProgress(options.onProgress, {
      phase: 'complete',
      templateId: template.templateId,
      completedAssets: template.assets.length,
      totalAssets: template.assets.length,
      completedBytes: totalBytes,
      totalBytes
    })
    return hydratedGroup
  } catch (error) {
    reportProgress(options.onProgress, {
      phase: 'rolling-back',
      templateId: template.templateId,
      completedAssets: persistedAssets.length,
      totalAssets: template.assets.length,
      completedBytes,
      totalBytes
    })
    if (groupSaved) {
      await deleteDynamicGroup(groupId)
      persistedAssets.forEach((media) => {
        if (media.url.startsWith('blob:')) URL.revokeObjectURL(media.url)
      })
    } else {
      await rollbackPersistedAssets(persistedAssets)
    }
    if (error instanceof PublicCaseImportError || (error instanceof DOMException && error.name === 'AbortError')) {
      throw error
    }
    throw new PublicCaseImportError(
      'import-failed',
      `Public case could not be imported: ${template.templateId}`,
      { templateId: template.templateId, originalError: error }
    )
  }
}

export {
  PUBLIC_CASE_MANIFEST_URL,
  PublicCaseImportError,
  importPublicCase,
  loadPublicCaseManifest
}
export type {
  PublicCaseAsset,
  PublicCaseAssetRole,
  PublicCaseGroupPayload,
  PublicCaseImportErrorCode,
  PublicCaseImportOptions,
  PublicCaseImportPhase,
  PublicCaseImportProgress,
  PublicCaseManifest,
  PublicCaseMediaType,
  PublicCaseTemplate
}
