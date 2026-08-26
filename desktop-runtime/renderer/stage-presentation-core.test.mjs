import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  DEFAULT_STAGE_WATERMARK_ENABLED,
  DEFAULT_STAGE_WATERMARK_OPACITY,
  DESKTOP_STAGE_WATERMARK_ENABLED,
  configureHighQualityImageSmoothing,
  drawMagicFloorWatermarkPattern,
  drawStageWatermarkLayer
} from './stage-presentation-core.js'

const createRecordingContext = () => {
  const calls = []
  return {
    calls,
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    beginPath: () => calls.push(['beginPath']),
    rect: (...args) => calls.push(['rect', ...args]),
    clip: () => calls.push(['clip']),
    translate: (...args) => calls.push(['translate', ...args]),
    rotate: (...args) => calls.push(['rotate', ...args]),
    strokeText: (...args) => calls.push(['strokeText', ...args]),
    fillText: (...args) => calls.push(['fillText', ...args]),
    drawImage: (...args) => calls.push(['drawImage', ...args])
  }
}

test('stage image rendering explicitly requests high quality smoothing', () => {
  const renderContext = {}
  assert.equal(configureHighQualityImageSmoothing(renderContext), true)
  assert.equal(renderContext.imageSmoothingEnabled, true)
  assert.equal(renderContext.imageSmoothingQuality, 'high')
})

test('desktop watermark drawing is disabled while legacy settings remain available', () => {
  const renderContext = createRecordingContext()
  const drawCount = drawMagicFloorWatermarkPattern(renderContext, {
    width: 1920,
    height: 1080
  })

  assert.equal(DESKTOP_STAGE_WATERMARK_ENABLED, false)
  assert.equal(drawCount, 0)
  assert.equal(drawStageWatermarkLayer(renderContext, { id: 'watermark-layer' }, {
    enabled: true,
    stageActive: true,
    width: 1920,
    height: 1080
  }), false)
  assert.equal(renderContext.calls.length, 0)
  assert.equal(DEFAULT_STAGE_WATERMARK_ENABLED, true)
  assert.equal(DEFAULT_STAGE_WATERMARK_OPACITY, 0.44)
})

test('player never allocates or composites a watermark layer', () => {
  const playerSource = fs.readFileSync(new URL('./player.js', import.meta.url), 'utf8')
  assert.equal(playerSource.includes('watermarkCanvas'), false)
  assert.equal(playerSource.includes('watermarkContext'), false)
  assert.equal(playerSource.includes('drawMagicFloorWatermarkPattern'), false)
  assert.equal(playerSource.includes('drawStageWatermarkLayer'), false)
})

test('archive mirror keeps the home artwork visible behind contained iPad captures', () => {
  const playerSource = fs.readFileSync(new URL('./player.js', import.meta.url), 'utf8')
  const rendererStyles = fs.readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
  const archiveRule = rendererStyles.match(/\.archive-view\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  const sourceRule = rendererStyles.match(/\.archive-source-image\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  const mirrorRule = rendererStyles.match(/\.archive-mirror-image\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  const portalRules = Array.from(rendererStyles.matchAll(/\.archive-portal-canvas\s*\{([\s\S]*?)\}/g))
    .map((match) => match[1])
  const fallbackPortalSource = playerSource.match(/const drawArchivePortal = [\s\S]*?\n\}/)?.[0] ?? ''
  const desktopBackground = fs.readFileSync(new URL('./assets/magic-floor-background.webp', import.meta.url))
  const webBackground = fs.readFileSync(new URL('../../src/assets/magic-floor-background.webp', import.meta.url))

  assert.match(archiveRule, /url\("\.\/assets\/magic-floor-background\.webp"\)/)
  assert.match(archiveRule, /background-size:\s*cover/)
  assert.match(sourceRule, /object-fit:\s*contain/)
  assert.match(sourceRule, /background:\s*transparent/)
  assert.match(mirrorRule, /object-fit:\s*contain/)
  assert.match(mirrorRule, /background:\s*transparent/)
  assert.ok(portalRules.some((rule) => /background:\s*transparent/.test(rule)))
  assert.doesNotMatch(fallbackPortalSource, /fillRect\(0, 0, width, height\)/)
  assert.deepEqual(desktopBackground, webBackground)
})

test('archive captures send transparent stable foreground layers', () => {
  const archiveSyncSource = fs.readFileSync(
    new URL('../../src/services/dynamicArtArchiveSync.ts', import.meta.url),
    'utf8'
  )
  const webStyles = fs.readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')

  assert.match(archiveSyncSource, /import \{ toPng \} from 'html-to-image'/)
  assert.match(archiveSyncSource, /dataUrl = await toPng\(element, \{/)
  assert.doesNotMatch(archiveSyncSource, /\btoJpeg\b/)
  assert.doesNotMatch(archiveSyncSource, /\bbackgroundColor\s*:/)
  assert.doesNotMatch(archiveSyncSource, /\bquality\s*:/)
  assert.match(
    webStyles,
    /:is\(\.entry-screen, \.dynamic-library-screen\)\.dynamic-archive-snapshot-capture\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?background-image:\s*none !important;/
  )
  assert.match(
    webStyles,
    /\.dynamic-archive-snapshot-capture \*::after\s*\{[\s\S]*?backdrop-filter:\s*none !important;[\s\S]*?animation:\s*none !important;[\s\S]*?transition:\s*none !important;/
  )
})

test('archive return recreates hidden image layers using the frame version', () => {
  const playerSource = fs.readFileSync(new URL('./player.js', import.meta.url), 'utf8')
  const renderSource = playerSource.slice(
    playerSource.indexOf('const renderArchiveMirror ='),
    playerSource.indexOf('const setRuntimeViewMediaState =')
  )
  const snapshotLoaderSource = playerSource.slice(
    playerSource.indexOf('const loadArchiveMirrorSnapshot ='),
    playerSource.indexOf('const getArchivePortalOrigin =')
  )

  assert.match(renderSource, /snapshotFrameKey\s*=\s*snapshotDataUrl\s*\?\s*`\$\{replayId\}:\$\{snapshotCapturedAt\}`/)
  assert.match(renderSource, /mirror\.transition\s*===\s*'portal'[\s\S]*?mirror\.source\?\.dataUrl/)
  assert.match(renderSource, /if \(!archiveActive\) \{[\s\S]*?resetArchiveMediaLayers\(\)/)
  assert.match(renderSource, /loadArchiveMirrorSnapshot\(snapshotDataUrl, snapshotFrameKey\)/)
  assert.match(snapshotLoaderSource, /const nextImage = new Image\(\)/)
  assert.match(snapshotLoaderSource, /archiveMirrorImage\.replaceWith\(nextImage\)/)
  assert.doesNotMatch(renderSource, /snapshotDataUrl\s*!==\s*archiveMirrorImageUrl/)
})
