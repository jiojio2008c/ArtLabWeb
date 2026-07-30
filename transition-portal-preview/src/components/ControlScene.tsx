import type { RefObject } from 'react'
import { ArrowLeft, ImagePlus, Layers3, Play, Plus, SlidersHorizontal } from 'lucide-react'
import { CrabIllustration, TigerIllustration } from './StoryIllustrations.tsx'

interface ControlSceneProps {
  rootRef: RefObject<HTMLElement>
  visible: boolean
  onBack: () => void
}

const ControlScene: React.FC<ControlSceneProps> = ({ rootRef, visible, onBack }) => (
  <section
    ref={rootRef}
    className={`control-scene ${visible ? 'is-visible' : ''}`}
    aria-label="gggg 控制页"
    aria-hidden={!visible}
  >
    <header className="control-topbar control-reveal">
      <div className="control-title-group">
        <button type="button" className="control-button control-back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          <span>返回</span>
        </button>
        <div>
          <p>我們這一家</p>
          <h1>gggg</h1>
        </div>
      </div>
      <div className="control-actions">
        <button type="button" className="control-button"><ImagePlus aria-hidden="true" /><span>編輯背景</span></button>
        <button type="button" className="control-button preview-action"><Play aria-hidden="true" /><span>預覽</span></button>
      </div>
    </header>

    <main className="control-workspace">
      <section className="stage-column">
        <div className="control-stage-frame control-reveal">
          <div className="control-stage">
            <div className="stage-sky" />
            <div className="stage-back-hills" />
            <div className="stage-grass-plane">
              <span className="stage-hole" />
              <span className="stage-flower flower-one" />
              <span className="stage-flower flower-two" />
              <span className="stage-flower flower-three" />
            </div>
            <TigerIllustration className="control-character tiger-character" />
            <CrabIllustration className="control-character crab-character" />
            <div className="stage-light-grid" aria-hidden="true" />
          </div>
        </div>
        <div className="control-stage-status control-reveal">
          <span>16:9 舞台</span>
          <strong>2 個物件</strong>
        </div>
      </section>

      <aside className="control-layer-panel control-reveal">
        <header>
          <div><Layers3 aria-hidden="true" /><strong>圖層</strong></div>
          <button type="button" aria-label="新增物件"><Plus aria-hidden="true" /></button>
        </header>
        <div className="control-layer-list">
          <button type="button" className="control-layer-card active">
            <TigerIllustration />
            <span><strong>小老虎</strong><small>動畫：彈跳</small></span>
            <SlidersHorizontal aria-hidden="true" />
          </button>
          <button type="button" className="control-layer-card">
            <CrabIllustration />
            <span><strong>小螃蟹</strong><small>移動：右移</small></span>
            <SlidersHorizontal aria-hidden="true" />
          </button>
        </div>
      </aside>
    </main>
  </section>
)

export default ControlScene
