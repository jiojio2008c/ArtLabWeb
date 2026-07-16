const LAST_WS_IP_KEY = 'artlab_last_ws_ip'
const DEFAULT_WS_IP = '192.168.8.101'
const NETWORK_SETTINGS_KEY = 'magicfloor_network_settings_v1'
const DEFAULT_DYNAMIC_PORT = 8080
const DEFAULT_INTERACTIVE_PORT = 11701

interface NetworkSettings {
  wsIp: string
  dynamicPort: number
  interactivePort: number
}

const canUseLocalStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage)

const loadLastWsIp = () => {
  if (!canUseLocalStorage()) return DEFAULT_WS_IP

  try {
    const savedIp = localStorage.getItem(LAST_WS_IP_KEY)?.trim()
    return savedIp || DEFAULT_WS_IP
  } catch {
    return DEFAULT_WS_IP
  }
}

const saveLastWsIp = (ip: string) => {
  const trimmedIp = ip.trim()
  if (!trimmedIp || !canUseLocalStorage()) return

  try {
    localStorage.setItem(LAST_WS_IP_KEY, trimmedIp)
  } catch {
    // Ignore persistence errors so network controls keep working.
  }
}

const normalizePort = (value: unknown, fallback: number) => {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) return fallback
  return Math.min(65535, Math.max(1, Math.round(parsedValue)))
}

const loadNetworkSettings = (): NetworkSettings => {
  const fallback: NetworkSettings = {
    wsIp: loadLastWsIp(),
    dynamicPort: DEFAULT_DYNAMIC_PORT,
    interactivePort: DEFAULT_INTERACTIVE_PORT
  }

  if (!canUseLocalStorage()) return fallback

  try {
    const raw = localStorage.getItem(NETWORK_SETTINGS_KEY)
    if (!raw) return fallback

    const parsed = JSON.parse(raw) as Partial<NetworkSettings>
    return {
      wsIp: parsed.wsIp?.trim() || fallback.wsIp,
      dynamicPort: normalizePort(parsed.dynamicPort, fallback.dynamicPort),
      interactivePort: normalizePort(parsed.interactivePort, fallback.interactivePort)
    }
  } catch {
    return fallback
  }
}

const saveNetworkSettings = (settings: NetworkSettings) => {
  const nextSettings: NetworkSettings = {
    wsIp: settings.wsIp.trim() || DEFAULT_WS_IP,
    dynamicPort: normalizePort(settings.dynamicPort, DEFAULT_DYNAMIC_PORT),
    interactivePort: normalizePort(settings.interactivePort, DEFAULT_INTERACTIVE_PORT)
  }

  saveLastWsIp(nextSettings.wsIp)

  if (!canUseLocalStorage()) return

  try {
    localStorage.setItem(NETWORK_SETTINGS_KEY, JSON.stringify(nextSettings))
  } catch {
    // Ignore persistence errors; the current session can still use the settings.
  }
}

export type { NetworkSettings }
export {
  DEFAULT_DYNAMIC_PORT,
  DEFAULT_INTERACTIVE_PORT,
  DEFAULT_WS_IP,
  LAST_WS_IP_KEY,
  NETWORK_SETTINGS_KEY,
  loadLastWsIp,
  loadNetworkSettings,
  saveLastWsIp,
  saveNetworkSettings
}
