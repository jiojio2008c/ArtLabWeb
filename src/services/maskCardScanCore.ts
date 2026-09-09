export interface GrayImage {
  width: number
  height: number
  data: Uint8Array
}

export interface MaskCardRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MaskCardTemplateVariant {
  quarterTurns: 0 | 1 | 2 | 3
  width: number
  height: number
  aspect: number
  edges: Uint8Array
  binary: Uint8Array
}

export interface MaskCardTemplate {
  maskId: string
  width: number
  height: number
  gray: Uint8Array
  binary: Uint8Array
  edges: Uint8Array
  aspect: number
  cornerCode: number
  cornerReliable: boolean
  variants: MaskCardTemplateVariant[]
}

export interface MaskCardHit {
  confidence: number
  ncc: number
  iou: number
  maskId: string
  rect: MaskCardRect
  focus: { x: number; y: number }
}

export type MaskCardScanStatus = 'searching' | 'locking' | 'locked' | 'mismatch'

export interface MaskCardLockState {
  status: MaskCardScanStatus
  hit: MaskCardHit | null
}

export interface MaskCardDetectResult {
  hit: MaskCardHit | null
  matchedMaskId: string | null
  preferredMatched: boolean
}

export const MASK_CARD_PROCESS_WIDTH = 280
export const MASK_CARD_TEMPLATE_WIDTH = 64
export const MASK_CARD_INK_THRESHOLD = 118
export const MASK_CARD_MIN_NCC = 0.2
export const MASK_CARD_MIN_IOU = 0.1
export const MASK_CARD_MIN_CONFIDENCE = 0.26

const LOCK_WINDOW = 3
const LOCK_JITTER = 0.06
const BRIGHT_BLOB_THRESHOLD = 232
const EDGE_THRESHOLD = 36

type PixelRect = { x: number; y: number; width: number; height: number }

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export const rgbaToGray = (rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): GrayImage => {
  const data = new Uint8Array(width * height)
  for (let index = 0; index < data.length; index += 1) {
    const offset = index * 4
    data[index] = Math.round(
      rgba[offset] * 0.299 + rgba[offset + 1] * 0.587 + rgba[offset + 2] * 0.114
    )
  }
  return { width, height, data }
}

export const downsampleGray = (
  source: GrayImage,
  destWidth: number,
  destHeight: number
): GrayImage => {
  const width = Math.max(1, Math.round(destWidth))
  const height = Math.max(1, Math.round(destHeight))
  const data = new Uint8Array(width * height)

  for (let y = 0; y < height; y += 1) {
    const sourceY0 = Math.floor((y * source.height) / height)
    const sourceY1 = Math.max(sourceY0 + 1, Math.floor(((y + 1) * source.height) / height))
    for (let x = 0; x < width; x += 1) {
      const sourceX0 = Math.floor((x * source.width) / width)
      const sourceX1 = Math.max(sourceX0 + 1, Math.floor(((x + 1) * source.width) / width))
      let sum = 0
      let count = 0
      for (let sourceY = sourceY0; sourceY < sourceY1; sourceY += 1) {
        const row = sourceY * source.width
        for (let sourceX = sourceX0; sourceX < sourceX1; sourceX += 1) {
          sum += source.data[row + sourceX]
          count += 1
        }
      }
      data[y * width + x] = Math.round(sum / count)
    }
  }

  return { width, height, data }
}

export const binarizeGray = (source: GrayImage, threshold = MASK_CARD_INK_THRESHOLD) => {
  const data = new Uint8Array(source.data.length)
  for (let index = 0; index < source.data.length; index += 1) {
    data[index] = source.data[index] < threshold ? 1 : 0
  }
  return data
}

export const binaryIou = (left: Uint8Array, right: Uint8Array) => {
  const length = Math.min(left.length, right.length)
  if (length === 0) return 0
  let intersection = 0
  let union = 0
  for (let index = 0; index < length; index += 1) {
    const a = left[index]
    const b = right[index]
    intersection += a & b
    union += a | b
  }
  return union === 0 ? 0 : intersection / union
}

