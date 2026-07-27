import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  FilePlus2,
  Folder,
  FolderInput,
  FolderPlus,
  Grid2X2,
  Image as ImageIcon,
  List,
  MoreHorizontal,
  Pencil,
  Trash2,
  X
} from 'lucide-react'
import {
  createDynamicGroup,
  deleteDynamicGroup,
  updateDynamicGroupMeta,
  updateDynamicGroupOrganization,
  type DynamicGroup
} from '../services/dynamicArtStorage.ts'
import {
  createDynamicFolder,
  deleteDynamicFolders,
  getDynamicFolderDescendantIds,
  loadDynamicFolders,
  loadDynamicLibraryPreferences,
  saveDynamicLibraryPreferences,
  updateDynamicFolder,
  type DynamicFolder,
  type DynamicLibrarySortMode,
  type DynamicLibraryViewMode
} from '../services/dynamicFolderStorage.ts'
import { sendDynamicEvent } from '../services/unityBridge.ts'

interface DynamicGroupsPageProps {
  groups: DynamicGroup[]
  wsIp: string
  dynamicPort: number
  onBack: () => void
  onCreateGroup: (group: DynamicGroup) => void
  onUpdateGroup: (group: DynamicGroup) => void
  onDeleteGroup: (groupId: string) => void
  onSelectGroup: (group: DynamicGroup) => void
}

interface MenuPosition {
  x: number
  y: number
}

type LibraryEntity =
  | { kind: 'folder'; folder: DynamicFolder }
  | { kind: 'material'; group: DynamicGroup }

type CreatorType = 'folder' | 'material'

const LONG_PRESS_DELAY_MS = 420
const LONG_PRESS_MOVE_TOLERANCE = 12

const getEntityId = (entity: LibraryEntity) => (
  entity.kind === 'folder' ? entity.folder.id : entity.group.id
)

const getEntityName = (entity: LibraryEntity) => (
  entity.kind === 'folder' ? entity.folder.name : entity.group.name
)

const getEntityUpdatedAt = (entity: LibraryEntity) => (
  entity.kind === 'folder' ? entity.folder.updatedAt : entity.group.updatedAt
)

const formatLibraryDate = (timestamp: number) => new Intl.DateTimeFormat('zh-HK', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
}).format(new Date(timestamp))

