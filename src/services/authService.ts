import type { AuthChangeEvent, Session } from '@supabase/auth-js'
import { supabaseAuth } from './supabaseClient.ts'

const getCurrentSession = async (): Promise<Session | null> => {
  const { data, error } = await supabaseAuth.getSession()
  if (error) throw error
  if (!data.session) return null

  const { data: userData, error: userError } = await supabaseAuth.getUser()
  if (userError || !userData.user) {
    await supabaseAuth.signOut({ scope: 'local' })
    return null
  }

  return data.session
}

const loginWithPassword = async (email: string, password: string): Promise<Session> => {
  const { data, error } = await supabaseAuth.signInWithPassword({
    email: email.trim(),
    password
  })

  if (error) throw error
  if (!data.session) throw new Error('Supabase did not return an authenticated session')
  return data.session
}

const logoutCurrentSession = async () => {
  const { error } = await supabaseAuth.signOut({ scope: 'local' })
  if (error) throw error
}

const subscribeToAuthChanges = (
  listener: (event: AuthChangeEvent, session: Session | null) => void
) => {
  const { data } = supabaseAuth.onAuthStateChange(listener)
  return () => data.subscription.unsubscribe()
}

const getLoginErrorKey = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  if (
    (typeof navigator !== 'undefined' && !navigator.onLine)
    || message.includes('failed to fetch')
    || message.includes('network')
  ) {
    return 'auth.networkError'
  }

  if (
    message.includes('invalid login credentials')
    || message.includes('invalid_credentials')
    || message.includes('email not confirmed')
  ) {
    return 'auth.invalidCredentials'
  }

  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'auth.tooManyAttempts'
  }

  return 'auth.unavailable'
}

export {
  getCurrentSession,
  getLoginErrorKey,
  loginWithPassword,
  logoutCurrentSession,
  subscribeToAuthChanges
}
