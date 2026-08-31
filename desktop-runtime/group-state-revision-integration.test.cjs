const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const runtimeDir = __dirname
const mainSource = fs.readFileSync(path.join(runtimeDir, 'main.js'), 'utf8')
const playerSource = fs.readFileSync(path.join(runtimeDir, 'renderer', 'player.js'), 'utf8')
const rendererHtml = fs.readFileSync(path.join(runtimeDir, 'renderer', 'index.html'), 'utf8')
const rendererStyles = fs.readFileSync(path.join(runtimeDir, 'renderer', 'styles.css'), 'utf8')

test('desktop runtime persists group revision tombstones', () => {
  assert.match(mainSource, /groupStateRevisions:\s*\{\}/)
  assert.match(mainSource, /runtimeState\.groupStateRevisions\[eventGroupId\]\s*=\s*Number\(payload\.stateRevision\)/)
  assert.match(mainSource, /groupStateRevisions:\s*runtimeState\.groupStateRevisions/)
})

test('stale full-state selections are cached without replacing the active stage', () => {
  assert.match(mainSource, /DYNAMIC_FULL_STATE_EVENTS\.has\(eventName\)\s*&&\s*!selectionAccepted/)
  assert.match(mainSource, /\?\s*'GroupStateCached'\s*:\s*eventName/)
  assert.match(mainSource, /const activatesGroup = eventName === 'GroupSelectAndSync' && selectionAccepted/)
  assert.match(mainSource, /if \(activatesGroup\) \{[\s\S]*?runtimeState\.view\.mode = 'stage'/)
})

test('state caching, stage standby, and preview activation remain separate', () => {
  const fullStateSource = mainSource.slice(
    mainSource.indexOf("case 'GroupSelectAndSync':"),
    mainSource.indexOf("case 'GroupAppearMode':")
  )
  const previewSource = mainSource.slice(
    mainSource.indexOf("case 'PreviewMode':"),
    mainSource.indexOf("case 'BackgroundSet':")
  )

  assert.match(fullStateSource, /eventName === 'GroupSelectAndSync'/)
  assert.match(fullStateSource, /runtimeState\.preview\.enabled = false/)
  assert.doesNotMatch(fullStateSource, /eventName === 'GroupStateSync'[\s\S]*?setActiveGroup/)
  assert.match(previewSource, /(?:enabled:\s*Boolean\(payload\.enabled\)|const previewEnabled = Boolean\(payload\.enabled\)[\s\S]*?enabled:\s*previewEnabled)/)
  assert.match(playerSource, /const getPreviewPresentationKey = \(\) =>/)
  assert.match(playerSource, /if \(preview\.enabled !== true \|\| isArchiveView\(\)\) return ''/)
  assert.match(playerSource, /displayRoot\?\.classList\.toggle\('is-stage-standby', standbyActive\)/)
  assert.match(rendererHtml, /id="stageStandby"/)
  assert.match(rendererHtml, /src="\.\/assets\/Right_Logo\.png"/)
  assert.match(rendererStyles, /\.stage-standby\s*\{[\s\S]*?magic-floor-background\.webp/)
  assert.match(rendererStyles, /\.stage-standby-logo\s*\{[\s\S]*?object-fit:\s*contain/)
})

test('metadata-only state syncs preserve asset URL revisions', () => {
  const metadataSource = mainSource.slice(
    mainSource.indexOf('const upsertAssetMetadata ='),
    mainSource.indexOf('const upsertItemAssetMetadata =')
  )
  const uploadSource = mainSource.slice(
    mainSource.indexOf('const handleUpload ='),
    mainSource.indexOf('const writeCorsHeaders =')
  )

  assert.match(metadataSource, /updatedAt:\s*metadata\.updatedAt[\s\S]*?previous\?\.updatedAt[\s\S]*?Date\.now\(\)/)
  assert.match(uploadSource, /const bytesChanged =/)
  assert.match(uploadSource, /updatedAt:\s*bytesChanged[\s\S]*?Date\.now\(\)[\s\S]*?existingAsset\.updatedAt/)
})

test('desktop preview applies independent timing and target-arrival hiding', () => {
  assert.match(mainSource, /appearanceDelayMs:/)
  assert.match(mainSource, /appearanceHideMs:/)
  assert.match(mainSource, /hideAfterTarget:/)
  assert.match(playerSource, /sampleTargetMotionState\(/)
  assert.match(playerSource, /hideAfterTarget:\s*item\.hideAfterTarget === true/)
  assert.match(playerSource, /alpha:\s*targetHidden \? 0/)
  assert.match(playerSource, /interactive:\s*!targetHidden && appearanceSample\.interactive/)
})

test('item motion keeps explicit active-background timing over legacy fields', () => {
  const motionSource = mainSource.slice(
    mainSource.indexOf("case 'ItemMotion':"),
    mainSource.indexOf("case 'ItemSettingsCopy':")
  )
  assert.match(motionSource, /const hasAppearanceByBackground = Object\.prototype\.hasOwnProperty\.call\(payload, 'appearanceByBackground'\)/)
  assert.match(motionSource, /const hasBackgroundTiming = Boolean\([\s\S]*?hasOwnProperty\.call\(item\.appearanceByBackground, appearanceBackgroundId\)/)
  assert.match(motionSource, /if \(!hasAppearanceByBackground \|\| !hasBackgroundTiming\) \{/)
})

test('desktop background transitions draw the shared MagicFloor logo', () => {
  assert.match(playerSource, /transitionLogo\.element\.src = '\.\/assets\/Right_Logo\.png'/)
  assert.match(playerSource, /const drawTransitionLogo = \(renderContext, transition\) =>/)
  assert.match(playerSource, /if \(transition\.type === 'cameraFlash'\)[\s\S]*?brightness\(0\.18\)/)
  assert.match(playerSource, /drawTransitionLogo\(renderContext, transition\)/)
})

test('receiver sync queue only clears its own promise', () => {
  const receiverSource = fs.readFileSync(
    path.join(runtimeDir, '..', 'src', 'services', 'dynamicArtReceiverSync.ts'),
    'utf8'
  )
  assert.match(receiverSource, /inFlightSyncs\.get\(syncKey\)\s*===\s*syncPromise/)
})

test('control entry uses one revision-owning full-state sync path', () => {
  const controlSource = fs.readFileSync(
    path.join(runtimeDir, '..', 'src', 'components', 'DynamicControlPage.tsx'),
    'utf8'
  )
  const receiverSource = fs.readFileSync(
    path.join(runtimeDir, '..', 'src', 'services', 'dynamicArtReceiverSync.ts'),
    'utf8'
  )

  assert.doesNotMatch(
    controlSource,
    /useEffect\(\(\) => \{\s*if \(transitionPreparing\) return\s*sendGroupStateSync\(group\)/
  )
  assert.doesNotMatch(receiverSource, /if \(!hasGroupAssets\(groupSnapshot\)\) return false/)
  assert.match(
    receiverSource,
    /if \(!syncNeed\.assets && !syncNeed\.state\) \{[\s\S]*?'GroupSelectAndSync'[\s\S]*?return false/
  )
})

test('queued group selections keep the user-action revision order', () => {
  const receiverSource = fs.readFileSync(
    path.join(runtimeDir, '..', 'src', 'services', 'dynamicArtReceiverSync.ts'),
    'utf8'
  )
  const syncSource = receiverSource.slice(
    receiverSource.indexOf('const syncDynamicGroupToReceiver ='),
    receiverSource.indexOf('\nexport type { SyncStatus }')
  )
  const selectionIndex = syncSource.indexOf('const selectionRevision = reserveDynamicSelectionRevision()')
  const queueIndex = syncSource.indexOf('const syncPromise = (async () => {')
  const waitIndex = syncSource.indexOf('await previousSync')
  const payloadIndex = syncSource.indexOf('const syncPayload = buildGroupSyncPayload(')

  assert.ok(selectionIndex >= 0 && selectionIndex < queueIndex)
  assert.ok(waitIndex > queueIndex && payloadIndex > waitIndex)
  assert.match(
    syncSource.slice(payloadIndex, syncSource.indexOf('const stateRevision', payloadIndex)),
    /\{ selectionRevision \}/
  )
})

test('stale uploads are rejected before file or runtime mutations', () => {
  const uploadSource = mainSource.slice(
    mainSource.indexOf('const handleUpload ='),
    mainSource.indexOf('const writeCorsHeaders =')
  )
  const gateIndex = uploadSource.indexOf('if (!shouldUpdateGroup)')
  const writeIndex = uploadSource.indexOf('fs.writeFileSync(filePath, file.data)')
  const assetIndex = uploadSource.indexOf('runtimeState.assets[assetId] = asset')
  const ensureIndex = uploadSource.indexOf('const group = ensureGroup(groupId)')

  assert.ok(gateIndex >= 0)
  assert.ok(writeIndex > gateIndex)
  assert.ok(assetIndex > gateIndex)
  assert.ok(ensureIndex > gateIndex)
})

test('iPad preview syncs remotely while current-stage playback stays local', () => {
  const controlSource = fs.readFileSync(
    path.join(runtimeDir, '..', 'src', 'components', 'DynamicControlPage.tsx'),
    'utf8'
  )
  const receiverSyncSource = controlSource.slice(
    controlSource.indexOf('const startPreviewReceiverSync'),
    controlSource.indexOf('const setPreviewModeEnabled')
  )
  const previewEntrySource = controlSource.slice(
    controlSource.indexOf('const setPreviewModeEnabled'),
    controlSource.indexOf('const resolveStageItemIdAtPoint')
  )
  assert.doesNotMatch(previewEntrySource, /await\s+syncDynamicGroupToReceiver/)
  assert.doesNotMatch(previewEntrySource, /sendPreviewModeState\(true/)
  assert.match(
    previewEntrySource,
    /startPreviewReceiverSync\(requestId, replayId, options\.backgroundPlayMode(?:,\s*targetBackgroundId)?\)/
  )
  assert.match(
    receiverSyncSource,
    /syncDynamicGroupToReceiver\([\s\S]*?\.then\([\s\S]*?sendPreviewModeState\(true,\s*\{ replayId, backgroundPlayMode, backgroundId \}\)/
  )
  assert.match(
    receiverSyncSource,
    /previewReplayIdRef\.current !== replayId\s*\|\| !previewModeRef\.current/
  )
  assert.match(
    previewEntrySource,
    /setStagePlaybackEnabled\(true,\s*\{\s*backgroundId: selectedBackground\.id\s*\}\)/
  )
  const stagePlaybackSource = previewEntrySource.slice(
    previewEntrySource.indexOf('const setStagePlaybackEnabled'),
    previewEntrySource.indexOf('const handleCurrentBackgroundPlayback')
  )
  assert.match(stagePlaybackSource, /setStagePlaybackActive\(true\)/)
  assert.doesNotMatch(stagePlaybackSource, /startPreviewReceiverSync|sendPreviewModeState/)
  assert.doesNotMatch(previewEntrySource, /updateDynamicBackgroundPlayback/)
  assert.match(controlSource, /backgroundPlaybackLoop:\s*options\.backgroundPlaybackLoop\s*\?\?\s*previewGroup\.backgroundPlaybackLoop\s*\?\?\s*true/)
  assert.match(controlSource, /getDynamicBackgroundPlaybackIndexAtCycle\(/)
  assert.match(controlSource, /if \(!playbackLoop && nextCycle >= roundLength\) return/)
  assert.match(controlSource, /if \(playbackLoop \|\| cycle < roundLength - 1\)/)
  assert.match(controlSource, /PREVIEW_RECEIVER_SYNC_TIMEOUT_MS/)
})

test('async receiver requests have finite XMLHttpRequest timeouts', () => {
  const bridgeSource = fs.readFileSync(
    path.join(runtimeDir, '..', 'src', 'services', 'unityBridge.ts'),
    'utf8'
  )
  assert.match(bridgeSource, /const UNITY_ASYNC_REQUEST_TIMEOUT_MS = 15000/)
  assert.equal(
    (bridgeSource.match(/xhr\.timeout = UNITY_ASYNC_REQUEST_TIMEOUT_MS/g) ?? []).length,
    2
  )
})

test('background deletion clears deleted scopes in the desktop cache', () => {
  const deleteSource = mainSource.slice(
    mainSource.indexOf("case 'BackgroundDelete':"),
    mainSource.indexOf("case 'BackgroundPlayback':")
  )
  assert.match(deleteSource, /backgroundIds:\s*Array\.isArray\(item\.backgroundIds\)/)
  assert.match(deleteSource, /filter\(\(backgroundId\) => !deleteIds\.has\(backgroundId\)\)/)
})

test('desktop background playback preserves loop policy and finite completion', () => {
  const fullStateSource = mainSource.slice(
    mainSource.indexOf("case 'GroupSelectAndSync':"),
    mainSource.indexOf("case 'GroupAppearMode':")
  )
  const previewSource = mainSource.slice(
    mainSource.indexOf("case 'PreviewMode':"),
    mainSource.indexOf("case 'BackgroundSet':")
  )
  const playbackSource = mainSource.slice(
    mainSource.indexOf("case 'BackgroundPlayback':"),
    mainSource.indexOf("case 'ItemCreate':")
  )

  assert.match(fullStateSource, /group\.backgroundPlaybackLoop\s*=\s*normalizeBackgroundPlaybackLoop/)
  assert.match(previewSource, /backgroundPlaybackLoop:\s*normalizeBackgroundPlaybackLoop/)
  assert.match(playbackSource, /payload\.backgroundPlaybackLoop/)
  assert.match(playerSource, /backgroundPlaybackLoop/)
  assert.match(playerSource, /playbackComplete:\s*true/)
  assert.match(playerSource, /nextBackground:\s*null,[\s\S]*?playbackComplete:\s*true/)
})

test('preview target backgrounds stay transient and drive desktop playback', () => {
  const previewSource = mainSource.slice(
    mainSource.indexOf("case 'PreviewMode':"),
    mainSource.indexOf("case 'BackgroundSet':")
  )
  assert.match(
    previewSource,
    /backgroundId:\s*previewEnabled\s*[\s\S]*?resolvePreviewBackgroundId\(previewGroup, payload\.backgroundId\)/
  )
  assert.match(mainSource, /const resolvePreviewBackgroundId = \(group, backgroundId\) =>/)
  assert.match(mainSource, /const clearPreviewTargetBackground = \(\) => \{[\s\S]*?backgroundId = null/)
  assert.match(
    mainSource,
    /case 'GroupSelect':\s*\{[\s\S]*?previousActiveGroupId[\s\S]*?clearPreviewTargetBackground\(\)/
  )

  assert.match(playerSource, /const getPreviewBackgroundId = \(group, preview = runtimeState\.preview\) =>/)
  assert.match(
    playerSource,
    /const activeIndex = getDynamicBackgroundPlaybackStartIndex\(\s*backgrounds,\s*previewBackgroundId,\s*'fixed'\s*\)/
  )
  assert.match(
    playerSource,
    /const playbackStartIndex = getDynamicBackgroundPlaybackStartIndex\(\s*backgrounds,\s*previewBackgroundId,\s*mode\s*\)/
  )
  assert.match(
    playerSource,
    /getPreviewPresentationKey = \(\) => \{[\s\S]*?preview\.backgroundId/
  )
  assert.match(
    playerSource,
    /const key = `\$\{preview\.enabled\}:\$\{preview\.replayId\}:\$\{preview\.groupId\}:\$\{String\(preview\.backgroundId/
  )
})

test('archive return accepts a newer capture even when the PNG data is identical', () => {
  const returnSource = mainSource.slice(
    mainSource.indexOf("case 'ArchiveReturn':"),
    mainSource.indexOf("case 'ArchiveSnapshot':")
  )
  const snapshotSource = mainSource.slice(
    mainSource.indexOf("case 'ArchiveSnapshot':"),
    mainSource.indexOf("case 'GroupCreate':")
  )

  assert.match(returnSource, /runtimeState\.view\.mirror\.capturedAt\s*=\s*0/)
  assert.doesNotMatch(returnSource, /clearArchiveSnapshot\(\)/)
  assert.match(
    snapshotSource,
    /duplicateReplay\s*&&\s*capturedAt\s*<=\s*runtimeState\.view\.mirror\.capturedAt/
  )
  assert.doesNotMatch(
    snapshotSource,
    /runtimeState\.view\.mirror\.snapshotDataUrl\s*===\s*snapshotDataUrl/
  )
})
