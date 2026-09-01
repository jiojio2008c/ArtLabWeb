interface CanvasImageLease {
  image: HTMLImageElement
  loaded: Promise<HTMLImageElement>
  release: () => void
}

type CanvasImageStatus = 'loading' | 'loaded' | 'failed' | 'disposed'

interface CanvasImageCacheEntry {
  src: string
  image: HTMLImageElement
  loaded: Promise<HTMLImageElement>
  resolve: (image: HTMLImageElement) => void
  reject: (error: Error) => void
  references: number
  status: CanvasImageStatus
  cleanupTimer: ReturnType<typeof setTimeout> | null
}

const IMAGE_CACHE_GRACE_MS = 1000
const ALPHA_PROBE_EDGE = 32
const MIN_VISIBLE_ALPHA_SAMPLES = 4
const MIN_VISIBLE_ALPHA_TOTAL = 128
const imageCache = new Map<string, CanvasImageCacheEntry>()
let alphaProbeCanvas: HTMLCanvasElement | null = null

const disposeImageEntry = (entry: CanvasImageCacheEntry, aborted = false) => {
  if (entry.status === 'disposed') return

  const wasLoading = entry.status === 'loading'
  entry.status = 'disposed'
  if (entry.cleanupTimer !== null) {
    clearTimeout(entry.cleanupTimer)
    entry.cleanupTimer = null
  }
  entry.image.onload = null
  entry.image.onerror = null
  entry.image.removeAttribute('src')
  if (imageCache.get(entry.src) === entry) {
    imageCache.delete(entry.src)
  }
  if (aborted && wasLoading) {
    entry.reject(new Error('Canvas image loading was cancelled'))
  }
}

const scheduleImageCleanup = (entry: CanvasImageCacheEntry) => {
  if (entry.references > 0 || entry.status !== 'loaded') return

  entry.cleanupTimer = setTimeout(() => {
    entry.cleanupTimer = null
    if (entry.references === 0) {
      disposeImageEntry(entry)
    }
  }, IMAGE_CACHE_GRACE_MS)
}

const createImageEntry = (src: string) => {
  const image = new Image()
  let resolveImage: (image: HTMLImageElement) => void = () => undefined
  let rejectImage: (error: Error) => void = () => undefined
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    resolveImage = resolve
    rejectImage = reject
  })
  loaded.catch(() => undefined)

  const entry: CanvasImageCacheEntry = {
    src,
    image,
    loaded,
    resolve: resolveImage,
    reject: rejectImage,
    references: 0,
    status: 'loading',
    cleanupTimer: null
  }

  const finishLoading = () => {
    if (entry.status !== 'loading') return
    entry.status = 'loaded'
    image.onload = null
    image.onerror = null
    entry.resolve(image)
    scheduleImageCleanup(entry)
  }

  const failLoading = () => {
    if (entry.status !== 'loading') return
    entry.status = 'failed'
    image.onload = null
    image.onerror = null
    if (imageCache.get(src) === entry) {
      imageCache.delete(src)
    }
    entry.reject(new Error('Unable to load canvas image'))
  }

  image.decoding = 'async'
  image.onload = () => {
    image.onload = null
    if (typeof image.decode !== 'function') {
      finishLoading()
      return
    }

    void image.decode().then(finishLoading, () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        finishLoading()
      } else {
        failLoading()
      }
    })
  }
  image.onerror = failLoading
  imageCache.set(src, entry)
  image.src = src
  return entry
}

const acquireCanvasImage = (src: string): CanvasImageLease => {
  const entry = imageCache.get(src) ?? createImageEntry(src)
  if (entry.cleanupTimer !== null) {
    clearTimeout(entry.cleanupTimer)
    entry.cleanupTimer = null
  }
  entry.references += 1
  let released = false

  return {
    image: entry.image,
    loaded: entry.loaded,
    release: () => {
      if (released) return
      released = true
      entry.references = Math.max(0, entry.references - 1)
      if (entry.references > 0) return

      if (entry.status === 'loading') {
        disposeImageEntry(entry, true)
      } else if (entry.status === 'loaded') {
        scheduleImageCleanup(entry)
      } else {
        disposeImageEntry(entry)
      }
    }
  }
}

const canvasHasVisibleAlpha = (sourceCanvas: HTMLCanvasElement) => {
  if (sourceCanvas.width <= 0 || sourceCanvas.height <= 0) return false

  try {
    if (!alphaProbeCanvas) {
      alphaProbeCanvas = document.createElement('canvas')
    }
    alphaProbeCanvas.width = ALPHA_PROBE_EDGE
    alphaProbeCanvas.height = ALPHA_PROBE_EDGE
    const context = alphaProbeCanvas.getContext('2d', { willReadFrequently: true })
    if (!context) return false

    context.drawImage(
      sourceCanvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
      0,
      0,
      ALPHA_PROBE_EDGE,
      ALPHA_PROBE_EDGE
    )
    const pixels = context.getImageData(
      0,
      0,
      ALPHA_PROBE_EDGE,
      ALPHA_PROBE_EDGE
    ).data
    let visibleSamples = 0
    let alphaTotal = 0
    for (let index = 3; index < pixels.length; index += 4) {
      const alpha = pixels[index]
      if (alpha <= 0) continue
      visibleSamples += 1
      alphaTotal += alpha
    }
    return visibleSamples >= MIN_VISIBLE_ALPHA_SAMPLES
      && alphaTotal >= MIN_VISIBLE_ALPHA_TOTAL
  } catch {
    alphaProbeCanvas = null
    return false
  }
}

export { acquireCanvasImage, canvasHasVisibleAlpha }
