import { useEffect } from 'react'
import { ArrowLeft, Check, RotateCcw } from 'lucide-react'
import { playArtworkArrivalSound } from '../artworkLaunchAudio.ts'

interface InteractiveUploadCompleteSceneProps {
  sourceUrl: string
  maskUrl: string
  fileName: string
  onBack: () => void
  onReupload: () => void
}

const InteractiveUploadCompleteScene: React.FC<InteractiveUploadCompleteSceneProps> = ({
  sourceUrl,
  maskUrl,
  fileName,
  onBack,
  onReupload
}) => {
  useEffect(() => {
    const timer = window.setTimeout(playArtworkArrivalSound, 180)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="artwork-upload-complete" role="status" aria-live="polite">
      <header className="artwork-complete-header">
        <div>
          <p>快速上載</p>
          <h1>上載完成</h1>
        </div>
      </header>

      <div className="artwork-complete-workspace">
        <section className="artwork-complete-preview" aria-label="已上載作品預覽">
          <div className="artwork-complete-preview-frame">
            <img className="artwork-complete-source" src={sourceUrl} alt="已上載作品" />
            <img className="artwork-complete-mask" src={maskUrl} alt="" aria-hidden="true" />
          </div>
        </section>

        <aside className="artwork-complete-summary">
          <span className="artwork-complete-mark" aria-hidden="true">
            <Check />
          </span>
          <div>
            <p>結果</p>
            <h2>圖片已發送</h2>
          </div>
          <dl>
            <dt>檔案</dt>
            <dd>{fileName || '未命名圖片'}</dd>
          </dl>
        </aside>
      </div>

      <div className="artwork-complete-actions">
        <button type="button" className="artwork-complete-button is-secondary" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          <span>返回選項</span>
        </button>
        <button type="button" className="artwork-complete-button is-primary" onClick={onReupload}>
          <RotateCcw aria-hidden="true" />
          <span>重新上載</span>
        </button>
      </div>
    </div>
  )
}

export default InteractiveUploadCompleteScene
