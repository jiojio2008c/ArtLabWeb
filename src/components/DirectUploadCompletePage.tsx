import React from 'react'
import { DIRECT_UPLOAD_PORT } from '../services/networkConfig.ts'

interface DirectUploadCompletePageProps {
  result: {
    name: string
    url: string
  } | null
  wsIp: string
  onBackToEntry: () => void
  onReupload: () => void
}

const DirectUploadCompletePage: React.FC<DirectUploadCompletePageProps> = ({
  result,
  wsIp,
  onBackToEntry,
  onReupload
}) => {
  return (
    <main className="ipad-screen direct-complete-screen apple-container">
      <header className="ipad-topbar">
        <div className="min-w-0">
          <p className="eyebrow">Quick Upload</p>
          <h1 className="screen-title">上传完成</h1>
        </div>
        <div className="topbar-controls">
          <span className="status-pill">{wsIp}:{DIRECT_UPLOAD_PORT}</span>
          <span className="status-pill">已发送</span>
        </div>
      </header>

      <section className="direct-complete-workspace">
        <div className="complete-preview-panel">
          {result?.url ? (
            <img src={result.url} alt="快速上传预览" className="complete-preview-image" />
          ) : (
            <div className="complete-empty-preview">上传完成</div>
          )}
        </div>

        <aside className="complete-summary-panel">
          <div className="complete-mark" />
          <p className="eyebrow">Result</p>
          <h2>图片已发送</h2>
          <p className="complete-copy">文件已通过 HTTP 发送到 Unity 快速上传端口，本流程不会进入控制页。</p>
          <div className="complete-meta">
            <span>文件</span>
            <strong>{result?.name ?? '未记录文件名'}</strong>
          </div>
          <div className="complete-meta">
            <span>目标</span>
            <strong>{wsIp}:{DIRECT_UPLOAD_PORT}</strong>
          </div>
        </aside>
      </section>

      <div className="direct-complete-actions">
        <button type="button" className="ipad-button secondary-button" onClick={onBackToEntry}>
          返回首页
        </button>
        <button type="button" className="ipad-button primary-button" onClick={onReupload}>
          重新上传
        </button>
      </div>
    </main>
  )
}

export default DirectUploadCompletePage