export const otsuThreshold = (gray: GrayImage) => {
  const hist = new Uint32Array(256)
  for (let index = 0; index < gray.data.length; index += 1) {
    hist[gray.data[index]] += 1
  }
  const total = gray.data.length
  let sum = 0
  for (let value = 0; value < 256; value += 1) sum += value * hist[value]
  let sumB = 0
  let weightB = 0
  let maxVar = -1
  let threshold = MASK_CARD_INK_THRESHOLD
  for (let value = 1; value < 255; value += 1) {
    weightB += hist[value]
    if (weightB === 0) continue
    const weightF = total - weightB
    if (weightF === 0) break
    sumB += value * hist[value]
    const meanB = sumB / weightB
    const meanF = (sum - sumB) / weightF
    const between = weightB * weightF * (meanB - meanF) * (meanB - meanF)
    if (between > maxVar) {
      maxVar = between
      threshold = value
    }
  }
  return Math.min(165, Math.max(88, threshold))
}

export const rotateCornerCode = (code: number) => {
  const topLeft = (code >> 3) & 1
  const topRight = (code >> 2) & 1
  const bottomRight = (code >> 1) & 1
  const bottomLeft = code & 1
  return (bottomLeft << 3) | (topLeft << 2) | (topRight << 1) | bottomRight
}

export const cornerCodeMatches = (photoCode: number, templateCode: number) => {
  let code = photoCode & 15
  for (let turn = 0; turn < 4; turn += 1) {
    if (code === (templateCode & 15)) return turn
    code = rotateCornerCode(code)
  }
  return -1
}

export const prepareProcessFrame = (frame: GrayImage) => {
  if (frame.width <= MASK_CARD_PROCESS_WIDTH) return frame
  const height = Math.max(1, Math.round((frame.height * MASK_CARD_PROCESS_WIDTH) / frame.width))
  return downsampleGray(frame, MASK_CARD_PROCESS_WIDTH, height)
}

export const rotateGray90 = (source: GrayImage): GrayImage => {
  const width = source.height
  const height = source.width
  const data = new Uint8Array(width * height)
  for (let y = 0; y < source.height; y += 1) {
    const sourceRow = y * source.width
    for (let x = 0; x < source.width; x += 1) {
      data[x * width + (width - 1 - y)] = source.data[sourceRow + x]
    }
  }
  return { width, height, data }
}

export const sobelMagnitude = (source: GrayImage): Uint8Array => {
  const { width, height, data } = source
  const out = new Uint8Array(width * height)
  for (let y = 1; y < height - 1; y += 1) {
    const row = y * width
    const prev = row - width
    const next = row + width
    for (let x = 1; x < width - 1; x += 1) {
      const gx = -data[prev + x - 1] + data[prev + x + 1]
        - 2 * data[row + x - 1] + 2 * data[row + x + 1]
        - data[next + x - 1] + data[next + x + 1]
      const gy = -data[prev + x - 1] - 2 * data[prev + x] - data[prev + x + 1]
        + data[next + x - 1] + 2 * data[next + x] + data[next + x + 1]
      out[row + x] = Math.min(255, Math.round(Math.hypot(gx, gy)))
    }
  }
  return out
}

export const binarizeEdges = (edges: Uint8Array, threshold = EDGE_THRESHOLD) => {
  const data = new Uint8Array(edges.length)
  for (let index = 0; index < edges.length; index += 1) {
    data[index] = edges[index] >= threshold ? 1 : 0
  }
  return data
}

const dilateBinary = (source: Uint8Array, width: number, height: number) => {
  const data = new Uint8Array(source.length)
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      if (source[row + x]) {
        data[row + x] = 1
        continue
      }
      const x0 = Math.max(0, x - 1)
      const x1 = Math.min(width - 1, x + 1)
      const y0 = Math.max(0, y - 1)
      const y1 = Math.min(height - 1, y + 1)
      let found = 0
      for (let ny = y0; ny <= y1 && !found; ny += 1) {
        const nRow = ny * width
        for (let nx = x0; nx <= x1; nx += 1) {
          if (source[nRow + nx]) {
            found = 1
            break
          }
        }
      }
      data[row + x] = found
    }
  }
  return data
}

