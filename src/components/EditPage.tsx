import { useState, useRef } from 'react'
import { useDrag } from 'react-use-gesture'

interface EditPageProps {
  imageData: { name: string; url: string }
  wsIp: string
  selectedName: string
  onBackToUpload: () => void
  onResetUpload: () => void
}

const EditPage: React.FC<EditPageProps> = ({ imageData, wsIp, selectedName, onBackToUpload, onResetUpload }) => {
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 })
  const [scale, setScale] = useState(1)
  const [animationId, setAnimationId] = useState(0)
  const [gridIndex, setGridIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isReleased, setIsReleased] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

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
    
    try {
      // 发送HTTP POST请求
      const url = `http://${wsIp}:8080`
      console.log('Sending HTTP POST message to:', url, 'Message:', message)
      
      const response = await fetch(url, {
        method: 'POST',
        body: message,
        headers: {
          'Content-Type': 'text/plain'
        }
      })
      
      if (response.ok) {
        console.log('HTTP POST message sent successfully:', message)
      } else {
        console.error('HTTP POST message failed with status:', response.status)
      }
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
      // 拖放结束后发送网格索引
      sendHttpMessage(gridIndex.toString())
    }
  })

  // 缩放处理（滑动条）
  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReleased) return // 释放后禁用缩放功能
    const newScale = parseFloat(e.target.value)
    setScale(newScale)
    // 发送缩放值
    sendHttpMessage(`${imageData.name}_Scale:${newScale.toFixed(1)}`)
  }

  // 动画选择处理
  const handleAnimationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAnimationId = parseInt(e.target.value)
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
    if (isReleased) return // 释放后禁用重置功能
    setPosition({ x: 0.5, y: 0.5 })
    const newGridIndex = calculateGridIndex(0.5, 0.5)
    setGridIndex(newGridIndex)
    sendHttpMessage(newGridIndex.toString())
  }

  // 重设缩放
  const handleResetScale = () => {
    if (isReleased) return // 释放后禁用重置功能
    setScale(1)
    sendHttpMessage(`${imageData.name}_Scale:1`)
  }

  // 合并所有手势绑定（仅在未释放时有效）
  const bind = isReleased ? {} : { ...dragBind() }

  return (
    <div className="min-h-screen edit-background apple-container">
      <div className="container mx-auto px-6 py-20 max-w-4xl">
        <h1 className="text-5xl font-bold text-gray-900 mb-8 text-center apple-title">圖片編輯</h1>

      {/* HTTP 通訊設置 */}
      <div className="mb-16">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-700">HTTP 通訊設置</h2>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          伺服器 IP: {wsIp}:8080
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium apple-status-info">
            HTTP 模式
          </span>
        </div>
      </div>

      {/* 網格定位區 */}
      <div className="mb-16">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">網格定位區</h2>
        <div 
          ref={containerRef}
          className="grid-container rounded-xl overflow-hidden relative apple-card"
        >
          {/* 背景影片 */}
          {selectedName === 'fish' && (
            <video
              src="fish.mp4"
              autoPlay
              loop
              muted
              className="absolute inset-0 w-full h-full object-cover z-0"
            />
          )}
          {selectedName === 'people' && (
            <video
              src="people.mp4"
              autoPlay
              loop
              muted
              className="absolute inset-0 w-full h-full object-cover z-0"
            />
          )}
          
          {/* 網格背景已在 CSS 中定義 */}
          
          {/* 可拖放的圖片 */}
          <img
            ref={imageRef}
            src={imageData.url}
            alt="編輯中"
            className="draggable-image"
            style={{
              left: `${position.x * 100}%`,
              top: `${position.y * 100}%`,
              transform: `translate(-50%, -50%) scale(${scale}) ${isFlipped ? 'scaleX(-1)' : ''}`,
              maxWidth: '80%',
              maxHeight: '80%',
              zIndex: 10,
            }}
            {...bind}
          />
          
          {/* 拖放覆蓋層 */}
          <div className="drag-overlay" {...bind}></div>
        </div>
        <div className="mt-4 text-center">
          <span className="text-lg font-medium text-gray-700">當前網格索引：</span>
          <span className="text-xl font-bold text-blue-600">{gridIndex}</span>
        </div>
      </div>

      {/* 圖片縮放控制 */}
      <div className="mb-16">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">圖片縮放</h2>
        <div className="apple-card">
          <div className="flex items-center justify-between">
            <span className="text-lg text-gray-700">當前縮放比例：</span>
            <span className="text-xl font-bold text-blue-600">{scale.toFixed(1)}x</span>
          </div>
          <div className="mt-4">
            <input
              type="range"
              min="0.1"
              max="3.0"
              step="0.1"
              value={scale}
              onChange={handleScaleChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer apple-slider disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isReleased}
            />
            <div className="mt-2 text-sm text-gray-500">
              <p>縮放範圍：0.1 ~ 3.0</p>
            </div>
          </div>
        </div>
      </div>

      {/* 動畫選擇 */}
      <div className="mb-16">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">動畫效果選擇</h2>
        <div className="apple-card">
          <div className="flex items-center">
            <label htmlFor="animation" className="mr-4 text-lg text-gray-700">選擇動畫編號：</label>
            <select
              id="animation"
              value={animationId}
              onChange={handleAnimationChange}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 apple-select"
              disabled={isReleased}
            >
              {Array.from({ length: 10 }, (_, i) => i).map((id) => (
                <option key={id} value={id} className="bg-white text-gray-900">
                  {id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 圖片控制選項 */}
      <div className="mb-16">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">圖片控制選項</h2>
        <div className="apple-card p-6">
          <div className="flex flex-col md:flex-row gap-8">
            {/* 水平翻轉勾選框 */}
            <div className="flex items-center">
              <input
                id="flip"
                type="checkbox"
                checked={isFlipped}
                onChange={handleFlipChange}
                className="w-5 h-5 rounded text-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isReleased}
              />
              <label htmlFor="flip" className="ml-3 text-lg text-gray-700">
                水平翻轉
              </label>
            </div>

            {/* 釋放圖片勾選框 */}
            <div className="flex items-center">
              <input
                id="release"
                type="checkbox"
                checked={isReleased}
                onChange={handleReleaseChange}
                className="w-5 h-5 rounded text-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isReleased}
              />
              <label htmlFor="release" className="ml-3 text-lg text-gray-700">
                釋放圖片物件
              </label>
            </div>
          </div>

          {/* 釋放提示文字 */}
          {isReleased && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-sm text-red-500">
                你已經釋放圖片物件，無法再對該圖片物件進行操控，請重新上傳
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 流程控制按鈕 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <button
          onClick={onBackToUpload}
          className="px-6 py-3 text-lg font-medium rounded-xl transition-all apple-button-secondary"
        >
          返回拍攝頁
        </button>
        <button
          onClick={onResetUpload}
          className="px-6 py-3 text-lg font-medium rounded-xl transition-all apple-button-danger"
        >
          重新上載
        </button>
      </div>

      {/* 額外輔助按鈕 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={handleResetPosition}
          className="px-6 py-3 text-lg font-medium rounded-xl transition-all apple-button-secondary"
        >
          重設位置
        </button>
        <button
          onClick={handleResetScale}
          className="px-6 py-3 text-lg font-medium rounded-xl transition-all apple-button-secondary"
        >
          重設縮放
        </button>
      </div>
    </div>
  </div>
  )
}

export default EditPage