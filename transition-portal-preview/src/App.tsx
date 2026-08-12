import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import HomeScene from './components/HomeScene.tsx'
import InteractiveThemeScene from './components/InteractiveThemeScene.tsx'
import InteractiveUploadScene from './components/InteractiveUploadScene.tsx'
import LibraryScene from './components/LibraryScene.tsx'
import ControlScene from './components/ControlScene.tsx'
import MaterialStageTransition from './components/MaterialStageTransition.tsx'
import PrototypeModeSwitch from './components/PrototypeModeSwitch.tsx'
import ThemeUploadTransition from './components/ThemeUploadTransition.tsx'
import TransitionPortal from './components/TransitionPortal.tsx'
import type { InteractiveTheme } from './components/interactiveThemeData.ts'
import type {
  InteractiveCardSize,
  MaterialTransitionDirection,
  PortalOrigin,
  PreviewView,
  TransitionMode
} from './types.ts'

const App = () => {
  const [view, setView] = useState<PreviewView>('home')
  const [transitionMode, setTransitionMode] = useState<TransitionMode>('shared')
  const [interactiveCardSize, setInteractiveCardSize] = useState<InteractiveCardSize>('compact')
  const [origin, setOrigin] = useState<PortalOrigin | null>(null)
  const [interactiveOrigin, setInteractiveOrigin] = useState<PortalOrigin | null>(null)
  const [uploadOrigin, setUploadOrigin] = useState<PortalOrigin | null>(null)
  const [selectedInteractiveTheme, setSelectedInteractiveTheme] = useState<InteractiveTheme | null>(null)
  const [materialOrigin, setMaterialOrigin] = useState<PortalOrigin | null>(null)
  const [materialDirection, setMaterialDirection] = useState<MaterialTransitionDirection>('forward')
  const [runId, setRunId] = useState(0)
  const homeRef = useRef<HTMLElement>(null)
  const libraryRef = useRef<HTMLElement>(null)
  const controlRef = useRef<HTMLElement>(null)
  const interactiveRef = useRef<HTMLElement>(null)
  const uploadRef = useRef<HTMLElement>(null)
  const dynamicCardRef = useRef<HTMLButtonElement>(null)
  const interactiveCardRef = useRef<HTMLButtonElement>(null)

  const clearTransitionStyles = () => {
    const targets = [
      homeRef.current,
      libraryRef.current,
      interactiveRef.current,
      uploadRef.current,
      dynamicCardRef.current,
      interactiveCardRef.current,
      ...Array.from(homeRef.current?.querySelectorAll('.home-fade') ?? []),
      ...Array.from(libraryRef.current?.querySelectorAll('.library-reveal, .library-item') ?? []),
      ...Array.from(controlRef.current?.querySelectorAll('.control-reveal, .control-character') ?? []),
      ...Array.from(interactiveRef.current?.querySelectorAll('.interactive-reveal, .interactive-theme-card, .interactive-card-size-switch') ?? []),
      ...Array.from(uploadRef.current?.querySelectorAll('.upload-reveal, .upload-detail-reveal, .upload-mask-reveal') ?? [])
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

  const startInteractiveTransition = () => {
    if (view === 'interactive-transition' || !interactiveCardRef.current) return
    const rect = interactiveCardRef.current.getBoundingClientRect()
    setInteractiveOrigin({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    setRunId((current) => current + 1)
    setView('interactive-transition')
  }

  const resetToHome = () => {
    clearTransitionStyles()
    setOrigin(null)
    setInteractiveOrigin(null)
    setUploadOrigin(null)
    setView('home')
  }

  const startThemeUpload = (theme: InteractiveTheme, card: HTMLButtonElement) => {
    if (view !== 'interactive') return
    const rect = card.getBoundingClientRect()
    setSelectedInteractiveTheme(theme)
    setUploadOrigin({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    setRunId((current) => current + 1)
    setView('interactive-upload-transition')
  }

  const returnToInteractiveThemes = () => {
    clearTransitionStyles()
    setUploadOrigin(null)
    setView('interactive')
  }

  const replayThemeUpload = () => {
    if (!selectedInteractiveTheme) return
    const theme = selectedInteractiveTheme
    clearTransitionStyles()
    setUploadOrigin(null)
    setView('interactive')
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const card = interactiveRef.current?.querySelector<HTMLButtonElement>(`[data-theme-id="${theme.id}"]`)
      if (!card) return
      const rect = card.getBoundingClientRect()
      setUploadOrigin({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
      setRunId((current) => current + 1)
      setView('interactive-upload-transition')
    }))
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

  const replayInteractiveTransition = () => {
    clearTransitionStyles()
    setInteractiveOrigin(null)
    setView('home')
    window.requestAnimationFrame(() => window.requestAnimationFrame(startInteractiveTransition))
  }

  const homeTransitioning = view === 'transition' || view === 'interactive-transition'

  return (
    <main className="preview-app" data-view={view}>
      <HomeScene
        rootRef={homeRef}
        dynamicCardRef={dynamicCardRef}
        interactiveCardRef={interactiveCardRef}
        transitioning={homeTransitioning}
        transitionKind={view === 'transition' ? 'dynamic' : view === 'interactive-transition' ? 'interactive' : undefined}
        onOpenDynamic={startTransition}
        onOpenInteractive={startInteractiveTransition}
      />
      <InteractiveThemeScene
        rootRef={interactiveRef}
        visible={view === 'interactive-transition' || view === 'interactive' || view === 'interactive-upload-transition'}
        cardSize={interactiveCardSize}
        onBackHome={resetToHome}
        onCardSizeChange={setInteractiveCardSize}
        onReplay={replayInteractiveTransition}
        onOpenTheme={startThemeUpload}
        transitioning={view === 'interactive-upload-transition'}
      />
      <InteractiveUploadScene
        rootRef={uploadRef}
        visible={view === 'interactive-upload-transition' || view === 'interactive-upload'}
        theme={selectedInteractiveTheme}
        onBack={returnToInteractiveThemes}
        onReplay={replayThemeUpload}
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
          targetRef={libraryRef}
          sourceCardRef={dynamicCardRef}
          targetRevealSelector=".library-reveal, .library-item"
          variant="dynamic"
          onComplete={() => setView('library')}
        />
      )}

      {view === 'interactive-transition' && interactiveOrigin && (
        <TransitionPortal
          key={`interactive-${runId}`}
          origin={interactiveOrigin}
          homeRef={homeRef}
          targetRef={interactiveRef}
          sourceCardRef={interactiveCardRef}
          targetRevealSelector=".interactive-reveal, .interactive-theme-card, .interactive-card-size-switch"
          variant="interactive"
          onComplete={() => setView('interactive')}
        />
      )}

      {view === 'interactive-upload-transition' && uploadOrigin && selectedInteractiveTheme && (
        <ThemeUploadTransition
          key={`theme-upload-${runId}`}
          origin={uploadOrigin}
          theme={selectedInteractiveTheme}
          interactiveRef={interactiveRef}
          uploadRef={uploadRef}
          onComplete={() => setView('interactive-upload')}
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
        disabled={view === 'transition'
          || view === 'material-transition'
          || view === 'interactive-transition'
          || view === 'interactive-upload-transition'}
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
