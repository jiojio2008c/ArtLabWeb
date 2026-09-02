import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { removeArtworkFromIp } from '../services/artworkStorage.ts'
import ConfirmActionDialog from './ConfirmActionDialog.tsx'

interface EditPageProps {
  imageData: { name: string; url: string }
  wsIp: string
  selectedName: string
  selectedObjectIndex: number
  onResetUpload: () => void
  onBackToHome: () => void
  onDeleteArtwork: () => void
}

type ControlTool = 'scale' | 'rotate' | 'animation' | 'scene' | 'object'
type GestureMode = 'none' | 'drag' | 'pinch'

interface Point {
  x: number
  y: number
}

const GRID_COLUMNS = 16
const GRID_ROWS = 9
const GRID_SEND_INTERVAL_MS = 90
const SCALE_SEND_INTERVAL_MS = 120
const ROTATE_SEND_INTERVAL_MS = 120
const MIN_SCALE = 0.1
const MAX_SCALE = 3

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const calculateGridIndex = (x: number, y: number) => {
  const col = clamp(Math.floor(x * GRID_COLUMNS), 0, GRID_COLUMNS - 1)
  const row = clamp((GRID_ROWS - 1) - Math.floor(y * GRID_ROWS), 0, GRID_ROWS - 1)
  return row * GRID_COLUMNS + col
}

const getDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const getAngle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI

const normalizeScale = (value: number) => clamp(value, MIN_SCALE, MAX_SCALE)
const normalizeRotation = (value: number) => {
  let nextValue = value % 360
  if (nextValue > 180) nextValue -= 360
  if (nextValue <= -180) nextValue += 360
  return nextValue
}

