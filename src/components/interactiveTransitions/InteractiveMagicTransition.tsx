import { useEffect, useRef, type RefObject } from 'react'
import { gsap } from 'gsap'
import type { DynamicTransitionOrigin } from '../dynamicTransitions/types.ts'
import {
  INTERACTIVE_BACKGROUND_URL,
  loadInteractiveImage,
  preloadInteractiveTransitionAssets
} from './preloadInteractiveAssets.ts'

interface InteractiveMagicTransitionProps {
  origin: DynamicTransitionOrigin
  sourceRootRef: RefObject<HTMLElement>
  sourceCardRef: RefObject<HTMLButtonElement>
  onSceneSwitch: () => void
  onComplete: () => void
}

interface PaperPiece {
  points: ReadonlyArray<readonly [number, number]>
  x: number
  y: number
  ry: number
  rz: number
}

interface CanvasMotion {
  paperOpacity: number
  tearProgress: number
  riftProgress: number
  sparkProgress: number
  streakProgress: number
}

const PAPER_PIECES: PaperPiece[] = [
  { points: [[0, 0], [.52, 0], [.48, .34], [.53, .51], [.46, .72], [.5, 1], [0, 1]], x: -.42, y: 0, ry: 34, rz: -5 },
  { points: [[.48, 0], [1, 0], [1, 1], [.5, 1], [.54, .72], [.47, .51], [.52, .34]], x: .42, y: 0, ry: -34, rz: 5 },
  { points: [[0, 0], [1, 0], [1, .27], [.75, .24], [.52, .31], [.27, .23], [0, .29]], x: 0, y: -.38, ry: 0, rz: -3 },
  { points: [[0, .74], [.28, .78], [.49, .7], [.74, .79], [1, .72], [1, 1], [0, 1]], x: 0, y: .42, ry: 0, rz: 3 },
  { points: [[0, .25], [.29, .22], [.47, .5], [.24, .57], [0, .54]], x: -.35, y: -.14, ry: 28, rz: 9 },
  { points: [[.72, .2], [1, .25], [1, .56], [.76, .59], [.52, .49]], x: .35, y: -.12, ry: -28, rz: -9 },
  { points: [[0, .52], [.24, .56], [.48, .51], [.46, .76], [.27, .8], [0, .73]], x: -.38, y: .19, ry: 25, rz: -8 },
  { points: [[.53, .5], [.76, .57], [1, .52], [1, .75], [.74, .81], [.54, .73]], x: .38, y: .2, ry: -25, rz: 8 }
]

const MAGIC_SPARKS = Array.from({ length: 42 }, (_, index) => {
  const angle = index * 2.3999632297
  const radius = 0.18 + (index % 11) / 16
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    size: 2 + (index % 4),
    color: index % 3 === 0 ? '#9cf8ff' : index % 3 === 1 ? '#f58cff' : '#d7ff87'
  }
})

const MAGIC_STREAK_COUNT = 14
const MAGIC_RIFT_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-.012, -.5],
  [.008, -.39],
  [-.018, -.27],
  [.014, -.14],
  [0, 0],
  [-.013, .13],
  [.019, .26],
  [-.007, .39],
  [.012, .5]
]

const clamp = (value: number, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value))
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3)

const sampleMagicRift = (progress: number): readonly [number, number] => {
  const scaledProgress = clamp(progress) * (MAGIC_RIFT_POINTS.length - 1)
  const startIndex = Math.floor(scaledProgress)
  const endIndex = Math.min(MAGIC_RIFT_POINTS.length - 1, startIndex + 1)
  const segmentProgress = scaledProgress - startIndex
  const startPoint = MAGIC_RIFT_POINTS[startIndex]
  const endPoint = MAGIC_RIFT_POINTS[endIndex]
  return [
    startPoint[0] + (endPoint[0] - startPoint[0]) * segmentProgress,
    startPoint[1] + (endPoint[1] - startPoint[1]) * segmentProgress
  ]
}

const getTransitionCanvasDpr = () => {
  const deviceDpr = window.devicePixelRatio || 1
  const isTabletViewport = window.matchMedia('(pointer: coarse)').matches
    && Math.max(window.innerWidth, window.innerHeight) <= 1400
  return Math.min(deviceDpr, isTabletViewport ? 1.5 : 2)
}

