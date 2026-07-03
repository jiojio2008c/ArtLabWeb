import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { saveArtworkToIp, saveThumbnailToIp } from './HomePage.tsx'

interface UploadPageProps {
  onUploadSuccess: (data: { name: string; url: string }) => void
  wsIp: string
  onWsIpChange: (ip: string) => void
  selectedName: string
  onBackToHome: () => void
  enableSupabaseUpload: boolean
  selectedObjectIndex: number
}

const saveThumbnailForObject = async (ip: string, index: number, imageUrl: string, imageName = `slot-${index}.png`, artworkBlob?: Blob) => {
  await saveArtworkToIp(ip, index, { name: imageName, url: imageUrl }, artworkBlob)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve) => {
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 80
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      const scale = Math.max(size / img.width, size / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
        saveThumbnailToIp(ip, index, dataUrl)
      } catch {
        try { saveThumbnailToIp(ip, index, imageUrl) } catch {}
      }
      resolve()
    }
    img.onerror = () => {
      try { saveThumbnailToIp(ip, index, imageUrl) } catch {}
      resolve()
    }
    img.src = imageUrl
  })
}

const UploadPage: React.FC<UploadPageProps> = ({ onUploadSuccess, wsIp, onWsIpChange, selectedName, onBackToHome, enableSupabaseUpload, selectedObjectIndex }) => {
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
      setAudioStatus('正在錄製音訊...')
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
        setAudioStatus('錄製完成，可發送到 Unity')
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
    } catch (err) {
      console.error('錄製失敗:', err)
      setAudioStatus('錄製失敗，請檢查麥克風權限')
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
          await saveThumbnailForObject(wsIp, selectedObjectIndex, response.data.media_url, processedFile.name)
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
        setUploadSuccess('已發送至 Unity')
        const localUrl = URL.createObjectURL(blob!)
        await saveThumbnailForObject(wsIp, selectedObjectIndex, localUrl, processedFile.name, blob)
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
          await saveThumbnailForObject(wsIp, selectedObjectIndex, response.data.media_url, selectedFile.name)
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
        setUploadSuccess('已發送至 Unity')
        const localUrl = URL.createObjectURL(selectedFile)
        await saveThumbnailForObject(wsIp, selectedObjectIndex, localUrl, selectedFile.name, selectedFile)
        onUploadSuccess({
          name: selectedFile.name,
          url: localUrl
        })
      }
    } catch (error) {
      console.error('上載錯誤:', error)
      setUploadError('上載失敗，請重試')
    } finally {
      setIsUploading(false)
    }
  }

  const selectedFileName = selectedFile?.name ?? '未選擇檔案'
  const uploadModeLabel = enableSupabaseUpload ? 'Supabase + HTTP' : 'HTTP 直送'
  const maskOptions = [0, 1, 2, 3, 4, 5]

  return (
    <main className="ipad-screen upload-screen apple-container">
      <header className="ipad-topbar">
        <div className="topbar-title-row">
          <button onClick={onBackToHome} className="ipad-button ghost-button">
            返回
          </button>
          <div className="min-w-0">
            <p className="eyebrow">Slot {selectedObjectIndex}</p>
            <h1 className="screen-title">上傳作品</h1>
          </div>
        </div>

        <div className="topbar-controls">
          <div className="ip-control">
            <span className="control-label">HTTP</span>
            <input
              type="text"
              value={wsIp}
              onChange={(e) => onWsIpChange(e.target.value)}
              className="ipad-input ip-input"
            />
            <span className="port-chip">:8080</span>
          </div>
          <span className="status-pill">{uploadModeLabel}</span>
        </div>
      </header>

      {(uploadError || uploadSuccess) && (
        <div className={`status-toast ${uploadError ? 'error' : 'success'}`}>
          {uploadError || uploadSuccess}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {showCamera ? (
        <section className="camera-workspace">
          <div className="camera-preview">
            <video ref={videoRef} className="camera-video"></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
          </div>
          <div className="camera-actions">
            <button onClick={handleCloseCamera} className="ipad-button secondary-button">
              取消
            </button>
            <button onClick={handleTakePhoto} className="ipad-button primary-button">
              拍攝
            </button>
          </div>
        </section>
      ) : showMaskPanel && previewUrl ? (
        <section className="upload-workspace mask-workspace">
          <div className="mask-canvas-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Mask Alignment</p>
                <h2>調整作品位置</h2>
              </div>
              <span className="status-pill">{selectedFileName}</span>
            </div>

            <div ref={alignmentContainerRef} className="mask-stage">
              <img
                src={previewUrl}
                alt="待調整圖片"
                className="mask-source-image"
                style={{
                  transform: `translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                  zIndex: 1
                }}
                onMouseDown={handleImageMouseDown}
                onTouchStart={handleImageTouchStart}
              />

              {selectedMask > 0 && (
                <img
                  src={`/MaskTexture/Mask${selectedMask}.png`}
                  alt={`遮罩 ${selectedMask}`}
                  className="mask-overlay-image"
                  style={{ zIndex: 2 }}
                />
              )}
            </div>
          </div>

          <aside className="upload-rail">
            <section className="rail-section">
              <p className="eyebrow">Mask</p>
              <div className="mask-button-grid">
                {maskOptions.map((maskIndex) => (
                  <button
                    key={maskIndex}
                    onClick={() => handleMaskChange(maskIndex)}
                    className={`mask-option ${selectedMask === maskIndex ? 'active' : ''}`}
                  >
                    {maskIndex === 0 ? '無' : maskIndex}
                  </button>
                ))}
              </div>
            </section>

            <section className="rail-section">
              <p className="eyebrow">Audio</p>
              {audioStatus && (
                <p className={`rail-status ${audioStatus.includes('失敗') ? 'error' : 'success'}`}>
                  {audioStatus}
                </p>
              )}
              {audioRecorded && !audioStatus.includes('失敗') && (
                <p className="rail-status success">已錄製音訊</p>
              )}
              <div className="rail-two-buttons">
                <button
                  onClick={startAudioRecording}
                  disabled={isRecording}
                  className="ipad-button secondary-button"
                >
                  {isRecording ? '錄製中' : '錄音'}
                </button>
                <button
                  onClick={stopAudioRecording}
                  disabled={!isRecording}
                  className="ipad-button secondary-button"
                >
                  停止
                </button>
              </div>
            </section>

            <button
              onClick={handleScreenshotAndUpload}
              disabled={isUploading}
              className="ipad-button primary-button send-button"
            >
              {isUploading ? '上載中' : '確認發送'}
            </button>
          </aside>
        </section>
      ) : previewUrl ? (
        <section className="upload-workspace preview-workspace">
          <div className="preview-panel">
            <img src={previewUrl} alt="預覽" className="preview-image" />
          </div>
          <aside className="upload-rail">
            <section className="rail-section">
              <p className="eyebrow">Preview</p>
              <h2>{selectedFileName}</h2>
            </section>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="ipad-button primary-button send-button"
            >
              {isUploading ? '上載中' : '確認上載'}
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="ipad-button secondary-button">
              重新選擇
            </button>
          </aside>
        </section>
      ) : (
        <section className="upload-workspace import-workspace">
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`import-dropzone ${isDragging ? 'is-dragging' : ''}`}
          >
            <span className="import-plus">+</span>
            <strong>選擇圖片</strong>
            <span>JPEG / PNG / GIF / WebP</span>
          </button>

          <div className="capture-panel">
            <video src="people.mp4" autoPlay loop muted playsInline className="capture-video" />
            <div className="capture-content">
              <p className="eyebrow light">Camera</p>
              <h2>拍攝作品</h2>
              <button onClick={handleOpenCamera} className="hidden">
                開啟相機
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

export default UploadPage
