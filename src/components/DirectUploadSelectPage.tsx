import { DIRECT_UPLOAD_THEMES, type DirectUploadTheme } from '../services/directUploadThemes.ts'

interface DirectUploadSelectPageProps {
  selectedThemeId: string
  wsIp: string
  uploadPort: number
  onBackToEntry: () => void
  onSelectTheme: (theme: DirectUploadTheme) => void
}

const DirectUploadSelectPage: React.FC<DirectUploadSelectPageProps> = ({
  selectedThemeId,
  wsIp,
  uploadPort,
  onBackToEntry,
  onSelectTheme
}) => {
  return (
    <main className="ipad-screen direct-select-screen apple-container">
      <header className="ipad-topbar">
        <div className="topbar-title-row">
          <button type="button" onClick={onBackToEntry} className="ipad-button ghost-button">
            返回首頁
          </button>
          <div className="min-w-0">
            <p className="eyebrow">MagicFloor</p>
            <h1 className="screen-title">選擇快速上載類型</h1>
          </div>
        </div>

        <div className="topbar-controls">
          <span className="status-pill">{wsIp}:{uploadPort}</span>
          <span className="status-pill">藝術畫廊</span>
        </div>
      </header>

      <section className="direct-select-workspace">
        {DIRECT_UPLOAD_THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`direct-theme-card ${selectedThemeId === theme.id ? 'active' : ''}`}
            onClick={() => onSelectTheme(theme)}
          >
            <img src={theme.cover} alt={theme.label} className="direct-theme-image" />
            <span className="direct-theme-shade" />
            <span className="direct-theme-content">
              <span className="eyebrow light">快速上載</span>
              <strong>{theme.label}</strong>
              <span>{theme.maskPrefix} 組遮罩</span>
            </span>
          </button>
        ))}
      </section>
    </main>
  )
}

export default DirectUploadSelectPage
