import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const APP_URL = process.env.MAGICFLOOR_APP_URL || 'http://localhost:5175/'
const EDGE_PATH = process.env.MAGICFLOOR_EDGE_PATH
  || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SCREENSHOT_DIR = new URL('../test-artifacts/linkage/', import.meta.url)
const screenshotPath = (name) => fileURLToPath(new URL(name, SCREENSHOT_DIR))

const svgDataUrl = (label, color, width = 640, height = 640) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="${color}"/>
      <circle cx="${width / 2}" cy="${height * 0.42}" r="${Math.min(width, height) * 0.2}" fill="rgba(255,255,255,.72)"/>
      <text x="50%" y="82%" text-anchor="middle" font-family="Arial" font-size="${Math.min(width, height) * 0.14}" font-weight="700" fill="#17312b">${label}</text>
    </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const now = Date.now()
const makeMedia = (id, name, color, width = 640, height = 640) => ({
  id,
  name,
  type: 'image',
  mimeType: 'image/svg+xml',
  url: svgDataUrl(name, color, width, height),
  width,
  height,
  updatedAt: now
})

const previewBgm = {
  id: 'audio-preview-bgm',
  name: 'Preview BGM',
  type: 'audio',
  mimeType: 'audio/mpeg',
  url: 'data:audio/mpeg;base64,preview-bgm',
  durationMs: 120000,
  updatedAt: now
}

const backgrounds = [
  { ...makeMedia('bg-forest', 'Forest', '#8bc8a1', 1600, 900), bgmAudioId: previewBgm.id },
  makeMedia('bg-ocean', 'Ocean', '#79b9db', 1600, 900),
  makeMedia('bg-city', 'City', '#c4b2d7', 1600, 900)
]

const makeItem = ({ id, name, color, position, order, backgroundIds, linkedAppearance }) => ({
  id,
  name,
  media: makeMedia(`media-${id}`, name, color),
  position,
  gridIndex: order,
  scale: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
  animationMode: 'fixed',
  animationId: order + 1,
  clickAnimationIds: [1, 2, 3],
  moveMode: 'none',
  movePercent: 0,
  moveSpeed: 50,
  moveTrack: order % 3 === 0 ? 'top' : order % 3 === 1 ? 'middle' : 'bottom',
  targetMode: 'loop',
  backgroundIds,
  linkedAppearance,
  isVisible: true,
  order,
  createdAt: now + order,
  updatedAt: now + order
})

const group = {
  id: 'linkage-layout-group',
  name: 'Linkage Layout',
  thumbnail: makeMedia('group-thumbnail', 'A>B', '#d6e7a5', 960, 640),
  background: backgrounds[0],
  backgrounds,
  activeBackgroundId: backgrounds[0].id,
  backgroundPlayMode: 'fixed',
  backgroundIntervalMs: 5000,
  appearMode: 'all',
  appearIntervalMs: 800,
  appearAnimation: 'trackSlide',
  backgroundTransition: 'none',
  audioLibrary: [previewBgm],
  linkedAppearanceModelVersion: 3,
  items: [
    makeItem({
      id: 'item-a',
      name: 'Trigger A',
      color: '#f7ca72',
      position: { x: 0.23, y: 0.34 },
      order: 0,
      backgroundIds: ['bg-forest']
    }),
    makeItem({
      id: 'item-b',
      name: 'Controlled B',
      color: '#87cfe1',
      position: { x: 0.54, y: 0.42 },
      order: 1,
      backgroundIds: ['bg-ocean'],
      linkedAppearance: { triggerItemId: 'item-a', mode: 'showAfter', delayMs: 1200 }
    }),
    makeItem({
      id: 'item-c',
      name: 'Controlled C',
      color: '#d4a6d8',
      position: { x: 0.76, y: 0.66 },
      order: 2,
      backgroundIds: ['bg-city'],
      linkedAppearance: { triggerItemId: 'item-b', mode: 'hideAfter', delayMs: 800 }
    }),
    makeItem({
      id: 'item-d',
      name: 'Independent D',
      color: '#a9d586',
      position: { x: 0.38, y: 0.72 },
      order: 3,
      backgroundIds: ['bg-forest']
    })
  ],
  createdAt: now,
  updatedAt: now
}

const fakeUser = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'layout@example.com',
  email_confirmed_at: new Date(now - 86400000).toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { display_name: 'Layout Tester' },
  identities: [],
  created_at: new Date(now - 86400000).toISOString(),
  updated_at: new Date(now).toISOString()
}

const fakeSession = {
  access_token: 'layout-test-access-token',
  token_type: 'bearer',
  expires_in: 31536000,
  expires_at: Math.floor(Date.now() / 1000) + 31536000,
  refresh_token: 'layout-test-refresh-token',
  user: fakeUser
}

const viewports = [
  { name: 'ipad-air', width: 1024, height: 768 },
  { name: 'ipad-pro-12-9', width: 1366, height: 1024 }
]

