import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import type { DynamicArtworkTransitionRequest, DynamicTransitionOrigin } from './types.ts'

interface DynamicArtworkTransitionProps {
  request: DynamicArtworkTransitionRequest
  onSceneSwitch: () => void
  onComplete: () => void
}

const getFallbackOrigin = (): DynamicTransitionOrigin => ({
  left: window.innerWidth * 0.32,
  top: window.innerHeight * 0.31,
  width: Math.min(320, window.innerWidth * 0.28),
  height: Math.min(220, window.innerHeight * 0.28)
})

const getRect = (element: Element | null | undefined): DynamicTransitionOrigin | null => {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
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

const waitForImage = (image: HTMLImageElement, timeoutMs: number) => new Promise<void>((resolve) => {
  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    window.clearTimeout(timeout)
    image.removeEventListener('load', handleLoad)
    image.removeEventListener('error', finish)
    resolve()
  }
  const decode = () => {
    const decodePromise = image.decode?.()
    if (decodePromise) {
      void decodePromise.catch(() => undefined).then(finish)
    } else {
      finish()
    }
  }
  const handleLoad = () => decode()
  const timeout = window.setTimeout(finish, timeoutMs)

  if (image.complete) {
    if (image.naturalWidth > 0) decode()
    else finish()
    return
  }

  image.addEventListener('load', handleLoad, { once: true })
  image.addEventListener('error', finish, { once: true })
})

const waitForVideo = (video: HTMLVideoElement, timeoutMs: number) => new Promise<void>((resolve) => {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    resolve()
    return
  }

  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    window.clearTimeout(timeout)
    video.removeEventListener('loadedmetadata', finish)
    video.removeEventListener('error', finish)
    resolve()
  }
  const timeout = window.setTimeout(finish, timeoutMs)
  video.addEventListener('loadedmetadata', finish, { once: true })
  video.addEventListener('error', finish, { once: true })
})

const waitForMediaElements = async (
  elements: Array<HTMLImageElement | HTMLVideoElement>,
  timeoutMs: number
) => {
  await Promise.all(elements.map((element) => (
    element instanceof HTMLImageElement
      ? waitForImage(element, timeoutMs)
      : waitForVideo(element, timeoutMs)
  )))
}

const waitForStageMedia = async (stage: HTMLElement) => {
  const media = Array.from(stage.querySelectorAll<HTMLImageElement | HTMLVideoElement>('img, video'))
  await waitForMediaElements(media, 900)
}

const waitForLibraryMedia = async (library: HTMLElement, groupId: string) => {
  const targetCard = library.querySelector<HTMLElement>(`[data-library-entity-id="${groupId}"]`)
  const targetMedia = targetCard
    ? Array.from(targetCard.querySelectorAll<HTMLImageElement | HTMLVideoElement>('img, video'))
    : []
  const visibleMedia = Array.from(
    library.querySelectorAll<HTMLImageElement | HTMLVideoElement>(
      '.dynamic-library-icon-preview img, .dynamic-library-icon-preview video, '
      + '.dynamic-library-detail-thumbnail img, .dynamic-library-detail-thumbnail video'
    )
  ).filter((element) => {
    const rect = element.getBoundingClientRect()
    return rect.bottom >= -80
      && rect.top <= window.innerHeight + 80
      && rect.right >= -80
      && rect.left <= window.innerWidth + 80
  })
  const media = Array.from(new Set([...targetMedia, ...visibleMedia])).slice(0, 12)
  await waitForMediaElements(media, 700)
}

