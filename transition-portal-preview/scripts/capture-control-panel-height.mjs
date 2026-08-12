import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const outputDirectory = path.resolve('test-artifacts', 'control-panel-height')
await fs.mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({ executablePath: edgePath, headless: true })
const browserErrors = []
const page = await browser.newPage({
  viewport: { width: 1180, height: 820 },
  deviceScaleFactor: 1,
  hasTouch: true
})

page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(message.text())
})
page.on('pageerror', (error) => browserErrors.push(error.message))

await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
await page.locator('.prototype-mode-switch button').nth(1).click()
await page.locator('.dynamic-card').click()
await page.waitForFunction(() => document.querySelector('.preview-app')?.getAttribute('data-view') === 'library')
await page.locator('.root-folder-card').first().locator('.folder-card-main').click()
await page.waitForTimeout(520)
await page.locator('.material-card-main').click()
await page.waitForFunction(() => document.querySelector('.preview-app')?.getAttribute('data-view') === 'control')
await page.waitForTimeout(180)

const readLayout = () => page.evaluate(() => {
  const scene = document.querySelector('.control-scene')?.getBoundingClientRect()
  const topbar = document.querySelector('.control-topbar')?.getBoundingClientRect()
  const workspace = document.querySelector('.control-workspace')?.getBoundingClientRect()
  const stage = document.querySelector('.control-stage-frame')?.getBoundingClientRect()
  const panel = document.querySelector('.control-layer-panel')?.getBoundingClientRect()
  const propertyContent = document.querySelector('.control-property-content')

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scene: scene?.toJSON(),
    topbar: topbar?.toJSON(),
    workspace: workspace?.toJSON(),
    stage: stage?.toJSON(),
    panel: panel?.toJSON(),
    panelBottomGap: panel ? window.innerHeight - panel.bottom : null,
    panelMatchesWorkspace: panel && workspace
      ? Math.abs(panel.top - workspace.top) < 0.5 && Math.abs(panel.bottom - workspace.bottom) < 0.5
      : false,
    propertyScrollable: propertyContent
      ? propertyContent.scrollHeight > propertyContent.clientHeight
      : false,
    documentOverflow: {
      width: document.documentElement.scrollWidth - window.innerWidth,
      height: document.documentElement.scrollHeight - window.innerHeight
    }
  }
})

const layerLayout = await readLayout()
await page.screenshot({ path: path.join(outputDirectory, '01-layer-panel-1180x820.png') })

await page.getByRole('button', { name: '開啟小老虎的物件屬性' }).click()
await page.waitForTimeout(220)
const propertyLayout = await readLayout()
await page.screenshot({ path: path.join(outputDirectory, '02-property-panel-1180x820.png') })

if (!layerLayout.panelMatchesWorkspace || !propertyLayout.panelMatchesWorkspace) {
  throw new Error('Layer and property panels must fill the complete workspace height.')
}

if ((layerLayout.panelBottomGap ?? 999) > 12 || (propertyLayout.panelBottomGap ?? 999) > 12) {
  throw new Error('The right panel must finish inside the bottom safe-area gap.')
}

if (layerLayout.documentOverflow.width !== 0 || layerLayout.documentOverflow.height !== 0) {
  throw new Error('The control prototype must not overflow the viewport.')
}

await browser.close()
console.log(JSON.stringify({ layerLayout, propertyLayout, browserErrors }, null, 2))
