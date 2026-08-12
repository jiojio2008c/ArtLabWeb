import { useEffect, useRef, type RefObject } from 'react'
import { gsap } from 'gsap'
import { createPortalWorld } from './PortalWorld.ts'
import type { PortalOrigin, PortalVariant } from '../types.ts'

interface TransitionPortalProps {
  origin: PortalOrigin
  homeRef: RefObject<HTMLElement>
  targetRef: RefObject<HTMLElement>
  sourceCardRef: RefObject<HTMLButtonElement>
  targetRevealSelector: string
  variant: PortalVariant
  onComplete: () => void
}

const PAPER_SHARDS = [
  { clip: 'polygon(0 56%, 19% 52%, 15% 100%, 0 100%)', x: -170, y: 82, rotation: -13, scale: 1.12 },
  { clip: 'polygon(12% 54%, 31% 55%, 23% 100%, 14% 100%)', x: -116, y: 145, rotation: 10, scale: 1.08 },
  { clip: 'polygon(27% 58%, 48% 74%, 41% 100%, 22% 100%)', x: -92, y: 190, rotation: -8, scale: 1.16 },
  { clip: 'polygon(0 78%, 24% 72%, 20% 100%, 0 100%)', x: -212, y: 192, rotation: 7, scale: 1.18 },
  { clip: 'polygon(61% 72%, 76% 58%, 74% 100%, 51% 100%)', x: 105, y: 168, rotation: 11, scale: 1.14 },
  { clip: 'polygon(72% 46%, 87% 38%, 86% 100%, 71% 100%)', x: 142, y: 106, rotation: -9, scale: 1.12 },
  { clip: 'polygon(84% 53%, 100% 57%, 100% 100%, 85% 100%)', x: 210, y: 172, rotation: 12, scale: 1.2 },
  { clip: 'polygon(73% 15%, 91% 14%, 94% 46%, 77% 45%)', x: 158, y: -102, rotation: 18, scale: 1.06 },
  { clip: 'polygon(55% 39%, 70% 31%, 72% 61%, 59% 70%)', x: 74, y: -72, rotation: -17, scale: 1.09 },
  { clip: 'polygon(40% 74%, 62% 70%, 67% 100%, 39% 100%)', x: -22, y: 215, rotation: 5, scale: 1.17 },
  { clip: 'polygon(90% 25%, 100% 21%, 100% 58%, 91% 55%)', x: 226, y: -56, rotation: -12, scale: 1.1 },
  { clip: 'polygon(4% 48%, 18% 38%, 28% 58%, 12% 66%)', x: -164, y: -54, rotation: 16, scale: 1.08 }
]

const BINARY_STREAMS = Array.from({ length: 18 }, (_, index) => ({
  text: `${index % 2}10100110 0110${index % 3} 11001001 00110110 1010${index % 4}`,
  left: `${2 + index * 5.6}%`,
  delay: `${(index % 6) * -0.22}s`,
  duration: `${1.45 + (index % 5) * 0.16}s`
}))