const getLayoutMetrics = async (page) => page.evaluate(() => {
  const rect = (selector) => {
    const element = document.querySelector(selector)
    if (!(element instanceof HTMLElement)) return null
    const bounds = element.getBoundingClientRect()
    return {
      left: Math.round(bounds.left),
      top: Math.round(bounds.top),
      right: Math.round(bounds.right),
      bottom: Math.round(bounds.bottom),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    }
  }
  const overflowing = Array.from(document.querySelectorAll('.dynamic-link-trigger-modal *'))
    .filter((element) => element instanceof HTMLElement && element.scrollWidth > element.clientWidth + 1)
    .map((element) => ({
      className: element.className,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    }))
  const modal = document.querySelector('.dynamic-link-trigger-modal')
  const actions = document.querySelector('.dynamic-link-editor-actions')
  const modalBounds = modal?.getBoundingClientRect()
  const actionBounds = actions?.getBoundingClientRect()

  return {
    panel: rect('.dynamic-property-overlay-panel'),
    stage: rect('.dynamic-stage'),
    modal: rect('.dynamic-link-trigger-modal'),
    relationCards: document.querySelectorAll('.dynamic-linkage-relation-button').length,
    stagePaths: document.querySelectorAll('.dynamic-linkage-stage-overlay path').length,
    stageNodes: document.querySelectorAll('.dynamic-linkage-stage-node').length,
    crossBackgroundNote: Boolean(document.querySelector('.dynamic-link-background-note')),
    replacementWarning: Boolean(document.querySelector('.dynamic-link-replace-warning')),
    actionsWithinModal: Boolean(
      modalBounds
      && actionBounds
      && actionBounds.top >= modalBounds.top
      && actionBounds.bottom <= modalBounds.bottom
    ),
    overflowing
  }
})

