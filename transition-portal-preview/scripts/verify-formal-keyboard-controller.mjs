import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const APP_URL = process.env.MAGICFLOOR_APP_URL || 'http://localhost:5175/'
const EDGE_PATH = process.env.MAGICFLOOR_EDGE_PATH
  || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const ARTIFACT_DIR = new URL('../test-artifacts/formal-keyboard-controller/', import.meta.url)
const artifactPath = (name) => fileURLToPath(new URL(name, ARTIFACT_DIR))
const now = Date.now()
const fakeUser = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'keyboard-layout@example.com',
  email_confirmed_at: new Date(now - 86400000).toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { display_name: 'Keyboard Layout Tester' },
  identities: [],
  created_at: new Date(now - 86400000).toISOString(),
  updated_at: new Date(now).toISOString()
}
const fakeSession = {
  access_token: 'keyboard-layout-access-token',
  token_type: 'bearer',
  expires_in: 31536000,
  expires_at: Math.floor(Date.now() / 1000) + 31536000,
  refresh_token: 'keyboard-layout-refresh-token',
  user: fakeUser
}
const viewports = [
  { name: 'ipad-air', width: 1024, height: 768 },
  { name: 'ipad-pro-12-9', width: 1366, height: 1024 }
]

await mkdir(ARTIFACT_DIR, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE_PATH, headless: true })
const reports = []

