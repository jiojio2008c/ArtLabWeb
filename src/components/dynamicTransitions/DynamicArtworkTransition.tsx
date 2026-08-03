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

const waitForStageMedia = async (stage: HTMLElement) => {
  const imagePromises = Array.from(stage.querySelectorAll<HTMLImageElement>('img')).map((image) => {
    const decodeImage = () => image.decode?.().catch(() => undefined) ?? Promise.resolve()
    if (image.complete && image.naturalWidth > 0) {
      return decodeImage()
    }
    return new Promise<void>((resolve) => {
      image.addEventListener('load', () => {
        void decodeImage().then(() => resolve())
      }, { once: true })
      image.addEventListener('error', () => resolve(), { once: true })
    })
  })
  const videoPromises = Array.from(stage.querySelectorAll<HTMLVideoElement>('video')).map((video) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve()
    return new Promise<void>((resolve) => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true })
      video.addEventListener('error', () => resolve(), { once: true })
    })
  })

  await Promise.race([
    Promise.allSettled([...imagePromises, ...videoPromises]),
    new Promise<void>((resolve) => window.setTimeout(resolve, 900))
  ])
}

const buildStageProxy = (stage: HTMLElement, proxy: HTMLElement) => {
  const clone = stage.cloneNode(true) as HTMLElement
  clone.classList.add('dynamic-story-stage-clone')
  clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'))
  clone.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
    video.muted = true
    void video.play().catch(() => undefined)
  })
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