export const nccEqual = (left: Uint8Array, right: Uint8Array) => {
  const length = Math.min(left.length, right.length)
  if (length < 16) return 0
  let sumLeft = 0
  let sumRight = 0
  for (let index = 0; index < length; index += 1) {
    sumLeft += left[index]
    sumRight += right[index]
  }
  const meanLeft = sumLeft / length
  const meanRight = sumRight / length
  let numerator = 0
  let leftEnergy = 0
  let rightEnergy = 0
  for (let index = 0; index < length; index += 1) {
    const leftDelta = left[index] - meanLeft
    const rightDelta = right[index] - meanRight
    numerator += leftDelta * rightDelta
    leftEnergy += leftDelta * leftDelta
    rightEnergy += rightDelta * rightDelta
  }
  return numerator / (Math.sqrt(leftEnergy * rightEnergy) + 1e-6)
}

const cropGray = (source: GrayImage, x: number, y: number, width: number, height: number): GrayImage => {
  const left = Math.max(0, Math.round(x))
  const top = Math.max(0, Math.round(y))
  const cropWidth = Math.max(1, Math.min(source.width - left, Math.round(width)))
  const cropHeight = Math.max(1, Math.min(source.height - top, Math.round(height)))
  const data = new Uint8Array(cropWidth * cropHeight)
  for (let row = 0; row < cropHeight; row += 1) {
    const sourceRow = (top + row) * source.width + left
    data.set(source.data.subarray(sourceRow, sourceRow + cropWidth), row * cropWidth)
  }
  return { width: cropWidth, height: cropHeight, data }
}

const insetRect = (rect: { x: number; y: number; width: number; height: number }, amount: number) => {
  const padX = rect.width * amount
  const padY = rect.height * amount
  return {
    x: rect.x + padX,
    y: rect.y + padY,
    width: Math.max(8, rect.width - padX * 2),
    height: Math.max(8, rect.height - padY * 2)
  }
}

const buildIntegral = (binary: Uint8Array, width: number, height: number) => {
  const stride = width + 1
  const integral = new Uint32Array(stride * (height + 1))
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0
    const sourceRow = y * width
    const destRow = (y + 1) * stride
    const prevRow = y * stride
    for (let x = 0; x < width; x += 1) {
      rowSum += binary[sourceRow + x]
      integral[destRow + x + 1] = integral[prevRow + x + 1] + rowSum
    }
  }
  return { integral, stride }
}

const rectSum = (
  integral: Uint32Array,
  stride: number,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  const x1 = x + width
  const y1 = y + height
  return integral[y1 * stride + x1] - integral[y * stride + x1] - integral[y1 * stride + x] + integral[y * stride + x]
}

const ringScoreAt = (
  integral: Uint32Array,
  stride: number,
  x: number,
  y: number,
  width: number,
  height: number,
  ring: number
) => {
  const innerWidth = width - ring * 2
  const innerHeight = height - ring * 2
  if (innerWidth < 12 || innerHeight < 10) return 0
  const outerDark = rectSum(integral, stride, x, y, width, height)
  const innerDark = rectSum(integral, stride, x + ring, y + ring, innerWidth, innerHeight)
  const ringArea = width * height - innerWidth * innerHeight
  const innerArea = innerWidth * innerHeight
  const ringRatio = (outerDark - innerDark) / ringArea
  const innerRatio = innerDark / innerArea
  if (ringRatio < 0.34 || innerRatio > 0.72) return 0
  return ringRatio * (1 - innerRatio * 0.7)
}

