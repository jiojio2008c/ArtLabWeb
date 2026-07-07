import React from 'react'
import { saveLastWsIp } from '../services/appSettings.ts'
import { CONTROL_PORT, DIRECT_UPLOAD_PORT } from '../services/networkConfig.ts'

interface EntryPageProps {
  wsIp: string
  onWsIpChange: (ip: string) => void
  onOpenControlFlow: () => void
  onOpenDirectUpload: () => void
}

const EntryPage: React.FC<EntryPageProps> = ({
  wsIp,
  onWsIpChange,
  onOpenControlFlow,
  onOpenDirectUpload
}) => {
  const handleEnter = (next: () => void) => {
    const ip = wsIp.trim()
    if (ip) saveLastWsIp(ip)
    next()
  }

  return (
    <main className="ipad-screen entry-screen apple-container">
      <header className="ipad-topbar">
        <div className="min-w-0">
          <p className="eyebrow">Art Lab</p>
          <h1 className="screen-title">功能入口</h1>
        </div>

        <div className="topbar-controls">
          <div className="ip-control">
            <span className="control-label">HTTP</span>
            <input
              type="text"
              value={wsIp}
              onChange={(event) => onWsIpChange(event.target.value)}
              placeholder="Unity IP"
              className="ipad-input ip-input"
            />
          </div>
          <span className="status-pill">共用 Unity IP</span>
        </div>
      </header>

      <section className="entry-workspace">
        <div className="entry-showcase">
          <video src="fish.mp4" autoPlay loop muted playsInline className="showcase-video" />
          <div className="showcase-shade" />
          <div className="showcase-content">
            <p className="eyebrow light">Artwork Uploader</p>
            <h2>选择本次操作模式</h2>
            <p>同一个 Unity IP 可进入作品控制流程，也可以进入无需控制页的快速拍照上传。</p>
          </div>
        </div>

        <div className="entry-action-panel">
          <button
            type="button"
            className="entry-action primary-entry-action"
            onClick={() => handleEnter(onOpenControlFlow)}
          >
            <span className="entry-action-port">:{CONTROL_PORT}</span>
            <span className="entry-action-copy">
              <span className="eyebrow">Control Flow</span>
              <strong>作品控制上传</strong>
              <span>进入 20 个作品槽位，上传后进入控制页，可移动、缩放、旋转、选择动画和场景。</span>
            </span>
          </button>

          <button
            type="button"
            className="entry-action direct-entry-action"
            onClick={() => handleEnter(onOpenDirectUpload)}
          >
            <span className="entry-action-port">:{DIRECT_UPLOAD_PORT}</span>
            <span className="entry-action-copy">
              <span className="eyebrow">Quick Upload</span>
              <strong>快速拍照上传</strong>
              <span>直接选择图片或拍照，使用新遮罩发送到 Unity，完成后停留在上传成功页。</span>
            </span>
          </button>
        </div>
      </section>
    </main>
  )
}

export default EntryPage
