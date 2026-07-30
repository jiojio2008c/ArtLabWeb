import { useEffect } from 'react'
import { Check } from 'lucide-react'
import { playUiSound } from '../services/uiFeedback.ts'

interface DirectUploadCompletePageProps {
  result: {
    name: string
    url: string
  } | null
  onBackToEntry: () => void
  onReupload: () => void
}

const DirectUploadCompletePage: React.FC<DirectUploadCompletePageProps> = ({
  result,
  onBackToEntry,
  onReupload
}) => {
  useEffect(() => {
    const timer = window.setTimeout(() => playUiSound('artwork-arrived'), 180)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <main className="ipad-screen direct-complete-screen apple-container">
      <header className="ipad-topbar">
        <div className="min-w-0">
          <p className="eyebrow">快速上載</p>
          <h1 className="screen-title">上載完成</h1>
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

        <aside className="complete-summary-panel" role="status" aria-live="polite">
          <div className="complete-mark" aria-hidden="true">
            <Check />
          </div>
          <p className="eyebrow">結果</p>
          <h2>圖片已發送</h2>
          <div className="complete-meta">
            <span>檔案</span>
            <strong>{result?.name ?? '未記錄檔案名稱'}</strong>
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
