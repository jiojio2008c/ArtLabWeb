import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const outputDirectory = path.resolve('test-artifacts')
await fs.mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({ executablePath: edgePath, headless: true })
const page = await browser.newPage({ viewport: { width: 1194, height: 834 }, deviceScaleFactor: 1 })
const browserErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(message.text())
})
page.on('pageerror', (error) => browserErrors.push(error.message))

await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
await page.screenshot({ path: path.join(outputDirectory, '01-home-1194x834.png') })
await page.locator('.dynamic-card').click()
await page.waitForTimeout(180)
await page.screenshot({ path: path.join(outputDirectory, '02-activation-1194x834.png') })
await page.waitForTimeout(520)

const canvasStats = await page.locator('.portal-canvas').evaluate((canvas) => {
  const webglCanvas = canvas
  const gl = webglCanvas.getContext('webgl2') || webglCanvas.getContext('webgl')
  if (!gl) return { width: webglCanvas.width, height: webglCanvas.height, sampled: 0, colored: 0 }
  const pixels = new Uint8Array(webglCanvas.width * webglCanvas.height * 4)
  gl.readPixels(0, 0, webglCanvas.width, webglCanvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  let sampled = 0
  let colored = 0
  for (let index = 0; index < pixels.length; index += 64) {
    sampled += 1
    if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 32 && pixels[index + 3] > 0) colored += 1
  }
  return { width: webglCanvas.width, height: webglCanvas.height, sampled, colored }
})

await page.screenshot({ path: path.join(outputDirectory, '03-deconstruction-1194x834.png') })
await page.waitForTimeout(520)
await page.screenshot({ path: path.join(outputDirectory, '04-reconstruction-1194x834.png') })
await page.waitForTimeout(850)
await page.screenshot({ path: path.join(outputDirectory, '05-library-1194x834.png') })

const finalState = await page.evaluate(() => ({
  view: document.querySelector('.preview-app')?.getAttribute('data-view'),
  visibleFolders: Array.from(document.querySelectorAll('.folder-card')).filter((element) => {
    const style = window.getComputedStyle(element)
    return style.visibility !== 'hidden' && style.opacity !== '0'
  }).length,
  bodyOverflow: window.getComputedStyle(document.body).overflow
}))

await page.locator('.replay-button').click()
await page.waitForTimeout(120)
const replayStarted = await page.locator('.preview-app').getAttribute('data-view')
await page.waitForTimeout(2300)
const replayCompleted = await page.locator('.preview-app').getAttribute('data-view')
await page.locator('.back-button').click()
await page.waitForTimeout(80)
const backState = await page.locator('.preview-app').getAttribute('data-view')

const compactPage = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 })
await compactPage.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
await compactPage.locator('.dynamic-card').click()
await compactPage.waitForTimeout(2400)
await compactPage.screenshot({ path: path.join(outputDirectory, '06-library-1024x768.png') })
const compactOverflow = await compactPage.evaluate(() => ({
  viewportWidth: window.innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  viewportHeight: window.innerHeight,
  documentHeight: document.documentElement.scrollHeight
}))

const reducedPage = await browser.newPage({
  viewport: { width: 1194, height: 834 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce'
})
await reducedPage.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
await reducedPage.locator('.dynamic-card').click()
await reducedPage.waitForTimeout(650)
const reducedMotionState = await reducedPage.evaluate(() => ({
  view: document.querySelector('.preview-app')?.getAttribute('data-view'),
  canvasDisplay: document.querySelector('.portal-canvas')
    ? window.getComputedStyle(document.querySelector('.portal-canvas')).display
    : 'unmounted'
}))

const performancePage = await browser.newPage({ viewport: { width: 1194, height: 834 }, deviceScaleFactor: 1 })
await performancePage.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
const frameStats = await performancePage.evaluate(() => new Promise((resolve) => {
  const intervals = []
  const startedAt = performance.now()
  let previous = startedAt
  document.querySelector('.dynamic-card')?.click()

  const sample = (now) => {
    intervals.push(now - previous)
    previous = now
    if (now - startedAt < 2300) {
      requestAnimationFrame(sample)
      return
    }

    const sorted = [...intervals].sort((left, right) => left - right)
    const average = intervals.reduce((total, value) => total + value, 0) / intervals.length
    resolve({
      frames: intervals.length,
      averageFrameMs: Number(average.toFixed(2)),
      approximateFps: Number((1000 / average).toFixed(1)),
      p95FrameMs: Number(sorted[Math.floor(sorted.length * .95)].toFixed(2)),
      framesOver25Ms: intervals.filter((value) => value > 25).length
    })
  }
  requestAnimationFrame(sample)
}))

await browser.close()
console.log(JSON.stringify({
  canvasStats,
  finalState,
  replayStarted,
  replayCompleted,
  backState,
  compactOverflow,
  reducedMotionState,
  frameStats,
  browserErrors
}, null, 2))
