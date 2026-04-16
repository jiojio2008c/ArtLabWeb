import { useState, useRef } from 'react'
import axios from 'axios'

interface UploadPageProps {
  onUploadSuccess: (data: { name: string; url: string }) => void
  wsIp: string
  onWsIpChange: (ip: string) => void
}

const UploadPage: React.FC<UploadPageProps> = ({ onUploadSuccess, wsIp, onWsIpChange }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState<boolean>(false)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  // 处理拖放
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  // 处理文件
  const handleFile = (file: File) => {
    // 验证文件格式和大小
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setUploadError('不支援的檔案格式，請選擇 JPEG/PNG/GIF/WebP 格式')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('檔案大小超過限制，請選擇小於 10MB 的檔案')
      return
    }

    setSelectedFile(file)
    setUploadError(null)
    
    // 生成预览
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        setPreviewUrl(e.target.result as string)
      }
    }
    reader.readAsDataURL(file)
  }

  // 打开相机
  const handleOpenCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setShowCamera(true)
      }
    } catch (error) {
      console.error('相機開啟失敗:', error)
      setUploadError('相機開啟失敗，請檢查相機權限')
    }
  }

  // 关闭相机
  const handleCloseCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setShowCamera(false)
  }

  // 拍照
  const handleTakePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // 转换为文件
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
            handleFile(file)
            handleCloseCamera()
          }
        }, 'image/jpeg', 0.9)
      }
    }
  }

  // 上传文件到Supabase
  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('questionId', '752d87b3-5f33-4097-ae16-c99eabed2e86')
      formData.append('name', 'John')

      const response = await axios.post(
        'https://lmlzavksopdunbpckaqh.supabase.co/functions/v1/gallery-upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      if (response.data && response.data.media_url) {
        onUploadSuccess({
          name: selectedFile.name,
          url: response.data.media_url
        })
      } else {
        throw new Error('上載失敗：未收到有效回應')
      }
    } catch (error) {
      console.error('上載錯誤:', error)
      setUploadError('上載失敗，請重試')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center">Art Lab Web</h1>

      {/* HTTP 伺服器 IP 設定 */}
      <div className="mb-6">
        <label className="block text-lg font-medium mb-2">HTTP 伺服器 IP 位址</label>
        <div className="flex">
          <input
            type="text"
            value={wsIp}
            onChange={(e) => onWsIpChange(e.target.value)}
            placeholder="請輸入伺服器 IP 位址"
            className="flex-grow px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="px-4 py-2 bg-gray-200 border border-gray-300 rounded-r-lg">:8080</span>
        </div>
      </div>

      {/* 圖片預覽區 */}
      {previewUrl && (
        <div className="mb-8">
          <h2 className="text-xl font-medium mb-4">圖片預覽</h2>
          <div className="bg-white p-4 rounded-lg shadow-md">
            <img
              src={previewUrl}
              alt="預覽"
              className="w-full h-auto object-contain max-h-96"
            />
          </div>
        </div>
      )}

      {/* 相機模式 */}
      {showCamera ? (
        <div className="mb-8">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <video ref={videoRef} className="w-full h-auto max-h-96 object-contain"></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
            <div className="flex justify-between mt-4">
              <button
                onClick={handleTakePhoto}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                拍攝
              </button>
              <button
                onClick={handleCloseCamera}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* 選擇本機圖片 */}
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex flex-col items-center justify-center"
            >
              <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>選擇本機圖片</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* 拖放上載區 */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
          >
            <svg className="w-12 h-12 mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-center">拖放圖片到這裡</span>
          </div>
        </div>
      )}

      {/* 開啟相機按鈕 */}
      {!showCamera && !previewUrl && (
        <div className="mb-8">
          <button
            onClick={handleOpenCamera}
            className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex flex-col items-center justify-center"
          >
            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>開啟相機拍攝</span>
          </button>
        </div>
      )}

      {/* 上載按鈕 */}
      {previewUrl && (
        <div>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className={`w-full px-6 py-4 rounded-lg transition-colors ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
          >
            {isUploading ? '上載中...' : '確認上載'}
          </button>
        </div>
      )}

      {/* 錯誤提示 */}
      {uploadError && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {uploadError}
        </div>
      )}

      {/* 輔助文字 */}
      <div className="mt-8 text-center text-sm text-gray-500">
        支援 JPEG/PNG/GIF/WebP，單一檔案不超過 10MB
      </div>
    </div>
  )
}

export default UploadPage