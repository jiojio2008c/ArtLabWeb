import { useEffect, useRef, useState } from 'react'
import HomePage from './components/HomePage.tsx'
import UploadPage from './components/UploadPage.tsx'
import EditPage from './components/EditPage.tsx'

interface ImageData {
  name: string
  url: string
}

type Page = 'home' | 'upload' | 'edit'
type TransitionDirection = 'forward' | 'backward' | 'neutral'

const pageOrder: Record<Page, number> = {
  home: 0,
  upload: 1,
  edit: 2
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>('neutral')
  const [showHandoffTransition, setShowHandoffTransition] = useState(false)
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [wsIp, setWsIp] = useState<string>('192.168.8.101')
  const [selectedName] = useState<string>('fish')
  const enableSupabaseUpload = false
  const [selectedObjectIndex, setSelectedObjectIndex] = useState<number>(0)
  const handoffTimerRef = useRef<number | null>(null)

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

  const handleBackToUpload = () => {
    clearHandoffTransition()
    navigateTo('upload')
  }

  const handleResetUpload = () => {
    clearHandoffTransition()
    setImageData(null)
    navigateTo('upload')
  }

  const handleBackToHome = () => {
    clearHandoffTransition()
    navigateTo('home')
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
          <strong>請旋轉 iPad</strong>
          <span>Art Lab 以橫向操作。</span>
        </div>
      </div>
      <div key={currentPage} className={`page-frame page-${transitionDirection}`}>
        {currentPage === 'home' ? (
          <HomePage
            onSelectObject={handleSelectObject}
            wsIp={wsIp}
            onWsIpChange={setWsIp}
          />
        ) : currentPage === 'upload' ? (
          <UploadPage
            onUploadSuccess={handleUploadSuccess}
            wsIp={wsIp}
            onWsIpChange={setWsIp}
            selectedName={selectedName}
            onBackToHome={handleBackToHome}
            enableSupabaseUpload={enableSupabaseUpload}
            selectedObjectIndex={selectedObjectIndex}
          />
        ) : (
          <EditPage
            imageData={imageData!}
            wsIp={wsIp}
            selectedName={selectedName}
            onBackToUpload={handleBackToUpload}
            onResetUpload={handleResetUpload}
            onBackToHome={handleBackToHome}
          />
        )}
      </div>

      {showHandoffTransition && (
        <div className="handoff-overlay" role="status" aria-live="polite">
          <div className="handoff-card">
            <span className="handoff-mark" />
            <p className="eyebrow">Sending Artwork</p>
            <strong>正在發送作品</strong>
            <span>準備進入控制台</span>
            <div className="handoff-progress" />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
