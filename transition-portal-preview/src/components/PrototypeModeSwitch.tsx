import { Layers3, PanelsTopLeft } from 'lucide-react'
import type { TransitionMode } from '../types.ts'

interface PrototypeModeSwitchProps {
  mode: TransitionMode
  disabled: boolean
  onChange: (mode: TransitionMode) => void
}

const PrototypeModeSwitch: React.FC<PrototypeModeSwitchProps> = ({ mode, disabled, onChange }) => (
  <div className="prototype-mode-switch" role="group" aria-label="转场方案">
    <span>轉場方案</span>
    <button
      type="button"
      className={mode === 'shared' ? 'active' : ''}
      disabled={disabled}
      onClick={() => onChange('shared')}
    >
      <Layers3 aria-hidden="true" />
      <strong>A</strong>
      <small>空間共享</small>
    </button>
    <button
      type="button"
      className={mode === 'storybook' ? 'active' : ''}
      disabled={disabled}
      onClick={() => onChange('storybook')}
    >
      <PanelsTopLeft aria-hidden="true" />
      <strong>B</strong>
      <small>立體書破框</small>
    </button>
  </div>
)

export default PrototypeModeSwitch