const buildStageProxy = (stage: HTMLElement, proxy: HTMLElement) => {
  const clone = document.createElement('div')
  clone.className = `${stage.className} dynamic-story-stage-clone`

  const sourceMedia = stage.querySelector<HTMLImageElement | HTMLVideoElement>('.dynamic-stage-background')
  if (sourceMedia instanceof HTMLVideoElement) {
    if (sourceMedia.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && sourceMedia.videoWidth > 0) {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1280 / sourceMedia.videoWidth)
      canvas.width = Math.max(1, Math.round(sourceMedia.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(sourceMedia.videoHeight * scale))
      canvas.className = sourceMedia.className
      canvas.setAttribute('aria-hidden', 'true')
      try {
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas 2D context is unavailable')
        context.drawImage(sourceMedia, 0, 0, canvas.width, canvas.height)
        clone.append(canvas)
      } catch {
        const video = sourceMedia.cloneNode(true) as HTMLVideoElement
        video.autoplay = false
        video.loop = false
        video.muted = true
        clone.append(video)
      }
    } else {
      const video = sourceMedia.cloneNode(true) as HTMLVideoElement
      video.autoplay = false
      video.loop = false
      video.muted = true
      clone.append(video)
    }
  } else if (sourceMedia) {
    clone.append(sourceMedia.cloneNode(true))
  } else {
    const emptyStage = stage.querySelector<HTMLElement>('.dynamic-empty-stage')
    if (emptyStage) clone.append(emptyStage.cloneNode(true))
  }

  proxy.replaceChildren(clone)
}

const getActiveControlPanel = (control: HTMLElement) => control.querySelector<HTMLElement>(
  '.dynamic-editor-row > .dynamic-layer-panel, '
  + '.dynamic-editor-row > .dynamic-tool-panel, '
  + '.dynamic-editor-row > .dynamic-background-side-panel'
)

const getPieceOffset = (index: number) => ({
  x: index % 2 === 0 ? -window.innerWidth * 0.36 : window.innerWidth * 0.36,
  y: index < 2 ? -window.innerHeight * 0.18 : window.innerHeight * 0.2,
  rotation: index % 2 === 0 ? -8 : 9
})

const getViewportFrameRect = (): DynamicTransitionOrigin => ({
  left: 12,
  top: 12,
  width: Math.max(1, window.innerWidth - 24),
  height: Math.max(1, window.innerHeight - 24)
})

const setFrameFlip = (
  frameMotion: HTMLElement,
  sourceRect: DynamicTransitionOrigin,
  targetRect: DynamicTransitionOrigin
) => {
  gsap.set(frameMotion, {
    left: targetRect.left,
    top: targetRect.top,
    width: Math.max(1, targetRect.width),
    height: Math.max(1, targetRect.height),
    x: sourceRect.left - targetRect.left,
    y: sourceRect.top - targetRect.top,
    scaleX: sourceRect.width / Math.max(1, targetRect.width),
    scaleY: sourceRect.height / Math.max(1, targetRect.height),
    transformOrigin: '0 0',
    force3D: true
  })
}

const syncMediaCounterScale = (frameMotion: HTMLElement, media: HTMLElement | null) => {
  if (!media) return
  const scaleX = Number(gsap.getProperty(frameMotion, 'scaleX')) || 1
  const scaleY = Number(gsap.getProperty(frameMotion, 'scaleY')) || 1
  gsap.set(media, {
    scaleX: 1 / scaleX,
    scaleY: 1 / scaleY,
    transformOrigin: 'center center',
    force3D: true
  })
}

