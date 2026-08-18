import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import {
  drawUnityAnimationImage,
  subscribeUnityAnimationFrame,
  UNITY_EXTRA_ANIMATION_DEFINITIONS
} from '../../desktop-runtime/renderer/unity-animation-core.js'

interface UnityAnimationCanvasProps {
  src: string
  animationId: number
  className?: string
  style?: CSSProperties
  ariaLabel: string
  replayKey?: string | number
  startedAtMs?: number
  overscanX?: number
  overscanY?: number
  forceLoop?: boolean
  onFirstFrame?: () => void
}

interface CanvasSize {
  width: number
  height: number
  pixelRatio: number
}

const MAX_CANVAS_PIXEL_RATIO = 1.5

const UnityAnimationCanvas = ({
  src,
  animationId,
  className,
  style,
  ariaLabel,
  replayKey = 0,
  startedAtMs,
  overscanX = 1,
  overscanY = 1,
  forceLoop = false,
  onFirstFrame
}: UnityAnimationCanvasProps) => {
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
      startedAtRef.current = (startedAtMs ?? performance.now()) / 1000
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
  }, [src, startedAtMs])

  useEffect(() => {
    startedAtRef.current = (startedAtMs ?? performance.now()) / 1000
    firstFrameDrawnRef.current = false
  }, [animationId, replayKey, startedAtMs])

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
    const loopDuration = forceLoop
      ? UNITY_EXTRA_ANIMATION_DEFINITIONS.find((definition) => definition.id === animationId)?.duration ?? 0
      : 0

    return subscribeUnityAnimationFrame((timeSeconds) => {
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

      const contentWidth = width / Math.max(1, overscanX)
      const contentHeight = height / Math.max(1, overscanY)
      const elapsed = reduceMotion ? 0 : Math.max(0, timeSeconds - startedAtRef.current)
      const animationTime = loopDuration > 0 ? elapsed % loopDuration : elapsed
      drawUnityAnimationImage(
        context,
        image,
        (width - contentWidth) / 2,
        (height - contentHeight) / 2,
        contentWidth,
        contentHeight,
        animationId,
        animationTime
      )
      if (!firstFrameDrawnRef.current) {
        firstFrameDrawnRef.current = true
        onFirstFrameRef.current?.()
      }
    })
  }, [animationId, forceLoop, overscanX, overscanY])

  if (imageFailed) {
    return <img src={src} alt={ariaLabel} className={className} style={style} draggable={false} />
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        ...style,
        width: `${overscanX * 100}%`,
        height: `${overscanY * 100}%`
      }}
      role="img"
      aria-label={ariaLabel}
    />
  )
}

export default UnityAnimationCanvas
