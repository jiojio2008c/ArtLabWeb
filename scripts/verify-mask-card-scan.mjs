import assert from 'node:assert/strict'

import en from '../src/i18n/locales/en.ts'
import plPL from '../src/i18n/locales/pl-PL.ts'
import ptPT from '../src/i18n/locales/pt-PT.ts'
import zhHans from '../src/i18n/locales/zh-Hans.ts'
import zhHant from '../src/i18n/locales/zh-Hant.ts'

import {
  binaryIou,
  buildMaskCardTemplate,
  cornerCodeMatches,
  createMaskCardLockTracker,
  detectMaskCard,
  detectMaskCards,
  downsampleGray,
  mapNormalizedRectToPixels,
  rgbaToGray,
  rotateCornerCode,
  rotateGray90
} from '../src/services/maskCardScanCore.ts'

const makeGray = (width, height, fill = 220) => ({
  width,
  height,
  data: Uint8Array.from({ length: width * height }, () => fill)
})

const stampRect = (image, x, y, width, height, value) => {
  for (let row = y; row < y + height; row += 1) {
    const offset = row * image.width
    for (let column = x; column < x + width; column += 1) {
      image.data[offset + column] = value
    }
  }
}

const stampBorder = (image, x, y, width, height, value, thickness = 2) => {
  stampRect(image, x, y, width, thickness, value)
  stampRect(image, x, y + height - thickness, width, thickness, value)
  stampRect(image, x, y, thickness, height, value)
  stampRect(image, x + width - thickness, y, thickness, height, value)
}

const stampSilhouette = (image, originX, originY, filled = true) => {
  stampRect(image, originX, originY, 96, 64, 255)
  if (filled) {
    stampRect(image, originX + 10, originY + 12, 22, 34, 20)
    stampRect(image, originX + 36, originY + 18, 42, 28, 20)
    return
  }
  stampBorder(image, originX + 10, originY + 12, 22, 34, 20, 2)
  stampBorder(image, originX + 36, originY + 18, 42, 28, 20, 2)
}

const stampOtherSilhouette = (image, originX, originY) => {
  stampRect(image, originX, originY, 96, 64, 255)
  stampRect(image, originX + 28, originY + 8, 40, 48, 20)
  stampRect(image, originX + 16, originY + 36, 64, 14, 20)
}

const stampFramedCard = (image, originX, originY, painter) => {
  stampRect(image, originX, originY, 220, 148, 255)
  stampBorder(image, originX + 18, originY + 16, 184, 116, 18, 8)
  painter(image, originX + 46, originY + 40)
}

const source = makeGray(96, 64, 255)
stampSilhouette(source, 0, 0, true)
const template = buildMaskCardTemplate(source, 'A-01')

assert.equal(template.maskId, 'A-01')
assert.ok(template.width > 8)
assert.ok(template.binary.some((value) => value === 1))
assert.equal(template.variants.length, 4)

const identicalIou = binaryIou(template.binary, template.binary)
assert.equal(identicalIou, 1)

const empty = Uint8Array.from({ length: template.binary.length }, () => 0)
assert.equal(binaryIou(template.binary, empty), 0)

const scene = makeGray(320, 200, 210)
stampSilhouette(scene, 140, 70, true)
const hit = detectMaskCard(scene, template)
assert.ok(hit, 'expected the printed card silhouette to be found')
assert.ok(hit.confidence >= 0.26, `confidence too low: ${hit.confidence}`)
assert.ok(hit.focus.x > 0.4 && hit.focus.x < 0.8)
assert.ok(hit.focus.y > 0.3 && hit.focus.y < 0.8)

const outlineScene = makeGray(320, 200, 210)
stampSilhouette(outlineScene, 140, 70, false)
const outlineHit = detectMaskCard(outlineScene, template)
assert.ok(outlineHit, 'expected a line-art card to match a filled template')
assert.ok(outlineHit.confidence >= 0.26, `outline confidence too low: ${outlineHit.confidence}`)