await mkdir(SCREENSHOT_DIR, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE_PATH, headless: true })
const results = []

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true
    })
    await context.addInitScript(({ session, seededGroup }) => {
      const previewAudioInstances = []
      class PreviewAudioMock extends EventTarget {
        constructor(src = '') {
          super()
          this.src = src
          this.originalSrc = src
          this.paused = true
          this.preload = ''
          this.loop = false
          this.volume = 1
          this.playCalls = 0
          this.pauseCalls = 0
          previewAudioInstances.push(this)
        }

        play() {
          this.playCalls += 1
          return new Promise((resolve) => {
            setTimeout(() => {
              this.paused = false
              resolve()
            }, 75)
          })
        }

        pause() {
          this.pauseCalls += 1
          this.paused = true
        }

        removeAttribute(name) {
          if (name === 'src') this.src = ''
        }

        load() {}
      }
      Object.defineProperty(window, 'Audio', {
        configurable: true,
        writable: true,
        value: PreviewAudioMock
      })
      Object.defineProperty(window, '__previewAudioInstances', {
        configurable: true,
        value: previewAudioInstances
      })
      localStorage.setItem('magicfloor_supabase_auth_v1', JSON.stringify(session))
      localStorage.setItem('magicfloor_dynamic_groups_v1', JSON.stringify([seededGroup]))
      localStorage.setItem('magicfloor_network_settings_v1', JSON.stringify({
        wsIp: '127.0.0.1',
        dynamicPort: 8080,
        interactivePort: 11701,
        advancedFeaturesEnabled: true
      }))
      localStorage.setItem('magicfloor_app_locale_v1', 'zh-Hant')
    }, { session: fakeSession, seededGroup: group })

    const page = await context.newPage()
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeUser) })
    })
    await page.route('**/rest/v1/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route('http://127.0.0.1:*/**', async (route) => route.abort())

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
    await page.locator('.entry-choice-card.dynamic-choice-card').click()
    await page.locator('.dynamic-library-screen').waitFor({ state: 'visible', timeout: 12000 })
    await page.locator('[data-library-entity-id="linkage-layout-group"] .dynamic-library-icon-main').click()
    await page.locator('.dynamic-control-screen').waitFor({ state: 'visible', timeout: 12000 })
    await page.waitForTimeout(2200)

    const layerBadges = await page.locator('.dynamic-layer-link-badges').count()
    await page.screenshot({
      path: screenshotPath(`${viewport.name}-layers.png`),
      fullPage: true
    })
    await page.locator('[data-layer-item-id="item-a"] .dynamic-layer-property-button').click()
    await page.locator('.dynamic-property-overlay-panel').waitFor({ state: 'visible' })
    await page.locator('.dynamic-property-tab').nth(1).click()
    await page.locator('.dynamic-object-linkage-card').waitFor({ state: 'visible' })
    await page.screenshot({
      path: screenshotPath(`${viewport.name}-property.png`),
      fullPage: true
    })

    await page.locator('.dynamic-linkage-add-button').click()
    await page.locator('.dynamic-link-trigger-modal').waitFor({ state: 'visible' })
    await page.locator('.dynamic-link-trigger-list > button', { hasText: 'Controlled C' }).click()
    await page.locator('.dynamic-link-replace-warning').waitFor({ state: 'visible' })
    await page.locator('.dynamic-link-background-note').waitFor({ state: 'visible' })
    await page.waitForTimeout(200)
    const metrics = { ...(await getLayoutMetrics(page)), layerBadges }
    await page.screenshot({
      path: screenshotPath(`${viewport.name}-modal.png`),
      fullPage: true
    })

    await page.locator('.dynamic-link-trigger-modal .dynamic-panel-close').click()
    await page.locator('.preview-action.primary-button').click()
    await page.locator('.dynamic-control-screen.dynamic-previewing').waitFor({ state: 'visible' })
    await page.waitForTimeout(100)
    const previewItemCount = await page.locator('.dynamic-stage-item-motion').count()
    const controlledAppearance = page.locator('.dynamic-stage-item-motion').nth(1).locator('.dynamic-stage-item-appear')
    const chainedAppearance = page.locator('.dynamic-stage-item-motion').nth(2).locator('.dynamic-stage-item-appear')
    const controlledStartOpacity = Number(await controlledAppearance.evaluate((element) => (
      getComputedStyle(element).opacity
    )))
    await page.waitForTimeout(2300)
    const controlledEndOpacity = Number(await controlledAppearance.evaluate((element) => (
      getComputedStyle(element).opacity
    )))
    await page.waitForTimeout(1300)
    const chainedEndOpacity = Number(await chainedAppearance.evaluate((element) => (
      getComputedStyle(element).opacity
    )))
    const persistedControlledBackgroundIds = await page.evaluate(() => {
      const groups = JSON.parse(localStorage.getItem('magicfloor_dynamic_groups_v1') || '[]')
      return groups[0]?.items?.find((item) => item.id === 'item-b')?.backgroundIds ?? []
    })
    const previewOverlayCount = await page.locator('.dynamic-linkage-stage-overlay').count()
    const bgmWasPlaying = await page.evaluate(() => window.__previewAudioInstances
      .filter((audio) => audio.originalSrc.includes('preview-bgm'))
      .some((audio) => !audio.paused))
    await page.locator('.preview-stop-button').click()
    await page.locator('.dynamic-control-screen:not(.dynamic-previewing)').waitFor({ state: 'visible' })
    await page.waitForTimeout(220)
    const stableStopAudioState = await page.evaluate(() => window.__previewAudioInstances
      .filter((audio) => audio.originalSrc.includes('preview-bgm'))
      .map((audio) => ({ paused: audio.paused, src: audio.src, pauseCalls: audio.pauseCalls })))

    await page.locator('.preview-action.primary-button').click()
    await page.locator('.dynamic-control-screen.dynamic-previewing').waitFor({ state: 'visible' })
    await page.waitForTimeout(10)
    await page.locator('.preview-stop-button').click()
    await page.locator('.dynamic-control-screen:not(.dynamic-previewing)').waitFor({ state: 'visible' })
    await page.waitForTimeout(150)
    const immediateStopAudioState = await page.evaluate(() => window.__previewAudioInstances
      .filter((audio) => audio.originalSrc.includes('preview-bgm'))
      .map((audio) => ({ paused: audio.paused, src: audio.src, pauseCalls: audio.pauseCalls })))

    const modalWithinViewport = Boolean(
      metrics.modal
      && metrics.modal.left >= 0
      && metrics.modal.top >= 0
      && metrics.modal.right <= viewport.width
      && metrics.modal.bottom <= viewport.height
    )
    results.push({
      viewport,
      ...metrics,
      modalWithinViewport,
      previewItemCount,
      controlledStartOpacity,
      controlledEndOpacity,
      chainedEndOpacity,
      persistedControlledBackgroundIds,
      previewOverlayCount,
      bgmWasPlaying,
      stableStopAudioState,
      immediateStopAudioState
    })
    await context.close()
  }
} finally {
  await browser.close()
}

const failures = results.filter((result) => (
  !result.modalWithinViewport
  || result.relationCards < 1
  || result.layerBadges < 2
  || result.stageNodes < 2
  || !result.crossBackgroundNote
  || !result.replacementWarning
  || !result.actionsWithinModal
  || result.previewItemCount !== 4
  || result.controlledStartOpacity > 0.05
  || result.controlledEndOpacity < 0.95
  || result.chainedEndOpacity > 0.05
  || result.previewOverlayCount !== 0
  || JSON.stringify(result.persistedControlledBackgroundIds) !== JSON.stringify(['bg-ocean'])
  || !result.bgmWasPlaying
  || result.stableStopAudioState.length === 0
  || result.stableStopAudioState.some((audio) => !audio.paused || audio.src !== '' || audio.pauseCalls < 1)
  || result.immediateStopAudioState.length < 2
  || result.immediateStopAudioState.some((audio) => !audio.paused || audio.src !== '' || audio.pauseCalls < 1)
  || result.overflowing.length > 0
))

console.log(JSON.stringify(results, null, 2))
if (failures.length > 0) process.exitCode = 1
