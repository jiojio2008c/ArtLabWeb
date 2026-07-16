interface DirectUploadCompletePageProps {
  result: {
    name: string
    url: string
  } | null
  wsIp: string
  uploadPort: number
  onBackToEntry: () => void
  onReupload: () => void
}

const DirectUploadCompletePage: React.FC<DirectUploadCompletePageProps> = ({
  result,
  wsIp,
  uploadPort,
  onBackToEntry,
  onReupload
}) => {
  return (
    <main className="ipad-screen direct-complete-screen apple-container">
      <header className="ipad-topbar">
        <div className="min-w-0">
          <p className="eyebrow">快速上載</p>
          <h1 className="screen-title">上載完成</h1>
        </div>
        <div className="topbar-controls">
          <span className="status-pill">{wsIp}:{uploadPort}</span>
          <span className="status-pill">已發送</span>
        </div>
      </header>

      <section className="direct-complete-workspace">
        <div className="complete-preview-panel">
          {result?.url ? (
            <img src={result.url} alt="快速上載預覽" className="complete-preview-image" />
          ) : (
            <div className="complete-empty-preview">上載完成</div>
          )}
        </div>

        <aside className="complete-summary-panel">
          <div className="complete-mark" />
          <p className="eyebrow">結果</p>
          <h2>圖片已發送</h2>
          <p className="complete-copy">檔案已透過 HTTP 發送到藝術畫廊快速上載端口，本流程不會進入控制頁。</p>
          <div className="complete-meta">
            <span>檔案</span>
            <strong>{result?.name ?? '未記錄檔案名稱'}</strong>
          </div>
          <div className="complete-meta">
            <span>目標</span>
            <strong>{wsIp}:{uploadPort}</strong>
          </div>
        </aside>
      </section>

      <div className="direct-complete-actions">
        <button type="button" className="ipad-button secondary-button" onClick={onBackToEntry}>
          返回首頁
        </button>
        <button type="button" className="ipad-button primary-button" onClick={onReupload}>
          重新上載
        </button>
      </div>
    </main>
  )
}

export default DirectUploadCompletePage
