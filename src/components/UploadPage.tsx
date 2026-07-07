import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { saveArtworkToIp, saveThumbnailToIp } from '../services/artworkStorage.ts'
import { saveLastWsIp } from '../services/appSettings.ts'
import { CONTROL_PORT } from '../services/networkConfig.ts'

type UploadMode = 'control' | 'direct'

interface MaskOption {
  id: string
  label: string
  src?: string
}

const CONTROL_MASK_OPTIONS: MaskOption[] = [
  { id: '0', label: '无' },
  { id: '1', label: '1', src: '/MaskTexture/Mask1.png' },
  { id: '2', label: '2', src: '/MaskTexture/Mask2.png' },
  { id: '3', label: '3', src: '/MaskTexture/Mask3.png' },
  { id: '4', label: '4', src: '/MaskTexture/Mask4.png' },
  { id: '5', label: '5', src: '/MaskTexture/Mask5.png' }
]

const DIRECT_MASK_OPTIONS: MaskOption[] = [
  { id: 'C-01', label: 'C-01', src: '/DirectMaskTexture/C-01.png' },
  { id: 'A-02', label: 'A-02', src: '/DirectMaskTexture/A-02.png' },
  { id: 'A-03', label: 'A-03', src: '/DirectMaskTexture/A-03.png' }
]

interface UploadPageProps {
  mode?: UploadMode
  onUploadSuccess: (data: { name: string; url: string }) => void
  wsIp: string
  onWsIpChange: (ip: string) => void
  selectedName: string
  onBackToHome: () => void
  enableSupabaseUpload: boolean
  selectedObjectIndex: number
  uploadPort?: number
  shouldCacheArtwork?: boolean
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
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve()
        return
      }

      const scale = Math.max(size / img.width, size / img.height)
      const width = img.width * scale
      const height = img.height * scale
      ctx.drawImage(img, (size - width) / 2, (size - height) / 2, width, height)

      try {
        saveThumbnailToIp(ip, index, canvas.toDataURL('image/jpeg', 0.6))
      } catch {
        try {
          saveThumbnailToIp(ip, index, imageUrl)
        } catch {
          // Ignore cache failures; uploading to Unity should not be blocked by local preview storage.
        }
      }
      resolve()
    }

    img.onerror = () => {
      try {
        saveThumbnailToIp(ip, index, imageUrl)
      } catch {
        // Ignore cache failures.
      }
      resolve()
    }

    img.src = imageUrl
  })
}