const rectOverlap = (
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
) => {
  const x0 = Math.max(left.x, right.x)
  const y0 = Math.max(left.y, right.y)
  const x1 = Math.min(left.x + left.width, right.x + right.width)
  const y1 = Math.min(left.y + left.height, right.y + right.height)
  const intersection = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
  const union = left.width * left.height + right.width * right.height - intersection
  return union === 0 ? 0 : intersection / union
}

const suppressOverlapping = <T extends { x: number; y: number; width: number; height: number; score: number }>(
  items: T[],
  limit: number
) => {
  const ranked = [...items].sort((left, right) => right.score - left.score)
  const picked: T[] = []
  for (const item of ranked) {
    if (picked.some((existing) => rectOverlap(existing, item) > 0.55)) continue
    picked.push(item)
    if (picked.length >= limit) break
  }
  return picked
}

export const findCardFrames = (gray: GrayImage) => {
  const darkThreshold = otsuThreshold(gray)
  const dark = new Uint8Array(gray.data.length)
  for (let index = 0; index < gray.data.length; index += 1) {
    dark[index] = gray.data[index] < darkThreshold ? 1 : 0
  }
  const { integral, stride } = buildIntegral(dark, gray.width, gray.height)
  const aspects = [0.55, 0.62, 0.72, 1.38, 1.52, 1.68, 1.82]
  const widthFracs = [0.36, 0.48, 0.6, 0.72, 0.84]
  const minWidth = Math.max(56, Math.round(gray.width * 0.3))
  const minHeight = Math.max(36, Math.round(gray.height * 0.24))
  const scored: { x: number; y: number; width: number; height: number; score: number }[] = []

  for (const frac of widthFracs) {
    for (const aspect of aspects) {
      const width = Math.round(gray.width * frac)
      const height = Math.round(width / aspect)
      if (width < minWidth || height < minHeight || width >= gray.width - 2 || height >= gray.height - 2) continue
      const ring = Math.max(3, Math.round(Math.min(width, height) * 0.048))
      const step = Math.max(4, Math.round(Math.min(width, height) * 0.08))
      for (let y = 0; y <= gray.height - height; y += step) {
        for (let x = 0; x <= gray.width - width; x += step) {
          const score = ringScoreAt(integral, stride, x, y, width, height, ring)
          if (score >= 0.28) scored.push({ x, y, width, height, score })
        }
      }
    }
  }

  return suppressOverlapping(scored, 3).filter((rect) => (
    rect.width * rect.height >= gray.width * gray.height * 0.16
  ))
}

export const findBrightRects = (gray: GrayImage, threshold = BRIGHT_BLOB_THRESHOLD) => {
  const { width, height, data } = gray
  const seen = new Uint8Array(data.length)
  const blobs: { x: number; y: number; width: number; height: number; score: number }[] = []
  const minArea = Math.round(width * height * 0.05)

  for (let start = 0; start < data.length; start += 1) {
    if (seen[start] || data[start] < threshold) continue
    const stack = [start]
    seen[start] = 1
    let count = 0
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    while (stack.length > 0) {
      const index = stack.pop() as number
      const x = index % width
      const y = (index - x) / width
      count += 1
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      if (x > 0 && !seen[index - 1] && data[index - 1] >= threshold) {
        seen[index - 1] = 1
        stack.push(index - 1)
      }
      if (x + 1 < width && !seen[index + 1] && data[index + 1] >= threshold) {
        seen[index + 1] = 1
        stack.push(index + 1)
      }
      if (y > 0 && !seen[index - width] && data[index - width] >= threshold) {
        seen[index - width] = 1
        stack.push(index - width)
      }
      if (y + 1 < height && !seen[index + width] && data[index + width] >= threshold) {
        seen[index + width] = 1
        stack.push(index + width)
      }
    }

    const blobWidth = maxX - minX + 1
    const blobHeight = maxY - minY + 1
    const area = blobWidth * blobHeight
    if (count < minArea || blobWidth < 24 || blobHeight < 16) continue
    const aspect = blobWidth / blobHeight
    if (aspect < 0.42 || aspect > 2.5) continue
    blobs.push({
      x: minX,
      y: minY,
      width: blobWidth,
      height: blobHeight,
      score: count / area
    })
  }

  return suppressOverlapping(blobs, 4)
}

