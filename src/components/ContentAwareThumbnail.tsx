import { useEffect, useRef, useState, type ReactEventHandler } from 'react'

interface ContentAwareThumbnailProps {
  src: string
  alt: string
  mimeType?: string
  onError?: ReactEventHandler<HTMLImageElement>
}

interface ThumbnailContentBounds {
  left: number
  top: number
  right: number
  bottom: number
  background?: [number, number, number]
}

const THUMBNAIL_SCAN_MAX_EDGE = 256
const THUMBNAIL_OUTPUT_MAX_EDGE = 512
const THUMBNAIL_ALPHA_THRESHOLD = 6
const THUMBNAIL_PADDING_RATIO = 0.055
const THUMBNAIL_CACHE_LIMIT = 48
const framedThumbnailCache = new Map<string, string>()

const cacheThumbnail = (source: string, framedSource: string) => {
  if (framedThumbnailCache.size >= THUMBNAIL_CACHE_LIMIT) {
    const oldestSource = framedThumbnailCache.keys().next().value
    if (oldestSource) framedThumbnailCache.delete(oldestSource)
  }
  framedThumbnailCache.set(source, framedSource)
}

const getBoundsSize = (bounds: ThumbnailContentBounds) => ({
  width: bounds.right - bounds.left + 1,
  height: bounds.bottom - bounds.top + 1
})

const hasUsefulCrop = (
  bounds: ThumbnailContentBounds,
  width: number,
  height: number
) => {
  const contentSize = getBoundsSize(bounds)
  return contentSize.width / width < 0.94 || contentSize.height / height < 0.94
}

const findAlphaBounds = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): ThumbnailContentBounds | undefined => {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  let transparentPixels = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3]
      if (alpha < 248) transparentPixels += 1
      if (alpha <= THUMBNAIL_ALPHA_THRESHOLD) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  const bounds = right >= left && bottom >= top
    ? { left, top, right, bottom }
    : undefined
  if (!bounds || transparentPixels / (width * height) < 0.01) return undefined
  return hasUsefulCrop(bounds, width, height) ? bounds : undefined
}

const findUniformBackgroundBounds = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): ThumbnailContentBounds | undefined => {
  const cornerOffsets = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height * width) - 1) * 4
  ]
  const corners = cornerOffsets.map((offset) => [
    pixels[offset],
    pixels[offset + 1],
    pixels[offset + 2]
  ] as const)
  const channelsAreUniform = ([first, second, third, fourth]: readonly number[]) => (
    Math.max(first, second, third, fourth) - Math.min(first, second, third, fourth) <= 16
  )

  if (![0, 1, 2].every((channel) => channelsAreUniform(corners.map((corner) => corner[channel])))) {
    return undefined
  }

  const background = [0, 1, 2].map((channel) => Math.round(
    corners.reduce((total, corner) => total + corner[channel], 0) / corners.length
  )) as [number, number, number]
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  let foregroundPixels = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const colorDistance = Math.abs(pixels[offset] - background[0])
        + Math.abs(pixels[offset + 1] - background[1])
        + Math.abs(pixels[offset + 2] - background[2])
      if (colorDistance <= 54) continue
      foregroundPixels += 1
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  const foregroundRatio = foregroundPixels / (width * height)
  const bounds = right >= left && bottom >= top
    ? { left, top, right, bottom, background }
    : undefined
  if (!bounds || foregroundRatio < 0.002 || foregroundRatio > 0.28) return undefined
  return hasUsefulCrop(bounds, width, height) ? bounds : undefined
}