const DynamicArtworkTransition: React.FC<DynamicArtworkTransitionProps> = ({
  request,
  onSceneSwitch,
  onComplete
}) => {
  const frameMotionRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const stageProxyRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const tearsRef = useRef<HTMLDivElement>(null)
  const sceneSwitchRef = useRef(onSceneSwitch)
  const completeRef = useRef(onComplete)

  useEffect(() => {
    sceneSwitchRef.current = onSceneSwitch
    completeRef.current = onComplete
  }, [onComplete, onSceneSwitch])

  useEffect(() => {
    const frameMotion = frameMotionRef.current
    const frame = frameRef.current
    const workspace = workspaceRef.current
    const tears = tearsRef.current
    const stageProxy = stageProxyRef.current
    if (!frameMotion || !frame || !workspace || !tears || !stageProxy) return

    const media = frame.querySelector<HTMLElement>('.dynamic-story-frame-media')
    const tearPieces = Array.from(tears.querySelectorAll<HTMLElement>('.dynamic-story-tear-piece'))
    const sourceCard = document.querySelector<HTMLElement>(`[data-library-entity-id="${request.groupId}"]`)
    const sourcePage = request.direction === 'forward'
      ? sourceCard?.closest<HTMLElement>('.dynamic-library-screen')
        ?? document.querySelector<HTMLElement>('.dynamic-library-screen, .entry-screen')
      : document.querySelector<HTMLElement>('.dynamic-control-screen')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timelines: gsap.core.Timeline[] = []
    const cleanupTargets = new Set<Element>()
    let cancelled = false
    let sceneSwitched = false
    let finishScheduled = false
    let finishFrame = 0
    let settleFrame = 0

    const remember = (...targets: Array<Element | null | undefined>) => {
      targets.forEach((target) => {
        if (target) cleanupTargets.add(target)
      })
    }
    remember(sourceCard, sourcePage)

    const switchScene = () => {
      if (sceneSwitched || cancelled) return
      sceneSwitched = true
      sceneSwitchRef.current()
    }

    const preparedLibraryMountPromise = request.direction === 'backward'
      ? waitForElement<HTMLElement>('.dynamic-library-screen.dynamic-transition-prepared')
        .then(async (library) => {
          if (!library || cancelled) return library
          await waitForPaint()
          return library
        })
      : Promise.resolve(null)
    const preparedLibraryPromise = preparedLibraryMountPromise.then(async (library) => {
      if (!library || cancelled) return library
      await waitForLibraryMedia(library, request.groupId)
      return library
    })

    const finish = () => {
      if (cancelled || finishScheduled) return
      finishScheduled = true
      finishFrame = window.requestAnimationFrame(() => {
        settleFrame = window.requestAnimationFrame(() => {
          if (!cancelled) completeRef.current()
        })
      })
    }

    if (reducedMotion) {
      const timeline = gsap.timeline({ onComplete: finish })
        .to(sourcePage ?? frame, { opacity: 0, duration: 0.18 }, 0)
        .call(switchScene, [], 0.12)
        .to(frame, { opacity: 0, duration: 0.18 }, 0.16)
      timelines.push(timeline)
      return () => {
        cancelled = true
        window.cancelAnimationFrame(finishFrame)
        window.cancelAnimationFrame(settleFrame)
        timelines.forEach((item) => item.kill())
        cleanupTargets.forEach((target) => gsap.set(target, { clearProps: 'opacity,transform,boxShadow' }))
      }
    }

    const runForwardReveal = async () => {
      switchScene()
      const control = await waitForElement<HTMLElement>('.dynamic-control-screen')
      if (!control || cancelled) {
        finish()
        return
      }

      const stage = control.querySelector<HTMLElement>('.dynamic-stage')
      const stageShell = control.querySelector<HTMLElement>('.dynamic-stage-shell')
      const topbar = control.querySelector<HTMLElement>('.dynamic-control-topbar')
      const panel = getActiveControlPanel(control)
      const statusToast = control.querySelector<HTMLElement>('.status-toast')
      const items = Array.from(control.querySelectorAll<HTMLElement>('.dynamic-stage-item-motion'))
      if (!stage || !stageShell || !topbar) {
        finish()
        return
      }

      await waitForPaint()
      await waitForStageMedia(stage)
      await waitForPaint()
      if (cancelled) return

      const targetRect = getRect(stage) ?? {
        left: 24,
        top: window.innerHeight * 0.2,
        width: window.innerWidth * 0.7,
        height: window.innerWidth * 0.7 * 9 / 16
      }
      buildStageProxy(stage, stageProxy)
      remember(control, stage, stageShell, topbar, panel, statusToast, ...items)

      gsap.set(control, { opacity: 1 })
      gsap.set(stageShell, { opacity: 0 })
      gsap.set(stageProxy, { opacity: 1 })
      gsap.set(frame, {
        rotationX: 78,
        scaleY: 0.22,
        transformOrigin: 'center bottom',
        transformPerspective: 1100
      })
      gsap.set(topbar, { opacity: 0, y: -14 })
      if (panel) gsap.set(panel, { opacity: 0, x: '112%' })
      if (statusToast) gsap.set(statusToast, { opacity: 0, y: -8 })
      const dropDistance = Math.min(190, Math.max(110, targetRect.height * 0.28))
      const itemStagger = items.length > 1 ? Math.min(0.075, 0.52 / (items.length - 1)) : 0
      if (items.length > 0) gsap.set(items, { opacity: 0, y: -dropDistance })

      const currentFrameRect = getRect(frameMotion) ?? getViewportFrameRect()
      gsap.killTweensOf(frameMotion)
      setFrameFlip(frameMotion, currentFrameRect, targetRect)
      gsap.set(media, { scaleX: 1, scaleY: 1 })

      const reveal = gsap.timeline({ onComplete: finish })
        .to(frameMotion, {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          force3D: true,
          borderRadius: 8,
          duration: 0.58,
          ease: 'power3.out'
        }, 0)
        .to(frame, {
          borderRadius: 8,
          rotationX: 0,
          scaleY: 1,
          duration: 0.58,
          ease: 'power3.out'
        }, 0)
        .to(stageShell, { opacity: 1, duration: 0.24, ease: 'power2.out' }, 0.46)
        .to([frame, workspace, tears], { opacity: 0, duration: 0.24 }, 0.5)
        .to(topbar, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.64)
      if (items.length > 0) {
        reveal.to(items, {
          opacity: 1,
          y: 0,
          duration: 0.62,
          stagger: itemStagger,
          ease: 'elastic.out(1, .58)'
        }, 0.58)
      }
      if (panel) {
        reveal.to(panel, { opacity: 1, x: 0, duration: 0.34, ease: 'power3.out' }, 0.68)
      }
      if (statusToast) {
        reveal.to(statusToast, { opacity: 1, y: 0, duration: 0.24 }, 0.76)
      }
      timelines.push(reveal)
    }

    const runBackwardReveal = async () => {
      const library = await preparedLibraryPromise
      if (!library || cancelled) {
        finish()
        return
      }

      const targetCard = library.querySelector<HTMLElement>(`[data-library-entity-id="${request.groupId}"]`)
      const topbar = library.querySelector<HTMLElement>('.dynamic-library-topbar')
      const breadcrumbs = library.querySelector<HTMLElement>('.dynamic-library-breadcrumbs')
      const browser = library.querySelector<HTMLElement>('.dynamic-library-browser')
      const contentStage = library.querySelector<HTMLElement>('.dynamic-library-content-stage')
      const entities = Array.from(library.querySelectorAll<HTMLElement>('.dynamic-library-icon-card, .dynamic-library-detail-row'))
      const libraryChrome = [topbar, breadcrumbs, browser].filter((element): element is HTMLElement => Boolean(element))
      remember(library, targetCard, topbar, breadcrumbs, browser, contentStage, ...entities)

      gsap.set(library, { opacity: 1 })
      if (contentStage) gsap.set(contentStage, { opacity: 1 })
      if (libraryChrome.length > 0) gsap.set(libraryChrome, { opacity: 0, y: 18 })
      if (entities.length > 0) gsap.set(entities, { opacity: 0, y: 20, scale: 0.92 })
      gsap.set(stageProxy, { opacity: 0 })
      gsap.set(media, { opacity: request.previewUrl ? 1 : 0, y: 0, filter: 'none' })

      switchScene()
      await waitForPaint()
      if (cancelled) return

      const targetRect = getRect(targetCard) ?? request.origin ?? getFallbackOrigin()
      const currentFrameRect = getRect(frameMotion) ?? getViewportFrameRect()
      gsap.killTweensOf(frameMotion)
      setFrameFlip(frameMotion, currentFrameRect, targetRect)
      syncMediaCounterScale(frameMotion, media)

      const reveal = gsap.timeline({ onComplete: finish })
        .to(frameMotion, {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          force3D: true,
          borderRadius: 8,
          duration: 0.4,
          ease: 'power3.inOut',
          onUpdate: () => syncMediaCounterScale(frameMotion, media),
          onComplete: () => gsap.set(media, { scaleX: 1, scaleY: 1 })
        }, 0)
        .to([workspace, tears], { opacity: 0, duration: 0.3, ease: 'power2.out' }, 0.18)
        .to(frame, { opacity: 0, duration: 0.18 }, 0.43)
      if (libraryChrome.length > 0) {
        reveal.to(libraryChrome, {
          opacity: 1,
          y: 0,
          duration: 0.42,
          stagger: 0.045,
          ease: 'power2.out'
        }, 0.16)
      }
      if (entities.length > 0) {
        reveal.to(entities, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.4,
          stagger: 0.035,
          ease: 'back.out(1.25)'
        }, 0.22)
      }
      timelines.push(reveal)
    }

    if (request.direction === 'forward') {
      const origin = request.origin ?? getRect(sourceCard) ?? getFallbackOrigin()
      const viewportRect = getViewportFrameRect()
      setFrameFlip(frameMotion, origin, viewportRect)
      gsap.set(frame, { opacity: 1 })
      gsap.set(workspace, { opacity: 0 })
      gsap.set(tears, { opacity: 0 })
      gsap.set(tearPieces, { opacity: 1, x: 0, y: 0, rotation: 0 })

      const timeline = gsap.timeline()
        .to(sourceCard ?? frame, {
          scale: 1.025,
          boxShadow: '0 0 0 2px #fff, 0 0 24px rgba(255,255,255,.96)',
          duration: 0.2,
          ease: 'power2.out'
        }, 0)
        .to(media, { y: -24, opacity: 0, filter: 'blur(8px)', duration: 0.27, ease: 'power2.in' }, 0.04)
        .to(frameMotion, {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          force3D: true,
          duration: 0.4,
          ease: 'power3.inOut'
        }, 0.2)
        .to(frame, { borderRadius: 12, duration: 0.4, ease: 'power3.inOut' }, 0.2)
        .to(workspace, { opacity: 1, duration: 0.28, ease: 'power2.out' }, 0.28)
        .to(tears, { opacity: 1, duration: 0.08 }, 0.3)
        .to(tearPieces, {
          x: (index) => getPieceOffset(index).x,
          y: (index) => getPieceOffset(index).y,
          rotation: (index) => getPieceOffset(index).rotation,
          opacity: 0,
          duration: 0.38,
          stagger: 0.02,
          ease: 'power3.in'
        }, 0.3)
        .to(sourcePage, { opacity: 0, duration: 0.24 }, 0.34)
        .call(() => { void runForwardReveal() }, [], 0.52)
      timelines.push(timeline)
    } else {
      gsap.set([frame, workspace, tears], { opacity: 0 })

      const runBackwardExit = async () => {
        await preparedLibraryMountPromise
        if (cancelled) return

        const stage = document.querySelector<HTMLElement>('.dynamic-control-screen .dynamic-stage')
        const stageShell = document.querySelector<HTMLElement>('.dynamic-control-screen .dynamic-stage-shell')
        const topbar = document.querySelector<HTMLElement>('.dynamic-control-screen .dynamic-control-topbar')
        const control = document.querySelector<HTMLElement>('.dynamic-control-screen')
        const panel = control ? getActiveControlPanel(control) : null
        const statusToast = document.querySelector<HTMLElement>('.dynamic-control-screen .status-toast')
        const items = Array.from(document.querySelectorAll<HTMLElement>('.dynamic-control-screen .dynamic-stage-item-motion'))
        const origin = getRect(stage) ?? request.origin ?? getFallbackOrigin()
        remember(stage, stageShell, topbar, panel, statusToast, ...items)
        if (stage) buildStageProxy(stage, stageProxy)

        const viewportRect = getViewportFrameRect()
        setFrameFlip(frameMotion, origin, viewportRect)
        gsap.set(frame, {
          opacity: 0,
          rotationX: 0,
          scaleY: 1,
          transformOrigin: 'center bottom',
          transformPerspective: 1100
        })
        gsap.set(stageProxy, { opacity: stage ? 1 : 0 })
        gsap.set(media, { opacity: 0 })
        gsap.set(workspace, { opacity: 0 })
        gsap.set(tears, { opacity: 1 })
        gsap.set(tearPieces, {
          opacity: 0,
          x: (index) => getPieceOffset(index).x,
          y: (index) => getPieceOffset(index).y,
          rotation: (index) => getPieceOffset(index).rotation
        })

        const timeline = gsap.timeline()
          .to(frame, { opacity: 1, duration: 0.12 }, 0)
          .to(frame, {
            rotationX: 76,
            scaleY: 0.3,
            duration: 0.34,
            ease: 'power2.in'
          }, 0.08)
          .to(workspace, { opacity: 1, duration: 0.2 }, 0.12)
          .to(frameMotion, {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            force3D: true,
            duration: 0.35,
            ease: 'power2.inOut'
          }, 0.16)
          .to(frame, {
            rotationX: 0,
            scaleY: 1,
            duration: 0.35,
            ease: 'power2.inOut'
          }, 0.16)
          .to(tearPieces, { opacity: 1, x: 0, y: 0, rotation: 0, duration: 0.3, stagger: 0.02 }, 0.28)
          .call(() => { void runBackwardReveal() }, [], 0.5)
        if (panel) {
          timeline.to(panel, { x: '112%', opacity: 0, duration: 0.22, ease: 'power2.in' }, 0)
        }
        if (topbar) {
          timeline.to(topbar, { opacity: 0, y: -12, duration: 0.2 }, 0)
        }
        if (items.length > 0) {
          timeline.to(items, { opacity: 0, y: -76, duration: 0.2, stagger: 0.025 }, 0.03)
        }
        if (stageShell) {
          timeline.to(stageShell, { opacity: 0, duration: 0.22, ease: 'power2.in' }, 0.08)
        }
        if (sourcePage) {
          timeline.to(sourcePage, { opacity: 0, duration: 0.2 }, 0.42)
        }
        if (statusToast) {
          timeline.to(statusToast, { opacity: 0, y: -8, duration: 0.16 }, 0)
        }
        timelines.push(timeline)
      }

      void runBackwardExit()
    }

    return () => {
      cancelled = true
      window.cancelAnimationFrame(finishFrame)
      window.cancelAnimationFrame(settleFrame)
      timelines.forEach((timeline) => timeline.kill())
      cleanupTargets.forEach((target) => gsap.set(target, { clearProps: 'opacity,transform,boxShadow' }))
    }
  }, [request])

  return (
    <div className={`dynamic-story-transition direction-${request.direction}`} aria-hidden="true">
      <div ref={workspaceRef} className="dynamic-story-workspace" />
      <div ref={tearsRef} className="dynamic-story-tears">
        <span className="dynamic-story-tear-piece tear-one" />
        <span className="dynamic-story-tear-piece tear-two" />
        <span className="dynamic-story-tear-piece tear-three" />
        <span className="dynamic-story-tear-piece tear-four" />
      </div>
      <div ref={frameMotionRef} className="dynamic-story-frame-motion">
        <div ref={frameRef} className="dynamic-story-frame">
          <div ref={stageProxyRef} className="dynamic-story-stage-proxy" />
          {request.previewUrl ? (
            request.previewType === 'video' ? (
              <video className="dynamic-story-frame-media" src={request.previewUrl} autoPlay loop muted playsInline />
            ) : (
              <img className="dynamic-story-frame-media" src={request.previewUrl} alt="" draggable={false} />
            )
          ) : (
            <span className="dynamic-story-frame-media dynamic-story-frame-placeholder">{request.groupName.slice(0, 1)}</span>
          )}
          <span className="dynamic-story-frame-grid" />
          <span className="dynamic-story-frame-edge" />
        </div>
      </div>
    </div>
  )
}

export default DynamicArtworkTransition
