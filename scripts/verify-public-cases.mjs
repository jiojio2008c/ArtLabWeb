import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const PUBLIC_CASES_ROOT = path.resolve('public', 'dynamic-cases')
const MANIFEST_PATH = path.join(PUBLIC_CASES_ROOT, 'manifest.json')
const EXPECTED_TEMPLATES = new Map([
  ['magicfloor.tortoise-hare', 'tortoise-hare'],
  ['magicfloor.kindergarten-awards', 'kindergarten-awards'],
  ['magicfloor.undersea-adventure', 'undersea-adventure'],
  ['magicfloor.city-traffic', 'city-traffic'],
  ['magicfloor.african-savanna', 'african-savanna']
])

const failures = []
const fail = (message) => failures.push(message)
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const normalizeRelativePath = (value) => String(value ?? '').replace(/\\/g, '/')

const isSafeRelativePath = (value) => {
  const normalized = normalizeRelativePath(value)
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('//')) {
    return false
  }
  return !normalized.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
}

const resolveInsideRoot = (relativePath) => {
  const resolved = path.resolve(PUBLIC_CASES_ROOT, ...normalizeRelativePath(relativePath).split('/'))
  const relative = path.relative(PUBLIC_CASES_ROOT, resolved)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return undefined
  return resolved
}

