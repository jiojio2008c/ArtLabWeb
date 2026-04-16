import { useState, useRef } from 'react'
import { useDrag, usePinch, useWheel } from 'react-use-gesture'

interface EditPageProps {
  imageData: { name: string; url: string }
  wsIp: string
  onBackToUpload: () => void
  onResetUpload: () => void
}

const EditPage: React.FC<EditPageProps> = ({ imageData, wsIp, onBackToUpload, onResetUpload }) => {
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 })
  const [scale, setScale] = useState(1)
  const [animationId, setAnimationId] = useState(0)
  const [gridIndex, setGridIndex] = useState(0)
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
  const dragBind = useDrag(({ down, movement: [mx, my] }) => {
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

  // 缩放处理（触摸）
  const pinchBind = usePinch(({ down, da, args: [currentScale] }) => {
    if (down) {
      const deltaScale = typeof da === 'number' ? da : 0
      const newScale = Math.max(0.1, Math.min(3, currentScale * (1 + deltaScale * 0.01)))
      setScale(newScale)
    } else {
      // 确保缩放值是有效的数字
      const safeScale = isNaN(scale) ? 1 : scale
      // 缩放结束后发送缩放值
      sendHttpMessage(`${imageData.name}_Scale:${safeScale.toFixed(1)}`)
    }
  })

  // 缩放处理（鼠标滚轮）
  const wheelBind = useWheel(({ delta: [, dy] }) => {
    const zoomFactor = dy > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(3, scale * zoomFactor))
    setScale(newScale)
    // 确保缩放值是有效的数字
    const safeScale = isNaN(newScale) ? 1 : newScale
    // 发送缩放值
    sendHttpMessage(`${imageData.name}_Scale:${safeScale.toFixed(1)}`)
  })

  // 动画选择处理
  const handleAnimationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAnimationId = parseInt(e.target.value)
    setAnimationId(newAnimationId)
    // 发送动画ID
    sendHttpMessage(`${imageData.name}:${newAnimationId}`)
  }

  // 重设位置
  const handleResetPosition = () => {
    setPosition({ x: 0.5, y: 0.5 })
    const newGridIndex = calculateGridIndex(0.5, 0.5)
    setGridIndex(newGridIndex)
    sendHttpMessage(newGridIndex.toString())
  }

  // 重设缩放
  const handleResetScale = () => {
    setScale(1)
    sendHttpMessage(`${imageData.name}_Scale:1`)
  }

  // 合并所有手势绑定
  const bind = { ...dragBind(), ...pinchBind(), ...wheelBind() }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center">圖片編輯</h1>

      {/* HTTP 通訊設置 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">HTTP 通訊設置</h2>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          伺服器 IP: {wsIp}:8080
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            HTTP 模式
          </span>
        </div>
      </div>

      {/* 網格定位區 */}
      <div className="mb-8">
        <h2 className="text-xl font-medium mb-4">網格定位區</h2>
        <div 
          ref={containerRef}
          className="grid-container bg-white rounded-lg shadow-md overflow-hidden relative"
        >
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
              transform: `translate(-50%, -50%) scale(${scale})`,
              maxWidth: '80%',
              maxHeight: '80%',
            }}
            {...bind}
          />
          
          {/* 拖放覆蓋層 */}
          <div className="drag-overlay" {...bind}></div>
        </div>
        <div className="mt-4 text-center">
          <span className="text-lg font-medium">當前網格索引：</span>
          <span className="text-xl font-bold text-blue-600">{gridIndex}</span>
        </div>
      </div>

      {/* 圖片縮放控制 */}
      <div className="mb-8">
        <h2 className="text-xl font-medium mb-4">圖片縮放</h2>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-lg">當前縮放比例：</span>
            <span className="text-xl font-bold text-blue-600">{scale.toFixed(1)}x</span>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            <p>滑鼠滾輪或雙指縮放調整圖片大小</p>
            <p>縮放範圍：0.1 ~ 3.0</p>
          </div>
        </div>
      </div>

      {/* 動畫選擇 */}
      <div className="mb-8">
        <h2 className="text-xl font-medium mb-4">動畫效果選擇</h2>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <label htmlFor="animation" className="mr-4 text-lg">選擇動畫編號：</label>
            <select
              id="animation"
              value={animationId}
              onChange={handleAnimationChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 10 }, (_, i) => i).map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 流程控制按鈕 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button
          onClick={onBackToUpload}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          返回拍攝頁
        </button>
        <button
          onClick={onResetUpload}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          重新上載
        </button>
      </div>

      {/* 額外輔助按鈕 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleResetPosition}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          重設位置
        </button>
        <button
          onClick={handleResetScale}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          重設縮放
        </button>
      </div>
    </div>
  )
}

export default EditPage