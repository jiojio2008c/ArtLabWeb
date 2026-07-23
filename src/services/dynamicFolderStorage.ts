const DYNAMIC_FOLDERS_KEY = 'magicfloor_dynamic_folders_v1'
const DYNAMIC_LIBRARY_PREFERENCES_KEY = 'magicfloor_dynamic_library_preferences_v1'

type DynamicLibraryViewMode = 'icons' | 'details'
type DynamicLibrarySortMode = 'name' | 'updated' | 'type'

interface DynamicFolder {
  id: string
  name: string
  parentId?: string
  order: number
  createdAt: number
  updatedAt: number
}

interface DynamicLibraryPreferences {
  viewMode: DynamicLibraryViewMode
  sortMode: DynamicLibrarySortMode
  currentFolderId?: string
}

const DEFAULT_LIBRARY_PREFERENCES: DynamicLibraryPreferences = {
  viewMode: 'icons',
  sortMode: 'updated'
}

const generateFolderId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `folder_${crypto.randomUUID()}`
  }
  return `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

const loadDynamicFolders = (): DynamicFolder[] => {
  try {
    const raw = localStorage.getItem(DYNAMIC_FOLDERS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((folder): folder is DynamicFolder => (
        Boolean(folder)
        && typeof folder.id === 'string'
        && typeof folder.name === 'string'
      ))
      .map((folder, index) => ({
        ...folder,
        parentId: typeof folder.parentId === 'string' && folder.parentId ? folder.parentId : undefined,
        order: Number.isFinite(folder.order) ? folder.order : index,
        createdAt: Number.isFinite(folder.createdAt) ? folder.createdAt : Date.now(),
        updatedAt: Number.isFinite(folder.updatedAt) ? folder.updatedAt : Date.now()
      }))
  } catch {
    return []
  }
}

const saveDynamicFolders = (folders: DynamicFolder[]) => {
  localStorage.setItem(DYNAMIC_FOLDERS_KEY, JSON.stringify(folders))
}

const createDynamicFolder = (name: string, parentId?: string) => {
  const folders = loadDynamicFolders()
  const now = Date.now()
  const siblingOrders = folders
    .filter((folder) => folder.parentId === parentId)
    .map((folder) => folder.order)
  const folder: DynamicFolder = {
    id: generateFolderId(),
    name: name.trim() || '未命名資料夾',
    parentId,
    order: siblingOrders.length > 0 ? Math.max(...siblingOrders) + 1 : 0,
    createdAt: now,
    updatedAt: now
  }
  saveDynamicFolders([...folders, folder])
  return folder
}

const updateDynamicFolder = (folderId: string, values: { name?: string; parentId?: string }) => {
  const folders = loadDynamicFolders()
  const index = folders.findIndex((folder) => folder.id === folderId)
  if (index < 0) return undefined

  const current = folders[index]
  const nextParentId = Object.prototype.hasOwnProperty.call(values, 'parentId')
    ? values.parentId
    : current.parentId
  const siblingOrders = folders
    .filter((folder) => folder.id !== folderId && folder.parentId === nextParentId)
    .map((folder) => folder.order)
  folders[index] = {
    ...current,
    name: values.name?.trim() || current.name,
    parentId: nextParentId,
    order: nextParentId === current.parentId
      ? current.order
      : siblingOrders.length > 0 ? Math.max(...siblingOrders) + 1 : 0,
    updatedAt: Date.now()
  }
  saveDynamicFolders(folders)
  return folders[index]
}

const deleteDynamicFolders = (folderIds: string[]) => {
  if (folderIds.length === 0) return loadDynamicFolders()
  const deleteSet = new Set(folderIds)
  const nextFolders = loadDynamicFolders().filter((folder) => !deleteSet.has(folder.id))
  saveDynamicFolders(nextFolders)
  return nextFolders
}

const getDynamicFolderDescendantIds = (folders: DynamicFolder[], folderId: string) => {
  const descendants = new Set<string>([folderId])
  let changed = true

  while (changed) {
    changed = false
    folders.forEach((folder) => {
      if (folder.parentId && descendants.has(folder.parentId) && !descendants.has(folder.id)) {
        descendants.add(folder.id)
        changed = true
      }
    })
  }

  return Array.from(descendants)
}

const loadDynamicLibraryPreferences = (): DynamicLibraryPreferences => {
  try {
    const raw = localStorage.getItem(DYNAMIC_LIBRARY_PREFERENCES_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      viewMode: parsed.viewMode === 'details' ? 'details' : 'icons',
      sortMode: parsed.sortMode === 'name' || parsed.sortMode === 'type' ? parsed.sortMode : 'updated',
      currentFolderId: typeof parsed.currentFolderId === 'string' ? parsed.currentFolderId : undefined
    }
  } catch {
    return DEFAULT_LIBRARY_PREFERENCES
  }
}

const saveDynamicLibraryPreferences = (preferences: DynamicLibraryPreferences) => {
  localStorage.setItem(DYNAMIC_LIBRARY_PREFERENCES_KEY, JSON.stringify(preferences))
}

export type {
  DynamicFolder,
  DynamicLibraryPreferences,
  DynamicLibrarySortMode,
  DynamicLibraryViewMode
}

export {
  DYNAMIC_FOLDERS_KEY,
  DYNAMIC_LIBRARY_PREFERENCES_KEY,
  createDynamicFolder,
  deleteDynamicFolders,
  getDynamicFolderDescendantIds,
  loadDynamicFolders,
  loadDynamicLibraryPreferences,
  saveDynamicFolders,
  saveDynamicLibraryPreferences,
  updateDynamicFolder
}
