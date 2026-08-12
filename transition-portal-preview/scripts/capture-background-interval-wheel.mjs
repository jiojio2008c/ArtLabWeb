import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const outputDirectory = path.resolve('test-artifacts', 'background-interval-wheel')
await fs.mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({ executablePath: edgePath, headless: true })

const readDigitTranslation = async (page) => page.locator('.interval-wheel-digit-window-current .interval-wheel-digit-reel').evaluate((reel) => {
  const transform = window.getComputedStyle(reel).transform
  if (transform === 'none') return { x: 0, y: 0 }
  const matrix = new DOMMatrixReadOnly(transform)
  return { x: matrix.m41, y: matrix.m42 }
})

const openBackgroundEditor = async (page) => {
  await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
  await page.locator('.dynamic-card').click()
  await page.waitForFunction(() => document.querySelector('.preview-app')?.getAttribute('data-view') === 'library')
  await page.locator('.folder-card-main').first().click()
  await page.waitForTimeout(520)
  await page.locator('.material-card-main').click()
  await page.waitForFunction(() => document.querySelector('.preview-app')?.getAttribute('data-view') === 'control')
  await page.getByRole('button', { name: '編輯背景' }).click()
  await page.locator('.background-prototype-modal').waitFor({ state: 'visible' })
  await page.waitForTimeout(280)
}

const browserErrors = []
const page = await browser.newPage({
  viewport: { width: 1194, height: 834 },
  deviceScaleFactor: 1,
  hasTouch: true
})
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(message.text())
})
page.on('pageerror', (error) => browserErrors.push(error.message))

await openBackgroundEditor(page)
await page.screenshot({ path: path.join(outputDirectory, '01-editor-idle-1194x834.png') })

const valueButton = page.locator('.interval-wheel-value')
const valueBox = await valueButton.boundingBox()
if (!valueBox) throw new Error('Interval wheel value button has no layout box.')
const idleWheelState = await page.locator('.interval-wheel').evaluate((wheel) => {
  const current = wheel.querySelector('.interval-wheel-current')
  const currentStyle = current ? window.getComputedStyle(current) : null
  const currentSquareStyle = current ? window.getComputedStyle(current, '::before') : null
  const visibleNeighbors = Array.from(wheel.querySelectorAll('.interval-wheel-neighbor')).filter((neighbor) => (
    Number(window.getComputedStyle(neighbor).opacity) > 0.01
  )).length
  return {
    expanded: wheel.classList.contains('is-expanded'),
    currentWidth: current?.getBoundingClientRect().width ?? 0,
    currentBorderRadius: currentStyle?.borderRadius ?? '',
    currentSquareOpacity: Number(currentSquareStyle?.opacity ?? 0),
    visibleNeighbors
  }
})
if (idleWheelState.expanded || idleWheelState.currentSquareOpacity > 0.01 || idleWheelState.visibleNeighbors !== 0) {
  throw new Error('Idle interval layout must show only the standard rectangular value field.')
}
if (idleWheelState.currentWidth <= idleWheelState.currentBorderRadius.length || idleWheelState.currentWidth <= 80) {
  throw new Error('Idle interval value field must retain its wide rectangular layout.')
}

