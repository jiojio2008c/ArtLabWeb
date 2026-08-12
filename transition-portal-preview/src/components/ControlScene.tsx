import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Layers3,
  Move,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  X
} from 'lucide-react'
import BackgroundEditorPrototype from './BackgroundEditorPrototype.tsx'
import { CrabIllustration, TigerIllustration } from './StoryIllustrations.tsx'

interface ControlSceneProps {
  rootRef: RefObject<HTMLElement>
  visible: boolean
  onBack: () => void
}

type SelectedObject = 'tiger' | 'crab'
type PropertyTab = 'motion' | 'animation' | 'transform' | 'copy'
type AnimationMode = 'none' | 'fixed' | 'random'
type MotionMode = '停止' | '上下' | '左移' | '右移' | '360 回環' | '隨機'
type Track = '上' | '中' | '下'
type CopyField = 'motion' | 'animation' | 'size' | 'deform'

interface AnimationDefinition {
  id: number
  name: string
  hint: string
}

const ANIMATIONS: AnimationDefinition[] = [
  { id: 1, name: '呼吸縮放', hint: '柔和放大與收回' },
  { id: 2, name: '搖擺', hint: '左右輕輕擺動' },
  { id: 3, name: '閃爍', hint: '透明度漸隱漸現' },
  { id: 4, name: '輕微旋轉', hint: '細緻角度變化' },
  { id: 5, name: '彈跳', hint: '帶有彈性的上下落差' },
  { id: 6, name: '波動', hint: '像水面一樣起伏' },
  { id: 7, name: '快速翻轉', hint: '短促翻面與傾斜' },
  { id: 8, name: '透明度脈衝', hint: '明暗節奏脈衝' },
  { id: 9, name: '行走', hint: '連續步伐向前' },
  { id: 10, name: '舞動一', hint: '身體柔軟律動' },
  { id: 11, name: '舞動二', hint: '重心左右切換' },
  { id: 12, name: '果凍跳', hint: '柔軟的跳躍回彈' },
  { id: 13, name: '跳躍翻轉', hint: '跳起後快速轉身' },
  { id: 14, name: '向右拉伸', hint: '向右延展再回復' },
  { id: 15, name: '舉手', hint: '上方伸展動作' },
  { id: 16, name: '滾動', hint: '沿著地面翻滾' },
  { id: 17, name: '波浪', hint: '連續的身體波浪' }
]

const MOTION_OPTIONS: MotionMode[] = ['停止', '上下', '左移', '右移', '360 回環', '隨機']
const TRACK_OPTIONS: Track[] = ['上', '中', '下']
const COPY_FIELDS: Array<{ id: CopyField; label: string }> = [
  { id: 'motion', label: '移動方式' },
  { id: 'animation', label: '動畫' },
  { id: 'size', label: '大小' },
  { id: 'deform', label: '變形' }
]

