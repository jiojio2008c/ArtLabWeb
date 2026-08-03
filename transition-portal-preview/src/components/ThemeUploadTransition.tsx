import { useEffect, useRef, type RefObject } from 'react'
import { Plus } from 'lucide-react'
import { gsap } from 'gsap'
import type { PortalOrigin } from '../types.ts'
import type { InteractiveTheme } from './interactiveThemeData.ts'

interface ThemeUploadTransitionProps {
  origin: PortalOrigin
  theme: InteractiveTheme
  interactiveRef: RefObject<HTMLElement>
  uploadRef: RefObject<HTMLElement>
  onComplete: () => void
}

const ThemeUploadTransition: React.FC<ThemeUploadTransitionProps> = ({
  origin,
  theme,
  interactiveRef,
  uploadRef,
  onComplete
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const washRef = useRef<HTMLDivElement>(null)
  const cloneRef = useRef<HTMLDivElement>(null)
  const clonePlusRef = useRef<HTMLSpanElement>(null)
  const movingTitleRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const wash = washRef.current
    const clone = cloneRef.current
    const clonePlus = clonePlusRef.current
    const movingTitle = movingTitleRef.current
    const interactive = interactiveRef.current
    const upload = uploadRef.current
    const target = upload?.querySelector<HTMLElement>('.theme-upload-dropzone')
    const targetPlus = upload?.querySelector<HTMLElement>('.theme-upload-dropzone-plus')
    const targetTitle = upload?.querySelector<HTMLElement>('.theme-upload-title')
    const uploadHeading = upload?.querySelector<HTMLElement>('.theme-upload-import-heading')
    const selectedCard = interactive?.querySelector<HTMLElement>(`[data-theme-id="${theme.id}"]`)
    const selectedTitle = selectedCard?.querySelector<HTMLElement>('.interactive-theme-copy strong')

    if (
      !root || !wash || !clone || !clonePlus || !movingTitle || !interactive || !upload
      || !target || !targetPlus || !targetTitle || !uploadHeading || !selectedCard
    ) {
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const targetPlusRect = targetPlus.getBoundingClientRect()
    const targetTitleRect = targetTitle.getBoundingClientRect()
    const sourceTitleRect = selectedTitle?.getBoundingClientRect() ?? {
      left: origin.left + 14,
      top: origin.top + origin.height - 44,
      width: origin.width - 28,
      height: 28
    }
    const targetTitleStyle = window.getComputedStyle(targetTitle)
    const cards = Array.from(interactive.querySelectorAll<HTMLElement>('.interactive-theme-card'))
    const otherCards = cards.filter((card) => card !== selectedCard)
    const interactiveChrome = [
      interactive.querySelector<HTMLElement>('.interactive-theme-header'),
      interactive.querySelector<HTMLElement>('.interactive-card-size-switch'),
      interactive.querySelector<HTMLElement>('.magic-replay-button')
    ].filter(Boolean)
    const uploadReveals = Array.from(upload.querySelectorAll<HTMLElement>('.upload-reveal'))
    const controlReveals = uploadReveals.filter((element) => element !== target && element !== uploadHeading)
    const cloneImage = clone.querySelector<HTMLImageElement>('.theme-frame-clone-image')
    const cloneCopy = clone.querySelector<HTMLElement>('.theme-frame-clone-copy')
    const cloneShade = clone.querySelector<HTMLElement>('.theme-frame-clone-shade')
    const cloneScan = clone.querySelector<HTMLElement>('.theme-frame-clone-scan')
    const cloneEdge = clone.querySelector<HTMLElement>('.theme-frame-clone-edge')
    const traces = Array.from(root.querySelectorAll<HTMLElement>('.theme-transition-trace'))
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const restingWidth = Math.min(origin.width * 1.06, 258)
    const restingHeight = restingWidth * (origin.height / origin.width)
    const restingLeft = (viewportWidth - restingWidth) / 2
    const restingTop = (viewportHeight - restingHeight) / 2

    let cancelled = false
    const waitForImage = (image: HTMLImageElement | null) => {
      if (!image) return Promise.resolve()
      if (image.complete && image.naturalWidth > 0) {
        return image.decode?.().catch(() => undefined) ?? Promise.resolve()
      }
      return new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      })
    }
    const playWhenMediaIsReady = async (timeline: gsap.core.Timeline) => {
      await Promise.race([
        waitForImage(cloneImage),
        new Promise<void>((resolve) => window.setTimeout(resolve, 450))
      ])
      if (cancelled) return
      gsap.set(root, { visibility: 'visible' })
      timeline.play(0)
    }

    gsap.set(root, { visibility: 'hidden' })
    gsap.set(upload, { visibility: 'visible', opacity: 0 })
    gsap.set(uploadReveals, { opacity: 0, y: 12 })
    gsap.set(target, { y: 10, scale: 0.985 })
    gsap.set(wash, { clipPath: 'inset(100% 0 0 0)', opacity: 1 })
    gsap.set(clone, {
      left: origin.left,
      top: origin.top,
      width: origin.width,
      height: origin.height,
      borderRadius: 8,
      borderStyle: 'solid',
      opacity: 1
    })
    gsap.set(clonePlus, { opacity: 0, scale: 0.55, rotation: -18 })
    gsap.set(movingTitle, {
      left: sourceTitleRect.left,
      top: sourceTitleRect.top,
      width: sourceTitleRect.width,
      height: sourceTitleRect.height,
      color: '#ffffff',
      fontSize: 19,
      opacity: 0
    })
    gsap.set(cloneScan, { xPercent: -150, opacity: 0 })
    gsap.set(traces, {
      opacity: 0,
      scaleX: 0,
      transformOrigin: 'center center'
    })

    if (reducedMotion) {
      const reducedTimeline = gsap.timeline({ paused: true, onComplete })
        .set([clone, movingTitle], { opacity: 0 }, 0)
        .to(interactive, { opacity: 0, duration: 0.18 }, 0)
        .to(wash, { clipPath: 'inset(0% 0 0 0)', duration: 0.2 }, 0)
        .to(upload, { opacity: 1, duration: 0.2 }, 0.1)
        .to(uploadReveals, { opacity: 1, y: 0, scale: 1, duration: 0.2 }, 0.16)
        .set(interactive, { visibility: 'hidden' }, 0.38)

      void playWhenMediaIsReady(reducedTimeline)
      return () => {
        cancelled = true
        reducedTimeline.kill()
      }
    }

    const timeline = gsap.timeline({ paused: true, defaults: { overwrite: 'auto' }, onComplete })
      .to(selectedCard, {
        scale: 0.965,
        boxShadow: `0 0 0 2px rgba(255,255,255,.94), 0 0 24px ${theme.accent}`,
        duration: 0.13,
        ease: 'power2.out'
      }, 0)
      .to(selectedCard, { opacity: 0, duration: 0.14, ease: 'power1.out' }, 0.11)
      .to(otherCards, {
        y: 14,
        scale: 0.95,
        opacity: 0,
        filter: 'blur(4px)',
        duration: 0.4,
        stagger: 0.018,
        ease: 'power2.inOut'
      }, 0.07)
      .to(interactiveChrome, { opacity: 0, y: -8, duration: 0.34, ease: 'power2.inOut' }, 0.07)
      .to(clone, {
        left: restingLeft,
        top: restingTop,
        width: restingWidth,
        height: restingHeight,
        borderRadius: 10,
        boxShadow: `0 18px 48px rgba(18,25,31,.3), 0 0 0 2px rgba(255,255,255,.88), 0 0 30px ${theme.accent}`,
        duration: 0.5,
        ease: 'power3.inOut'
      }, 0.11)
      .to(wash, {
        clipPath: 'inset(0% 0 0 0)',
        duration: 0.58,
        ease: 'power3.inOut'
      }, 0.18)
      .to(cloneCopy, { opacity: 0, y: -6, duration: 0.2, ease: 'power2.in' }, 0.2)
      .to(movingTitle, { opacity: 1, duration: 0.14, ease: 'power1.out' }, 0.21)
      .to(traces, {
        opacity: 0.42,
        scaleX: 1,
        duration: 0.32,
        stagger: 0.035,
        ease: 'power2.out'
      }, 0.3)
      .to(traces, {
        opacity: 0,
        scaleX: 1.16,
        duration: 0.4,
        stagger: 0.025,
        ease: 'power2.inOut'
      }, 0.55)
      .to(upload, { opacity: 1, duration: 0.12 }, 0.7)
      .to(movingTitle, {
        left: targetTitleRect.left,
        top: targetTitleRect.top,
        width: targetTitleRect.width,
        height: targetTitleRect.height,
        color: targetTitleStyle.color,
        fontSize: targetTitleStyle.fontSize,
        duration: 0.58,
        ease: 'power3.inOut'
      }, 0.4)
      .to(clone, {
        left: targetPlusRect.left,
        top: targetPlusRect.top,
        width: targetPlusRect.width,
        height: targetPlusRect.height,
        borderRadius: targetPlusRect.width / 2,
        borderColor: '#15171a',
        backgroundColor: '#15171a',
        boxShadow: '0 9px 22px rgba(17,19,22,.2)',
        duration: 0.48,
        ease: 'power3.inOut'
      }, 0.61)
      .to(cloneImage, {
        opacity: 0,
        scale: 1.12,
        filter: 'saturate(.7) brightness(1.14)',
        duration: 0.34,
        ease: 'power2.in'
      }, 0.66)
      .to(cloneShade, { opacity: 0, duration: 0.26, ease: 'power2.out' }, 0.66)
      .to(cloneEdge, { opacity: 0, duration: 0.24, ease: 'power1.out' }, 0.68)
      .to(cloneScan, { opacity: 0.62, xPercent: 190, duration: 0.34, ease: 'power1.inOut' }, 0.55)
      .to(clonePlus, { opacity: 1, scale: 1, rotation: 0, duration: 0.28, ease: 'back.out(1.35)' }, 0.83)
      .to(controlReveals, { opacity: 1, y: 0, duration: 0.3, stagger: 0.04, ease: 'power3.out' }, 0.79)
      .to(uploadHeading, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, 0.94)
      .to(movingTitle, { opacity: 0, duration: 0.14, ease: 'power1.out' }, 0.94)
      .to(target, { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: 'power2.out' }, 0.94)
      .to(clone, { opacity: 0, duration: 0.2, ease: 'power1.out' }, 1.05)
      .to(wash, { opacity: 0, duration: 0.18, ease: 'power1.out' }, 1.04)
      .set(interactive, { visibility: 'hidden' }, 1.24)
      .to({}, { duration: 0.04 }, 1.25)

    void playWhenMediaIsReady(timeline)
    return () => {
      cancelled = true
      timeline.kill()
    }
  }, [interactiveRef, onComplete, origin, theme, uploadRef])

  const transitionStyle = {
    '--transition-accent': theme.accent,
    '--transition-secondary': theme.secondary
  } as React.CSSProperties

  return (
    <div ref={rootRef} className={`theme-upload-transition theme-${theme.effect}`} style={transitionStyle} aria-hidden="true">
      <div className="theme-transition-veil" />
      <div ref={washRef} className="theme-transition-canvas-wash" />
      <div className="theme-transition-traces">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className="theme-transition-trace" style={{ '--trace-index': index } as React.CSSProperties} />
        ))}
      </div>
      <span ref={movingTitleRef} className="theme-transition-moving-title">{theme.title}</span>
      <div ref={cloneRef} className="theme-frame-clone">
        <img className="theme-frame-clone-image" src={theme.image} alt="" />
        <span className="theme-frame-clone-shade" />
        <div className="theme-frame-clone-copy">
          <strong>{theme.title}</strong>
          <span>{theme.maskLabel}</span>
        </div>
        <span ref={clonePlusRef} className="theme-frame-clone-plus">
          <Plus />
        </span>
        <span className="theme-frame-clone-scan" />
        <span className="theme-frame-clone-edge" />
      </div>
    </div>
  )
}

export default ThemeUploadTransition
