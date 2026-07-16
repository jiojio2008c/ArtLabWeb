import { useRef, useState } from 'react'
import { persistDynamicMedia, type DynamicBackground } from '../services/dynamicArtStorage.ts'
import { uploadUnityAsset } from '../services/unityBridge.ts'

interface DynamicBackgroundPageProps {
  wsIp: string
  dynamicPort: number
  draftBackground?: DynamicBackground
  onBackToEntry: () => void
  onBackgroundReady: (background: DynamicBackground) => void
  onContinue: () => void
}

const DynamicBackgroundPage: React.FC<DynamicBackgroundPageProps> = ({
  wsIp,
  dynamicPort,
  draftBackground,
  onBackToEntry,
  onBackgroundReady,
  onContinue
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const media = await persistDynamicMedia(file, 'draft-background') as DynamicBackground
      uploadUnityAsset({
        ip: wsIp,
        port: dynamicPort,
        file,
        fields: {
          role: 'background',
          groupId: 'draft',
          assetId: media.id,
          mediaType: media.type,
          mimeType: media.mimeType
        }
      })
      onBackgroundReady(media)
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  return (
    <main className="ipad-screen dynamic-screen apple-container">
      <header className="ipad-topbar">
        <div className="topbar-title-row">
          <button type="button" className="ipad-button ghost-button" onClick={onBackToEntry}>
            返回首頁
          </button>
          <div className="min-w-0">
            <p className="eyebrow">動態藝術</p>
            <h1 className="screen-title">背景上載</h1>
          </div>
        </div>
      </header>

      <section className="dynamic-background-workspace">
        <div className="dynamic-background-stage">
          {draftBackground ? (
            draftBackground.type === 'video' ? (
              <video src={draftBackground.url} controls playsInline className="dynamic-background-media" />
            ) : (
              <img src={draftBackground.url} alt={draftBackground.name} className="dynamic-background-media" />
            )
          ) : (
            <div className="dynamic-empty-stage">
              <strong>16:9</strong>
              <span>選擇圖片或影片作為動態藝術背景</span>
            </div>
          )}
        </div>

        <aside className="dynamic-side-panel">
          <p className="eyebrow">背景資源</p>
          <h2>上載背景</h2>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button type="button" className="ipad-button primary-button" onClick={() => inputRef.current?.click()}>
            {isUploading ? '處理中' : '選擇背景'}
          </button>
          <button
            type="button"
            className="ipad-button secondary-button"
            disabled={!draftBackground}
            onClick={onContinue}
          >
            下一步
          </button>
          {draftBackground && (
            <div className="dynamic-meta-card">
              <span>目前背景</span>
              <strong>{draftBackground.name}</strong>
              <small>{draftBackground.type === 'video' ? '影片背景' : '圖片背景'}</small>
            </div>
          )}
        </aside>
      </section>
    </main>
  )
}

export default DynamicBackgroundPage