const cardLike = makeGray(280, 180, 170)
stampFramedCard(cardLike, 18, 16, (image, x, y) => stampSilhouette(image, x, y, true))
const cardTemplate = buildMaskCardTemplate(cardLike, 'A-01')
const tableScene = makeGray(400, 260, 96)
for (let y = 0; y < cardLike.height; y += 1) {
  const destRow = (40 + y) * tableScene.width
  const sourceRow = y * cardLike.width
  for (let x = 0; x < cardLike.width; x += 1) {
    tableScene.data[destRow + 70 + x] = cardLike.data[sourceRow + x]
  }
}
const cardHit = detectMaskCard(tableScene, cardTemplate)
assert.ok(cardHit, 'expected a framed mask card on the table to be found')
assert.ok(cardHit.confidence >= 0.26, `framed card confidence too low: ${cardHit.confidence}`)

const rotatedScene = rotateGray90(tableScene)
const rotatedHit = detectMaskCard(rotatedScene, cardTemplate)
assert.ok(rotatedHit, 'expected a 90-degree rotated card to be found')
assert.ok(rotatedHit.confidence >= 0.26, `rotated confidence too low: ${rotatedHit.confidence}`)

const otherSource = makeGray(96, 64, 255)
stampOtherSilhouette(otherSource, 0, 0)
const otherTemplate = buildMaskCardTemplate(otherSource, 'A-02')
const mismatch = detectMaskCards(outlineScene, [template, otherTemplate], 'A-02')
assert.equal(mismatch.preferredMatched, false)
assert.equal(mismatch.matchedMaskId, 'A-01')

const blankHit = detectMaskCard(makeGray(320, 200, 210), template)
assert.equal(blankHit, null)

const tracker = createMaskCardLockTracker()
assert.equal(tracker.push(null).status, 'searching')
assert.equal(tracker.push(hit).status, 'locking')
assert.equal(tracker.push(hit).status, 'locking')
assert.equal(tracker.push(hit).status, 'locked')

const giraffeCode = 0b1000
const peacockCode = 0b1010
assert.equal(cornerCodeMatches(giraffeCode, giraffeCode), 0)
assert.ok(cornerCodeMatches(rotateCornerCode(giraffeCode), giraffeCode) >= 0)
assert.equal(cornerCodeMatches(peacockCode, giraffeCode), -1)

tracker.reset()
assert.equal(tracker.push(hit).status, 'locking')

const pixels = mapNormalizedRectToPixels({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, 200, 100, 0)
assert.deepEqual(pixels, { x: 50, y: 25, width: 100, height: 50 })

const rgba = Uint8ClampedArray.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255])
const gray = rgbaToGray(rgba, 2, 2)
assert.equal(gray.width, 2)
assert.equal(gray.height, 2)
assert.ok(gray.data[0] > 50)

const tiny = downsampleGray(source, 12, 8)
assert.equal(tiny.width, 12)
assert.equal(tiny.height, 8)
assert.equal(tiny.data.length, 96)

const scanCopyKeys = [
  'upload.scanMaskCard',
  'upload.scanSearching',
  'upload.scanLocking',
  'upload.scanLocked',
  'upload.scanNeedMask',
  'upload.scanTemplateFailed',
  'upload.scanMismatch',
  'upload.scanOtherCard'
]
for (const [locale, resource] of [['en', en], ['pl-PL', plPL], ['pt-PT', ptPT], ['zh-Hans', zhHans], ['zh-Hant', zhHant]]) {
  for (const key of scanCopyKeys) {
    assert.equal(typeof resource[key], 'string', `${locale} missing ${key}`)
    assert.ok(resource[key].trim(), `${locale} empty ${key}`)
  }
  assert.match(resource['upload.scanSearching'], /\{\{name\}\}/)
  assert.match(resource['upload.scanMismatch'], /\{\{found\}\}/)
  assert.match(resource['upload.scanMismatch'], /\{\{selected\}\}/)
  assert.match(resource['upload.scanOtherCard'], /\{\{name\}\}/)
}

console.log('mask-card-scan: ok')
