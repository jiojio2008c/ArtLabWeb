import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  Languages,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Network,
  QrCode,
  ShieldCheck,
  Sparkles,
  Wrench,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  LANGUAGE_OPTIONS,
  changeAppLocale,
  getCurrentAppLocale,
  type AppLocale
} from '../i18n/index.ts'
import type { NetworkSettings } from '../services/appSettings.ts'
import type { UserAccount } from '../services/userProfileService.ts'
import { LEGAL_CONTENT } from '../i18n/legalContent.ts'

interface SettingsPanelProps {
  settings: NetworkSettings
  account: UserAccount | null
  accountLoading: boolean
  onClose: () => void
  onSave: (settings: NetworkSettings) => void
  onShowQrCode: (ip: string, port: number) => void
  onLogout: () => Promise<void>
}

type SettingsView = 'settings' | 'language' | 'technical' | 'help' | 'terms' | 'privacy' | 'licenses'

const TECHNICAL_PASSWORD = '168'
const TECHNICAL_TAP_COUNT = 6
const TECHNICAL_TAP_WINDOW_MS = 3000
const LEGAL_EFFECTIVE_DATE = '2026-08-28'

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

const SettingsRow: React.FC<{
  icon: ReactNode
  title: string
  summary?: string
  onClick: () => void
  className?: string
  ariaLabel?: string
}> = ({ icon, title, summary, onClick, className = '', ariaLabel }) => (
  <button
    type="button"
    className={`settings-menu-row ${className}`.trim()}
    onClick={onClick}
    aria-label={ariaLabel ?? (summary ? `${title}: ${summary}` : title)}
  >
    <span className="settings-menu-icon" aria-hidden="true">{icon}</span>
    <span className="settings-menu-copy">
      <strong>{title}</strong>
      {summary && <small>{summary}</small>}
    </span>
    <ChevronRight aria-hidden="true" />
  </button>
)

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
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [view, setView] = useState<SettingsView>('settings')
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [technicalUnlocked, setTechnicalUnlocked] = useState(false)
  const [technicalPassword, setTechnicalPassword] = useState('')
  const [technicalPasswordError, setTechnicalPasswordError] = useState(false)
  const technicalTapCountRef = useRef(0)
  const technicalTapStartedAtRef = useRef(0)
  const technicalTapResetTimerRef = useRef<number | null>(null)
  const technicalPasswordInputRef = useRef<HTMLInputElement>(null)
  const technicalIpInputRef = useRef<HTMLInputElement>(null)
  const technicalRowRef = useRef<HTMLButtonElement>(null)
  const technicalPasswordDialogRef = useRef<HTMLFormElement>(null)
  const passwordPreviousFocusRef = useRef<HTMLElement | null>(null)
  const settingsPanelRef = useRef<HTMLElement>(null)
  const settingsCloseButtonRef = useRef<HTMLButtonElement>(null)
  const settingsPreviousFocusRef = useRef<HTMLElement | null>(null)

  const watermarkEnabled = settings.watermarkEnabled

  const resetTechnicalDrafts = useCallback(() => {
    setWsIp(settings.wsIp)
    setDynamicPort(String(settings.dynamicPort))
    setInteractivePort(String(settings.interactivePort))
  }, [settings.dynamicPort, settings.interactivePort, settings.wsIp])

  const restorePasswordFocus = useCallback(() => {
    const previousFocus = passwordPreviousFocusRef.current
    passwordPreviousFocusRef.current = null
    if (!previousFocus?.isConnected) return
    window.requestAnimationFrame(() => previousFocus.focus({ preventScroll: true }))
  }, [])

  const focusTechnicalRow = useCallback(() => {
    window.requestAnimationFrame(() => technicalRowRef.current?.focus({ preventScroll: true }))
  }, [])

  const restoreSettingsFocus = useCallback(() => {
    const previousFocus = settingsPreviousFocusRef.current
    settingsPreviousFocusRef.current = null
    if (!previousFocus?.isConnected) return
    window.requestAnimationFrame(() => previousFocus.focus({ preventScroll: true }))
  }, [])

  const closePasswordMenu = useCallback(() => {
    setPasswordOpen(false)
    setTechnicalPassword('')
    setTechnicalPasswordError(false)
    restorePasswordFocus()
  }, [restorePasswordFocus])

  const resetTechnicalTapState = useCallback(() => {
    technicalTapCountRef.current = 0
    technicalTapStartedAtRef.current = 0
    if (technicalTapResetTimerRef.current !== null) {
      window.clearTimeout(technicalTapResetTimerRef.current)
      technicalTapResetTimerRef.current = null
    }
  }, [])

  const closePanel = useCallback(() => {
    resetTechnicalTapState()
    setPasswordOpen(false)
    setTechnicalPassword('')
    setTechnicalPasswordError(false)
    passwordPreviousFocusRef.current = null
    restoreSettingsFocus()
    setTechnicalUnlocked(false)
    setView('settings')
    onClose()
  }, [onClose, resetTechnicalTapState, restoreSettingsFocus])

  useEffect(() => {
    setAvatarFailed(false)
  }, [account?.avatarUrl])

  useEffect(() => {
    const activeElement = document.activeElement
    settingsPreviousFocusRef.current = activeElement instanceof HTMLElement
      && activeElement !== document.body
      && activeElement !== document.documentElement
      ? activeElement
      : null
    const frame = window.requestAnimationFrame(() => settingsCloseButtonRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const handlePanelKeyDown = (event: KeyboardEvent) => {
      if (passwordOpen || event.key !== 'Tab') return
      const panel = settingsPanelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement
      if (event.shiftKey && (activeElement === first || !panel.contains(activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (activeElement === last || !panel.contains(activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handlePanelKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handlePanelKeyDown, true)
    }
  }, [passwordOpen])

  useEffect(() => {
    setWsIp(settings.wsIp)
    setDynamicPort(String(settings.dynamicPort))
    setInteractivePort(String(settings.interactivePort))
  }, [settings.dynamicPort, settings.interactivePort, settings.wsIp])

  useEffect(() => {
    if (!passwordOpen) return
    const frame = window.requestAnimationFrame(() => technicalPasswordInputRef.current?.focus())
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const dialog = technicalPasswordDialogRef.current
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement
      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleDialogKeyDown, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleDialogKeyDown, true)
    }
  }, [passwordOpen])

  useEffect(() => {
    if (view !== 'technical' || !technicalUnlocked) return
    const frame = window.requestAnimationFrame(() => technicalIpInputRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [technicalUnlocked, view])

  useEffect(() => () => {
    if (technicalTapResetTimerRef.current !== null) {
      window.clearTimeout(technicalTapResetTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (passwordOpen) {
        closePasswordMenu()
      } else if (view !== 'settings') {
        if (view === 'technical') resetTechnicalDrafts()
        setView('settings')
        if (view === 'technical') focusTechnicalRow()
      } else {
        closePanel()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [closePanel, closePasswordMenu, focusTechnicalRow, passwordOpen, resetTechnicalDrafts, view])

  const handleTechnicalTap = () => {
    if (technicalUnlocked) {
      setView('technical')
      return
    }

    const now = Date.now()
    if (
      technicalTapStartedAtRef.current === 0
      || now - technicalTapStartedAtRef.current > TECHNICAL_TAP_WINDOW_MS
    ) {
      technicalTapStartedAtRef.current = now
      technicalTapCountRef.current = 0
    }

    technicalTapCountRef.current += 1
    if (technicalTapCountRef.current >= TECHNICAL_TAP_COUNT) {
      resetTechnicalTapState()
      const activeElement = document.activeElement
      passwordPreviousFocusRef.current = activeElement instanceof HTMLElement
        && activeElement !== document.body
        && activeElement !== document.documentElement
        ? activeElement
        : technicalRowRef.current
      setTechnicalPassword('')
      setTechnicalPasswordError(false)
      setPasswordOpen(true)
      return
    }

    if (technicalTapResetTimerRef.current !== null) {
      window.clearTimeout(technicalTapResetTimerRef.current)
    }
    technicalTapResetTimerRef.current = window.setTimeout(resetTechnicalTapState, TECHNICAL_TAP_WINDOW_MS)
  }

  const handleTechnicalPasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (technicalPassword.trim() !== TECHNICAL_PASSWORD) {
      setTechnicalPasswordError(true)
      technicalPasswordInputRef.current?.select()
      return
    }

    setTechnicalPasswordError(false)
    setTechnicalPassword('')
    setPasswordOpen(false)
    passwordPreviousFocusRef.current = null
    setTechnicalUnlocked(true)
    setView('technical')
  }

  const handleTechnicalSave = () => {
    onSave({
      wsIp: wsIp.trim() || settings.wsIp,
      dynamicPort: normalizePortInput(dynamicPort, settings.dynamicPort),
      interactivePort: normalizePortInput(interactivePort, settings.interactivePort),
      advancedFeaturesEnabled: settings.advancedFeaturesEnabled,
      watermarkEnabled
    })
    setView('settings')
    focusTechnicalRow()
  }

  const handleTechnicalCancel = () => {
    resetTechnicalDrafts()
    setView('settings')
    focusTechnicalRow()
  }

  const handleShowQrCode = () => {
    onShowQrCode(settings.wsIp, settings.interactivePort)
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

  const viewTitle = view === 'language'
    ? t('settings.languageTitle')
    : view === 'technical'
      ? t('settings.technicalTitle')
      : view === 'help'
        ? t('settings.helpCenter')
        : view === 'terms'
          ? t('settings.terms')
          : view === 'privacy'
            ? t('settings.privacyPolicy')
            : view === 'licenses'
              ? t('settings.licenses')
              : t('settings.title')

  const renderLanguageView = () => (
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
  )

  const renderTechnicalView = () => (
    <div className="settings-detail-view">
      <div className="settings-scroll-body settings-detail-scroll">
        <div className="settings-detail-intro">
          <span className="settings-detail-intro-icon" aria-hidden="true"><Wrench /></span>
          <p>{t('settings.technicalNetworkHint')}</p>
        </div>

        <section className="settings-detail-section" aria-labelledby="settings-network-title">
          <h3 id="settings-network-title">{t('settings.connectionSection')}</h3>
          <label className="settings-field">
            <span>{t('settings.galleryIp')}</span>
            <input
              ref={technicalIpInputRef}
              type="text"
              value={wsIp}
              onChange={(event) => setWsIp(event.target.value)}
              className="ipad-input"
              placeholder="192.168.8.101"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
              inputMode="numeric"
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
              inputMode="numeric"
            />
          </label>
        </section>
      </div>

      <div className="settings-detail-footer">
        <button type="button" className="ipad-button secondary-button" onClick={handleTechnicalCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" className="ipad-button primary-button" onClick={handleTechnicalSave}>
          {t('common.save')}
        </button>
      </div>
    </div>
  )

  const helpCards: Array<{ icon: ReactNode; title: string; body: string }> = [
    { icon: <Sparkles />, title: t('settings.helpGettingStarted'), body: t('settings.helpGettingStartedBody') },
    { icon: <Network />, title: t('settings.helpConnectExe'), body: t('settings.helpConnectExeBody') },
    { icon: <FileText />, title: t('settings.helpUpload'), body: t('settings.helpUploadBody') },
    { icon: <CircleHelp />, title: t('settings.helpStageControl'), body: t('settings.helpStageControlBody') },
    { icon: <ShieldCheck />, title: t('settings.helpFaq'), body: t('settings.helpFaqBody') }
  ]

  const renderHelpView = () => (
    <div className="settings-document-scroll settings-help-view">
      <div className="settings-detail-intro">
        <span className="settings-detail-intro-icon" aria-hidden="true"><CircleHelp /></span>
        <p>{t('settings.helpIntro')}</p>
      </div>
      <div className="settings-help-list">
        {helpCards.map(({ icon, title, body }) => (
          <article key={title} className="settings-help-card">
            <span className="settings-help-card-icon" aria-hidden="true">{icon}</span>
            <div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="settings-help-contact">
        <MessageSquare aria-hidden="true" />
        <div>
          <strong>{t('settings.feedback')}</strong>
          <p>{t('settings.feedbackSummary')}</p>
        </div>
      </div>
    </div>
  )

  const renderLegalView = () => {
    const legalCopy = LEGAL_CONTENT[currentLocale]
    const legalBody = view === 'terms'
      ? legalCopy.terms
      : view === 'privacy'
        ? legalCopy.privacy
        : legalCopy.licenses
    const legalBlocks = legalBody.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)

    return (
      <div className="settings-document-scroll settings-legal-view">
        <div className="settings-legal-meta">
          <span>{t('settings.legalEffectiveDate', { date: LEGAL_EFFECTIVE_DATE })}</span>
          <strong>MagicFloor</strong>
        </div>
        <p className="settings-legal-notice">{legalCopy.notice}</p>
        <div className="settings-document-body settings-legal-content">
          {legalBlocks.map((block, index) => {
            const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
            const heading = lines[0] ?? ''
            const copy = lines.slice(1).join('\n')
            return (
              <section key={`${view}-${index}`} className="settings-legal-section">
                <h3>{heading}</h3>
                {copy && <p>{copy}</p>}
              </section>
            )
          })}
        </div>
      </div>
    )
  }

  const renderView = () => {
    if (view === 'language') return renderLanguageView()
    if (view === 'technical') return renderTechnicalView()
    if (view === 'help') return renderHelpView()
    if (view === 'terms' || view === 'privacy' || view === 'licenses') return renderLegalView()

    return (
      <>
        <div className="settings-scroll-body settings-home-scroll">
          <section className="settings-account-section" aria-labelledby="settings-account-title">
            <h3 id="settings-account-title">{t('settings.accountSection')}</h3>
            <div
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
            </div>
          </section>

          <section className="settings-menu-section" aria-labelledby="settings-general-title">
            <h3 id="settings-general-title">{t('settings.generalSection')}</h3>
            <div className="settings-menu-group">
              <SettingsRow
                icon={<Languages />}
                title={t('settings.language')}
                summary={currentLanguage}
                onClick={() => setView('language')}
                ariaLabel={`${t('settings.language')}: ${currentLanguage}`}
              />
            </div>
          </section>

          <section className="settings-menu-section" aria-labelledby="settings-connection-title">
            <h3 id="settings-connection-title">{t('settings.connectionSection')}</h3>
            <div className="settings-menu-group">
              <SettingsRow
                icon={<QrCode />}
                title={t('settings.showQrCode')}
                summary={t('settings.qrSummary')}
                onClick={handleShowQrCode}
              />
            </div>
          </section>

          <section className="settings-menu-section" aria-labelledby="settings-support-title">
            <h3 id="settings-support-title">{t('settings.supportSection')}</h3>
            <div className="settings-menu-group">
              <SettingsRow
                icon={<CircleHelp />}
                title={t('settings.helpCenter')}
                summary={t('settings.helpCenterSummary')}
                onClick={() => setView('help')}
              />
              <SettingsRow
                icon={<MessageSquare />}
                title={t('settings.feedback')}
                summary={t('settings.feedbackSummary')}
                onClick={() => setView('help')}
              />
            </div>
          </section>

          <section className="settings-menu-section" aria-labelledby="settings-legal-title">
            <h3 id="settings-legal-title">{t('settings.legalSection')}</h3>
            <div className="settings-menu-group">
              <SettingsRow
                icon={<FileText />}
                title={t('settings.terms')}
                summary={t('settings.termsSummary')}
                onClick={() => setView('terms')}
              />
              <SettingsRow
                icon={<ShieldCheck />}
                title={t('settings.privacyPolicy')}
                summary={t('settings.privacyPolicySummary')}
                onClick={() => setView('privacy')}
              />
              <SettingsRow
                icon={<Check />}
                title={t('settings.licenses')}
                summary={t('settings.licensesSummary')}
                onClick={() => setView('licenses')}
              />
            </div>
          </section>

          <section className="settings-menu-section" aria-labelledby="settings-technical-title">
            <h3 id="settings-technical-title">{t('settings.technicalSection')}</h3>
            <div className="settings-menu-group">
              <button
                type="button"
                ref={technicalRowRef}
                className={`settings-menu-row settings-technical-row ${technicalUnlocked ? 'is-unlocked' : 'is-locked'}`}
                onClick={handleTechnicalTap}
                aria-label={`${t('settings.technicalSection')}: ${technicalUnlocked
                  ? t('settings.technicalSummary')
                  : t('settings.technicalLocked')}`}
                aria-describedby={technicalUnlocked ? undefined : 'settings-technical-hint'}
                title={technicalUnlocked ? t('settings.technicalSummary') : t('settings.technicalUnlockHint')}
              >
                <span className="settings-menu-icon" aria-hidden="true">
                  {technicalUnlocked ? <Wrench /> : <LockKeyhole />}
                </span>
                <span className="settings-menu-copy">
                  <strong>{t('settings.technicalSection')}</strong>
                  <small>{technicalUnlocked ? t('settings.technicalSummary') : t('settings.technicalLocked')}</small>
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
            <span id="settings-technical-hint" className="settings-visually-hidden">{t('settings.technicalTapHint')}</span>
          </section>

          <p className="settings-version-note">{t('settings.versionLabel', { version: '1.0' })}</p>
        </div>

        <div className="settings-footer">
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
    )
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
      <button type="button" className="settings-scrim" onClick={closePanel} aria-label={t('settings.close')} />
      <aside ref={settingsPanelRef} className="settings-panel" tabIndex={-1}>
        <div className="settings-heading">
          {view === 'settings' ? (
            <div>
              <p className="eyebrow">MagicFloor</p>
              <h2>{t('settings.title')}</h2>
            </div>
          ) : (
            <button
              type="button"
              className="settings-heading-back"
              onClick={() => {
                if (view === 'technical') resetTechnicalDrafts()
                setView('settings')
                if (view === 'technical') focusTechnicalRow()
              }}
              aria-label={t('settings.backToSettings')}
            >
              <ArrowLeft aria-hidden="true" />
              <span>{viewTitle}</span>
            </button>
          )}
          <button
            ref={settingsCloseButtonRef}
            type="button"
            className="mini-action-button"
            onClick={closePanel}
            aria-label={t('common.close')}
          >
            <X aria-hidden="true" />
            <span>{t('common.close')}</span>
          </button>
        </div>

        <div className={`settings-view settings-view-${view}`} key={view}>
          {renderView()}
        </div>
      </aside>

      {passwordOpen && (
        <div className="settings-password-overlay" role="presentation">
          <button
            type="button"
            className="settings-password-scrim"
            onClick={closePasswordMenu}
            aria-label={t('settings.technicalCancel')}
          />
          <form
            ref={technicalPasswordDialogRef}
            className="settings-password-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-password-title"
            onSubmit={handleTechnicalPasswordSubmit}
          >
            <div className="settings-password-heading">
              <span className="settings-password-icon" aria-hidden="true"><LockKeyhole /></span>
              <button
                type="button"
                className="settings-password-close"
                onClick={closePasswordMenu}
                aria-label={t('settings.technicalCancel')}
                title={t('settings.technicalCancel')}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <h2 id="settings-password-title">{t('settings.technicalPasswordTitle')}</h2>
            <p>{t('settings.technicalPasswordPrompt')}</p>
            <label className="settings-password-field">
              <span>{t('settings.technicalPasswordPlaceholder')}</span>
              <input
                ref={technicalPasswordInputRef}
                type="password"
                value={technicalPassword}
                onChange={(event) => {
                  setTechnicalPassword(event.target.value.replace(/\D/g, '').slice(0, 3))
                  setTechnicalPasswordError(false)
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                autoComplete="off"
                aria-invalid={technicalPasswordError}
                aria-describedby={technicalPasswordError ? 'settings-password-error' : undefined}
              />
            </label>
            {technicalPasswordError && (
              <p id="settings-password-error" className="settings-password-error" role="alert">
                {t('settings.technicalPasswordError')}
              </p>
            )}
            <div className="settings-password-actions">
              <button type="button" className="ipad-button secondary-button" onClick={closePasswordMenu}>
                {t('settings.technicalCancel')}
              </button>
              <button type="submit" className="ipad-button primary-button">
                {t('settings.technicalUnlock')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default SettingsPanel
