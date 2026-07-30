import { GoTrueClient } from '@supabase/auth-js'

const DEFAULT_SUPABASE_URL = 'https://lmlzavksopdunbpckaqh.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtbHphdmtzb3BkdW5icGNrYXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NTQ0NjksImV4cCI6MjA4MDEzMDQ2OX0.xIoX9dkqGgP0_QGj4D6SH7ImPiVVeZ139DGu2i-CaFY'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY

const supabaseAuth = new GoTrueClient({
  url: `${supabaseUrl}/auth/v1`,
  headers: {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`
  },
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: false,
  storageKey: 'magicfloor_supabase_auth_v1'
})

export { supabaseAnonKey, supabaseAuth, supabaseUrl }
