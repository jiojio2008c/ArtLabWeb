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

type AppCloseScope = 'dynamic-art' | 'interactive-art'

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
const APP_CLOSE_COMMAND_PREFIX = 'MF|AppLauncher|Close|'
const REMOTE_KEYBOARD_COMMAND_PREFIX = 'MF|RemoteKeyboard|'
const QR_CODE_COMMAND = 'QrCode'
const UNITY_ASYNC_REQUEST_TIMEOUT_MS = 15000

const DYNAMIC_REVISION_STORAGE_KEY = 'magicfloor_dynamic_state_revision_v1'
const DYNAMIC_STATE_REVISION_EVENTS = new Set([
  'GroupCreate',
  'GroupUpdate',
  'GroupDelete',
  'GroupAppearMode',
  'GroupStateSync',
  'GroupSelectAndSync',
  'BackgroundSet',
  'BackgroundDelete',
  'BackgroundPlayback',
  'ItemCreate',
  'ItemUpdate',
  'ItemDelete',
  'ItemTransform',
  'ItemDeform',
  'ItemAnimation',
  'ItemMotion',
  'ItemSettingsCopy'
])
const DYNAMIC_SELECTION_EVENTS = new Set([
  'GroupSelect',
  'GroupStateSync',
  'GroupSelectAndSync',
  'PreviewMode'
])

interface DynamicRevisionStorage {
  groups: Record<string, number>
  selectionRevision: number
}

let fallbackDynamicRevisionStorage: DynamicRevisionStorage = {
  groups: {},
  selectionRevision: 0
}

const canUseDynamicRevisionStorage = () => (
  typeof window !== 'undefined' && Boolean(window.localStorage)
)

const loadDynamicRevisionStorage = (): DynamicRevisionStorage => {
  if (!canUseDynamicRevisionStorage()) {
    return {
      groups: { ...fallbackDynamicRevisionStorage.groups },
      selectionRevision: fallbackDynamicRevisionStorage.selectionRevision
    }
  }

  try {
    const raw = window.localStorage.getItem(DYNAMIC_REVISION_STORAGE_KEY)
    if (!raw) return {
      groups: { ...fallbackDynamicRevisionStorage.groups },
      selectionRevision: fallbackDynamicRevisionStorage.selectionRevision
    }
    const parsed = JSON.parse(raw) as Partial<DynamicRevisionStorage>
    const groups = Object.fromEntries(
      Object.entries(parsed.groups ?? {})
        .map(([groupId, revision]) => [groupId, Number(revision)] as const)
        .filter((entry) => Number.isFinite(entry[1]) && entry[1] > 0)
    )
    const selectionRevision = Number(parsed.selectionRevision)
    const nextState = {
      groups,
      selectionRevision: Number.isFinite(selectionRevision) && selectionRevision > 0
        ? selectionRevision
        : 0
    }
    fallbackDynamicRevisionStorage = nextState
    return nextState
  } catch {
    return {
      groups: { ...fallbackDynamicRevisionStorage.groups },
      selectionRevision: fallbackDynamicRevisionStorage.selectionRevision
    }
  }
}

