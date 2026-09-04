import { useEffect, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, Languages, LogOut, QrCode } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  LANGUAGE_OPTIONS,
  changeAppLocale,
  getCurrentAppLocale,
  type AppLocale
} from '../i18n/index.ts'
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
  return Array.from(words[0] ?? 'U').slice(0, 2).join('').toUpperCase()
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
  const { t } = useTranslation()
  const [wsIp, setWsIp] = useState(settings.wsIp)
  const [dynamicPort, setDynamicPort] = useState(String(settings.dynamicPort))
  const [interactivePort, setInteractivePort] = useState(String(settings.interactivePort))
  const watermarkEnabled = settings.watermarkEnabled
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [view, setView] = useState<'settings' | 'language'>('settings')

  useEffect(() => {
    setAvatarFailed(false)
  }, [account?.avatarUrl])

  const handleSave = () => {
    onSave({
      wsIp: wsIp.trim() || settings.wsIp,
      dynamicPort: normalizePortInput(dynamicPort, settings.dynamicPort),
      interactivePort: normalizePortInput(interactivePort, settings.interactivePort),
      advancedFeaturesEnabled: settings.advancedFeaturesEnabled,
      watermarkEnabled
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
    setLogoutError(false)
    try {
      await onLogout()
    } catch {
      setLogoutError(true)
      setIsLoggingOut(false)
    }
  }

  const handleLanguageChange = (locale: AppLocale) => {
    void changeAppLocale(locale)
  }

  const currentLocale = getCurrentAppLocale()
  const currentLanguage = LANGUAGE_OPTIONS.find((option) => option.id === currentLocale)?.nativeName
    ?? LANGUAGE_OPTIONS[0].nativeName

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
      <button type="button" className="settings-scrim" onClick={onClose} aria-label={t('settings.close')} />
      <aside className="settings-panel">
        <div className="settings-heading">
          {view === 'language' ? (
            <button
              type="button"
              className="settings-heading-back"
              onClick={() => setView('settings')}
              aria-label={t('settings.backToSettings')}
            >
              <ArrowLeft aria-hidden="true" />
              <span>{t('settings.languageTitle')}</span>
            </button>
          ) : (
            <div>
              <p className="eyebrow">MagicFloor</p>
              <h2>{t('settings.title')}</h2>
            </div>
          )}
          <button type="button" className="mini-action-button" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>

        <div className={`settings-view ${view === 'language' ? 'is-language' : 'is-settings'}`} key={view}>
          {view === 'language' ? (
            <div className="settings-language-list" role="radiogroup" aria-label={t('settings.languageTitle')}>
              {LANGUAGE_OPTIONS.map((option) => {
                const selected = option.id === currentLocale
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`settings-language-option ${selected ? 'is-selected' : ''}`}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleLanguageChange(option.id)}
                  >
                    <span lang={option.id}>{option.nativeName}</span>
                    {selected && <Check aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          ) : (
            <>
              <div className="settings-scroll-body">
                <section
                  className={`settings-account-summary ${accountLoading ? 'is-loading' : ''}`}
                  aria-label={accountLoading
                    ? t('settings.accountLoading')
                    : t('settings.currentAccount', { name: account?.displayName || t('common.user') })}
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
                      <span>{getAccountInitials(account?.displayName || t('common.user'))}</span>
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
                        <strong>{account?.displayName || t('common.user')}</strong>
                        <span>{account?.email || t('common.signedIn')}</span>
                      </>
                    )}
                  </div>
                </section>

                <button
                  type="button"
                  className="settings-language-row"
                  onClick={() => setView('language')}
                  aria-label={`${t('settings.language')}: ${currentLanguage}`}
                >
                  <span className="settings-row-icon" aria-hidden="true"><Languages /></span>
                  <span className="settings-language-copy">
                    <strong>{t('settings.language')}</strong>
                    <small lang={currentLocale}>{currentLanguage}</small>
                  </span>
                  <ChevronRight aria-hidden="true" />
                </button>

                <label className="settings-field">
                  <span>{t('settings.galleryIp')}</span>
                  <input
                    type="text"
                    value={wsIp}
                    onChange={(event) => setWsIp(event.target.value)}
                    className="ipad-input"
                    placeholder="192.168.8.101"
                  />
                </label>

                <label className="settings-field">
                  <span>{t('settings.dynamicPort')}</span>
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
                  <span>{t('settings.interactivePort')}</span>
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
                  <span>{t('settings.showQrCode')}</span>
                </button>
              </div>

              <div className="settings-footer">
                <div className="settings-actions">
                  <button type="button" className="ipad-button secondary-button" onClick={onClose} disabled={isLoggingOut}>
                    {t('common.cancel')}
                  </button>
                  <button type="button" className="ipad-button primary-button" onClick={handleSave} disabled={isLoggingOut}>
                    {t('common.save')}
                  </button>
                </div>

                <button
                  type="button"
                  className="ipad-button danger-button settings-logout-button"
                  onClick={() => void handleLogout()}
                  disabled={isLoggingOut}
                >
                  <LogOut aria-hidden="true" />
                  {isLoggingOut ? t('settings.signingOut') : t('settings.signOut')}
                </button>
                <div className="settings-logout-error" role="status" aria-live="polite">
                  {logoutError ? t('settings.signOutFailed') : ''}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

export default SettingsPanel