const rectMean = (gray: GrayImage, x: number, y: number, width: number, height: number) => {
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(gray.width, x + width)
  const y1 = Math.min(gray.height, y + height)
  if (x1 <= x0 || y1 <= y0) return 255
  let sum = 0
  for (let row = y0; row < y1; row += 1) {
    const offset = row * gray.width
    for (let column = x0; column < x1; column += 1) sum += gray.data[offset + column]
  }
  return sum / ((x1 - x0) * (y1 - y0))
}

const classifyMarker = (gray: GrayImage, x: number, y: number, size: number) => {
  const pad = Math.max(2, Math.round(size * 0.28))
  const innerMean = rectMean(gray, x + pad, y + pad, size - pad * 2, size - pad * 2)
  const ringMean = (
    rectMean(gray, x, y, size, pad)
    + rectMean(gray, x, y + size - pad, size, pad)
    + rectMean(gray, x, y, pad, size)
    + rectMean(gray, x + size - pad, y, pad, size)
  ) / 4
  const filled = innerMean < 125 && innerMean <= ringMean + 12
  const contrast = Math.abs(ringMean - innerMean) + (filled ? 160 - innerMean : innerMean - 90)
  return { filled, contrast, innerMean }
}

const scanCornerMarker = (gray: GrayImage, x0: number, y0: number, x1: number, y1: number) => {
  const regionW = Math.max(8, x1 - x0)
  const regionH = Math.max(8, y1 - y0)
  const minSize = Math.max(8, Math.round(Math.min(regionW, regionH) * 0.26))
  const maxSize = Math.max(minSize + 1, Math.round(Math.min(regionW, regionH) * 0.72))
  let best: { filled: boolean; contrast: number } | null = null
  const step = Math.max(2, Math.round(minSize * 0.22))
  for (let size = minSize; size <= maxSize; size += 2) {
    for (let y = y0; y + size <= y1; y += step) {
      for (let x = x0; x + size <= x1; x += step) {
        const marker = classifyMarker(gray, x, y, size)
        if (!best || marker.contrast > best.contrast) best = marker
      }
    }
  }
  return best
}

const expandRect = (rect: PixelRect, amount: number, bounds: GrayImage): PixelRect => {
  const padX = rect.width * amount
  const padY = rect.height * amount
  const x = Math.max(0, rect.x - padX)
  const y = Math.max(0, rect.y - padY)
  const right = Math.min(bounds.width, rect.x + rect.width + padX)
  const bottom = Math.min(bounds.height, rect.y + rect.height + padY)
  return {
    x,
    y,
    width: Math.max(8, right - x),
    height: Math.max(8, bottom - y)
  }
}

export const readCornerCode = (gray: GrayImage, rect?: PixelRect) => {
  const area = rect ?? { x: 0, y: 0, width: gray.width, height: gray.height }
  const marginX = Math.max(10, Math.round(area.width * 0.24))
  const marginY = Math.max(10, Math.round(area.height * 0.24))
  const corners = [
    scanCornerMarker(gray, Math.round(area.x), Math.round(area.y), Math.round(area.x + marginX), Math.round(area.y + marginY)),
    scanCornerMarker(gray, Math.round(area.x + area.width - marginX), Math.round(area.y), Math.round(area.x + area.width), Math.round(area.y + marginY)),
    scanCornerMarker(gray, Math.round(area.x + area.width - marginX), Math.round(area.y + area.height - marginY), Math.round(area.x + area.width), Math.round(area.y + area.height)),
    scanCornerMarker(gray, Math.round(area.x), Math.round(area.y + area.height - marginY), Math.round(area.x + marginX), Math.round(area.y + area.height))
  ]
  if (corners.some((corner) => !corner || corner.contrast < 28)) {
    return { code: 0, reliable: false }
  }
  const code = (Number(corners[0]!.filled) << 3)
    | (Number(corners[1]!.filled) << 2)
    | (Number(corners[2]!.filled) << 1)
    | Number(corners[3]!.filled)
  return { code, reliable: code !== 0 && code !== 15 }
}