const centerX = valueBox.x + valueBox.width / 2
const centerY = valueBox.y + valueBox.height / 2
const currentCellBeforeDrag = await page.locator('.interval-wheel-current').boundingBox()
if (!currentCellBeforeDrag) throw new Error('Current-value cell has no layout box before dragging.')
await page.mouse.move(centerX, centerY)
await page.mouse.down()
await page.mouse.move(centerX, centerY - 23, { steps: 4 })
const clippingState = await page.locator('.interval-wheel-digit-window').evaluateAll((windows) => windows.map((windowElement) => {
  const style = window.getComputedStyle(windowElement)
  return {
    className: windowElement.className,
    overflowX: style.overflowX,
    overflowY: style.overflowY,
    clipPath: style.clipPath,
    borderRadius: style.borderRadius
  }
}))
if (clippingState.some((windowState) => (
  windowState.overflowX !== 'hidden'
  || windowState.overflowY !== 'hidden'
  || windowState.clipPath === 'none'
))) {
  throw new Error('Every wheel slot must clip moving digits to its rounded-square boundary.')
}
await page.screenshot({ path: path.join(outputDirectory, '02-wheel-mid-step-clipped-1194x834.png') })
await page.mouse.move(centerX, centerY - 45, { steps: 5 })
const valueBeforeFirstCenter = Number(await valueButton.getAttribute('aria-valuenow'))
const translationBeforeFirstCenter = await readDigitTranslation(page)
if (valueBeforeFirstCenter !== 5) {
  throw new Error('The value must not change before a complete 46px center-to-center step.')
}
if (Math.abs(translationBeforeFirstCenter.x) > 0.1 || Math.abs(translationBeforeFirstCenter.y + 45) > 0.75) {
  throw new Error('Wheel digits must move vertically on one fixed axis before the first step.')
}
await page.mouse.move(centerX, centerY - 47, { steps: 2 })
const valueAfterFirstCenter = Number(await valueButton.getAttribute('aria-valuenow'))
if (valueAfterFirstCenter !== 6) {
  throw new Error('Crossing one 46px center-to-center step must increase the value once.')
}
await page.mouse.move(centerX, centerY - 94, { steps: 5 })
await page.waitForTimeout(220)
const draggingWheelState = await page.locator('.interval-wheel').evaluate((wheel) => {
  const current = wheel.querySelector('.interval-wheel-current')
  const currentSquareStyle = current ? window.getComputedStyle(current, '::before') : null
  const visibleNeighbors = Array.from(wheel.querySelectorAll('.interval-wheel-neighbor')).filter((neighbor) => (
    Number(window.getComputedStyle(neighbor).opacity) > 0.5
  )).length
  return {
    expanded: wheel.classList.contains('is-expanded'),
    currentSquareOpacity: Number(currentSquareStyle?.opacity ?? 0),
    visibleNeighbors
  }
})
if (!draggingWheelState.expanded || draggingWheelState.currentSquareOpacity < 0.9 || draggingWheelState.visibleNeighbors !== 2) {
  throw new Error('Vertical dragging must reveal the current square and both available neighbor squares.')
}
const currentCellDuringDrag = await page.locator('.interval-wheel-current').boundingBox()
if (!currentCellDuringDrag) throw new Error('Current-value cell has no layout box while dragging.')
if (
  Math.abs(currentCellDuringDrag.x - currentCellBeforeDrag.x) > 0.1
  || Math.abs(currentCellDuringDrag.y - currentCellBeforeDrag.y) > 0.1
) {
  throw new Error('Current-value container must remain fixed while its number is dragged.')
}
const draggingDigitTranslation = await readDigitTranslation(page)
if (Math.abs(draggingDigitTranslation.x) > 0.1) {
  throw new Error('Wheel digits must never translate horizontally while dragging.')
}
const expandedSquareMetrics = await page.locator('.interval-wheel-cell').evaluateAll((cells) => cells.map((cell) => {
  const rect = cell.getBoundingClientRect()
  const style = window.getComputedStyle(cell)
  const squareStyle = cell.classList.contains('interval-wheel-current')
    ? window.getComputedStyle(cell, '::before')
    : style
  return {
    className: cell.className,
    layoutWidth: rect.width,
    layoutHeight: rect.height,
    width: Number.parseFloat(squareStyle.width),
    height: Number.parseFloat(squareStyle.height),
    borderRadius: squareStyle.borderRadius,
    transform: style.transform
  }
}))
const expandedCurrentMetric = expandedSquareMetrics.find((metric) => metric.className.includes('interval-wheel-current'))
const expandedNeighborMetrics = expandedSquareMetrics.filter((metric) => metric.className.includes('interval-wheel-neighbor'))
if (!expandedCurrentMetric || expandedNeighborMetrics.length !== 2) {
  throw new Error('Expanded wheel does not contain one current cell and two neighbor cells.')
}
if (expandedNeighborMetrics.some((metric) => metric.width >= expandedCurrentMetric.width || metric.height >= expandedCurrentMetric.height)) {
  throw new Error('Neighbor cells must be visually smaller than the current-value cell.')
}
await page.screenshot({ path: path.join(outputDirectory, '03-wheel-dragging-1194x834.png') })
const dragValue = Number(await valueButton.getAttribute('aria-valuenow'))
if (dragValue !== 7) throw new Error('Dragging upward from 5 by two steps must select 7.')
await page.mouse.up()
await page.waitForTimeout(180)
const releasedWheelState = await page.locator('.interval-wheel').evaluate((wheel) => {
  const current = wheel.querySelector('.interval-wheel-current')
  const currentSquareStyle = current ? window.getComputedStyle(current, '::before') : null
  return {
    expanded: wheel.classList.contains('is-expanded'),
    currentWidth: current?.getBoundingClientRect().width ?? 0,
    currentSquareOpacity: Number(currentSquareStyle?.opacity ?? 0)
  }
})
if (releasedWheelState.expanded || releasedWheelState.currentSquareOpacity > 0.01) {
  throw new Error('Releasing the drag must restore the standard rectangular value field.')
}

