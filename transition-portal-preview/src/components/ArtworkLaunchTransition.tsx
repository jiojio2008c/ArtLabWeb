import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { gsap } from 'gsap'

interface ArtworkLaunchTransitionProps {
  sourceRef: RefObject<HTMLElement>
  sourceUrl: string
  maskUrl: string
  accent: string
  secondary: string
  adjustmentRef: RefObject<HTMLElement>
  onComplete: () => void
}

interface LaunchStar {
  color: string
  delay: number
  drift: number
  fall: number
  kind: 'hero' | 'spark'
  sizeRatio: number
  duration: number
  rotation: number
}

const STAR_COLORS = ['#ffe85f', '#ffffff', '#ff8fd4', '#71e9ff', '#ac8cff']

const buildStars = (): LaunchStar[] => Array.from({ length: 24 }, (_, index) => {
  const kind = index % 3 === 2 ? 'spark' : 'hero'

  return {
    color: STAR_COLORS[index % STAR_COLORS.length],
    delay: index * 0.027,
    drift: ((index * 61) % (kind === 'hero' ? 190 : 250)) - (kind === 'hero' ? 95 : 125),
    fall: (kind === 'hero' ? 96 : 72) + ((index * 37) % (kind === 'hero' ? 116 : 88)),
    kind,
    sizeRatio: kind === 'hero' ? 0.19 + (index % 3) * 0.012 : 0.085 + (index % 2) * 0.018,
    duration: kind === 'hero' ? 0.62 + (index % 3) * 0.035 : 0.44 + (index % 2) * 0.04,
    rotation: index % 2 === 0 ? 92 + index * 7 : -84 - index * 6
  }
})

const waitForImage = async (image: HTMLImageElement) => {
  if (image.complete && image.naturalWidth > 0) {
    await image.decode?.().catch(() => undefined)
    return
  }

  await Promise.race([
    new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => resolve(), { once: true })
    }),
    new Promise<void>((resolve) => window.setTimeout(resolve, 600))
  ])
}

