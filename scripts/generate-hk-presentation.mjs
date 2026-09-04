import fs from 'node:fs'
import path from 'node:path'

const workspaceRoot = process.cwd()
const outputDirectory = path.join(workspaceRoot, 'presentation', 'hk')
const outputPath = path.join(outputDirectory, '香港版_MagicFloor_現場演講長圖.svg')
const canvasWidth = 1600
const sideMargin = 72
const contentWidth = canvasWidth - sideMargin * 2
const fontFamily = 'Microsoft JhengHei, PingFang TC, Noto Sans TC, Arial, sans-serif'
const imageCache = new Map()
const imageIds = new Map()
const elements = []
let currentY = 0
let clipCounter = 0

const colors = {
  ink: '#13212A',
  muted: '#526671',
  paper: '#F6FAF9',
  white: '#FFFFFF',
  teal: '#087F8E',
  tealSoft: '#DDF5F4',
  orange: '#E8843A',
  orangeSoft: '#FFF0DE',
  coral: '#D65B55',
  coralSoft: '#FFE7E4',
  purple: '#6F5BC4',
  purpleSoft: '#EEEAFE',
  green: '#2F9A6A',
  greenSoft: '#E1F5EA',
  navy: '#163B4A'
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function imageMime(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  return 'image/png'
}

function imageData(relativePath) {
  if (imageCache.has(relativePath)) return imageCache.get(relativePath)
  const absolutePath = path.join(workspaceRoot, relativePath)
  const bytes = fs.readFileSync(absolutePath)
  const dataUri = `data:${imageMime(absolutePath)};base64,${bytes.toString('base64')}`
  imageCache.set(relativePath, dataUri)
  imageIds.set(relativePath, `image-${imageIds.size + 1}`)
  return dataUri
}

function add(markup) {
  elements.push(markup)
}

function rect(x, y, width, height, fill, radius = 0, extra = '') {
  add(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" ${extra} />`)
}

function line(x1, y1, x2, y2, stroke, width = 2, extra = '') {
  add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" ${extra} />`)
}

function textLine(value, x, y, size, fill = colors.ink, weight = 500, anchor = 'start', extra = '') {
  add(`<text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${size}px" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" dominant-baseline="alphabetic" ${extra}>${escapeXml(value)}</text>`)
}

function textLines(values, x, y, size, fill = colors.ink, weight = 500, lineHeight = 1.45) {
  values.forEach((value, index) => textLine(value, x, y + index * size * lineHeight, size, fill, weight))
}

function imageUse(relativePath, x, y, width, height, radius = 22, fit = 'meet') {
  const dataUri = imageData(relativePath)
  const clipId = `clip-${clipCounter += 1}`
  add(`<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" /></clipPath>`)
  add(`<image href="${dataUri}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid ${fit}" clip-path="url(#${clipId})" />`)
  add(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="none" stroke="#D7E5E7" stroke-width="3" />`)
}

function label(value, x, y, fill, textColor = colors.white, width = null) {
  const labelWidth = width ?? Math.max(150, value.length * 28 + 46)
  rect(x, y, labelWidth, 46, fill, 23)
  textLine(value, x + labelWidth / 2, y + 31, 22, textColor, 800, 'middle')
}

function sectionHeader(number, title, subtitle, fill = colors.navy) {
  rect(sideMargin, currentY, contentWidth, 154, fill, 30)
  textLine(number, sideMargin + 38, currentY + 64, 28, '#BFEDEF', 800)
  textLine(title, sideMargin + 38, currentY + 113, 50, colors.white, 800)
  textLine(subtitle, sideMargin + 620, currentY + 96, 25, '#DDF7F7', 600)
  currentY += 184
}

function outlineCard(number, title, summary, points, accent, images = []) {
  const cardHeight = images.length > 0 ? 438 : 260
  rect(sideMargin, currentY, contentWidth, cardHeight, colors.white, 28, 'filter="url(#shadow)"')
  rect(sideMargin, currentY, 118, cardHeight, accent, 28)
  textLine(String(number).padStart(2, '0'), sideMargin + 59, currentY + 78, 42, colors.white, 800, 'middle')
  textLine('大綱', sideMargin + 59, currentY + 113, 20, '#F0F8F8', 700, 'middle')
  const textX = sideMargin + 154
  textLine(title, textX, currentY + 62, 36, colors.ink, 800)
  textLine(summary, textX, currentY + 105, 24, colors.muted, 600)
  points.forEach((point, index) => {
    const pointY = currentY + 168 + index * 43
    rect(textX, pointY - 20, 14, 14, accent, 7)
    textLine(point, textX + 30, pointY - 5, 25, colors.ink, 600)
  })
  if (images.length > 0) {
    const imageAreaX = sideMargin + 850
    const imageAreaY = currentY + 45
    const imageAreaWidth = 500
    const imageAreaHeight = 340
    rect(imageAreaX - 18, imageAreaY - 18, imageAreaWidth + 36, imageAreaHeight + 36, '#EFF7F6', 24)
    if (images.length === 1) {
      imageUse(images[0], imageAreaX, imageAreaY, imageAreaWidth, imageAreaHeight, 18)
    } else {
      const imageWidth = (imageAreaWidth - 18) / 2
      images.slice(0, 2).forEach((image, index) => imageUse(image, imageAreaX + index * (imageWidth + 18), imageAreaY, imageWidth, imageAreaHeight, 18))
    }
  }
  currentY += cardHeight + 28
}

function categoryStrip() {
  const y = currentY
  rect(sideMargin, y, contentWidth, 220, colors.white, 28, 'filter="url(#shadow)"')
  textLine('遊戲集合', sideMargin + 38, y + 56, 32, colors.ink, 800)
  textLine('互動主題與題目類型的總覽', sideMargin + 38, y + 94, 23, colors.muted, 600)
  const categories = [
    ['問答', colors.purple], ['藝術展示', colors.coral], ['運動', colors.green],
    ['打地鼠', colors.orange], ['打螃蟹', colors.teal], ['混合題目', '#476D9A']
  ]
  categories.forEach(([name, fill], index) => label(name, sideMargin + 38 + index * 220, y + 136, fill, colors.white, 188))
  currentY += 248
}

function flowBand() {
  rect(sideMargin, currentY, contentWidth, 184, colors.white, 28, 'filter="url(#shadow)"')
  const stages = [
    ['01', 'iPad', '創作／控制', colors.purple],
    ['02', 'EXE', '舞台／投影', colors.teal],
    ['03', 'Unity', '互動／遊戲', colors.orange]
  ]
  stages.forEach(([number, title, subtitle, fill], index) => {
    const x = sideMargin + 42 + index * 452
    rect(x, currentY + 34, 88, 88, fill, 44)
    textLine(number, x + 44, currentY + 88, 25, colors.white, 800, 'middle')
    textLine(title, x + 112, currentY + 70, 30, colors.ink, 800)
    textLine(subtitle, x + 112, currentY + 105, 23, colors.muted, 600)
    if (index < stages.length - 1) line(x + 330, currentY + 78, x + 415, currentY + 78, colors.orange, 6, 'stroke-linecap="round" marker-end="url(#arrow)"')
  })
  currentY += 216
}

add('<title>MagicFloor 香港版現場演講大綱</title>')
add('<desc>只保留演講順序與主題的 MagicFloor 香港版長圖。</desc>')

currentY = 0
rect(0, 0, canvasWidth, 760, 'url(#coverGradient)')
add(`<image href="${imageData('Magic_floor_background.png')}" x="0" y="0" width="${canvasWidth}" height="760" preserveAspectRatio="xMidYMid slice" opacity="0.2" />`)
rect(0, 0, canvasWidth, 760, '#0E5265', 0, 'opacity="0.24"')
imageUse('Right_Logo.png', 92, 72, 260, 136, 0, 'meet')
textLine('MagicFloor', 92, 292, 27, '#BCEEF0', 700)
textLine('現場演講大綱', 92, 380, 76, colors.white, 800)
textLine('香港版・只講流程，不講操作', 96, 438, 32, '#E1FAFA', 700)
textLines(['由 iPad 到 EXE 舞台', '再到 Unity 互動遊戲'], 96, 530, 36, colors.white, 650, 1.45)
rect(96, 650, 650, 70, colors.white, 22, 'opacity="0.95"')
textLine('今日重點：先看整條流程，再逐段呈現。', 128, 695, 26, colors.navy, 800)
rect(820, 104, 680, 520, colors.white, 32, 'opacity="0.96" filter="url(#shadow)"')
imageUse('app-store-assets/screenshots/ipad-pro-12-9/01-home.png', 846, 130, 628, 468, 22)
label('演講路線', 876, 154, colors.orange, colors.white, 170)
currentY = 796

textLine('今日內容', sideMargin, currentY + 42, 26, colors.muted, 800)
textLine('作品上台　→　舞台呈現　→　Unity 互動遊戲', sideMargin, currentY + 94, 38, colors.ink, 800)
currentY += 138
flowBand()

sectionHeader('第一部分', 'iPad → EXE：作品上台', '由創作資料銜接到現場舞台')
outlineCard(1, '現場設備與角色', '三個畫面角色，組成同一個現場體驗。', ['iPad：創作及舞台控制', 'Windows EXE：播放及投影輸出', '投影幕／大螢幕：觀眾看到的畫面'], colors.purple, ['app-store-assets/screenshots/ipad-pro-12-9/01-home.png', 'desktop-runtime/archive-view-check.png'])
outlineCard(2, '作品檔案與同步', '作品、縮圖與素材，維持兩端畫面一致。', ['作品檔案的整理與呈現', 'iPad 與 EXE 的作品狀態同步'], colors.teal, ['app-store-assets/screenshots/ipad-pro-12-9/02-artwork-library.png', 'desktop-runtime/archive-view-check.png'])
outlineCard(3, '舞台內容', '物件、背景、聲音與動畫，構成完整舞台。', ['物件與圖層結構', '出場排序、動畫及目標位置', '背景、轉場及背景音樂'], colors.orange, ['app-store-assets/screenshots/ipad-pro-12-9/03-stage-control.png', 'app-store-assets/screenshots/ipad-pro-12-9/06-appearance-settings.png'])
outlineCard(4, '預覽與正式呈現', '由設定畫面，銜接到觀眾看到的舞台效果。', ['背景與轉場的整體效果', '預覽、正式播放及現場收尾'], colors.coral, ['app-store-assets/screenshots/ipad-pro-12-9/05-background-editor.png', 'app-store-assets/screenshots/ipad-pro-12-9/07-live-preview.png'])

sectionHeader('第二部分', 'Unity：互動遊戲集合', '由舞台呈現延伸到互動體驗', colors.teal)
outlineCard(1, 'Unity 的現場位置', 'Unity 接續舞台，承載互動遊戲與題目。', ['iPad、EXE 與 Unity 的流程銜接', '舞台畫面與互動內容的轉換'], colors.teal, ['app-store-assets/screenshots/ipad-pro-12-9/08-interactive-themes.png'])
categoryStrip()
outlineCard(3, '題目示範節奏', '每個遊戲都沿着清晰的展示節奏進行。', ['題目展示', '互動進行', '完成後銜接下一題或返回集合'], colors.purple)
outlineCard(4, '舞台與互動切換', '由一個示範段落，自然連接到下一個段落。', ['舞台呈現 → Unity 互動', '互動完成 → 待機或下一個示範'], colors.orange)
outlineCard(5, '現場備援與收尾', '以穩定畫面、聲音和流程完成演講。', ['畫面、聲音、投影及連線狀態', '預設備援與最後收尾'], colors.coral)

rect(0, currentY, canvasWidth, 330, 'url(#coverGradient)')
textLine('結尾｜一條清晰主線', sideMargin, currentY + 78, 34, '#D8F7F8', 800)
textLine('iPad 編排  →  EXE 舞台  →  Unity 互動', sideMargin, currentY + 150, 48, colors.white, 800)
textLine('一部 iPad，串聯創作、舞台呈現及互動遊戲。', sideMargin, currentY + 218, 28, '#E6FAFA', 650)
textLine('MagicFloor 現場演講大綱・香港版', sideMargin, currentY + 282, 21, '#C8F2F3', 600)
currentY += 330

const definitions = `<defs>
  <linearGradient id="pageGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#EAF8F7" />
    <stop offset="52%" stop-color="#F7FAF8" />
    <stop offset="100%" stop-color="#EAF5F8" />
  </linearGradient>
  <linearGradient id="coverGradient" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0B657B" />
    <stop offset="100%" stop-color="#4AB3C9" />
  </linearGradient>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
    <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#12333D" flood-opacity="0.14" />
  </filter>
  <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
    <path d="M0,0 L10,5 L0,10 Z" fill="${colors.orange}" />
  </marker>
</defs>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${currentY}" viewBox="0 0 ${canvasWidth} ${currentY}" role="img" aria-labelledby="presentation-title presentation-description">
<title id="presentation-title">MagicFloor 香港版現場演講大綱</title>
<desc id="presentation-description">只保留演講順序與主題的 MagicFloor 香港版長圖。</desc>
${definitions}
<rect width="${canvasWidth}" height="${currentY}" fill="url(#pageGradient)" />
${elements.join('\n')}
</svg>`

fs.mkdirSync(outputDirectory, { recursive: true })
fs.writeFileSync(outputPath, svg, 'utf8')
process.stdout.write(`Generated ${outputPath}\nHeight: ${currentY}px\nImages: ${imageIds.size}\n`)
