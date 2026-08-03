import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MAX_DYNAMIC_ITEMS_PER_GROUP,
  addDynamicItem,
  deleteDynamicItem,
  updateDynamicItemMeta,
  type DynamicGroup,
  type DynamicItem
} from '../services/dynamicArtStorage.ts'
import { sendDynamicEvent, uploadUnityAsset } from '../services/unityBridge.ts'
import { syncDynamicGroupToReceiver, type SyncStatus } from '../services/dynamicArtReceiverSync.ts'

interface DynamicItemsPageProps {
  group: DynamicGroup
  wsIp: string
  dynamicPort: number
  onBack: () => void
  onGroupChange: (group: DynamicGroup) => void
  onOpenControl: (itemId?: string) => void
}

interface MenuPosition {
  x: number
  y: number
}

const LONG_PRESS_DELAY_MS = 520
const LONG_PRESS_MOVE_TOLERANCE = 12

const DynamicItemsPage: React.FC<DynamicItemsPageProps> = ({
  group,
  wsIp,
  dynamicPort,
  onBack,
  onGroupChange,
  onOpenControl
}) => {
  const { t } = useTranslation()
  const createInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressPointRef = useRef<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)

  const [isCreatorOpen, setIsCreatorOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createFile, setCreateFile] = useState<File | undefined>()
  const [createPreview, setCreatePreview] = useState<string | undefined>()
  const [isCreating, setIsCreating] = useState(false)
  const [menuItemId, setMenuItemId] = useState('')
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ x: 24, y: 96 })
  const [editingItem, setEditingItem] = useState<DynamicItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editFile, setEditFile] = useState<File | undefined>()
  const [editPreview, setEditPreview] = useState<string | undefined>()
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState('')
  const [receiverSyncStatus, setReceiverSyncStatus] = useState<SyncStatus | 'complete' | null>(null)
  const [receiverSyncError, setReceiverSyncError] = useState(false)

  const activeMenuItem = group.items.find((item) => item.id === menuItemId)

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  useEffect(() => () => clearLongPressTimer(), [])

  useEffect(() => {
    let cancelled = false
    let clearTimer: number | undefined

    setReceiverSyncError(false)
    void syncDynamicGroupToReceiver({
      group,
      ip: wsIp,
      port: dynamicPort,
      onStatus: (status) => {
        if (!cancelled) setReceiverSyncStatus(status)
      }
    })
      .then((synced) => {
        if (cancelled || !synced) return
        setReceiverSyncStatus('complete')
        clearTimer = window.setTimeout(() => {
          setReceiverSyncStatus(null)
        }, 1600)
      })
      .catch(() => {
        if (cancelled) return
        setReceiverSyncStatus(null)
        setReceiverSyncError(true)
        clearTimer = window.setTimeout(() => {
          setReceiverSyncError(false)
        }, 2600)
      })

    return () => {
      cancelled = true
      if (clearTimer !== undefined) window.clearTimeout(clearTimer)
    }
  }, [dynamicPort, group, wsIp])

  const getMenuPosition = (clientX: number, clientY: number): MenuPosition => {
    const menuWidth = 232
    const menuHeight = 112
    const margin = 18
    const maxX = window.innerWidth - menuWidth - margin
    const maxY = window.innerHeight - menuHeight - margin

    return {
      x: Math.min(Math.max(clientX - 20, margin), Math.max(margin, maxX)),
      y: Math.min(Math.max(clientY + 14, margin), Math.max(margin, maxY))
    }
  }

  const openItemMenu = (item: DynamicItem, clientX: number, clientY: number) => {
    clearLongPressTimer()
    suppressClickRef.current = true
    setMenuPosition(getMenuPosition(clientX, clientY))
    setMenuItemId(item.id)
  }

  const closeItemMenu = () => {
    setMenuItemId('')
    suppressClickRef.current = false
  }

  const resetCreator = () => {
    setIsCreatorOpen(false)
    setCreateName('')
    setCreateFile(undefined)
    setCreatePreview(undefined)
  }

  const resetEditor = () => {
    setEditingItem(null)
    setEditName('')
    setEditFile(undefined)
    setEditPreview(undefined)
  }

  const handleCreateFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setCreateFile(file)
    setCreatePreview(URL.createObjectURL(file))
    setCreateName((currentName) => currentName || file.name.trim() || t('items.untitled'))
    event.target.value = ''
  }

  const handleEditFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setEditFile(file)
    setEditPreview(URL.createObjectURL(file))
    setEditName((currentName) => currentName || file.name.trim() || t('items.untitled'))
    event.target.value = ''
  }

  const startEditItem = (item: DynamicItem) => {
    suppressClickRef.current = false
    setMenuItemId('')
    setEditingItem(item)
    setEditName(item.name)
    setEditFile(undefined)
    setEditPreview(item.media.url)
  }

  const handleItemPointerDown = (event: React.PointerEvent<HTMLButtonElement>, item: DynamicItem) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    clearLongPressTimer()
    longPressPointRef.current = { x: event.clientX, y: event.clientY }

    const clientX = event.clientX
    const clientY = event.clientY
    longPressTimerRef.current = window.setTimeout(() => {
      openItemMenu(item, clientX, clientY)
    }, LONG_PRESS_DELAY_MS)
  }

  const handleItemPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const startPoint = longPressPointRef.current
    if (!startPoint) return

    const distance = Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y)
    if (distance > LONG_PRESS_MOVE_TOLERANCE) {
      clearLongPressTimer()
      longPressPointRef.current = null
    }
  }

  const handleItemPointerEnd = () => {
    clearLongPressTimer()
    longPressPointRef.current = null
  }

  const handleItemSelect = (item: DynamicItem) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    if (menuItemId) {
      setMenuItemId('')
      return
    }

    sendDynamicEvent(wsIp, dynamicPort, 'ItemSelect', {
      groupId: group.id,
      itemId: item.id
    })
    onOpenControl(item.id)
  }

  const handleCreateItem = async () => {
    if (isCreating) return

    if (group.items.length >= MAX_DYNAMIC_ITEMS_PER_GROUP) {
      window.alert(t('items.limitReached'))
      return
    }

    if (!createFile) {
      window.alert(t('items.uploadFirst'))
      return
    }

    setIsCreating(true)
    try {
      const nextGroup = await addDynamicItem(group.id, createFile, createName)
      if (!nextGroup) return

      const createdItem = nextGroup.items.find((item) => item.order === group.items.length)
        ?? nextGroup.items[nextGroup.items.length - 1]
      uploadUnityAsset({
        ip: wsIp,
        port: dynamicPort,
        file: createFile,
        fields: {
          role: 'item',
          groupId: group.id,
          itemId: createdItem.id,
          assetId: createdItem.media.id,
          mediaType: createdItem.media.type,
          mimeType: createdItem.media.mimeType
        }
      })
      sendDynamicEvent(wsIp, dynamicPort, 'ItemCreate', {
        groupId: group.id,
        itemId: createdItem.id,
        assetId: createdItem.media.id,
        name: createdItem.name,
        order: createdItem.order,
        gridIndex: createdItem.gridIndex
      })
      onGroupChange(nextGroup)
      resetCreator()
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateItem = async () => {
    if (!editingItem || isSavingEdit) return

    setIsSavingEdit(true)
    try {
      const nextGroup = await updateDynamicItemMeta(group.id, editingItem.id, {
        name: editName,
        file: editFile
      })
      if (!nextGroup) return

      const updatedItem = nextGroup.items.find((item) => item.id === editingItem.id)
      if (!updatedItem) return

      if (editFile) {
        uploadUnityAsset({
          ip: wsIp,
          port: dynamicPort,
          file: editFile,
          fields: {
            role: 'item',
            groupId: group.id,
            itemId: updatedItem.id,
            assetId: updatedItem.media.id,
            mediaType: updatedItem.media.type,
            mimeType: updatedItem.media.mimeType
          }
        })
      }

      sendDynamicEvent(wsIp, dynamicPort, 'ItemUpdate', {
        groupId: group.id,
        itemId: updatedItem.id,
        assetId: updatedItem.media.id,
        name: updatedItem.name,
        mediaType: updatedItem.media.type,
        mimeType: updatedItem.media.mimeType,
        replacedAsset: Boolean(editFile)
      })
      onGroupChange(nextGroup)
      resetEditor()
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteItem = async (item: DynamicItem) => {
    if (deletingItemId) return

    const confirmed = window.confirm(t('items.confirmDelete'))
    if (!confirmed) return

    setDeletingItemId(item.id)
    try {
      const nextGroup = await deleteDynamicItem(group.id, item.id)
      if (!nextGroup) return

      sendDynamicEvent(wsIp, dynamicPort, 'ItemDelete', {
        groupId: group.id,
        itemId: item.id
      })
      onGroupChange(nextGroup)
      closeItemMenu()
    } finally {
      setDeletingItemId('')
    }
  }

  return (
    <main className="ipad-screen dynamic-screen apple-container">
      <header className="ipad-topbar">
        <div className="topbar-title-row">
          <button type="button" className="ipad-button ghost-button" onClick={onBack}>
            {t('common.back')}
          </button>
          <div className="min-w-0">
            <p className="eyebrow">{t('groups.archive')}</p>
            <h1 className="screen-title">{group.name}</h1>
          </div>
        </div>
      </header>

      {(receiverSyncStatus || receiverSyncError) && (
        <div className={`status-toast ${receiverSyncError ? 'error' : 'success'}`}>
          {receiverSyncError
            ? t('sync.failed')
            : receiverSyncStatus === 'complete'
              ? t('sync.complete')
              : receiverSyncStatus
                ? t(`sync.${receiverSyncStatus.phase}`, {
                    current: receiverSyncStatus.current ?? 0,
                    total: receiverSyncStatus.total ?? 0
                  })
                : ''}
        </div>
      )}

      <section className="dynamic-items-workspace" aria-label={t('items.listLabel')}>
        <button
          type="button"
          className="dynamic-create-card"
          disabled={isCreating || group.items.length >= MAX_DYNAMIC_ITEMS_PER_GROUP}
          onClick={() => setIsCreatorOpen(true)}
          aria-label={t('items.add')}
        >
          <span className="dynamic-plus-mark">+</span>
          <strong>{isCreating ? t('groups.creating') : t('items.addShort')}</strong>
        </button>

        {group.items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`dynamic-item-card ${menuItemId === item.id ? 'menu-active' : ''}`}
            onClick={() => handleItemSelect(item)}
            onPointerDown={(event) => handleItemPointerDown(event, item)}
            onPointerMove={handleItemPointerMove}
            onPointerUp={handleItemPointerEnd}
            onPointerCancel={handleItemPointerEnd}
            onPointerLeave={handleItemPointerEnd}
            onContextMenu={(event) => {
              event.preventDefault()
              openItemMenu(item, event.clientX, event.clientY)
            }}
          >
            <img src={item.media.url} alt={item.name} />
            <span>{item.name}</span>
          </button>
        ))}
      </section>

      {activeMenuItem && (
        <>
          <button
            type="button"
            className="dynamic-group-menu-overlay"
            onClick={closeItemMenu}
            aria-label={t('items.closeMenu')}
          />
          <section
            className="dynamic-group-menu-popover"
            style={{ left: menuPosition.x, top: menuPosition.y }}
            role="menu"
            aria-label={t('groups.entityMenu', { name: activeMenuItem.name })}
          >
            <button type="button" onClick={() => startEditItem(activeMenuItem)} role="menuitem">
              {t('items.edit')}
            </button>
            <button
              type="button"
              className="danger-menu-button"
              onClick={() => handleDeleteItem(activeMenuItem)}
              role="menuitem"
            >
              {deletingItemId === activeMenuItem.id ? t('groups.deleting') : t('items.delete')}
            </button>
          </section>
        </>
      )}

      {isCreatorOpen && (
        <div className="dynamic-modal-overlay">
          <button type="button" className="settings-scrim" onClick={resetCreator} aria-label={t('common.close')} />
          <section className="dynamic-create-modal">
            <div className="settings-heading">
              <div>
                <p className="eyebrow">{t('items.object')}</p>
                <h2>{t('items.add')}</h2>
              </div>
              <button type="button" className="mini-action-button" onClick={resetCreator}>
                {t('common.close')}
              </button>
            </div>

            <input
              ref={createInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCreateFileChange}
            />

            <button
              type="button"
              className="dynamic-thumbnail-picker"
              onClick={() => createInputRef.current?.click()}
            >
              {createPreview ? (
                <img src={createPreview} alt={t('items.imagePreview')} />
              ) : (
                <span>{t('items.uploadImage')}</span>
              )}
            </button>

            <label className="settings-field">
              <span>{t('items.name')}</span>
              <input
                type="text"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                className="ipad-input"
                placeholder={t('items.namePlaceholder')}
              />
            </label>

            <div className="settings-actions">
              <button type="button" className="ipad-button secondary-button" onClick={resetCreator}>
                {t('common.cancel')}
              </button>
              <button type="button" className="ipad-button primary-button" onClick={handleCreateItem}>
                {isCreating ? t('groups.creating') : t('groups.create')}
              </button>
            </div>
          </section>
        </div>
      )}

      {editingItem && (
        <div className="dynamic-modal-overlay">
          <button type="button" className="settings-scrim" onClick={resetEditor} aria-label={t('common.close')} />
          <section className="dynamic-create-modal">
            <div className="settings-heading">
              <div>
                <p className="eyebrow">{t('items.object')}</p>
                <h2>{t('items.edit')}</h2>
              </div>
              <button type="button" className="mini-action-button" onClick={resetEditor}>
                {t('common.close')}
              </button>
            </div>

            <input
              ref={editInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleEditFileChange}
            />

            <button
              type="button"
              className="dynamic-thumbnail-picker"
              onClick={() => editInputRef.current?.click()}
            >
              {editPreview ? (
                <img src={editPreview} alt={t('items.imagePreview')} />
              ) : (
                <span>{t('items.replaceImage')}</span>
              )}
            </button>

            <label className="settings-field">
              <span>{t('items.name')}</span>
              <input
                type="text"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="ipad-input"
                placeholder={t('items.namePlaceholder')}
              />
            </label>

            <div className="settings-actions">
              <button type="button" className="ipad-button secondary-button" onClick={resetEditor}>
                {t('common.cancel')}
              </button>
              <button type="button" className="ipad-button primary-button" onClick={handleUpdateItem}>
                {isSavingEdit ? t('groups.saving') : t('common.save')}
              </button>
            </div>
          </section>
        </div>
      )}

      <div className="dynamic-items-footer">
        <span>{group.items.length}/{MAX_DYNAMIC_ITEMS_PER_GROUP}</span>
        {group.items.length > 0 && (
          <button type="button" className="ipad-button primary-button" onClick={() => onOpenControl()}>
            {t('items.enterControl')}
          </button>
        )}
      </div>
    </main>
  )
}

export default DynamicItemsPage