const makeVariant = (grayImage: GrayImage, quarterTurns: 0 | 1 | 2 | 3): MaskCardTemplateVariant => {
  let rotated = grayImage
  for (let turn = 0; turn < quarterTurns; turn += 1) {
    rotated = rotateGray90(rotated)
  }
  const edges = sobelMagnitude(rotated)
  return {
    quarterTurns,
    width: rotated.width,
    height: rotated.height,
    aspect: rotated.width / rotated.height,
    edges,
    binary: dilateBinary(binarizeEdges(edges), rotated.width, rotated.height)
  }
}

const artworkRegion = (frame: GrayImage) => {
  const frames = findCardFrames(frame)
  const dominant = frames.find((rect) => rect.width * rect.height >= frame.width * frame.height * 0.42)
  if (dominant) return insetRect(dominant, 0.08)
  const blobs = findBrightRects(frame)
  if (blobs[0]) {
    return { x: blobs[0].x, y: blobs[0].y, width: blobs[0].width, height: blobs[0].height }
  }
  return {
    x: 0,
    y: 0,
    width: frame.width,
    height: frame.height
  }
}

export const buildMaskCardTemplate = (frame: GrayImage, maskId: string): MaskCardTemplate => {
  const source = prepareProcessFrame(frame)
  const corners = readCornerCode(source)
  const region = artworkRegion(source)
  const cropped = cropGray(source, region.x, region.y, region.width, region.height)
  const height = Math.max(1, Math.round((cropped.height * MASK_CARD_TEMPLATE_WIDTH) / cropped.width))
  const grayImage = downsampleGray(cropped, MASK_CARD_TEMPLATE_WIDTH, height)
  const variants: MaskCardTemplateVariant[] = [
    makeVariant(grayImage, 0),
    makeVariant(grayImage, 1),
    makeVariant(grayImage, 2),
    makeVariant(grayImage, 3)
  ]
  const upright = variants[0]
  return {
    maskId,
    width: grayImage.width,
    height: grayImage.height,
    gray: grayImage.data,
    binary: binarizeGray(grayImage),
    edges: upright.edges,
    aspect: grayImage.width / grayImage.height,
    cornerCode: corners.code,
    cornerReliable: corners.reliable,
    variants
  }
}

const scoreCrop = (crop: GrayImage, template: MaskCardTemplate): MaskCardHit | null => {
  if (crop.width < 16 || crop.height < 12) return null
  const cropAspect = crop.width / crop.height
  let best: { ncc: number; iou: number; confidence: number } | null = null

  for (const variant of template.variants) {
    if (Math.abs(variant.aspect - cropAspect) / variant.aspect > 0.32) continue
    const resized = downsampleGray(crop, variant.width, variant.height)
    const edges = sobelMagnitude(resized)
    const ncc = nccEqual(edges, variant.edges)
    if (ncc < MASK_CARD_MIN_NCC) continue
    const iou = binaryIou(binarizeEdges(edges), variant.binary)
    if (iou < MASK_CARD_MIN_IOU) continue
    const confidence = clamp01(ncc * 0.64 + iou * 0.36)
    if (confidence < MASK_CARD_MIN_CONFIDENCE) continue
    if (!best || confidence > best.confidence) best = { ncc, iou, confidence }
  }

  if (!best) return null
  return {
    confidence: best.confidence,
    ncc: best.ncc,
    iou: best.iou,
    maskId: template.maskId,
    rect: { x: 0, y: 0, width: 1, height: 1 },
    focus: { x: 0.5, y: 0.5 }
  }
}

