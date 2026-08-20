import { useEffect, useRef, useState } from 'react'
import { Check, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLoginErrorKey, loginWithPassword } from '../services/authService.ts'
import { playUiSound } from '../services/uiFeedback.ts'
import BrandLogo from './BrandLogo.tsx'

interface LoginPageProps {
  checkingSession: boolean
  onAuthenticated: () => void
}

interface FieldErrors {
  email?: string
  password?: string
}

const LOGIN_EXIT_DELAY_MS = 320

const LoginPage: React.FC<LoginPageProps> = ({ checkingSession, onAuthenticated }) => {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginComplete, setLoginComplete] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const completionTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current)
      }
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || loginComplete) return

    const nextErrors: FieldErrors = {}
    if (!email.trim()) nextErrors.email = t('auth.emailRequired')
    if (!password) nextErrors.password = t('auth.passwordRequired')

    setFieldErrors(nextErrors)
    setFormError('')

    if (nextErrors.email) {
      emailInputRef.current?.focus()
      return
    }
    if (nextErrors.password) {
      passwordInputRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    try {
      await loginWithPassword(email, password)
      setLoginComplete(true)
      playUiSound('success')
      completionTimerRef.current = window.setTimeout(() => {
        completionTimerRef.current = null
        onAuthenticated()
      }, LOGIN_EXIT_DELAY_MS)
    } catch (error) {
      setFormError(t(getLoginErrorKey(error)))
      passwordInputRef.current?.focus()
      passwordInputRef.current?.select()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main
      className={`ipad-screen login-screen ${checkingSession ? 'session-checking' : ''} ${loginComplete ? 'login-complete' : ''}`}
    >
      <header className="login-topbar">
        <BrandLogo />
      </header>

      <section className="login-workspace" aria-busy={checkingSession || isSubmitting}>
        {!checkingSession && (
          <form className="login-panel" onSubmit={handleSubmit} noValidate>
            <div className="login-heading">
              <p className="eyebrow">MagicFloor</p>
              <h1>{t('auth.signIn')}</h1>
            </div>

            <div className="login-fields">
              <div className="login-field">
                <label htmlFor="login-email">{t('auth.email')}</label>
                <span className={`login-input-shell ${fieldErrors.email ? 'has-error' : ''}`}>
                  <Mail aria-hidden="true" />
                  <input
                    id="login-email"
                    ref={emailInputRef}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }))
                      if (formError) setFormError('')
                    }}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                    disabled={isSubmitting || loginComplete}
                  />
                </span>
                {fieldErrors.email && <small id="login-email-error">{fieldErrors.email}</small>}
              </div>

              <div className="login-field">
                <label htmlFor="login-password">{t('auth.password')}</label>
                <span className={`login-input-shell ${fieldErrors.password ? 'has-error' : ''}`}>
                  <LockKeyhole aria-hidden="true" />
                  <input
                    id="login-password"
                    ref={passwordInputRef}
                    type={passwordVisible ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }))
                      if (formError) setFormError('')
                    }}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                    disabled={isSubmitting || loginComplete}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setPasswordVisible((current) => !current)}
                    aria-label={passwordVisible ? t('auth.hidePassword') : t('auth.showPassword')}
                    disabled={isSubmitting || loginComplete}
                  >
                    {passwordVisible ? <EyeOff /> : <Eye />}
                  </button>
                </span>
                {fieldErrors.password && <small id="login-password-error">{fieldErrors.password}</small>}
              </div>
            </div>

            <div className="login-message" role="status" aria-live="polite">
              {formError}
            </div>

            <button
              type="submit"
              className={`ipad-button primary-button login-submit ${loginComplete ? 'success-button' : ''}`}
              disabled={isSubmitting || loginComplete}
              data-silent={loginComplete ? 'true' : undefined}
            >
              {loginComplete ? <Check aria-hidden="true" /> : null}
              {loginComplete ? t('auth.signInSuccess') : isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

export default LoginPage
