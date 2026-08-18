interface UploadUnityAssetOptions {
  ip: string
  port: number
  file: File
  fields?: Record<string, string | number | boolean | undefined>
}

type AppLauncherId =
  | 'dynamic-art'
  | 'interactive-forest-1'
  | 'interactive-forest-2'
  | 'interactive-painting-real'
  | 'interactive-ocean'

type RemoteKeyboardKey =
  | 'Escape'
  | 'Home'
  | 'LeftControl'
  | 'LeftShift'
  | 'LeftAlt'
  | 'F4'
  | 'Space'
  | 'N'
  | 'F'
  | 'End'
  | 'PageDown'
  | 'Alpha1'
  | 'Alpha2'
  | 'Alpha3'
  | 'Alpha4'
  | 'Alpha5'
  | 'Alpha6'
  | 'Alpha7'
  | 'Alpha8'
  | 'Minus'
  | 'Plus'
  | 'UpArrow'
  | 'DownArrow'
  | 'LeftArrow'
  | 'RightArrow'

type RemoteKeyboardControl = 'volume' | 'vertical' | 'horizontal'

const APP_LAUNCH_COMMAND_PREFIX = 'MF|AppLauncher|Launch|'
const REMOTE_KEYBOARD_COMMAND_PREFIX = 'MF|RemoteKeyboard|'
const QR_CODE_COMMAND = 'QrCode'

const buildUnityUrl = (ip: string, port: number) => `http://${ip.trim()}:${port}`

const sendUnityText = (ip: string, port: number, message: string) => {
  const trimmedIp = ip.trim()
  if (!trimmedIp) return

  const xhr = new XMLHttpRequest()
  xhr.open('POST', buildUnityUrl(trimmedIp, port), true)
  xhr.setRequestHeader('Content-Type', 'text/plain')
  xhr.send(message)
}

const sendAppLaunchCommand = (ip: string, port: number, appId: AppLauncherId) => {
  sendUnityText(ip, port, `${APP_LAUNCH_COMMAND_PREFIX}${appId}`)
}

const sendQrCodeCommand = (ip: string, port: number) => {
  sendUnityText(ip, port, QR_CODE_COMMAND)
}

const makeRemoteKeyboardPressMessage = (keys: readonly RemoteKeyboardKey[]) => {
  return `${REMOTE_KEYBOARD_COMMAND_PREFIX}Press|${JSON.stringify({ keys })}`
}

const makeRemoteKeyboardTurnMessage = (
  control: RemoteKeyboardControl,
  key: RemoteKeyboardKey,
  steps: number
) => {
  const normalizedSteps = Math.min(32, Math.max(1, Math.round(steps)))
  return `${REMOTE_KEYBOARD_COMMAND_PREFIX}Turn|${JSON.stringify({
    control,
    key,
    steps: normalizedSteps
  })}`
}

const sendRemoteKeyboardPress = (
  ip: string,
  port: number,
  keys: readonly RemoteKeyboardKey[]
) => {
  if (keys.length === 0) return
  sendUnityText(ip, port, makeRemoteKeyboardPressMessage(keys))
}

const sendRemoteKeyboardTurn = (
  ip: string,
  port: number,
  control: RemoteKeyboardControl,
  key: RemoteKeyboardKey,
  steps: number
) => {
  sendUnityText(ip, port, makeRemoteKeyboardTurnMessage(control, key, steps))
}

const sendUnityTextAsync = (ip: string, port: number, message: string) => {
  const trimmedIp = ip.trim()
  if (!trimmedIp) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUnityUrl(trimmedIp, port), true)
    xhr.setRequestHeader('Content-Type', 'text/plain')
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Request failed with status ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Network request failed'))
    xhr.ontimeout = () => reject(new Error('Network request timed out'))
    xhr.send(message)
  })
}

const uploadUnityAsset = ({ ip, port, file, fields }: UploadUnityAssetOptions) => {
  const trimmedIp = ip.trim()
  if (!trimmedIp) return

  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', file.name)

  Object.entries(fields ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.append(key, String(value))
    }
  })

  const xhr = new XMLHttpRequest()
  xhr.open('POST', buildUnityUrl(trimmedIp, port), true)
  xhr.send(formData)
}

const uploadUnityAssetAsync = ({ ip, port, file, fields }: UploadUnityAssetOptions) => {
  const trimmedIp = ip.trim()
  if (!trimmedIp) return Promise.resolve()

  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', file.name)

  Object.entries(fields ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.append(key, String(value))
    }
  })

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUnityUrl(trimmedIp, port), true)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Asset upload failed with status ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Asset upload network request failed'))
    xhr.ontimeout = () => reject(new Error('Asset upload request timed out'))
    xhr.send(formData)
  })
}

const makeDynamicEventMessage = (eventName: string, payload: Record<string, unknown>) => {
  return `MF|DynamicArt|${eventName}|${JSON.stringify(payload)}`
}

const sendDynamicEvent = (
  ip: string,
  port: number,
  eventName: string,
  payload: Record<string, unknown>
) => {
  sendUnityText(ip, port, makeDynamicEventMessage(eventName, payload))
}

const sendDynamicEventAsync = (
  ip: string,
  port: number,
  eventName: string,
  payload: Record<string, unknown>
) => {
  return sendUnityTextAsync(ip, port, makeDynamicEventMessage(eventName, payload))
}

export {
  APP_LAUNCH_COMMAND_PREFIX,
  REMOTE_KEYBOARD_COMMAND_PREFIX,
  buildUnityUrl,
  makeDynamicEventMessage,
  makeRemoteKeyboardPressMessage,
  makeRemoteKeyboardTurnMessage,
  sendAppLaunchCommand,
  sendDynamicEvent,
  sendDynamicEventAsync,
  sendQrCodeCommand,
  sendRemoteKeyboardPress,
  sendRemoteKeyboardTurn,
  sendUnityText,
  sendUnityTextAsync,
  uploadUnityAsset,
  uploadUnityAssetAsync
}
export type { AppLauncherId, RemoteKeyboardControl, RemoteKeyboardKey }
