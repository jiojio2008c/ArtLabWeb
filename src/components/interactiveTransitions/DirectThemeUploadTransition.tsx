import { useEffect, useRef, type RefObject } from 'react'
import { Plus } from 'lucide-react'
import { gsap } from 'gsap'
import { useTranslation } from 'react-i18next'
import type { DynamicTransitionOrigin } from '../dynamicTransitions/types.ts'
import type { DirectUploadTheme } from '../../services/directUploadThemes.ts'

interface DirectThemeUploadTransitionProps {
  origin: DynamicTransitionOrigin
  theme: DirectUploadTheme
  sourceRootRef: RefObject<HTMLElement>
  onSceneSwitch: () => void
  onComplete: () => void
}

const THEME_ACCENTS: Record<string, { accent: string; secondary: string }> = {
  ocean: { accent: '#76efff', secondary: '#3b75ff' },
  'forest-1': { accent: '#b6ff8e', secondary: '#8f5cff' },
  'forest-2': { accent: '#78ffd2', secondary: '#ff68bf' },
  'painting-real': { accent: '#ffd878', secondary: '#ff6da8' }
}

const nextFrame = () => new Promise<void>((resolve) => {
  window.requestAnimationFrame(() => resolve())
})

const playTimeline = (timeline: gsap.core.Timeline) => new Promise<void>((resolve) => {
  timeline.eventCallback('onComplete', resolve)
  timeline.play(0)
})

