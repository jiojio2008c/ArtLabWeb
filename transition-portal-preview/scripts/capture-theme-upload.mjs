import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const outputDirectory = path.resolve('test-artifacts')
const sampleImage = path.resolve('public/assets/interactive-ocean.jpg')
await fs.mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({ executablePath: edgePath, headless: true })
const browserErrors = []

const createPage = async (width, height, reducedMotion = 'no-preference') => {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion })
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
  await page.locator('.interactive-card').click()
  await page.waitForTimeout(1600)
  return page
}

const page = await createPage(1194, 834)
await page.screenshot({ path: path.join(outputDirectory, '15-theme-select-1194x834.png') })
await page.locator('[data-theme-id="ocean"]').click()
await page.waitForTimeout(130)
await page.screenshot({ path: path.join(outputDirectory, '16-theme-confirm-1194x834.png') })
await page.waitForTimeout(330)
await page.screenshot({ path: path.join(outputDirectory, '17-theme-dropzone-expand-1194x834.png') })
await page.waitForTimeout(330)
await page.screenshot({ path: path.join(outputDirectory, '18-theme-dropzone-build-1194x834.png') })
await page.waitForTimeout(500)
await page.screenshot({ path: path.join(outputDirectory, '19-theme-import-1194x834.png') })

const importLayout = await page.evaluate(() => {
  const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON()
  return {
    view: document.querySelector('.preview-app')?.getAttribute('data-view'),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    header: rect('.theme-upload-import-header'),
    dropzone: rect('.theme-upload-dropzone'),
    title: document.querySelector('.theme-upload-title')?.textContent,
    maskImagesBeforeSelection: document.querySelectorAll('.theme-upload-mask-image').length,
    maskOptionsBeforeSelection: document.querySelectorAll('.theme-upload-mask-option').length
  }
})

await page.locator('input[type="file"]').setInputFiles(sampleImage)
await page.waitForTimeout(180)
await page.screenshot({ path: path.join(outputDirectory, '20-artwork-reveal-emerge-1194x834.png') })
await page.waitForTimeout(300)
await page.screenshot({ path: path.join(outputDirectory, '21-artwork-reveal-frame-1194x834.png') })
await page.waitForTimeout(300)
await page.screenshot({ path: path.join(outputDirectory, '22-artwork-reveal-rail-1194x834.png') })
await page.waitForTimeout(480)
await page.screenshot({ path: path.join(outputDirectory, '23-theme-adjustment-after-file-1194x834.png') })
const adjustmentState = await page.evaluate(() => ({
  hasAdjustment: Boolean(document.querySelector('.theme-upload-adjustment')),
  hasMask: Boolean(document.querySelector('.theme-upload-mask-image')),
  maskOptions: document.querySelectorAll('.theme-upload-mask-option').length,
  selectedMask: document.querySelector('.theme-upload-mask-option.active span')?.textContent
}))

await page.locator('.theme-upload-back').click()
await page.waitForTimeout(80)
const backState = await page.locator('.preview-app').getAttribute('data-view')

const compactPage = await createPage(1024, 768)
await compactPage.locator('[data-theme-id="forest-1"]').click()
await compactPage.waitForTimeout(1350)
await compactPage.screenshot({ path: path.join(outputDirectory, '21-theme-import-1024x768.png') })
const compactLayout = await compactPage.evaluate(() => ({
  view: document.querySelector('.preview-app')?.getAttribute('data-view'),
  viewportWidth: window.innerWidth,
  viewportHeight: window.innerHeight,
  documentWidth: document.documentElement.scrollWidth,
  documentHeight: document.documentElement.scrollHeight,
  dropzone: document.querySelector('.theme-upload-dropzone')?.getBoundingClientRect().toJSON(),
  maskImagesBeforeSelection: document.querySelectorAll('.theme-upload-mask-image').length
}))

await compactPage.locator('input[type="file"]').setInputFiles(sampleImage)
await compactPage.waitForTimeout(1320)
await compactPage.screenshot({ path: path.join(outputDirectory, '24-theme-adjustment-1024x768.png') })

const reducedPage = await createPage(1194, 834, 'reduce')
await reducedPage.locator('[data-theme-id="painting"]').click()
await reducedPage.waitForTimeout(520)
const reducedState = await reducedPage.locator('.preview-app').getAttribute('data-view')

const performancePage = await createPage(1024, 768)
const frameStats = await performancePage.evaluate(() => new Promise((resolve) => {
  const intervals = []
  const startedAt = performance.now()
  let previous = startedAt
  document.querySelector('[data-theme-id="ocean"]')?.click()

  const sample = (now) => {
    intervals.push(now - previous)
    previous = now
    if (now - startedAt < 1300) {
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
  importLayout,
  adjustmentState,
  backState,
  compactLayout,
  reducedState,
  frameStats,
  browserErrors
}, null, 2))
