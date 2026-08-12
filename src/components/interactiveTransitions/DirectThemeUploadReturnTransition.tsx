import { useEffect, useRef, type RefObject } from 'react'
import { Plus } from 'lucide-react'
import { gsap } from 'gsap'
import { useTranslation } from 'react-i18next'
import type { DirectUploadTheme } from '../../services/directUploadThemes.ts'

interface DirectThemeUploadReturnTransitionProps {
  theme: DirectUploadTheme
  sourceRootRef: RefObject<HTMLElement>
  targetRootRef: RefObject<HTMLElement>
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

const DirectThemeUploadReturnTransition: React.FC<DirectThemeUploadReturnTransitionProps> = ({
  theme,
  sourceRootRef,
  targetRootRef,
  onSceneSwitch,
  onComplete
}) => {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const washRef = useRef<HTMLDivElement>(null)
  const cloneRef = useRef<HTMLDivElement>(null)
  const cloneImageRef = useRef<HTMLImageElement>(null)
  const clonePlusRef = useRef<HTMLSpanElement>(null)
  const cloneCopyRef = useRef<HTMLDivElement>(null)
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
    const cloneImage = cloneImageRef.current
    const clonePlus = clonePlusRef.current
    const cloneCopy = cloneCopyRef.current
    const source = sourceRootRef.current
    const sourceTopbar = source?.querySelector<HTMLElement>('.ipad-topbar')
    const sourceDropzone = source?.querySelector<HTMLElement>('.direct-import-workspace .import-dropzone')
    const sourcePlus = sourceDropzone?.querySelector<HTMLElement>('.import-plus')
    const sourceCopy = sourceDropzone
      ? Array.from(sourceDropzone.querySelectorAll<HTMLElement>('strong, span:last-child'))
      : []

    if (!root || !wash || !clone || !cloneImage || !clonePlus || !cloneCopy) return

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const sourcePlusRect = sourcePlus?.getBoundingClientRect()
    const startSize = sourcePlusRect?.width && sourcePlusRect.height
      ? Math.min(sourcePlusRect.width, sourcePlusRect.height)
      : 86
    const startLeft = sourcePlusRect?.left ?? (viewportWidth - startSize) / 2
    const startTop = sourcePlusRect?.top ?? (viewportHeight - startSize) / 2
    const stagingWidth = Math.min(224, Math.max(184, viewportWidth * 0.19))
    const stagingHeight = stagingWidth / 0.91
    const stagingLeft = (viewportWidth - stagingWidth) / 2
    const stagingTop = (viewportHeight - stagingHeight) / 2
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const supportsFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const timelines: gsap.core.Timeline[] = []
    let destinationCardMotions: HTMLElement[] = []
    let destinationHeader: HTMLElement | null = null
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
        new Promise<void>((resolve) => window.setTimeout(resolve, 450))
      ])
    }

    const findDestination = async () => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const target = targetRootRef.current
        const selectedCard = target?.querySelector<HTMLElement>(`[data-theme-id="${theme.id}"]`)
        const selectedCardMotion = selectedCard?.closest<HTMLElement>('.direct-theme-card-motion')
        const header = target?.querySelector<HTMLElement>('.direct-magic-header')
        const cardMotions = target ? Array.from(target.querySelectorAll<HTMLElement>('.direct-theme-card-motion')) : []
        if (target && selectedCard && selectedCardMotion && header && cardMotions.length > 0) {
          return { selectedCard, selectedCardMotion, header, cardMotions }
        }
        await nextFrame()
      }
      return null
    }

    gsap.set(root, { visibility: 'hidden' })
    gsap.set(wash, { clipPath: 'inset(100% 0 0 0)', opacity: 1 })
    gsap.set(clone, {
      left: startLeft,
      top: startTop,
      width: startSize,
      height: startSize,
      borderRadius: startSize / 2,
      opacity: 1
    })
    gsap.set(cloneImage, { opacity: 0, scale: 1.08 })
    gsap.set(clonePlus, { opacity: 1, scale: 1, rotation: 0 })
    gsap.set(cloneCopy, { opacity: 0, y: 8 })

    const run = async () => {
      await waitForCloneImage()
      if (cancelled) return

      gsap.set(root, { visibility: 'visible' })
      gsap.set(sourcePlus ?? [], { opacity: 0 })

      if (reducedMotion) {
        const reducedExit = gsap.timeline({ paused: true })
          .to([sourceTopbar, sourceDropzone].filter(Boolean), { opacity: 0, duration: 0.14 }, 0)
          .to(wash, { clipPath: 'inset(0% 0 0 0)', duration: 0.18, ease: 'power1.inOut' }, 0.04)
          .set(clone, { opacity: 0 }, 0.16)
        timelines.push(reducedExit)
        await playTimeline(reducedExit)
      } else {
        const exitTimeline = gsap.timeline({ paused: true, defaults: { overwrite: 'auto' } })
          .to(sourceTopbar ?? [], { opacity: 0, y: -9, duration: 0.22, ease: 'power2.in' }, 0)
          .to(sourceCopy, { opacity: 0, y: 8, duration: 0.16, stagger: 0.018, ease: 'power2.in' }, 0)
          .to(sourceDropzone ?? [], {
            borderColor: 'rgba(23,23,23,0)',
            backgroundColor: 'rgba(255,255,255,0)',
            duration: 0.26,
            ease: 'power2.inOut'
          }, 0.02)
          .to(clone, {
            left: stagingLeft,
            top: stagingTop,
            width: stagingWidth,
            height: stagingHeight,
            borderRadius: 8,
            boxShadow: '0 22px 54px rgba(18,25,31,.34), 0 0 0 2px rgba(255,255,255,.86), 0 0 30px var(--direct-return-accent)',
            duration: 0.46,
            ease: 'power3.inOut'
          }, 0.05)
          .to(clonePlus, { opacity: 0, scale: 0.62, rotation: 18, duration: 0.18, ease: 'power2.in' }, 0.12)
          .to(cloneImage, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }, 0.17)
          .to(cloneCopy, { opacity: 1, y: 0, duration: 0.24, ease: 'power2.out' }, 0.23)
          .to(wash, { clipPath: 'inset(0% 0 0 0)', duration: 0.38, ease: 'power3.inOut' }, 0.13)
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

      const { selectedCard, selectedCardMotion, header, cardMotions } = destination
      destinationCardMotions = cardMotions
      destinationHeader = header
      const otherCardMotions = cardMotions.filter((cardMotion) => cardMotion !== selectedCardMotion)
      const targetRect = selectedCard.getBoundingClientRect()

      gsap.killTweensOf(cardMotions)
      gsap.set(cardMotions, { clearProps: 'opacity,transform,filter' })
      gsap.set(selectedCardMotion, { opacity: 0 })
      gsap.set(otherCardMotions, { opacity: 0, y: 16, scale: 0.94, rotationY: 8 })
      gsap.set(header, { opacity: 0, y: -10 })

      if (reducedMotion) {
        const reducedEntry = gsap.timeline({ paused: true })
          .set(clone, { opacity: 0 })
          .to(wash, { opacity: 0, duration: 0.18, ease: 'power1.out' }, 0)
          .to([header, ...cardMotions], { opacity: 1, y: 0, scale: 1, rotationY: 0, duration: 0.18 }, 0.04)
        timelines.push(reducedEntry)
        await playTimeline(reducedEntry)
      } else {
        const entryTimeline = gsap.timeline({ paused: true, defaults: { overwrite: 'auto' } })
          .to(clone, {
            left: targetRect.left,
            top: targetRect.top,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: 8,
            duration: 0.42,
            ease: 'power3.inOut'
          }, 0)
          .to(wash, { opacity: 0, duration: 0.4, ease: 'power2.inOut' }, 0)
          .to(header, { opacity: 1, y: 0, duration: 0.28, ease: 'power3.out' }, 0.12)
          .to(otherCardMotions, {
            opacity: 1,
            y: 0,
            scale: 1,
            rotationY: 0,
            duration: 0.3,
            stagger: 0.035,
            ease: 'power3.out'
          }, 0.14)
          .set(selectedCardMotion, { opacity: 1 }, 0.37)
          .to(clone, { opacity: 0, duration: 0.12, ease: 'power1.out' }, 0.37)
        timelines.push(entryTimeline)
        await playTimeline(entryTimeline)
      }

      if (supportsFinePointer) {
        selectedCard.focus({ preventScroll: true })
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
        clonePlus,
        cloneCopy,
        sourceTopbar,
        sourceDropzone,
        sourcePlus,
        ...sourceCopy,
        destinationHeader,
        ...destinationCardMotions
      ].filter(Boolean))
      gsap.set([destinationHeader, ...destinationCardMotions].filter(Boolean), { clearProps: 'opacity,transform,filter' })
    }
  }, [sourceRootRef, targetRootRef, theme])

  const accents = THEME_ACCENTS[theme.id] ?? THEME_ACCENTS.ocean
  const style = {
    '--direct-return-accent': accents.accent,
    '--direct-return-secondary': accents.secondary
  } as React.CSSProperties

  return (
    <div ref={rootRef} className="direct-theme-upload-return-transition" style={style} aria-hidden="true">
      <div ref={washRef} className="direct-theme-upload-return-wash" />
      <div ref={cloneRef} className="direct-theme-upload-return-clone">
        <img ref={cloneImageRef} className="direct-theme-upload-return-image" src={theme.cover} alt="" />
        <span className="direct-theme-upload-return-shade" />
        <div ref={cloneCopyRef} className="direct-theme-upload-return-copy">
          <strong>{t(theme.labelKey)}</strong>
        </div>
        <span ref={clonePlusRef} className="direct-theme-upload-return-plus">
          <Plus />
        </span>
        <span className="direct-theme-upload-return-edge" />
      </div>
    </div>
  )
}

export default DirectThemeUploadReturnTransition