const DirectThemeUploadTransition: React.FC<DirectThemeUploadTransitionProps> = ({
  origin,
  theme,
  sourceRootRef,
  onSceneSwitch,
  onComplete
}) => {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const washRef = useRef<HTMLDivElement>(null)
  const cloneRef = useRef<HTMLDivElement>(null)
  const clonePlusRef = useRef<HTMLSpanElement>(null)
  const movingTitleRef = useRef<HTMLSpanElement>(null)
  const onSceneSwitchRef = useRef(onSceneSwitch)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onSceneSwitchRef.current = onSceneSwitch
    onCompleteRef.current = onComplete
  }, [onComplete, onSceneSwitch])

  useEffect(() => {
    const root = rootRef.current
    const wash = washRef.current
    const clone = cloneRef.current
    const clonePlus = clonePlusRef.current
    const movingTitle = movingTitleRef.current
    const source = sourceRootRef.current
    const selectedCard = source?.querySelector<HTMLElement>(`[data-theme-id="${theme.id}"]`)
    const selectedTitle = selectedCard?.querySelector<HTMLElement>('.direct-theme-content strong')
    const cloneImage = clone?.querySelector<HTMLImageElement>('.direct-theme-upload-clone-image')
    const cloneCopy = clone?.querySelector<HTMLElement>('.direct-theme-upload-clone-copy')
    const cloneShade = clone?.querySelector<HTMLElement>('.direct-theme-upload-clone-shade')
    const cloneEdge = clone?.querySelector<HTMLElement>('.direct-theme-upload-clone-edge')
    const cloneScan = clone?.querySelector<HTMLElement>('.direct-theme-upload-clone-scan')

    if (!root || !wash || !clone || !clonePlus || !movingTitle || !cloneImage || !cloneCopy || !cloneShade || !cloneEdge || !cloneScan) {
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sourceTitleRect = selectedTitle?.getBoundingClientRect() ?? {
      left: origin.left + 12,
      top: origin.top + origin.height - 44,
      width: origin.width - 24,
      height: 28
    }
    const cards = source ? Array.from(source.querySelectorAll<HTMLElement>('.direct-theme-card')) : []
    const otherCards = cards.filter((card) => card !== selectedCard)
    const sourceHeader = source?.querySelector<HTMLElement>('.direct-magic-header')
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const restingWidth = Math.min(origin.width * 1.06, 258)
    const restingHeight = restingWidth * (origin.height / origin.width)
    const restingLeft = (viewportWidth - restingWidth) / 2
    const restingTop = (viewportHeight - restingHeight) / 2
    const stagingTitleLeft = Math.max(42, restingLeft - Math.min(330, viewportWidth * 0.28))
    const traces = Array.from(root.querySelectorAll<HTMLElement>('.direct-theme-upload-trace'))
    const timelines: gsap.core.Timeline[] = []
    let destinationElements: HTMLElement[] = []
    let cancelled = false

    const waitForCloneImage = async () => {
      if (cloneImage.complete && cloneImage.naturalWidth > 0) {
        await cloneImage.decode?.().catch(() => undefined)
        return
      }
      await Promise.race([
        new Promise<void>((resolve) => {
          cloneImage.addEventListener('load', () => resolve(), { once: true })
          cloneImage.addEventListener('error', () => resolve(), { once: true })
        }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 500))
      ])
    }

    const findDestination = async () => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const screen = document.querySelector<HTMLElement>('.page-view-directUpload .upload-screen')
        const dropzone = screen?.querySelector<HTMLElement>('.direct-import-workspace .import-dropzone')
        const plus = dropzone?.querySelector<HTMLElement>('.import-plus')
        const title = screen?.querySelector<HTMLElement>('.screen-title')
        const topbar = screen?.querySelector<HTMLElement>('.ipad-topbar')
        if (screen && dropzone && plus && title && topbar) {
          return { screen, dropzone, plus, title, topbar }
        }
        await nextFrame()
      }
      return null
    }

    gsap.set(root, { visibility: 'hidden' })
    gsap.set(wash, { clipPath: 'inset(100% 0 0 0)', opacity: 1 })
    gsap.set(clone, {
      left: origin.left,
      top: origin.top,
      width: origin.width,
      height: origin.height,
      borderRadius: 8,
      opacity: 1
    })
    gsap.set(clonePlus, { opacity: 0, scale: 0.55, rotation: -18 })
    gsap.set(movingTitle, {
      left: sourceTitleRect.left,
      top: sourceTitleRect.top,
      width: sourceTitleRect.width,
      height: sourceTitleRect.height,
      color: '#ffffff',
      fontSize: 18,
      opacity: 0
    })
    gsap.set(cloneScan, { xPercent: -150, opacity: 0 })
    gsap.set(traces, { opacity: 0, scaleX: 0, transformOrigin: 'center center' })

    const run = async () => {
      await waitForCloneImage()
      if (cancelled) return

      gsap.set(root, { visibility: 'visible' })

      if (reducedMotion) {
        const reducedExit = gsap.timeline({ paused: true })
          .to([sourceHeader, ...cards].filter(Boolean), { opacity: 0, duration: 0.16 }, 0)
          .to(wash, { clipPath: 'inset(0% 0 0 0)', duration: 0.22, ease: 'power1.inOut' }, 0)
          .set(clone, { opacity: 0 }, 0.2)
        timelines.push(reducedExit)
        await playTimeline(reducedExit)
      } else {
        const exitTimeline = gsap.timeline({ paused: true, defaults: { overwrite: 'auto' } })
          .to(selectedCard ?? [], {
            scale: 0.965,
            boxShadow: `0 0 0 2px rgba(255,255,255,.94), 0 0 24px var(--direct-upload-accent)`,
            duration: 0.13,
            ease: 'power2.out'
          }, 0)
          .to(selectedCard ?? [], { opacity: 0, duration: 0.14, ease: 'power1.out' }, 0.11)
          .to(otherCards, {
            y: 14,
            scale: 0.95,
            opacity: 0,
            filter: 'blur(4px)',
            duration: 0.4,
            stagger: 0.018,
            ease: 'power2.inOut'
          }, 0.07)
          .to(sourceHeader ?? [], { opacity: 0, y: -8, duration: 0.34, ease: 'power2.inOut' }, 0.07)
          .to(clone, {
            left: restingLeft,
            top: restingTop,
            width: restingWidth,
            height: restingHeight,
            borderRadius: 10,
            boxShadow: '0 18px 48px rgba(18,25,31,.3), 0 0 0 2px rgba(255,255,255,.88), 0 0 30px var(--direct-upload-accent)',
            duration: 0.5,
            ease: 'power3.inOut'
          }, 0.11)
          .to(wash, { clipPath: 'inset(0% 0 0 0)', duration: 0.58, ease: 'power3.inOut' }, 0.18)
          .to(cloneCopy, { opacity: 0, y: -6, duration: 0.2, ease: 'power2.in' }, 0.2)
          .to(movingTitle, { opacity: 1, duration: 0.14, ease: 'power1.out' }, 0.21)
          .to(movingTitle, {
            left: stagingTitleLeft,
            top: viewportHeight / 2 - 16,
            color: '#7b7d82',
            duration: 0.46,
            ease: 'power3.inOut'
          }, 0.26)
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
            duration: 0.36,
            stagger: 0.025,
            ease: 'power2.inOut'
          }, 0.5)
        timelines.push(exitTimeline)
        await playTimeline(exitTimeline)
      }

      if (cancelled) return
      onSceneSwitchRef.current()
      await nextFrame()
      await nextFrame()

      const destination = await findDestination()
      if (cancelled) return
      if (!destination) {
        gsap.set(root, { visibility: 'hidden' })
        onCompleteRef.current()
        return
      }

      const { dropzone, plus, title, topbar } = destination
      const backButton = topbar.querySelector<HTMLElement>('button')
      const heading = topbar.querySelector<HTMLElement>('.min-w-0')
      const eyebrow = heading?.querySelector<HTMLElement>('.eyebrow')
      const targetPlusRect = plus.getBoundingClientRect()
      const targetTitleRect = title.getBoundingClientRect()
      const targetTitleStyle = window.getComputedStyle(title)

      destinationElements = [backButton, heading, eyebrow, title, dropzone].filter((element): element is HTMLElement => Boolean(element))
      gsap.set(backButton ?? [], { opacity: 0, y: 10 })
      gsap.set(heading ?? [], { opacity: 1, y: 0 })
      gsap.set([eyebrow, title].filter(Boolean), { opacity: 0 })
      gsap.set(dropzone, { opacity: 0, y: 10, scale: 0.985 })

      if (reducedMotion) {
        const reducedEntry = gsap.timeline({ paused: true })
          .to([backButton, dropzone].filter(Boolean), {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.2
          }, 0)
          .to(title, { opacity: 1, duration: 0.14 }, 0.04)
          .to(eyebrow ?? [], { opacity: 1, duration: 0.14 }, 0.08)
          .to(wash, { opacity: 0, duration: 0.2 }, 0.08)
        timelines.push(reducedEntry)
        await playTimeline(reducedEntry)
      } else {
        const entryTimeline = gsap.timeline({ paused: true, defaults: { overwrite: 'auto' } })
          .to(movingTitle, {
            left: targetTitleRect.left,
            top: targetTitleRect.top,
            width: targetTitleRect.width,
            height: targetTitleRect.height,
            color: targetTitleStyle.color,
            fontSize: targetTitleStyle.fontSize,
            duration: 0.46,
            ease: 'power3.inOut'
          }, 0)
          .to(clone, {
            left: targetPlusRect.left,
            top: targetPlusRect.top,
            width: targetPlusRect.width,
            height: targetPlusRect.height,
            borderRadius: targetPlusRect.width / 2,
            borderColor: '#171717',
            backgroundColor: '#171717',
            boxShadow: '0 9px 22px rgba(17,19,22,.2)',
            duration: 0.46,
            ease: 'power3.inOut'
          }, 0)
          .to(cloneImage, {
            opacity: 0,
            scale: 1.12,
            filter: 'saturate(.7) brightness(1.14)',
            duration: 0.32,
            ease: 'power2.in'
          }, 0.05)
          .to([cloneShade, cloneEdge], { opacity: 0, duration: 0.24, ease: 'power1.out' }, 0.06)
          .to(cloneScan, { opacity: 0.62, xPercent: 190, duration: 0.32, ease: 'power1.inOut' }, 0.02)
          .to(clonePlus, { opacity: 1, scale: 1, rotation: 0, duration: 0.25, ease: 'back.out(1.35)' }, 0.22)
          .to(backButton ?? [], { opacity: 1, y: 0, duration: 0.28, ease: 'power3.out' }, 0.14)
          .to(title, { opacity: 1, duration: 0.1, ease: 'power1.inOut' }, 0.46)
          .to(movingTitle, { opacity: 0, duration: 0.1, ease: 'power1.inOut' }, 0.46)
          .to(eyebrow ?? [], { opacity: 1, duration: 0.14, ease: 'power2.out' }, 0.5)
          .to(dropzone, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power2.out' }, 0.32)
          .to(clone, { opacity: 0, duration: 0.18, ease: 'power1.out' }, 0.44)
          .to(wash, { opacity: 0, duration: 0.2, ease: 'power1.out' }, 0.42)
        timelines.push(entryTimeline)
        await playTimeline(entryTimeline)
      }

      if (!cancelled) onCompleteRef.current()
    }

    void run()

    return () => {
      cancelled = true
      timelines.forEach((timeline) => timeline.kill())
      gsap.killTweensOf([
        root,
        wash,
        clone,
        cloneImage,
        cloneCopy,
        cloneShade,
        cloneEdge,
        cloneScan,
        clonePlus,
        movingTitle,
        ...traces,
        ...cards,
        sourceHeader,
        ...destinationElements
      ].filter(Boolean))
      gsap.set(destinationElements, { clearProps: 'opacity,transform,filter' })
    }
  }, [origin, sourceRootRef, theme])

  const accents = THEME_ACCENTS[theme.id] ?? THEME_ACCENTS.ocean
  const style = {
    '--direct-upload-accent': accents.accent,
    '--direct-upload-secondary': accents.secondary
  } as React.CSSProperties

  return (
    <div ref={rootRef} className="direct-theme-upload-transition" style={style} aria-hidden="true">
      <div className="direct-theme-upload-veil" />
      <div ref={washRef} className="direct-theme-upload-wash" />
      <div className="direct-theme-upload-traces">
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className="direct-theme-upload-trace"
            style={{ '--trace-index': index } as React.CSSProperties}
          />
        ))}
      </div>
      <span ref={movingTitleRef} className="direct-theme-upload-moving-title">{t(theme.labelKey)}</span>
      <div ref={cloneRef} className="direct-theme-upload-clone">
        <img className="direct-theme-upload-clone-image" src={theme.cover} alt="" />
        <span className="direct-theme-upload-clone-shade" />
        <div className="direct-theme-upload-clone-copy">
          <strong>{t(theme.labelKey)}</strong>
        </div>
        <span ref={clonePlusRef} className="direct-theme-upload-clone-plus">
          <Plus />
        </span>
        <span className="direct-theme-upload-clone-scan" />
        <span className="direct-theme-upload-clone-edge" />
      </div>
    </div>
  )
}

export default DirectThemeUploadTransition
