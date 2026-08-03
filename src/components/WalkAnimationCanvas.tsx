import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import {
  drawWalkImage,
  subscribeWalkAnimation
} from '../../desktop-runtime/renderer/walk-animation-core.js'

interface WalkAnimationCanvasProps {
  src: string
  className?: string
  style?: CSSProperties
  ariaLabel?: string
  replayKey?: string | number
  onFirstFrame?: () => void
}

interface CanvasSize {
  width: number
  height: number
  pixelRatio: number
}

const MAX_CANVAS_PIXEL_RATIO = 1.5

const WalkAnimationCanvas = ({
  src,
  className,
  style,
  ariaLabel,
  replayKey = 0,
  onFirstFrame
}: WalkAnimationCanvasProps) => {
  const { t } = useTranslation()
  const resolvedAriaLabel = ariaLabel ?? t('animation.walk')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0, pixelRatio: 1 })
  const startedAtRef = useRef(0)
  const firstFrameDrawnRef = useRef(false)
  const onFirstFrameRef = useRef(onFirstFrame)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    onFirstFrameRef.current = onFirstFrame
  }, [onFirstFrame])

  useEffect(() => {
    const image = new Image()
    let active = true
    firstFrameDrawnRef.current = false
    image.decoding = 'async'
    image.onload = () => {
      if (!active) return
      imageRef.current = image
      startedAtRef.current = performance.now() / 1000
      setImageFailed(false)
    }
    image.onerror = () => {
      if (!active) return
      imageRef.current = null
      setImageFailed(true)
    }
    image.src = src

    return () => {
      active = false
      imageRef.current = null
    }
  }, [src])

  useEffect(() => {
    startedAtRef.current = performance.now() / 1000
    firstFrameDrawnRef.current = false
  }, [replayKey])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const updateSize = () => {
      const width = Math.max(1, canvas.clientWidth)
      const height = Math.max(1, canvas.clientHeight)
      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_PIXEL_RATIO)
      const bitmapWidth = Math.max(1, Math.round(width * pixelRatio))
      const bitmapHeight = Math.max(1, Math.round(height * pixelRatio))

      if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
        canvas.width = bitmapWidth
        canvas.height = bitmapHeight
      }
      sizeRef.current = { width, height, pixelRatio }
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    return subscribeWalkAnimation((timeSeconds) => {
      const canvas = canvasRef.current
      const image = imageRef.current
      const { width, height, pixelRatio } = sizeRef.current
      if (!canvas || !image || width <= 0 || height <= 0) return

      const context = canvas.getContext('2d')
      if (!context) return

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      const elapsed = reduceMotion ? 0 : Math.max(0, timeSeconds - startedAtRef.current)
      drawWalkImage(context, image, 0, 0, width, height, elapsed)
      if (!firstFrameDrawnRef.current) {
        firstFrameDrawnRef.current = true
        onFirstFrameRef.current?.()
      }
    })
  }, [])

  if (imageFailed) {
    return <img src={src} alt={ariaLabel} className={className} style={style} draggable={false} />
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={style}
      role="img"
      aria-label={resolvedAriaLabel}
    />
  )
}

export default WalkAnimationCanvas