const ArtworkLaunchTransition: React.FC<ArtworkLaunchTransitionProps> = ({
  sourceRef,
  sourceUrl,
  maskUrl,
  accent,
  secondary,
  adjustmentRef,
  onComplete
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const artworkRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const maskRef = useRef<HTMLImageElement>(null)
  const burstRef = useRef<HTMLSpanElement>(null)
  const starsRef = useRef<Array<HTMLSpanElement | null>>([])
  const stars = useMemo(buildStars, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    const veil = veilRef.current
    const artwork = artworkRef.current
    const image = imageRef.current
    const mask = maskRef.current
    const burst = burstRef.current
    const source = sourceRef.current
    const adjustment = adjustmentRef.current
    const starElements = starsRef.current.filter((star): star is HTMLSpanElement => Boolean(star))

    if (!root || !veil || !artwork || !image || !mask || !burst || !source || !adjustment) {
      onComplete()
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sourceRect = source.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const sourceCenterX = sourceRect.left + sourceRect.width / 2
    const sourceCenterY = sourceRect.top + sourceRect.height / 2
    const centerX = viewportWidth / 2 - sourceCenterX
    const centerY = viewportHeight / 2 - sourceCenterY
    const centeredWidth = Math.min(sourceRect.width * 0.58, viewportWidth * 0.34)
    const centeredScale = Math.max(0.38, Math.min(0.62, centeredWidth / sourceRect.width))
    const launchX = centerX + Math.min(42, viewportWidth * 0.035)
    const launchY = -sourceCenterY - sourceRect.height * centeredScale * 0.72
    const launchScale = centeredScale * 0.44
    const timeline = gsap.timeline({ paused: true, defaults: { overwrite: 'auto' } })
    let cancelled = false

    gsap.set(root, {
      autoAlpha: 1,
      '--launch-accent': accent,
      '--launch-secondary': secondary
    })
    gsap.set(veil, { opacity: 0 })
    gsap.set(artwork, {
      left: sourceRect.left,
      top: sourceRect.top,
      width: sourceRect.width,
      height: sourceRect.height,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      opacity: 1
    })
    gsap.set(burst, { x: viewportWidth / 2, y: viewportHeight / 2, scale: 0.35, opacity: 0 })
    gsap.set(starElements, { opacity: 0, scale: 0, transformOrigin: '50% 50%' })

    if (reducedMotion) {
      timeline
        .to(veil, { opacity: 1, duration: 0.16 }, 0)
        .to(adjustment, { opacity: 0.12, duration: 0.2 }, 0)
        .to(artwork, {
          x: centerX,
          y: centerY - 24,
          scale: centeredScale,
          opacity: 0,
          duration: 0.32,
          ease: 'power2.inOut'
        }, 0.04)
        .to(veil, { backgroundColor: '#eef5f2', duration: 0.2 }, 0.24)
    } else {
      timeline
        .to(veil, { opacity: 1, duration: 0.22, ease: 'power1.out' }, 0)
        .to(adjustment, {
          opacity: 0.11,
          scale: 0.992,
          filter: 'blur(2px)',
          duration: 0.28,
          ease: 'power2.out'
        }, 0)
        .to(artwork, {
          x: centerX,
          y: centerY,
          scale: centeredScale,
          duration: 0.46,
          ease: 'power3.inOut'
        }, 0.06)
        .to(artwork, {
          scale: centeredScale * 0.93,
          duration: 0.11,
          ease: 'power2.in'
        }, 0.48)
        .to(burst, { opacity: 0.86, scale: 0.9, duration: 0.14, ease: 'power2.out' }, 0.46)
        .to(burst, { opacity: 0, scale: 1.55, duration: 0.34, ease: 'power2.out' }, 0.59)
        .to(artwork, {
          x: launchX,
          y: launchY,
          scale: launchScale,
          rotation: 2.2,
          opacity: 0.08,
          duration: 0.78,
          ease: 'power3.in'
        }, 0.59)
        .to(veil, {
          backgroundColor: '#eef5f2',
          backdropFilter: 'blur(0px) saturate(1)',
          duration: 0.22,
          ease: 'power1.inOut'
        }, 1.2)

      stars.forEach((star, index) => {
        const element = starElements[index]
        if (!element) return

        const starSize = Math.max(
          star.kind === 'hero' ? 58 : 26,
          Math.min(star.kind === 'hero' ? 96 : 48, centeredWidth * star.sizeRatio)
        )
        const progress = index / Math.max(1, stars.length - 1)
        const easedProgress = progress ** 3
        const currentScale = centeredScale + (launchScale - centeredScale) * easedProgress
        const startX = sourceCenterX + centerX + (launchX - centerX) * easedProgress
        const startY = sourceCenterY + centerY + (launchY - centerY) * easedProgress
          + sourceRect.height * currentScale * 0.44
        const startTime = 0.61 + star.delay
        const middleX = startX + star.drift * 0.48
        const middleY = startY + star.fall * 0.42
        const endX = startX + star.drift
        const endY = startY + star.fall

        element.style.setProperty('--star-size', `${starSize}px`)

        gsap.set(element, {
          x: startX - starSize / 2,
          y: startY - starSize / 2,
          rotation: index * 19 - 70
        })
        timeline
          .to(element, {
            opacity: star.kind === 'hero' ? 1 : 0.92,
            scale: star.kind === 'hero' ? 1.08 : 0.96,
            duration: 0.1,
            ease: 'back.out(2.2)'
          }, startTime)
          .to(element, {
            x: middleX - starSize / 2,
            y: middleY - starSize / 2,
            opacity: star.kind === 'hero' ? 0.98 : 0.78,
            scale: star.kind === 'hero' ? 0.94 : 0.78,
            rotation: star.rotation * 0.48,
            duration: star.duration * 0.54,
            ease: 'power1.out'
          }, startTime + 0.1)
          .to(element, {
            x: endX - starSize / 2,
            y: endY - starSize / 2,
            opacity: 0,
            scale: star.kind === 'hero' ? 0.28 : 0.12,
            rotation: star.rotation,
            duration: star.duration * 0.46,
            ease: 'power2.in'
          }, startTime + 0.1 + star.duration * 0.54)
      })
    }

    const finish = () => {
      if (!cancelled) onComplete()
    }

    const start = async () => {
      await Promise.all([waitForImage(image), waitForImage(mask)])
      if (cancelled) return
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      if (cancelled) return
      timeline.eventCallback('onComplete', finish)
      timeline.play(0)
    }

    void start()

    return () => {
      cancelled = true
      timeline.kill()
      gsap.killTweensOf([root, veil, artwork, image, mask, burst, adjustment, ...starElements])
    }
  }, [accent, adjustmentRef, maskUrl, onComplete, secondary, sourceRef, sourceUrl, stars])

  return (
    <div ref={rootRef} className="artwork-launch-transition" aria-hidden="true">
      <div ref={veilRef} className="artwork-launch-veil" />
      <span ref={burstRef} className="artwork-launch-burst" />

      <div className="artwork-launch-stars">
        {stars.map((star, index) => (
          <span
            key={`${star.color}-${index}`}
            ref={(element) => { starsRef.current[index] = element }}
            className={`artwork-launch-star is-${star.kind}`}
            style={{
              '--star-color': star.color
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div ref={artworkRef} className="artwork-launch-artwork">
        <div className="artwork-launch-frame">
          <img ref={imageRef} className="artwork-launch-image" src={sourceUrl} alt="" />
          <img ref={maskRef} className="artwork-launch-mask" src={maskUrl} alt="" />
          <span className="artwork-launch-glint" />
        </div>
      </div>
    </div>
  )
}

export default ArtworkLaunchTransition