const TransitionPortal: React.FC<TransitionPortalProps> = ({
  origin,
  homeRef,
  targetRef,
  sourceCardRef,
  targetRevealSelector,
  variant,
  onComplete
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const binaryRef = useRef<HTMLDivElement>(null)
  const matrixRef = useRef<HTMLDivElement>(null)
  const shardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const backdrop = backdropRef.current
    const binary = binaryRef.current
    const matrix = matrixRef.current
    const shardsContainer = shardsRef.current
    const home = homeRef.current
    const target = targetRef.current
    const card = sourceCardRef.current

    if (!root || !canvas || !backdrop || !binary || !matrix || !shardsContainer || !home || !target || !card) {
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const targetElements = Array.from(target.querySelectorAll<HTMLElement>(targetRevealSelector))
    const homeFadeElements = Array.from(home.querySelectorAll<HTMLElement>('.home-fade, .art-entry-card'))
      .filter((element) => element !== card)
    const paperShards = Array.from(shardsContainer.querySelectorAll<HTMLElement>('.paper-shard'))
    const world = reducedMotion ? null : createPortalWorld(canvas, origin, variant)

    gsap.set(target, { visibility: 'visible', opacity: 0 })
    gsap.set(targetElements, { opacity: 0, y: 24, scale: 0.975 })
    gsap.set([backdrop, binary, matrix, canvas], { opacity: 0 })
    gsap.set(paperShards, { opacity: 0, transformOrigin: 'center center' })

    const completeTransition = () => {
      onComplete()
      window.requestAnimationFrame(() => {
        gsap.set(target, { clearProps: 'opacity,transform,filter,visibility' })
        gsap.set(targetElements, { clearProps: 'opacity,transform,filter' })
      })
    }

    if (reducedMotion) {
      gsap.set([canvas, binary, matrix, shardsContainer], { display: 'none' })
      const reducedTimeline = gsap.timeline({ onComplete: completeTransition })
        .to(home, { opacity: 0, duration: 0.18, ease: 'power1.out' }, 0)
        .to(target, { opacity: 1, duration: 0.28, ease: 'power1.out' }, 0.12)
        .to(targetElements, { opacity: 1, y: 0, scale: 1, duration: 0.24, stagger: 0.025 }, 0.16)
        .set(home, { visibility: 'hidden' }, 0.44)

      return () => reducedTimeline.kill()
    }

    const timeline = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: completeTransition
    })

    timeline
      .to(canvas, { opacity: 1, duration: 0.16, ease: 'power1.out' }, 0.08)
      .to(card, {
        scale: 1.045,
        filter: 'saturate(1.18) brightness(1.08)',
        boxShadow: '0 0 0 2px rgba(103, 232, 255, .95), 0 0 30px rgba(82, 111, 255, .8), 0 0 66px rgba(171, 63, 255, .48)',
        duration: 0.38,
        ease: 'power2.out'
      }, 0)
      .to(world!.state, { progress: 0.2, duration: 0.4, ease: 'power2.out' }, 0)
      .to(homeFadeElements, {
        opacity: 0,
        scale: 0.94,
        filter: 'blur(5px)',
        duration: 0.42,
        ease: 'power2.in'
      }, 0.18)
      .to(backdrop, { opacity: 1, duration: 0.52, ease: 'power2.inOut' }, 0.18)
      .to(binary, { opacity: 1, duration: 0.28, ease: 'power1.out' }, 0.34)
      .to(matrix, { opacity: 1, duration: 0.34, ease: 'power1.out' }, 0.4)
      .to(card, { opacity: 0.08, duration: 0.2, ease: 'power2.in' }, 0.36)
      .to(paperShards, { opacity: 1, duration: 0.1 }, 0.38)
      .to(paperShards, {
        x: (index) => PAPER_SHARDS[index].x,
        y: (index) => PAPER_SHARDS[index].y,
        rotation: (index) => PAPER_SHARDS[index].rotation,
        scale: (index) => PAPER_SHARDS[index].scale,
        opacity: 0,
        duration: 0.82,
        stagger: 0.012,
        ease: 'power3.in'
      }, 0.42)
      .to(world!.state, { progress: 0.66, duration: 0.8, ease: 'power2.inOut' }, 0.4)
      .to(home, {
        filter: 'saturate(.35) brightness(.58) hue-rotate(18deg)',
        duration: 0.8,
        ease: 'power2.inOut'
      }, 0.4)
      .to(home, { opacity: 0, duration: 0.48, ease: 'power2.in' }, 1.08)
      .to(target, {
        opacity: 1,
        scale: 1,
        filter: 'none',
        duration: 0.66,
        ease: 'power2.out'
      }, 1.16)
      .to(world!.state, { progress: 0.92, duration: 0.66, ease: 'power2.inOut' }, 1.18)
      .to(targetElements, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        stagger: 0.055,
        ease: 'power2.out'
      }, 1.3)
      .to([binary, matrix], { opacity: 0, duration: 0.42, ease: 'power1.out' }, 1.72)
      .to(canvas, { opacity: 0, duration: 0.42, ease: 'power1.out' }, 1.78)
      .to(backdrop, { opacity: 0, duration: 0.4, ease: 'power1.out' }, 1.8)
      .to(world!.state, { progress: 1, duration: 0.38, ease: 'power1.out' }, 1.82)
      .set(home, { visibility: 'hidden' }, 2.18)
      .to({}, { duration: 0.02 }, 2.18)

    return () => {
      timeline.kill()
      world?.destroy()
    }
  }, [homeRef, onComplete, origin, sourceCardRef, targetRef, targetRevealSelector, variant])

  return (
    <div ref={rootRef} className="transition-portal-layer" aria-hidden="true">
      <div ref={backdropRef} className="digital-backdrop" />

      <div ref={shardsRef} className="paper-shards">
        {PAPER_SHARDS.map((shard, index) => (
          <span
            key={shard.clip}
            className="paper-shard"
            style={{ clipPath: shard.clip, '--shard-index': index } as React.CSSProperties}
          />
        ))}
      </div>

      <div ref={matrixRef} className="digital-matrix">
        <span className="matrix-horizon" />
        <span className="matrix-grid" />
      </div>

      <div ref={binaryRef} className="binary-rain">
        {BINARY_STREAMS.map((stream, index) => (
          <span
            key={`${stream.left}-${index}`}
            style={{
              left: stream.left,
              '--stream-delay': stream.delay,
              '--stream-duration': stream.duration
            } as React.CSSProperties}
          >
            {stream.text}
          </span>
        ))}
      </div>

      <canvas ref={canvasRef} className="portal-canvas" />
    </div>
  )
}

export default TransitionPortal
