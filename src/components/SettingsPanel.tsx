import { useEffect, useState } from 'react'
import { LogOut, QrCode } from 'lucide-react'
import type { NetworkSettings } from '../services/appSettings.ts'
import type { UserAccount } from '../services/userProfileService.ts'

interface SettingsPanelProps {
  settings: NetworkSettings
  account: UserAccount | null
  accountLoading: boolean
  onClose: () => void
  onSave: (settings: NetworkSettings) => void
  onShowQrCode: (ip: string, port: number) => void
  onLogout: () => Promise<void>
}

const normalizePortInput = (value: string, fallback: number) => {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) return fallback
  return Math.min(65535, Math.max(1, Math.round(parsedValue)))
}

const getAccountInitials = (displayName: string) => {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    return `${Array.from(words[0])[0] ?? ''}${Array.from(words[1])[0] ?? ''}`.toUpperCase()
  }
  return Array.from(words[0] ?? '使').slice(0, 2).join('').toUpperCase()
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  account,
  accountLoading,
  onClose,
  onSave,
  onShowQrCode,
  onLogout
}) => {
  const [wsIp, setWsIp] = useState(settings.wsIp)
  const [dynamicPort, setDynamicPort] = useState(String(settings.dynamicPort))
  const [interactivePort, setInteractivePort] = useState(String(settings.interactivePort))
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [avatarFailed, setAvatarFailed] = useState(false)

  useEffect(() => {
    setAvatarFailed(false)
  }, [account?.avatarUrl])

  const handleSave = () => {
    onSave({
      wsIp: wsIp.trim() || settings.wsIp,
      dynamicPort: normalizePortInput(dynamicPort, settings.dynamicPort),
      interactivePort: normalizePortInput(interactivePort, settings.interactivePort)
    })
    onClose()
  }

  const handleShowQrCode = () => {
    onShowQrCode(
      wsIp.trim() || settings.wsIp,
      normalizePortInput(interactivePort, settings.interactivePort)
    )
  }

  const handleLogout = async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)
    setLogoutError('')
    try {
      await onLogout()
    } catch {
      setLogoutError('無法登出，請稍後再試。')
      setIsLoggingOut(false)
    }
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

        <section
          className={`settings-account-summary ${accountLoading ? 'is-loading' : ''}`}
          aria-label={accountLoading ? '正在載入帳號資料' : `目前帳號：${account?.displayName ?? '使用者'}`}
          aria-busy={accountLoading}
        >
          <div className="settings-account-avatar" aria-hidden="true">
            {!accountLoading && account?.avatarUrl && !avatarFailed ? (
              <img
                src={account.avatarUrl}
                alt=""
                draggable={false}
                onError={() => setAvatarFailed(true)}
              />
            ) : !accountLoading ? (
              <span>{getAccountInitials(account?.displayName ?? '使用者')}</span>
            ) : null}
          </div>
          <div className="settings-account-copy" aria-hidden={accountLoading}>
            {accountLoading ? (
              <>
                <span className="settings-account-skeleton name" />
                <span className="settings-account-skeleton email" />
              </>
            ) : (
              <>
                <strong>{account?.displayName ?? '使用者'}</strong>
                <span>{account?.email || '已登入'}</span>
              </>
            )}
          </div>
        </section>

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

        <button
          type="button"
          className="ipad-button settings-qr-button"
          onClick={handleShowQrCode}
          disabled={isLoggingOut}
        >
          <span className="settings-qr-icon" aria-hidden="true"><QrCode /></span>
          <span>顯示二維碼</span>
        </button>

        <div className="settings-footer">
          <div className="settings-actions">
            <button type="button" className="ipad-button secondary-button" onClick={onClose} disabled={isLoggingOut}>
              取消
            </button>
            <button type="button" className="ipad-button primary-button" onClick={handleSave} disabled={isLoggingOut}>
              保存
            </button>
          </div>

          <button
            type="button"
            className="ipad-button danger-button settings-logout-button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
          >
            <LogOut aria-hidden="true" />
            {isLoggingOut ? '登出中' : '登出'}
          </button>
          <div className="settings-logout-error" role="status" aria-live="polite">
            {logoutError}
          </div>
        </div>
      </aside>
    </div>
  )
}

export default SettingsPanel
