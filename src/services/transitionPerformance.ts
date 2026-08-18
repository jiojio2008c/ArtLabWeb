const imagePreloadCache = new Map<string, Promise<void>>()

const DEFAULT_MEDIA_TIMEOUT_MS = 900

const nextAnimationFrame = () => new Promise<void>((resolve) => {
  window.requestAnimationFrame(() => resolve())
})

const waitForStablePaint = async (frameCount = 2) => {
  const frames = Math.max(1, frameCount)
  for (let frame = 0; frame < frames; frame += 1) {
    await nextAnimationFrame()
  }
}

const waitForElement = <T extends Element>(
  getElement: () => T | null | undefined,
  timeoutMs = 700
) => new Promise<T | null>((resolve) => {
  const startedAt = performance.now()
  let frame = 0
  let timeout = 0
  let settled = false

  const finish = (element: T | null) => {
    if (settled) return
    settled = true
    window.cancelAnimationFrame(frame)
    window.clearTimeout(timeout)
    resolve(element)
  }

  const inspect = () => {
    const element = getElement()
    if (element) {
      finish(element)
      return
    }

    if (performance.now() - startedAt >= Math.max(0, timeoutMs)) {
      finish(null)
      return
    }

    frame = window.requestAnimationFrame(inspect)
  }

  timeout = window.setTimeout(() => finish(null), Math.max(0, timeoutMs))
  inspect()
})

const waitForImageElement = (image: HTMLImageElement, timeoutMs = 900) => new Promise<void>((resolve) => {
  let settled = false
  let timeout = 0

  const finish = () => {
    if (settled) return
    settled = true
    window.clearTimeout(timeout)
    image.removeEventListener('load', handleLoad)
    image.removeEventListener('error', finish)
    resolve()
  }

  const decode = () => {
    const pendingDecode = image.decode?.()
    if (!pendingDecode) {
      finish()
      return
    }
    void pendingDecode.catch(() => undefined).then(finish)
  }

  const handleLoad = () => decode()
  timeout = window.setTimeout(finish, Math.max(0, timeoutMs))

  if (image.complete) {
    if (image.naturalWidth > 0) decode()
    else finish()
    return
  }

  image.addEventListener('load', handleLoad, { once: true })
  image.addEventListener('error', finish, { once: true })
})

const waitForVideoElement = (video: HTMLVideoElement, timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS) => new Promise<void>((resolve) => {
  let settled = false
  let timeout = 0
  let inspectFrame = 0

  const inspect = () => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      finish()
      return
    }
    if (!settled) inspectFrame = window.requestAnimationFrame(inspect)
  }

  const finish = () => {
    if (settled) return
    settled = true
    window.clearTimeout(timeout)
    window.cancelAnimationFrame(inspectFrame)
    video.removeEventListener('loadedmetadata', inspect)
    video.removeEventListener('loadeddata', inspect)
    video.removeEventListener('canplay', inspect)
    video.removeEventListener('error', finish)
    resolve()
  }

  timeout = window.setTimeout(finish, Math.max(0, timeoutMs))
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    finish()
    return
  }

  video.addEventListener('loadedmetadata', inspect, { once: true })
  video.addEventListener('loadeddata', inspect, { once: true })
  video.addEventListener('canplay', inspect, { once: true })
  video.addEventListener('error', finish, { once: true })
  inspect()

  // WebKit can defer loading for a newly mounted muted video until load() is
  // requested explicitly, even when preload="auto" is present.
  if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) {
    try {
      video.load()
    } catch {
      finish()
    }
  }
})

const isElementNearViewport = (element: Element, viewportMargin = 96) => {
  const rect = element.getBoundingClientRect()
  return rect.width > 0
    && rect.height > 0
    && rect.bottom >= -viewportMargin
    && rect.top <= window.innerHeight + viewportMargin
    && rect.right >= -viewportMargin
    && rect.left <= window.innerWidth + viewportMargin
}

const waitForMediaElement = (
  element: HTMLImageElement | HTMLVideoElement,
  timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS
) => element instanceof HTMLImageElement
  ? waitForImageElement(element, timeoutMs)
  : waitForVideoElement(element, timeoutMs)

interface WaitForContainerMediaOptions {
  selector?: string
  timeoutMs?: number
  maxElements?: number
  visibleOnly?: boolean
  viewportMargin?: number
}

const waitForContainerMedia = async (
  container: ParentNode,
  options: WaitForContainerMediaOptions = {}
) => {
  const {
    selector = 'img, video',
    timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS,
    maxElements = 16,
    visibleOnly = true,
    viewportMargin = 96
  } = options
  const media = Array.from(
    container.querySelectorAll<HTMLImageElement | HTMLVideoElement>(selector)
  )
    .filter((element) => !visibleOnly || isElementNearViewport(element, viewportMargin))
    .slice(0, Math.max(0, maxElements))

  await Promise.allSettled(media.map((element) => waitForMediaElement(element, timeoutMs)))
}

const waitForMediaElements = async (
  media: Array<HTMLImageElement | HTMLVideoElement>,
  timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS
) => {
  await Promise.allSettled(media.map((element) => waitForMediaElement(element, timeoutMs)))
}

const prepareTransitionTarget = async (
  getTarget: () => HTMLElement | null | undefined,
  options: WaitForContainerMediaOptions & { targetTimeoutMs?: number; stableFrames?: number } = {}
) => {
  const target = await waitForElement(getTarget, options.targetTimeoutMs ?? 700)
  if (!target) return null

  await waitForStablePaint(1)
  await waitForContainerMedia(target, options)
  await waitForStablePaint(options.stableFrames ?? 2)
  return target
}

const preloadImage = (url: string, timeoutMs = 1200) => {
  if (!url) return Promise.resolve()

  const shouldCache = !url.startsWith('blob:') && !url.startsWith('data:')
  const cached = shouldCache ? imagePreloadCache.get(url) : undefined
  if (cached) return cached

  const image = new Image()
  image.decoding = 'async'
  image.src = url
  const pending = waitForImageElement(image, timeoutMs)

  if (shouldCache) imagePreloadCache.set(url, pending)
  return pending
}

const preloadImages = async (urls: Array<string | null | undefined>, timeoutMs = 1200) => {
  const uniqueUrls = Array.from(new Set(urls.filter((url): url is string => Boolean(url))))
  await Promise.allSettled(uniqueUrls.map((url) => preloadImage(url, timeoutMs)))
}

const scheduleIdleTask = (task: () => void, timeout = 800) => {
  const idleWindow = window as typeof window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
    cancelIdleCallback?: (handle: number) => void
  }

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const requestIdleCallback = idleWindow.requestIdleCallback.bind(window)
    const handle = requestIdleCallback(task, { timeout })
    return () => idleWindow.cancelIdleCallback?.(handle)
  }

  const handle = window.setTimeout(task, Math.min(timeout, 120))
  return () => window.clearTimeout(handle)
}

export {
  isElementNearViewport,
  nextAnimationFrame,
  preloadImage,
  preloadImages,
  prepareTransitionTarget,
  scheduleIdleTask,
  waitForContainerMedia,
  waitForElement,
  waitForImageElement,
  waitForMediaElement,
  waitForMediaElements,
  waitForStablePaint,
  waitForVideoElement
}
