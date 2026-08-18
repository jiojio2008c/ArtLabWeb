import {
  DYNAMIC_CREATION_FLOW_SESSION_VERSION,
  normalizeDynamicCreationFlowSession,
  type DynamicCreationFlowSession,
  type NormalizeDynamicCreationFlowSessionOptions
} from './dynamicCreationFlowCore.js'

const DYNAMIC_CREATION_FLOW_STORAGE_KEY = 'magicfloor_dynamic_creation_flow_v1'

interface DynamicCreationFlowStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

interface DynamicCreationFlowStorageEnvelope {
  version: 1
  sessions: Record<string, unknown>
}

interface DynamicCreationFlowStorageOptions extends NormalizeDynamicCreationFlowSessionOptions {
  storage?: DynamicCreationFlowStorageLike
}

type DynamicCreationFlowSessionUpdate = Partial<DynamicCreationFlowSession>
  | ((session: DynamicCreationFlowSession) => Partial<DynamicCreationFlowSession>)

const getDefaultStorage = (): DynamicCreationFlowStorageLike | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

const resolveStorage = (storage?: DynamicCreationFlowStorageLike) => storage ?? getDefaultStorage()

const createEmptyEnvelope = (): DynamicCreationFlowStorageEnvelope => ({
  version: DYNAMIC_CREATION_FLOW_SESSION_VERSION,
  sessions: {}
})

const readEnvelope = (storage?: DynamicCreationFlowStorageLike): DynamicCreationFlowStorageEnvelope => {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) return createEmptyEnvelope()

  try {
    const raw = resolvedStorage.getItem(DYNAMIC_CREATION_FLOW_STORAGE_KEY)
    if (!raw) return createEmptyEnvelope()

    const parsed = JSON.parse(raw) as Partial<DynamicCreationFlowStorageEnvelope> | undefined
    if (
      !parsed
      || parsed.version !== DYNAMIC_CREATION_FLOW_SESSION_VERSION
      || !parsed.sessions
      || typeof parsed.sessions !== 'object'
      || Array.isArray(parsed.sessions)
    ) return createEmptyEnvelope()

    return {
      version: DYNAMIC_CREATION_FLOW_SESSION_VERSION,
      sessions: { ...parsed.sessions }
    }
  } catch {
    return createEmptyEnvelope()
  }
}

const writeEnvelope = (
  envelope: DynamicCreationFlowStorageEnvelope,
  storage?: DynamicCreationFlowStorageLike
) => {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) return false

  try {
    resolvedStorage.setItem(DYNAMIC_CREATION_FLOW_STORAGE_KEY, JSON.stringify(envelope))
    return true
  } catch {
    return false
  }
}

const getNormalizeOptions = (
  groupId: string,
  options: DynamicCreationFlowStorageOptions,
  now?: number
): NormalizeDynamicCreationFlowSessionOptions => ({
  groupId,
  itemIds: options.itemIds,
  defaultExperience: options.defaultExperience,
  now: now ?? options.now
})

const loadDynamicCreationFlowSession = (
  groupId: string,
  options: DynamicCreationFlowStorageOptions = {}
) => {
  const envelope = readEnvelope(options.storage)
  return normalizeDynamicCreationFlowSession(
    envelope.sessions[groupId],
    getNormalizeOptions(groupId, options)
  )
}

const saveDynamicCreationFlowSession = (
  value: DynamicCreationFlowSession,
  options: DynamicCreationFlowStorageOptions = {}
) => {
  const groupId = String(value.groupId ?? '').trim()
  const updatedAt = options.now ?? Date.now()
  const session = normalizeDynamicCreationFlowSession(
    { ...value, updatedAt },
    getNormalizeOptions(groupId, options, updatedAt)
  )
  if (!groupId) return session

  const envelope = readEnvelope(options.storage)
  envelope.sessions[groupId] = session
  writeEnvelope(envelope, options.storage)
  return session
}

const updateDynamicCreationFlowSession = (
  groupId: string,
  update: DynamicCreationFlowSessionUpdate,
  options: DynamicCreationFlowStorageOptions = {}
) => {
  const currentSession = loadDynamicCreationFlowSession(groupId, options)
  const patch = typeof update === 'function' ? update(currentSession) : update
  return saveDynamicCreationFlowSession({
    ...currentSession,
    ...patch,
    groupId
  }, options)
}

const removeDynamicCreationFlowSession = (
  groupId: string,
  storage?: DynamicCreationFlowStorageLike
) => {
  const envelope = readEnvelope(storage)
  if (!(groupId in envelope.sessions)) return true

  delete envelope.sessions[groupId]
  return writeEnvelope(envelope, storage)
}

const clearDynamicCreationFlowSessions = (storage?: DynamicCreationFlowStorageLike) => {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) return false

  try {
    resolvedStorage.removeItem(DYNAMIC_CREATION_FLOW_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export type {
  DynamicCreationFlowStorageLike,
  DynamicCreationFlowStorageOptions,
  DynamicCreationFlowSessionUpdate
}
export {
  DYNAMIC_CREATION_FLOW_STORAGE_KEY,
  clearDynamicCreationFlowSessions,
  loadDynamicCreationFlowSession,
  removeDynamicCreationFlowSession,
  saveDynamicCreationFlowSession,
  updateDynamicCreationFlowSession
}