const configureCanvas = (canvas: HTMLCanvasElement) => {
  const width = window.innerWidth
  const height = window.innerHeight
  const dpr = getTransitionCanvasDpr()
  canvas.width = Math.max(1, Math.round(width * dpr))
  canvas.height = Math.max(1, Math.round(height * dpr))
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const context = canvas.getContext('2d', { alpha: true })
  context?.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { context, width, height }
}

const tracePaperPiece = (
  context: CanvasRenderingContext2D,
  piece: PaperPiece,
  width: number,
  height: number
) => {
  context.beginPath()
  piece.points.forEach(([x, y], index) => {
    const pointX = x * width
    const pointY = y * height
    if (index === 0) context.moveTo(pointX, pointY)
    else context.lineTo(pointX, pointY)
  })
  context.closePath()
}

const drawCoverImage = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number
) => {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  context.drawImage(image, (width - drawWidth) / 2, height - drawHeight, drawWidth, drawHeight)
}

const drawPaperCanvas = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  motion: CanvasMotion,
  width: number,
  height: number
) => {
  context.clearRect(0, 0, width, height)
  if (!image || motion.paperOpacity <= 0) return

  PAPER_PIECES.forEach((piece) => {
    const progress = motion.tearProgress
    const rotationYScale = Math.max(.76, Math.cos((piece.ry * progress * Math.PI) / 180))
    const scale = 1 + .08 * progress

    context.save()
    context.globalAlpha = motion.paperOpacity * (1 - progress)
    context.translate(
      width / 2 + piece.x * width * progress,
      height / 2 + piece.y * height * progress
    )
    context.rotate((piece.rz * progress * Math.PI) / 180)
    context.scale(scale * rotationYScale, scale)
    context.translate(-width / 2, -height / 2)
    tracePaperPiece(context, piece, width, height)
    context.clip()
    drawCoverImage(context, image, width, height)
    context.restore()
  })
}