try {
  for (const viewport of viewports) {
    const messages = []
    const browserErrors = []
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true
    })
    await context.addInitScript((session) => {
      localStorage.setItem('magicfloor_supabase_auth_v1', JSON.stringify(session))
      localStorage.setItem('magicfloor_network_settings_v1', JSON.stringify({
        wsIp: '127.0.0.1',
        dynamicPort: 8080,
        interactivePort: 11701,
        advancedFeaturesEnabled: true
      }))
      localStorage.setItem('magicfloor_app_locale_v1', 'zh-Hant')
    }, fakeSession)

    const page = await context.newPage()
    page.on('pageerror', (error) => browserErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text())
    })
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeUser) })
    })
    await page.route('**/rest/v1/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route('http://127.0.0.1:11701/**', async (route) => {
      messages.push(route.request().postData() || '')
      await route.fulfill({ status: 204, body: '' })
    })

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
    await page.locator('.entry-remote-keyboard-button').waitFor({ state: 'visible', timeout: 12000 })
    await page.locator('.entry-remote-keyboard-button').click()
    await page.locator('.remote-keyboard-device').waitFor({ state: 'visible', timeout: 12000 })
    await page.waitForTimeout(350)

    const metrics = await page.evaluate((viewportSize) => {
      const query = (selector) => {
        const element = document.querySelector(selector)
        if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`)
        return element
      }
      const rect = (element) => {
        const bounds = element.getBoundingClientRect()
        return {
          left: Math.round(bounds.left * 10) / 10,
          top: Math.round(bounds.top * 10) / 10,
          right: Math.round(bounds.right * 10) / 10,
          bottom: Math.round(bounds.bottom * 10) / 10,
          width: Math.round(bounds.width * 10) / 10,
          height: Math.round(bounds.height * 10) / 10,
          centerY: Math.round((bounds.top + bounds.height / 2) * 10) / 10
        }
      }
      const keys = Array.from(document.querySelectorAll('.remote-key'))
      const device = rect(query('.remote-keyboard-device'))
      const volume = rect(query('[data-control="volume"] .remote-knob'))
      const vertical = rect(query('[data-control="vertical"] .remote-knob'))
      const horizontal = rect(query('[data-control="horizontal"] .remote-knob'))
      const firstKey = rect(query('.remote-key'))
      const bottomLeftKey = rect(keys[12])
      const topLeftScrew = rect(query('.screw-top-left'))
      const bottomLeftScrew = rect(query('.screw-bottom-left'))
      const header = rect(query('.remote-keyboard-header'))

      return {
        viewport: viewportSize,
        device,
        ratio: Math.round((device.width / device.height) * 10000) / 10000,
        keyCount: keys.length,
        knobCount: document.querySelectorAll('.remote-knob').length,
        knobs: { volume, vertical, horizontal },
        firstKey,
        bottomLeftKey,
        topLeftScrew,
        bottomLeftScrew,
        header,
        deviceInsideViewport: device.left >= 0
          && device.top >= 0
          && device.right <= viewportSize.width
          && device.bottom <= viewportSize.height,
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
          || document.documentElement.scrollHeight > window.innerHeight + 1
      }
    }, { width: viewport.width, height: viewport.height })

    await page.screenshot({
      path: artifactPath(`${viewport.name}.png`),
      fullPage: true
    })

    const firstKey = page.locator('.remote-key').first()
    const keyBounds = await firstKey.boundingBox()
    if (!keyBounds) throw new Error('First key has no bounding box')
    await page.mouse.move(keyBounds.x + keyBounds.width / 2, keyBounds.y + keyBounds.height / 2)
    await page.mouse.down()
    const pressedDuringPointer = await firstKey.evaluate((element) => element.classList.contains('is-pressed'))
    await page.mouse.up()
    const releasedAfterPointer = await firstKey.evaluate((element) => !element.classList.contains('is-pressed'))

    const volumeKnob = page.locator('[data-control="volume"] .remote-knob')
    const knobBounds = await volumeKnob.boundingBox()
    if (!knobBounds) throw new Error('Volume knob has no bounding box')
    const angleBefore = await volumeKnob.evaluate((element) => element.style.getPropertyValue('--remote-knob-angle'))
    const centerX = knobBounds.x + knobBounds.width / 2
    const centerY = knobBounds.y + knobBounds.height / 2
    const radius = knobBounds.width * 0.34
    await page.mouse.move(centerX + radius, centerY)
    await page.mouse.down()
    await page.mouse.move(centerX, centerY + radius, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(90)
    const angleAfter = await volumeKnob.evaluate((element) => element.style.getPropertyValue('--remote-knob-angle'))

    const checks = {
      keyCount: metrics.keyCount === 16,
      knobCount: metrics.knobCount === 3,
      deviceRatio: Math.abs(metrics.ratio - 1.3485) <= 0.006,
      knobOrder: metrics.knobs.volume.centerY < metrics.knobs.vertical.centerY
        && metrics.knobs.vertical.centerY < metrics.knobs.horizontal.centerY,
      smallKnobsMatch: Math.abs(metrics.knobs.volume.width - metrics.knobs.vertical.width) <= 1,
      largeKnobScale: metrics.knobs.horizontal.width >= metrics.knobs.volume.width * 1.35,
      topScrewClearance: metrics.firstKey.top >= metrics.topLeftScrew.bottom + 2,
      bottomScrewClearance: metrics.bottomLeftKey.bottom <= metrics.bottomLeftScrew.top - 2,
      deviceInsideViewport: metrics.deviceInsideViewport,
      headerInsideViewport: metrics.header.top >= 0,
      noPageOverflow: !metrics.pageOverflow,
      keyPressFeedback: pressedDuringPointer && releasedAfterPointer,
      knobDragFeedback: angleBefore !== angleAfter,
      pressProtocol: messages.some((message) => message.includes('MF|RemoteKeyboard|Press|')),
      turnProtocol: messages.some((message) => message.includes('MF|RemoteKeyboard|Turn|')),
      noBrowserErrors: browserErrors.length === 0
    }
    const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name)
    reports.push({ viewport, metrics, interactions: { angleBefore, angleAfter }, messages, browserErrors, checks, failures })
    await context.close()
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify(reports, null, 2))
const failures = reports.flatMap((report) => report.failures.map((failure) => `${report.viewport.name}: ${failure}`))
if (failures.length > 0) throw new Error(`Formal keyboard controller checks failed:\n${failures.join('\n')}`)
