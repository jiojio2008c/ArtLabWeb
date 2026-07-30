import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const outputDirectory = path.resolve('test-artifacts')
await fs.mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({ executablePath: edgePath, headless: true })
const browserErrors = []

const createPage = async (width = 1194, height = 834) => {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
  return page
}

const enterLibrary = async (page, mode) => {
  if (mode === 'storybook') await page.locator('.prototype-mode-switch button').nth(1).click()
  await page.locator('.dynamic-card').click()
  await page.waitForTimeout(2400)
}

const sharedPage = await createPage()
await enterLibrary(sharedPage, 'shared')
await sharedPage.locator('.root-folder-card').first().locator('.folder-card-main').click()
await sharedPage.waitForTimeout(460)
await sharedPage.screenshot({ path: path.join(outputDirectory, '07-shared-folder-1194x834.png') })
await sharedPage.locator('.material-card-main').click()
await sharedPage.waitForTimeout(330)
await sharedPage.screenshot({ path: path.join(outputDirectory, '08-shared-material-expand-1194x834.png') })
await sharedPage.waitForTimeout(620)
await sharedPage.screenshot({ path: path.join(outputDirectory, '09-shared-control-1194x834.png') })
const sharedForwardState = await sharedPage.locator('.preview-app').getAttribute('data-view')
await sharedPage.locator('.control-back').click()
await sharedPage.waitForTimeout(820)
const sharedBackState = await sharedPage.locator('.preview-app').getAttribute('data-view')
const sharedFolderVisibleAfterBack = await sharedPage.locator('.material-card').isVisible()

const storyPage = await createPage()
await enterLibrary(storyPage, 'storybook')
await storyPage.locator('.root-folder-card').first().locator('.folder-card-main').click()
await storyPage.waitForTimeout(460)
await storyPage.screenshot({ path: path.join(outputDirectory, '10-story-folder-1194x834.png') })
await storyPage.locator('.material-card-main').click()
await storyPage.waitForTimeout(430)
await storyPage.screenshot({ path: path.join(outputDirectory, '11-story-tear-1194x834.png') })
await storyPage.waitForTimeout(480)
await storyPage.screenshot({ path: path.join(outputDirectory, '12-story-unfold-1194x834.png') })
await storyPage.waitForTimeout(850)
await storyPage.screenshot({ path: path.join(outputDirectory, '13-story-control-1194x834.png') })
const storyForwardState = await storyPage.locator('.preview-app').getAttribute('data-view')
await storyPage.locator('.control-back').click()
await storyPage.waitForTimeout(1050)
const storyBackState = await storyPage.locator('.preview-app').getAttribute('data-view')
const storyFolderVisibleAfterBack = await storyPage.locator('.material-card').isVisible()

const compactPage = await createPage(1024, 768)
await enterLibrary(compactPage, 'storybook')
await compactPage.locator('.root-folder-card').first().locator('.folder-card-main').click()
await compactPage.waitForTimeout(460)
await compactPage.locator('.material-card-main').click()
await compactPage.waitForTimeout(1750)
await compactPage.screenshot({ path: path.join(outputDirectory, '14-story-control-1024x768.png') })
const compactLayout = await compactPage.evaluate(() => ({
  view: document.querySelector('.preview-app')?.getAttribute('data-view'),
  viewportWidth: window.innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  viewportHeight: window.innerHeight,
  documentHeight: document.documentElement.scrollHeight,
  stageRect: document.querySelector('.control-stage-frame')?.getBoundingClientRect().toJSON(),
  panelRect: document.querySelector('.control-layer-panel')?.getBoundingClientRect().toJSON()
}))

await browser.close()
console.log(JSON.stringify({
  sharedForwardState,
  sharedBackState,
  sharedFolderVisibleAfterBack,
  storyForwardState,
  storyBackState,
  storyFolderVisibleAfterBack,
  compactLayout,
  browserErrors
}, null, 2))
