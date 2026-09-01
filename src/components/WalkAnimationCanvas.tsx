import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  drawWalkImage,
  subscribeWalkAnimation
} from '../../desktop-runtime/renderer/walk-animation-core.js'
import { resolveCanvasBitmapScale } from '../services/canvasRenderQuality.ts'
import {
  acquireCanvasImage,
  canvasHasVisibleAlpha
} from '../services/canvasRenderSupport.ts'

interface WalkAnimationCanvasProps {
  src: string
  sourceImage?: HTMLImageElement | null
  className?: string
  style?: CSSProperties
  ariaLabel?: string
  replayKey?: string | number
  startedAtMs?: number
  renderScale?: number
  onFirstFrame?: () => void
  onFrameUnavailable?: () => void
}

interface CanvasSize {
  width: number
  height: number
  scaleX: number
  scaleY: number
}

const FIRST_FRAME_VALIDATION_INTERVAL = 2
const FIRST_FRAME_VALIDATION_ATTEMPTS = 8
const FIRST_FRAME_VISIBLE_STREAK = 2
const MAX_CANVAS_REBUILD_ATTEMPTS = 2

const WalkAnimationCanvas = ({
  src,
  sourceImage,
  className,
  style,
  ariaLabel,
  replayKey = 0,
  startedAtMs,
  renderScale = 1,
  onFirstFrame,
  onFrameUnavailable
}: WalkAnimationCanvasProps) => {
  const { t } = useTranslation()
  const resolvedAriaLabel = ariaLabel ?? t('animation.walk')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0, scaleX: 1, scaleY: 1 })
  const startedAtRef = useRef(0)
  const firstFrameDrawnRef = useRef(false)
  const firstFrameValidationAttemptsRef = useRef(0)
  const firstFrameValidationFramesRef = useRef(0)
  const firstFrameVisibleStreakRef = useRef(0)
  const contextLostRef = useRef(false)
  const canvasRebuildAttemptsRef = useRef(0)
  const onFirstFrameRef = useRef(onFirstFrame)
  const onFrameUnavailableRef = useRef(onFrameUnavailable)
  const startedAtMsRef = useRef(startedAtMs)
  const [imageFailed, setImageFailed] = useState(false)
  const [sourceRevision, setSourceRevision] = useState(0)
  const [canvasGeneration, setCanvasGeneration] = useState(0)
  startedAtMsRef.current = startedAtMs

  const invalidateFirstFrame = useCallback(() => {
    const wasReady = firstFrameDrawnRef.current
    firstFrameDrawnRef.current = false
    firstFrameValidationAttemptsRef.current = 0
    firstFrameValidationFramesRef.current = 0
    firstFrameVisibleStreakRef.current = 0
    if (wasReady) {
      onFrameUnavailableRef.current?.()
    }
  }, [])

  const requestCanvasRebuild = useCallback(() => {
    if (canvasRebuildAttemptsRef.current >= MAX_CANVAS_REBUILD_ATTEMPTS) return
    canvasRebuildAttemptsRef.current += 1
    setCanvasGeneration((current) => current + 1)
  }, [])

  useEffect(() => {
    onFirstFrameRef.current = onFirstFrame
    onFrameUnavailableRef.current = onFrameUnavailable
  }, [onFirstFrame, onFrameUnavailable])

  useEffect(() => {
    let active = true
    invalidateFirstFrame()
    imageRef.current = null
    setImageFailed(false)

    const useImage = (image: HTMLImageElement) => {
      if (!active) return
      imageRef.current = image
      startedAtRef.current = (startedAtMsRef.current ?? performance.now()) / 1000
      setImageFailed(false)
      setSourceRevision((current) => current + 1)
    }

    if (sourceImage !== undefined) {
      if (sourceImage && sourceImage.naturalWidth > 0 && sourceImage.naturalHeight > 0) {
        useImage(sourceImage)
      }
      return () => {
        active = false
        imageRef.current = null
      }
    }

    const imageLease = acquireCanvasImage(src)

    void imageLease.loaded.then(useImage, () => {
      if (!active) return
      imageRef.current = null
      setImageFailed(true)
    })

    return () => {
      active = false
      imageRef.current = null
      imageLease.release()
    }
  }, [invalidateFirstFrame, sourceImage, src])

  useEffect(() => {
    startedAtRef.current = (startedAtMs ?? performance.now()) / 1000
    canvasRebuildAttemptsRef.current = 0
    invalidateFirstFrame()
  }, [invalidateFirstFrame, replayKey, startedAtMs])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    contextLostRef.current = false

    const updateSize = () => {
      const width = Math.max(1, canvas.clientWidth)
      const height = Math.max(1, canvas.clientHeight)
      const source = imageRef.current
      const bitmapScale = resolveCanvasBitmapScale({
        width,
        height,
        renderScale,
        sourceWidth: source?.naturalWidth,
        sourceHeight: source?.naturalHeight
      })
      const bitmapWidth = Math.max(1, Math.round(width * bitmapScale.x))
      const bitmapHeight = Math.max(1, Math.round(height * bitmapScale.y))

      if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
        invalidateFirstFrame()
        canvas.width = bitmapWidth
        canvas.height = bitmapHeight
      }
      sizeRef.current = { width, height, scaleX: bitmapScale.x, scaleY: bitmapScale.y }
    }

    const handleContextLost = (event: Event) => {
      if (event.cancelable) event.preventDefault()
      contextLostRef.current = true
      invalidateFirstFrame()
      requestCanvasRebuild()
    }
    const handleContextRestored = () => {
      contextLostRef.current = false
      invalidateFirstFrame()
      updateSize()
    }

    canvas.addEventListener('contextlost', handleContextLost)
    canvas.addEventListener('contextrestored', handleContextRestored)
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      canvas.removeEventListener('contextlost', handleContextLost)
      canvas.removeEventListener('contextrestored', handleContextRestored)
    }
  }, [canvasGeneration, invalidateFirstFrame, renderScale, requestCanvasRebuild, sourceRevision])

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    return subscribeWalkAnimation((timeSeconds) => {
      const canvas = canvasRef.current
      const image = imageRef.current
      const { width, height, scaleX, scaleY } = sizeRef.current
      if (!canvas || !image || width <= 0 || height <= 0 || contextLostRef.current) return

      const context = canvas.getContext('2d')
      const recoverableContext = context as CanvasRenderingContext2D & {
        isContextLost?: () => boolean
      }
      if (!context || recoverableContext.isContextLost?.()) {
        invalidateFirstFrame()
        requestCanvasRebuild()
        return
      }

      try {
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.setTransform(scaleX, 0, 0, scaleY, 0, 0)
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        const elapsed = reduceMotion ? 0 : Math.max(0, timeSeconds - startedAtRef.current)
        drawWalkImage(context, image, 0, 0, width, height, elapsed)
      } catch {
        invalidateFirstFrame()
        requestCanvasRebuild()
        return
      }

      if (
        firstFrameDrawnRef.current
        || firstFrameValidationAttemptsRef.current >= FIRST_FRAME_VALIDATION_ATTEMPTS
      ) return

      firstFrameValidationFramesRef.current += 1
      if (firstFrameValidationFramesRef.current % FIRST_FRAME_VALIDATION_INTERVAL !== 0) return

      firstFrameValidationAttemptsRef.current += 1
      if (canvasHasVisibleAlpha(canvas)) {
        firstFrameVisibleStreakRef.current += 1
      } else {
        firstFrameVisibleStreakRef.current = 0
      }
      if (firstFrameVisibleStreakRef.current >= FIRST_FRAME_VISIBLE_STREAK) {
        canvasRebuildAttemptsRef.current = 0
        firstFrameDrawnRef.current = true
        onFirstFrameRef.current?.()
      }
    })
  }, [invalidateFirstFrame, requestCanvasRebuild])

  if (imageFailed) {
    return <img src={src} alt={resolvedAriaLabel} className={className} style={style} draggable={false} />
  }

  return (
    <canvas
      key={canvasGeneration}
      ref={canvasRef}
      className={className}
      style={style}
      role="img"
      aria-label={resolvedAriaLabel}
    />
  )
}

export default WalkAnimationCanvas
