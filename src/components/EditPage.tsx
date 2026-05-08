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
    <div className="w-screen h-screen overflow-hidden bg-white flex flex-col p-8">
      <h1 className="text-3xl font-bold text-gray-900 text-center mb-6">圖片編輯</h1>
      
      <div className="flex flex-1 gap-6 min-h-0">
        {/* 左侧：網格定位區 */}
        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">網格定位區</h2>
          <div 
            ref={containerRef}
            className="flex-1 min-h-0 rounded-xl overflow-hidden relative"
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
          <div className="mt-2 text-center text-sm">
            <span className="text-gray-700">當前網格索引：</span>
            <span className="font-bold text-blue-600">{gridIndex}</span>
          </div>
        </div>
        
        {/* 右侧：控制面板 */}
        <div className="w-80 flex flex-col gap-3 flex-shrink-0">
          {/* HTTP 通訊設置 */}
          <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">HTTP 通訊設置</h2>
            <div className="text-xs text-gray-500">
              伺服器 IP: {wsIp}:8080
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
                HTTP 模式
              </span>
            </div>
          </div>
          
          {/* 圖片縮放控制 */}
          <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">圖片縮放</h2>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-700">縮放比例：</span>
              <span className="text-sm font-bold text-blue-600">{scale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="3.0"
              step="0.1"
              value={scale}
              onChange={handleScaleChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isReleased}
            />
            <div className="mt-1 text-xs text-gray-500">
              縮放範圍：0.1 ~ 3.0
            </div>
          </div>
          
          {/* 動畫選擇 */}
          <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">動畫效果選擇</h2>
            <div className="flex items-center">
              <label htmlFor="animation" className="mr-3 text-xs text-gray-700">動畫編號：</label>
              <select
                id="animation"
                value={animationId}
                onChange={handleAnimationChange}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
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
          
          {/* 圖片控制選項 */}
          <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">圖片控制選項</h2>
            <div className="flex flex-col gap-2">
              <div className="flex items-center">
                <input
                  id="flip"
                  type="checkbox"
                  checked={isFlipped}
                  onChange={handleFlipChange}
                  className="w-4 h-4 rounded text-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isReleased}
                />
                <label htmlFor="flip" className="ml-2 text-xs text-gray-700">
                  水平翻轉
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="release"
                  type="checkbox"
                  checked={isReleased}
                  onChange={handleReleaseChange}
                  className="w-4 h-4 rounded text-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isReleased}
                />
                <label htmlFor="release" className="ml-2 text-xs text-gray-700">
                  釋放圖片物件
                </label>
              </div>
              {isReleased && (
                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-xs text-red-500">
                    你已經釋放圖片物件，無法再對該圖片物件進行操控，請重新上傳
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onBackToUpload}
              className="px-3 py-2 text-xs font-medium rounded-xl transition-all bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              返回拍攝頁
            </button>
            <button
              onClick={onResetUpload}
              className="px-3 py-2 text-xs font-medium rounded-xl transition-all bg-red-500 text-white hover:bg-red-600"
            >
              重新上載
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleResetPosition}
              className="px-3 py-2 text-xs font-medium rounded-xl transition-all bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              重設位置
            </button>
            <button
              onClick={handleResetScale}
              className="px-3 py-2 text-xs font-medium rounded-xl transition-all bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              重設縮放
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditPage
