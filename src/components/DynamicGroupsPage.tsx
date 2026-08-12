import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useTranslation } from 'react-i18next'
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
import type { DynamicTransitionOrigin } from './dynamicTransitions/types.ts'

interface DynamicGroupsPageProps {
  groups: DynamicGroup[]
  wsIp: string
  dynamicPort: number
  onBack: () => void
  onCreateGroup: (group: DynamicGroup) => void
  onUpdateGroup: (group: DynamicGroup) => void
  onDeleteGroup: (groupId: string) => void
  onSelectGroup: (group: DynamicGroup, origin?: DynamicTransitionOrigin) => void
  portalArrival?: boolean
  transitionPrepared?: boolean
}

interface MenuPosition {
  x: number
  y: number
}

type LibraryEntity =
  | { kind: 'folder'; folder: DynamicFolder }
  | { kind: 'material'; group: DynamicGroup }

type CreatorType = 'folder' | 'material'

type FolderTransitionDirection = 'forward' | 'backward'

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

const formatLibraryDate = (timestamp: number, locale: string) => new Intl.DateTimeFormat(locale, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
}).format(new Date(timestamp))

const getFolderTone = (folderId: string) => {
  const checksum = Array.from(folderId).reduce((total, character) => total + character.charCodeAt(0), 0)
  return checksum % 2 === 0 ? 'sunny' : 'mint'
}

const DynamicFolderArtwork: React.FC<{ folderId: string; compact?: boolean }> = ({
  folderId,
  compact = false
}) => (
  <span
    className={`dynamic-folder-artwork ${compact ? 'compact' : ''} ${getFolderTone(folderId)}`}
    aria-hidden="true"
  >
    <span className="dynamic-folder-shape">
      <span className="dynamic-folder-tab" />
      <span className="dynamic-folder-body" />
      <span className="dynamic-folder-lid" />
    </span>
    {!compact && <span className="dynamic-folder-scan" />}
  </span>
)