const EditPage: React.FC<EditPageProps> = ({
  imageData,
  wsIp,
  selectedName,
  selectedObjectIndex,
  onResetUpload,
  onBackToHome,
  onDeleteArtwork
}) => {
  const { t } = useTranslation()
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 })
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [animationId, setAnimationId] = useState(0)
  const [gridIndex, setGridIndex] = useState(() => calculateGridIndex(0.5, 0.5))
  const [currentBg, setCurrentBg] = useState<string>(selectedName)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isReleased, setIsReleased] = useState(false)
  const [activeTool, setActiveTool] = useState<ControlTool>('scale')
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false)
  const [animationPreviewError, setAnimationPreviewError] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeletingArtwork, setIsDeletingArtwork] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const lastTapTimeRef = useRef(0)
  const positionRef = useRef(position)
  const scaleRef = useRef(scale)
  const rotationRef = useRef(rotation)
  const gridIndexRef = useRef(gridIndex)
  const pointersRef = useRef<Map<number, Point>>(new Map())
  const gestureModeRef = useRef<GestureMode>('none')
  const dragStartRef = useRef<{ pointerId: number; point: Point; position: Point } | null>(null)
  const pinchStartRef = useRef<{ distance: number; scale: number; angle: number; rotation: number } | null>(null)
  const didMoveRef = useRef(false)
  const pendingPositionRef = useRef<Point | null>(null)
  const pendingScaleRef = useRef<number | null>(null)
  const pendingRotationRef = useRef<number | null>(null)
  const pendingGridIndexRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastSentGridRef = useRef(gridIndex)
  const lastSentGridAtRef = useRef(0)
  const lastSentScaleValueRef = useRef(scale.toFixed(1))
  const lastSentScaleAtRef = useRef(0)
  const lastSentRotationValueRef = useRef(rotation.toFixed(1))
  const lastSentRotationAtRef = useRef(0)

  // 發送 HTTP POST 訊息
  const sendHttpMessage = async (message: string) => {
    if (!wsIp) return
    
    const url = `http://${wsIp}:8080`
    console.log('Sending HTTP POST message to:', url, 'Message:', message)
    
    try {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url, true)
      xhr.setRequestHeader('Content-Type', 'text/plain')
      xhr.send(message)
    } catch (error: any) {
      console.error('HTTP POST message sending failed:', error)
    }
  }

  const scheduleVisualUpdate = () => {
    if (rafRef.current !== null) return

    rafRef.current = window.requestAnimationFrame(() => {
      if (pendingPositionRef.current) {
        setPosition(pendingPositionRef.current)
        pendingPositionRef.current = null
      }
      if (pendingScaleRef.current !== null) {
        setScale(pendingScaleRef.current)
        pendingScaleRef.current = null
      }
      if (pendingRotationRef.current !== null) {
        setRotation(pendingRotationRef.current)
        pendingRotationRef.current = null
      }
      if (pendingGridIndexRef.current !== null) {
        setGridIndex(pendingGridIndexRef.current)
        pendingGridIndexRef.current = null
      }
      rafRef.current = null
    })
  }

  const sendGridRealtime = (nextGridIndex: number, force = false) => {
    const now = Date.now()
    const hasChanged = nextGridIndex !== lastSentGridRef.current
    const canSend = now - lastSentGridAtRef.current >= GRID_SEND_INTERVAL_MS

    if (force || (hasChanged && canSend)) {
      sendHttpMessage(nextGridIndex.toString())
      lastSentGridRef.current = nextGridIndex
      lastSentGridAtRef.current = now
    }
  }

  const sendScaleRealtime = (nextScale: number, force = false) => {
    const now = Date.now()
    const roundedScale = nextScale.toFixed(1)
    const hasChanged = roundedScale !== lastSentScaleValueRef.current
    const canSend = now - lastSentScaleAtRef.current >= SCALE_SEND_INTERVAL_MS

    if (force || (hasChanged && canSend)) {
      sendHttpMessage(`${imageData.name}_Scale:${roundedScale}`)
      lastSentScaleValueRef.current = roundedScale
      lastSentScaleAtRef.current = now
    }
  }

  const sendRotationRealtime = (nextRotation: number, force = false) => {
    const now = Date.now()
    const roundedRotation = nextRotation.toFixed(1)
    const hasChanged = roundedRotation !== lastSentRotationValueRef.current
    const canSend = now - lastSentRotationAtRef.current >= ROTATE_SEND_INTERVAL_MS

    if (force || (hasChanged && canSend)) {
      sendHttpMessage(`${imageData.name}_Rotate:${roundedRotation}`)
      lastSentRotationValueRef.current = roundedRotation
      lastSentRotationAtRef.current = now
    }
  }

  const applyPosition = (nextPosition: Point, shouldSend = false) => {
    const clampedPosition = {
      x: clamp(nextPosition.x, 0, 1),
      y: clamp(nextPosition.y, 0, 1)
    }
    const nextGridIndex = calculateGridIndex(clampedPosition.x, clampedPosition.y)

    positionRef.current = clampedPosition
    gridIndexRef.current = nextGridIndex
    pendingPositionRef.current = clampedPosition
    pendingGridIndexRef.current = nextGridIndex
    scheduleVisualUpdate()

    if (shouldSend) {
      sendGridRealtime(nextGridIndex)
    }
  }

  const applyScale = (nextScale: number, shouldSend = false, forceSend = false) => {
    const clampedScale = normalizeScale(nextScale)

    scaleRef.current = clampedScale
    pendingScaleRef.current = clampedScale
    scheduleVisualUpdate()

    if (shouldSend) {
      sendScaleRealtime(clampedScale, forceSend)
    }
  }

  const applyRotation = (nextRotation: number, shouldSend = false, forceSend = false) => {
    const normalizedRotation = normalizeRotation(nextRotation)

    rotationRef.current = normalizedRotation
    pendingRotationRef.current = normalizedRotation
    scheduleVisualUpdate()

    if (shouldSend) {
      sendRotationRealtime(normalizedRotation, forceSend)
    }
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  // 縮放處理（滑動條）
  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newScale = parseFloat(e.target.value)
    applyScale(newScale, true)
  }

  const handleScaleNudge = (delta: number) => {
    const nextScale = Math.round((scaleRef.current + delta) * 10) / 10
    applyScale(nextScale, true, true)
  }

  const handleScalePreset = (nextScale: number) => {
    applyScale(nextScale, true, true)
  }

  const handleRotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyRotation(parseFloat(e.target.value), true)
  }

  const handleRotationNudge = (delta: number) => {
    applyRotation(rotationRef.current + delta, true, true)
  }

  const handleRotationPreset = (nextRotation: number) => {
    applyRotation(nextRotation, true, true)
  }

  const handleResetRotation = () => {
    applyRotation(0, true, true)
  }

  const handleAnimationSelect = (newAnimationId: number) => {
    setAnimationId(newAnimationId)
    setAnimationPreviewError(false)
    // 發送動畫 ID
    sendHttpMessage(`${imageData.name}:${newAnimationId}`)
  }

  // 水平翻轉處理
  const handleFlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFlipped = e.target.checked
    setIsFlipped(newFlipped)
    // 發送翻轉狀態
    sendHttpMessage(`${imageData.name}_Flip:${newFlipped}`)
  }

  // 釋放圖片處理
  const handleReleaseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newReleased = e.target.checked
    setIsReleased(newReleased)
    // 發送釋放狀態
    sendHttpMessage(`${imageData.name}_Release:${newReleased}`)
  }

  const handleDeleteArtwork = async (): Promise<boolean> => {
    if (isDeletingArtwork) return false

    setIsDeletingArtwork(true)
    try {
      sendHttpMessage(`GameObjectDelete:${selectedObjectIndex}`)

      const ip = wsIp.trim()
      if (ip) {
        await removeArtworkFromIp(ip, selectedObjectIndex)
      }

      onDeleteArtwork()
      return true
    } catch (error) {
      console.error('Failed to delete artwork:', error)
      window.alert(t('edit.deleteFailed'))
      return false
    } finally {
      setIsDeletingArtwork(false)
    }
  }

  // 重設位置
  const handleResetPosition = () => {
    const centerPosition = { x: 0.5, y: 0.5 }
    applyPosition(centerPosition, false)
    sendGridRealtime(calculateGridIndex(centerPosition.x, centerPosition.y), true)
  }

  const handleResetScale = () => {
    applyScale(1, true, true)
  }

  const openControlPanel = (tool: ControlTool = activeTool) => {
    setActiveTool(tool)
    setIsControlPanelOpen(true)
  }

  const handleStageDoubleTap = () => {
    openControlPanel('scale')
  }

  const handlePotentialTap = () => {
    if (didMoveRef.current) return

    const now = Date.now()
    if (now - lastTapTimeRef.current < 320) {
      handleStageDoubleTap()
      lastTapTimeRef.current = 0
      return
    }
    lastTapTimeRef.current = now
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)

    const point = { x: e.clientX, y: e.clientY }
    pointersRef.current.set(e.pointerId, point)
    didMoveRef.current = false

    if (pointersRef.current.size === 1) {
      gestureModeRef.current = 'drag'
      dragStartRef.current = {
        pointerId: e.pointerId,
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
        scale: scaleRef.current,
        angle: getAngle(firstPoint, secondPoint),
        rotation: rotationRef.current
      }
      dragStartRef.current = null
      didMoveRef.current = true
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return

    e.preventDefault()
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (gestureModeRef.current === 'drag' && dragStartRef.current && pointersRef.current.size === 1) {
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      const dx = e.clientX - dragStartRef.current.point.x
      const dy = e.clientY - dragStartRef.current.point.y
      if (Math.hypot(dx, dy) > 8) {
        didMoveRef.current = true
      }

      applyPosition({
        x: dragStartRef.current.position.x + dx / containerRect.width,
        y: dragStartRef.current.position.y + dy / containerRect.height
      }, true)
      return
    }

    if (gestureModeRef.current === 'pinch' && pinchStartRef.current && pointersRef.current.size >= 2) {
      const [firstPoint, secondPoint] = Array.from(pointersRef.current.values())
      const nextDistance = Math.max(getDistance(firstPoint, secondPoint), 1)
      const nextAngle = getAngle(firstPoint, secondPoint)
      const angleDelta = normalizeRotation(nextAngle - pinchStartRef.current.angle)

      if (Math.abs(nextDistance - pinchStartRef.current.distance) > 4 || Math.abs(angleDelta) > 3) {
        didMoveRef.current = true
      }
      applyScale(pinchStartRef.current.scale * (nextDistance / pinchStartRef.current.distance), true)
      applyRotation(pinchStartRef.current.rotation + angleDelta, true)
    }
  }

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const previousMode = gestureModeRef.current
    const previousPointerCount = pointersRef.current.size

    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.delete(e.pointerId)
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Pointer capture may already be released by the browser.
    }

    if (previousMode === 'drag' && previousPointerCount === 1) {
      sendGridRealtime(gridIndexRef.current, true)
      handlePotentialTap()
    }

    if (previousMode === 'pinch' && previousPointerCount >= 2) {
      sendScaleRealtime(scaleRef.current, true)
      sendRotationRealtime(rotationRef.current, true)
      lastTapTimeRef.current = 0
    }

    if (pointersRef.current.size === 0 || previousMode === 'pinch') {
      gestureModeRef.current = 'none'
      dragStartRef.current = null
      pinchStartRef.current = null
    }
  }

  const tools: { id: ControlTool; labelKey: string }[] = [
    { id: 'scale', labelKey: 'control.scale' },
    { id: 'rotate', labelKey: 'control.rotation' },
    { id: 'animation', labelKey: 'control.animation' },
    { id: 'scene', labelKey: 'edit.scene' },
    { id: 'object', labelKey: 'items.object' }
  ]

  return (
    <main className="ipad-screen edit-screen apple-container">
      <header className="ipad-topbar">
        <div className="topbar-title-row">
          <button onClick={onBackToHome} className="ipad-button ghost-button">
            {t('common.backHome')}
          </button>
          <div className="min-w-0">
            <p className="eyebrow">MagicFloor</p>
            <h1 className="screen-title">{t('edit.title')}</h1>
          </div>
        </div>

        <div className="edit-status-strip">
          <span className="status-pill">{t('edit.gridPosition', { index: gridIndex })}</span>
          <span className="status-pill">{scale.toFixed(1)}x</span>
          <span className="status-pill">{rotation.toFixed(0)}°</span>
          <span className="status-pill">{wsIp}:8080</span>
        </div>
      </header>

      <section className="edit-workspace">
        <div className="edit-stage-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t('edit.stagePreview')}</p>
              <h2>{t('edit.stageHelp')}</h2>
            </div>
            <span className={`status-pill ${isReleased ? 'warning' : ''}`}>
              {isReleased ? t('edit.releaseSignal') : t('edit.controllable')}
            </span>
          </div>

          <div ref={containerRef} className="edit-stage">
            {currentBg === 'fish' && (
              <video
                src="fish.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="stage-video"
              />
            )}
            {currentBg === 'people' && (
              <video
                src="people.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="stage-video"
              />
            )}

            <img
              ref={imageRef}
              src={imageData.url}
              alt={t('edit.editingAlt')}
              draggable={false}
              className="draggable-image"
              style={{
                left: `${position.x * 100}%`,
                top: `${position.y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale}) ${isFlipped ? 'scaleX(-1)' : ''}`,
                width: 'min(58vw, 1120px)',
                height: 'auto',
                maxWidth: '80%',
                maxHeight: '80%',
                objectFit: 'contain',
                zIndex: 10,
              }}
            />

            <div
              className="drag-overlay"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onLostPointerCapture={handlePointerEnd}
            ></div>
          </div>
        </div>

        {isControlPanelOpen && (
          <aside className="edit-control-drawer">
            <div className="drawer-heading">
              <div>
                <p className="eyebrow">{t('edit.tools')}</p>
                <h2>{t('edit.artworkTools')}</h2>
              </div>
              <button
                type="button"
                className="mini-action-button"
                onClick={() => setIsControlPanelOpen(false)}
              >
                {t('edit.collapse')}
              </button>
            </div>

            <div className="tool-tabs">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  className={`tool-tab ${activeTool === tool.id ? 'active' : ''}`}
                >
                  {t(tool.labelKey)}
                </button>
              ))}
            </div>

            {activeTool === 'scale' && (
              <section className="rail-section">
                <p className="eyebrow">{t('control.scale')}</p>
                <div className="control-row">
                  <button type="button" onClick={() => handleScaleNudge(-0.1)} className="scale-step-button">
                    -
                  </button>
                  <strong>{scale.toFixed(1)}x</strong>
                  <button type="button" onClick={() => handleScaleNudge(0.1)} className="scale-step-button">
                    +
                  </button>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={scale}
                  onChange={handleScaleChange}
                  className="ipad-slider"
                />
                <div className="scale-preset-row">
                  {[0.5, 1, 1.5, 2].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleScalePreset(preset)}
                      className={`scale-preset ${scale.toFixed(1) === preset.toFixed(1) ? 'active' : ''}`}
                    >
                      {preset.toFixed(1)}x
                    </button>
                  ))}
                </div>
                <button onClick={handleResetScale} className="ipad-button secondary-button scale-reset-button">
                  {t('edit.resetScale')}
                </button>
              </section>
            )}

            {activeTool === 'rotate' && (
              <section className="rail-section">
                <p className="eyebrow">{t('control.rotation')}</p>
                <div className="control-row">
                  <button type="button" onClick={() => handleRotationNudge(-5)} className="scale-step-button">
                    -
                  </button>
                  <strong>{rotation.toFixed(0)}°</strong>
                  <button type="button" onClick={() => handleRotationNudge(5)} className="scale-step-button">
                    +
                  </button>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={rotation}
                  onChange={handleRotationChange}
                  className="ipad-slider"
                />
                <div className="scale-preset-row">
                  {[-90, 0, 90, 180].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleRotationPreset(preset)}
                      className={`scale-preset ${rotation.toFixed(0) === preset.toFixed(0) ? 'active' : ''}`}
                    >
                      {preset}°
                    </button>
                  ))}
                </div>
                <button onClick={handleResetRotation} className="ipad-button secondary-button scale-reset-button">
                  {t('edit.resetRotation')}
                </button>
              </section>
            )}

            {activeTool === 'animation' && (
              <section className="rail-section">
                <p className="eyebrow">{t('control.animation')}</p>
                <div className="animation-grid">
                  {Array.from({ length: 10 }, (_, i) => i).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`animation-tile ${animationId === id ? 'active' : ''}`}
                      onClick={() => handleAnimationSelect(id)}
                    >
                      {id}
                    </button>
                  ))}
                </div>
                <div className="animation-preview-panel">
                  <div className="animation-preview-frame">
                    {animationPreviewError ? (
                      <div className="animation-preview-empty">
                        GIF {animationId}
                      </div>
                    ) : (
                      <img
                        key={animationId}
                        src={`/animations/${animationId}.gif`}
                        alt={t('edit.animationNumber', { id: animationId })}
                        className="animation-preview-image"
                        onLoad={() => setAnimationPreviewError(false)}
                        onError={() => setAnimationPreviewError(true)}
                      />
                    )}
                  </div>
                  <div className="animation-preview-meta">
                    <span>{t('edit.animationNumber', { id: animationId })}</span>
                    <strong>{animationId}</strong>
                  </div>
                </div>
              </section>
            )}

            {activeTool === 'scene' && (
              <section className="rail-section">
                <p className="eyebrow">{t('edit.scene')}</p>
                <div className="scene-stack">
                  {[
                    { value: 'fish', labelKey: 'edit.sceneCoral' },
                    { value: 'people', labelKey: 'edit.sceneTown' },
                    { value: 'other', labelKey: 'edit.sceneBlank' }
                  ].map((scene) => (
                    <button
                      key={scene.value}
                      type="button"
                      className={`scene-button ${currentBg === scene.value ? 'active' : ''}`}
                      onClick={() => {
                        const bgMap: Record<string, string> = { fish: 'Fish', people: 'People', other: 'Other' }
                        setCurrentBg(scene.value)
                        sendHttpMessage(`Bg:${bgMap[scene.value] || 'Other'}`)
                      }}
                    >
                      {t(scene.labelKey)}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {activeTool === 'object' && (
              <section className="rail-section">
                <p className="eyebrow">{t('items.object')}</p>
                <div className="toggle-stack">
                  <label className="toggle-control wide">
                    <input
                      id="flip"
                      type="checkbox"
                      checked={isFlipped}
                      onChange={handleFlipChange}
                    />
                    <span>{t('control.flipHorizontal')}</span>
                  </label>
                  <label className="toggle-control wide">
                    <input
                      id="release"
                      type="checkbox"
                      checked={isReleased}
                      onChange={handleReleaseChange}
                    />
                    <span>{t('edit.releaseObject')}</span>
                  </label>
                </div>
              </section>
            )}
          </aside>
        )}

        <div className="edit-bottom-dock">
          <button type="button" onClick={() => openControlPanel('scale')} className="ipad-button primary-button">
            {t('edit.tools')}
          </button>
          <button onClick={handleResetPosition} className="ipad-button secondary-button">
            {t('edit.resetPosition')}
          </button>
          <button onClick={onBackToHome} className="ipad-button secondary-button">
            {t('common.backHome')}
          </button>
          <button onClick={onResetUpload} className="ipad-button danger-button">
            {t('edit.uploadAgain')}
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={isDeletingArtwork}
            className="ipad-button danger-button"
          >
            {isDeletingArtwork ? t('groups.deleting') : t('edit.deleteArtwork')}
          </button>
        </div>
      </section>

      {deleteConfirmOpen && (
        <ConfirmActionDialog
          classNamePrefix="edit-artwork-delete-confirm"
          icon={<Trash2 />}
          title={t('edit.confirmDeleteSlot', { index: selectedObjectIndex })}
          cancelLabel={t('common.cancel')}
          confirmLabel={t('common.delete')}
          pendingLabel={t('groups.deleting')}
          pending={isDeletingArtwork}
          tone="danger"
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={handleDeleteArtwork}
        />
      )}
    </main>
  )
}

export default EditPage
