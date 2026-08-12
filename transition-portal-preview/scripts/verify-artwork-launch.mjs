import { chromium } from 'playwright-core'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true
})

const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
await page.locator('.interactive-card').click()
await page.locator('.preview-app').waitFor({ state: 'visible' })
await page.waitForTimeout(2200)
await page.waitForFunction(() => document.querySelector('.preview-app')?.getAttribute('data-view') === 'interactive')
await page.locator('.interactive-theme-card').first().click()
await page.waitForFunction(() => document.querySelector('.preview-app')?.getAttribute('data-view') === 'interactive-upload')

const chooserPromise = page.waitForEvent('filechooser')
await page.locator('.theme-upload-dropzone').click()
const chooser = await chooserPromise
await chooser.setFiles(path.join(root, 'public', 'assets', 'interactive-ocean.jpg'))
await page.waitForSelector('.theme-upload-adjustment')
await page.waitForTimeout(1300)
await page.screenshot({ path: path.join(root, 'test-artifacts', 'artwork-launch-before.png') })

await page.locator('.theme-upload-send').click()
await page.waitForTimeout(740)
const launchState = await page.evaluate(() => ({
  launchVisible: Boolean(document.querySelector('.artwork-launch-transition')),
  visibleStars: Array.from(document.querySelectorAll('.artwork-launch-star')).filter((element) => {
    const style = getComputedStyle(element)
    return Number(style.opacity) > 0.02
  }).length,
  completeVisible: Boolean(document.querySelector('.artwork-upload-complete'))
}))
await page.screenshot({ path: path.join(root, 'test-artifacts', 'artwork-launch-flight.png') })

await page.waitForSelector('.artwork-upload-complete')
await page.waitForTimeout(520)
const completeState = await page.evaluate(() => ({
  heading: document.querySelector('.artwork-complete-summary h2')?.textContent,
  launchRemoved: !document.querySelector('.artwork-launch-transition'),
  markVisible: Number(getComputedStyle(document.querySelector('.artwork-complete-mark')).opacity) > 0.9,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    || document.documentElement.scrollHeight > document.documentElement.clientHeight
}))
await page.screenshot({ path: path.join(root, 'test-artifacts', 'artwork-launch-complete.png') })

process.stdout.write(JSON.stringify({ launchState, completeState, errors }, null, 2))
await browser.close()