const DynamicArtworkTransition: React.FC<DynamicArtworkTransitionProps> = ({
  request,
  onSceneSwitch,
  onComplete
}) => {
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
    const frame = frameRef.current
    const workspace = workspaceRef.current
    const tears = tearsRef.current
    const stageProxy = stageProxyRef.current
    if (!frame || !workspace || !tears || !stageProxy) return

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

    const finish = () => {
      if (!cancelled) completeRef.current()
    }

    if (reducedMotion) {
      const timeline = gsap.timeline({ onComplete: finish })
        .to(sourcePage ?? frame, { opacity: 0, duration: 0.18 }, 0)
        .call(switchScene, [], 0.12)
        .to(frame, { opacity: 0, duration: 0.18 }, 0.16)
      timelines.push(timeline)
      return () => {
        cancelled = true
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
      gsap.set(panel ? [panel] : [], { opacity: 0, x: '112%' })
      gsap.set(statusToast ? [statusToast] : [], { opacity: 0, y: -8 })
      const dropDistance = Math.min(190, Math.max(110, targetRect.height * 0.28))
      const itemStagger = items.length > 1 ? Math.min(0.075, 0.52 / (items.length - 1)) : 0
      gsap.set(items, { opacity: 0, y: -dropDistance })

      const reveal = gsap.timeline({ onComplete: finish })
        .to(frame, {
          left: targetRect.left,
          top: targetRect.top,
          width: targetRect.width,
          height: targetRect.height,
          borderRadius: 8,
          rotationX: 0,
          scaleY: 1,
          duration: 0.58,
          ease: 'power3.out'
        }, 0)
        .to(stageShell, { opacity: 1, duration: 0.24, ease: 'power2.out' }, 0.46)
        .to([frame, workspace, tears], { opacity: 0, duration: 0.24 }, 0.5)
        .to(items, {
          opacity: 1,
          y: 0,
          duration: 0.62,
          stagger: itemStagger,
          ease: 'elastic.out(1, .58)'
        }, 0.58)
        .to(topbar, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.64)
        .to(panel ? [panel] : [], { opacity: 1, x: 0, duration: 0.34, ease: 'power3.out' }, 0.68)
        .to(statusToast ? [statusToast] : [], { opacity: 1, y: 0, duration: 0.24 }, 0.76)
      timelines.push(reveal)
    }

    const runBackwardReveal = async () => {
      switchScene()
      const library = await waitForElement<HTMLElement>('.dynamic-library-screen')
      if (!library || cancelled) {
        finish()
        return
      }

      const targetCard = library.querySelector<HTMLElement>(`[data-library-entity-id="${request.groupId}"]`)
      const targetRect = getRect(targetCard) ?? request.origin ?? getFallbackOrigin()
      const topbar = library.querySelector<HTMLElement>('.dynamic-library-topbar')
      const breadcrumbs = library.querySelector<HTMLElement>('.dynamic-library-breadcrumbs')
      const browser = library.querySelector<HTMLElement>('.dynamic-library-browser')
      const entities = Array.from(library.querySelectorAll<HTMLElement>('.dynamic-library-icon-card, .dynamic-library-detail-row'))
      remember(library, targetCard, topbar, breadcrumbs, browser, ...entities)

      gsap.set(library, { opacity: 1 })
      gsap.set([topbar, breadcrumbs, browser], { opacity: 0, y: 18 })
      gsap.set(entities, { opacity: 0, y: 20, scale: 0.92 })
      gsap.set(stageProxy, { opacity: 0 })
      gsap.set(media, { opacity: request.previewUrl ? 1 : 0, y: 0, filter: 'none' })

      const reveal = gsap.timeline({ onComplete: finish })
        .to(frame, {
          left: targetRect.left,
          top: targetRect.top,
          width: targetRect.width,
          height: targetRect.height,
          borderRadius: 8,
          duration: 0.4,
          ease: 'power3.inOut'
        }, 0)
        .to([workspace, tears], { opacity: 0, duration: 0.3, ease: 'power2.out' }, 0.18)
        .to([topbar, breadcrumbs, browser], {
          opacity: 1,
          y: 0,
          duration: 0.42,
          stagger: 0.045,
          ease: 'power2.out'
        }, 0.16)
        .to(entities, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.4,
          stagger: 0.035,
          ease: 'back.out(1.25)'
        }, 0.22)
        .to(frame, { opacity: 0, duration: 0.18 }, 0.43)
      timelines.push(reveal)
    }

    if (request.direction === 'forward') {
      const origin = request.origin ?? getRect(sourceCard) ?? getFallbackOrigin()
      gsap.set(frame, { ...origin, opacity: 1 })
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
        .to(frame, {
          left: 12,
          top: 12,
          width: window.innerWidth - 24,
          height: window.innerHeight - 24,
          borderRadius: 12,
          duration: 0.4,
          ease: 'power3.inOut'
        }, 0.2)
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

      gsap.set(frame, {
        ...origin,
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
        .to(panel ? [panel] : [], { x: '112%', opacity: 0, duration: 0.22, ease: 'power2.in' }, 0)
        .to(topbar, { opacity: 0, y: -12, duration: 0.2 }, 0)
        .to(statusToast ? [statusToast] : [], { opacity: 0, y: -8, duration: 0.16 }, 0)
        .to(items, { opacity: 0, y: -76, duration: 0.2, stagger: 0.025 }, 0.03)
        .to(stageShell ? [stageShell] : [], { opacity: 0, duration: 0.22, ease: 'power2.in' }, 0.08)
        .to(frame, {
          rotationX: 76,
          scaleY: 0.3,
          duration: 0.34,
          ease: 'power2.in'
        }, 0.08)
        .to(workspace, { opacity: 1, duration: 0.2 }, 0.12)
        .to(frame, {
          left: 12,
          top: 12,
          width: window.innerWidth - 24,
          height: window.innerHeight - 24,
          rotationX: 0,
          scaleY: 1,
          duration: 0.35,
          ease: 'power2.inOut'
        }, 0.16)
        .to(tearPieces, { opacity: 1, x: 0, y: 0, rotation: 0, duration: 0.3, stagger: 0.02 }, 0.28)
        .to(sourcePage, { opacity: 0, duration: 0.2 }, 0.42)
        .call(() => { void runBackwardReveal() }, [], 0.5)
      timelines.push(timeline)
    }

    return () => {
      cancelled = true
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
  )
}

export default DynamicArtworkTransition
