const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  buildPublicCaseCatalog,
  buildPublicCasePlayback,
  isSafeRelativePath,
  resolveInsideRoot,
  resolvePublicCaseFile,
  resolvePublicCasesRoot
} = require('./public-cases-core.cjs')

const runtimeDir = __dirname
const publicCasesRoot = resolvePublicCasesRoot({ isPackaged: false }, runtimeDir)

test('public case catalog loads the five bundled templates', () => {
  const catalog = buildPublicCaseCatalog(publicCasesRoot)
  assert.equal(catalog.length, 5)
  assert.deepEqual(catalog.map((item) => item.templateId), [
    'magicfloor.tortoise-hare',
    'magicfloor.kindergarten-awards',
    'magicfloor.undersea-adventure',
    'magicfloor.city-traffic',
    'magicfloor.african-savanna'
  ])
  catalog.forEach((item) => {
    assert.ok(item.name)
    assert.ok(item.posterPath)
    assert.ok(item.backgroundCount > 0)
    assert.ok(item.objectCount > 0)
    const poster = resolvePublicCaseFile(publicCasesRoot, `/public-cases/${item.posterPath}`)
    assert.ok(poster, `missing poster for ${item.templateId}`)
    assert.equal(fs.existsSync(poster.filePath), true)
  })
})

test('public case playback remaps assets onto local files', () => {
  const playback = buildPublicCasePlayback(publicCasesRoot, 'magicfloor.tortoise-hare')
  assert.equal(playback.group.groupId, 'public-case:magicfloor.tortoise-hare')
  assert.equal(playback.group.name, '龜兔賽跑')
  assert.ok(playback.group.backgrounds.length >= 1)
  assert.ok(playback.group.items.length >= 1)
  assert.ok(playback.assets.length >= playback.group.backgrounds.length)
  playback.assets.forEach((asset) => {
    assert.match(asset.assetId, /^pc_tortoise-hare_/)
    assert.equal(fs.existsSync(asset.filePath), true)
  })
  playback.group.backgrounds.forEach((background) => {
    assert.ok(playback.assets.some((asset) => asset.assetId === background.assetId))
  })
})

test('public case import persists copied media into IndexedDB for EXE sync', () => {
  const source = fs.readFileSync(path.join(runtimeDir, '..', 'src', 'services', 'publicCaseStorage.ts'), 'utf8')
  assert.match(source, /createPublicCaseImportAssetMap/)
  assert.match(source, /downloadPublicCaseAsset/)
  assert.match(source, /persistDynamicMedia\([\s\S]*preferIndexedDb:\s*true/)
  assert.match(source, /persistDynamicAudio\([\s\S]*preferIndexedDb:\s*true/)
  const storageSource = fs.readFileSync(path.join(runtimeDir, '..', 'src', 'services', 'dynamicArtStorage.ts'), 'utf8')
  assert.match(storageSource, /preferIndexedDb/)
  assert.match(storageSource, /XMLHttpRequest/)
})

test('public case file resolver rejects path traversal', () => {
  assert.equal(isSafeRelativePath('../secret.txt'), false)
  assert.equal(resolveInsideRoot(publicCasesRoot, '../package.json'), null)
  assert.equal(resolvePublicCaseFile(publicCasesRoot, '/public-cases/../package.json'), null)
})
