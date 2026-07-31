import { DIRECT_UPLOAD_THEMES } from '../../services/directUploadThemes.ts'

const INTERACTIVE_BACKGROUND_URL = new URL('../../assets/magic-floor-background.webp', import.meta.url).href
const imageCache = new Map<string, Promise<HTMLImageElement>>()

const loadInteractiveImage = (url: string): Promise<HTMLImageElement> => {
  const cached = imageCache.get(url)
  if (cached) return cached

  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.addEventListener('load', () => {
      const decode = image.decode?.()
      if (decode) {
        void decode.catch(() => undefined).finally(() => resolve(image))
        return
      }
      resolve(image)
    }, { once: true })
    image.addEventListener('error', () => reject(new Error(`Unable to preload image: ${url}`)), { once: true })
    image.src = url
  })

  imageCache.set(url, pending)
  return pending
}

const preloadInteractiveTransitionAssets = async () => {
  const urls = [INTERACTIVE_BACKGROUND_URL, ...DIRECT_UPLOAD_THEMES.map((theme) => theme.cover)]
  await Promise.allSettled(urls.map(loadInteractiveImage))
}

export {
  INTERACTIVE_BACKGROUND_URL,
  loadInteractiveImage,
  preloadInteractiveTransitionAssets
}
