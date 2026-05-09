import { useState, useRef, useEffect } from 'react'
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
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState<boolean>(false)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  // 遮罩对齐面板状态
  const [showMaskPanel, setShowMaskPanel] = useState<boolean>(false)
  const [selectedMask, setSelectedMask] = useState<number>(0) // 0表示无遮罩，默认展示
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const isDraggingImageRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const positionRef = useRef({ x: 0, y: 0 })
  const [isImageDragging, setIsImageDragging] = useState(false)
  const [_imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  // Supabase上传开关
  const [enableSupabaseUpload, setEnableSupabaseUpload] = useState<boolean>(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const alignmentContainerRef = useRef<HTMLDivElement>(null)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [audioRecorded, setAudioRecorded] = useState<boolean>(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioStatus, setAudioStatus] = useState<string>('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startAudioRecording = async () => {
    try {
      setAudioStatus('正在录制音频...')
      setIsRecording(true)
      setAudioRecorded(false)
      setAudioBlob(null)
      audioChunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        setAudioBlob(blob)
        setAudioRecorded(true)
        setAudioStatus('录制完成，可发送到Unity')
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
    } catch (err) {
      console.error('录制失败:', err)
      setAudioStatus('录制失败，请检查麦克风权限')
      setIsRecording(false)
    }
  }

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

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

          // 强化纯白色像素判定，确保遮罩带来的白色底全部设为透明
          // 纯白色阈值：RGB值接近255的像素
          const isWhite = r > 230 && g > 230 && b > 230

          if (isWhite) {
            // 将透明通道设为0
            data[i + 3] = 0
          }
        }

        // 将处理后的数据放回Canvas
        ctx.putImageData(imageData, 0, 0)

        // 转换为PNG格式，确保Unity兼容性
        canvas.toBlob((blob) => resolve(blob || new Blob()), 'image/png')
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
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    setAudioRecorded(false)
    setAudioBlob(null)
    setAudioStatus('')
    audioChunksRef.current = []
    
    // 生成预览并去背景
    const reader = new FileReader()
    reader.onload = async (e) => {
      if (e.target?.result) {
        const result = e.target.result as string
        const img = new Image()
        img.onload = () => {
          // 保留原始图片，不提前去背景
          setSelectedFile(file)
          setPreviewUrl(result)
          // 获取图片尺寸
          setImageDimensions({ width: img.width, height: img.height })
          // 自动显示遮罩对齐面板
          setShowMaskPanel(true)
          // 重置图片位置
          positionRef.current = { x: 0, y: 0 }
          setImagePosition({ x: 0, y: 0 })
        }
        img.onerror = () => {
          console.error('图片加载失败')
          // 图片加载失败时，使用原始文件
          setSelectedFile(file)
          setPreviewUrl(result)
          // 获取图片尺寸（即使加载失败也尝试获取）
          setImageDimensions({ width: img.width, height: img.height })
          // 自动显示遮罩对齐面板
          setShowMaskPanel(true)
          // 重置图片位置
          positionRef.current = { x: 0, y: 0 }
          setImagePosition({ x: 0, y: 0 })
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
  void handleOpenCamera

  // 图片拖放处理函数
  const handleImageMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingImageRef.current = true
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y
    }
    setIsImageDragging(true)
  }

  const handleImageTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    isDraggingImageRef.current = true
    const touch = e.touches[0]
    dragStartRef.current = {
      x: touch.clientX - positionRef.current.x,
      y: touch.clientY - positionRef.current.y
    }
    setIsImageDragging(true)
  }

  useEffect(() => {
    if (!isImageDragging) return

    const container = alignmentContainerRef.current
    if (!container) return

    const clampPosition = (newX: number, newY: number) => {
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight
      const img = container.querySelector('img') as HTMLImageElement | null
      if (!img) return { x: newX, y: newY }

      const displayWidth = img.offsetWidth
      const displayHeight = img.offsetHeight

      if (displayWidth > containerWidth) {
        newX = Math.max(-(displayWidth - containerWidth), Math.min(0, newX))
      }
      if (displayHeight > containerHeight) {
        newY = Math.max(-(displayHeight - containerHeight), Math.min(0, newY))
      }

      return { x: newX, y: newY }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingImageRef.current) return
      const newX = e.clientX - dragStartRef.current.x
      const newY = e.clientY - dragStartRef.current.y
      const clamped = clampPosition(newX, newY)
      positionRef.current = { x: clamped.x, y: clamped.y }
      setImagePosition({ x: clamped.x, y: clamped.y })
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingImageRef.current) return
      e.preventDefault()
      const touch = e.touches[0]
      const newX = touch.clientX - dragStartRef.current.x
      const newY = touch.clientY - dragStartRef.current.y
      const clamped = clampPosition(newX, newY)
      positionRef.current = { x: clamped.x, y: clamped.y }
      setImagePosition({ x: clamped.x, y: clamped.y })
    }

    const handleEnd = () => {
      isDraggingImageRef.current = false
      setIsImageDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleEnd)
    document.addEventListener('touchcancel', handleEnd)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleEnd)
      document.removeEventListener('touchcancel', handleEnd)
    }
  }, [isImageDragging])

  // 切换遮罩
  const handleMaskChange = (maskIndex: number) => {
    setSelectedMask(maskIndex)
  }

  // 截图并上传
  const handleScreenshotAndUpload = async () => {
    if (!previewUrl) return

    setIsUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    try {
      // 获取遮罩对齐容器的实际尺寸
      if (!alignmentContainerRef.current) throw new Error('无法获取容器尺寸')
      const containerWidth = alignmentContainerRef.current.clientWidth
      const containerHeight = alignmentContainerRef.current.clientHeight

      // 创建截图Canvas
      const screenshotCanvas = document.createElement('canvas')
      const ctx = screenshotCanvas.getContext('2d')
      if (!ctx) throw new Error('无法创建Canvas上下文')

      // 设置Canvas尺寸与遮罩面板相同
      screenshotCanvas.width = containerWidth
      screenshotCanvas.height = containerHeight

      // 加载用户图片
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = previewUrl
      })

      // 计算用户图片的显示尺寸（匹配CSS: max-w-full max-h-full，即object-contain效果）
      let drawWidth = img.width
      let drawHeight = img.height
      if (drawWidth > containerWidth || drawHeight > containerHeight) {
        const scaleX = containerWidth / drawWidth
        const scaleY = containerHeight / drawHeight
        const scale = Math.min(scaleX, scaleY)
        drawWidth = Math.round(img.width * scale)
        drawHeight = Math.round(img.height * scale)
      }

      // 计算居中偏移（匹配CSS: flex items-center justify-center 对absolute元素的静态定位）
      const centerX = (containerWidth - drawWidth) / 2
      const centerY = (containerHeight - drawHeight) / 2

      // 1. 绘制用户图片（居中 + 拖动偏移，与预览一致）
      ctx.drawImage(img, centerX + imagePosition.x, centerY + imagePosition.y, drawWidth, drawHeight)

      // 2. 用遮罩裁剪用户图：destination-out模式
      // 遮罩白色不透明区域（形状外部）→ 擦除用户图 → 透明
      // 遮罩透明区域（形状内部）→ 保留用户图
      if (selectedMask > 0) {
        const maskImg = new Image()
        maskImg.crossOrigin = 'anonymous'
        await new Promise((resolve, reject) => {
          maskImg.onload = resolve
          maskImg.onerror = reject
          maskImg.src = `/MaskTexture/Mask${selectedMask}.png`
        })

        // 计算遮罩绘制参数（匹配CSS: w-full h-full object-cover）
        const maskScaleX = containerWidth / maskImg.width
        const maskScaleY = containerHeight / maskImg.height
        const maskScale = Math.max(maskScaleX, maskScaleY)
        const maskDrawWidth = maskImg.width * maskScale
        const maskDrawHeight = maskImg.height * maskScale
        const maskOffsetX = (containerWidth - maskDrawWidth) / 2
        const maskOffsetY = (containerHeight - maskDrawHeight) / 2

        ctx.globalCompositeOperation = 'destination-out'
        ctx.drawImage(maskImg, maskOffsetX, maskOffsetY, maskDrawWidth, maskDrawHeight)
      }

      // 3. 重置混合模式
      ctx.globalCompositeOperation = 'source-over'

      // 4. 直接获取裁剪后的Blob（无需再去背景）
      const blob = await new Promise<Blob | null>((resolve) => {
        screenshotCanvas.toBlob((blob) => resolve(blob), 'image/png')
      })

      if (!blob) throw new Error('截图失败')

      // 直接使用裁剪后的Blob生成File，无需再调用removeBackground
      const processedFile = new File([blob], selectedFile?.name.replace(/\.[^/.]+$/, '') + '.png' || 'processed_image.png', { type: 'image/png' })

      // 1. Supabase上传（仅当启用时）
      if (enableSupabaseUpload) {
        const formData = new FormData()
        formData.append('file', processedFile)
        formData.append('questionId', '752d87b3-5f33-4097-ae16-c99eabed2e86')
        formData.append('name', selectedName)

        const response = await axios.post(
          'https://lmlzavksopdunbpckaqh.supabase.co/functions/v1/gallery-upload',
          formData
        )

        if (response.data && response.data.media_url) {
          // 执行上传成功回调
          onUploadSuccess({
            name: processedFile.name,
            url: response.data.media_url
          })
        } else {
          throw new Error('上載失敗：未收到有效回應')
        }
      }
      // 2. 强制发送HTTP请求（无论是否启用Supabase上传）
      if (wsIp) {
        const httpUrl = `http://${wsIp}:8080`
        const formData = new FormData()
        formData.append('image', processedFile)
        if (audioRecorded && audioBlob) {
          const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' })
          formData.append('audio', audioFile)
        }
        // 只发不管，无任何等待/错误处理
        const xhr = new XMLHttpRequest()
        xhr.open('POST', httpUrl, true)
        xhr.send(formData)
      }
      
      // 3. 上传成功提示（根据是否启用Supabase显示不同文案）
      if (!enableSupabaseUpload) {
        setUploadSuccess('已發送HTTP請求，未上傳至Supabase')
        const localUrl = URL.createObjectURL(blob!)
        onUploadSuccess({
          name: processedFile.name,
          url: localUrl
        })
      }
    } catch (error) {
      console.error('截圖上載錯誤:', error)
      setUploadError('截圖上載失敗，請重試')
    } finally {
      setIsUploading(false)
      setShowMaskPanel(false)
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
    setUploadSuccess(null)

    try {
      // 1. Supabase上传（仅当启用时）
      if (enableSupabaseUpload) {
        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('questionId', '752d87b3-5f33-4097-ae16-c99eabed2e86')
        formData.append('name', selectedName)

        const response = await axios.post(
          'https://lmlzavksopdunbpckaqh.supabase.co/functions/v1/gallery-upload',
          formData
        )

        if (response.data && response.data.media_url) {
          // 执行上传成功回调
          onUploadSuccess({
            name: selectedFile.name,
            url: response.data.media_url
          })
        } else {
          throw new Error('上載失敗：未收到有效回應')
        }
      }
      // 2. 强制发送HTTP请求（无论是否启用Supabase上传）
      if (wsIp) {
        const httpUrl = `http://${wsIp}:8080`
        const formData = new FormData()
        formData.append('image', selectedFile)
        // 只发不管，无任何等待/错误处理
        const xhr = new XMLHttpRequest()
        xhr.open('POST', httpUrl, true)
        xhr.send(formData)
      }
      
      // 3. 上传成功提示（根据是否启用Supabase显示不同文案）
      if (!enableSupabaseUpload) {
        setUploadSuccess('已發送HTTP請求，未上傳至Supabase')
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

      {/* Supabase 上傳開關 */}
      <div className="mb-16">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enableSupabaseUpload}
            onChange={(e) => setEnableSupabaseUpload(e.target.checked)}
            className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 border-gray-300 transition-all"
          />
          <span className="ml-3 text-xl font-medium text-gray-700">啟用 Supabase 上傳</span>
        </label>
      </div>

      {/* 圖片上傳區域 */}
      {previewUrl && !showMaskPanel && (
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

      {/* 遮罩對齊面板 */}
      {showMaskPanel && previewUrl && (
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-gray-700 mb-6">遮罩對齊</h2>
          <div className="apple-card">
            {/* 遮罩選擇器 */}
            <div className="mb-6 flex justify-center space-x-4">
              {[0, 1, 2, 3, 4, 5].map((maskIndex) => (
                <button
                  key={maskIndex}
                  onClick={() => handleMaskChange(maskIndex)}
                  className={`px-4 py-2 rounded-lg transition-all ${selectedMask === maskIndex ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {maskIndex === 0 ? '無遮罩' : `遮罩 ${maskIndex}`}
                </button>
              ))}
            </div>

            {/* 遮罩對齊區域 */}
            <div 
              ref={alignmentContainerRef}
              className="relative w-full h-96 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white flex items-center justify-center"
            >
              {/* 用戶上傳的圖片 */}
              <img
                src={previewUrl}
                alt="待調整圖片"
                className="absolute max-w-full max-h-full cursor-move"
                style={{ 
                  transform: `translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                  zIndex: 1
                }}
                onMouseDown={handleImageMouseDown}
                onTouchStart={handleImageTouchStart}
              />

              {/* 遮罩圖（固定顯示在最上層，僅在選擇遮罩時顯示） */}
              {selectedMask > 0 && (
                <img
                  src={`/MaskTexture/Mask${selectedMask}.png`}
                  alt={`遮罩 ${selectedMask}`}
                  className="absolute w-full h-full object-cover pointer-events-none"
                  style={{ zIndex: 2 }}
                />
              )}
            </div>

            {/* 为当前图片录制音频（可选） */}
            <div className="mt-6 p-6 border border-gray-200 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">为当前图片录制音频（可选）</h3>
              <div className="flex flex-col space-y-3">
                {audioStatus && (
                  <p className={`text-center text-base ${audioStatus.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>
                    {audioStatus}
                  </p>
                )}
                {audioRecorded && !audioStatus.includes('失败') && (
                  <p className="text-center text-sm text-green-500">✓ 已录制音频，将随图片一起发送</p>
                )}
                <div className="flex space-x-4">
                  <button
                    onClick={startAudioRecording}
                    disabled={isRecording}
                    className={`flex-1 py-2 px-4 text-base font-medium rounded-xl transition-all ${isRecording ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'apple-button'}`}
                  >
                    {isRecording ? '录制中...' : '开始录制'}
                  </button>
                  <button
                    onClick={stopAudioRecording}
                    disabled={!isRecording}
                    className={`flex-1 py-2 px-4 text-base font-medium rounded-xl transition-all ${!isRecording ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'apple-button-secondary'}`}
                  >
                    停止录制
                  </button>
                </div>
              </div>
            </div>

            {/* 確認截圖同上傳按鈕 */}
            <div className="mt-6">
              <button
                onClick={handleScreenshotAndUpload}
                disabled={isUploading}
                className={`w-full py-3 px-8 text-lg font-medium rounded-xl transition-all ${isUploading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'apple-button'}`}
              >
                {isUploading ? '上載中...' : '確認截圖同上傳'}
              </button>
            </div>
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
        <div className="mb-12">
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
      )}

      {/* 上載按鈕（只在未顯示遮罩面板時顯示） */}
      {previewUrl && !showMaskPanel && (
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

      {/* 成功提示 */}
      {uploadSuccess && (
        <div className="mt-6 p-4 bg-green-50 text-green-600 border border-green-200 rounded-xl apple-status-success">
          {uploadSuccess}
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