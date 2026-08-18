import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const APP_URL = process.env.KEYBOARD_PREVIEW_URL || 'http://localhost:5188/?prototype=keyboard'
const EDGE_PATH = process.env.MAGICFLOOR_EDGE_PATH
  || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const ARTIFACT_DIR = new URL('../test-artifacts/keyboard-controller/', import.meta.url)
const artifactPath = (name) => fileURLToPath(new URL(name, ARTIFACT_DIR))
const viewports = [
  { name: 'ipad-air', width: 1024, height: 768 },
  { name: 'ipad-pro-12-9', width: 1366, height: 1024 }
]

const roundedRect = (element) => {
  const bounds = element.getBoundingClientRect()
  return {
    left: Math.round(bounds.left * 10) / 10,
    top: Math.round(bounds.top * 10) / 10,
    right: Math.round(bounds.right * 10) / 10,
    bottom: Math.round(bounds.bottom * 10) / 10,
    width: Math.round(bounds.width * 10) / 10,
    height: Math.round(bounds.height * 10) / 10,
    centerX: Math.round((bounds.left + bounds.width / 2) * 10) / 10,
    centerY: Math.round((bounds.top + bounds.height / 2) * 10) / 10
  }
}

await mkdir(ARTIFACT_DIR, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE_PATH, headless: true })
const reports = []

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true
    })
    const page = await context.newPage()
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await page.locator('.kp-device-reference').waitFor({ state: 'visible' })

    const initial = await page.evaluate((viewportSize) => {
      const device = document.querySelector('.kp-device')
      const volume = document.querySelector('[data-knob="volume"] .kp-knob-touch')
      const vertical = document.querySelector('[data-knob="vertical"] .kp-knob-touch')
      const horizontal = document.querySelector('[data-knob="horizontal"] .kp-knob-touch')
      const firstKey = document.querySelector('.kp-key')
      const bottomLeftKey = document.querySelectorAll('.kp-key')[12]
      const topLeftScrew = document.querySelector('.kp-screw-top-left')
      const bottomLeftScrew = document.querySelector('.kp-screw-bottom-left')
      if (!(device instanceof HTMLElement)
        || !(volume instanceof HTMLElement)
        || !(vertical instanceof HTMLElement)
        || !(horizontal instanceof HTMLElement)
        || !(firstKey instanceof HTMLElement)
        || !(bottomLeftKey instanceof HTMLElement)
        || !(topLeftScrew instanceof HTMLElement)
        || !(bottomLeftScrew instanceof HTMLElement)) {
        throw new Error('Keyboard controller geometry is unavailable')
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
          centerX: Math.round((bounds.left + bounds.width / 2) * 10) / 10,
          centerY: Math.round((bounds.top + bounds.height / 2) * 10) / 10
        }
      }

      const deviceRect = rect(device)
      const knobRects = {
        volume: rect(volume),
        vertical: rect(vertical),
        horizontal: rect(horizontal)
      }
      const overflowing = Array.from(document.querySelectorAll('.keyboard-prototype-page *'))
        .filter((element) => element instanceof HTMLElement
          && element.scrollWidth > element.clientWidth + 2
          && getComputedStyle(element).overflowX === 'visible')
        .map((element) => element.className)

      return {
        viewport: viewportSize,
        layout: device.dataset.layout,
        device: deviceRect,
        ratio: Math.round((deviceRect.width / deviceRect.height) * 10000) / 10000,
        keyCount: document.querySelectorAll('.kp-key').length,
        knobCount: document.querySelectorAll('.kp-knob-touch').length,
        knobs: knobRects,
        firstKey: rect(firstKey),
        bottomLeftKey: rect(bottomLeftKey),
        topLeftScrew: rect(topLeftScrew),
        bottomLeftScrew: rect(bottomLeftScrew),
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
          || document.documentElement.scrollHeight > window.innerHeight + 1,
        deviceInsideViewport: deviceRect.left >= 0
          && deviceRect.right <= viewportSize.width
          && deviceRect.top >= 0
          && deviceRect.bottom <= viewportSize.height,
        overflowing
      }
    }, { width: viewport.width, height: viewport.height })

    const firstKey = page.locator('.kp-key').first()
    const keyBounds = await firstKey.boundingBox()
    if (!keyBounds) throw new Error('First key has no bounding box')
    await page.mouse.move(keyBounds.x + keyBounds.width / 2, keyBounds.y + keyBounds.height / 2)
    await page.mouse.down()
    const pressedDuringPointer = await firstKey.evaluate((element) => element.classList.contains('is-pressed'))
    await page.mouse.up()
    const releasedAfterPointer = await firstKey.evaluate((element) => !element.classList.contains('is-pressed'))

    const volume = page.locator('[data-knob="volume"] .kp-knob-touch')
    const dial = volume.locator('.kp-knob-dial')
    const knobBounds = await volume.boundingBox()
    if (!knobBounds) throw new Error('Volume knob has no bounding box')
    const angleBefore = await dial.evaluate((element) => getComputedStyle(element).getPropertyValue('--kp-knob-angle').trim())
    const centerX = knobBounds.x + knobBounds.width / 2
    const centerY = knobBounds.y + knobBounds.height / 2
    const radius = knobBounds.width * 0.34
    await page.mouse.move(centerX + radius, centerY)
    await page.mouse.down()
    await page.mouse.move(centerX, centerY + radius, { steps: 8 })
    await page.mouse.up()
    const angleAfter = await dial.evaluate((element) => getComputedStyle(element).getPropertyValue('--kp-knob-angle').trim())

    await page.screenshot({
      path: artifactPath(`${viewport.name}-reference.png`),
      fullPage: true
    })

    await page.getByRole('button', { name: '當前版' }).click()
    await page.locator('.kp-device-current').waitFor({ state: 'visible' })
    await page.screenshot({
      path: artifactPath(`${viewport.name}-current.png`),
      fullPage: true
    })

    const checks = {
      referenceLayout: initial.layout === 'reference',
      keyCount: initial.keyCount === 16,
      knobCount: initial.knobCount === 3,
      deviceRatio: Math.abs(initial.ratio - 1.3485) <= 0.006,
      knobOrder: initial.knobs.volume.centerY < initial.knobs.vertical.centerY
        && initial.knobs.vertical.centerY < initial.knobs.horizontal.centerY,
      smallKnobsMatch: Math.abs(initial.knobs.volume.width - initial.knobs.vertical.width) <= 1,
      largeKnobScale: initial.knobs.horizontal.width >= initial.knobs.volume.width * 1.35,
      screwClearance: initial.firstKey.top >= initial.topLeftScrew.bottom + 2,
      bottomScrewClearance: initial.bottomLeftKey.bottom <= initial.bottomLeftScrew.top - 2,
      deviceInsideViewport: initial.deviceInsideViewport,
      noPageOverflow: !initial.pageOverflow,
      keyPressFeedback: pressedDuringPointer && releasedAfterPointer,
      knobDragFeedback: angleBefore !== angleAfter
    }
    const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name)
    reports.push({ viewport, initial, interactions: { angleBefore, angleAfter }, checks, failures })
    await context.close()
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify(reports, null, 2))
const failures = reports.flatMap((report) => report.failures.map((failure) => `${report.viewport.name}: ${failure}`))
if (failures.length > 0) throw new Error(`Keyboard controller checks failed:\n${failures.join('\n')}`)