const toHit = (
  scored: MaskCardHit,
  rect: { x: number; y: number; width: number; height: number },
  frame: GrayImage
): MaskCardHit => ({
  ...scored,
  rect: {
    x: rect.x / frame.width,
    y: rect.y / frame.height,
    width: rect.width / frame.width,
    height: rect.height / frame.height
  },
  focus: {
    x: (rect.x + rect.width / 2) / frame.width,
    y: (rect.y + rect.height / 2) / frame.height
  }
})

const collectCandidates = (process: GrayImage) => {
  const frames = findCardFrames(process).map((rect) => ({
    rect: expandRect(rect, 0.12, process),
    kind: 'frame' as const,
    score: rect.score
  }))
  const blobs = findBrightRects(process).map((rect) => ({
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    kind: 'blob' as const,
    score: rect.score
  }))
  const whole = {
    rect: { x: 0, y: 0, width: process.width, height: process.height },
    kind: 'full' as const,
    score: 0.01
  }
  return [...frames, ...blobs, whole]
}

export const detectMaskCards = (
  frame: GrayImage,
  templates: MaskCardTemplate[],
  preferredMaskId?: string
): MaskCardDetectResult => {
  if (templates.length === 0) {
    return { hit: null, matchedMaskId: null, preferredMatched: false }
  }

  const process = prepareProcessFrame(frame)
  const candidates = collectCandidates(process)
  const reliableTemplates = templates.filter((template) => template.cornerReliable)
  const cornerVotes: { maskId: string; rect: PixelRect; score: number }[] = []
  let bestIdentity: MaskCardHit | null = null
  let bestFrame: PixelRect | null = candidates[0]?.rect ?? null

  for (const candidate of candidates) {
    if (reliableTemplates.length > 0) {
      const photoCorners = readCornerCode(process, candidate.rect)
      if (photoCorners.reliable) {
        for (const template of reliableTemplates) {
          if (cornerCodeMatches(photoCorners.code, template.cornerCode) < 0) continue
          cornerVotes.push({ maskId: template.maskId, rect: candidate.rect, score: candidate.score })
        }
      }
    }

    const crop = cropGray(process, candidate.rect.x, candidate.rect.y, candidate.rect.width, candidate.rect.height)
    for (const template of templates) {
      const scored = scoreCrop(crop, template)
      if (!scored) continue
      const hit = toHit(scored, candidate.rect, process)
      if (!bestIdentity || hit.confidence > bestIdentity.confidence) {
        bestIdentity = hit
        bestFrame = candidate.rect
      }
    }
    if (!bestFrame || candidate.score > 0) bestFrame = candidate.rect
  }

  if (cornerVotes.length > 0) {
    const counts = new Map<string, { score: number; rect: PixelRect; n: number }>()
    for (const vote of cornerVotes) {
      const current = counts.get(vote.maskId)
      if (!current) counts.set(vote.maskId, { score: vote.score, rect: vote.rect, n: 1 })
      else {
        current.n += 1
        if (vote.score > current.score) {
          current.score = vote.score
          current.rect = vote.rect
        }
      }
    }
    const ranked = [...counts.entries()].sort((left, right) => right[1].n - left[1].n || right[1].score - left[1].score)
    const top = ranked[0]
    const preferredVote = preferredMaskId ? counts.get(preferredMaskId) : undefined
    const winner = preferredVote && preferredVote.n === top[1].n
      ? { maskId: preferredMaskId as string, ...preferredVote }
      : { maskId: top[0], ...top[1] }
    bestIdentity = toHit({
      confidence: 0.82,
      ncc: 0.82,
      iou: 0.82,
      maskId: winner.maskId,
      rect: { x: 0, y: 0, width: 1, height: 1 },
      focus: { x: 0.5, y: 0.5 }
    }, winner.rect, process)
    bestFrame = winner.rect
  }

  if (bestIdentity) {
    const preferred = templates.find((template) => template.maskId === preferredMaskId)
    if (preferred && preferredMaskId && bestIdentity.maskId !== preferredMaskId && bestIdentity.confidence < 0.8) {
      const preferredHit = candidates.reduce<MaskCardHit | null>((current, candidate) => {
        const crop = cropGray(process, candidate.rect.x, candidate.rect.y, candidate.rect.width, candidate.rect.height)
        const scored = scoreCrop(crop, preferred)
        if (!scored) return current
        const hit = toHit(scored, candidate.rect, process)
        return !current || hit.confidence > current.confidence ? hit : current
      }, null)
      if (preferredHit && preferredHit.confidence >= bestIdentity.confidence - 0.04) {
        return {
          hit: preferredHit,
          matchedMaskId: preferredMaskId,
          preferredMatched: true
        }
      }
    }

    return {
      hit: bestIdentity,
      matchedMaskId: bestIdentity.maskId,
      preferredMatched: bestIdentity.maskId === preferredMaskId || !preferredMaskId
    }
  }

  if (bestFrame) {
    return {
      hit: {
        confidence: 0,
        ncc: 0,
        iou: 0,
        maskId: '',
        rect: {
          x: bestFrame.x / process.width,
          y: bestFrame.y / process.height,
          width: bestFrame.width / process.width,
          height: bestFrame.height / process.height
        },
        focus: {
          x: (bestFrame.x + bestFrame.width / 2) / process.width,
          y: (bestFrame.y + bestFrame.height / 2) / process.height
        }
      },
      matchedMaskId: null,
      preferredMatched: false
    }
  }

  return { hit: null, matchedMaskId: null, preferredMatched: false }
}