const drawEffectsCanvas = (
  context: CanvasRenderingContext2D,
  motion: CanvasMotion,
  width: number,
  height: number
) => {
  context.clearRect(0, 0, width, height)
  context.save()
  context.globalCompositeOperation = 'screen'

  const riftReveal = clamp(motion.riftProgress / .34)
  const riftFade = 1 - clamp((motion.riftProgress - .58) / .42)
  const riftAlpha = riftReveal * riftFade
  if (riftAlpha > 0) {
    const riftWidth = Math.min(width, height)
    const traceRift = () => {
      context.beginPath()
      MAGIC_RIFT_POINTS.forEach(([x, y], index) => {
        const pointX = x * riftWidth
        const pointY = y * height * .92
        if (index === 0) context.moveTo(pointX, pointY)
        else context.lineTo(pointX, pointY)
      })
    }

    context.save()
    context.translate(width / 2, height / 2)
    context.scale(1, riftReveal)
    context.lineCap = 'butt'
    context.lineJoin = 'miter'

    traceRift()
    context.globalAlpha = riftAlpha * .2
    context.strokeStyle = 'rgba(237,105,255,.9)'
    context.lineWidth = 12
    context.stroke()

    traceRift()
    context.globalAlpha = riftAlpha * .56
    context.strokeStyle = 'rgba(111,244,255,.96)'
    context.lineWidth = 4
    context.stroke()

    traceRift()
    context.globalAlpha = riftAlpha
    context.strokeStyle = 'rgba(255,255,255,.98)'
    context.lineWidth = 1.35
    context.stroke()

    const branchReveal = clamp((riftReveal - .38) / .62)
    if (branchReveal > 0) {
      const branches = [
        { y: -.28, x: -.075, dy: -.055 },
        { y: -.12, x: .065, dy: -.045 },
        { y: .11, x: -.07, dy: .05 },
        { y: .27, x: .08, dy: .06 }
      ]
      context.globalAlpha = riftAlpha * branchReveal * .72
      context.strokeStyle = 'rgba(151,248,255,.94)'
      context.lineWidth = 1.5
      branches.forEach((branch) => {
        context.beginPath()
        context.moveTo(0, branch.y * height)
        context.lineTo(branch.x * riftWidth, (branch.y + branch.dy) * height)
        context.stroke()
      })
    }

    context.restore()
  }

  MAGIC_SPARKS.forEach((spark, index) => {
    const delay = index * .0038
    const localProgress = clamp((motion.sparkProgress - delay) / Math.max(.01, 1 - delay))
    if (localProgress <= 0 || localProgress >= 1) return
    const travel = easeOutCubic(localProgress)
    const alpha = localProgress < .18 ? localProgress / .18 : 1 - (localProgress - .18) / .82
    const x = width / 2 + spark.x * width * travel
    const y = height / 2 + spark.y * height * travel
    const radius = Math.max(1, spark.size * (.55 + .45 * (1 - localProgress)))
    const glow = context.createRadialGradient(x, y, 0, x, y, radius * 3.2)
    glow.addColorStop(0, spark.color)
    glow.addColorStop(.34, `${spark.color}cc`)
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    context.globalAlpha = alpha * (index % 4 === 0 ? 1 : .74)
    context.fillStyle = glow
    context.beginPath()
    context.arc(x, y, radius * 3.2, 0, Math.PI * 2)
    context.fill()
  })

  for (let index = 0; index < MAGIC_STREAK_COUNT; index += 1) {
    const delay = index * .018
    const localProgress = clamp((motion.streakProgress - delay) / Math.max(.01, 1 - delay))
    if (localProgress <= 0 || localProgress >= 1) continue
    const reveal = localProgress < .34 ? localProgress / .34 : 1
    const alpha = localProgress < .34 ? reveal : 1 - (localProgress - .34) / .66
    const length = Math.min(width * .38, 470) * reveal * (1 + .5 * localProgress)
    const riftPosition = .08 + (index / (MAGIC_STREAK_COUNT - 1)) * .84
    const [riftX, riftY] = sampleMagicRift(riftPosition)
    const side = index % 2 === 0 ? -1 : 1
    const angleJitter = ((index % 4) - 1.5) * .045
    const angle = Math.atan2((riftY / .5) * .42 + angleJitter, side)
    const originX = width / 2 + riftX * Math.min(width, height)
    const originY = height / 2 + riftY * height * .92

    context.save()
    context.translate(originX, originY)
    context.rotate(angle)
    const streakGradient = context.createLinearGradient(0, 0, length, 0)
    streakGradient.addColorStop(0, 'rgba(255,255,255,.78)')
    streakGradient.addColorStop(.38, 'rgba(119,244,255,.72)')
    streakGradient.addColorStop(.72, 'rgba(237,105,255,.18)')
    streakGradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.globalAlpha = alpha * .78
    context.strokeStyle = streakGradient
    context.lineWidth = 1.8
    context.beginPath()
    context.moveTo(0, 0)
    context.lineTo(length, 0)
    context.stroke()
    context.restore()
  }

  context.restore()
}

const waitForElement = <T extends Element>(selector: string, attempts = 24): Promise<T | null> => new Promise((resolve) => {
  const inspect = (remaining: number) => {
    const element = document.querySelector<T>(selector)
    if (element || remaining <= 0) {
      resolve(element)
      return
    }
    window.requestAnimationFrame(() => inspect(remaining - 1))
  }
  inspect(attempts)
})

const waitForPaint = () => new Promise<void>((resolve) => {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
})

