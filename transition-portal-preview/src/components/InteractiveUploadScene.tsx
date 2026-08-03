import { useEffect, useRef, useState, type RefObject } from 'react'
import { ArrowLeft, Check, ImagePlus, Plus, RotateCcw, Sparkles } from 'lucide-react'
import type { InteractiveTheme } from './interactiveThemeData.ts'
import ArtworkRevealTransition from './ArtworkRevealTransition.tsx'

interface InteractiveUploadSceneProps {
  rootRef: RefObject<HTMLElement>
  visible: boolean
  theme: InteractiveTheme | null
  onBack: () => void
  onReplay: () => void
}

const InteractiveUploadScene: React.FC<InteractiveUploadSceneProps> = ({
  rootRef,
  visible,
  theme,
  onBack,
  onReplay
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const importViewRef = useRef<HTMLDivElement>(null)
  const dropzoneRef = useRef<HTMLButtonElement>(null)
  const plusRef = useRef<HTMLSpanElement>(null)
  const adjustmentRef = useRef<HTMLDivElement>(null)
  const adjustmentHeaderRef = useRef<HTMLElement>(null)
  const stagePanelRef = useRef<HTMLElement>(null)
  const stageShellRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLElement>(null)
  const [selectedMaskId, setSelectedMaskId] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [isRevealing, setIsRevealing] = useState(false)

  useEffect(() => {
    setSelectedMaskId(theme?.masks[0]?.id ?? '')
    setPreviewUrl((current) => {
      if (current.startsWith('blob:')) URL.revokeObjectURL(current)
      return ''
    })
    setFileName('')
    setIsRevealing(false)
  }, [theme?.id])

  useEffect(() => () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  if (!theme) return null

  const selectedMask = theme.masks.find((item) => item.id === selectedMaskId) ?? theme.masks[0]
  const themeStyle = {
    '--upload-accent': theme.accent,
    '--upload-secondary': theme.secondary
  } as React.CSSProperties

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const nextUrl = URL.createObjectURL(file)
    setPreviewUrl((current) => {
      if (current.startsWith('blob:')) URL.revokeObjectURL(current)
      return nextUrl
    })
    setFileName(file.name)
    setIsRevealing(true)
    event.target.value = ''
  }

  const openFilePicker = () => inputRef.current?.click()

  return (
    <section
      ref={rootRef}
      className={`interactive-upload-scene theme-${theme.effect} ${previewUrl ? 'has-selection' : 'is-importing'} ${isRevealing ? 'is-artwork-revealing' : ''} ${visible ? 'is-visible' : ''}`}
      style={themeStyle}
      aria-label={`${theme.title}快速上載`}
      aria-hidden={!visible}
    >
      {(!previewUrl || isRevealing) && (
        <div ref={importViewRef} className="theme-upload-import-view">
          <header className="theme-upload-import-header">
            <button type="button" className="theme-upload-import-back upload-reveal" onClick={onBack} disabled={isRevealing}>
              <ArrowLeft aria-hidden="true" />
              <span>返回</span>
            </button>

            <div className="theme-upload-import-heading upload-reveal">
              <p>快速上載</p>
              <h1 className="theme-upload-title">{theme.title}</h1>
            </div>

            <button
              type="button"
              className="theme-upload-import-replay upload-reveal"
              onClick={onReplay}
              disabled={isRevealing}
              aria-label="重播轉場"
              title="重播轉場"
            >
              <RotateCcw aria-hidden="true" />
            </button>
          </header>

          <main className="theme-upload-import-main">
            <button ref={dropzoneRef} type="button" className="theme-upload-dropzone upload-reveal" onClick={openFilePicker} disabled={isRevealing}>
              <span ref={plusRef} className="theme-upload-dropzone-plus" aria-hidden="true">
                <Plus />
              </span>
              <strong>選擇快速上載圖片</strong>
              <span>JPEG / PNG / GIF / WebP</span>
            </button>
          </main>
        </div>
      )}

      {previewUrl && (
        <div ref={adjustmentRef} className="theme-upload-adjustment artwork-reveal-target" aria-hidden={isRevealing}>
          <div className="theme-upload-ambient" aria-hidden="true">
            <span className="theme-upload-ambient-line line-one" />
            <span className="theme-upload-ambient-line line-two" />
          </div>

          <header ref={adjustmentHeaderRef} className="theme-upload-header">
            <button type="button" className="theme-upload-back" onClick={onBack} disabled={isRevealing}>
              <ArrowLeft aria-hidden="true" />
              <span>返回主題</span>
            </button>
            <div className="theme-upload-heading">
              <p><Sparkles aria-hidden="true" /> {theme.title}</p>
              <h1>調整作品</h1>
            </div>
            <button type="button" className="theme-upload-primary" onClick={openFilePicker} disabled={isRevealing}>
              <ImagePlus aria-hidden="true" />
              <span>重新選擇</span>
            </button>
          </header>

          <div className="theme-upload-workspace">
            <section ref={stagePanelRef} className="theme-upload-stage-panel">
              <div className="theme-upload-panel-heading">
                <div>
                  <p>作品預覽</p>
                  <h2>{fileName}</h2>
                </div>
                <span><Check aria-hidden="true" /> {selectedMask.label}</span>
              </div>

              <div ref={stageShellRef} className="theme-upload-stage-shell">
                <img className="theme-upload-source-image" src={previewUrl} alt="上載預覽" draggable={false} />
                <img
                  className="theme-upload-mask-image"
                  src={selectedMask.image}
                  alt={`遮罩 ${selectedMask.label}`}
                  draggable={false}
                />
                <span className="theme-upload-stage-vignette" aria-hidden="true" />
                <span className="theme-upload-corner corner-one" aria-hidden="true" />
                <span className="theme-upload-corner corner-two" aria-hidden="true" />
                <span className="theme-upload-corner corner-three" aria-hidden="true" />
                <span className="theme-upload-corner corner-four" aria-hidden="true" />
              </div>
            </section>

            <aside ref={railRef} className="theme-upload-rail">
              <div className="theme-upload-rail-heading">
                <div>
                  <p>目前遮罩</p>
                  <h2>{theme.maskLabel}</h2>
                </div>
                <strong>{selectedMask.label}</strong>
              </div>

              <div className="theme-upload-mask-preview">
                <img src={selectedMask.image} alt={`目前遮罩 ${selectedMask.label}`} />
              </div>

              <div className="theme-upload-mask-grid" aria-label="選擇遮罩">
                {theme.masks.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`theme-upload-mask-option ${selectedMask.id === item.id ? 'active' : ''}`}
                    onClick={() => setSelectedMaskId(item.id)}
                    aria-pressed={selectedMask.id === item.id}
                  >
                    <img src={item.image} alt="" />
                    <span>{item.id}</span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </div>
      )}

      {previewUrl && isRevealing && (
        <ArtworkRevealTransition
          importViewRef={importViewRef}
          dropzoneRef={dropzoneRef}
          plusRef={plusRef}
          adjustmentRef={adjustmentRef}
          headerRef={adjustmentHeaderRef}
          stagePanelRef={stagePanelRef}
          stageShellRef={stageShellRef}
          railRef={railRef}
          previewUrl={previewUrl}
          maskUrl={selectedMask.image}
          accent={theme.accent}
          secondary={theme.secondary}
          onComplete={() => setIsRevealing(false)}
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        hidden
      />
    </section>
  )
}

export default InteractiveUploadScene
