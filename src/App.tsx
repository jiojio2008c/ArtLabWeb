import { useState } from 'react'
import HomePage from './components/HomePage.tsx'
import UploadPage from './components/UploadPage.tsx'
import EditPage from './components/EditPage.tsx'

interface ImageData {
  name: string
  url: string
}

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'upload' | 'edit'>('home')
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [wsIp, setWsIp] = useState<string>('192.168.8.101')
  const [selectedName, setSelectedName] = useState<string>('fish')

  const handleUploadSuccess = (data: ImageData) => {
    setImageData(data)
    setCurrentPage('edit')
  }

  const handleBackToUpload = () => {
    setCurrentPage('upload')
  }

  const handleResetUpload = () => {
    setImageData(null)
    setCurrentPage('upload')
  }

  const handleSelectScene = (sceneName: string) => {
    setSelectedName(sceneName)
    setCurrentPage('upload')
  }

  return (
    <div className="min-h-screen bg-white">
      {currentPage === 'home' ? (
        <HomePage 
          onSelectScene={handleSelectScene}
        />
      ) : currentPage === 'upload' ? (
        <UploadPage 
          onUploadSuccess={handleUploadSuccess}
          wsIp={wsIp}
          onWsIpChange={setWsIp}
          selectedName={selectedName}
        />
      ) : (
        <EditPage 
          imageData={imageData!}
          wsIp={wsIp}
          selectedName={selectedName}
          onBackToUpload={handleBackToUpload}
          onResetUpload={handleResetUpload}
        />
      )}
    </div>
  )
}

export default App