const saveDynamicRevisionStorage = (state: DynamicRevisionStorage) => {
  fallbackDynamicRevisionStorage = {
    groups: { ...state.groups },
    selectionRevision: state.selectionRevision
  }
  if (!canUseDynamicRevisionStorage()) return
  try {
    window.localStorage.setItem(DYNAMIC_REVISION_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Network messages remain usable when local persistence is unavailable.
  }
}

const nextDynamicRevision = (previous: number, candidate?: number) => {
  const normalizedCandidate = Number(candidate)
  const minimum = Number.isFinite(normalizedCandidate) && normalizedCandidate > 0
    ? Math.floor(normalizedCandidate)
    : Date.now()
  return Math.max(minimum, previous + 1)
}

const reserveDynamicGroupStateRevision = (groupId: string, candidate?: number) => {
  const normalizedGroupId = String(groupId || '').trim()
  if (!normalizedGroupId) return nextDynamicRevision(0, candidate)
  const state = loadDynamicRevisionStorage()
  const nextRevision = nextDynamicRevision(state.groups[normalizedGroupId] ?? 0, candidate)
  state.groups[normalizedGroupId] = nextRevision
  saveDynamicRevisionStorage(state)
  return nextRevision
}

const reserveDynamicSelectionRevision = (candidate?: number) => {
  const state = loadDynamicRevisionStorage()
  const nextRevision = nextDynamicRevision(state.selectionRevision, candidate)
  state.selectionRevision = nextRevision
  saveDynamicRevisionStorage(state)
  return nextRevision
}

const isValidDynamicRevision = (value: unknown) => {
  const revision = Number(value)
  return Number.isFinite(revision) && revision > 0
}

const prepareDynamicEventPayload = (
  eventName: string,
  payload: Record<string, unknown>
) => {
  const nextPayload = { ...payload }
  const groupId = String(nextPayload.groupId ?? '').trim()

  if (
    groupId
    && DYNAMIC_STATE_REVISION_EVENTS.has(eventName)
    && !isValidDynamicRevision(nextPayload.stateRevision)
  ) {
    nextPayload.stateRevision = reserveDynamicGroupStateRevision(groupId)
  }

  if (
    DYNAMIC_SELECTION_EVENTS.has(eventName)
    && !isValidDynamicRevision(nextPayload.selectionRevision)
  ) {
    nextPayload.selectionRevision = reserveDynamicSelectionRevision()
  }

  return nextPayload
}

const prepareDynamicUploadFields = (
  fields: Record<string, string | number | boolean | undefined> = {}
) => {
  const nextFields = { ...fields }
  const groupId = String(nextFields.groupId ?? '').trim()
  if (groupId && !isValidDynamicRevision(nextFields.stateRevision)) {
    nextFields.stateRevision = reserveDynamicGroupStateRevision(groupId)
  }
  return nextFields
}

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

const makeAppCloseCommandMessage = (scope: AppCloseScope) => {
  return `${APP_CLOSE_COMMAND_PREFIX}${scope}`
}

const sendAppCloseCommand = (ip: string, port: number, scope: AppCloseScope) => {
  sendUnityText(ip, port, makeAppCloseCommandMessage(scope))
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
    xhr.timeout = UNITY_ASYNC_REQUEST_TIMEOUT_MS
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

  Object.entries(prepareDynamicUploadFields(fields)).forEach(([key, value]) => {
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

  Object.entries(prepareDynamicUploadFields(fields)).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.append(key, String(value))
    }
  })

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUnityUrl(trimmedIp, port), true)
    xhr.timeout = UNITY_ASYNC_REQUEST_TIMEOUT_MS
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let responsePayload: { stateIgnored?: boolean } | null = null
        try {
          const parsed = JSON.parse(xhr.responseText)
          if (parsed && typeof parsed === 'object') {
            responsePayload = parsed as { stateIgnored?: boolean }
          }
        } catch {
          responsePayload = null
        }
        if (responsePayload?.stateIgnored === true) {
          reject(new Error('Asset upload ignored because its state revision is stale'))
          return
        }
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
  return `MF|DynamicArt|${eventName}|${JSON.stringify(prepareDynamicEventPayload(eventName, payload))}`
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
  APP_CLOSE_COMMAND_PREFIX,
  REMOTE_KEYBOARD_COMMAND_PREFIX,
  UNITY_ASYNC_REQUEST_TIMEOUT_MS,
  buildUnityUrl,
  makeAppCloseCommandMessage,
  makeDynamicEventMessage,
  makeRemoteKeyboardPressMessage,
  makeRemoteKeyboardTurnMessage,
  reserveDynamicGroupStateRevision,
  reserveDynamicSelectionRevision,
  sendAppCloseCommand,
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
export type { AppCloseScope, AppLauncherId, RemoteKeyboardControl, RemoteKeyboardKey }
