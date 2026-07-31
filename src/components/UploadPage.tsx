import { useEffect, useRef, useState, type CSSProperties } from 'react'
import axios from 'axios'
import { Image as ImageIcon, Zap, ZapOff } from 'lucide-react'
import { saveArtworkToIp, saveThumbnailToIp } from '../services/artworkStorage.ts'
import { saveLastWsIp } from '../services/appSettings.ts'
import { CONTROL_PORT } from '../services/networkConfig.ts'
import type { UploadMaskOption } from '../services/directUploadThemes.ts'
import { playUiSound } from '../services/uiFeedback.ts'

type UploadMode = 'control' | 'direct'
type ImageGestureMode = 'none' | 'drag' | 'pinch'
type DirectMediaSource = 'camera' | 'file'
type DirectUploadPhase = 'idle' | 'focusing' | 'departing' | 'returning'

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }
type TorchConstraintSet = MediaTrackConstraintSet & { torch: boolean }

interface Point {
  x: number
  y: number
}

interface DirectSendGeometry {
  left: number
  top: number
  width: number
  height: number
  targetX: number
  targetY: number
  targetScale: number
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
  openMaskSelector?: boolean
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
  directThemeName,
  openMaskSelector = false
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
  const [showImportMenu, setShowImportMenu] = useState(false)
  const [cameraMaskDrawerOpen, setCameraMaskDrawerOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showMaskPanel, setShowMaskPanel] = useState(() => isDirectMode && openMaskSelector)
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
  const [cameraReady, setCameraReady] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)
  const [cameraFlashVisible, setCameraFlashVisible] = useState(false)
  const [directMediaSource, setDirectMediaSource] = useState<DirectMediaSource>('file')
  const [directUploadPhase, setDirectUploadPhase] = useState<DirectUploadPhase>('idle')
  const [directSendPreviewUrl, setDirectSendPreviewUrl] = useState<string | null>(null)
  const [directSendGeometry, setDirectSendGeometry] = useState<DirectSendGeometry | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stageShellRef = useRef<HTMLDivElement>(null)
  const alignmentContainerRef = useRef<HTMLDivElement>(null)
  const directPreviewImageRef = useRef<HTMLImageElement>(null)
  const positionRef = useRef({ x: 0, y: 0 })
  const imageScaleRef = useRef(1)
  const pointersRef = useRef<Map<number, Point>>(new Map())
  const gestureModeRef = useRef<ImageGestureMode>('none')
  const dragStartRef = useRef<{ pointerId: number; point: Point; position: Point } | null>(null)
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cameraMaskDragRef = useRef<{ startY: number; open: boolean } | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const cameraFlashTimerRef = useRef<number | null>(null)
  const directTransitionTimerRef = useRef<number | null>(null)
  const directTransitionStartedAtRef = useRef(0)
  const directSendPreviewUrlRef = useRef<string | null>(null)

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
  const directSendStyle = directSendGeometry
    ? ({
        '--send-source-left': `${directSendGeometry.left}px`,
        '--send-source-top': `${directSendGeometry.top}px`,
        '--send-source-width': `${directSendGeometry.width}px`,
        '--send-source-height': `${directSendGeometry.height}px`,
        '--send-target-x': `${directSendGeometry.targetX}px`,
        '--send-target-y': `${directSendGeometry.targetY}px`,
        '--send-target-scale': String(directSendGeometry.targetScale)
      } as CSSProperties)
    : undefined

  useEffect(() => {
    setSelectedMask(defaultMaskId)
  }, [defaultMaskId])

  const replaceDirectSendPreview = (nextUrl: string | null) => {
    const previousUrl = directSendPreviewUrlRef.current
    if (previousUrl && previousUrl !== nextUrl) {
      URL.revokeObjectURL(previousUrl)
    }
    directSendPreviewUrlRef.current = nextUrl
    setDirectSendPreviewUrl(nextUrl)
  }

  const getDirectSendGeometry = (): DirectSendGeometry => {
    const source = alignmentContainerRef.current ?? directPreviewImageRef.current
    const sourceRect = source?.getBoundingClientRect()
    const screen = source?.closest<HTMLElement>('.ipad-screen')
    const topbar = screen?.querySelector<HTMLElement>('.ipad-topbar')
    const screenStyle = screen ? window.getComputedStyle(screen) : null
    const paddingLeft = Number.parseFloat(screenStyle?.paddingLeft ?? '') || 24
    const paddingRight = Number.parseFloat(screenStyle?.paddingRight ?? '') || 24
    const paddingBottom = Number.parseFloat(screenStyle?.paddingBottom ?? '') || 22
    const fallbackWidth = Math.min(window.innerWidth * 0.58, 720)
    const width = Math.max(1, sourceRect?.width ?? fallbackWidth)
    const height = Math.max(1, sourceRect?.height ?? fallbackWidth / (directMaskAspectRatio ?? 1.414))
    const left = sourceRect?.left ?? (window.innerWidth - width) / 2
    const top = sourceRect?.top ?? (window.innerHeight - height) / 2

    if (window.innerWidth <= 1080) {
      return { left, top, width, height, targetX: 0, targetY: 0, targetScale: 0.96 }
    }

    const resultSummaryWidth = 340
    const resultGap = 18
    const resultPanelPadding = 18
    const resultBottomReserve = 80
    const resultTop = (topbar?.getBoundingClientRect().bottom ?? 92) + 16
    const resultPanelWidth = Math.max(1, window.innerWidth - paddingLeft - paddingRight - resultSummaryWidth - resultGap)
    const resultPanelHeight = Math.max(1, window.innerHeight - resultTop - paddingBottom - resultBottomReserve)
    const resultInnerWidth = Math.max(1, resultPanelWidth - resultPanelPadding * 2)
    const resultInnerHeight = Math.max(1, resultPanelHeight - resultPanelPadding * 2)
    const targetScale = Math.min(resultInnerWidth / width, resultInnerHeight / height, 1)
    const targetWidth = width * targetScale
    const targetHeight = height * targetScale
    const targetLeft = paddingLeft + resultPanelPadding + (resultInnerWidth - targetWidth) / 2
    const targetTop = resultTop + resultPanelPadding + (resultInnerHeight - targetHeight) / 2

    return {
      left,
      top,
      width,
      height,
      targetX: targetLeft - left,
      targetY: targetTop - top,
      targetScale
    }
  }

  const waitForDirectTransition = (milliseconds: number) => new Promise<void>((resolve) => {
    if (directTransitionTimerRef.current !== null) {
      window.clearTimeout(directTransitionTimerRef.current)
    }
    directTransitionTimerRef.current = window.setTimeout(() => {
      directTransitionTimerRef.current = null
      resolve()
    }, Math.max(0, milliseconds))
  })

  const startDirectSendTransition = () => {
    playUiSound('artwork-send')
    replaceDirectSendPreview(null)
    setDirectSendGeometry(getDirectSendGeometry())
    directTransitionStartedAtRef.current = performance.now()
    setDirectUploadPhase('focusing')
  }

  const finishDirectSendTransition = async () => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const minimumFocusTime = reducedMotion ? 80 : 300
    const departureTime = reducedMotion ? 180 : 700
    const elapsed = performance.now() - directTransitionStartedAtRef.current

    if (elapsed < minimumFocusTime) {
      await waitForDirectTransition(minimumFocusTime - elapsed)
    }

    setDirectUploadPhase('departing')
    await waitForDirectTransition(departureTime)
  }

  const reverseDirectSendTransition = async () => {
    setDirectUploadPhase('returning')
    await waitForDirectTransition(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 240)
  }

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
      if (cameraFlashTimerRef.current !== null) {
        window.clearTimeout(cameraFlashTimerRef.current)
      }
      if (directTransitionTimerRef.current !== null) {
        window.clearTimeout(directTransitionTimerRef.current)
      }
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null

      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    if (!showCamera || !videoRef.current || !cameraStreamRef.current) return

    const video = videoRef.current
    video.srcObject = cameraStreamRef.current
    video.muted = true
    video.playsInline = true

    void video.play()
      .then(() => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
          setCameraReady(true)
        }
      })
      .catch((error) => {
        console.error('Camera preview play failed:', error)
        setUploadError('相機預覽啟動失敗，請檢查相機權限')
      })
  }, [showCamera])

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
    setShowImportMenu(false)
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

  const openFilePicker = () => {
    setShowImportMenu(false)
    fileInputRef.current?.click()
  }

  const requestCameraStream = async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }
        }
      })
    } catch {
      return await navigator.mediaDevices.getUserMedia({ video: true })
    }
  }

  const handleImportClick = () => {
    if (isDirectMode) {
      setShowImportMenu(true)
      return
    }

    openFilePicker()
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

  const handleFile = (file: File, source: DirectMediaSource = 'file') => {
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
    if (isDirectMode) {
      setDirectMediaSource(source)
    }

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
    setShowImportMenu(false)
    setCameraMaskDrawerOpen(isDirectMode && activeMaskOptions.length > 0)
    setUploadError(null)
    setCameraReady(false)
    setTorchSupported(false)
    setTorchEnabled(false)
    setIsTakingPhoto(false)
    setCameraFlashVisible(false)
    try {
      const stream = await requestCameraStream()
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = stream
      const videoTrack = stream.getVideoTracks()[0]
      const capabilities = typeof videoTrack?.getCapabilities === 'function'
        ? videoTrack.getCapabilities() as TorchCapabilities
        : null
      setTorchSupported(Boolean(capabilities?.torch))
      setShowCamera(true)
    } catch (error) {
      console.error('Camera open failed:', error)
      setUploadError('打開相機失敗，請檢查相機權限')
    }
  }

  const handleCloseCamera = () => {
    const stream = (videoRef.current?.srcObject as MediaStream | null) ?? cameraStreamRef.current
    stream?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null

    if (cameraFlashTimerRef.current !== null) {
      window.clearTimeout(cameraFlashTimerRef.current)
      cameraFlashTimerRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setShowCamera(false)
    setCameraMaskDrawerOpen(false)
    setCameraReady(false)
    setTorchSupported(false)
    setTorchEnabled(false)
    setIsTakingPhoto(false)
    setCameraFlashVisible(false)
  }

  const handleCameraReady = () => {
    const video = videoRef.current
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return
    setCameraReady(true)
  }

  const handleToggleTorch = async () => {
    const videoTrack = cameraStreamRef.current?.getVideoTracks()[0]
    if (!videoTrack || !torchSupported) return

    const nextEnabled = !torchEnabled
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: nextEnabled } as TorchConstraintSet]
      })
      setTorchEnabled(nextEnabled)
    } catch (error) {
      console.error('Camera torch toggle failed:', error)
      setTorchEnabled(false)
      setUploadError('此相機暫時無法切換閃光燈')
    }
  }

  const handleCameraMaskDrawerPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    cameraMaskDragRef.current = {
      startY: event.clientY,
      open: cameraMaskDrawerOpen
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleCameraMaskDrawerPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = cameraMaskDragRef.current
    if (!drag) return

    const deltaY = event.clientY - drag.startY
    if (deltaY < -24) {
      setCameraMaskDrawerOpen(true)
    } else if (deltaY > 24) {
      setCameraMaskDrawerOpen(false)
    }
  }

  const handleCameraMaskDrawerPointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = cameraMaskDragRef.current
    cameraMaskDragRef.current = null

    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture can already be released by the WebView.
    }

    if (!drag) return

    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaY) < 10) {
      setCameraMaskDrawerOpen((currentValue) => !currentValue)
    } else {
      setCameraMaskDrawerOpen(deltaY < 0 || (drag.open && deltaY < 28))
    }
  }

  const handleTakePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady || isTakingPhoto) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) return

    setIsTakingPhoto(true)
    setCameraFlashVisible(true)
    playUiSound('shutter')
    if (cameraFlashTimerRef.current !== null) {
      window.clearTimeout(cameraFlashTimerRef.current)
    }
    cameraFlashTimerRef.current = window.setTimeout(() => {
      setCameraFlashVisible(false)
      cameraFlashTimerRef.current = null
    }, 110)

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

    if (isDirectMode) {
      canvas.toBlob((blob) => {
        if (blob) {
          handleFile(new File([blob], 'photo.jpg', { type: 'image/jpeg' }), 'camera')
          handleCloseCamera()
        } else {
          setIsTakingPhoto(false)
          setUploadError('拍照處理失敗，請重試')
        }
      }, 'image/jpeg', 0.92)
      return
    }

    const img = new Image()
    img.onload = async () => {
      try {
        const processedBlob = await removeBackground(img)
        handleFile(new File([processedBlob], 'photo.png', { type: 'image/png' }), 'camera')
        handleCloseCamera()
      } catch (error) {
        console.error('Photo processing failed:', error)
        canvas.toBlob((blob) => {
          if (blob) {
            handleFile(new File([blob], 'photo.jpg', { type: 'image/jpeg' }), 'camera')
            handleCloseCamera()
          } else {
            setIsTakingPhoto(false)
            setUploadError('拍照處理失敗，請重試')
          }
        }, 'image/jpeg', 0.9)
      }
    }
    img.onerror = () => {
      canvas.toBlob((blob) => {
        if (blob) {
          handleFile(new File([blob], 'photo.jpg', { type: 'image/jpeg' }), 'camera')
          handleCloseCamera()
        } else {
          setIsTakingPhoto(false)
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

  const createHttpImageFormData = (file: File) => {
    const formData = new FormData()
    formData.append('image', file)

    if (!isDirectMode && audioRecorded && audioBlob) {
      formData.append('audio', new File([audioBlob], 'recording.wav', { type: 'audio/wav' }))
    }

    return formData
  }

  const sendHttpImage = (file: File) => {
    const ip = wsIp.trim()
    if (!ip) return

    saveLastWsIp(ip)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `http://${ip}:${uploadPort}`, true)
    xhr.send(createHttpImageFormData(file))
  }

  const sendDirectHttpImage = (file: File) => {
    const ip = wsIp.trim()
    if (!ip) throw new Error('Missing interactive art IP')

    saveLastWsIp(ip)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `http://${ip}:${uploadPort}`, true)
    xhr.send(createHttpImageFormData(file))
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
    if (isDirectMode) {
      startDirectSendTransition()
    }

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

      const shouldApplyMaskToExport = Boolean(selectedMaskOption?.src)
      if (shouldApplyMaskToExport) {
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

      const processedPreviewUrl = URL.createObjectURL(blob)
      if (isDirectMode) {
        replaceDirectSendPreview(processedPreviewUrl)
      }

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

      if (isDirectMode) {
        sendDirectHttpImage(processedFile)
        await finishDirectSendTransition()
      } else {
        sendHttpImage(processedFile)
      }

      if (!enableSupabaseUpload) {
        if (!isDirectMode) {
          setUploadSuccess('已發送到藝術畫廊')
        }
        await cacheAndFinish(blob, processedName, isDirectMode ? processedPreviewUrl : URL.createObjectURL(blob))
      }
    } catch (error) {
      console.error('Screenshot upload failed:', error)
      if (isDirectMode) {
        await reverseDirectSendTransition()
        setUploadError('無法完成，請重試。')
      } else {
        setUploadError('上載失敗，請檢查圖片、遮罩或網路連線')
      }
    } finally {
      if (directTransitionTimerRef.current !== null) {
        window.clearTimeout(directTransitionTimerRef.current)
        directTransitionTimerRef.current = null
      }
      setIsUploading(false)
      setDirectUploadPhase('idle')
      setDirectSendGeometry(null)
      if (!isDirectMode) {
        setShowMaskPanel(false)
      }
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadError(null)
    setUploadSuccess(null)
    if (isDirectMode) {
      startDirectSendTransition()
    }

    try {
      let directFilePreviewUrl: string | null = null

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

      if (isDirectMode) {
        directFilePreviewUrl = URL.createObjectURL(selectedFile)
        replaceDirectSendPreview(directFilePreviewUrl)
        sendDirectHttpImage(selectedFile)
        await finishDirectSendTransition()
      } else {
        sendHttpImage(selectedFile)
      }

      if (!enableSupabaseUpload) {
        if (!isDirectMode) {
          setUploadSuccess('已發送到藝術畫廊')
        }
        await cacheAndFinish(
          selectedFile,
          selectedFile.name,
          directFilePreviewUrl ?? URL.createObjectURL(selectedFile)
        )
      }
    } catch (error) {
      console.error('Upload failed:', error)
      if (isDirectMode) {
        await reverseDirectSendTransition()
        setUploadError('無法完成，請重試。')
      } else {
        setUploadError('上載失敗，請檢查藝術畫廊 IP 或網路連線')
      }
    } finally {
      if (directTransitionTimerRef.current !== null) {
        window.clearTimeout(directTransitionTimerRef.current)
        directTransitionTimerRef.current = null
      }
      setIsUploading(false)
      setDirectUploadPhase('idle')
      setDirectSendGeometry(null)
    }
  }

  return (
    <main className={`ipad-screen upload-screen apple-container ${showCamera && isDirectMode ? 'direct-camera-screen' : ''}`}>
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

        {!isDirectMode && (
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
        )}
      </header>

      {(uploadError || uploadSuccess) && (
        <div className={`status-toast ${uploadError ? 'error' : 'success'}`}>
          {uploadError || uploadSuccess}
        </div>
      )}

      {isDirectMode && isUploading && (
        <div
          className={`direct-send-overlay is-${directUploadPhase}`}
          aria-hidden="true"
        >
          <div className="direct-send-scrim" />
          <div className="direct-send-artwork" style={directSendStyle}>
            <div className="direct-send-artwork-frame">
              <img
                src={directSendPreviewUrl ?? previewUrl ?? ''}
                className={`direct-send-artwork-image ${directSendPreviewUrl ? 'is-composited' : 'is-source'}`}
                style={!directSendPreviewUrl
                  ? { transform: `translate(-50%, -50%) translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})` }
                  : undefined}
                alt=""
              />
              {!directSendPreviewUrl && selectedMaskOption?.src && (
                <img
                  src={selectedMaskOption.src}
                  className="direct-send-artwork-mask"
                  alt=""
                />
              )}
              <span className="direct-send-light-sweep" />
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {showImportMenu && isDirectMode && (
        <div className="upload-action-overlay" role="dialog" aria-modal="true" aria-label="選擇上載方式">
          <button
            type="button"
            className="upload-action-scrim"
            onClick={() => setShowImportMenu(false)}
            aria-label="關閉上載方式"
          />
          <div className="upload-action-sheet">
            <button type="button" onClick={openFilePicker} className="upload-action-item">
              相簿
            </button>
            <button type="button" onClick={handleOpenCamera} className="upload-action-item">
              拍照
            </button>
            <button type="button" onClick={openFilePicker} className="upload-action-item">
              選擇檔案
            </button>
          </div>
        </div>
      )}

      {showCamera ? (
        <section className={`camera-workspace ${isDirectMode ? 'direct-camera-workspace' : ''}`}>
          <div className="camera-preview">
            <video
              ref={videoRef}
              className="camera-video"
              autoPlay
              muted
              playsInline
              onLoadedMetadata={handleCameraReady}
              onCanPlay={handleCameraReady}
            />
            {isDirectMode && !cameraReady && (
              <div className="direct-camera-loading" role="status" aria-live="polite">
                <span aria-hidden="true" />
                <strong>正在啟動相機</strong>
              </div>
            )}
            {isDirectMode && <div className={`direct-camera-capture-flash ${cameraFlashVisible ? 'visible' : ''}`} />}
            {isDirectMode && selectedMaskOption?.src && (
              <img
                src={selectedMaskOption.src}
                alt={`遮罩 ${selectedMaskOption.label}`}
                className="camera-mask-overlay"
              />
            )}
            <canvas ref={canvasRef} className="hidden"></canvas>
            {isDirectMode && activeMaskOptions.length > 0 && (
              <>
                {!cameraMaskDrawerOpen && (
                  <button
                    type="button"
                    className="camera-mask-peek"
                    aria-label="上滑選擇遮罩"
                    onPointerDown={handleCameraMaskDrawerPointerDown}
                    onPointerMove={handleCameraMaskDrawerPointerMove}
                    onPointerUp={handleCameraMaskDrawerPointerEnd}
                    onPointerCancel={handleCameraMaskDrawerPointerEnd}
                  >
                    <span />
                  </button>
                )}
                <div className={`camera-mask-drawer ${cameraMaskDrawerOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="camera-mask-drawer-handle"
                    onPointerDown={handleCameraMaskDrawerPointerDown}
                    onPointerMove={handleCameraMaskDrawerPointerMove}
                    onPointerUp={handleCameraMaskDrawerPointerEnd}
                    onPointerCancel={handleCameraMaskDrawerPointerEnd}
                  >
                    <span className="camera-mask-grip" />
                    <strong>{selectedMaskOption?.label ?? '遮罩'}</strong>
                    <span>下滑收起</span>
                  </button>
                  <div className="camera-mask-strip" aria-label="拍照定位遮罩">
                    {activeMaskOptions.map((maskOption) => (
                      <button
                        key={maskOption.id}
                        type="button"
                        onClick={() => setSelectedMask(maskOption.id)}
                        className={`camera-mask-option ${selectedMask === maskOption.id ? 'active' : ''}`}
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
                </div>
              </>
            )}
            {isDirectMode && (
              <div className="direct-camera-controls">
                <button
                  type="button"
                  onClick={handleCloseCamera}
                  className="direct-camera-close"
                  aria-label="關閉相機"
                >
                  <span aria-hidden="true">×</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleTorch()}
                  className={`direct-camera-torch ${torchEnabled ? 'active' : ''}`}
                  disabled={!cameraReady || !torchSupported}
                  aria-label={torchSupported
                    ? (torchEnabled ? '關閉閃光燈' : '開啟閃光燈')
                    : '此相機不支援閃光燈'}
                  aria-pressed={torchEnabled}
                  title={torchSupported ? (torchEnabled ? '關閉閃光燈' : '開啟閃光燈') : '此相機不支援閃光燈'}
                >
                  {torchEnabled ? <Zap aria-hidden="true" /> : <ZapOff aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  className={`direct-camera-shutter ${isTakingPhoto ? 'capturing' : ''}`}
                  disabled={!cameraReady || isTakingPhoto}
                  aria-label="拍照"
                  data-silent="true"
                >
                  <span aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
          {!isDirectMode && (
            <div className="camera-actions">
              <button type="button" onClick={handleCloseCamera} className="ipad-button secondary-button">
                關閉
              </button>
              <button type="button" onClick={handleTakePhoto} className="ipad-button primary-button">
                拍攝
              </button>
            </div>
          )}
        </section>
      ) : showMaskPanel && (previewUrl || (isDirectMode && openMaskSelector)) ? (
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
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="上載預覽"
                    className="mask-source-image"
                    style={{
                      transform: `translate(-50%, -50%) translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
                      zIndex: 1
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="mask-source-placeholder"
                    onClick={handleImportClick}
                  >
                    <ImageIcon aria-hidden="true" />
                    <strong>選擇圖片</strong>
                  </button>
                )}

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

            {previewUrl ? (
              <button
                type="button"
                onClick={handleScreenshotAndUpload}
                disabled={isUploading}
                className="ipad-button primary-button send-button"
                data-silent={isDirectMode ? 'true' : undefined}
              >
                {submitLabel}
              </button>
            ) : isDirectMode ? (
              <button
                type="button"
                onClick={handleImportClick}
                disabled={isUploading}
                className="ipad-button primary-button send-button"
              >
                選擇圖片
              </button>
            ) : null}
            {isDirectMode && previewUrl && (
              <button
                type="button"
                onClick={directMediaSource === 'camera' ? handleOpenCamera : handleImportClick}
                disabled={isUploading}
                className="ipad-button secondary-button"
              >
                {directMediaSource === 'camera' ? '重新拍攝' : '重新選擇'}
              </button>
            )}
          </aside>
        </section>
      ) : previewUrl ? (
        <section className="upload-workspace preview-workspace">
          <div className="preview-panel">
              <img ref={directPreviewImageRef} src={previewUrl} alt="預覽" className="preview-image" />
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
              data-silent={isDirectMode ? 'true' : undefined}
            >
              {submitLabel}
            </button>
            <button type="button" onClick={handleImportClick} className="ipad-button secondary-button">
              重新選擇
            </button>
          </aside>
        </section>
      ) : (
        <section className={`upload-workspace import-workspace ${isDirectMode ? 'direct-import-workspace' : ''}`}>
          <button
            type="button"
            onClick={handleImportClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`import-dropzone ${isDragging ? 'is-dragging' : ''}`}
          >
            <span className="import-plus">+</span>
            <strong>{isDirectMode ? '選擇快速上載圖片' : '選擇作品圖片'}</strong>
            <span>JPEG / PNG / GIF / WebP</span>
          </button>

          {!isDirectMode && (
            <div className="capture-panel">
              <video src="people.mp4" autoPlay loop muted playsInline className="capture-video" />
              <div className="capture-content">
                <p className="eyebrow light">相機</p>
                <h2>拍攝作品</h2>
                <button type="button" onClick={handleOpenCamera} className="hidden">
                  打開相機
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default UploadPage
