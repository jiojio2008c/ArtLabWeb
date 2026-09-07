import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CASES = [
  {
    sourceName: '龜兔賽跑',
    templateId: 'magicfloor.tortoise-hare',
    slug: 'tortoise-hare',
    names: {
      zhHant: '龜兔賽跑',
      zhHans: '龟兔赛跑',
      en: 'The Tortoise and the Hare',
      pt: 'A Lebre e a Tartaruga',
      pl: 'Żółw i zając'
    }
  },
  {
    sourceName: '幼稚園頒獎典禮',
    templateId: 'magicfloor.kindergarten-awards',
    slug: 'kindergarten-awards',
    names: {
      zhHant: '幼稚園頒獎典禮',
      zhHans: '幼儿园颁奖典礼',
      en: 'Kindergarten Awards Ceremony',
      pt: 'Cerimónia de Prémios do Jardim de Infância',
      pl: 'Uroczystość wręczenia nagród w przedszkolu'
    }
  },
  {
    sourceName: '海底歷奇',
    templateId: 'magicfloor.undersea-adventure',
    slug: 'undersea-adventure',
    names: {
      zhHant: '海底歷奇',
      zhHans: '海底历奇',
      en: 'Undersea Adventure',
      pt: 'Aventura Submarina',
      pl: 'Podwodna przygoda'
    }
  },
  {
    sourceName: '城市交通',
    templateId: 'magicfloor.city-traffic',
    slug: 'city-traffic',
    names: {
      zhHant: '城市交通',
      zhHans: '城市交通',
      en: 'City Traffic',
      pt: 'Trânsito Urbano',
      pl: 'Ruch miejski'
    }
  },
  {
    sourceName: '非洲大草原',
    templateId: 'magicfloor.african-savanna',
    slug: 'african-savanna',
    names: {
      zhHant: '非洲大草原',
      zhHans: '非洲大草原',
      en: 'African Savanna',
      pt: 'Savana Africana',
      pl: 'Afrykańska sawanna'
    }
  }
]

const MIME_TYPES_BY_EXTENSION = {
  '.aac': 'audio/aac',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.m4a': 'audio/mp4',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.wav': 'audio/wav'
}

const ROLE_ORDER = { background: 0, item: 1, bubbleImage: 2, audio: 3 }

const parseArguments = () => {
  const result = {
    statePath: path.join(
      process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'),
      'magicfloor-dynamic-runtime',
      'runtime-data',
      'runtime-state.json'
    ),
    outputPath: path.resolve('public', 'dynamic-cases')
  }

  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index]
    if (argument === '--state') {
      result.statePath = path.resolve(process.argv[index + 1] ?? '')
      index += 1
    } else if (argument === '--output') {
      result.outputPath = path.resolve(process.argv[index + 1] ?? '')
      index += 1
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }

  return result
}

const getReferencedAssetIds = (group) => {
  const references = new Map()
  const add = (assetId, role, itemId = null) => {
    if (!assetId) return
    const current = references.get(assetId)
    if (!current || ROLE_ORDER[role] < ROLE_ORDER[current.role]) {
      references.set(assetId, { role, itemId })
    }
  }

  for (const background of group.backgrounds ?? []) {
    add(background.assetId, 'background')
    add(background.bgmAudioId, 'audio')
  }
  add(group.background?.assetId, 'background')
  add(group.background?.bgmAudioId, 'audio')

  for (const item of group.items ?? []) {
    add(item.assetId, 'item', item.itemId)
    add(item.imageAssetId, 'bubbleImage', item.itemId)
    add(item.bubble?.imageAssetId, 'bubbleImage', item.itemId)
    add(item.bubble?.image?.assetId, 'bubbleImage', item.itemId)
    add(item.bubble?.image?.id, 'bubbleImage', item.itemId)
    add(item.audioId, 'audio')
  }

  for (const audio of group.audioLibrary ?? []) add(audio.assetId, 'audio')

  return references
}

const getExtension = (asset) => {
  const sourceExtension = path.extname(asset.filePath ?? '').toLowerCase()
  if (sourceExtension) return sourceExtension === '.jpe' ? '.jpg' : sourceExtension

  const nameExtension = path.extname(asset.name ?? '').toLowerCase()
  if (nameExtension) return nameExtension === '.jpe' ? '.jpg' : nameExtension

  const mimeExtension = Object.entries(MIME_TYPES_BY_EXTENSION)
    .find(([, mimeType]) => mimeType === asset.mimeType)?.[0]
  if (mimeExtension) return mimeExtension

  throw new Error(`Unable to determine extension for asset ${asset.assetId}`)
}

const toPosixPath = (...segments) => segments.join('/')

const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

const assertManagedOutputPath = (outputPath) => {
  const resolvedOutput = path.resolve(outputPath)
  const expectedName = 'dynamic-cases'
  if (path.basename(resolvedOutput) !== expectedName) {
    throw new Error(`Output directory must end with ${expectedName}: ${resolvedOutput}`)
  }
  return resolvedOutput
}

