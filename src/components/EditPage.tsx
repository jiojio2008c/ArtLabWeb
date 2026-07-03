import { useState, useRef } from 'react'
import { useDrag } from 'react-use-gesture'

interface EditPageProps {
  imageData: { name: string; url: string }
  wsIp: string
  selectedName: string
  onBackToUpload: () => void
  onResetUpload: () => void
  onBackToHome: () => void
}

type ControlTool = 'scale' | 'animation' | 'scene' | 'object'

const EditPage: React.FC<EditPageProps> = ({ imageData, wsIp, selectedName, onBackToUpload, onResetUpload, onBackToHome }) => {
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 })
  const [scale, setScale] = useState(1)
  const [animationId, setAnimationId] = useState(0)
  const [gridIndex, setGridIndex] = useState(0)
  const [currentBg, setCurrentBg] = useState<string>(selectedName)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isReleased, setIsReleased] = useState(false)
  const [activeTool, setActiveTool] = useState<ControlTool>('scale')
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const lastTapTimeRef = useRef(0)

  // 计算网格索引
  const calculateGridIndex = (x: number, y: number) => {
    // 转换为16x9网格的索引（左下角为0，由左至右、由下至上递增）
    const col = Math.floor(x * 16)
    const row = 8 - Math.floor(y * 9) // 翻转y轴
    return row * 16 + col
  }

  // 发送HTTP POST消息
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

  // 拖放处理
  const dragBind = useDrag(({ down, delta: [mx, my] }) => {
    if (down && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect()

      // 计算移动距离占容器的比例
      const deltaX = mx / containerRect.width
      const deltaY = my / containerRect.height

      // 更新位置
      const newX = Math.max(0, Math.min(1, position.x + deltaX))
      const newY = Math.max(0, Math.min(1, position.y + deltaY))
      setPosition({ x: newX, y: newY })

      // 计算并更新网格索引
      const newGridIndex = calculateGridIndex(newX, newY)
      setGridIndex(newGridIndex)
    } else if (!down) {
      sendHttpMessage(gridIndex.toString())
      if (isReleased) setIsReleased(false)
    }
  })

  // 缩放处理（滑动条）
  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newScale = parseFloat(e.target.value)
    setScale(newScale)
    sendHttpMessage(`${imageData.name}_Scale:${newScale.toFixed(1)}`)
  }

  const handleAnimationSelect = (newAnimationId: number) => {
    setAnimationId(newAnimationId)
    // 发送动画ID
    sendHttpMessage(`${imageData.name}:${newAnimationId}`)
  }

  // 水平翻转处理
  const handleFlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFlipped = e.target.checked
    setIsFlipped(newFlipped)
    // 发送翻转状态
    sendHttpMessage(`${imageData.name}_Flip:${newFlipped}`)
  }

  // 释放图片处理
  const handleReleaseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setIsReleased(true)
      // 发送释放状态
      sendHttpMessage(`${imageData.name}_Release:true`)
    }
  }

  // 重设位置
  const handleResetPosition = () => {
    setPosition({ x: 0.5, y: 0.5 })
    const newGridIndex = calculateGridIndex(0.5, 0.5)
    setGridIndex(newGridIndex)
    sendHttpMessage(newGridIndex.toString())
    if (isReleased) setIsReleased(false)
  }

  const handleResetScale = () => {
    setScale(1)
    sendHttpMessage(`${imageData.name}_Scale:1`)
  }

  const openControlPanel = (tool: ControlTool = activeTool) => {
    setActiveTool(tool)
    setIsControlPanelOpen(true)
  }

  const handleStageDoubleTap = () => {
    openControlPanel('scale')
  }

  const handleStageTouchEnd = () => {
    const now = Date.now()
    if (now - lastTapTimeRef.current < 320) {
      handleStageDoubleTap()
      lastTapTimeRef.current = 0
      return
    }
    lastTapTimeRef.current = now
  }

  // 合并所有手势绑定（仅在未释放时有效）
  const bind = isReleased ? {} : { ...dragBind() }
  const tools: { id: ControlTool; label: string }[] = [
    { id: 'scale', label: '縮放' },
    { id: 'animation', label: '動畫' },
    { id: 'scene', label: '場景' },
    { id: 'object', label: '物件' }
  ]

  return (
    <main className="ipad-screen edit-screen apple-container">
      <header className="ipad-topbar">
        <div className="topbar-title-row">
          <button onClick={onBackToHome} className="ipad-button ghost-button">
            首頁
          </button>
          <div className="min-w-0">
            <p className="eyebrow">Art Lab</p>
            <h1 className="screen-title">作品控制</h1>
          </div>
        </div>

        <div className="edit-status-strip">
          <span className="status-pill">Grid {gridIndex}</span>
          <span className="status-pill">{scale.toFixed(1)}x</span>
          <span className="status-pill">{wsIp}:8080</span>
        </div>
      </header>

      <section className="edit-workspace">
        <div className="edit-stage-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Stage Preview</p>
              <h2>拖動作品定位，雙點開啟工具</h2>
            </div>
            <span className={`status-pill ${isReleased ? 'warning' : ''}`}>
              {isReleased ? '已釋放' : '可控制'}
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
              alt="編輯中"
              className="draggable-image"
              style={{
                left: `${position.x * 100}%`,
                top: `${position.y * 100}%`,
                transform: `translate(-50%, -50%) scale(${scale}) ${isFlipped ? 'scaleX(-1)' : ''}`,
                width: 'min(58vw, 1120px)',
                height: 'auto',
                maxWidth: '80%',
                maxHeight: '80%',
                objectFit: 'contain',
                zIndex: 10,
              }}
              {...bind}
            />

            <div
              className="drag-overlay"
              {...bind}
              onDoubleClick={handleStageDoubleTap}
              onTouchEnd={handleStageTouchEnd}
            ></div>
            {!isControlPanelOpen && (
              <button
                type="button"
                className="stage-tool-hint"
                onClick={() => openControlPanel('scale')}
              >
                雙點作品開啟工具
              </button>
            )}
          </div>
        </div>

        {isControlPanelOpen && (
          <aside className="edit-control-drawer">
            <div className="drawer-heading">
              <div>
                <p className="eyebrow">Tools</p>
                <h2>作品工具</h2>
              </div>
              <button
                type="button"
                className="mini-action-button"
                onClick={() => setIsControlPanelOpen(false)}
              >
                收起
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
                  {tool.label}
                </button>
              ))}
            </div>

            {activeTool === 'scale' && (
              <section className="rail-section">
                <p className="eyebrow">Scale</p>
                <div className="control-row">
                  <strong>{scale.toFixed(1)}x</strong>
                  <button onClick={handleResetScale} className="mini-action-button">
                    重設
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
              </section>
            )}

            {activeTool === 'animation' && (
              <section className="rail-section">
                <p className="eyebrow">Animation</p>
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
              </section>
            )}

            {activeTool === 'scene' && (
              <section className="rail-section">
                <p className="eyebrow">Scene</p>
                <div className="scene-stack">
                  {[
                    { value: 'fish', label: '海底珊瑚' },
                    { value: 'people', label: '動物小鎮' },
                    { value: 'other', label: '空白網格' }
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
                      {scene.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {activeTool === 'object' && (
              <section className="rail-section">
                <p className="eyebrow">Object</p>
                <div className="toggle-stack">
                  <label className="toggle-control wide">
                    <input
                      id="flip"
                      type="checkbox"
                      checked={isFlipped}
                      onChange={handleFlipChange}
                    />
                    <span>水平翻轉</span>
                  </label>
                  <label className="toggle-control wide">
                    <input
                      id="release"
                      type="checkbox"
                      checked={isReleased}
                      onChange={handleReleaseChange}
                    />
                    <span>釋放物件</span>
                  </label>
                </div>
              </section>
            )}
          </aside>
        )}

        <div className="edit-bottom-dock">
          <button type="button" onClick={() => openControlPanel('scale')} className="ipad-button primary-button">
            工具
          </button>
          <button onClick={handleResetPosition} className="ipad-button secondary-button">
            重設位置
          </button>
          <button onClick={onBackToUpload} className="ipad-button secondary-button">
            返回上傳
          </button>
          <button onClick={onResetUpload} className="ipad-button danger-button">
            重新上載
          </button>
        </div>
      </section>
    </main>
  )
}

export default EditPage
