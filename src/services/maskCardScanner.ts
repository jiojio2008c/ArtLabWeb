import {
  buildMaskCardTemplate,
  rgbaToGray,
  type GrayImage,
  type MaskCardTemplate
} from './maskCardScanCore.ts'

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error(`Unable to load mask card template: ${url}`))
  image.src = url
})

export const canvasToGrayImage = (canvas: HTMLCanvasElement): GrayImage | null => {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  return rgbaToGray(pixels.data, canvas.width, canvas.height)
}

export const drawVideoFrameToCanvas = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  maxWidth: number
) => {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  if (sourceWidth <= 0 || sourceHeight <= 0) return false

  const width = Math.min(maxWidth, sourceWidth)
  const height = Math.max(1, Math.round((sourceHeight * width) / sourceWidth))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return false
  context.drawImage(video, 0, 0, width, height)
  return true
}

const MAX_TEMPLATE_SOURCE_WIDTH = 560
const MAX_OVERLAY_WIDTH = 1280
const overlayUrlCache = new Map<string, string>()

const drawImageToCanvas = (image: HTMLImageElement, maxWidth: number) => {
  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  const width = Math.max(1, Math.min(maxWidth, naturalWidth))
  const height = Math.max(1, Math.round((naturalHeight * width) / naturalWidth))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(image, 0, 0, width, height)
  return canvas
}

export const loadMaskCardTemplateFromUrl = async (
  url: string,
  maskId: string
): Promise<MaskCardTemplate> => {
  const image = await loadImage(url)
  const canvas = drawImageToCanvas(image, MAX_TEMPLATE_SOURCE_WIDTH)
  if (!canvas) throw new Error('Unable to read mask card pixels')
  const gray = canvasToGrayImage(canvas)
  if (!gray) throw new Error('Unable to convert mask card to grayscale')
  return buildMaskCardTemplate(gray, maskId)
}

export const loadMaskCardTemplates = async (
  options: Array<{ id: string; src: string }>
) => Promise.all(options.map((option) => loadMaskCardTemplateFromUrl(option.src, option.id)))

export const loadMaskOverlayUrl = async (url: string, maxWidth = MAX_OVERLAY_WIDTH) => {
  const cached = overlayUrlCache.get(`${maxWidth}:${url}`)
  if (cached) return cached

  const image = await loadImage(url)
  const naturalWidth = image.naturalWidth || image.width
  if (naturalWidth <= maxWidth) {
    overlayUrlCache.set(`${maxWidth}:${url}`, url)
    return url
  }

  const canvas = drawImageToCanvas(image, maxWidth)
  if (!canvas) return url
  const overlayUrl = canvas.toDataURL('image/png')
  overlayUrlCache.set(`${maxWidth}:${url}`, overlayUrl)
  return overlayUrl
}

export const requestCardFocus = async (
  track: MediaStreamTrack | undefined,
  point: { x: number; y: number }
) => {
  if (!track || typeof track.getCapabilities !== 'function' || typeof track.applyConstraints !== 'function') {
    return false
  }

  const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
    focusMode?: string[]
    pointsOfInterest?: boolean
  }
  const advanced: Record<string, unknown> = {}

  if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('single-shot')) {
    advanced.focusMode = 'single-shot'
  }
  if (capabilities.pointsOfInterest) {
    advanced.pointsOfInterest = [{ x: point.x, y: point.y }]
  }
  if (Object.keys(advanced).length === 0) return false

  try {
    await track.applyConstraints({ advanced: [advanced] } as MediaTrackConstraints)
    return true
  } catch {
    return false
  }
}
