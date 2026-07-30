import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import HomeScene from './components/HomeScene.tsx'
import LibraryScene from './components/LibraryScene.tsx'
import ControlScene from './components/ControlScene.tsx'
import MaterialStageTransition from './components/MaterialStageTransition.tsx'
import PrototypeModeSwitch from './components/PrototypeModeSwitch.tsx'
import TransitionPortal from './components/TransitionPortal.tsx'
import type {
  MaterialTransitionDirection,
  PortalOrigin,
  PreviewView,
  TransitionMode
} from './types.ts'

const App = () => {
  const [view, setView] = useState<PreviewView>('home')
  const [transitionMode, setTransitionMode] = useState<TransitionMode>('shared')
  const [origin, setOrigin] = useState<PortalOrigin | null>(null)
  const [materialOrigin, setMaterialOrigin] = useState<PortalOrigin | null>(null)
  const [materialDirection, setMaterialDirection] = useState<MaterialTransitionDirection>('forward')
  const [runId, setRunId] = useState(0)
  const homeRef = useRef<HTMLElement>(null)
  const libraryRef = useRef<HTMLElement>(null)
  const controlRef = useRef<HTMLElement>(null)
  const dynamicCardRef = useRef<HTMLButtonElement>(null)

  const clearTransitionStyles = () => {
    const targets = [
      homeRef.current,
      libraryRef.current,
      dynamicCardRef.current,
      ...Array.from(homeRef.current?.querySelectorAll('.home-fade') ?? []),
      ...Array.from(libraryRef.current?.querySelectorAll('.library-reveal, .library-item') ?? []),
      ...Array.from(controlRef.current?.querySelectorAll('.control-reveal, .control-character') ?? [])
    ].filter(Boolean)

    gsap.set(targets, { clearProps: 'all' })
  }

  const startTransition = () => {
    if (view === 'transition' || !dynamicCardRef.current) return
    const rect = dynamicCardRef.current.getBoundingClientRect()
    setOrigin({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    setRunId((current) => current + 1)
    setView('transition')
  }

  const resetToHome = () => {
    clearTransitionStyles()
    setOrigin(null)
    setView('home')
  }

  const openMaterial = (nextOrigin: PortalOrigin) => {
    if (view !== 'library') return
    setMaterialOrigin(nextOrigin)
    setMaterialDirection('forward')
    setView('material-transition')
  }

  const returnToFolder = () => {
    if (view !== 'control') return
    const materialCard = libraryRef.current?.querySelector<HTMLElement>('.material-card')
    const rect = materialCard?.getBoundingClientRect()
    setMaterialOrigin(rect
      ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
      : materialOrigin)
    setMaterialDirection('backward')
    setView('material-transition')
  }

  const completeMaterialTransition = () => {
    if (materialDirection === 'forward') {
      setView('control')
      return
    }

    setView('library')
    window.requestAnimationFrame(() => {
      const targets = [
        controlRef.current,
        ...Array.from(controlRef.current?.querySelectorAll('.control-reveal, .control-character, .control-stage-frame') ?? []),
        ...Array.from(libraryRef.current?.querySelectorAll('.library-topbar, .library-breadcrumbs, .material-card, .material-bao') ?? [])
      ].filter(Boolean)
      gsap.set(targets, { clearProps: 'all' })
    })
  }

  const replayTransition = () => {
    clearTransitionStyles()
    setOrigin(null)
    setView('home')
    window.requestAnimationFrame(() => window.requestAnimationFrame(startTransition))
  }

  return (
    <main className="preview-app" data-view={view}>
      <HomeScene
        rootRef={homeRef}
        dynamicCardRef={dynamicCardRef}
        transitioning={view === 'transition'}
        onOpenDynamic={startTransition}
      />
      <LibraryScene
        rootRef={libraryRef}
        visible={view === 'transition' || view === 'library' || view === 'material-transition'}
        mode={transitionMode}
        onBackHome={resetToHome}
        onReplay={replayTransition}
        onOpenMaterial={openMaterial}
      />
      <ControlScene
        rootRef={controlRef}
        visible={view === 'material-transition' || view === 'control'}
        onBack={returnToFolder}
      />

      {view === 'transition' && origin && (
        <TransitionPortal
          key={runId}
          origin={origin}
          homeRef={homeRef}
          libraryRef={libraryRef}
          dynamicCardRef={dynamicCardRef}
          onComplete={() => setView('library')}
        />
      )}

      {view === 'material-transition' && materialOrigin && (
        <MaterialStageTransition
          key={`${transitionMode}-${materialDirection}-${runId}`}
          mode={transitionMode}
          direction={materialDirection}
          origin={materialOrigin}
          libraryRef={libraryRef}
          controlRef={controlRef}
          onComplete={completeMaterialTransition}
        />
      )}

      <PrototypeModeSwitch
        mode={transitionMode}
        disabled={view === 'transition' || view === 'material-transition'}
        onChange={setTransitionMode}
      />

      <aside className="portrait-notice" aria-hidden="true">
        <strong>請橫屏查看轉場</strong>
        <span>此預覽以 iPad 橫屏舞台設計</span>
      </aside>
    </main>
  )
}

export default App