const readJson = async (filePath, label) => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    fail(`${label} cannot be read as JSON: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

const assertFile = async (relativePath, label, expectedSize, expectedHash) => {
  if (!isSafeRelativePath(relativePath)) {
    fail(`${label} has an unsafe path: ${relativePath}`)
    return
  }

  const filePath = resolveInsideRoot(relativePath)
  if (!filePath) {
    fail(`${label} resolves outside public/dynamic-cases: ${relativePath}`)
    return
  }

  try {
    const fileStats = await stat(filePath)
    if (!fileStats.isFile()) {
      fail(`${label} is not a file: ${relativePath}`)
      return
    }
    if (Number.isFinite(expectedSize) && fileStats.size !== expectedSize) {
      fail(`${label} has size ${fileStats.size}; expected ${expectedSize}: ${relativePath}`)
    }
    if (expectedHash) {
      const digest = createHash('sha256').update(await readFile(filePath)).digest('hex')
      if (digest !== String(expectedHash).toLowerCase()) {
        fail(`${label} has an invalid SHA-256 digest: ${relativePath}`)
      }
    }
  } catch (error) {
    fail(`${label} is missing or unreadable: ${relativePath} (${error instanceof Error ? error.message : String(error)})`)
  }
}

const assertReference = (ids, value, label) => {
  if (value && !ids.has(value)) fail(`${label} references missing ID: ${value}`)
}

const validateTemplate = async (template, globalAssetIds) => {
  if (!isRecord(template)) {
    fail('Manifest contains a non-object template')
    return { assets: 0, bytes: 0 }
  }

  const templateId = String(template.templateId ?? '')
  const slug = String(template.slug ?? '')
  const label = templateId || slug || '(unnamed template)'
  if (EXPECTED_TEMPLATES.get(templateId) !== slug) {
    fail(`${label} does not match the expected template ID and slug`)
  }
  if (!isRecord(template.names) || !['zhHant', 'zhHans', 'en', 'pt', 'pl'].every((key) => String(template.names[key] ?? '').trim())) {
    fail(`${label} does not provide every supported localized name`)
  }
  if (!isRecord(template.group) || !Array.isArray(template.group.backgrounds) || !Array.isArray(template.group.items) || !Array.isArray(template.group.audioLibrary)) {
    fail(`${label} has an invalid group payload`)
    return { assets: 0, bytes: 0 }
  }
  if (!Array.isArray(template.assets)) {
    fail(`${label} has no asset list`)
    return { assets: 0, bytes: 0 }
  }

  const sourceText = JSON.stringify(template)
  if (/([a-zA-Z]:\\|file:\/\/|AppData|runtime-data)/i.test(sourceText) || sourceText.includes('filePath')) {
    fail(`${label} contains a local runtime path`)
  }

  const templateJsonPath = path.join(PUBLIC_CASES_ROOT, slug, 'template.json')
  const templateJson = await readJson(templateJsonPath, `${label} template.json`)
  if (templateJson && !isDeepStrictEqual(templateJson, template)) {
    fail(`${label} template.json does not match its manifest entry`)
  }

  const assetIds = new Set()
  const assetById = new Map()
  let totalBytes = 0
  for (const asset of template.assets) {
    if (!isRecord(asset) || !String(asset.assetId ?? '').trim()) {
      fail(`${label} contains invalid asset metadata`)
      continue
    }
    const assetId = String(asset.assetId)
    if (assetIds.has(assetId)) fail(`${label} contains duplicate asset ID: ${assetId}`)
    if (globalAssetIds.has(assetId)) fail(`Asset ID is reused across templates: ${assetId}`)
    assetIds.add(assetId)
    globalAssetIds.add(assetId)
    assetById.set(assetId, asset)

    const assetPath = normalizeRelativePath(asset.path)
    if (!assetPath.startsWith(`${slug}/assets/`)) {
      fail(`${label} asset is outside its template asset folder: ${assetPath}`)
    }
    if (!Number.isInteger(asset.size) || asset.size < 0) fail(`${label} asset has an invalid size: ${assetId}`)
    if (!/^[a-f0-9]{64}$/i.test(String(asset.sha256 ?? ''))) fail(`${label} asset has an invalid SHA-256 value: ${assetId}`)
    if (!['image', 'video', 'audio'].includes(asset.mediaType)) fail(`${label} asset has an invalid media type: ${assetId}`)
    totalBytes += Number.isFinite(asset.size) ? asset.size : 0
    await assertFile(assetPath, `${label} asset ${assetId}`, asset.size, asset.sha256)
  }

  const posterPath = normalizeRelativePath(template.posterPath)
  if (template.poster !== `/dynamic-cases/${posterPath}`) fail(`${label} poster URL does not match posterPath`)
  if (!posterPath.startsWith(`${slug}/poster.`)) fail(`${label} poster is outside its template folder`)
  await assertFile(posterPath, `${label} poster`)
  assertReference(assetIds, template.posterAssetId, `${label} poster`)

  const backgrounds = template.group.backgrounds
  const backgroundIds = new Set()
  for (const background of backgrounds) {
    if (!isRecord(background) || !String(background.assetId ?? '').trim()) {
      fail(`${label} contains an invalid background`)
      continue
    }
    if (backgroundIds.has(background.assetId)) fail(`${label} contains duplicate background: ${background.assetId}`)
    backgroundIds.add(background.assetId)
    assertReference(assetIds, background.assetId, `${label} background`)
    if (assetById.get(background.assetId)?.mediaType === 'audio') {
      fail(`${label} background references an audio asset: ${background.assetId}`)
    }
  }

  const audioIds = new Set()
  for (const audio of template.group.audioLibrary) {
    if (!isRecord(audio) || !String(audio.assetId ?? '').trim()) {
      fail(`${label} contains an invalid audio entry`)
      continue
    }
    if (audioIds.has(audio.assetId)) fail(`${label} contains duplicate audio: ${audio.assetId}`)
    audioIds.add(audio.assetId)
    assertReference(assetIds, audio.assetId, `${label} audio library`)
    if (assetById.get(audio.assetId)?.mediaType !== 'audio') {
      fail(`${label} audio library references a non-audio asset: ${audio.assetId}`)
    }
  }

  backgrounds.forEach((background) => assertReference(audioIds, background.bgmAudioId, `${label} background BGM`))
  assertReference(backgroundIds, template.group.activeBackgroundId, `${label} active background`)

  const itemIds = new Set()
  for (const item of template.group.items) {
    if (!isRecord(item) || !String(item.itemId ?? '').trim()) {
      fail(`${label} contains an invalid item`)
      continue
    }
    if (itemIds.has(item.itemId)) fail(`${label} contains duplicate item: ${item.itemId}`)
    itemIds.add(item.itemId)
  }

  for (const item of template.group.items) {
    if (!isRecord(item)) continue
    const itemLabel = `${label} item ${item.itemId ?? '(missing ID)'}`
    if (item.kind === 'bubble') {
      assertReference(assetIds, item.imageAssetId, `${itemLabel} image`)
      assertReference(assetIds, item.bubble?.imageAssetId, `${itemLabel} bubble image`)
      assertReference(assetIds, item.bubble?.image?.assetId, `${itemLabel} bubble image`)
      assertReference(assetIds, item.bubble?.image?.id, `${itemLabel} bubble image`)
    } else {
      assertReference(assetIds, item.assetId, `${itemLabel} media`)
      if (!item.assetId) fail(`${itemLabel} has no media asset`)
    }
    assertReference(audioIds, item.audioId, `${itemLabel} audio`)
    for (const backgroundId of item.backgroundIds ?? []) {
      assertReference(backgroundIds, backgroundId, `${itemLabel} background`)
    }
    for (const backgroundId of Object.keys(item.appearanceByBackground ?? {})) {
      assertReference(backgroundIds, backgroundId, `${itemLabel} appearance background`)
    }
    assertReference(itemIds, item.linkedAppearance?.triggerItemId, `${itemLabel} linked appearance`)
  }

  return { assets: assetIds.size, bytes: totalBytes }
}

const main = async () => {
  const manifest = await readJson(MANIFEST_PATH, 'Public case manifest')
  if (!manifest) throw new Error('Public case verification failed')
  if (!isRecord(manifest) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.templates)) {
    throw new Error('Public case manifest has an unsupported schema')
  }

  const actualTemplateIds = new Set(manifest.templates.map((template) => template?.templateId))
  if (manifest.templates.length !== EXPECTED_TEMPLATES.size) {
    fail(`Manifest contains ${manifest.templates.length} templates; expected ${EXPECTED_TEMPLATES.size}`)
  }
  for (const templateId of EXPECTED_TEMPLATES.keys()) {
    if (!actualTemplateIds.has(templateId)) fail(`Manifest is missing expected template: ${templateId}`)
  }

  const globalAssetIds = new Set()
  let assetCount = 0
  let totalBytes = 0
  for (const template of manifest.templates) {
    const result = await validateTemplate(template, globalAssetIds)
    assetCount += result.assets
    totalBytes += result.bytes
  }

  if (failures.length > 0) {
    failures.forEach((message) => console.error(`- ${message}`))
    throw new Error(`Public case verification failed with ${failures.length} issue(s)`)
  }

  console.log(`Verified ${manifest.templates.length} public cases, ${assetCount} assets, ${(totalBytes / 1024 / 1024).toFixed(2)} MB.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