const DynamicGroupsPage: React.FC<DynamicGroupsPageProps> = ({
  groups,
  wsIp,
  dynamicPort,
  onBack,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onSelectGroup,
  portalArrival = false,
  transitionPrepared = false
}) => {
  const { t, i18n } = useTranslation()
  const initialPreferencesRef = useRef(loadDynamicLibraryPreferences())
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const editThumbnailInputRef = useRef<HTMLInputElement>(null)
  const creatorDialogRef = useRef<HTMLElement>(null)
  const creatorReturnFocusRef = useRef<HTMLElement | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressPointRef = useRef<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)
  const folderTimelineRef = useRef<gsap.core.Timeline | null>(null)
  const folderFrameRef = useRef<number | null>(null)
  const currentLayerRef = useRef<HTMLDivElement>(null)
  const incomingLayerRef = useRef<HTMLDivElement>(null)

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
  const [folderTransitioning, setFolderTransitioning] = useState(false)
  const [incomingFolderId, setIncomingFolderId] = useState<string | null>(null)

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

  useEffect(() => () => {
    clearLongPressTimer()
    folderTimelineRef.current?.kill()
    if (folderFrameRef.current !== null) window.cancelAnimationFrame(folderFrameRef.current)
  }, [])

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

  const handleMaterialSelect = (group: DynamicGroup, sourceElement?: HTMLElement) => {
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
    const sourceCard = sourceElement?.closest<HTMLElement>('.dynamic-library-icon-card, .dynamic-library-detail-row')
    const rect = sourceCard?.getBoundingClientRect()
    onSelectGroup(group, rect ? {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    } : undefined)
  }

  const handleEntityOpen = (entity: LibraryEntity, sourceElement: HTMLElement) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (entity.kind === 'folder') {
      transitionToFolder(entity.folder.id, sourceElement)
    } else {
      handleMaterialSelect(entity.group, sourceElement)
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

  const getBreadcrumbsForFolderId = (folderId: string) => {
    const result: DynamicFolder[] = []
    const visited = new Set<string>()
    let folder = folderId ? folderById.get(folderId) : undefined
    while (folder && !visited.has(folder.id)) {
      visited.add(folder.id)
      result.unshift(folder)
      folder = folder.parentId ? folderById.get(folder.parentId) : undefined
    }
    return result
  }

  const getEntitiesForFolderId = (folderId: string) => {
    const validFolderIds = new Set(folders.map((folder) => folder.id))
    const currentId = folderId || undefined
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
  }

  const breadcrumbs = useMemo(
    () => getBreadcrumbsForFolderId(currentFolderId),
    [currentFolderId, folderById]
  )
  const entities = useMemo(
    () => getEntitiesForFolderId(currentFolderId),
    [currentFolderId, folders, groups, sortMode]
  )
  const incomingFolder = incomingFolderId ? folderById.get(incomingFolderId) : undefined
  const incomingBreadcrumbs = incomingFolderId === null ? [] : getBreadcrumbsForFolderId(incomingFolderId)
  const incomingEntities = incomingFolderId === null ? [] : getEntitiesForFolderId(incomingFolderId)

  const transitionToFolder = (
    folderId: string,
    sourceElement?: HTMLElement,
    requestedDirection?: FolderTransitionDirection
  ) => {
    if (folderTransitioning || folderId === currentFolderId || (folderId && !folderById.has(folderId))) return

    closeEntityMenu()
    clearLongPressTimer()
    setFolderTransitioning(true)
    setIncomingFolderId(folderId)

    const direction = requestedDirection ?? (sourceElement ? 'forward' : 'backward')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const runFolderTransition = () => {
      folderFrameRef.current = null
      const currentLayer = currentLayerRef.current
      const incomingLayer = incomingLayerRef.current
      if (!currentLayer || !incomingLayer) {
        setCurrentFolderId(folderId)
        setIncomingFolderId(null)
        setFolderTransitioning(false)
        return
      }

      folderTimelineRef.current?.kill()
      const currentCards = Array.from(currentLayer.querySelectorAll<HTMLElement>('.dynamic-library-entity-card'))
      const incomingCards = Array.from(incomingLayer.querySelectorAll<HTMLElement>('.dynamic-library-entity-card'))
      const incomingEmptyState = incomingLayer.querySelector<HTMLElement>('.dynamic-library-empty-state')
      const currentBreadcrumb = currentLayer.querySelector<HTMLElement>('.dynamic-library-breadcrumbs')
      const incomingBreadcrumb = incomingLayer.querySelector<HTMLElement>('.dynamic-library-breadcrumbs')
      const incomingDetailHeader = incomingLayer.querySelector<HTMLElement>('.dynamic-library-detail-header')
      const incomingContent = incomingCards.length > 0
        ? incomingCards
        : (incomingEmptyState ? [incomingEmptyState] : [])
      const sourceCard = sourceElement?.closest<HTMLElement>('.dynamic-library-entity-card')
      const otherCards = sourceCard ? currentCards.filter((card) => card !== sourceCard) : currentCards
      const folderLid = sourceCard?.querySelector<HTMLElement>('.dynamic-folder-lid')

      gsap.set(incomingLayer, { visibility: 'visible', pointerEvents: 'none' })

      const completeTransition = () => {
        setCurrentFolderId(folderId)
        setIncomingFolderId(null)
        setFolderTransitioning(false)
      }

      if (reducedMotion) {
        gsap.set(incomingLayer, { opacity: 0 })
        folderTimelineRef.current = gsap.timeline({ onComplete: completeTransition })
          .to(currentLayer, { opacity: 0, duration: 0.12, ease: 'power1.out' }, 0)
          .to(incomingLayer, { opacity: 1, duration: 0.12, ease: 'power1.out' }, 0)
        return
      }

      if (direction === 'forward') {
        gsap.set(incomingContent, { opacity: 0, y: 24, scale: 0.8 })
        if (incomingBreadcrumb) gsap.set(incomingBreadcrumb, { opacity: 0, y: -12 })
        if (incomingDetailHeader) gsap.set(incomingDetailHeader, { opacity: 0, y: 8 })

        const timeline = gsap.timeline({ onComplete: completeTransition })
        if (sourceCard) timeline.to(sourceCard, { scale: 0.96, duration: 0.11, ease: 'power2.out' }, 0)
        if (folderLid) {
          timeline.to(folderLid, {
            rotationY: -15,
            rotationX: -34,
            y: -5,
            duration: 0.18,
            ease: 'power2.out'
          }, 0.03)
        }
        if (otherCards.length > 0) {
          timeline.to(otherCards, { opacity: 0, x: 50, duration: 0.18, ease: 'power2.in' }, 0.08)
        }
        if (sourceCard) timeline.to(sourceCard, { opacity: 0, y: -10, duration: 0.16, ease: 'power2.in' }, 0.14)
        if (currentBreadcrumb) timeline.to(currentBreadcrumb, { opacity: 0, y: -8, duration: 0.14, ease: 'power2.in' }, 0.08)
        if (incomingBreadcrumb) {
          timeline.to(incomingBreadcrumb, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, 0.15)
        }
        if (incomingDetailHeader) {
          timeline.to(incomingDetailHeader, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, 0.16)
        }
        if (incomingContent.length > 0) {
          timeline.to(incomingContent, {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.28,
            stagger: 0.045,
            ease: 'back.out(1.35)'
          }, 0.18)
        }
        folderTimelineRef.current = timeline
        return
      }

      gsap.set(incomingContent, { opacity: 0, y: 12, scale: 0.96 })
      if (incomingBreadcrumb) gsap.set(incomingBreadcrumb, { opacity: 0, y: -12 })
      if (incomingDetailHeader) gsap.set(incomingDetailHeader, { opacity: 0, y: 8 })

      const timeline = gsap.timeline({ onComplete: completeTransition })
      if (currentCards.length > 0) {
        timeline.to(currentCards, {
          opacity: 0,
          scale: 0.82,
          y: 20,
          duration: 0.2,
          ease: 'power2.in'
        }, 0)
      }
      if (currentBreadcrumb) timeline.to(currentBreadcrumb, { opacity: 0, x: -12, duration: 0.18, ease: 'power2.in' }, 0)
      if (incomingBreadcrumb) {
        timeline.to(incomingBreadcrumb, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, 0.13)
      }
      if (incomingDetailHeader) {
        timeline.to(incomingDetailHeader, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, 0.13)
      }
      if (incomingContent.length > 0) {
        timeline.to(incomingContent, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.28,
          stagger: 0.045,
          ease: 'power2.out'
        }, 0.13)
      }
      folderTimelineRef.current = timeline
    }

    folderFrameRef.current = window.requestAnimationFrame(() => {
      folderFrameRef.current = window.requestAnimationFrame(runFolderTransition)
    })
  }

  const handleBack = () => {
    if (folderTransitioning) return
    if (currentFolder) {
      transitionToFolder(currentFolder.parentId ?? '', undefined, 'backward')
      return
    }
    onBack()
  }

  const getFolderContent = (folder: DynamicFolder) => {
    const folderCount = folders.filter((item) => item.parentId === folder.id).length
    const materialCount = groups.filter((group) => group.folderId === folder.id).length
    const parts: string[] = []
    if (folderCount > 0) parts.push(t('groups.folderCount', { count: folderCount }))
    if (materialCount > 0) parts.push(t('groups.materialCount', { count: materialCount }))
    return parts.join(' · ') || t('groups.emptyFolder')
  }

  const getMaterialContent = (group: DynamicGroup) => {
    const backgroundCount = group.backgrounds?.length ?? (group.background ? 1 : 0)
    return t('groups.materialSummary', { backgrounds: backgroundCount, objects: group.items.length })
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
          aria-label={t('groups.preview', { name: group.name })}
          onError={() => markPreviewFailed(group.id)}
        />
      )
    }
    return <img src={preview.url} alt={compact ? '' : group.name} decoding="async" onError={() => markPreviewFailed(group.id)} />
  }

  const renderMoreButton = (entity: LibraryEntity, interactive = true) => (
    <button
      type="button"
      className="dynamic-library-more-button"
      disabled={!interactive || folderTransitioning}
      onPointerDown={interactive ? (event) => event.stopPropagation() : undefined}
      onClick={interactive ? (event) => {
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        openEntityMenu(entity, rect.right, rect.bottom, false)
      } : undefined}
      aria-label={t('groups.openMenu', { name: getEntityName(entity) })}
      title={t('groups.moreActions')}
    >
      <MoreHorizontal aria-hidden="true" />
    </button>
  )

  const renderIconEntity = (entity: LibraryEntity, layerKey = 'current', interactive = true) => (
    <article
      key={`${layerKey}-${entity.kind}-${getEntityId(entity)}`}
      className={`dynamic-library-icon-card dynamic-library-entity-card ${entity.kind} ${menuTarget && getEntityId(menuTarget) === getEntityId(entity) ? 'menu-active' : ''}`}
      data-library-entity-id={getEntityId(entity)}
      data-library-entity-kind={entity.kind}
      onPointerDown={interactive ? (event) => handleEntityPointerDown(event, entity) : undefined}
      onPointerMove={interactive ? handleEntityPointerMove : undefined}
      onPointerUp={interactive ? handleEntityPointerEnd : undefined}
      onPointerCancel={interactive ? handleEntityPointerEnd : undefined}
      onPointerLeave={interactive ? handleEntityPointerEnd : undefined}
      onContextMenu={interactive ? (event) => {
        event.preventDefault()
        openEntityMenu(entity, event.clientX, event.clientY)
      } : undefined}
    >
      <button
        type="button"
        className="dynamic-library-icon-main"
        onClick={interactive ? (event) => handleEntityOpen(entity, event.currentTarget) : undefined}
        disabled={!interactive || folderTransitioning}
      >
        <span className="dynamic-library-icon-preview">
          {entity.kind === 'folder'
            ? <DynamicFolderArtwork folderId={entity.folder.id} />
            : renderMaterialPreview(entity.group)}
        </span>
        <span className="dynamic-library-icon-copy">
          <strong>{getEntityName(entity)}</strong>
          <small>{entity.kind === 'folder' ? getFolderContent(entity.folder) : getMaterialContent(entity.group)}</small>
        </span>
      </button>
      {renderMoreButton(entity, interactive)}
    </article>
  )

  const renderDetailEntity = (entity: LibraryEntity, layerKey = 'current', interactive = true) => (
    <article
      key={`${layerKey}-${entity.kind}-${getEntityId(entity)}`}
      className={`dynamic-library-detail-row dynamic-library-entity-card ${entity.kind} ${menuTarget && getEntityId(menuTarget) === getEntityId(entity) ? 'menu-active' : ''}`}
      data-library-entity-id={getEntityId(entity)}
      data-library-entity-kind={entity.kind}
      onPointerDown={interactive ? (event) => handleEntityPointerDown(event, entity) : undefined}
      onPointerMove={interactive ? handleEntityPointerMove : undefined}
      onPointerUp={interactive ? handleEntityPointerEnd : undefined}
      onPointerCancel={interactive ? handleEntityPointerEnd : undefined}
      onPointerLeave={interactive ? handleEntityPointerEnd : undefined}
      onContextMenu={interactive ? (event) => {
        event.preventDefault()
        openEntityMenu(entity, event.clientX, event.clientY)
      } : undefined}
    >
      <button
        type="button"
        className="dynamic-library-detail-main"
        onClick={interactive ? (event) => handleEntityOpen(entity, event.currentTarget) : undefined}
        disabled={!interactive || folderTransitioning}
      >
        <span className="dynamic-library-detail-name">
          <span className="dynamic-library-detail-thumbnail">
            {entity.kind === 'folder'
              ? <DynamicFolderArtwork folderId={entity.folder.id} compact />
              : renderMaterialPreview(entity.group, true)}
          </span>
          <strong>{getEntityName(entity)}</strong>
        </span>
        <time>{formatLibraryDate(getEntityUpdatedAt(entity), i18n.resolvedLanguage ?? i18n.language)}</time>
        <span>{entity.kind === 'folder' ? t('groups.folder') : t('groups.material')}</span>
        <span>{entity.kind === 'folder' ? getFolderContent(entity.folder) : getMaterialContent(entity.group)}</span>
      </button>
      {renderMoreButton(entity, interactive)}
    </article>
  )

  const renderBreadcrumbs = (
    folder: DynamicFolder | undefined,
    trail: DynamicFolder[],
    interactive: boolean
  ) => {
    if (!folder) return null
    return (
      <nav className="dynamic-library-breadcrumbs" aria-label={t('groups.currentPath')}>
        <button
          type="button"
          disabled={!interactive || folderTransitioning}
          onClick={interactive ? () => transitionToFolder('', undefined, 'backward') : undefined}
        >
          {t('groups.archive')}
        </button>
        {trail.map((trailFolder, index) => (
          <span key={trailFolder.id}>
            <ChevronRight aria-hidden="true" />
            <button
              type="button"
              disabled={!interactive || folderTransitioning}
              className={index === trail.length - 1 ? 'current' : ''}
              onClick={interactive ? () => transitionToFolder(trailFolder.id, undefined, 'backward') : undefined}
            >
              {trailFolder.name}
            </button>
          </span>
        ))}
      </nav>
    )
  }

  const renderLibraryBrowser = (list: LibraryEntity[], layerKey: string, interactive: boolean) => (
    <section className={`dynamic-library-browser view-${viewMode}`} aria-label={t('groups.libraryLabel')}>
      {viewMode === 'details' && list.length > 0 && (
        <div className="dynamic-library-detail-header" aria-hidden="true">
          <span>{t('groups.name')}</span>
          <span>{t('groups.modified')}</span>
          <span>{t('groups.type')}</span>
          <span>{t('groups.content')}</span>
          <span />
        </div>
      )}
      <div className={viewMode === 'icons' ? 'dynamic-library-icon-grid' : 'dynamic-library-detail-list'}>
        {list.map((entity) => viewMode === 'icons'
          ? renderIconEntity(entity, layerKey, interactive)
          : renderDetailEntity(entity, layerKey, interactive))}
        {list.length === 0 && (
          <div className="dynamic-library-empty-state">
            <span><Folder aria-hidden="true" /></span>
            <strong>{t('groups.emptyContent')}</strong>
            <div>
              <button type="button" disabled={!interactive} onClick={interactive ? () => openCreator('folder') : undefined}>
                <FolderPlus aria-hidden="true" />{t('groups.folder')}
              </button>
              <button type="button" disabled={!interactive} onClick={interactive ? () => openCreator('material') : undefined}>
                <FilePlus2 aria-hidden="true" />{t('groups.material')}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
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
    <main
      className={`ipad-screen dynamic-screen dynamic-library-screen apple-container ${portalArrival ? 'dynamic-portal-arriving' : ''} ${folderTransitioning ? 'folder-transitioning' : ''} ${transitionPrepared ? 'dynamic-transition-prepared' : ''}`}
      aria-busy={folderTransitioning || transitionPrepared}
      aria-hidden={transitionPrepared || undefined}
    >
      <header className="ipad-topbar dynamic-library-topbar">
        <div className="topbar-title-row">
          <button type="button" className="ipad-button ghost-button dynamic-library-back" onClick={handleBack}>
            <ArrowLeft aria-hidden="true" />
            <span>{currentFolder ? t('groups.previousLevel') : t('common.back')}</span>
          </button>
          <div className="min-w-0">
            <p className="eyebrow">{t('home.dynamicArt')}</p>
            <h1 className="screen-title">{t('groups.archive')}</h1>
          </div>
        </div>

        <div className="dynamic-library-toolbar-actions">
          <div className="dynamic-library-view-switch" role="group" aria-label={t('groups.viewMode')}>
            <button
              type="button"
              className={viewMode === 'icons' ? 'active' : ''}
              onClick={() => setViewMode('icons')}
              aria-label={t('groups.iconMode')}
              title={t('groups.iconMode')}
            >
              <Grid2X2 aria-hidden="true" />
            </button>
            <button
              type="button"
              className={viewMode === 'details' ? 'active' : ''}
              onClick={() => setViewMode('details')}
              aria-label={t('groups.detailMode')}
              title={t('groups.detailMode')}
            >
              <List aria-hidden="true" />
            </button>
          </div>
          <label className="dynamic-library-sort">
            <span>{t('groups.sort')}</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as DynamicLibrarySortMode)}>
              <option value="updated">{t('groups.modified')}</option>
              <option value="name">{t('groups.name')}</option>
              <option value="type">{t('groups.type')}</option>
            </select>
          </label>
          <button type="button" className="ipad-button secondary-button dynamic-library-create-action" onClick={() => openCreator('folder')}>
            <FolderPlus aria-hidden="true" />
            <span>{t('groups.newFolder')}</span>
          </button>
          <button type="button" className="ipad-button primary-button dynamic-library-create-action" onClick={() => openCreator('material')}>
            <FilePlus2 aria-hidden="true" />
            <span>{t('groups.newMaterial')}</span>
          </button>
        </div>
      </header>

      <div className="dynamic-library-content-stage">
        <div
          key={`current-${currentFolderId || 'root'}`}
          ref={currentLayerRef}
          className={`dynamic-library-depth-layer current-layer ${currentFolder ? 'has-breadcrumb' : ''}`}
        >
          {renderBreadcrumbs(currentFolder, breadcrumbs, true)}
          {renderLibraryBrowser(entities, `current-${currentFolderId || 'root'}`, true)}
        </div>

        {incomingFolderId !== null && (
          <div
            key={`incoming-${incomingFolderId || 'root'}`}
            ref={incomingLayerRef}
            className={`dynamic-library-depth-layer incoming-layer ${incomingFolder ? 'has-breadcrumb' : ''}`}
            aria-hidden="true"
          >
            {renderBreadcrumbs(incomingFolder, incomingBreadcrumbs, false)}
            {renderLibraryBrowser(incomingEntities, `incoming-${incomingFolderId || 'root'}`, false)}
          </div>
        )}
      </div>

      {menuTarget && (
        <>
          <button type="button" className="dynamic-group-menu-overlay" onClick={closeEntityMenu} aria-label={t('groups.closeMenu')} />
          <section
            className="dynamic-group-menu-popover dynamic-library-menu-popover"
            style={{ left: menuPosition.x, top: menuPosition.y }}
            role="menu"
            aria-label={t('groups.entityMenu', { name: getEntityName(menuTarget) })}
          >
            <button type="button" onClick={() => startEdit(menuTarget)} role="menuitem"><Pencil aria-hidden="true" />{t('groups.edit')}</button>
            <button type="button" onClick={() => startMove(menuTarget)} role="menuitem"><FolderInput aria-hidden="true" />{t('groups.moveTo')}</button>
            <button type="button" className="danger-menu-button" onClick={() => startDelete(menuTarget)} role="menuitem">
              <Trash2 aria-hidden="true" />{t('groups.delete')}
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
                <p className="eyebrow">{currentFolder?.name ?? t('groups.archive')}</p>
                <h2 id="library-create-title">{creatorType === 'folder' ? t('groups.newFolder') : t('groups.newMaterial')}</h2>
              </div>
              <button type="button" className="dynamic-panel-close" onClick={resetCreator} aria-label={t('common.close')}><X aria-hidden="true" /></button>
            </div>

            {creatorType === 'material' && (
              <>
                <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailChange} />
                <button type="button" className="dynamic-library-thumbnail-picker" onClick={() => thumbnailInputRef.current?.click()}>
                  {thumbnailPreview ? <img src={thumbnailPreview} alt={t('groups.thumbnailPreview')} /> : <span><ImageIcon aria-hidden="true" /><strong>{t('groups.chooseThumbnail')}</strong></span>}
                </button>
              </>
            )}

            <label className="settings-field">
              <span>{creatorType === 'folder' ? t('groups.folderName') : t('groups.materialName')}</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="ipad-input"
                placeholder={creatorType === 'folder' ? t('groups.folderPlaceholder') : t('groups.materialPlaceholder')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleCreate()
                }}
              />
            </label>

            <div className="settings-actions">
              <button type="button" className="ipad-button secondary-button" onClick={resetCreator}>{t('common.cancel')}</button>
              <button type="button" className="ipad-button primary-button" disabled={!name.trim() || isCreating} onClick={() => void handleCreate()}>
                {isCreating ? t('groups.creating') : t('groups.create')}
              </button>
            </div>
          </section>
        </div>
      )}

      {(editingGroup || editingFolder) && (
        <div className="dynamic-modal-overlay dynamic-library-modal-overlay">
          <button type="button" className="settings-scrim" onClick={resetEditor} aria-label={t('common.close')} />
          <section className="dynamic-library-form-modal" role="dialog" aria-modal="true" aria-labelledby="library-edit-title">
            <div className="dynamic-library-modal-heading">
              <div><p className="eyebrow">{t('groups.edit')}</p><h2 id="library-edit-title">{editingFolder ? t('groups.folder') : t('groups.material')}</h2></div>
              <button type="button" className="dynamic-panel-close" onClick={resetEditor} aria-label={t('common.close')}><X aria-hidden="true" /></button>
            </div>

            {editingGroup && (
              <>
                <input ref={editThumbnailInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditThumbnailChange} />
                <button type="button" className="dynamic-library-thumbnail-picker" onClick={() => editThumbnailInputRef.current?.click()}>
                  {editThumbnailPreview ? <img src={editThumbnailPreview} alt={t('groups.thumbnailPreview')} /> : <span><ImageIcon aria-hidden="true" /><strong>{t('groups.chooseThumbnail')}</strong></span>}
                </button>
              </>
            )}

            <label className="settings-field">
              <span>{t('groups.name')}</span>
              <input type="text" value={editName} onChange={(event) => setEditName(event.target.value)} className="ipad-input" autoFocus />
            </label>
            <div className="settings-actions">
              <button type="button" className="ipad-button secondary-button" onClick={resetEditor}>{t('common.cancel')}</button>
              <button type="button" className="ipad-button primary-button" disabled={!editName.trim() || isSavingEdit} onClick={() => void handleSaveEdit()}>
                {isSavingEdit ? t('groups.saving') : t('common.save')}
              </button>
            </div>
          </section>
        </div>
      )}

      {moveTarget && (
        <div className="dynamic-modal-overlay dynamic-library-modal-overlay">
          <button type="button" className="settings-scrim" onClick={() => setMoveTarget(null)} aria-label={t('common.close')} />
          <section className="dynamic-library-form-modal dynamic-library-move-modal" role="dialog" aria-modal="true" aria-labelledby="library-move-title">
            <div className="dynamic-library-modal-heading">
              <div><p className="eyebrow">{getEntityName(moveTarget)}</p><h2 id="library-move-title">{t('groups.moveTo')}</h2></div>
              <button type="button" className="dynamic-panel-close" onClick={() => setMoveTarget(null)} aria-label={t('common.close')}><X aria-hidden="true" /></button>
            </div>
            <div className="dynamic-library-folder-destinations" role="radiogroup" aria-label={t('groups.destination')}>
              <label className={!moveDestinationId ? 'active' : ''}>
                <input type="radio" name="destination" value="" checked={!moveDestinationId} onChange={() => setMoveDestinationId('')} />
                <span><Folder aria-hidden="true" /><strong>{t('groups.archive')}</strong></span>
              </label>
              {availableMoveFolders.map((folder) => (
                <label key={folder.id} className={moveDestinationId === folder.id ? 'active' : ''}>
                  <input type="radio" name="destination" value={folder.id} checked={moveDestinationId === folder.id} onChange={() => setMoveDestinationId(folder.id)} />
                  <span><Folder aria-hidden="true" /><strong>{getFolderPathLabel(folder)}</strong></span>
                </label>
              ))}
            </div>
            <div className="settings-actions">
              <button type="button" className="ipad-button secondary-button" onClick={() => setMoveTarget(null)}>{t('common.cancel')}</button>
              <button type="button" className="ipad-button primary-button" onClick={() => void handleMove()}>{t('groups.move')}</button>
            </div>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="dynamic-modal-overlay dynamic-library-modal-overlay">
          <button type="button" className="settings-scrim" onClick={() => setDeleteTarget(null)} aria-label={t('common.close')} />
          <section className="dynamic-library-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="library-delete-title">
            <span className="dynamic-library-delete-icon"><Trash2 aria-hidden="true" /></span>
            <div>
              <p className="eyebrow">{deleteTarget.kind === 'folder' ? t('groups.folder') : t('groups.material')}</p>
              <h2 id="library-delete-title">{confirmRecursiveDelete ? t('groups.confirmDeleteAgain') : t('groups.deleteQuestion', { name: getEntityName(deleteTarget) })}</h2>
              {deleteTarget.kind === 'folder' && deleteFolderHasContents && (
                <p>{confirmRecursiveDelete ? t('groups.recursiveWarning') : t('groups.folderContents', { folders: deleteFolderChildCount, materials: deleteFolderMaterialCount })}</p>
              )}
            </div>
            <div className="dynamic-library-delete-actions">
              <button type="button" className="ipad-button secondary-button" onClick={() => {
                setDeleteTarget(null)
                setConfirmRecursiveDelete(false)
              }}>{t('common.cancel')}</button>
              {deleteTarget.kind === 'material' ? (
                <button type="button" className="ipad-button danger-button" disabled={isDeleting} onClick={() => void handleDeleteMaterial(deleteTarget.group)}>
                  {isDeleting ? t('groups.deleting') : t('groups.deleteMaterial')}
                </button>
              ) : !deleteFolderHasContents ? (
                <button type="button" className="ipad-button danger-button" disabled={isDeleting} onClick={() => void handleDeleteFolderOnly(deleteTarget.folder)}>
                  {isDeleting ? t('groups.deleting') : t('groups.deleteFolder')}
                </button>
              ) : confirmRecursiveDelete ? (
                <button type="button" className="ipad-button danger-button" disabled={isDeleting} onClick={() => void handleDeleteFolderAndContents(deleteTarget.folder)}>
                  {isDeleting ? t('groups.deleting') : t('groups.confirmDeleteAll')}
                </button>
              ) : (
                <>
                  <button type="button" className="ipad-button secondary-button" disabled={isDeleting} onClick={() => void handleDeleteFolderOnly(deleteTarget.folder)}>
                    {t('groups.moveContentsDelete')}
                  </button>
                  <button type="button" className="ipad-button danger-button" disabled={isDeleting} onClick={() => void handleDeleteFolderAndContents(deleteTarget.folder)}>
                    {t('groups.deleteWithContents')}
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