const PROPERTY_TABS: Array<{ id: PropertyTab; label: string; icon: typeof Move }> = [
  { id: 'motion', label: '移動方式', icon: Move },
  { id: 'animation', label: '動畫', icon: Sparkles },
  { id: 'transform', label: '變形', icon: SlidersHorizontal },
  { id: 'copy', label: '屬性複製', icon: RotateCw }
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const ControlScene: React.FC<ControlSceneProps> = ({ rootRef, visible, onBack }) => {
  const [backgroundEditorOpen, setBackgroundEditorOpen] = useState(false)
  const [selectedObject, setSelectedObject] = useState<SelectedObject>('tiger')
  const [rightPanelView, setRightPanelView] = useState<'layers' | 'properties'>('layers')
  const [activePropertyTab, setActivePropertyTab] = useState<PropertyTab>('motion')
  const [motionMode, setMotionMode] = useState<MotionMode>('右移')
  const [track, setTrack] = useState<Track>('下')
  const [amplitude, setAmplitude] = useState(50)
  const [speed, setSpeed] = useState(60)
  const [animationMode, setAnimationMode] = useState<AnimationMode>('fixed')
  const [animationIndex, setAnimationIndex] = useState(8)
  const [randomAnimationId, setRandomAnimationId] = useState(9)
  const [animationReplayKey, setAnimationReplayKey] = useState(0)
  const [clickAnimationIds, setClickAnimationIds] = useState<number[]>(ANIMATIONS.map(({ id }) => id))
  const [clickRangeOpen, setClickRangeOpen] = useState(false)
  const [clickRangeDraft, setClickRangeDraft] = useState<number[]>(clickAnimationIds)
  const [scale, setScale] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [flipX, setFlipX] = useState(false)
  const [flipY, setFlipY] = useState(false)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copySource, setCopySource] = useState<SelectedObject>('crab')
  const [copyFields, setCopyFields] = useState<Record<CopyField, boolean>>({
    motion: true,
    animation: true,
    size: true,
    deform: true
  })
  const [copyFeedback, setCopyFeedback] = useState('')
  const animationSwipeStartRef = useRef<{ pointerId: number; x: number } | null>(null)

  useEffect(() => {
    if (!visible) {
      setBackgroundEditorOpen(false)
      setRightPanelView('layers')
      setClickRangeOpen(false)
      setCopyModalOpen(false)
    }
  }, [visible])

  useEffect(() => {
    if (animationMode !== 'random') return
    const nextId = ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)].id
    setRandomAnimationId(nextId)
    setAnimationReplayKey((value) => value + 1)
  }, [animationMode])

  const openProperties = (object: SelectedObject) => {
    setSelectedObject(object)
    setRightPanelView('properties')
    setActivePropertyTab('motion')
    setCopyFeedback('')
  }

  const selectedObjectName = selectedObject === 'tiger' ? '小老虎' : '小螃蟹'
  const currentAnimationId = animationMode === 'random' ? randomAnimationId : animationIndex
  const currentAnimation = ANIMATIONS.find(({ id }) => id === currentAnimationId) ?? ANIMATIONS[0]

  const chooseAnimation = (id: number) => {
    setAnimationIndex(id)
    setAnimationMode('fixed')
    setAnimationReplayKey((value) => value + 1)
  }

  const moveAnimation = (direction: -1 | 1) => {
    const currentPosition = ANIMATIONS.findIndex(({ id }) => id === animationIndex)
    const nextPosition = (currentPosition + direction + ANIMATIONS.length) % ANIMATIONS.length
    chooseAnimation(ANIMATIONS[nextPosition].id)
  }

  const handleAnimationPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    animationSwipeStartRef.current = { pointerId: event.pointerId, x: event.clientX }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleAnimationPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = animationSwipeStartRef.current
    animationSwipeStartRef.current = null
    if (!start || Math.abs(event.clientX - start.x) < 28) return
    moveAnimation(event.clientX < start.x ? 1 : -1)
  }

  const openClickRange = () => {
    setClickRangeDraft(clickAnimationIds)
    setClickRangeOpen(true)
  }

  const toggleClickAnimation = (id: number) => {
    setClickRangeDraft((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id].sort((first, second) => first - second))
  }

  const openCopyModal = (source: SelectedObject) => {
    setCopySource(source)
    setCopyFields({ motion: true, animation: true, size: true, deform: true })
    setCopyFeedback('')
    setCopyModalOpen(true)
  }

  const confirmCopy = () => {
    const selectedCount = Object.values(copyFields).filter(Boolean).length
    if (!selectedCount) return
    setCopyModalOpen(false)
    setCopyFeedback(`已從${copySource === 'tiger' ? '小老虎' : '小螃蟹'}套用 ${selectedCount} 項屬性`)
  }

  const updateScale = (nextValue: number) => setScale(clamp(nextValue, 25, 200))
  const updateRotation = (nextValue: number) => setRotation(clamp(nextValue, -180, 180))

  const renderObjectIllustration = (object: SelectedObject, className?: string) => (
    object === 'tiger'
      ? <TigerIllustration className={className} />
      : <CrabIllustration className={className} />
  )

  const renderMotionPanel = () => (
    <div className="control-property-stack">
      <section className="control-property-card control-motion-card">
        <div className="control-section-heading">
          <div><span className="control-section-kicker">動態路徑</span><strong>移動方式</strong></div>
          <span className="control-value-pill">{motionMode}</span>
        </div>
        <div className="control-motion-options">
          {MOTION_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={motionMode === option ? 'active' : ''}
              onClick={() => setMotionMode(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </section>
      <section className="control-property-card">
        <div className="control-section-heading"><strong>軌道</strong><span className="control-value-pill">{track}</span></div>
        <div className="control-segmented-control">
          {TRACK_OPTIONS.map((option) => (
            <button key={option} type="button" className={track === option ? 'active' : ''} onClick={() => setTrack(option)}>{option}軌</button>
          ))}
        </div>
      </section>
      <div className="control-property-duo">
        <section className="control-property-card control-range-card">
          <div className="control-section-heading"><strong>幅度</strong><span className="control-value-pill">{amplitude}%</span></div>
          <input type="range" min="0" max="100" value={amplitude} onChange={(event) => setAmplitude(Number(event.target.value))} aria-label="幅度" />
        </section>
        <section className="control-property-card control-range-card">
          <div className="control-section-heading"><strong>速度</strong><span className="control-value-pill">{speed}%</span></div>
          <input type="range" min="0" max="100" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="速度" />
        </section>
      </div>
    </div>
  )

  const renderAnimationPanel = () => (
    <div className="control-property-stack control-animation-stack">
      <section className="control-property-card control-animation-mode-card">
        <div className="control-section-heading">
          <div><span className="control-section-kicker">播放選擇</span><strong>動畫模式</strong></div>
          <span className="control-value-pill">{animationMode === 'none' ? '關閉' : animationMode === 'random' ? '隨機' : '固定'}</span>
        </div>
        <div className="control-animation-mode-buttons">
          <button type="button" className={animationMode === 'none' ? 'active' : ''} onClick={() => { setAnimationMode('none'); setAnimationReplayKey((value) => value + 1) }}>
            <span className="control-mode-icon">—</span><span>無動畫</span>
          </button>
          <button type="button" className={animationMode === 'random' ? 'active' : ''} onClick={() => setAnimationMode('random')}>
            <Sparkles aria-hidden="true" /><span>隨機動畫</span>
          </button>
        </div>
      </section>
      <section className="control-property-card control-animation-carousel-card">
        <div className="control-animation-meta">
          <div><span className="control-section-kicker">動畫預覽</span><strong>{currentAnimation.name}</strong><small>{currentAnimation.hint}</small></div>
          <span className="control-animation-page">{String(currentAnimation.id).padStart(2, '0')} / 17</span>
        </div>
        <div
          className="control-animation-preview"
          onPointerDown={handleAnimationPointerDown}
          onPointerUp={handleAnimationPointerUp}
          onPointerCancel={() => { animationSwipeStartRef.current = null }}
          aria-label="滑動切換動畫預覽"
        >
          <button type="button" className="control-animation-arrow previous" onClick={() => moveAnimation(-1)} aria-label="上一個動畫"><ChevronLeft aria-hidden="true" /></button>
          <div className="control-animation-preview-stage">
            <span className="control-animation-preview-floor" />
            <div key={`${selectedObject}-${currentAnimationId}-${animationReplayKey}`} className={`control-animation-preview-art is-animation-${animationMode === 'none' ? 0 : currentAnimationId}`}>
              {renderObjectIllustration(selectedObject)}
            </div>
            {animationMode === 'random' && <span className="control-random-badge">隨機 {currentAnimation.id}</span>}
          </div>
          <button type="button" className="control-animation-arrow next" onClick={() => moveAnimation(1)} aria-label="下一個動畫"><ChevronRight aria-hidden="true" /></button>
        </div>
        <div className="control-animation-footer">
          <span>{animationMode === 'none' ? '目前不播放動畫' : `預覽中：${currentAnimation.name}`}</span>
          <button type="button" className="control-replay-button" onClick={() => setAnimationReplayKey((value) => value + 1)} aria-label="重新播放動畫"><RotateCcw aria-hidden="true" /></button>
        </div>
      </section>
      <button type="button" className="control-click-range-row" onClick={openClickRange}>
        <span><strong>點擊動畫範圍</strong><small>物件被點擊時可切換的動畫</small></span>
        <span className="control-click-range-count">{clickAnimationIds.length} / 17 <ChevronRight aria-hidden="true" /></span>
      </button>
    </div>
  )

  const renderTransformPanel = () => (
    <div className="control-property-stack control-transform-stack">
      <section className="control-property-card control-transform-summary">
        <div className="control-transform-value"><span>縮放</span><strong>{scale}%</strong></div>
        <div className="control-transform-value"><span>旋轉</span><strong>{rotation}°</strong></div>
      </section>
      <section className="control-property-card control-transform-control-card">
        <div className="control-stepper-row">
          <div><span className="control-section-kicker">大小</span><strong>縮放比例</strong></div>
          <div className="control-stepper"><button type="button" onClick={() => updateScale(scale - 5)} aria-label="縮小">−</button><span>{scale}%</span><button type="button" onClick={() => updateScale(scale + 5)} aria-label="放大">＋</button></div>
        </div>
        <input type="range" min="25" max="200" step="5" value={scale} onChange={(event) => updateScale(Number(event.target.value))} aria-label="縮放比例" />
        <div className="control-stepper-row">
          <div><span className="control-section-kicker">角度</span><strong>旋轉角度</strong></div>
          <div className="control-stepper"><button type="button" onClick={() => updateRotation(rotation - 5)} aria-label="逆時針旋轉">−</button><span>{rotation}°</span><button type="button" onClick={() => updateRotation(rotation + 5)} aria-label="順時針旋轉">＋</button></div>
        </div>
        <input type="range" min="-180" max="180" step="5" value={rotation} onChange={(event) => updateRotation(Number(event.target.value))} aria-label="旋轉角度" />
      </section>
      <section className="control-property-card control-flip-card">
        <div className="control-section-heading"><div><span className="control-section-kicker">方向</span><strong>翻轉</strong></div><span className="control-value-pill">{flipX || flipY ? '已調整' : '原始'}</span></div>
        <label className="control-toggle-row"><span><FlipHorizontal2 aria-hidden="true" /><strong>水平翻轉</strong></span><input type="checkbox" checked={flipX} onChange={(event) => setFlipX(event.target.checked)} /><i aria-hidden="true" /></label>
        <label className="control-toggle-row"><span><FlipVertical2 aria-hidden="true" /><strong>垂直翻轉</strong></span><input type="checkbox" checked={flipY} onChange={(event) => setFlipY(event.target.checked)} /><i aria-hidden="true" /></label>
      </section>
      <div className="control-transform-live-preview">
        <div style={{ transform: `scale(${scale / 100}) rotate(${rotation}deg) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})` }}>
          {renderObjectIllustration(selectedObject)}
        </div>
        <span>即時預覽</span>
      </div>
    </div>
  )

  const renderCopyPanel = () => (
    <div className="control-property-stack control-copy-stack">
      <section className="control-property-card control-copy-intro">
        <div><span className="control-section-kicker">快速套用</span><strong>屬性複製</strong><p>選擇來源物件，再指定要複製的內容。</p></div>
        <span className="control-copy-available">2 個物件</span>
      </section>
      <div className="control-copy-source-list">
        <button type="button" className="control-copy-source" onClick={() => openCopyModal('tiger')}>
          <TigerIllustration /><span><strong>小老虎</strong><small>目前物件的屬性</small></span><ChevronRight aria-hidden="true" />
        </button>
        <button type="button" className="control-copy-source" onClick={() => openCopyModal('crab')}>
          <CrabIllustration /><span><strong>小螃蟹</strong><small>目前物件的屬性</small></span><ChevronRight aria-hidden="true" />
        </button>
      </div>
      {copyFeedback && <div className="control-copy-feedback" role="status"><Check aria-hidden="true" /><span>{copyFeedback}</span></div>}
    </div>
  )

  const renderPropertyContent = () => {
    if (activePropertyTab === 'animation') return renderAnimationPanel()
    if (activePropertyTab === 'transform') return renderTransformPanel()
    if (activePropertyTab === 'copy') return renderCopyPanel()
    return renderMotionPanel()
  }

  return (
    <section
      ref={rootRef}
      className={`control-scene ${visible ? 'is-visible' : ''}`}
      aria-label="gggg 控制頁"
      aria-hidden={!visible}
    >
      <header className="control-topbar control-reveal">
        <div className="control-title-group">
          <button type="button" className="control-button control-back" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            <span>返回</span>
          </button>
          <div><p>我們這一家</p><h1>gggg</h1></div>
        </div>
        <div className="control-actions">
          <button type="button" className="control-button" onClick={() => setBackgroundEditorOpen(true)}><ImagePlus aria-hidden="true" /><span>編輯背景</span></button>
          <button type="button" className="control-button preview-action"><Play aria-hidden="true" /><span>預覽</span></button>
        </div>
      </header>

      <main className="control-workspace">
        <section className="stage-column">
          <div className="control-stage-frame control-reveal">
            <div className="control-stage">
              <div className="stage-sky" /><div className="stage-back-hills" />
              <div className="stage-grass-plane"><span className="stage-hole" /><span className="stage-flower flower-one" /><span className="stage-flower flower-two" /><span className="stage-flower flower-three" /></div>
              <TigerIllustration className="control-character tiger-character" /><CrabIllustration className="control-character crab-character" />
              <div className="stage-light-grid" aria-hidden="true" />
            </div>
          </div>
          <div className="control-stage-status control-reveal"><span>16:9 舞台</span><strong>2 個物件</strong></div>
        </section>

        <aside className={`control-layer-panel control-reveal is-${rightPanelView}`}>
          {rightPanelView === 'layers' ? (
            <>
              <header><div><Layers3 aria-hidden="true" /><span><small>舞台編輯</small><strong>圖層</strong></span></div><button type="button" aria-label="新增物件"><Plus aria-hidden="true" /></button></header>
              <div className="control-layer-toolbar"><label><input type="checkbox" /><span aria-hidden="true" />全選</label><small>已選 0</small><button type="button" disabled>刪除</button></div>
              <div className="control-layer-list">
                <article className={`control-layer-card ${selectedObject === 'tiger' ? 'active' : ''}`}>
                  <button type="button" className="control-layer-main" onClick={() => setSelectedObject('tiger')}><TigerIllustration /><span><strong>小老虎</strong><small>動畫：彈跳</small></span></button>
                  <button type="button" className="control-layer-property" onClick={() => openProperties('tiger')} aria-label="開啟小老虎的物件屬性"><SlidersHorizontal aria-hidden="true" /><span>屬性</span></button>
                </article>
                <article className={`control-layer-card ${selectedObject === 'crab' ? 'active' : ''}`}>
                  <button type="button" className="control-layer-main" onClick={() => setSelectedObject('crab')}><CrabIllustration /><span><strong>小螃蟹</strong><small>移動：右移</small></span></button>
                  <button type="button" className="control-layer-property" onClick={() => openProperties('crab')} aria-label="開啟小螃蟹的物件屬性"><SlidersHorizontal aria-hidden="true" /><span>屬性</span></button>
                </article>
              </div>
            </>
          ) : (
            <>
              <header className="control-properties-header">
                <div>{renderObjectIllustration(selectedObject)}<span><small>物件屬性</small><strong>{selectedObjectName}</strong></span></div>
                <button type="button" onClick={() => setRightPanelView('layers')} aria-label="關閉物件屬性"><X aria-hidden="true" /></button>
              </header>
              <nav className="control-property-tabs" aria-label="物件屬性分類">
                {PROPERTY_TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={activePropertyTab === id ? 'active' : ''} onClick={() => setActivePropertyTab(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
              </nav>
              <div className={`control-property-content is-${activePropertyTab}`}>{renderPropertyContent()}</div>
            </>
          )}
        </aside>
      </main>

      {clickRangeOpen && (
        <div className="control-property-modal-backdrop">
          <section className="control-property-modal" role="dialog" aria-modal="true" aria-labelledby="click-range-title">
            <header><div><span className="control-section-kicker">互動設定</span><h2 id="click-range-title">點擊動畫範圍</h2></div><button type="button" onClick={() => setClickRangeOpen(false)} aria-label="關閉"><X aria-hidden="true" /></button></header>
            <p className="control-modal-description">指定點擊物件時可以切換的動畫。</p>
            <div className="control-range-modal-toolbar"><span>已選 {clickRangeDraft.length} / 17</span><div><button type="button" onClick={() => setClickRangeDraft(ANIMATIONS.map(({ id }) => id))}>全選</button><button type="button" onClick={() => setClickRangeDraft([])}>清除</button></div></div>
            <div className="control-range-options">{ANIMATIONS.map((animation) => <label key={animation.id} className={clickRangeDraft.includes(animation.id) ? 'selected' : ''}><input type="checkbox" checked={clickRangeDraft.includes(animation.id)} onChange={() => toggleClickAnimation(animation.id)} /><span className="control-checkmark"><Check aria-hidden="true" /></span><strong>{animation.id}. {animation.name}</strong></label>)}</div>
            <footer><button type="button" className="control-modal-secondary" onClick={() => setClickRangeOpen(false)}>取消</button><button type="button" className="control-modal-primary" onClick={() => { setClickAnimationIds(clickRangeDraft); setClickRangeOpen(false) }}>確認</button></footer>
          </section>
        </div>
      )}

      {copyModalOpen && (
        <div className="control-property-modal-backdrop">
          <section className="control-property-modal control-copy-modal" role="dialog" aria-modal="true" aria-labelledby="copy-title">
            <header><div><span className="control-section-kicker">複製內容</span><h2 id="copy-title">從{copySource === 'tiger' ? '小老虎' : '小螃蟹'}套用</h2></div><button type="button" onClick={() => setCopyModalOpen(false)} aria-label="關閉"><X aria-hidden="true" /></button></header>
            <p className="control-modal-description">選擇要套用到「{selectedObjectName}」的屬性。</p>
            <div className="control-copy-modal-options">{COPY_FIELDS.map(({ id, label }) => <label key={id} className={copyFields[id] ? 'selected' : ''}><input type="checkbox" checked={copyFields[id]} onChange={() => setCopyFields((current) => ({ ...current, [id]: !current[id] }))} /><span className="control-checkmark"><Check aria-hidden="true" /></span><strong>{label}</strong></label>)}</div>
            <footer><button type="button" className="control-modal-secondary" onClick={() => setCopyModalOpen(false)}>取消</button><button type="button" className="control-modal-primary" disabled={!Object.values(copyFields).some(Boolean)} onClick={confirmCopy}>確認複製</button></footer>
          </section>
        </div>
      )}

      <BackgroundEditorPrototype open={backgroundEditorOpen} onClose={() => setBackgroundEditorOpen(false)} />
    </section>
  )
}

export default ControlScene
