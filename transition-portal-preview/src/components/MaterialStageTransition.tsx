import { useEffect, useRef, type RefObject } from 'react'
import { gsap } from 'gsap'
import { BaoIllustration } from './StoryIllustrations.tsx'
import type { MaterialTransitionDirection, PortalOrigin, TransitionMode } from '../types.ts'

interface MaterialStageTransitionProps {
  mode: TransitionMode
  direction: MaterialTransitionDirection
  origin: PortalOrigin
  libraryRef: RefObject<HTMLElement>
  controlRef: RefObject<HTMLElement>
  onComplete: () => void
}

const MaterialStageTransition: React.FC<MaterialStageTransitionProps> = ({
  mode,
  direction,
  origin,
  libraryRef,
  controlRef,
  onComplete
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const tearRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const frame = frameRef.current
    const workspace = workspaceRef.current
    const tears = tearRef.current
    const library = libraryRef.current
    const control = controlRef.current
    if (!root || !frame || !workspace || !tears || !library || !control) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sourceCard = library.querySelector<HTMLElement>('.material-card')
    const sourceBao = library.querySelector<HTMLElement>('.material-bao')
    const controlStageFrame = control.querySelector<HTMLElement>('.control-stage-frame')
    const controlStage = control.querySelector<HTMLElement>('.control-stage')
    const controlTopbar = control.querySelector<HTMLElement>('.control-topbar')
    const controlPanel = control.querySelector<HTMLElement>('.control-layer-panel')
    const controlStatus = control.querySelector<HTMLElement>('.control-stage-status')
    const characters = Array.from(control.querySelectorAll<HTMLElement>('.control-character'))
    const tearPieces = Array.from(tears.querySelectorAll<HTMLElement>('span'))
    const frameBao = frame.querySelector<HTMLElement>('.material-transition-bao')
    const targetRect = controlStageFrame?.getBoundingClientRect() ?? {
      left: window.innerWidth * .07,
      top: window.innerHeight * .16,
      width: window.innerWidth * .68,
      height: window.innerHeight * .7
    }

    gsap.set(frame, {
      left: direction === 'forward' ? origin.left : targetRect.left,
      top: direction === 'forward' ? origin.top : targetRect.top,
      width: direction === 'forward' ? origin.width : targetRect.width,
      height: direction === 'forward' ? origin.height : targetRect.height,
      opacity: 1
    })
    gsap.set(workspace, { opacity: 0 })
    gsap.set(tears, { opacity: 0 })
    gsap.set(control, { visibility: 'visible' })
    gsap.set(library, { visibility: 'visible' })

    if (reducedMotion) {
      const reducedTimeline = gsap.timeline({ onComplete })
      if (direction === 'forward') {
        reducedTimeline
          .to(library, { opacity: 0, duration: .18 }, 0)
          .fromTo(control, { opacity: 0 }, { opacity: 1, duration: .26 }, .1)
      } else {
        reducedTimeline
          .to(control, { opacity: 0, duration: .18 }, 0)
          .fromTo(library, { opacity: 0 }, { opacity: 1, duration: .26 }, .1)
      }
      return () => {
        reducedTimeline.kill()
      }
    }

    const timeline = gsap.timeline({ onComplete })

    if (direction === 'backward') {
      gsap.set(library, { opacity: 0 })
      gsap.set(frameBao, { opacity: mode === 'storybook' ? 0 : 1 })
      gsap.set(control, { opacity: 1 })

      if (mode === 'storybook') {
        gsap.set(tears, { opacity: 1 })
        gsap.set(tearPieces, { opacity: 0 })
        timeline
          .to(controlPanel, { x: '112%', opacity: 0, duration: .22, ease: 'power2.in' }, 0)
          .to([controlTopbar, controlStatus], { opacity: 0, y: -10, duration: .2 }, 0)
          .to(characters, { opacity: 0, y: -70, duration: .18, stagger: .025 }, .03)
          .to(controlStageFrame, {
            rotationX: 76,
            scaleY: .3,
            opacity: .35,
            duration: .34,
            transformOrigin: 'center bottom',
            ease: 'power2.in'
          }, .08)
          .to(workspace, { opacity: 1, duration: .2 }, .12)
          .to(frame, {
            left: 12,
            top: 12,
            width: window.innerWidth - 24,
            height: window.innerHeight - 24,
            duration: .35,
            ease: 'power2.inOut'
          }, .16)
          .to(tearPieces, { opacity: 1, x: 0, y: 0, rotation: 0, duration: .28, stagger: .02 }, .28)
          .to(library, { opacity: 1, duration: .28 }, .38)
          .to(control, { opacity: 0, duration: .2 }, .42)
          .to(frame, {
            left: origin.left,
            top: origin.top,
            width: origin.width,
            height: origin.height,
            duration: .36,
            ease: 'power3.inOut'
          }, .46)
          .to([frame, tears, workspace], { opacity: 0, duration: .16 }, .76)
      } else {
        timeline
          .to([controlPanel, controlTopbar, controlStatus], { opacity: 0, duration: .18 }, 0)
          .to(controlStage, { opacity: .5, duration: .15 }, 0)
          .to(frame, {
            left: origin.left,
            top: origin.top,
            width: origin.width,
            height: origin.height,
            borderRadius: 8,
            duration: .55,
            ease: 'power3.inOut'
          }, .06)
          .to(control, { opacity: 0, duration: .32, ease: 'power2.in' }, .12)
          .to(library, { opacity: 1, duration: .38, ease: 'power2.out' }, .25)
          .to(frame, { opacity: 0, duration: .16 }, .54)
      }
    } else {
      gsap.set(control, { opacity: 0 })
      gsap.set([controlTopbar, controlPanel, controlStatus], { opacity: 0 })
      gsap.set(characters, { opacity: 0 })

      if (mode === 'storybook') {
        gsap.set(controlStageFrame, {
          opacity: 0,
          rotationX: 78,
          scaleY: .22,
          transformOrigin: 'center bottom',
          transformPerspective: 1000
        })
        gsap.set(controlPanel, { x: '112%', opacity: 0 })
        gsap.set(controlTopbar, { y: -12, opacity: 0 })
        gsap.set(controlStatus, { y: 10, opacity: 0 })
        gsap.set(tearPieces, { opacity: 1 })

        timeline
          .to(sourceCard, {
            scale: 1.025,
            boxShadow: '0 0 0 2px #fff, 0 0 24px rgba(255,255,255,.96)',
            duration: .2,
            ease: 'power2.out'
          }, 0)
          .to(sourceBao, { y: -20, opacity: 0, filter: 'blur(7px)', duration: .25, ease: 'power2.in' }, .04)
          .to(frameBao, { y: -30, opacity: 0, filter: 'blur(10px)', duration: .28, ease: 'power2.in' }, .08)
          .to(frame, {
            left: 12,
            top: 12,
            width: window.innerWidth - 24,
            height: window.innerHeight - 24,
            borderRadius: 12,
            duration: .4,
            ease: 'power3.inOut'
          }, .2)
          .to(workspace, { opacity: 1, duration: .28, ease: 'power2.out' }, .28)
          .to(tears, { opacity: 1, duration: .08 }, .3)
          .to(tearPieces, {
            x: (index) => index % 2 === 0 ? -window.innerWidth * .34 : window.innerWidth * .34,
            y: (index) => index < 2 ? -window.innerHeight * .16 : window.innerHeight * .18,
            rotation: (index) => index % 2 === 0 ? -8 : 9,
            opacity: 0,
            duration: .38,
            stagger: .02,
            ease: 'power3.in'
          }, .3)
          .to(library, { opacity: 0, duration: .24 }, .34)
          .to(control, { opacity: 1, duration: .26 }, .5)
          .to(frame, {
            left: targetRect.left,
            top: targetRect.top,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: 8,
            duration: .34,
            ease: 'power2.inOut'
          }, .56)
          .to(controlStageFrame, {
            opacity: 1,
            rotationX: 0,
            scaleY: 1,
            duration: .58,
            ease: 'power3.out'
          }, .6)
          .to([frame, workspace], { opacity: 0, duration: .24 }, .9)
          .fromTo(characters, { opacity: 0, y: -180 }, {
            opacity: 1,
            y: 0,
            duration: .58,
            stagger: .08,
            ease: 'elastic.out(1, .58)'
          }, 1.02)
          .to(controlTopbar, { opacity: 1, y: 0, duration: .3, ease: 'power2.out' }, 1.18)
          .to(controlPanel, { opacity: 1, x: 0, duration: .34, ease: 'power3.out' }, 1.2)
          .to(controlStatus, { opacity: 1, y: 0, duration: .24 }, 1.3)
      } else {
        gsap.set(controlStageFrame, { opacity: 0 })
        gsap.set([controlTopbar, controlStatus], { y: -10 })
        gsap.set(controlPanel, { x: 28 })
        timeline
          .to(sourceCard, {
            scale: 1.025,
            y: -6,
            boxShadow: '0 18px 38px rgba(17, 74, 82, .28)',
            duration: .16,
            ease: 'power2.out'
          }, 0)
          .to(library.querySelectorAll('.library-topbar, .library-breadcrumbs, .material-card'), {
            opacity: 0,
            y: -8,
            duration: .28,
            stagger: .025,
            ease: 'power2.in'
          }, .1)
          .to(frame, {
            left: targetRect.left,
            top: targetRect.top,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: 8,
            duration: .56,
            ease: 'power3.inOut'
          }, .08)
          .to(control, { opacity: 1, duration: .35, ease: 'power2.out' }, .26)
          .to(controlStageFrame, { opacity: 1, duration: .24 }, .42)
          .to(frame, { opacity: 0, duration: .18 }, .56)
          .to([controlTopbar, controlStatus], { opacity: 1, y: 0, duration: .28, stagger: .045 }, .5)
          .to(controlPanel, { opacity: 1, x: 0, duration: .3, ease: 'power2.out' }, .54)
          .to(characters, { opacity: 1, duration: .2, stagger: .04 }, .58)
          .to(library, { opacity: 0, duration: .18 }, .58)
      }
    }

    return () => {
      timeline.kill()
    }
  }, [controlRef, direction, libraryRef, mode, onComplete, origin])

  return (
    <div ref={rootRef} className={`material-stage-transition mode-${mode} direction-${direction}`} aria-hidden="true">
      <div ref={workspaceRef} className="transition-workspace-base" />
      <div ref={tearRef} className="transition-paper-tears">
        <span className="tear-piece tear-one" />
        <span className="tear-piece tear-two" />
        <span className="tear-piece tear-three" />
        <span className="tear-piece tear-four" />
      </div>
      <div ref={frameRef} className="material-transition-frame">
        <BaoIllustration className="material-transition-bao" />
        <span className="transition-frame-grid" />
        <span className="transition-frame-edge" />
      </div>
    </div>
  )
}

export default MaterialStageTransition
