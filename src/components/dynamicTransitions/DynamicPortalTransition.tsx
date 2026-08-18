import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { gsap } from 'gsap'
import { createDynamicPortalWorld } from './DynamicPortalWorld.ts'
import type { DynamicPortalVariant, DynamicTransitionOrigin } from './types.ts'
import {
  waitForContainerMedia,
  waitForElement,
  waitForStablePaint
} from '../../services/transitionPerformance.ts'

interface DynamicPortalTransitionProps {
  origin: DynamicTransitionOrigin
  sourceRootRef: RefObject<HTMLElement>
  sourceCardRef: RefObject<HTMLButtonElement>
  targetRootRef?: RefObject<HTMLElement>
  targetRevealSelector?: string
  variant?: DynamicPortalVariant
  onSceneSwitch: () => void
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

const DynamicPortalTransition: React.FC<DynamicPortalTransitionProps> = ({
  origin,
  sourceRootRef,
  sourceCardRef,
  targetRootRef,
  targetRevealSelector,
  variant = 'dynamic',
  onSceneSwitch,
  onComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const binaryRef = useRef<HTMLDivElement>(null)
  const matrixRef = useRef<HTMLDivElement>(null)
  const shardsRef = useRef<HTMLDivElement>(null)
  const sceneSwitchRef = useRef(onSceneSwitch)
  const completeRef = useRef(onComplete)

  useEffect(() => {
    sceneSwitchRef.current = onSceneSwitch
    completeRef.current = onComplete
  }, [onComplete, onSceneSwitch])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const backdrop = backdropRef.current
    const binary = binaryRef.current
    const matrix = matrixRef.current
    const shardsContainer = shardsRef.current
    const sourceRoot = sourceRootRef.current
    const sourceCard = sourceCardRef.current
    if (!canvas || !backdrop || !binary || !matrix || !shardsContainer || !sourceRoot || !sourceCard) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sourceFadeElements = Array.from(
      sourceRoot.querySelectorAll<HTMLElement>('.dynamic-home-fade, .entry-choice-card')
    ).filter((element) => element !== sourceCard)
    const paperShards = Array.from(shardsContainer.querySelectorAll<HTMLElement>('.dynamic-portal-paper-shard'))
    let world: ReturnType<typeof createDynamicPortalWorld> | null = null
    if (!reducedMotion) {
      try {
        world = createDynamicPortalWorld(canvas, origin, variant)
      } catch (error) {
        console.warn('Dynamic portal WebGL fallback enabled:', error)
        gsap.set(canvas, { display: 'none' })
      }
    }
    const worldState = world?.state ?? { progress: 0 }
    let sceneSwitched = false
    let cancelled = false
    let firstStableFrame = 0
    let secondStableFrame = 0
    let targetRevealTimeline: gsap.core.Timeline | null = null
    let revealedTargetRoot: HTMLElement | null = null
    let revealedTargetElements: HTMLElement[] = []
    let targetPreparationPromise: Promise<void> | null = null
    let targetReady = false
    let targetGateActive = false
    let mainTimeline: gsap.core.Timeline | null = null

    const switchScene = () => {
      if (sceneSwitched) return
      sceneSwitched = true
      sceneSwitchRef.current()
    }

    const getPortalTargetRoot = () => targetRootRef?.current ?? document.querySelector<HTMLElement>(
      variant === 'dynamic'
        ? '.page-view-dynamicGroups .dynamic-library-screen'
        : '.page-view-directSelect .direct-select-screen'
    )

    const releaseTargetGate = () => {
      targetReady = true
      if (targetGateActive && mainTimeline && !cancelled) {
        targetGateActive = false
        mainTimeline.resume()
      }
    }

    const prepareTarget = async () => {
      const targetRoot = await waitForElement(getPortalTargetRoot, 1200)
      if (!targetRoot || cancelled) {
        releaseTargetGate()
        return
      }

      await waitForStablePaint(1)
      await waitForContainerMedia(targetRoot, {
        selector: 'img, video',
        timeoutMs: 1100,
        maxElements: variant === 'dynamic' ? 12 : 8,
        visibleOnly: variant === 'dynamic'
      })
      await waitForStablePaint(2)
      if (cancelled) return

      if (!targetRootRef || !targetRevealSelector) {
        releaseTargetGate()
        return
      }

      const targetElements = Array.from(targetRoot.querySelectorAll<HTMLElement>(targetRevealSelector))
      if (targetElements.length === 0) {
        releaseTargetGate()
        return
      }

      revealedTargetRoot = targetRoot
      revealedTargetElements = targetElements
      gsap.killTweensOf([targetRoot, ...targetElements])
      gsap.set(targetRoot, { opacity: 0 })
      gsap.set(targetElements, { opacity: 0, y: 24, scale: 0.975 })

      targetRevealTimeline = gsap.timeline({ onComplete: releaseTargetGate })
        .to(targetRoot, {
          opacity: 1,
          duration: reducedMotion ? 0.28 : 0.66,
          ease: 'power2.out'
        }, 0)
        .to(targetElements, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: reducedMotion ? 0.24 : 0.5,
          stagger: reducedMotion ? 0.025 : 0.055,
          ease: 'power2.out'
        }, reducedMotion ? 0.04 : 0.14)
      targetRevealTimeline.play(0)
    }

    const beginTargetPreparation = () => {
      if (targetPreparationPromise) return
      targetPreparationPromise = prepareTarget().catch(() => {
        // A failed optional preview must never prevent the route from
        // completing. The existing placeholder/fallback remains visible.
        releaseTargetGate()
      })
    }

    const revealTarget = () => {
      switchScene()
      beginTargetPreparation()
    }

    const gateTarget = () => {
      beginTargetPreparation()
      if (targetReady || !mainTimeline) return
      targetGateActive = true
      mainTimeline.pause()
    }

    const finishAfterStablePaint = () => {
      firstStableFrame = window.requestAnimationFrame(() => {
        secondStableFrame = window.requestAnimationFrame(() => {
          if (!cancelled) completeRef.current()
        })
      })
    }

    gsap.set([backdrop, binary, matrix, canvas], { opacity: 0 })
    gsap.set(paperShards, { opacity: 0, transformOrigin: 'center center' })

    if (reducedMotion) {
      gsap.set([canvas, binary, matrix, shardsContainer], { display: 'none' })
      const reducedTimeline = gsap.timeline({ paused: true, onComplete: finishAfterStablePaint })
      mainTimeline = reducedTimeline
      reducedTimeline
        .to(sourceRoot, { opacity: 0, duration: 0.18, ease: 'power1.out' }, 0)
        .call(revealTarget, [], 0.14)
        .to(backdrop, { opacity: 0, duration: 0.18 }, 0.18)
        .call(gateTarget, [], 0.3)
        .to({}, { duration: 0.18 }, 0.36)
      reducedTimeline.play(0)

      return () => {
        cancelled = true
        window.cancelAnimationFrame(firstStableFrame)
        window.cancelAnimationFrame(secondStableFrame)
        reducedTimeline.kill()
        targetRevealTimeline?.kill()
        gsap.set([sourceRoot, sourceCard, ...sourceFadeElements], { clearProps: 'all' })
        if (revealedTargetRoot) gsap.set(revealedTargetRoot, { clearProps: 'opacity,transform,filter' })
        gsap.set(revealedTargetElements, { clearProps: 'opacity,transform,filter,transformOrigin' })
      }
    }

    const timeline = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: finishAfterStablePaint
    })
    mainTimeline = timeline

    timeline
      .to(canvas, { opacity: 1, duration: 0.16, ease: 'power1.out' }, 0.08)
      .to(sourceCard, {
        scale: 1.045,
        filter: 'saturate(1.18) brightness(1.08)',
        boxShadow: '0 0 0 2px rgba(103,232,255,.95), 0 0 30px rgba(82,111,255,.8), 0 0 66px rgba(171,63,255,.48)',
        duration: 0.38,
        ease: 'power2.out'
      }, 0)
      .to(worldState, { progress: 0.2, duration: 0.4, ease: 'power2.out' }, 0)
      .to(sourceFadeElements, {
        opacity: 0,
        scale: 0.94,
        filter: 'blur(5px)',
        duration: 0.42,
        ease: 'power2.in'
      }, 0.18)
      .to(backdrop, { opacity: 1, duration: 0.52, ease: 'power2.inOut' }, 0.18)
      .to(binary, { opacity: 1, duration: 0.28, ease: 'power1.out' }, 0.34)
      .to(matrix, { opacity: 1, duration: 0.34, ease: 'power1.out' }, 0.4)
      .to(sourceCard, { opacity: 0.08, duration: 0.2, ease: 'power2.in' }, 0.36)
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
      .to(worldState, { progress: 0.66, duration: 0.8, ease: 'power2.inOut' }, 0.4)
      .to(sourceRoot, {
        filter: 'saturate(.35) brightness(.58) hue-rotate(18deg)',
        duration: 0.8,
        ease: 'power2.inOut'
      }, 0.4)
      .to(sourceRoot, { opacity: 0, duration: 0.48, ease: 'power2.in' }, 1.02)
      .call(revealTarget, [], 1.08)
      .call(gateTarget, [], 1.7)
      .to(worldState, { progress: 0.92, duration: 0.66, ease: 'power2.inOut' }, 1.18)
      .to([binary, matrix], { opacity: 0, duration: 0.42, ease: 'power1.out' }, 1.72)
      .to(canvas, { opacity: 0, duration: 0.42, ease: 'power1.out' }, 1.78)
      .to(backdrop, { opacity: 0, duration: 0.4, ease: 'power1.out' }, 1.8)
      .to(worldState, { progress: 1, duration: 0.38, ease: 'power1.out' }, 1.82)
      .to({}, { duration: 0.02 }, 2.18)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(firstStableFrame)
      window.cancelAnimationFrame(secondStableFrame)
      timeline.kill()
      targetRevealTimeline?.kill()
      world?.destroy()
      gsap.set([sourceRoot, sourceCard, ...sourceFadeElements], { clearProps: 'all' })
      if (revealedTargetRoot) gsap.set(revealedTargetRoot, { clearProps: 'opacity,transform,filter' })
      gsap.set(revealedTargetElements, { clearProps: 'opacity,transform,filter,transformOrigin' })
    }
  }, [origin, sourceCardRef, sourceRootRef, targetRevealSelector, targetRootRef, variant])

  return (
    <div className="dynamic-portal-transition-layer" aria-hidden="true">
      <div ref={backdropRef} className="dynamic-portal-digital-backdrop" />
      <div ref={shardsRef} className="dynamic-portal-paper-shards">
        {PAPER_SHARDS.map((shard, index) => (
          <span
            key={shard.clip}
            className="dynamic-portal-paper-shard"
            style={{ clipPath: shard.clip, '--shard-index': index } as React.CSSProperties}
          />
        ))}
      </div>
      <div ref={matrixRef} className="dynamic-portal-matrix">
        <span className="dynamic-portal-matrix-horizon" />
        <span className="dynamic-portal-matrix-grid" />
      </div>
      <div ref={binaryRef} className="dynamic-portal-binary-rain">
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
      <canvas ref={canvasRef} className="dynamic-portal-canvas" />
    </div>
  )
}

export default DynamicPortalTransition
