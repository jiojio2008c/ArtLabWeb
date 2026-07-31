import { useEffect, useRef, type RefObject } from 'react'
import { gsap } from 'gsap'
import type { PortalOrigin } from '../types.ts'

interface MagicPortalTransitionProps {
  origin: PortalOrigin
  homeRef: RefObject<HTMLElement>
  interactiveRef: RefObject<HTMLElement>
  interactiveCardRef: RefObject<HTMLButtonElement>
  onComplete: () => void
}

const PAPER_PIECES = [
  { clip: 'polygon(0 0, 52% 0, 48% 34%, 53% 51%, 46% 72%, 50% 100%, 0 100%)', x: -0.42, y: 0, ry: 34, rz: -5 },
  { clip: 'polygon(48% 0, 100% 0, 100% 100%, 50% 100%, 54% 72%, 47% 51%, 52% 34%)', x: 0.42, y: 0, ry: -34, rz: 5 },
  { clip: 'polygon(0 0, 100% 0, 100% 27%, 75% 24%, 52% 31%, 27% 23%, 0 29%)', x: 0, y: -0.38, ry: 0, rz: -3 },
  { clip: 'polygon(0 74%, 28% 78%, 49% 70%, 74% 79%, 100% 72%, 100% 100%, 0 100%)', x: 0, y: 0.42, ry: 0, rz: 3 },
  { clip: 'polygon(0 25%, 29% 22%, 47% 50%, 24% 57%, 0 54%)', x: -0.35, y: -0.14, ry: 28, rz: 9 },
  { clip: 'polygon(72% 20%, 100% 25%, 100% 56%, 76% 59%, 52% 49%)', x: 0.35, y: -0.12, ry: -28, rz: -9 },
  { clip: 'polygon(0 52%, 24% 56%, 48% 51%, 46% 76%, 27% 80%, 0 73%)', x: -0.38, y: 0.19, ry: 25, rz: -8 },
  { clip: 'polygon(53% 50%, 76% 57%, 100% 52%, 100% 75%, 74% 81%, 54% 73%)', x: 0.38, y: 0.2, ry: -25, rz: 8 }
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

const MagicPortalTransition: React.FC<MagicPortalTransitionProps> = ({
  origin,
  homeRef,
  interactiveRef,
  interactiveCardRef,
  onComplete
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const voidRef = useRef<HTMLDivElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)
  const tearsRef = useRef<HTMLDivElement>(null)
  const sparksRef = useRef<HTMLDivElement>(null)
  const streaksRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const voidLayer = voidRef.current
    const portal = portalRef.current
    const tears = tearsRef.current
    const sparksLayer = sparksRef.current
    const streaksLayer = streaksRef.current
    const home = homeRef.current
    const scene = interactiveRef.current
    const interactiveCard = interactiveCardRef.current

    if (!root || !voidLayer || !portal || !tears || !sparksLayer || !streaksLayer || !home || !scene || !interactiveCard) {
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dynamicCard = home.querySelector<HTMLElement>('.dynamic-card')
    const topbar = home.querySelector<HTMLElement>('.home-topbar')
    const backgroundPlane = home.querySelector<HTMLElement>('.home-background-plane')
    const header = scene.querySelector<HTMLElement>('.interactive-theme-header')
    const replay = scene.querySelector<HTMLElement>('.magic-replay-button')
    const themeCards = Array.from(scene.querySelectorAll<HTMLElement>('.interactive-theme-card'))
    const maskBadges = Array.from(scene.querySelectorAll<HTMLElement>('.interactive-theme-mask'))
    const paperPieces = Array.from(tears.querySelectorAll<HTMLElement>('.magic-paper-piece'))
    const sparks = Array.from(sparksLayer.querySelectorAll<HTMLElement>('.magic-spark'))
    const streaks = Array.from(streaksLayer.querySelectorAll<HTMLElement>('.magic-streak'))
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    const originCenterX = origin.left + origin.width / 2
    const originCenterY = origin.top + origin.height / 2
    const portalSize = Math.hypot(window.innerWidth, window.innerHeight) * 1.28
    const cardOffsetX = centerX - originCenterX
    const cardOffsetY = centerY - originCenterY

    gsap.set(scene, { visibility: 'visible', opacity: 1 })
    gsap.set([header, replay], { opacity: 0, y: -24 })
    gsap.set(maskBadges, { opacity: 0, y: 12, scale: 0.9 })
    gsap.set(voidLayer, { opacity: 0 })
    gsap.set(portal, {
      left: originCenterX,
      top: originCenterY,
      width: Math.max(90, origin.width * 0.58),
      height: Math.max(90, origin.width * 0.58),
      xPercent: -50,
      yPercent: -50,
      opacity: 0,
      rotation: -22,
      scale: 0.64
    })
    gsap.set(paperPieces, { opacity: 0, transformOrigin: 'center center', transformPerspective: 1200 })
    gsap.set(sparks, { left: centerX, top: centerY, opacity: 0, scale: 0 })
    gsap.set(streaks, {
      left: centerX,
      top: centerY,
      opacity: 0,
      scaleX: 0,
      transformOrigin: 'left center'
    })

    themeCards.forEach((themeCard, index) => {
      const rect = themeCard.getBoundingClientRect()
      gsap.set(themeCard, {
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

    if (reducedMotion) {
      const reducedTimeline = gsap.timeline({ onComplete })
        .to(home, { opacity: 0, duration: 0.18, ease: 'power1.out' }, 0)
        .to(themeCards, { opacity: 1, x: 0, y: 0, scale: 1, rotationY: 0, rotationZ: 0, duration: 0.25 }, 0.12)
        .to([header, replay, maskBadges], { opacity: 1, y: 0, scale: 1, duration: 0.2 }, 0.16)
        .set(home, { visibility: 'hidden' }, 0.4)

      return () => {
        reducedTimeline.kill()
      }
    }

    const timeline = gsap.timeline({ defaults: { overwrite: 'auto' }, onComplete })
      .to(dynamicCard, {
        x: -120,
        scale: 0.9,
        opacity: 0,
        filter: 'blur(12px)',
        duration: 0.24,
        ease: 'power2.inOut'
      }, 0)
      .to(topbar, { opacity: 0, y: -18, duration: 0.22, ease: 'power2.in' }, 0.03)
      .to(backgroundPlane, {
        scale: 0.93,
        opacity: 0.72,
        filter: 'blur(4px) saturate(.72) brightness(.76)',
        duration: 0.52,
        ease: 'power2.in'
      }, 0)
      .to(interactiveCard, {
        x: cardOffsetX,
        y: cardOffsetY,
        scale: 1.15,
        zIndex: 8,
        boxShadow: '0 0 0 2px rgba(255,255,255,.9), 0 0 34px rgba(113,241,255,.86), 0 0 76px rgba(238,95,255,.64)',
        duration: 0.25,
        ease: 'back.out(1.35)'
      }, 0)
      .to(portal, {
        left: centerX,
        top: centerY,
        opacity: 1,
        scale: 1,
        rotation: 0,
        duration: 0.2,
        ease: 'power2.out'
      }, 0.13)
      .to(voidLayer, { opacity: 1, duration: 0.34, ease: 'power2.inOut' }, 0.23)
      .to(paperPieces, { opacity: 1, duration: 0.05 }, 0.24)
      .to(portal, {
        width: portalSize,
        height: portalSize,
        rotation: 96,
        duration: 0.42,
        ease: 'power3.in'
      }, 0.24)
      .to(interactiveCard, {
        opacity: 0,
        scale: 1.38,
        filter: 'blur(10px) saturate(1.45)',
        duration: 0.22,
        ease: 'power2.in'
      }, 0.32)
      .to(paperPieces, {
        x: (index) => PAPER_PIECES[index].x * window.innerWidth,
        y: (index) => PAPER_PIECES[index].y * window.innerHeight,
        rotationY: (index) => PAPER_PIECES[index].ry,
        rotation: (index) => PAPER_PIECES[index].rz,
        scale: 1.08,
        opacity: 0,
        duration: 0.46,
        stagger: 0.012,
        ease: 'power3.in'
      }, 0.28)
      .to(home, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.36)
      .to(sparks, {
        opacity: (index) => index % 4 === 0 ? 1 : 0.72,
        scale: 1,
        duration: 0.13,
        stagger: 0.003,
        ease: 'power1.out'
      }, 0.25)
      .to(sparks, {
        x: (index) => MAGIC_SPARKS[index].x * window.innerWidth,
        y: (index) => MAGIC_SPARKS[index].y * window.innerHeight,
        opacity: 0,
        scale: 0.35,
        duration: 0.72,
        stagger: 0.004,
        ease: 'power2.out'
      }, 0.3)
      .to(streaks, { opacity: 0.78, scaleX: 1, duration: 0.22, stagger: 0.018, ease: 'power2.out' }, 0.31)
      .to(streaks, { opacity: 0, scaleX: 1.5, duration: 0.48, stagger: 0.015, ease: 'power2.in' }, 0.46)
      .to(themeCards, {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        rotationY: 0,
        rotationZ: 0,
        duration: 0.46,
        stagger: 0.06,
        ease: 'power4.out'
      }, 0.58)
      .to([header, replay], {
        opacity: 1,
        y: 0,
        duration: 0.34,
        stagger: 0.05,
        ease: 'power2.out'
      }, 0.84)
      .to(maskBadges, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.3,
        stagger: 0.045,
        ease: 'back.out(1.7)'
      }, 0.94)
      .to(portal, { opacity: 0, scale: 1.08, duration: 0.3, ease: 'power2.out' }, 0.96)
      .to(voidLayer, { opacity: 0, duration: 0.28, ease: 'power1.out' }, 1.02)
      .set(home, { visibility: 'hidden' }, 1.28)
      .to({}, { duration: 0.02 }, 1.28)

    return () => {
      timeline.kill()
    }
  }, [homeRef, interactiveCardRef, interactiveRef, onComplete, origin])

  return (
    <div ref={rootRef} className="magic-portal-transition" aria-hidden="true">
      <div ref={voidRef} className="magic-void-layer" />
      <div ref={tearsRef} className="magic-paper-tears">
        {PAPER_PIECES.map((piece) => (
          <span key={piece.clip} className="magic-paper-piece" style={{ clipPath: piece.clip }} />
        ))}
      </div>
      <div ref={portalRef} className="magic-portal-bloom">
        <span className="magic-portal-ring ring-one" />
        <span className="magic-portal-ring ring-two" />
        <span className="magic-portal-ring ring-three" />
        <span className="magic-portal-core" />
      </div>
      <div ref={streaksRef} className="magic-light-streaks">
        {Array.from({ length: 14 }, (_, index) => (
          <span key={index} className="magic-streak" style={{ '--streak-angle': `${index * 25.7}deg` } as React.CSSProperties} />
        ))}
      </div>
      <div ref={sparksRef} className="magic-sparks">
        {MAGIC_SPARKS.map((spark, index) => (
          <span
            key={index}
            className="magic-spark"
            style={{ width: spark.size, height: spark.size, backgroundColor: spark.color } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  )
}

export default MagicPortalTransition