const DynamicGroupsPage: React.FC<DynamicGroupsPageProps> = ({
  groups,
  wsIp,
  dynamicPort,
  onBack,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onSelectGroup
}) => {
  const initialPreferencesRef = useRef(loadDynamicLibraryPreferences())
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const editThumbnailInputRef = useRef<HTMLInputElement>(null)
  const creatorDialogRef = useRef<HTMLElement>(null)
  const creatorReturnFocusRef = useRef<HTMLElement | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressPointRef = useRef<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)

  const [folders, setFolders] = useState<DynamicFolder[]>(() => loadDynamicFolders())
  const [currentFolderId, setCurrentFolderId] = useState(initialPreferencesRef.current.currentFolderId ?? '')
  const [viewMode, setViewMode] = useState<DynamicLibraryViewMode>(initialPreferencesRef.current.viewMode)
  const [sortMode, setSortMode] = useState<DynamicLibrarySortMode>(initialPreferencesRef.current.sortMode)
  const [creatorType, setCreatorType] = useState<CreatorType | null>(null)
  const [name, setName] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | undefined>()
  const [thumbnailPreview, setThumbnailPreview] = useState<string | undefined>()
  const [isCreating, setIsCreating] = useState(false)
  const [menuTarget, setMenuTarget] = useState<LibraryEntity | null>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ x: 24, y: 96 })
  const [editingGroup, setEditingGroup] = useState<DynamicGroup | null>(null)
  const [editingFolder, setEditingFolder] = useState<DynamicFolder | null>(null)
  const [editName, setEditName] = useState('')
  const [editThumbnailFile, setEditThumbnailFile] = useState<File | undefined>()
  const [editThumbnailPreview, setEditThumbnailPreview] = useState<string | undefined>()
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [moveTarget, setMoveTarget] = useState<LibraryEntity | null>(null)
  const [moveDestinationId, setMoveDestinationId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<LibraryEntity | null>(null)
  const [confirmRecursiveDelete, setConfirmRecursiveDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [failedPreviewIds, setFailedPreviewIds] = useState<string[]>([])

  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders])
  const currentFolder = currentFolderId ? folderById.get(currentFolderId) : undefined

  useEffect(() => {
    if (currentFolderId && !folderById.has(currentFolderId)) {
      setCurrentFolderId('')
    }
  }, [currentFolderId, folderById])

  useEffect(() => {
    saveDynamicLibraryPreferences({
      viewMode,
      sortMode,
      currentFolderId: currentFolderId || undefined
    })
  }, [currentFolderId, sortMode, viewMode])

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  useEffect(() => () => clearLongPressTimer(), [])

  useEffect(() => {
    if (!creatorType) return
    const frame = window.requestAnimationFrame(() => creatorDialogRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [creatorType])

  const getMenuPosition = (clientX: number, clientY: number): MenuPosition => {
    const menuWidth = 244
    const menuHeight = 164
    const margin = 18
    return {
      x: Math.min(Math.max(clientX - 20, margin), Math.max(margin, window.innerWidth - menuWidth - margin)),
      y: Math.min(Math.max(clientY + 14, margin), Math.max(margin, window.innerHeight - menuHeight - margin))
    }
  }

  const closeEntityMenu = () => {
    setMenuTarget(null)
    suppressClickRef.current = false
  }

  const openEntityMenu = (entity: LibraryEntity, clientX: number, clientY: number, suppressClick = true) => {
    clearLongPressTimer()
    suppressClickRef.current = suppressClick
    setMenuPosition(getMenuPosition(clientX, clientY))
    setMenuTarget(entity)
  }

  const handleEntityPointerDown = (event: React.PointerEvent<HTMLElement>, entity: LibraryEntity) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if ((event.target as HTMLElement).closest('.dynamic-library-more-button')) return

    clearLongPressTimer()
    longPressPointRef.current = { x: event.clientX, y: event.clientY }
    const { clientX, clientY } = event
    longPressTimerRef.current = window.setTimeout(() => {
      openEntityMenu(entity, clientX, clientY)
    }, LONG_PRESS_DELAY_MS)
  }

  const handleEntityPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const startPoint = longPressPointRef.current
    if (!startPoint) return
    if (Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y) > LONG_PRESS_MOVE_TOLERANCE) {
      clearLongPressTimer()
      longPressPointRef.current = null
    }
  }

  const handleEntityPointerEnd = () => {
    clearLongPressTimer()
    longPressPointRef.current = null
  }

  const enterFolder = (folderId: string) => {
    closeEntityMenu()
    setCurrentFolderId(folderId)
  }

  const handleBack = () => {
    if (currentFolder) {
      setCurrentFolderId(currentFolder.parentId ?? '')
      return
    }
    onBack()
  }

  const handleMaterialSelect = (group: DynamicGroup) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (menuTarget) {
      closeEntityMenu()
      return
    }

    sendDynamicEvent(wsIp, dynamicPort, 'GroupSelect', {
      groupId: group.id,
      name: group.name,
      itemCount: group.items.length
    })
    onSelectGroup(group)
  }

  const handleEntityOpen = (entity: LibraryEntity) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (entity.kind === 'folder') {
      enterFolder(entity.folder.id)
    } else {
      handleMaterialSelect(entity.group)
    }
  }

  const clearCreator = () => {
    if (thumbnailPreview?.startsWith('blob:')) URL.revokeObjectURL(thumbnailPreview)
    setCreatorType(null)
    setName('')
    setThumbnailFile(undefined)
    setThumbnailPreview(undefined)
  }

  const resetCreator = () => {
    clearCreator()
    window.requestAnimationFrame(() => creatorReturnFocusRef.current?.focus({ preventScroll: true }))
  }

  const blockCreatorBackdropInteraction = (event: React.SyntheticEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const openCreator = (type: CreatorType) => {
    creatorReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    clearCreator()
    setCreatorType(type)
  }

  const handleThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (thumbnailPreview?.startsWith('blob:')) URL.revokeObjectURL(thumbnailPreview)
    setThumbnailFile(file)
    setThumbnailPreview(URL.createObjectURL(file))
    event.target.value = ''
  }

  const handleCreate = async () => {
    if (!creatorType || isCreating || !name.trim()) return
    setIsCreating(true)
    try {
      if (creatorType === 'folder') {
        const folder = createDynamicFolder(name, currentFolderId || undefined)
        setFolders((current) => [...current, folder])
        resetCreator()
        return
      }

      const group = await createDynamicGroup(
        name,
        thumbnailFile,
        undefined,
        { folderId: currentFolderId || undefined }
      )
      sendDynamicEvent(wsIp, dynamicPort, 'GroupCreate', {
        groupId: group.id,
        name: group.name
      })
      resetCreator()
      onCreateGroup(group)
    } finally {
      setIsCreating(false)
    }
  }

  const resetEditor = () => {
    if (editThumbnailFile && editThumbnailPreview?.startsWith('blob:')) URL.revokeObjectURL(editThumbnailPreview)
    setEditingGroup(null)
    setEditingFolder(null)
    setEditName('')
    setEditThumbnailFile(undefined)
    setEditThumbnailPreview(undefined)
  }

  const startEdit = (entity: LibraryEntity) => {
    closeEntityMenu()
    setEditName(getEntityName(entity))
    if (entity.kind === 'folder') {
      setEditingFolder(entity.folder)
      setEditingGroup(null)
      setEditThumbnailPreview(undefined)
    } else {
      setEditingGroup(entity.group)
      setEditingFolder(null)
      setEditThumbnailPreview(entity.group.thumbnail?.url)
    }
  }

  const handleEditThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (editThumbnailFile && editThumbnailPreview?.startsWith('blob:')) URL.revokeObjectURL(editThumbnailPreview)
    setEditThumbnailFile(file)
    setEditThumbnailPreview(URL.createObjectURL(file))
    event.target.value = ''
  }

  const handleSaveEdit = async () => {
    if (isSavingEdit || !editName.trim()) return
    setIsSavingEdit(true)
    try {
      if (editingFolder) {
        const nextFolder = updateDynamicFolder(editingFolder.id, { name: editName })
        if (nextFolder) {
          setFolders((current) => current.map((folder) => folder.id === nextFolder.id ? nextFolder : folder))
        }
      } else if (editingGroup) {
        const nextGroup = await updateDynamicGroupMeta(editingGroup.id, {
          name: editName,
          thumbnailFile: editThumbnailFile
        })
        if (nextGroup) {
          sendDynamicEvent(wsIp, dynamicPort, 'GroupUpdate', {
            groupId: nextGroup.id,
            name: nextGroup.name,
            ...(nextGroup.thumbnail ? { thumbnailAssetId: nextGroup.thumbnail.id } : {})
          })
          onUpdateGroup(nextGroup)
        }
      }
      resetEditor()
    } finally {
      setIsSavingEdit(false)
    }
  }

  const getFolderPathLabel = (folder: DynamicFolder) => {
    const labels = [folder.name]
    const visited = new Set([folder.id])
    let parentId = folder.parentId
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId)
      const parent = folderById.get(parentId)
      if (!parent) break
      labels.unshift(parent.name)
      parentId = parent.parentId
    }
    return labels.join(' / ')
  }

  const availableMoveFolders = useMemo(() => {
    if (!moveTarget || moveTarget.kind === 'material') return folders
    const excluded = new Set(getDynamicFolderDescendantIds(folders, moveTarget.folder.id))
    return folders.filter((folder) => !excluded.has(folder.id))
  }, [folders, moveTarget])

  const startMove = (entity: LibraryEntity) => {
    closeEntityMenu()
    setMoveTarget(entity)
    setMoveDestinationId(
      entity.kind === 'folder'
        ? entity.folder.parentId ?? ''
        : entity.group.folderId ?? ''
    )
  }

  const handleMove = async () => {
    if (!moveTarget) return
    const destinationId = moveDestinationId || undefined
    if (moveTarget.kind === 'folder') {
      const nextFolder = updateDynamicFolder(moveTarget.folder.id, { parentId: destinationId })
      if (nextFolder) {
        setFolders((current) => current.map((folder) => folder.id === nextFolder.id ? nextFolder : folder))
      }
    } else {
      const nextGroup = await updateDynamicGroupOrganization(moveTarget.group.id, { folderId: destinationId })
      if (nextGroup) onUpdateGroup(nextGroup)
    }
    setMoveTarget(null)
  }

  const startDelete = (entity: LibraryEntity) => {
    closeEntityMenu()
    setConfirmRecursiveDelete(false)
    setDeleteTarget(entity)
  }

  const handleDeleteMaterial = async (group: DynamicGroup) => {
    setIsDeleting(true)
    try {
      await deleteDynamicGroup(group.id)
      sendDynamicEvent(wsIp, dynamicPort, 'GroupDelete', { groupId: group.id })
      onDeleteGroup(group.id)
      setDeleteTarget(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteFolderOnly = async (folder: DynamicFolder) => {
    setIsDeleting(true)
    try {
      const directChildren = folders.filter((nextFolder) => nextFolder.parentId === folder.id)
      directChildren.forEach((child) => updateDynamicFolder(child.id, { parentId: folder.parentId }))

      for (const group of groups.filter((item) => item.folderId === folder.id)) {
        const nextGroup = await updateDynamicGroupOrganization(group.id, { folderId: folder.parentId })
        if (nextGroup) onUpdateGroup(nextGroup)
      }

      setFolders(deleteDynamicFolders([folder.id]))
      setDeleteTarget(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteFolderAndContents = async (folder: DynamicFolder) => {
    if (!confirmRecursiveDelete) {
      setConfirmRecursiveDelete(true)
      return
    }

    setIsDeleting(true)
    try {
      const descendantIds = getDynamicFolderDescendantIds(folders, folder.id)
      const descendantSet = new Set(descendantIds)
      const groupsToDelete = groups.filter((group) => group.folderId && descendantSet.has(group.folderId))

      for (const group of groupsToDelete) {
        await deleteDynamicGroup(group.id)
        sendDynamicEvent(wsIp, dynamicPort, 'GroupDelete', { groupId: group.id })
        onDeleteGroup(group.id)
      }

      setFolders(deleteDynamicFolders(descendantIds))
      setDeleteTarget(null)
      setConfirmRecursiveDelete(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const breadcrumbs = useMemo(() => {
    const result: DynamicFolder[] = []
    const visited = new Set<string>()
    let folder = currentFolder
    while (folder && !visited.has(folder.id)) {
      visited.add(folder.id)
      result.unshift(folder)
      folder = folder.parentId ? folderById.get(folder.parentId) : undefined
    }
    return result
  }, [currentFolder, folderById])

  const entities = useMemo(() => {
    const validFolderIds = new Set(folders.map((folder) => folder.id))
    const currentId = currentFolderId || undefined
    const nextEntities: LibraryEntity[] = [
      ...folders
        .filter((folder) => folder.parentId === currentId)
        .map((folder): LibraryEntity => ({ kind: 'folder', folder })),
      ...groups
        .filter((group) => {
          const normalizedFolderId = group.folderId && validFolderIds.has(group.folderId)
            ? group.folderId
            : undefined
          return normalizedFolderId === currentId
        })
        .map((group): LibraryEntity => ({ kind: 'material', group }))
    ]

    return nextEntities.sort((left, right) => {
      if (sortMode === 'type' && left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1
      if (sortMode === 'updated') return getEntityUpdatedAt(right) - getEntityUpdatedAt(left)
      return getEntityName(left).localeCompare(getEntityName(right), 'zh-Hant', { numeric: true })
    })
  }, [currentFolderId, folders, groups, sortMode])

  const getFolderContent = (folder: DynamicFolder) => {
    const folderCount = folders.filter((item) => item.parentId === folder.id).length
    const materialCount = groups.filter((group) => group.folderId === folder.id).length
    const parts = []
    if (folderCount > 0) parts.push(`${folderCount} 個資料夾`)
    if (materialCount > 0) parts.push(`${materialCount} 個素材`)
    return parts.join(' · ') || '空白資料夾'
  }

  const getMaterialContent = (group: DynamicGroup) => {
    const backgroundCount = group.backgrounds?.length ?? (group.background ? 1 : 0)
    return `${backgroundCount} 個背景 · ${group.items.length} 個物件`
  }

  const markPreviewFailed = (entityId: string) => {
    setFailedPreviewIds((current) => current.includes(entityId) ? current : [...current, entityId])
  }

  const renderMaterialPreview = (group: DynamicGroup, compact = false) => {
    const preview = group.thumbnail ?? group.background
    if (!preview || failedPreviewIds.includes(group.id)) {
      return <span className="dynamic-library-preview-fallback"><ImageIcon aria-hidden="true" /></span>
    }
    if (preview.type === 'video') {
      return (
        <video
          src={preview.url}
          muted
          playsInline
          preload="metadata"
          aria-label={`${group.name} 預覽`}
          onError={() => markPreviewFailed(group.id)}
        />
      )
    }
    return <img src={preview.url} alt={compact ? '' : group.name} onError={() => markPreviewFailed(group.id)} />
  }

  const renderMoreButton = (entity: LibraryEntity) => (
    <button
      type="button"
      className="dynamic-library-more-button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        openEntityMenu(entity, rect.right, rect.bottom, false)
      }}
      aria-label={`開啟 ${getEntityName(entity)} 選單`}
      title="更多操作"
    >
      <MoreHorizontal aria-hidden="true" />
    </button>
  )

  const renderIconEntity = (entity: LibraryEntity) => (
    <article
      key={`${entity.kind}-${getEntityId(entity)}`}
      className={`dynamic-library-icon-card ${entity.kind} ${menuTarget && getEntityId(menuTarget) === getEntityId(entity) ? 'menu-active' : ''}`}
      onPointerDown={(event) => handleEntityPointerDown(event, entity)}
      onPointerMove={handleEntityPointerMove}
      onPointerUp={handleEntityPointerEnd}
      onPointerCancel={handleEntityPointerEnd}
      onPointerLeave={handleEntityPointerEnd}
      onContextMenu={(event) => {
        event.preventDefault()
        openEntityMenu(entity, event.clientX, event.clientY)
      }}
    >
      <button type="button" className="dynamic-library-icon-main" onClick={() => handleEntityOpen(entity)}>
        <span className="dynamic-library-icon-preview">
          {entity.kind === 'folder' ? <Folder aria-hidden="true" /> : renderMaterialPreview(entity.group)}
        </span>
        <span className="dynamic-library-icon-copy">
          <strong>{getEntityName(entity)}</strong>
          <small>{entity.kind === 'folder' ? getFolderContent(entity.folder) : getMaterialContent(entity.group)}</small>
        </span>
      </button>
      {renderMoreButton(entity)}
    </article>
  )

  const renderDetailEntity = (entity: LibraryEntity) => (
    <article
      key={`${entity.kind}-${getEntityId(entity)}`}
      className={`dynamic-library-detail-row ${entity.kind} ${menuTarget && getEntityId(menuTarget) === getEntityId(entity) ? 'menu-active' : ''}`}
      onPointerDown={(event) => handleEntityPointerDown(event, entity)}
      onPointerMove={handleEntityPointerMove}
      onPointerUp={handleEntityPointerEnd}
      onPointerCancel={handleEntityPointerEnd}
      onPointerLeave={handleEntityPointerEnd}
      onContextMenu={(event) => {
        event.preventDefault()
        openEntityMenu(entity, event.clientX, event.clientY)
      }}
    >
      <button type="button" className="dynamic-library-detail-main" onClick={() => handleEntityOpen(entity)}>
        <span className="dynamic-library-detail-name">
          <span className="dynamic-library-detail-thumbnail">
            {entity.kind === 'folder' ? <Folder aria-hidden="true" /> : renderMaterialPreview(entity.group, true)}
          </span>
          <strong>{getEntityName(entity)}</strong>
        </span>
        <time>{formatLibraryDate(getEntityUpdatedAt(entity))}</time>
        <span>{entity.kind === 'folder' ? '資料夾' : '素材'}</span>
        <span>{entity.kind === 'folder' ? getFolderContent(entity.folder) : getMaterialContent(entity.group)}</span>
      </button>
      {renderMoreButton(entity)}
    </article>
  )

  const deleteFolderDescendantIds = deleteTarget?.kind === 'folder'
    ? getDynamicFolderDescendantIds(folders, deleteTarget.folder.id)
    : []
  const deleteFolderMaterialCount = deleteTarget?.kind === 'folder'
    ? groups.filter((group) => group.folderId && deleteFolderDescendantIds.includes(group.folderId)).length
    : 0
  const deleteFolderChildCount = Math.max(0, deleteFolderDescendantIds.length - 1)
  const deleteFolderHasContents = deleteFolderMaterialCount > 0 || deleteFolderChildCount > 0

  return (
    <main className="ipad-screen dynamic-screen dynamic-library-screen apple-container">
      <header className="ipad-topbar dynamic-library-topbar">
        <div className="topbar-title-row">
          <button type="button" className="ipad-button ghost-button dynamic-library-back" onClick={handleBack}>
            <ArrowLeft aria-hidden="true" />
            <span>{currentFolder ? '上一層' : '返回'}</span>
          </button>
          <div className="min-w-0">
            <p className="eyebrow">動態藝術</p>
            <h1 className="screen-title">作品檔案</h1>
          </div>
        </div>

        <div className="dynamic-library-toolbar-actions">
          <div className="dynamic-library-view-switch" role="group" aria-label="檢視方式">
            <button
              type="button"
              className={viewMode === 'icons' ? 'active' : ''}
              onClick={() => setViewMode('icons')}
              aria-label="圖示模式"
              title="圖示模式"
            >
              <Grid2X2 aria-hidden="true" />
            </button>
            <button
              type="button"
              className={viewMode === 'details' ? 'active' : ''}
              onClick={() => setViewMode('details')}
              aria-label="詳細模式"
              title="詳細模式"
            >
              <List aria-hidden="true" />
            </button>
          </div>
          <label className="dynamic-library-sort">
            <span>排序</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as DynamicLibrarySortMode)}>
              <option value="updated">修改日期</option>
              <option value="name">名稱</option>
              <option value="type">類型</option>
            </select>
          </label>
          <button type="button" className="ipad-button secondary-button dynamic-library-create-action" onClick={() => openCreator('folder')}>
            <FolderPlus aria-hidden="true" />
            <span>新建資料夾</span>
          </button>
          <button type="button" className="ipad-button primary-button dynamic-library-create-action" onClick={() => openCreator('material')}>
            <FilePlus2 aria-hidden="true" />
            <span>新建素材</span>
          </button>
        </div>
      </header>

      {currentFolder && (
        <nav className="dynamic-library-breadcrumbs" aria-label="目前路徑">
          <button type="button" onClick={() => setCurrentFolderId('')}>
            作品檔案
          </button>
          {breadcrumbs.map((folder, index) => (
            <span key={folder.id}>
              <ChevronRight aria-hidden="true" />
              <button
                type="button"
                className={index === breadcrumbs.length - 1 ? 'current' : ''}
                onClick={() => setCurrentFolderId(folder.id)}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </nav>
      )}

      <section className={`dynamic-library-browser view-${viewMode}`} aria-label="作品素材庫">
        {viewMode === 'details' && entities.length > 0 && (
          <div className="dynamic-library-detail-header" aria-hidden="true">
            <span>名稱</span>
            <span>修改日期</span>
            <span>類型</span>
            <span>內容</span>
            <span />
          </div>
        )}
        <div className={viewMode === 'icons' ? 'dynamic-library-icon-grid' : 'dynamic-library-detail-list'}>
          {entities.map((entity) => viewMode === 'icons' ? renderIconEntity(entity) : renderDetailEntity(entity))}
          {entities.length === 0 && (
            <div className="dynamic-library-empty-state">
              <span><Folder aria-hidden="true" /></span>
              <strong>此資料夾尚未建立內容</strong>
              <div>
                <button type="button" onClick={() => openCreator('folder')}><FolderPlus aria-hidden="true" />資料夾</button>
                <button type="button" onClick={() => openCreator('material')}><FilePlus2 aria-hidden="true" />素材</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {menuTarget && (
        <>
          <button type="button" className="dynamic-group-menu-overlay" onClick={closeEntityMenu} aria-label="關閉選單" />
          <section
            className="dynamic-group-menu-popover dynamic-library-menu-popover"
            style={{ left: menuPosition.x, top: menuPosition.y }}
            role="menu"
            aria-label={`${getEntityName(menuTarget)} 選單`}
          >
            <button type="button" onClick={() => startEdit(menuTarget)} role="menuitem"><Pencil aria-hidden="true" />編輯</button>
            <button type="button" onClick={() => startMove(menuTarget)} role="menuitem"><FolderInput aria-hidden="true" />移動到</button>
            <button type="button" className="danger-menu-button" onClick={() => startDelete(menuTarget)} role="menuitem">
              <Trash2 aria-hidden="true" />刪除
            </button>
          </section>
        </>
      )}

      {creatorType && (
        <div className="dynamic-modal-overlay dynamic-library-modal-overlay">
          <div
            className="settings-scrim"
            aria-hidden="true"
            onPointerDown={blockCreatorBackdropInteraction}
            onPointerUp={blockCreatorBackdropInteraction}
            onClick={blockCreatorBackdropInteraction}
            onContextMenu={blockCreatorBackdropInteraction}
          />
          <section ref={creatorDialogRef} className="dynamic-library-form-modal" role="dialog" aria-modal="true" aria-labelledby="library-create-title" tabIndex={-1}>
            <div className="dynamic-library-modal-heading">
              <div>
                <p className="eyebrow">{currentFolder?.name ?? '作品檔案'}</p>
                <h2 id="library-create-title">{creatorType === 'folder' ? '新建資料夾' : '新建素材'}</h2>
              </div>
              <button type="button" className="dynamic-panel-close" onClick={resetCreator} aria-label="關閉"><X aria-hidden="true" /></button>
            </div>

            {creatorType === 'material' && (
              <>
                <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailChange} />
                <button type="button" className="dynamic-library-thumbnail-picker" onClick={() => thumbnailInputRef.current?.click()}>
                  {thumbnailPreview ? <img src={thumbnailPreview} alt="縮略圖預覽" /> : <span><ImageIcon aria-hidden="true" /><strong>選擇縮略圖</strong></span>}
                </button>
              </>
            )}

            <label className="settings-field">
              <span>{creatorType === 'folder' ? '資料夾名稱' : '素材名稱'}</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="ipad-input"
                placeholder={creatorType === 'folder' ? '輸入資料夾名稱' : '輸入素材名稱'}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleCreate()
                }}
              />
            </label>

            <div className="settings-actions">
              <button type="button" className="ipad-button secondary-button" onClick={resetCreator}>取消</button>
              <button type="button" className="ipad-button primary-button" disabled={!name.trim() || isCreating} onClick={() => void handleCreate()}>
                {isCreating ? '建立中' : '建立'}
              </button>
            </div>
          </section>
        </div>
      )}

      {(editingGroup || editingFolder) && (
        <div className="dynamic-modal-overlay dynamic-library-modal-overlay">
          <button type="button" className="settings-scrim" onClick={resetEditor} aria-label="關閉" />
          <section className="dynamic-library-form-modal" role="dialog" aria-modal="true" aria-labelledby="library-edit-title">
            <div className="dynamic-library-modal-heading">
              <div><p className="eyebrow">編輯</p><h2 id="library-edit-title">{editingFolder ? '資料夾' : '素材'}</h2></div>
              <button type="button" className="dynamic-panel-close" onClick={resetEditor} aria-label="關閉"><X aria-hidden="true" /></button>
            </div>

            {editingGroup && (
              <>
                <input ref={editThumbnailInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditThumbnailChange} />
                <button type="button" className="dynamic-library-thumbnail-picker" onClick={() => editThumbnailInputRef.current?.click()}>
                  {editThumbnailPreview ? <img src={editThumbnailPreview} alt="縮略圖預覽" /> : <span><ImageIcon aria-hidden="true" /><strong>選擇縮略圖</strong></span>}
                </button>
              </>
            )}

            <label className="settings-field">
              <span>名稱</span>
              <input type="text" value={editName} onChange={(event) => setEditName(event.target.value)} className="ipad-input" autoFocus />
            </label>
            <div className="settings-actions">
              <button type="button" className="ipad-button secondary-button" onClick={resetEditor}>取消</button>
              <button type="button" className="ipad-button primary-button" disabled={!editName.trim() || isSavingEdit} onClick={() => void handleSaveEdit()}>
                {isSavingEdit ? '儲存中' : '儲存'}
              </button>
            </div>
          </section>
        </div>
      )}

      {moveTarget && (
        <div className="dynamic-modal-overlay dynamic-library-modal-overlay">
          <button type="button" className="settings-scrim" onClick={() => setMoveTarget(null)} aria-label="關閉" />
          <section className="dynamic-library-form-modal dynamic-library-move-modal" role="dialog" aria-modal="true" aria-labelledby="library-move-title">
            <div className="dynamic-library-modal-heading">
              <div><p className="eyebrow">{getEntityName(moveTarget)}</p><h2 id="library-move-title">移動到</h2></div>
              <button type="button" className="dynamic-panel-close" onClick={() => setMoveTarget(null)} aria-label="關閉"><X aria-hidden="true" /></button>
            </div>
            <div className="dynamic-library-folder-destinations" role="radiogroup" aria-label="目的位置">
              <label className={!moveDestinationId ? 'active' : ''}>
                <input type="radio" name="destination" value="" checked={!moveDestinationId} onChange={() => setMoveDestinationId('')} />
                <span><Folder aria-hidden="true" /><strong>作品檔案</strong></span>
              </label>
              {availableMoveFolders.map((folder) => (
                <label key={folder.id} className={moveDestinationId === folder.id ? 'active' : ''}>
                  <input type="radio" name="destination" value={folder.id} checked={moveDestinationId === folder.id} onChange={() => setMoveDestinationId(folder.id)} />
                  <span><Folder aria-hidden="true" /><strong>{getFolderPathLabel(folder)}</strong></span>
                </label>
              ))}
            </div>
            <div className="settings-actions">
              <button type="button" className="ipad-button secondary-button" onClick={() => setMoveTarget(null)}>取消</button>
              <button type="button" className="ipad-button primary-button" onClick={() => void handleMove()}>移動</button>
            </div>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="dynamic-modal-overlay dynamic-library-modal-overlay">
          <button type="button" className="settings-scrim" onClick={() => setDeleteTarget(null)} aria-label="關閉" />
          <section className="dynamic-library-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="library-delete-title">
            <span className="dynamic-library-delete-icon"><Trash2 aria-hidden="true" /></span>
            <div>
              <p className="eyebrow">{deleteTarget.kind === 'folder' ? '資料夾' : '素材'}</p>
              <h2 id="library-delete-title">{confirmRecursiveDelete ? '再次確認刪除' : `刪除「${getEntityName(deleteTarget)}」？`}</h2>
              {deleteTarget.kind === 'folder' && deleteFolderHasContents && (
                <p>{confirmRecursiveDelete ? '資料夾內的所有素材與子資料夾都會永久刪除。' : `內含 ${deleteFolderChildCount} 個子資料夾與 ${deleteFolderMaterialCount} 個素材。`}</p>
              )}
            </div>
            <div className="dynamic-library-delete-actions">
              <button type="button" className="ipad-button secondary-button" onClick={() => {
                setDeleteTarget(null)
                setConfirmRecursiveDelete(false)
              }}>取消</button>
              {deleteTarget.kind === 'material' ? (
                <button type="button" className="ipad-button danger-button" disabled={isDeleting} onClick={() => void handleDeleteMaterial(deleteTarget.group)}>
                  {isDeleting ? '刪除中' : '刪除素材'}
                </button>
              ) : !deleteFolderHasContents ? (
                <button type="button" className="ipad-button danger-button" disabled={isDeleting} onClick={() => void handleDeleteFolderOnly(deleteTarget.folder)}>
                  {isDeleting ? '刪除中' : '刪除資料夾'}
                </button>
              ) : confirmRecursiveDelete ? (
                <button type="button" className="ipad-button danger-button" disabled={isDeleting} onClick={() => void handleDeleteFolderAndContents(deleteTarget.folder)}>
                  {isDeleting ? '刪除中' : '確認全部刪除'}
                </button>
              ) : (
                <>
                  <button type="button" className="ipad-button secondary-button" disabled={isDeleting} onClick={() => void handleDeleteFolderOnly(deleteTarget.folder)}>
                    移出內容並刪除
                  </button>
                  <button type="button" className="ipad-button danger-button" disabled={isDeleting} onClick={() => void handleDeleteFolderAndContents(deleteTarget.folder)}>
                    連同內容刪除
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default DynamicGroupsPage
