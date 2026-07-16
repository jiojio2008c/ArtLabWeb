import { useState } from 'react'
import type { NetworkSettings } from '../services/appSettings.ts'

interface SettingsPanelProps {
  settings: NetworkSettings
  onClose: () => void
  onSave: (settings: NetworkSettings) => void
}

const normalizePortInput = (value: string, fallback: number) => {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) return fallback
  return Math.min(65535, Math.max(1, Math.round(parsedValue)))
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onClose, onSave }) => {
  const [wsIp, setWsIp] = useState(settings.wsIp)
  const [dynamicPort, setDynamicPort] = useState(String(settings.dynamicPort))
  const [interactivePort, setInteractivePort] = useState(String(settings.interactivePort))

  const handleSave = () => {
    onSave({
      wsIp: wsIp.trim() || settings.wsIp,
      dynamicPort: normalizePortInput(dynamicPort, settings.dynamicPort),
      interactivePort: normalizePortInput(interactivePort, settings.interactivePort)
    })
    onClose()
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="設定">
      <button type="button" className="settings-scrim" onClick={onClose} aria-label="關閉設定" />
      <aside className="settings-panel">
        <div className="settings-heading">
          <div>
            <p className="eyebrow">MagicFloor</p>
            <h2>設定</h2>
          </div>
          <button type="button" className="mini-action-button" onClick={onClose}>
            關閉
          </button>
        </div>

        <label className="settings-field">
          <span>藝術畫廊 IP</span>
          <input
            type="text"
            value={wsIp}
            onChange={(event) => setWsIp(event.target.value)}
            className="ipad-input"
            placeholder="192.168.8.101"
          />
        </label>

        <label className="settings-field">
          <span>動態藝術端口</span>
          <input
            type="number"
            min="1"
            max="65535"
            value={dynamicPort}
            onChange={(event) => setDynamicPort(event.target.value)}
            className="ipad-input"
          />
        </label>

        <label className="settings-field">
          <span>互動藝術端口</span>
          <input
            type="number"
            min="1"
            max="65535"
            value={interactivePort}
            onChange={(event) => setInteractivePort(event.target.value)}
            className="ipad-input"
          />
        </label>

        <div className="settings-actions">
          <button type="button" className="ipad-button secondary-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="ipad-button primary-button" onClick={handleSave}>
            保存
          </button>
        </div>
      </aside>
    </div>
  )
}

export default SettingsPanel