const createFramedThumbnail = (image: HTMLImageElement) => {
  if (!image.naturalWidth || !image.naturalHeight) return undefined

  const scanScale = Math.min(
    1,
    THUMBNAIL_SCAN_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight)
  )
  const scanWidth = Math.max(1, Math.round(image.naturalWidth * scanScale))
  const scanHeight = Math.max(1, Math.round(image.naturalHeight * scanScale))
  const scanCanvas = document.createElement('canvas')
  scanCanvas.width = scanWidth
  scanCanvas.height = scanHeight
  const scanContext = scanCanvas.getContext('2d', { willReadFrequently: true })
  if (!scanContext) return undefined

  try {
    scanContext.drawImage(image, 0, 0, scanWidth, scanHeight)
    const imageData = scanContext.getImageData(0, 0, scanWidth, scanHeight)
    const bounds = findAlphaBounds(imageData.data, scanWidth, scanHeight)
      ?? findUniformBackgroundBounds(imageData.data, scanWidth, scanHeight)
    if (!bounds) return undefined

    const sourceLeft = Math.max(0, Math.floor(
      Math.max(0, bounds.left - 1) / scanWidth * image.naturalWidth
    ))
    const sourceTop = Math.max(0, Math.floor(
      Math.max(0, bounds.top - 1) / scanHeight * image.naturalHeight
    ))
    const sourceRight = Math.min(image.naturalWidth, Math.ceil(
      Math.min(scanWidth, bounds.right + 2) / scanWidth * image.naturalWidth
    ))
    const sourceBottom = Math.min(image.naturalHeight, Math.ceil(
      Math.min(scanHeight, bounds.bottom + 2) / scanHeight * image.naturalHeight
    ))
    const sourceWidth = Math.max(1, sourceRight - sourceLeft)
    const sourceHeight = Math.max(1, sourceBottom - sourceTop)
    const outputScale = Math.min(
      1,
      THUMBNAIL_OUTPUT_MAX_EDGE / Math.max(sourceWidth, sourceHeight)
    )
    const contentWidth = Math.max(1, Math.round(sourceWidth * outputScale))
    const contentHeight = Math.max(1, Math.round(sourceHeight * outputScale))
    const padding = Math.max(
      4,
      Math.round(Math.max(contentWidth, contentHeight) * THUMBNAIL_PADDING_RATIO)
    )
    const framedCanvas = document.createElement('canvas')
    framedCanvas.width = contentWidth + padding * 2
    framedCanvas.height = contentHeight + padding * 2
    const framedContext = framedCanvas.getContext('2d')
    if (!framedContext) return undefined

    if (bounds.background) {
      framedContext.fillStyle = `rgb(${bounds.background.join(', ')})`
      framedContext.fillRect(0, 0, framedCanvas.width, framedCanvas.height)
    }
    framedContext.drawImage(
      image,
      sourceLeft,
      sourceTop,
      sourceWidth,
      sourceHeight,
      padding,
      padding,
      contentWidth,
      contentHeight
    )
    return framedCanvas.toDataURL('image/png')
  } catch {
    return undefined
  }
}

const supportsContentFraming = (mimeType?: string) => (
  !mimeType || mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/jpg'
)

const getContentAwareThumbnailSource = (source: string) => framedThumbnailCache.get(source) ?? source

const ContentAwareThumbnail: React.FC<ContentAwareThumbnailProps> = ({
  src,
  alt,
  mimeType,
  onError
}) => {
  const [displaySource, setDisplaySource] = useState(() => framedThumbnailCache.get(src) ?? src)
  const processedSourceRef = useRef('')

  useEffect(() => {
    const cachedSource = framedThumbnailCache.get(src)
    processedSourceRef.current = cachedSource ? src : ''
    setDisplaySource(cachedSource ?? src)
  }, [src])

  const handleLoad: ReactEventHandler<HTMLImageElement> = (event) => {
    if (!supportsContentFraming(mimeType) || processedSourceRef.current === src) return

    const cachedSource = framedThumbnailCache.get(src)
    if (cachedSource) {
      processedSourceRef.current = src
      if (cachedSource !== displaySource) setDisplaySource(cachedSource)
      return
    }

    processedSourceRef.current = src
    const framedSource = createFramedThumbnail(event.currentTarget) ?? src
    cacheThumbnail(src, framedSource)
    if (framedSource !== displaySource) setDisplaySource(framedSource)
  }

  return (
    <img
      src={displaySource}
      alt={alt}
      decoding="async"
      draggable={false}
      onLoad={handleLoad}
      onError={onError}
    />
  )
}

export default ContentAwareThumbnail
export { getContentAwareThumbnailSource }