export const detectMaskCard = (frame: GrayImage, template: MaskCardTemplate): MaskCardHit | null => {
  const result = detectMaskCards(frame, [template], template.maskId)
  return result.preferredMatched ? result.hit : null
}

export const createMaskCardLockTracker = () => {
  const recent: MaskCardHit[] = []

  const reset = () => {
    recent.length = 0
  }

  const push = (hit: MaskCardHit | null): MaskCardLockState => {
    if (!hit) {
      recent.length = 0
      return { status: 'searching', hit: null }
    }

    recent.push(hit)
    if (recent.length > 8) recent.shift()
    if (recent.length < LOCK_WINDOW) return { status: 'locking', hit }

    const windowHits = recent.slice(-LOCK_WINDOW)
    const centers = windowHits.map((item) => ({
      x: item.rect.x + item.rect.width / 2,
      y: item.rect.y + item.rect.height / 2
    }))
    const meanX = centers.reduce((sum, item) => sum + item.x, 0) / centers.length
    const meanY = centers.reduce((sum, item) => sum + item.y, 0) / centers.length
    const jitter = Math.max(
      ...centers.map((item) => Math.max(Math.abs(item.x - meanX), Math.abs(item.y - meanY)))
    )
    const stable = jitter <= LOCK_JITTER && windowHits.every((item) => item.confidence >= MASK_CARD_MIN_CONFIDENCE)

    return {
      status: stable ? 'locked' : 'locking',
      hit
    }
  }

  return { reset, push }
}

export const hitsLookSame = (left: MaskCardHit | null, right: MaskCardHit | null) => {
  if (left === right) return true
  if (!left || !right) return false
  return left.maskId === right.maskId
    && Math.abs(left.rect.x - right.rect.x) < 0.02
    && Math.abs(left.rect.y - right.rect.y) < 0.02
    && Math.abs(left.rect.width - right.rect.width) < 0.03
    && Math.abs(left.rect.height - right.rect.height) < 0.03
}

export const mapNormalizedRectToPixels = (
  rect: MaskCardRect,
  width: number,
  height: number,
  padding = 0.06
) => {
  const padX = rect.width * padding
  const padY = rect.height * padding
  const x = Math.max(0, Math.round((rect.x - padX) * width))
  const y = Math.max(0, Math.round((rect.y - padY) * height))
  const right = Math.min(width, Math.round((rect.x + rect.width + padX) * width))
  const bottom = Math.min(height, Math.round((rect.y + rect.height + padY) * height))
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y)
  }
}
