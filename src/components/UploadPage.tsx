import { useEffect, useRef, useState, type CSSProperties } from 'react'
import axios from 'axios'
import { saveArtworkToIp, saveThumbnailToIp } from '../services/artworkStorage.ts'
import { saveLastWsIp } from '../services/appSettings.ts'
import { CONTROL_PORT } from '../services/networkConfig.ts'
import type { UploadMaskOption } from '../services/directUploadThemes.ts'

type UploadMode = 'control' | 'direct'
type ImageGestureMode = 'none' | 'drag' | 'pinch'

interface Point {
  x: number
  y: number
}

const MIN_UPLOAD_SCALE = 0.4
const MAX_UPLOAD_SCALE = 4

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const getDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

const CONTROL_MASK_OPTIONS: UploadMaskOption[] = [
  { id: '0', label: '無' },
  { id: '1', label: '1', src: '/MaskTexture/Mask1.png' },
  { id: '2', label: '2', src: '/MaskTexture/Mask2.png' },
  { id: '3', label: '3', src: '/MaskTexture/Mask3.png' },
  { id: '4', label: '4', src: '/MaskTexture/Mask4.png' },
  { id: '5', label: '5', src: '/MaskTexture/Mask5.png' }
]

const DIRECT_FALLBACK_MASK_OPTIONS: UploadMaskOption[] = [
  { id: 'C-01', label: 'C-01', src: '/Mask/C-01.png' }
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
  maskOptions?: UploadMaskOption[]
  directThemeName?: string
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
          // Ignore cache failures; sending should not be blocked by local preview storage.
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
  shouldCacheArtwork = true,
  maskOptions,
  directThemeName
}) => {
  const isDirectMode = mode === 'direct'
  const activeMaskOptions = isDirectMode ? (maskOptions?.length ? maskOptions : DIRECT_FALLBACK_MASK_OPTIONS) : CONTROL_MASK_OPTIONS
  const defaultMaskId = activeMaskOptions[0]?.id ?? '0'

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showMaskPanel, setShowMaskPanel] = useState(false)
  const [selectedMask, setSelectedMask] = useState(defaultMaskId)
  const [directMaskAspectRatio, setDirectMaskAspectRatio] = useState<number | null>(null)
  const [directStageSize, setDirectStageSize] = useState<{ width: number; height: number } | null>(null)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [imageScale, setImageScale] = useState(1)
  const [, setImageDimensions] = useState({ width: 0, height: 0 })
  const [isRecording, setIsRecording] = useState(false)
  const [audioRecorded, setAudioRecorded] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioStatus, setAudioStatus] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stageShellRef = useRef<HTMLDivElement>(null)
  const alignmentContainerRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef({ x: 0, y: 0 })
  const imageScaleRef = useRef(1)
  const pointersRef = useRef<Map<number, Point>>(new Map())
  const gestureModeRef = useRef<ImageGestureMode>('none')
  const dragStartRef = useRef<{ pointerId: number; point: Point; position: Point } | null>(null)
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const selectedMaskOption = activeMaskOptions.find((option) => option.id === selectedMask) ?? activeMaskOptions[0]
  const selectedFileName = selectedFile?.name ?? '未選擇檔案'
  const uploadModeLabel = isDirectMode ? `HTTP :${uploadPort}` : enableSupabaseUpload ? 'Supabase + HTTP' : 'HTTP 直送'
  const title = isDirectMode ? (directThemeName ?? '快速拍照上載') : '上載作品'
  const eyebrow = isDirectMode ? '快速上載' : `槽位 ${selectedObjectIndex}`
  const submitLabel = isDirectMode ? '發送快速上載' : '發送到藝術畫廊'
  const directStageStyle = isDirectMode
    ? ({
        '--mask-aspect-ratio': directMaskAspectRatio ?? 1.414,
        ...(directStageSize
          ? {
              width: `${directStageSize.width}px`,
              height: `${directStageSize.height}px`
            }
          : {})
      } as CSSProperties)
    : undefined

  useEffect(() => {
    setSelectedMask(defaultMaskId)
  }, [defaultMaskId])

  useEffect(() => {
    imageScaleRef.current = imageScale
  }, [imageScale])

  useEffect(() => {
    if (!isDirectMode || !selectedMaskOption?.src) {
      setDirectMaskAspectRatio(null)
      return
    }

    let cancelled = false
    const maskImg = new Image()

    maskImg.onload = () => {
      if (cancelled || !maskImg.naturalWidth || !maskImg.naturalHeight) return
      setDirectMaskAspectRatio(maskImg.naturalWidth / maskImg.naturalHeight)
    }

    maskImg.onerror = () => {
      if (!cancelled) setDirectMaskAspectRatio(null)
    }

    maskImg.src = selectedMaskOption.src

    return () => {
      cancelled = true
    }
  }, [isDirectMode, selectedMaskOption?.src])

  useEffect(() => {
    if (!isDirectMode || !directMaskAspectRatio) {
      setDirectStageSize(null)
      return
    }

    const shell = stageShellRef.current
    if (!shell) {
      setDirectStageSize(null)
      return
    }

    const updateStageSize = () => {
      const rect = shell.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      let width = rect.width
      let height = width / directMaskAspectRatio

      if (height > rect.height) {
        height = rect.height
        width = height * directMaskAspectRatio
      }

      const nextSize = {
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height))
      }

      setDirectStageSize((currentSize) => {
        if (currentSize?.width === nextSize.width && currentSize.height === nextSize.height) {
          return currentSize
        }
        return nextSize
      })
    }

    updateStageSize()

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateStageSize) : null
    resizeObserver?.observe(shell)
    window.addEventListener('resize', updateStageSize)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateStageSize)
    }
  }, [isDirectMode, directMaskAspectRatio, showMaskPanel, previewUrl])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

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

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        setAudioBlob(blob)
        setAudioRecorded(true)
        setAudioStatus('錄製完成，可發往藝術畫廊')
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
    } catch (error) {
      console.error('Audio recording failed:', error)
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
      setUploadError('不支援的檔案類型，請選擇 JPEG / PNG / GIF / WebP')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('檔案過大，請選擇 10MB 以內的圖片')
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
        imageScaleRef.current = 1
        setImageScale(1)
        pointersRef.current.clear()
      }
      img.onerror = () => {
        setSelectedFile(file)
        setPreviewUrl(result)
        setImageDimensions({ width: 0, height: 0 })
        setShowMaskPanel(true)
        positionRef.current = { x: 0, y: 0 }
        setImagePosition({ x: 0, y: 0 })
        imageScaleRef.current = 1
        setImageScale(1)
        pointersRef.current.clear()
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
      setUploadError('打開相機失敗，請檢查相機權限')
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
            setUploadError('拍照處理失敗，請重試')
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
          setUploadError('拍照處理失敗，請重試')
        }
      }, 'image/jpeg', 0.9)
    }

    canvas.toBlob((blob) => {
      if (blob) {
        img.src = URL.createObjectURL(blob)
      }
    }, 'image/jpeg', 0.9)
  }

  const clampImagePosition = (nextPosition: Point, nextScale = imageScaleRef.current) => {
    const container = alignmentContainerRef.current
    const image = container?.querySelector('.mask-source-image') as HTMLImageElement | null
    if (!container || !image) return nextPosition

    const overflowX = Math.max((image.offsetWidth * nextScale - container.clientWidth) / 2, 0)
    const overflowY = Math.max((image.offsetHeight * nextScale - container.clientHeight) / 2, 0)

    return {
      x: overflowX > 0 ? clamp(nextPosition.x, -overflowX, overflowX) : nextPosition.x,
      y: overflowY > 0 ? clamp(nextPosition.y, -overflowY, overflowY) : nextPosition.y
    }
  }

  const applyImagePosition = (nextPosition: Point, nextScale = imageScaleRef.current) => {
    const clampedPosition = clampImagePosition(nextPosition, nextScale)
    positionRef.current = clampedPosition
    setImagePosition(clampedPosition)
  }

  const applyImageScale = (nextScale: number) => {
    const clampedScale = clamp(nextScale, MIN_UPLOAD_SCALE, MAX_UPLOAD_SCALE)
    imageScaleRef.current = clampedScale
    setImageScale(clampedScale)
    applyImagePosition(positionRef.current, clampedScale)
  }

  const handleImagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!previewUrl) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    const point = { x: event.clientX, y: event.clientY }
    pointersRef.current.set(event.pointerId, point)

    if (pointersRef.current.size === 1) {
      gestureModeRef.current = 'drag'
      dragStartRef.current = {
        pointerId: event.pointerId,
        point,
        position: positionRef.current
      }
      pinchStartRef.current = null
      return
    }

    if (pointersRef.current.size === 2) {
      const [firstPoint, secondPoint] = Array.from(pointersRef.current.values())
      gestureModeRef.current = 'pinch'
      pinchStartRef.current = {
        distance: Math.max(getDistance(firstPoint, secondPoint), 1),
        scale: imageScaleRef.current
      }
      dragStartRef.current = null
    }
  }

  const handleImagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return

    event.preventDefault()
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (gestureModeRef.current === 'drag' && dragStartRef.current && pointersRef.current.size === 1) {
      const dx = event.clientX - dragStartRef.current.point.x
      const dy = event.clientY - dragStartRef.current.point.y
      applyImagePosition({
        x: dragStartRef.current.position.x + dx,
        y: dragStartRef.current.position.y + dy
      })
      return
    }

    if (gestureModeRef.current === 'pinch' && pinchStartRef.current && pointersRef.current.size >= 2) {
      const [firstPoint, secondPoint] = Array.from(pointersRef.current.values())
      const nextDistance = Math.max(getDistance(firstPoint, secondPoint), 1)
      applyImageScale(pinchStartRef.current.scale * (nextDistance / pinchStartRef.current.distance))
    }
  }

  const handleImagePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.delete(event.pointerId)
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture can already be released by the WebView.
    }

    if (pointersRef.current.size === 0) {
      gestureModeRef.current = 'none'
      dragStartRef.current = null
      pinchStartRef.current = null
      return
    }

    if (pointersRef.current.size === 1) {
      const [remainingPoint] = Array.from(pointersRef.current.values())
      gestureModeRef.current = 'drag'
      dragStartRef.current = {
        pointerId: Array.from(pointersRef.current.keys())[0],
        point: remainingPoint,
        position: positionRef.current
      }
      pinchStartRef.current = null
    }
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
      if (!container) throw new Error('找不到遮罩對齊容器')

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight
      const screenshotCanvas = document.createElement('canvas')
      const ctx = screenshotCanvas.getContext('2d')
      if (!ctx) throw new Error('無法建立 Canvas')

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
      const scaledDrawWidth = drawWidth * imageScaleRef.current
      const scaledDrawHeight = drawHeight * imageScaleRef.current
      ctx.drawImage(
        img,
        centerX + positionRef.current.x - (scaledDrawWidth - drawWidth) / 2,
        centerY + positionRef.current.y - (scaledDrawHeight - drawHeight) / 2,
        scaledDrawWidth,
        scaledDrawHeight
      )

      if (selectedMaskOption?.src) {
        const maskImg = new Image()
        maskImg.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
          maskImg.onload = () => resolve()
          maskImg.onerror = reject
          maskImg.src = selectedMaskOption.src ?? ''
        })

        if (isDirectMode) {
          ctx.globalCompositeOperation = 'source-over'
          ctx.drawImage(maskImg, 0, 0, containerWidth, containerHeight)
        } else {
          const maskScale = Math.max(containerWidth / maskImg.width, containerHeight / maskImg.height)
          const maskDrawWidth = maskImg.width * maskScale
          const maskDrawHeight = maskImg.height * maskScale
          const maskOffsetX = (containerWidth - maskDrawWidth) / 2
          const maskOffsetY = (containerHeight - maskDrawHeight) / 2

          ctx.globalCompositeOperation = 'destination-out'
          ctx.drawImage(maskImg, maskOffsetX, maskOffsetY, maskDrawWidth, maskDrawHeight)
          ctx.globalCompositeOperation = 'source-over'
        }
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        screenshotCanvas.toBlob((nextBlob) => resolve(nextBlob), 'image/png')
      })
      if (!blob) throw new Error('截圖生成失敗')

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
        setUploadSuccess('已發送到藝術畫廊')
        await cacheAndFinish(blob, processedName, URL.createObjectURL(blob))
      }
    } catch (error) {
      console.error('Screenshot upload failed:', error)
      setUploadError('上載失敗，請檢查圖片、遮罩或網路連線')
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
        setUploadSuccess('已發送到藝術畫廊')
        await cacheAndFinish(selectedFile, selectedFile.name, URL.createObjectURL(selectedFile))
      }
    } catch (error) {
      console.error('Upload failed:', error)
      setUploadError('上載失敗，請檢查藝術畫廊 IP 或網路連線')
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
              placeholder="藝術畫廊 IP"
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
              關閉
            </button>
            <button type="button" onClick={handleTakePhoto} className="ipad-button primary-button">
              拍攝
            </button>
          </div>
        </section>
      ) : showMaskPanel && previewUrl ? (
        <section className="upload-workspace mask-workspace">
          <div className="mask-canvas-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">遮罩對齊</p>
                <h2>{isDirectMode ? '選擇快速上載遮罩' : '調整作品與遮罩'}</h2>
              </div>
              <span className="status-pill">{selectedFileName}</span>
            </div>

            <div
              ref={stageShellRef}
              className={`mask-stage-shell ${isDirectMode ? 'direct-mask-stage-shell' : ''}`}
            >
              <div
                ref={alignmentContainerRef}
                className={`mask-stage ${isDirectMode ? 'direct-mask-stage' : ''}`}
                style={directStageStyle}
                onPointerDown={handleImagePointerDown}
                onPointerMove={handleImagePointerMove}
                onPointerUp={handleImagePointerEnd}
                onPointerCancel={handleImagePointerEnd}
                onLostPointerCapture={handleImagePointerEnd}
              >
                <img
                  src={previewUrl}
                  alt="上載預覽"
                  className="mask-source-image"
                  style={{
                    transform: `translate(-50%, -50%) translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
                    zIndex: 1
                  }}
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
          </div>

          <aside className="upload-rail">
            <section className="rail-section">
              <p className="eyebrow">遮罩</p>
              <div className="mask-preview-card">
                {selectedMaskOption?.src ? (
                  <img src={selectedMaskOption.src} alt={`目前遮罩 ${selectedMaskOption.label}`} />
                ) : (
                  <span className="mask-preview-empty">無遮罩</span>
                )}
                <strong>{selectedMaskOption?.label ?? '無'}</strong>
              </div>
              <div className="mask-button-grid">
                {activeMaskOptions.map((maskOption) => (
                  <button
                    key={maskOption.id}
                    type="button"
                    onClick={() => setSelectedMask(maskOption.id)}
                    className={`mask-option ${selectedMask === maskOption.id ? 'active' : ''}`}
                  >
                    {maskOption.src ? (
                      <img src={maskOption.src} alt={`遮罩 ${maskOption.label}`} />
                    ) : (
                      <span className="mask-option-empty">無</span>
                    )}
                    <span>{maskOption.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {!isDirectMode && (
              <section className="rail-section">
                <p className="eyebrow">音訊</p>
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
                    type="button"
                    onClick={startAudioRecording}
                    disabled={isRecording}
                    className="ipad-button secondary-button"
                  >
                    {isRecording ? '錄製中' : '錄音'}
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
              {isUploading ? '發送中' : submitLabel}
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
              <p className="eyebrow">預覽</p>
              <h2>{selectedFileName}</h2>
            </section>
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="ipad-button primary-button send-button"
            >
              {isUploading ? '發送中' : submitLabel}
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="ipad-button secondary-button">
              重新選擇
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
            <strong>{isDirectMode ? '選擇快速上載圖片' : '選擇作品圖片'}</strong>
            <span>JPEG / PNG / GIF / WebP</span>
          </button>

          <div className="capture-panel">
            <video src="people.mp4" autoPlay loop muted playsInline className="capture-video" />
            <div className="capture-content">
              <p className="eyebrow light">相機</p>
              <h2>{isDirectMode ? '快速拍照上載' : '拍攝作品'}</h2>
              <button type="button" onClick={handleOpenCamera} className="hidden">
                打開相機
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

export default UploadPage
