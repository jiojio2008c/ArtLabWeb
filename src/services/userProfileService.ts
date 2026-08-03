import { supabaseAnonKey, supabaseAuth, supabaseUrl } from './supabaseClient.ts'

interface UserAccount {
  userId: string
  email: string
  displayName: string
  avatarUrl: string | null
}

interface PlayerRow {
  id: string
  name: string | null
  avatar_url: string | null
}

const getMetadataText = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key]
  return typeof value === 'string' ? value.trim() : ''
}

const getFallbackName = (email: string, metadata: Record<string, unknown>) => {
  const metadataName = ['display_name', 'full_name', 'name']
    .map((key) => getMetadataText(metadata, key))
    .find(Boolean)

  if (metadataName) return metadataName
  return email.split('@')[0]?.trim() || ''
}

const normalizeAvatarUrl = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null

  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

const loadCurrentUserAccount = async (signal?: AbortSignal): Promise<UserAccount | null> => {
  const { data, error } = await supabaseAuth.getSession()
  if (error) throw error
  if (!data.session) return null

  const { user, access_token: accessToken } = data.session
  const email = user.email?.trim() || ''
  const fallbackAccount: UserAccount = {
    userId: user.id,
    email,
    displayName: getFallbackName(email, user.user_metadata),
    avatarUrl: null
  }

  const endpoint = new URL(`${supabaseUrl}/rest/v1/players`)
  endpoint.searchParams.set('user_id', `eq.${user.id}`)
  endpoint.searchParams.set('avatar_url', 'not.is.null')
  endpoint.searchParams.set('select', 'id,name,avatar_url')
  endpoint.searchParams.set('order', 'updated_at.desc')
  endpoint.searchParams.set('limit', '1')

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`
      },
      signal
    })

    if (!response.ok) return fallbackAccount

    const rows = await response.json() as PlayerRow[]
    const player = rows[0]
    if (!player) return fallbackAccount

    return {
      ...fallbackAccount,
      displayName: player.name?.trim() || fallbackAccount.displayName,
      avatarUrl: normalizeAvatarUrl(player.avatar_url)
    }
  } catch (error) {
    if (signal?.aborted) throw error
    return fallbackAccount
  }
}

export { loadCurrentUserAccount }
export type { UserAccount }
