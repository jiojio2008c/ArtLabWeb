import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const APP_URL = process.env.MAGICFLOOR_APP_URL || 'http://localhost:5175/'
const EDGE_PATH = process.env.MAGICFLOOR_EDGE_PATH
  || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const ARTIFACT_DIR = new URL('../test-artifacts/formal-keyboard-controller/', import.meta.url)
const artifactPath = (name) => fileURLToPath(new URL(name, ARTIFACT_DIR))
const REMOTE_PRESS_PREFIX = 'MF|RemoteKeyboard|Press|'
const REMOTE_TURN_PREFIX = 'MF|RemoteKeyboard|Turn|'
const PRESET_8_KEYS = ['LeftControl', 'LeftAlt', 'Alpha8']

const parseTransform = (value) => {
  if (!value || value === 'none') return { scaleY: 1, translateY: 0 }
  const values = value
    .slice(value.indexOf('(') + 1, value.lastIndexOf(')'))
    .split(',')
    .map((part) => Number.parseFloat(part.trim()))
  if (value.startsWith('matrix3d')) {
    return { scaleY: values[5], translateY: values[13] }
  }
  return { scaleY: values[3], translateY: values[5] }
}

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
      const engraving = document.querySelector('.remote-device-engraving')
      const deviceText = query('.remote-keyboard-device').textContent || ''
      const brandLogo = query('[data-control="horizontal"] .remote-knob-brand-logo')
      const brandMetal = query('[data-control="horizontal"] .remote-knob-metal')
      const presetKey = query('.remote-key-preset')
      const presetNumber = query('.remote-key-preset .remote-key-mode-number')
      const presetLines = query('.remote-key-preset .remote-key-mode-lines')
      const presetTextFits = Array.from(document.querySelectorAll('.remote-key-preset')).every((key) => {
        const cap = key.querySelector('.remote-key-cap')
        const copy = key.querySelector('.remote-key-mode-copy')
        if (!(cap instanceof HTMLElement) || !(copy instanceof HTMLElement)) return false
        const capBounds = cap.getBoundingClientRect()
        const copyBounds = copy.getBoundingClientRect()
        return copyBounds.left >= capBounds.left - 1
          && copyBounds.right <= capBounds.right + 1
          && copyBounds.top >= capBounds.top - 1
          && copyBounds.bottom <= capBounds.bottom + 1
      })
      const brandLogoBounds = brandLogo.getBoundingClientRect()
      const brandMetalBounds = brandMetal.getBoundingClientRect()

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
        engravingCount: document.querySelectorAll('.remote-device-engraving').length,
        forbiddenEngravingTextPresent: /keyboard\s+(?:controlled|controller)/i.test(deviceText),
        brandLogoReady: brandLogo instanceof HTMLImageElement
          && brandLogo.complete
          && brandLogo.naturalWidth > 0,
        brandLogoWidth: Math.round(brandLogoBounds.width * 10) / 10,
        brandLogoHeight: Math.round(brandLogoBounds.height * 10) / 10,
        brandLogoWithinMetal: brandLogoBounds.left >= brandMetalBounds.left - 1
          && brandLogoBounds.right <= brandMetalBounds.right + 1
          && brandLogoBounds.top >= brandMetalBounds.top - 1
          && brandLogoBounds.bottom <= brandMetalBounds.bottom + 1,
        presetNumberFontSize: Number.parseFloat(getComputedStyle(presetNumber).fontSize),
        presetLinesFontSize: Number.parseFloat(getComputedStyle(presetLines).fontSize),
        presetTextFits,
        presetKeyWidth: rect(presetKey).width,
        deviceInsideViewport: device.left >= 0
          && device.top >= 0
          && device.right <= viewportSize.width
          && device.bottom <= viewportSize.height,
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
          || document.documentElement.scrollHeight > window.innerHeight + 1,
        engravingVisible: engraving instanceof HTMLElement
          && getComputedStyle(engraving).display !== 'none'
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

    const lastKeyMessageStart = messages.length
    await page.locator('.remote-key').nth(15).click()
    await page.waitForTimeout(90)
    const lastKeyPressMessage = messages
      .slice(lastKeyMessageStart)
      .find((message) => message.startsWith(REMOTE_PRESS_PREFIX))

    const largeKnob = page.locator('[data-control="horizontal"] .remote-knob')
    const centerButton = page.locator('[data-control="horizontal"] .remote-knob-center-button')
    const largeKnobBounds = await largeKnob.boundingBox()
    const centerBounds = await centerButton.boundingBox()
    if (!largeKnobBounds) throw new Error('Large knob has no bounding box')
    if (!centerBounds) throw new Error('Large knob center button has no bounding box')
    const largeKnobDiameter = await largeKnob.evaluate((element) => Number.parseFloat(getComputedStyle(element).width))
    const centerButtonDiameter = await centerButton.evaluate((element) => Number.parseFloat(getComputedStyle(element).width))
    const centerButtonDiameterRatio = centerButtonDiameter / largeKnobDiameter
    const largeKnobBody = largeKnob.locator('.remote-knob-body')
    const largeKnobBodyTransformBefore = await largeKnobBody.evaluate((element) => getComputedStyle(element).transform)
    const centerPressMessageStart = messages.length
    await page.mouse.move(
      centerBounds.x + centerBounds.width / 2,
      centerBounds.y + centerBounds.height / 2
    )
    await page.mouse.down()
    const largeKnobPressedDuringPointer = await largeKnob.evaluate((element) => element.classList.contains('is-pressed'))
    await page.waitForTimeout(40)
    const largeKnobBodyTransformDuring = await largeKnobBody.evaluate((element) => getComputedStyle(element).transform)
    await page.mouse.up()
    await page.waitForTimeout(90)
    const largeKnobReleasedAfterPointer = await largeKnob.evaluate((element) => !element.classList.contains('is-pressed'))
    const centerPressMessage = messages
      .slice(centerPressMessageStart)
      .find((message) => message.startsWith(REMOTE_PRESS_PREFIX))
    const parsePressKeys = (message) => {
      if (!message?.startsWith(REMOTE_PRESS_PREFIX)) return null
      try {
        return JSON.parse(message.slice(REMOTE_PRESS_PREFIX.length)).keys
      } catch {
        return null
      }
    }
    const lastKeyPressKeys = parsePressKeys(lastKeyPressMessage)
    const centerPressKeys = parsePressKeys(centerPressMessage)
    const largeKnobBodyBefore = parseTransform(largeKnobBodyTransformBefore)
    const largeKnobBodyDuring = parseTransform(largeKnobBodyTransformDuring)

    const outerRingMessageStart = messages.length
    const outerRingCenterX = largeKnobBounds.x + largeKnobBounds.width / 2
    const outerRingCenterY = largeKnobBounds.y + largeKnobBounds.height / 2
    const outerRingRadius = largeKnobDiameter * 0.43
    const largeKnobAngleBeforeOuterDrag = await largeKnob.evaluate((element) => element.style.getPropertyValue('--remote-knob-angle'))
    await page.mouse.move(outerRingCenterX + outerRingRadius, outerRingCenterY)
    await page.mouse.down()
    await page.mouse.move(outerRingCenterX, outerRingCenterY + outerRingRadius, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(90)
    const largeKnobAngleAfterOuterDrag = await largeKnob.evaluate((element) => element.style.getPropertyValue('--remote-knob-angle'))
    const outerRingMessages = messages.slice(outerRingMessageStart)
    const outerRingPressMessages = outerRingMessages.filter((message) => message.startsWith(REMOTE_PRESS_PREFIX))
    const outerRingHorizontalTurnMessages = outerRingMessages.filter((message) => {
      if (!message.startsWith(REMOTE_TURN_PREFIX)) return false
      try {
        return JSON.parse(message.slice(REMOTE_TURN_PREFIX.length)).control === 'horizontal'
      } catch {
        return false
      }
    })

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
      noDeviceEngraving: metrics.engravingCount === 0
        && !metrics.engravingVisible
        && !metrics.forbiddenEngravingTextPresent,
      largeKnobBrandLogo: metrics.brandLogoReady
        && metrics.brandLogoWidth > 0
        && metrics.brandLogoHeight > 0
        && metrics.brandLogoWithinMetal,
      presetTextScale: metrics.presetNumberFontSize >= 24
        && metrics.presetLinesFontSize >= 9.5,
      presetTextFits: metrics.presetTextFits,
      largeKnobCenterHitArea: centerButtonDiameterRatio >= 0.74
        && centerButtonDiameterRatio <= 0.78,
      keyPressFeedback: pressedDuringPointer && releasedAfterPointer,
      largeKnobCenterPressFeedback: largeKnobPressedDuringPointer && largeKnobReleasedAfterPointer,
      largeKnobCenterPressDepth: largeKnobBodyDuring.translateY > largeKnobBodyBefore.translateY + 0.5
        && largeKnobBodyDuring.scaleY < largeKnobBodyBefore.scaleY - 0.001,
      lastKeyPreset8Protocol: JSON.stringify(lastKeyPressKeys) === JSON.stringify(PRESET_8_KEYS),
      largeKnobCenterPreset8Protocol: JSON.stringify(centerPressKeys) === JSON.stringify(PRESET_8_KEYS),
      centerSignalMatchesLastKey: centerPressMessage === lastKeyPressMessage,
      largeKnobOuterRingNoPress: outerRingPressMessages.length === 0,
      largeKnobOuterRingTurn: largeKnobAngleBeforeOuterDrag !== largeKnobAngleAfterOuterDrag
        && outerRingHorizontalTurnMessages.length > 0,
      knobDragFeedback: angleBefore !== angleAfter,
      pressProtocol: messages.some((message) => message.includes('MF|RemoteKeyboard|Press|')),
      turnProtocol: messages.some((message) => message.includes('MF|RemoteKeyboard|Turn|')),
      noBrowserErrors: browserErrors.length === 0
    }
    const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name)
    reports.push({
      viewport,
      metrics,
      interactions: {
        angleBefore,
        angleAfter,
        largeKnobPressedDuringPointer,
        largeKnobReleasedAfterPointer,
        largeKnobBodyTransformBefore,
        largeKnobBodyTransformDuring,
        largeKnobBodyBefore,
        largeKnobBodyDuring,
        largeKnobDiameter,
        centerButtonDiameter,
        centerButtonDiameterRatio,
        outerRingRadius,
        largeKnobAngleBeforeOuterDrag,
        largeKnobAngleAfterOuterDrag,
        outerRingMessages,
        lastKeyPressMessage,
        centerPressMessage
      },
      messages,
      browserErrors,
      checks,
      failures
    })
    await context.close()
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify(reports, null, 2))
const failures = reports.flatMap((report) => report.failures.map((failure) => `${report.viewport.name}: ${failure}`))
if (failures.length > 0) throw new Error(`Formal keyboard controller checks failed:\n${failures.join('\n')}`)
