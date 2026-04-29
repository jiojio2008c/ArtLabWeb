import { useState, useRef } from 'react'
import axios from 'axios'

interface UploadPageProps {
  onUploadSuccess: (data: { name: string; url: string }) => void
  wsIp: string
  onWsIpChange: (ip: string) => void
  selectedName: string
  onBackToHome: () => void
}

const UploadPage: React.FC<UploadPageProps> = ({ onUploadSuccess, wsIp, onWsIpChange, selectedName, onBackToHome }) => {
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

  // 去背景处理函数
  const removeBackground = (image: HTMLImageElement): Promise<Blob> => {
    return new Promise((resolve) => {
      try {
        // 创建Canvas
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          // 如果无法获取上下文，返回原始图片
          const canvas2 = document.createElement('canvas')
          canvas2.width = image.width
          canvas2.height = image.height
          const ctx2 = canvas2.getContext('2d')
          ctx2?.drawImage(image, 0, 0)
          canvas2.toBlob((blob) => resolve(blob || new Blob()))
          return
        }

        // 压缩高分辨率图片，解决文件体积过大问题
        const MAX_WIDTH = 1920;
        let width = image.width;
        let height = image.height;
        
        if (width > MAX_WIDTH) {
          const scale = MAX_WIDTH / width;
          width = MAX_WIDTH;
          height = Math.floor(height * scale);
        }

        // 设置Canvas尺寸
        canvas.width = width;
        canvas.height = height;

        // 绘制图片到Canvas
        ctx.drawImage(image, 0, 0, width, height)

        // 获取图片数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        // 处理每个像素
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          // 检查是否为纯黑色或纯白色
          const isBlack = r < 10 && g < 10 && b < 10
          const isWhite = r > 245 && g > 245 && b > 245

          if (isBlack || isWhite) {
            // 将透明通道设为0
            data[i + 3] = 0
          }
        }

        // 将处理后的数据放回Canvas
        ctx.putImageData(imageData, 0, 0)

        // 转换为WebP格式，质量0.8以减小文件体积
        canvas.toBlob((blob) => resolve(blob || new Blob()), 'image/webp', 0.8)
      } catch (error) {
        console.error('去背景处理失败:', error)
        // 处理失败时，返回原始图片
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(image, 0, 0)
          canvas.toBlob((blob) => resolve(blob || new Blob()))
        } else {
          // 如果无法创建Canvas，返回空Blob
          resolve(new Blob())
        }
      }
    })
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

    setUploadError(null)
    
    // 生成预览并去背景
    const reader = new FileReader()
    reader.onload = async (e) => {
      if (e.target?.result) {
        const result = e.target.result as string
        const img = new Image()
        img.onload = async () => {
          try {
            // 去背景处理
            const processedBlob = await removeBackground(img)
            // 转换为File对象
            const processedFile = new File([processedBlob], file.name.replace(/\.[^/.]+$/, '') + '.webp', { type: 'image/webp' })
            // 更新状态
            setSelectedFile(processedFile)
            // 生成预览URL
            setPreviewUrl(URL.createObjectURL(processedBlob))
          } catch (error) {
            console.error('图片处理失败:', error)
            // 处理失败时，使用原始文件
            setSelectedFile(file)
            setPreviewUrl(result)
          }
        }
        img.onerror = () => {
          console.error('图片加载失败')
          // 图片加载失败时，使用原始文件
          setSelectedFile(file)
          setPreviewUrl(result)
        }
        img.src = result
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
        // 压缩高分辨率图片，解决 iOS Canvas 内存溢出问题
        const MAX_WIDTH = 1920;
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        if (width > MAX_WIDTH) {
          const scale = MAX_WIDTH / width;
          width = MAX_WIDTH;
          height = Math.floor(height * scale);
        }
        
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height)
        
        // 创建图片对象用于去背景处理
        const img = new Image()
        img.onload = async () => {
          try {
            // 去背景处理
            const processedBlob = await removeBackground(img)
            // 转换为File对象
            const file = new File([processedBlob], 'photo.png', { type: 'image/png' })
            handleFile(file)
            handleCloseCamera()
          } catch (error) {
            console.error('图片处理失败:', error)
            // 处理失败时，直接将Canvas内容转换为文件
            canvas.toBlob((blob) => {
              if (blob) {
                const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
                handleFile(file)
                handleCloseCamera()
              } else {
                // 如果无法创建Blob，直接关闭相机
                setUploadError('图片处理失败，请重试')
                handleCloseCamera()
              }
            }, 'image/jpeg', 0.9)
          }
        }
        img.onerror = () => {
          console.error('图片加载失败')
          // 图片加载失败时，直接将Canvas内容转换为文件
          canvas.toBlob((blob) => {
            if (blob) {
              const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
              handleFile(file)
              handleCloseCamera()
            } else {
              // 如果无法创建Blob，直接关闭相机
              setUploadError('图片处理失败，请重试')
              handleCloseCamera()
            }
          }, 'image/jpeg', 0.9)
        }
        // iOS 兼容：用 toBlob 代替 toDataURL，避免大图崩溃
        canvas.toBlob((blob) => {
          if (blob) {
            img.src = URL.createObjectURL(blob)
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
      formData.append('name', selectedName)

      const response = await axios.post(
        'https://lmlzavksopdunbpckaqh.supabase.co/functions/v1/gallery-upload',
        formData
        // 🔥 彻底删除这里的 headers 配置！！！
      )

      if (response.data && response.data.media_url) {
        // 1. 先执行上传成功（核心：上传独立成功）
        onUploadSuccess({
          name: selectedFile.name,
          url: response.data.media_url
        })

        // 2. 解耦 + 只发不管：fire and forget，不await、不try、不等待返回
        if (wsIp) {
          const httpUrl = `http://${wsIp}:8080`
          const formData = new FormData()
          formData.append('image', selectedFile)
          // 只发不管，无任何等待/错误处理
          fetch(httpUrl, {
            method: 'POST',
            body: formData
          })
        }
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
    <div className="min-h-screen upload-background apple-container">
      <div className="container mx-auto px-6 py-20 max-w-4xl">
        <h1 className="text-5xl font-bold text-gray-900 mb-4 text-center apple-title">Art Lab</h1>
        <p className="text-xl text-gray-600 mb-16 text-center apple-subtitle">上傳您的圖片</p>

      {/* HTTP 伺服器 IP 設定 */}
      <div className="mb-16">
        <label className="block text-xl font-semibold text-gray-700 mb-4">HTTP 伺服器 IP 位址</label>
        <div className="flex">
          <input
            type="text"
            value={wsIp}
            onChange={(e) => onWsIpChange(e.target.value)}
            placeholder="請輸入伺服器 IP 位址"
            className="flex-grow px-6 py-3 text-lg border border-gray-200 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all apple-input"
          />
          <span className="px-6 py-3 text-lg bg-gray-100 border border-gray-200 rounded-r-xl text-gray-700">:8080</span>
        </div>
      </div>



      {/* 圖片上傳區域 */}
      {previewUrl && (
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-gray-700 mb-6">圖片預覽</h2>
          <div className="apple-card">
            <img
              src={previewUrl}
              alt="預覽"
              className="w-full h-auto object-contain max-h-96 mx-auto"
            />
          </div>
        </div>
      )}

      {/* 相機模式 */}
      {showCamera ? (
        <div className="mb-16">
          <div className="apple-card">
            <video ref={videoRef} className="w-full h-auto max-h-96 object-contain mx-auto"></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
            <div className="flex justify-between mt-6 space-x-4">
              <button
                onClick={handleTakePhoto}
                className="flex-1 py-3 px-8 text-lg font-medium rounded-xl transition-all apple-button"
              >
                拍攝
              </button>
              <button
                onClick={handleCloseCamera}
                className="flex-1 py-3 px-8 text-lg font-medium rounded-xl transition-all apple-button-secondary"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* 選擇本機圖片 */}
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 text-lg font-medium rounded-xl transition-all apple-button flex flex-col items-center justify-center"
            >
              <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all apple-card ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400'}`}
          >
            <svg className="w-16 h-16 mb-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-lg text-gray-700">拖放圖片到這裡</span>
          </div>
        </div>
      )}

      {/* 返回首页按钮 */}
      {!showCamera && !previewUrl && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* 返回首页按钮 */}
          <div>
            <button
              onClick={onBackToHome}
              className="w-full py-6 text-lg font-medium rounded-xl transition-all apple-button-secondary flex flex-col items-center justify-center"
            >
              <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>返回首页</span>
            </button>
          </div>

          {/* 開啟相機按鈕 */}
          <div>
            <button
              onClick={handleOpenCamera}
              className="w-full py-6 text-lg font-medium rounded-xl transition-all apple-button-secondary flex flex-col items-center justify-center"
            >
              <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>開啟相機拍攝</span>
            </button>
          </div>
        </div>
      )}

      {/* 上載按鈕 */}
      {previewUrl && (
        <div className="mb-12">
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className={`w-full py-3 px-8 text-lg font-medium rounded-xl transition-all ${isUploading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'apple-button'}`}
          >
            {isUploading ? '上載中...' : '確認上載'}
          </button>
        </div>
      )}

      {/* 錯誤提示 */}
      {uploadError && (
        <div className="mt-6 p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl apple-status-error">
          {uploadError}
        </div>
      )}

      {/* 輔助文字 */}
      <div className="mt-16 text-center text-sm text-gray-500">
        支援 JPEG/PNG/GIF/WebP，單一檔案不超過 10MB
      </div>
      </div>
    </div>
  )
}

export default UploadPage