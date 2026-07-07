import { useEffect, useRef, useState } from 'react'
import EntryPage from './components/EntryPage.tsx'
import HomePage from './components/HomePage.tsx'
import UploadPage from './components/UploadPage.tsx'
import EditPage from './components/EditPage.tsx'
import DirectUploadCompletePage from './components/DirectUploadCompletePage.tsx'
import { loadLastWsIp } from './services/appSettings.ts'
import { CONTROL_PORT, DIRECT_UPLOAD_PORT } from './services/networkConfig.ts'

interface ImageData {
  name: string
  url: string
}

type Page = 'entry' | 'home' | 'upload' | 'edit' | 'directUpload' | 'directComplete'
type TransitionDirection = 'forward' | 'backward' | 'neutral'

const pageOrder: Record<Page, number> = {
  entry: 0,
  home: 1,
  upload: 2,
  directUpload: 2,
  edit: 3,
  directComplete: 3
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('entry')
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>('neutral')
  const [showHandoffTransition, setShowHandoffTransition] = useState(false)
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [directUploadResult, setDirectUploadResult] = useState<ImageData | null>(null)
  const [wsIp, setWsIp] = useState<string>(() => loadLastWsIp())
  const [selectedName] = useState<string>('fish')
  const [selectedObjectIndex, setSelectedObjectIndex] = useState<number>(0)
  const handoffTimerRef = useRef<number | null>(null)

  const enableSupabaseUpload = false

  const clearHandoffTransition = () => {
    if (handoffTimerRef.current !== null) {
      window.clearTimeout(handoffTimerRef.current)
      handoffTimerRef.current = null
    }
    setShowHandoffTransition(false)
  }

  const navigateTo = (nextPage: Page) => {
    const nextDirection =
      pageOrder[nextPage] > pageOrder[currentPage]
        ? 'forward'
        : pageOrder[nextPage] < pageOrder[currentPage]
          ? 'backward'
          : 'neutral'
    setTransitionDirection(nextDirection)
    setCurrentPage(nextPage)
  }

  useEffect(() => {
    return () => {
      if (handoffTimerRef.current !== null) {
        window.clearTimeout(handoffTimerRef.current)
      }
    }
  }, [])

  const handleUploadSuccess = (data: ImageData) => {
    setImageData(data)
    setShowHandoffTransition(true)

    if (handoffTimerRef.current !== null) {
      window.clearTimeout(handoffTimerRef.current)
    }

    handoffTimerRef.current = window.setTimeout(() => {
      setShowHandoffTransition(false)
      handoffTimerRef.current = null
      navigateTo('edit')
    }, 560)
  }

  const handleDirectUploadSuccess = (data: ImageData) => {
    clearHandoffTransition()
    setDirectUploadResult(data)
    navigateTo('directComplete')
  }

  const handleResetUpload = () => {
    clearHandoffTransition()
    setImageData(null)
    navigateTo('upload')
  }

  const handleResetDirectUpload = () => {
    clearHandoffTransition()
    setDirectUploadResult(null)
    navigateTo('directUpload')
  }

  const handleBackToHome = () => {
    clearHandoffTransition()
    navigateTo('home')
  }

  const handleBackToEntry = () => {
    clearHandoffTransition()
    navigateTo('entry')
  }

  const handleOpenControlFlow = () => {
    clearHandoffTransition()
    navigateTo('home')
  }

  const handleOpenDirectUpload = () => {
    clearHandoffTransition()
    setDirectUploadResult(null)
    navigateTo('directUpload')
  }

  const handleSelectObject = (index: number, existingImage?: ImageData) => {
    clearHandoffTransition()
    setSelectedObjectIndex(index)

    if (existingImage) {
      setImageData(existingImage)
      navigateTo('edit')
      return
    }

    setImageData(null)
    navigateTo('upload')
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="portrait-lock" aria-hidden="true">
        <div>
          <strong>请横屏使用 iPad</strong>
          <span>Art Lab 上传器为横屏控制台设计，请旋转设备继续操作。</span>
        </div>
      </div>

      <div key={currentPage} className={`page-frame page-${transitionDirection}`}>
        {currentPage === 'entry' ? (
          <EntryPage
            wsIp={wsIp}
            onWsIpChange={setWsIp}
            onOpenControlFlow={handleOpenControlFlow}
            onOpenDirectUpload={handleOpenDirectUpload}
          />
        ) : currentPage === 'home' ? (
          <HomePage
            onSelectObject={handleSelectObject}
            wsIp={wsIp}
            onWsIpChange={setWsIp}
            onBackToEntry={handleBackToEntry}
          />
        ) : currentPage === 'upload' ? (
          <UploadPage
            mode="control"
            onUploadSuccess={handleUploadSuccess}
            wsIp={wsIp}
            onWsIpChange={setWsIp}
            selectedName={selectedName}
            onBackToHome={handleBackToHome}
            enableSupabaseUpload={enableSupabaseUpload}
            selectedObjectIndex={selectedObjectIndex}
            uploadPort={CONTROL_PORT}
            shouldCacheArtwork
          />
        ) : currentPage === 'directUpload' ? (
          <UploadPage
            mode="direct"
            onUploadSuccess={handleDirectUploadSuccess}
            wsIp={wsIp}
            onWsIpChange={setWsIp}
            selectedName={selectedName}
            onBackToHome={handleBackToEntry}
            enableSupabaseUpload={false}
            selectedObjectIndex={selectedObjectIndex}
            uploadPort={DIRECT_UPLOAD_PORT}
            shouldCacheArtwork={false}
          />
        ) : currentPage === 'directComplete' ? (
          <DirectUploadCompletePage
            result={directUploadResult}
            wsIp={wsIp}
            onBackToEntry={handleBackToEntry}
            onReupload={handleResetDirectUpload}
          />
        ) : imageData ? (
          <EditPage
            imageData={imageData}
            wsIp={wsIp}
            selectedName={selectedName}
            onResetUpload={handleResetUpload}
            onBackToHome={handleBackToHome}
          />
        ) : (
          <HomePage
            onSelectObject={handleSelectObject}
            wsIp={wsIp}
            onWsIpChange={setWsIp}
            onBackToEntry={handleBackToEntry}
          />
        )}
      </div>

      {showHandoffTransition && (
        <div className="handoff-overlay" role="status" aria-live="polite">
          <div className="handoff-card">
            <span className="handoff-mark" />
            <p className="eyebrow">Sending Artwork</p>
            <strong>正在发送到 Unity</strong>
            <span>上传成功后会自动进入控制页。</span>
            <div className="handoff-progress" />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
