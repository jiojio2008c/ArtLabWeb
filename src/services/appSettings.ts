const LAST_WS_IP_KEY = 'artlab_last_ws_ip'
const DEFAULT_WS_IP = '192.168.8.101'

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

export { DEFAULT_WS_IP, LAST_WS_IP_KEY, loadLastWsIp, saveLastWsIp }