const main = async () => {
  const { statePath, outputPath: requestedOutputPath } = parseArguments()
  const outputPath = assertManagedOutputPath(requestedOutputPath)
  if (!existsSync(statePath)) throw new Error(`Runtime state not found: ${statePath}`)

  const runtimeState = JSON.parse(await readFile(statePath, 'utf8'))
  await mkdir(outputPath, { recursive: true })

  const templates = []
  let totalBytes = 0

  for (const definition of CASES) {
    const matchingGroups = Object.values(runtimeState.groups ?? {})
      .filter((group) => group?.name === definition.sourceName)
      .sort((left, right) => {
        const revisionDifference = Number(right.stateRevision ?? 0) - Number(left.stateRevision ?? 0)
        return revisionDifference || Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0)
      })
    const group = matchingGroups[0]
    if (!group) throw new Error(`Public case not found: ${definition.sourceName}`)

    const casePath = path.join(outputPath, definition.slug)
    const assetsPath = path.join(casePath, 'assets')
    const resolvedCasePath = path.resolve(casePath)
    if (path.dirname(resolvedCasePath) !== outputPath) {
      throw new Error(`Unsafe case output path: ${resolvedCasePath}`)
    }

    await rm(resolvedCasePath, { recursive: true, force: true })
    await mkdir(assetsPath, { recursive: true })

    const assetReferences = getReferencedAssetIds(group)
    const exportedAssets = []

    for (const [assetId, reference] of [...assetReferences.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const asset = runtimeState.assets?.[assetId]
      if (!asset) throw new Error(`${definition.sourceName}: missing asset record ${assetId}`)
      if (!asset.filePath || !existsSync(asset.filePath)) {
        throw new Error(`${definition.sourceName}: missing asset file ${assetId}: ${asset.filePath ?? '(no path)'}`)
      }

      const extension = getExtension(asset)
      const fileName = `${assetId}${extension}`
      const destinationPath = path.join(assetsPath, fileName)
      const buffer = await readFile(asset.filePath)
      const digest = createHash('sha256').update(buffer).digest('hex')
      await copyFile(asset.filePath, destinationPath)

      const fileStats = await stat(destinationPath)
      const { filePath: _sourceFilePath, ...assetMetadata } = asset
      totalBytes += fileStats.size
      exportedAssets.push({
        ...assetMetadata,
        assetId,
        role: reference.role,
        itemId: reference.itemId,
        name: asset.name || fileName,
        mediaType: asset.mediaType || (reference.role === 'audio' ? 'audio' : 'image'),
        mimeType: asset.mimeType || MIME_TYPES_BY_EXTENSION[extension] || 'application/octet-stream',
        path: toPosixPath(definition.slug, 'assets', fileName),
        size: fileStats.size,
        sha256: digest
      })
    }

    const imageBackground = (group.backgrounds ?? [])
      .find((background) => background.mediaType === 'image' && assetReferences.has(background.assetId))
    const fallbackImage = exportedAssets.find((asset) => asset.mediaType === 'image')
    const posterAssetId = imageBackground?.assetId ?? fallbackImage?.assetId
    const posterAsset = exportedAssets.find((asset) => asset.assetId === posterAssetId)
    if (!posterAsset) throw new Error(`${definition.sourceName}: no image is available for a poster`)
    const posterExtension = path.extname(posterAsset.path)
    const posterFileName = `poster${posterExtension}`
    const posterPath = toPosixPath(definition.slug, posterFileName)
    await copyFile(
      path.join(outputPath, ...posterAsset.path.split('/')),
      path.join(casePath, posterFileName)
    )

    const template = {
      templateId: definition.templateId,
      version: 1,
      slug: definition.slug,
      names: definition.names,
      poster: `/dynamic-cases/${posterPath}`,
      posterPath,
      posterAssetId,
      source: {
        groupId: group.groupId,
        updatedAt: group.updatedAt ?? null,
        stateRevision: group.stateRevision ?? null
      },
      group: structuredClone(group),
      assets: exportedAssets
    }

    templates.push(template)
    await writeFile(path.join(casePath, 'template.json'), stableJson(template), 'utf8')
  }

  const manifest = {
    schemaVersion: 1,
    catalogVersion: 1,
    templates
  }
  await writeFile(path.join(outputPath, 'manifest.json'), stableJson(manifest), 'utf8')

  const megabytes = (totalBytes / 1024 / 1024).toFixed(2)
  console.log(`Exported ${templates.length} public cases to ${outputPath}`)
  for (const template of templates) {
    const bytes = template.assets.reduce((sum, asset) => sum + asset.size, 0)
    console.log(`- ${template.names.zhHant}: ${template.assets.length} assets, ${(bytes / 1024 / 1024).toFixed(2)} MiB`)
  }
  console.log(`Total media size: ${megabytes} MiB`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