const UploadPage: React.FC<UploadPageProps> = ({
  mode = 'control',
  onUploadSuccess,
  wsIp,
  onWsIpChange,
  selectedName,
  onBackToHome,
  enableSupabaseUpload,
  selectedObjectIndex,
  uploadPort = CONTROL_PORT,
  shouldCacheArtwork = true
}) => {
  const isDirectMode = mode === 'direct'
  const activeMaskOptions = isDirectMode ? DIRECT_MASK_OPTIONS : CONTROL_MASK_OPTIONS
  const defaultMaskId = isDirectMode ? 'C-01' : '0'

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showMaskPanel, setShowMaskPanel] = useState(false)
  const [selectedMask, setSelectedMask] = useState(defaultMaskId)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [isImageDragging, setIsImageDragging] = useState(false)
  const [, setImageDimensions] = useState({ width: 0, height: 0 })
  const [isRecording, setIsRecording] = useState(false)
  const [audioRecorded, setAudioRecorded] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioStatus, setAudioStatus] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const alignmentContainerRef = useRef<HTMLDivElement>(null)
  const isDraggingImageRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const positionRef = useRef({ x: 0, y: 0 })
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const selectedMaskOption = activeMaskOptions.find((option) => option.id === selectedMask) ?? activeMaskOptions[0]
  const selectedFileName = selectedFile?.name ?? '未选择文件'
  const uploadModeLabel = isDirectMode ? `HTTP :${uploadPort}` : enableSupabaseUpload ? 'Supabase + HTTP' : 'HTTP 直送'
  const title = isDirectMode ? '快速拍照上传' : '上传作品'
  const eyebrow = isDirectMode ? 'Quick Upload' : `Slot ${selectedObjectIndex}`
  const submitLabel = isDirectMode ? '发送快速上传' : '发送到 Unity'

  useEffect(() => {
    setSelectedMask(defaultMaskId)
  }, [defaultMaskId])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    if (!isImageDragging) return

    const container = alignmentContainerRef.current
    if (!container) return

    const clampPosition = (newX: number, newY: number) => {
      const img = container.querySelector('.mask-source-image') as HTMLImageElement | null
      if (!img) return { x: newX, y: newY }

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight
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

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingImageRef.current) return

      const clamped = clampPosition(
        event.clientX - dragStartRef.current.x,
        event.clientY - dragStartRef.current.y
      )
      positionRef.current = clamped
      setImagePosition(clamped)
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!isDraggingImageRef.current) return

      event.preventDefault()
      const touch = event.touches[0]
      const clamped = clampPosition(
        touch.clientX - dragStartRef.current.x,
        touch.clientY - dragStartRef.current.y
      )
      positionRef.current = clamped
      setImagePosition(clamped)
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

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        setAudioBlob(blob)
        setAudioRecorded(true)
        setAudioStatus('录制完成，可发往 Unity')
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
    } catch (error) {
      console.error('Audio recording failed:', error)
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      handleFile(event.target.files[0])
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files?.[0]) {
      handleFile(event.dataTransfer.files[0])
    }
  }

  const removeBackground = (image: HTMLImageElement): Promise<Blob> => {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          const fallbackCanvas = document.createElement('canvas')
          fallbackCanvas.width = image.width
          fallbackCanvas.height = image.height
          fallbackCanvas.getContext('2d')?.drawImage(image, 0, 0)
          fallbackCanvas.toBlob((blob) => resolve(blob ?? new Blob()), 'image/png')
          return
        }

        const maxWidth = 1920
        let width = image.width
        let height = image.height

        if (width > maxWidth) {
          const scale = maxWidth / width
          width = maxWidth
          height = Math.floor(height * scale)
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(image, 0, 0, width, height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          if (r > 230 && g > 230 && b > 230) {
            data[i + 3] = 0
          }
        }

        ctx.putImageData(imageData, 0, 0)
        canvas.toBlob((blob) => resolve(blob ?? new Blob()), 'image/png')
      } catch (error) {
        console.error('Background removal failed:', error)
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(image, 0, 0)
          canvas.toBlob((blob) => resolve(blob ?? new Blob()), 'image/png')
          return
        }
        resolve(new Blob())
      }
    })
  }

  const handleFile = (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setUploadError('不支持的文件类型，请选择 JPEG / PNG / GIF / WebP')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('文件过大，请选择 10MB 以内的图片')
      return
    }

    setUploadError(null)
    setUploadSuccess(null)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    setAudioRecorded(false)
    setAudioBlob(null)
    setAudioStatus('')
    audioChunksRef.current = []

    const reader = new FileReader()
    reader.onload = (event) => {
      if (!event.target?.result) return

      const result = String(event.target.result)
      const img = new Image()
      img.onload = () => {
        setSelectedFile(file)
        setPreviewUrl(result)
        setImageDimensions({ width: img.width, height: img.height })
        setShowMaskPanel(true)
        positionRef.current = { x: 0, y: 0 }
        setImagePosition({ x: 0, y: 0 })
      }
      img.onerror = () => {
        setSelectedFile(file)
        setPreviewUrl(result)
        setImageDimensions({ width: 0, height: 0 })
        setShowMaskPanel(true)
        positionRef.current = { x: 0, y: 0 }
        setImagePosition({ x: 0, y: 0 })
      }
      img.src = result
    }
    reader.readAsDataURL(file)
  }

  const handleOpenCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setShowCamera(true)
      }
    } catch (error) {
      console.error('Camera open failed:', error)
      setUploadError('打开相机失败，请检查相机权限')
    }
  }

  const handleCloseCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setShowCamera(false)
  }

  const handleTakePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) return

    const maxWidth = 1920
    let width = video.videoWidth
    let height = video.videoHeight

    if (width > maxWidth) {
      const scale = maxWidth / width
      width = maxWidth
      height = Math.floor(height * scale)
    }

    canvas.width = width
    canvas.height = height
    context.drawImage(video, 0, 0, width, height)

    const img = new Image()
    img.onload = async () => {
      try {
        const processedBlob = await removeBackground(img)
        handleFile(new File([processedBlob], 'photo.png', { type: 'image/png' }))
        handleCloseCamera()
      } catch (error) {
        console.error('Photo processing failed:', error)
        canvas.toBlob((blob) => {
          if (blob) {
            handleFile(new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
            handleCloseCamera()
          } else {
            setUploadError('拍照处理失败，请重试')
          }
        }, 'image/jpeg', 0.9)
      }
    }
    img.onerror = () => {
      canvas.toBlob((blob) => {
        if (blob) {
          handleFile(new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
          handleCloseCamera()
        } else {
          setUploadError('拍照处理失败，请重试')
        }
      }, 'image/jpeg', 0.9)
    }

    canvas.toBlob((blob) => {
      if (blob) {
        img.src = URL.createObjectURL(blob)
      }
    }, 'image/jpeg', 0.9)
  }

  const handleImageMouseDown = (event: React.MouseEvent) => {
    event.preventDefault()
    isDraggingImageRef.current = true
    dragStartRef.current = {
      x: event.clientX - positionRef.current.x,
      y: event.clientY - positionRef.current.y
    }
    setIsImageDragging(true)
  }

  const handleImageTouchStart = (event: React.TouchEvent) => {
    event.preventDefault()
    isDraggingImageRef.current = true
    const touch = event.touches[0]
    dragStartRef.current = {
      x: touch.clientX - positionRef.current.x,
      y: touch.clientY - positionRef.current.y
    }
    setIsImageDragging(true)
  }

  const sendHttpImage = (file: File) => {
    const ip = wsIp.trim()
    if (!ip) return

    saveLastWsIp(ip)
    const formData = new FormData()
    formData.append('image', file)

    if (!isDirectMode && audioRecorded && audioBlob) {
      formData.append('audio', new File([audioBlob], 'recording.wav', { type: 'audio/wav' }))
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `http://${ip}:${uploadPort}`, true)
    xhr.send(formData)
  }

  const cacheAndFinish = async (blob: Blob, name: string, url: string) => {
    if (shouldCacheArtwork) {
      await saveThumbnailForObject(wsIp.trim(), selectedObjectIndex, url, name, blob)
    }

    onUploadSuccess({ name, url })
  }

  const handleScreenshotAndUpload = async () => {
    if (!previewUrl) return

    setIsUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    try {
      const container = alignmentContainerRef.current
      if (!container) throw new Error('找不到遮罩对齐容器')

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight
      const screenshotCanvas = document.createElement('canvas')
      const ctx = screenshotCanvas.getContext('2d')
      if (!ctx) throw new Error('无法创建 Canvas')

      screenshotCanvas.width = containerWidth
      screenshotCanvas.height = containerHeight

      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = previewUrl
      })

      let drawWidth = img.width
      let drawHeight = img.height
      if (drawWidth > containerWidth || drawHeight > containerHeight) {
        const scale = Math.min(containerWidth / drawWidth, containerHeight / drawHeight)
        drawWidth = Math.round(img.width * scale)
        drawHeight = Math.round(img.height * scale)
      }

      const centerX = (containerWidth - drawWidth) / 2
      const centerY = (containerHeight - drawHeight) / 2
      ctx.drawImage(img, centerX + imagePosition.x, centerY + imagePosition.y, drawWidth, drawHeight)

      if (selectedMaskOption?.src) {
        const maskImg = new Image()
        maskImg.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
          maskImg.onload = () => resolve()
          maskImg.onerror = reject
          maskImg.src = selectedMaskOption.src ?? ''
        })

        const maskScale = Math.max(containerWidth / maskImg.width, containerHeight / maskImg.height)
        const maskDrawWidth = maskImg.width * maskScale
        const maskDrawHeight = maskImg.height * maskScale
        const maskOffsetX = (containerWidth - maskDrawWidth) / 2
        const maskOffsetY = (containerHeight - maskDrawHeight) / 2

        ctx.globalCompositeOperation = 'destination-out'
        ctx.drawImage(maskImg, maskOffsetX, maskOffsetY, maskDrawWidth, maskDrawHeight)
        ctx.globalCompositeOperation = 'source-over'
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        screenshotCanvas.toBlob((nextBlob) => resolve(nextBlob), 'image/png')
      })
      if (!blob) throw new Error('截图生成失败')

      const processedName = `${selectedFile?.name.replace(/\.[^/.]+$/, '') || 'processed_image'}.png`
      const processedFile = new File([blob], processedName, { type: 'image/png' })

      if (enableSupabaseUpload) {
        const formData = new FormData()
        formData.append('file', processedFile)
        formData.append('questionId', '752d87b3-5f33-4097-ae16-c99eabed2e86')
        formData.append('name', selectedName)

        const response = await axios.post(
          'https://lmlzavksopdunbpckaqh.supabase.co/functions/v1/gallery-upload',
          formData
        )

        if (!response.data?.media_url) {
          throw new Error('Supabase 未返回 media_url')
        }

        if (shouldCacheArtwork) {
          await saveThumbnailForObject(wsIp.trim(), selectedObjectIndex, response.data.media_url, processedName)
        }
        onUploadSuccess({ name: processedName, url: response.data.media_url })
      }

      sendHttpImage(processedFile)

      if (!enableSupabaseUpload) {
        setUploadSuccess('已发送到 Unity')
        await cacheAndFinish(blob, processedName, URL.createObjectURL(blob))
      }
    } catch (error) {
      console.error('Screenshot upload failed:', error)
      setUploadError('上传失败，请检查图片、遮罩或网络连接')
    } finally {
      setIsUploading(false)
      setShowMaskPanel(false)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    try {
      if (enableSupabaseUpload) {
        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('questionId', '752d87b3-5f33-4097-ae16-c99eabed2e86')
        formData.append('name', selectedName)

        const response = await axios.post(
          'https://lmlzavksopdunbpckaqh.supabase.co/functions/v1/gallery-upload',
          formData
        )

        if (!response.data?.media_url) {
          throw new Error('Supabase 未返回 media_url')
        }

        if (shouldCacheArtwork) {
          await saveThumbnailForObject(wsIp.trim(), selectedObjectIndex, response.data.media_url, selectedFile.name)
        }
        onUploadSuccess({ name: selectedFile.name, url: response.data.media_url })
      }

      sendHttpImage(selectedFile)

      if (!enableSupabaseUpload) {
        setUploadSuccess('已发送到 Unity')
        await cacheAndFinish(selectedFile, selectedFile.name, URL.createObjectURL(selectedFile))
      }
    } catch (error) {
      console.error('Upload failed:', error)
      setUploadError('上传失败，请检查 Unity IP 或网络连接')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <main className="ipad-screen upload-screen apple-container">
      <header className="ipad-topbar">
        <div className="topbar-title-row">
          <button type="button" onClick={onBackToHome} className="ipad-button ghost-button">
            返回
          </button>
          <div className="min-w-0">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="screen-title">{title}</h1>
          </div>
        </div>

        <div className="topbar-controls">
          <div className="ip-control">
            <span className="control-label">HTTP</span>
            <input
              type="text"
              value={wsIp}
              onChange={(event) => onWsIpChange(event.target.value)}
              className="ipad-input ip-input"
              placeholder="Unity IP"
            />
            <span className="port-chip">:{uploadPort}</span>
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
            <button type="button" onClick={handleCloseCamera} className="ipad-button secondary-button">
              关闭
            </button>
            <button type="button" onClick={handleTakePhoto} className="ipad-button primary-button">
              拍摄
            </button>
          </div>
        </section>
      ) : showMaskPanel && previewUrl ? (
        <section className="upload-workspace mask-workspace">
          <div className="mask-canvas-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Mask Alignment</p>
                <h2>{isDirectMode ? '选择快速上传遮罩' : '调整作品与遮罩'}</h2>
              </div>
              <span className="status-pill">{selectedFileName}</span>
            </div>

            <div ref={alignmentContainerRef} className="mask-stage">
              <img
                src={previewUrl}
                alt="上传预览"
                className="mask-source-image"
                style={{
                  transform: `translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                  zIndex: 1
                }}
                onMouseDown={handleImageMouseDown}
                onTouchStart={handleImageTouchStart}
              />

              {selectedMaskOption?.src && (
                <img
                  src={selectedMaskOption.src}
                  alt={`遮罩 ${selectedMaskOption.label}`}
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
                {activeMaskOptions.map((maskOption) => (
                  <button
                    key={maskOption.id}
                    type="button"
                    onClick={() => setSelectedMask(maskOption.id)}
                    className={`mask-option ${selectedMask === maskOption.id ? 'active' : ''}`}
                  >
                    {maskOption.label}
                  </button>
                ))}
              </div>
            </section>

            {!isDirectMode && (
              <section className="rail-section">
                <p className="eyebrow">Audio</p>
                {audioStatus && (
                  <p className={`rail-status ${audioStatus.includes('失败') ? 'error' : 'success'}`}>
                    {audioStatus}
                  </p>
                )}
                {audioRecorded && !audioStatus.includes('失败') && (
                  <p className="rail-status success">已录制音频</p>
                )}
                <div className="rail-two-buttons">
                  <button
                    type="button"
                    onClick={startAudioRecording}
                    disabled={isRecording}
                    className="ipad-button secondary-button"
                  >
                    {isRecording ? '录制中' : '录音'}
                  </button>
                  <button
                    type="button"
                    onClick={stopAudioRecording}
                    disabled={!isRecording}
                    className="ipad-button secondary-button"
                  >
                    停止
                  </button>
                </div>
              </section>
            )}

            <button
              type="button"
              onClick={handleScreenshotAndUpload}
              disabled={isUploading}
              className="ipad-button primary-button send-button"
            >
              {isUploading ? '发送中' : submitLabel}
            </button>
          </aside>
        </section>
      ) : previewUrl ? (
        <section className="upload-workspace preview-workspace">
          <div className="preview-panel">
            <img src={previewUrl} alt="预览" className="preview-image" />
          </div>
          <aside className="upload-rail">
            <section className="rail-section">
              <p className="eyebrow">Preview</p>
              <h2>{selectedFileName}</h2>
            </section>
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="ipad-button primary-button send-button"
            >
              {isUploading ? '发送中' : submitLabel}
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="ipad-button secondary-button">
              重新选择
            </button>
          </aside>
        </section>
      ) : (
        <section className="upload-workspace import-workspace">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`import-dropzone ${isDragging ? 'is-dragging' : ''}`}
          >
            <span className="import-plus">+</span>
            <strong>{isDirectMode ? '选择快速上传图片' : '选择作品图片'}</strong>
            <span>JPEG / PNG / GIF / WebP</span>
          </button>

          <div className="capture-panel">
            <video src="people.mp4" autoPlay loop muted playsInline className="capture-video" />
            <div className="capture-content">
              <p className="eyebrow light">Camera</p>
              <h2>{isDirectMode ? '快速拍照上传' : '拍摄作品'}</h2>
              <button type="button" onClick={handleOpenCamera} className="hidden">
                打开相机
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

export default UploadPage