const InteractiveMagicTransition: React.FC<InteractiveMagicTransitionProps> = ({
  sourceRootRef,
  sourceCardRef,
  onSceneSwitch,
  onComplete
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const voidRef = useRef<HTMLDivElement>(null)
  const paperCanvasRef = useRef<HTMLCanvasElement>(null)
  const effectsCanvasRef = useRef<HTMLCanvasElement>(null)
  const sceneSwitchRef = useRef(onSceneSwitch)
  const completeRef = useRef(onComplete)

  useEffect(() => {
    sceneSwitchRef.current = onSceneSwitch
    completeRef.current = onComplete
  }, [onComplete, onSceneSwitch])

  useEffect(() => {
    const root = rootRef.current
    const voidLayer = voidRef.current
    const paperCanvas = paperCanvasRef.current
    const effectsCanvas = effectsCanvasRef.current
    const sourceRoot = sourceRootRef.current
    const sourceCard = sourceCardRef.current

    if (!root || !voidLayer || !paperCanvas || !effectsCanvas || !sourceRoot || !sourceCard) {
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const otherCard = sourceRoot.querySelector<HTMLElement>('.dynamic-choice-card')
    const topbar = sourceRoot.querySelector<HTMLElement>('.entry-topbar')
    const timelines: gsap.core.Timeline[] = []
    const cleanupTargets = new Set<Element>()
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    let cancelled = false
    let sceneSwitched = false
    let finishPending = false
    let paperImage: HTMLImageElement | null = null
    const canvasMotion: CanvasMotion = {
      paperOpacity: 0,
      tearProgress: 0,
      riftProgress: 0,
      sparkProgress: 0,
      streakProgress: 0
    }
    const paperSurface = configureCanvas(paperCanvas)
    const effectsSurface = configureCanvas(effectsCanvas)
    const renderCanvases = () => {
      if (paperSurface.context) {
        drawPaperCanvas(paperSurface.context, paperImage, canvasMotion, paperSurface.width, paperSurface.height)
      }
      if (effectsSurface.context) {
        drawEffectsCanvas(effectsSurface.context, canvasMotion, effectsSurface.width, effectsSurface.height)
      }
    }
    gsap.ticker.add(renderCanvases)
    void loadInteractiveImage(INTERACTIVE_BACKGROUND_URL).then((image) => {
      paperImage = image
      renderCanvases()
    }).catch(() => undefined)
    void preloadInteractiveTransitionAssets()

    const remember = (...targets: Array<Element | null | undefined>) => {
      targets.forEach((target) => {
        if (target) cleanupTargets.add(target)
      })
    }

    const switchScene = () => {
      if (sceneSwitched || cancelled) return
      sceneSwitched = true
      sceneSwitchRef.current()
    }

    const finish = () => {
      if (cancelled || finishPending) return
      finishPending = true
      void waitForPaint().then(() => {
        if (!cancelled) completeRef.current()
      })
    }

    const revealTarget = async () => {
      switchScene()
      const scene = await waitForElement<HTMLElement>('.direct-select-screen')
      if (!scene || cancelled) {
        finish()
        return
      }

      await waitForPaint()
      if (cancelled) return

      const header = scene.querySelector<HTMLElement>('.direct-magic-header')
      const themeCardMotions = Array.from(scene.querySelectorAll<HTMLElement>('.direct-theme-card-motion'))
      const maskBadges = Array.from(scene.querySelectorAll<HTMLElement>('.direct-theme-mask'))
      remember(scene, header, ...themeCardMotions, ...maskBadges)

      gsap.set(scene, { opacity: 1 })
      gsap.set(header ? [header] : [], { opacity: 0, y: -24 })
      gsap.set(maskBadges, { opacity: 0, y: 12, scale: 0.9 })
      gsap.killTweensOf(themeCardMotions)
      gsap.set(themeCardMotions, { clearProps: 'opacity,transform,filter' })

      themeCardMotions.forEach((themeCardMotion, index) => {
        const rect = themeCardMotion.getBoundingClientRect()
        gsap.set(themeCardMotion, reducedMotion
          ? { opacity: 0, y: 16 }
          : {
              opacity: 0,
              x: centerX - (rect.left + rect.width / 2),
              y: centerY - (rect.top + rect.height / 2),
              scale: 0.34,
              rotationY: [48, 22, -22, -48][index] ?? 0,
              rotationZ: [-8, -3, 3, 8][index] ?? 0,
              transformPerspective: 1000,
              transformOrigin: 'center center'
            })
      })

      const reveal = gsap.timeline({ onComplete: finish })
        .to(themeCardMotions, {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          rotationY: 0,
          rotationZ: 0,
          duration: reducedMotion ? 0.24 : 0.46,
          stagger: reducedMotion ? 0.025 : 0.06,
          ease: reducedMotion ? 'power1.out' : 'power4.out'
        }, 0)
        .to(header ? [header] : [], {
          opacity: 1,
          y: 0,
          duration: reducedMotion ? 0.2 : 0.34,
          ease: 'power2.out'
        }, reducedMotion ? 0.08 : 0.24)
        .to(maskBadges, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: reducedMotion ? 0.18 : 0.3,
          stagger: 0.045,
          ease: reducedMotion ? 'power1.out' : 'back.out(1.7)'
        }, reducedMotion ? 0.12 : 0.34)
        .to(voidLayer, { opacity: 0, duration: reducedMotion ? 0.14 : 0.22, ease: 'power1.out' }, reducedMotion ? 0.1 : 0.14)
        .to({}, { duration: 0.02 }, reducedMotion ? 0.34 : 0.66)
      timelines.push(reveal)
    }

    gsap.set(voidLayer, { opacity: 0 })
    remember(sourceRoot, sourceCard, otherCard, topbar)

    if (reducedMotion) {
      gsap.set([paperCanvas, effectsCanvas], { display: 'none' })
      const reducedTimeline = gsap.timeline()
        .to(sourceRoot, { opacity: 0, duration: 0.18, ease: 'power1.out' }, 0)
        .call(() => { void revealTarget() }, [], 0.1)
      timelines.push(reducedTimeline)
    } else {
      const timeline = gsap.timeline({ defaults: { overwrite: 'auto' } })
        .to(otherCard, {
          x: -120,
          scale: 0.9,
          opacity: 0,
          duration: 0.24,
          ease: 'power2.inOut'
        }, 0)
        .to(topbar, { opacity: 0, y: -18, duration: 0.22, ease: 'power2.in' }, 0.03)
        .to(sourceCard, {
          scale: 1.06,
          zIndex: 8,
          boxShadow: '0 0 0 2px rgba(255,255,255,.9), 0 0 34px rgba(113,241,255,.86), 0 0 76px rgba(238,95,255,.64)',
          duration: 0.2,
          ease: 'power2.out'
        }, 0)
        .to(voidLayer, { opacity: 1, duration: 0.34, ease: 'power2.inOut' }, 0.18)
        .to(canvasMotion, {
          riftProgress: 1,
          duration: 0.44,
          ease: 'power2.out'
        }, 0.18)
        .to(canvasMotion, { paperOpacity: 1, duration: 0.05, ease: 'none' }, 0.21)
        .to(sourceCard, {
          opacity: 0,
          scale: 1.12,
          duration: 0.2,
          ease: 'power2.in'
        }, 0.22)
        .to(canvasMotion, {
          tearProgress: 1,
          duration: 0.46,
          ease: 'power3.in'
        }, 0.28)
        .to(sourceRoot, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.36)
        .to(canvasMotion, {
          sparkProgress: 1,
          duration: 0.46,
          ease: 'power2.out'
        }, 0.22)
        .to(canvasMotion, {
          streakProgress: 1,
          duration: 0.38,
          ease: 'power2.out'
        }, 0.22)
        .to(effectsCanvas, { opacity: 0, duration: 0.16, ease: 'power1.out' }, 0.52)
        .to(paperCanvas, { opacity: 0, duration: 0.14, ease: 'power1.out' }, 0.56)
        .call(() => { void revealTarget() }, [], 0.38)
      timelines.push(timeline)
    }

    return () => {
      cancelled = true
      gsap.ticker.remove(renderCanvases)
      timelines.forEach((timeline) => timeline.kill())
      cleanupTargets.forEach((target) => {
        gsap.set(target, { clearProps: 'opacity,transform,boxShadow,zIndex' })
      })
    }
  }, [sourceCardRef, sourceRootRef])

  return (
    <div ref={rootRef} className="interactive-magic-transition" aria-hidden="true">
      <div ref={voidRef} className="interactive-magic-void" />
      <canvas ref={paperCanvasRef} className="interactive-magic-paper-canvas" />
      <canvas ref={effectsCanvasRef} className="interactive-magic-effects-canvas" />
    </div>
  )
}

export default InteractiveMagicTransition
