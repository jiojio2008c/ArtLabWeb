const fs = require('fs')
const path = require('path')

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm'
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const isSafeRelativePath = (value) => {
  const normalized = String(value || '').replace(/\\/g, '/')
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized) || normalized.includes('://')) {
    return false
  }
  return !normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')
}

const resolvePublicCasesRoot = (app, runtimeDir) => {
  if (app?.isPackaged) return path.join(process.resourcesPath, 'dynamic-cases')
  return path.join(runtimeDir, '..', 'public', 'dynamic-cases')
}

const resolveInsideRoot = (root, relativePath) => {
  if (!isSafeRelativePath(relativePath)) return null
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, ...String(relativePath).replace(/\\/g, '/').split('/'))
  const relative = path.relative(resolvedRoot, resolved)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null
  return resolved
}

const loadPublicCaseManifest = (root) => {
  const manifestPath = path.join(root, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (!isRecord(manifest) || !Array.isArray(manifest.templates)) {
    throw new Error('Public case manifest is invalid')
  }
  return manifest
}

const getPublicCaseName = (template, locale = 'zh-Hant') => {
  const names = isRecord(template?.names) ? template.names : {}
  const normalized = String(locale || '').trim().toLowerCase().replace(/_/g, '-')
  const keys = normalized.startsWith('zh-hant') || normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk')
    ? ['zhHant', 'zh-Hant', 'zh']
    : normalized.startsWith('zh')
      ? ['zhHans', 'zh-Hans', 'zh']
      : normalized.startsWith('pt')
        ? ['pt', 'pt-PT', 'en']
        : normalized.startsWith('pl')
          ? ['pl', 'pl-PL', 'en']
          : ['zhHant', 'en']

  for (const key of keys) {
    const name = names[key]
    if (typeof name === 'string' && name.trim()) return name.trim()
  }

  return Object.values(names).find((name) => typeof name === 'string' && name.trim())?.trim()
    || String(template?.group?.name || '').trim()
    || String(template?.slug || 'public-case')
}

const findPublicCaseTemplate = (manifest, templateId) => {
  const requested = String(templateId || '').trim().toLowerCase()
  return (manifest.templates || []).find((template) => (
    String(template?.templateId || '').trim().toLowerCase() === requested
    || String(template?.slug || '').trim().toLowerCase() === requested
  ))
}

const buildPublicCaseCatalog = (root, locale = 'zh-Hant') => {
  const manifest = loadPublicCaseManifest(root)
  return manifest.templates.map((template) => {
    const posterPath = template.posterPath
      || String(template.poster || '').replace(/^\/dynamic-cases\//, '')
      || `${template.slug}/poster.jpeg`
    return {
      templateId: template.templateId,
      slug: template.slug,
      name: getPublicCaseName(template, locale),
      posterPath,
      backgroundCount: Array.isArray(template.group?.backgrounds) ? template.group.backgrounds.length : 0,
      objectCount: Array.isArray(template.group?.items) ? template.group.items.length : 0
    }
  })
}

const prefixAssetId = (slug, assetId) => {
  const id = String(assetId || '').trim()
  if (!id) return null
  return `pc_${slug}_${id}`
}

const remapAppearanceByBackground = (source, remapId) => {
  if (!isRecord(source)) return undefined
  const entries = Object.entries(source).flatMap(([sourceId, timing]) => {
    const backgroundId = remapId(sourceId)
    return backgroundId ? [[backgroundId, timing]] : []
  })
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

const buildPublicCasePlayback = (root, templateId, locale = 'zh-Hant') => {
  const manifest = loadPublicCaseManifest(root)
  const template = findPublicCaseTemplate(manifest, templateId)
  if (!template) {
    throw new Error(`Public case template was not found: ${templateId}`)
  }

  const slug = String(template.slug || 'case').trim() || 'case'
  const remapId = (assetId) => prefixAssetId(slug, assetId)
  const assets = []

  for (const asset of template.assets || []) {
    const filePath = resolveInsideRoot(root, asset.path)
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Public case asset is missing: ${asset.assetId}`)
    }
    const extension = path.extname(filePath).toLowerCase()
    assets.push({
      assetId: remapId(asset.assetId),
      role: asset.role || 'item',
      name: asset.name,
      mediaType: asset.mediaType,
      mimeType: asset.mimeType || MIME_BY_EXTENSION[extension] || 'application/octet-stream',
      filePath,
      bundled: true
    })
  }

  const group = template.group || {}
  const backgrounds = (group.backgrounds || []).map((background) => ({
    assetId: remapId(background.assetId),
    name: background.name,
    mediaType: background.mediaType,
    mimeType: background.mimeType,
    bgmAudioId: remapId(background.bgmAudioId),
    backgroundTransition: background.backgroundTransition,
    backgroundTransitionDurationMs: background.backgroundTransitionDurationMs,
    appearance: background.appearance
  }))
  const audioLibrary = (group.audioLibrary || []).map((audio) => ({
    assetId: remapId(audio.assetId),
    name: audio.name,
    mediaType: 'audio',
    mimeType: audio.mimeType,
    durationMs: audio.durationMs
  }))
  const items = (group.items || []).map((item) => ({
    ...item,
    assetId: item.kind === 'bubble' ? null : remapId(item.assetId),
    imageAssetId: item.kind === 'bubble'
      ? remapId(item.imageAssetId || item.bubble?.imageAssetId)
      : null,
    audioId: remapId(item.audioId),
    backgroundIds: Array.isArray(item.backgroundIds)
      ? item.backgroundIds.map((backgroundId) => remapId(backgroundId)).filter(Boolean)
      : [],
    appearanceByBackground: remapAppearanceByBackground(item.appearanceByBackground, remapId)
  }))

  return {
    templateId: template.templateId,
    slug,
    group: {
      groupId: `public-case:${template.templateId}`,
      name: getPublicCaseName(template, locale),
      activeBackgroundId: remapId(group.activeBackgroundId) || backgrounds[0]?.assetId || null,
      backgrounds,
      backgroundPlayMode: group.backgroundPlayMode || 'fixed',
      backgroundIntervalMs: group.backgroundIntervalMs || 5000,
      backgroundPlaybackLoop: group.backgroundPlaybackLoop !== false,
      appearMode: group.appearMode || 'all',
      appearIntervalMs: group.appearIntervalMs || 800,
      appearAnimation: group.appearAnimation || 'none',
      backgroundTransition: group.backgroundTransition || 'none',
      backgroundTransitionDurationMs: group.backgroundTransitionDurationMs,
      backgroundTransitionDurations: group.backgroundTransitionDurations,
      audioLibrary,
      linkedAppearanceModelVersion: group.linkedAppearanceModelVersion,
      items
    },
    assets
  }
}

const resolvePublicCaseFile = (root, requestPath) => {
  const relativePath = String(requestPath || '').replace(/^\/public-cases\//, '')
  const filePath = resolveInsideRoot(root, relativePath)
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null
  const extension = path.extname(filePath).toLowerCase()
  return {
    filePath,
    mimeType: MIME_BY_EXTENSION[extension] || 'application/octet-stream'
  }
}

module.exports = {
  MIME_BY_EXTENSION,
  buildPublicCaseCatalog,
  buildPublicCasePlayback,
  isSafeRelativePath,
  loadPublicCaseManifest,
  resolveInsideRoot,
  resolvePublicCaseFile,
  resolvePublicCasesRoot
}