await valueButton.click()
const directInput = page.locator('.interval-wheel-current input')
await directInput.fill('150')
await directInput.press('Enter')
await page.waitForTimeout(60)
const upperBoundValue = Number(await page.locator('.interval-wheel-value').getAttribute('aria-valuenow'))
const nextBoundaryCount = await page.locator('.interval-wheel-next').count()
await page.screenshot({ path: path.join(outputDirectory, '04-wheel-upper-bound-1194x834.png') })

const upperButton = page.locator('.interval-wheel-value')
const upperBox = await upperButton.boundingBox()
if (!upperBox) throw new Error('Upper-bound wheel button has no layout box.')
await page.mouse.move(upperBox.x + upperBox.width / 2, upperBox.y + upperBox.height / 2)
await page.mouse.down()
await page.mouse.move(upperBox.x + upperBox.width / 2, upperBox.y + upperBox.height / 2 - 12, { steps: 3 })
await page.waitForTimeout(40)
const upperInvalidDirectionTranslation = await readDigitTranslation(page)
if (Math.abs(upperInvalidDirectionTranslation.y) > 0.1) {
  throw new Error('At 100, the digit must remain fixed when dragged upward.')
}
await page.mouse.move(upperBox.x + upperBox.width / 2, upperBox.y + upperBox.height / 2 - 190, { steps: 8 })
await page.mouse.up()
const clampedUpperDragValue = Number(await page.locator('.interval-wheel-value').getAttribute('aria-valuenow'))

const upperReturnButton = page.locator('.interval-wheel-value')
const upperReturnBox = await upperReturnButton.boundingBox()
if (!upperReturnBox) throw new Error('Upper-bound return button has no layout box.')
await page.mouse.move(upperReturnBox.x + upperReturnBox.width / 2, upperReturnBox.y + upperReturnBox.height / 2)
await page.mouse.down()
await page.mouse.move(upperReturnBox.x + upperReturnBox.width / 2, upperReturnBox.y + upperReturnBox.height / 2 + 48, { steps: 5 })
await page.mouse.up()
const upperAllowedDirectionValue = Number(await page.locator('.interval-wheel-value').getAttribute('aria-valuenow'))
if (upperAllowedDirectionValue !== 99) {
  throw new Error('The wheel must remain able to move from 100 back to 99.')
}

await page.locator('.interval-wheel-value').click()
await page.locator('.interval-wheel-current input').fill('0')
await page.locator('.interval-wheel-current input').press('Enter')
await page.waitForTimeout(60)
const lowerBoundValue = Number(await page.locator('.interval-wheel-value').getAttribute('aria-valuenow'))
const previousBoundaryCount = await page.locator('.interval-wheel-previous').count()

const lowerButton = page.locator('.interval-wheel-value')
const lowerBox = await lowerButton.boundingBox()
if (!lowerBox) throw new Error('Lower-bound wheel button has no layout box.')
await page.mouse.move(lowerBox.x + lowerBox.width / 2, lowerBox.y + lowerBox.height / 2)
await page.mouse.down()
await page.mouse.move(lowerBox.x + lowerBox.width / 2, lowerBox.y + lowerBox.height / 2 + 12, { steps: 3 })
await page.waitForTimeout(40)
const lowerInvalidDirectionTranslation = await readDigitTranslation(page)
if (Math.abs(lowerInvalidDirectionTranslation.y) > 0.1) {
  throw new Error('At 1, the digit must remain fixed when dragged downward.')
}
await page.mouse.move(lowerBox.x + lowerBox.width / 2, lowerBox.y + lowerBox.height / 2 + 190, { steps: 8 })
await page.mouse.up()
const clampedLowerDragValue = Number(await page.locator('.interval-wheel-value').getAttribute('aria-valuenow'))

const lowerReturnButton = page.locator('.interval-wheel-value')
const lowerReturnBox = await lowerReturnButton.boundingBox()
if (!lowerReturnBox) throw new Error('Lower-bound return button has no layout box.')
await page.mouse.move(lowerReturnBox.x + lowerReturnBox.width / 2, lowerReturnBox.y + lowerReturnBox.height / 2)
await page.mouse.down()
await page.mouse.move(lowerReturnBox.x + lowerReturnBox.width / 2, lowerReturnBox.y + lowerReturnBox.height / 2 - 48, { steps: 5 })
await page.mouse.up()
const lowerAllowedDirectionValue = Number(await page.locator('.interval-wheel-value').getAttribute('aria-valuenow'))
if (lowerAllowedDirectionValue !== 2) {
  throw new Error('The wheel must remain able to move from 1 forward to 2.')
}

