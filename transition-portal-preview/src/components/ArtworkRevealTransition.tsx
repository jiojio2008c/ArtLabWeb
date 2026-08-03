import { useLayoutEffect, useRef, type RefObject } from 'react'
import { gsap } from 'gsap'

interface ArtworkRevealTransitionProps {
  importViewRef: RefObject<HTMLElement>
  dropzoneRef: RefObject<HTMLElement>
  plusRef: RefObject<HTMLElement>
  adjustmentRef: RefObject<HTMLElement>
  headerRef: RefObject<HTMLElement>
  stagePanelRef: RefObject<HTMLElement>
  stageShellRef: RefObject<HTMLElement>
  railRef: RefObject<HTMLElement>
  previewUrl: string
  maskUrl: string
  accent: string
  secondary: string
  onComplete: () => void
}

const nextFrame = () => new Promise<void>((resolve) => {
  window.requestAnimationFrame(() => resolve())
})

const ArtworkRevealTransition: React.FC<ArtworkRevealTransitionProps> = ({
  importViewRef,
  dropzoneRef,
  plusRef,
  adjustmentRef,
  headerRef,
  stagePanelRef,
  stageShellRef,
  railRef,
  previewUrl,
  maskUrl,
  accent,
  secondary,
  onComplete
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const cloneRef = useRef<HTMLDivElement>(null)
  const cloneImageRef = useRef<HTMLImageElement>(null)
  const cloneMaskRef = useRef<HTMLImageElement>(null)
  const cloneScanRef = useRef<HTMLSpanElement>(null)
  const cloneEdgeRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const importView = importViewRef.current
    const dropzone = dropzoneRef.current
    const plus = plusRef.current
    const adjustment = adjustmentRef.current
    const header = headerRef.current
    const stagePanel = stagePanelRef.current
    const stageShell = stageShellRef.current
    const rail = railRef.current
    const clone = cloneRef.current
    const cloneImage = cloneImageRef.current
    const cloneMask = cloneMaskRef.current
    const cloneScan = cloneScanRef.current
    const cloneEdge = cloneEdgeRef.current

    if (!root || !importView || !dropzone || !plus || !adjustment || !header || !stagePanel || !stageShell || !rail
      || !clone || !cloneImage || !cloneMask || !cloneScan || !cloneEdge) {
      onComplete()
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const plusRect = plus.getBoundingClientRect()
    const stageRect = stageShell.getBoundingClientRect()
    const plusSize = Math.max(54, Math.min(plusRect.width, plusRect.height))
    const startRect = {
      left: plusRect.left + (plusRect.width - plusSize) / 2,
      top: plusRect.top + (plusRect.height - plusSize) / 2,
      width: plusSize,
      height: plusSize
    }
    const stageItems = Array.from(rail.querySelectorAll<HTMLElement>(
      '.theme-upload-rail-heading, .theme-upload-mask-preview, .theme-upload-mask-grid, .theme-upload-primary'
    ))
    const cloneCorners = Array.from(root.querySelectorAll<HTMLElement>('.artwork-reveal-corner'))
    const stageHeading = stagePanel.querySelector<HTMLElement>('.theme-upload-panel-heading')
    let cancelled = false

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
        new Promise<void>((resolve) => window.setTimeout(resolve, 650))
      ])
    }

    const timeline = gsap.timeline({ paused: true, defaults: { overwrite: 'auto' } })
    const targetElements = [header, stagePanel, stageShell, rail, ...stageItems, stageHeading]
    const finish = () => {
      gsap.set([adjustment, ...targetElements].filter(Boolean), {
        clearProps: 'opacity,visibility,transform,pointer-events'
      })
      onComplete()
    }

    gsap.set(root, {
      autoAlpha: 1,
      '--artwork-reveal-accent': accent,
      '--artwork-reveal-secondary': secondary
    })
    gsap.set(adjustment, { autoAlpha: 0, visibility: 'visible', pointerEvents: 'none' })
    gsap.set(importView, { autoAlpha: 1 })
    gsap.set(targetElements, { autoAlpha: 0, y: 16 })
    gsap.set(stageShell, { y: 0, scale: 0.985 })
    gsap.set(stageItems, { y: 10 })
    gsap.set(clone, {
      left: startRect.left,
      top: startRect.top,
      width: startRect.width,
      height: startRect.height,
      borderRadius: startRect.width / 2,
      opacity: 1,
      scale: 0.96,
      boxShadow: `0 12px 28px rgba(25, 28, 30, .22), 0 0 0 2px rgba(255, 255, 255, .9), 0 0 28px color-mix(in srgb, ${accent} 44%, transparent)`
    })
    gsap.set(cloneImage, { opacity: 0, scale: 1.18, filter: 'saturate(.78) brightness(1.18)' })
    gsap.set(cloneMask, { opacity: 0, scale: 1.06 })
    gsap.set(cloneScan, { xPercent: -180, opacity: 0 })
    gsap.set(cloneEdge, { opacity: 0, scale: 0.88 })
    gsap.set(cloneCorners, { opacity: 0, scale: 0.72 })

    if (reducedMotion) {
      timeline
        .to(importView, { autoAlpha: 0, duration: 0.16 }, 0)
        .to(adjustment, { autoAlpha: 1, duration: 0.24 }, 0.04)
        .to(targetElements, { autoAlpha: 1, y: 0, scale: 1, duration: 0.24, stagger: 0.02 }, 0.08)
        .to(root, { autoAlpha: 0, duration: 0.08 }, 0.34)
    } else {
      timeline
        .to(plus, { scale: 0.86, duration: 0.12, ease: 'power2.out' }, 0)
        .to(importView.querySelectorAll('.theme-upload-import-header > *, .theme-upload-dropzone > *'), {
          opacity: 0.34,
          duration: 0.2,
          stagger: 0.018,
          ease: 'power1.out'
        }, 0.1)
        .to(adjustment, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' }, 0.22)
        .to(importView, { autoAlpha: 0, duration: 0.34, ease: 'power2.inOut' }, 0.26)
        .to(header, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.35)
        .to(stagePanel, { autoAlpha: 1, y: 0, duration: 0.32, ease: 'power3.out' }, 0.38)
        .to(rail, { autoAlpha: 1, y: 0, duration: 0.36, ease: 'power3.out' }, 0.48)
        .to(stageHeading ?? [], { autoAlpha: 1, y: 0, duration: 0.24, ease: 'power2.out' }, 0.52)
        .to(stageItems, { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.045, ease: 'power3.out' }, 0.58)
        .to(stageShell, { autoAlpha: 1, y: 0, scale: 1, duration: 0.34, ease: 'power3.out' }, 0.7)
        .to(clone, {
          left: stageRect.left,
          top: stageRect.top,
          width: stageRect.width,
          height: stageRect.height,
          borderRadius: 8,
          scale: 1,
          boxShadow: `0 18px 42px rgba(0, 0, 0, .34), 0 0 0 1px color-mix(in srgb, ${accent} 46%, transparent), 0 0 26px color-mix(in srgb, ${accent} 22%, transparent)`,
          duration: 0.72,
          ease: 'power3.inOut'
        }, 0.12)
        .to(cloneImage, { opacity: 1, scale: 1, filter: 'saturate(1) brightness(1)', duration: 0.22, ease: 'power2.out' }, 0.12)
        .to(cloneEdge, { opacity: 1, scale: 1, duration: 0.18, ease: 'power2.out' }, 0.27)
        .to(cloneCorners, { opacity: 1, scale: 1, duration: 0.2, stagger: 0.025, ease: 'power2.out' }, 0.34)
        .to(cloneMask, { opacity: 0.76, scale: 1, duration: 0.24, ease: 'power2.out' }, 0.64)
        .to(cloneScan, { xPercent: 190, opacity: 0.66, duration: 0.34, ease: 'power1.inOut' }, 0.5)
        .to(stageShell, { autoAlpha: 1, duration: 0.1 }, 0.83)
        .to(clone, { autoAlpha: 0, duration: 0.2, ease: 'power1.out' }, 0.87)
        .to(root, { autoAlpha: 0, duration: 0.16, ease: 'power1.out' }, 0.98)
    }

    const start = async () => {
      await Promise.race([
        waitForImage(cloneImage),
        new Promise<void>((resolve) => window.setTimeout(resolve, 700))
      ])
      if (cancelled) return
      await nextFrame()
      if (cancelled) return
      timeline.eventCallback('onComplete', finish)
      timeline.play(0)
    }

    void start()

    return () => {
      cancelled = true
      timeline.kill()
      gsap.killTweensOf([
        root,
        importView,
        dropzone,
        plus,
        adjustment,
        ...targetElements,
        clone,
        cloneImage,
        cloneMask,
        cloneScan,
        cloneEdge,
        ...cloneCorners
      ].filter(Boolean))
    }
  }, [accent, adjustmentRef, dropzoneRef, headerRef, importViewRef, maskUrl, onComplete, plusRef, previewUrl, railRef, secondary, stagePanelRef, stageShellRef])

  return (
    <div ref={rootRef} className="artwork-reveal-transition" aria-hidden="true">
      <div className="artwork-reveal-veil" />
      <div ref={cloneRef} className="artwork-reveal-clone">
        <img ref={cloneImageRef} className="artwork-reveal-clone-image" src={previewUrl} alt="" />
        <img ref={cloneMaskRef} className="artwork-reveal-clone-mask" src={maskUrl} alt="" />
        <span ref={cloneScanRef} className="artwork-reveal-scan" />
        <span ref={cloneEdgeRef} className="artwork-reveal-edge" />
        <span className="artwork-reveal-corner artwork-reveal-corner-one" />
        <span className="artwork-reveal-corner artwork-reveal-corner-two" />
        <span className="artwork-reveal-corner artwork-reveal-corner-three" />
        <span className="artwork-reveal-corner artwork-reveal-corner-four" />
      </div>
    </div>
  )
}

export default ArtworkRevealTransition