const horizontalButton = page.locator('.interval-wheel-value')
const horizontalBox = await horizontalButton.boundingBox()
if (!horizontalBox) throw new Error('Horizontal-lock wheel button has no layout box.')
const horizontalStartValue = Number(await horizontalButton.getAttribute('aria-valuenow'))
const horizontalCenterX = horizontalBox.x + horizontalBox.width / 2
const horizontalCenterY = horizontalBox.y + horizontalBox.height / 2
await page.mouse.move(horizontalCenterX, horizontalCenterY)
await page.mouse.down()
await page.mouse.move(horizontalCenterX + 130, horizontalCenterY + 4, { steps: 8 })
await page.mouse.up()
const horizontalEndValue = Number(await page.locator('.interval-wheel-value').getAttribute('aria-valuenow'))
const horizontalOpenedInput = await page.locator('.interval-wheel-current input').count()

await page.getByRole('button', { name: '固定背景' }).click()
const fixedModeIntervalCount = await page.locator('.background-prototype-interval').count()
await page.getByRole('button', { name: '逐個切換' }).click()
const sequenceModeIntervalCount = await page.locator('.background-prototype-interval').count()

const squareMetrics = await page.locator('.interval-wheel-cell').evaluateAll((cells) => cells.map((cell) => {
  const rect = cell.getBoundingClientRect()
  const style = window.getComputedStyle(cell)
  return {
    width: rect.width,
    height: rect.height,
    borderRadius: style.borderRadius
  }
}))

const layout1194 = await page.evaluate(() => {
  const modal = document.querySelector('.background-prototype-modal')?.getBoundingClientRect()
  const viewport = document.querySelector('.interval-wheel-viewport')?.getBoundingClientRect()
  return {
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    modal: modal ? { left: modal.left, top: modal.top, right: modal.right, bottom: modal.bottom } : null,
    wheelViewport: viewport ? { left: viewport.left, top: viewport.top, right: viewport.right, bottom: viewport.bottom } : null
  }
})

const compactPage = await browser.newPage({
  viewport: { width: 1024, height: 768 },
  deviceScaleFactor: 1,
  hasTouch: true
})
const compactErrors = []
compactPage.on('console', (message) => {
  if (message.type() === 'error') compactErrors.push(message.text())
})
compactPage.on('pageerror', (error) => compactErrors.push(error.message))
await openBackgroundEditor(compactPage)
const compactValueBox = await compactPage.locator('.interval-wheel-value').boundingBox()
if (!compactValueBox) throw new Error('Compact wheel value button has no layout box.')
const compactCenterX = compactValueBox.x + compactValueBox.width / 2
const compactCenterY = compactValueBox.y + compactValueBox.height / 2
await compactPage.mouse.move(compactCenterX, compactCenterY)
await compactPage.mouse.down()
await compactPage.mouse.move(compactCenterX, compactCenterY - 48, { steps: 4 })
await compactPage.screenshot({ path: path.join(outputDirectory, '05-wheel-compact-1024x768.png') })
await compactPage.mouse.up()
const compactLayout = await compactPage.evaluate(() => {
  const modal = document.querySelector('.background-prototype-modal')?.getBoundingClientRect()
  return {
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    modal: modal ? { left: modal.left, top: modal.top, right: modal.right, bottom: modal.bottom } : null
  }
})

await browser.close()

console.log(JSON.stringify({
  dragValue,
  idleWheelState,
  draggingWheelState,
  releasedWheelState,
  currentCellBeforeDrag,
  currentCellDuringDrag,
  valueBeforeFirstCenter,
  valueAfterFirstCenter,
  clippingState,
  translationBeforeFirstCenter,
  draggingDigitTranslation,
  expandedSquareMetrics,
  upperBoundValue,
  nextBoundaryCount,
  upperInvalidDirectionTranslation,
  clampedUpperDragValue,
  upperAllowedDirectionValue,
  lowerBoundValue,
  previousBoundaryCount,
  lowerInvalidDirectionTranslation,
  clampedLowerDragValue,
  lowerAllowedDirectionValue,
  horizontalStartValue,
  horizontalEndValue,
  horizontalOpenedInput,
  fixedModeIntervalCount,
  sequenceModeIntervalCount,
  squareMetrics,
  layout1194,
  compactLayout,
  browserErrors,
  compactErrors
}, null, 2))
