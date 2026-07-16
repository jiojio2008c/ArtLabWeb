import { useEffect, useRef, useState } from 'react'
import {
  createDynamicGroup,
  deleteDynamicGroup,
  updateDynamicGroupMeta,
  type DynamicBackground,
  type DynamicGroup
} from '../services/dynamicArtStorage.ts'
import { sendDynamicEvent } from '../services/unityBridge.ts'

interface DynamicGroupsPageProps {
  groups: DynamicGroup[]
  draftBackground?: DynamicBackground
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

const LONG_PRESS_DELAY_MS = 520
const LONG_PRESS_MOVE_TOLERANCE = 12

const DynamicGroupsPage: React.FC<DynamicGroupsPageProps> = ({
  groups,
  draftBackground,
  wsIp,
  dynamicPort,
  onBack,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onSelectGroup
}) => {
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const editThumbnailInputRef = useRef<HTMLInputElement>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressPointRef = useRef<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)

  const [isCreatorOpen, setIsCreatorOpen] = useState(false)
  const [name, setName] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | undefined>()
  const [thumbnailPreview, setThumbnailPreview] = useState<string | undefined>()
  const [isCreating, setIsCreating] = useState(false)
  const [menuGroupId, setMenuGroupId] = useState('')
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ x: 24, y: 96 })
  const [editingGroup, setEditingGroup] = useState<DynamicGroup | null>(null)
  const [editName, setEditName] = useState('')
  const [editThumbnailFile, setEditThumbnailFile] = useState<File | undefined>()
  const [editThumbnailPreview, setEditThumbnailPreview] = useState<string | undefined>()
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [deletingGroupId, setDeletingGroupId] = useState('')

  const activeMenuGroup = groups.find((group) => group.id === menuGroupId)

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  useEffect(() => () => clearLongPressTimer(), [])

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

  const openGroupMenu = (group: DynamicGroup, clientX: number, clientY: number) => {
    clearLongPressTimer()
    suppressClickRef.current = true
    setMenuPosition(getMenuPosition(clientX, clientY))
    setMenuGroupId(group.id)
  }

  const closeGroupMenu = () => {
    setMenuGroupId('')
    suppressClickRef.current = false
  }

  const handleThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setThumbnailFile(file)
    setThumbnailPreview(URL.createObjectURL(file))
    event.target.value = ''
  }

  const handleEditThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setEditThumbnailFile(file)
    setEditThumbnailPreview(URL.createObjectURL(file))
    event.target.value = ''
  }

  const resetCreator = () => {
    setName('')
    setThumbnailFile(undefined)
    setThumbnailPreview(undefined)
    setIsCreatorOpen(false)
  }

  const resetEditor = () => {
    setEditingGroup(null)
    setEditName('')
    setEditThumbnailFile(undefined)
    setEditThumbnailPreview(undefined)
  }

  const startEditGroup = (group: DynamicGroup) => {
    suppressClickRef.current = false
    setMenuGroupId('')
    setEditingGroup(group)
    setEditName(group.name)
    setEditThumbnailFile(undefined)
    setEditThumbnailPreview(group.thumbnail?.url)
  }

  const handleGroupPointerDown = (event: React.PointerEvent<HTMLButtonElement>, group: DynamicGroup) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    clearLongPressTimer()
    longPressPointRef.current = { x: event.clientX, y: event.clientY }

    const clientX = event.clientX
    const clientY = event.clientY
    longPressTimerRef.current = window.setTimeout(() => {
      openGroupMenu(group, clientX, clientY)
    }, LONG_PRESS_DELAY_MS)
  }

  const handleGroupPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const startPoint = longPressPointRef.current
    if (!startPoint) return

    const distance = Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y)
    if (distance > LONG_PRESS_MOVE_TOLERANCE) {
      clearLongPressTimer()
      longPressPointRef.current = null
    }
  }

  const handleGroupPointerEnd = () => {
    clearLongPressTimer()
    longPressPointRef.current = null
  }

  const handleGroupSelect = (group: DynamicGroup) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    if (menuGroupId) {
      setMenuGroupId('')
      return
    }

    sendDynamicEvent(wsIp, dynamicPort, 'GroupSelect', {
      groupId: group.id,
      name: group.name,
      itemCount: group.items.length
    })
    onSelectGroup(group)
  }

  const handleCreateGroup = async () => {
    if (isCreating) return

    setIsCreating(true)
    try {
      const group = await createDynamicGroup(name, thumbnailFile, draftBackground)
      sendDynamicEvent(wsIp, dynamicPort, 'GroupCreate', {
        groupId: group.id,
        name: group.name
      })

      if (group.background) {
        sendDynamicEvent(wsIp, dynamicPort, 'BackgroundSet', {
          groupId: group.id,
          assetId: group.background.id,
          name: group.background.name,
          mediaType: group.background.type,
          mimeType: group.background.mimeType
        })
      }

      onCreateGroup(group)
      resetCreator()
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateGroup = async () => {
    if (!editingGroup || isSavingEdit) return

    setIsSavingEdit(true)
    try {
      const nextGroup = await updateDynamicGroupMeta(editingGroup.id, {
        name: editName,
        thumbnailFile: editThumbnailFile
      })
      if (!nextGroup) return

      sendDynamicEvent(wsIp, dynamicPort, 'GroupUpdate', {
        groupId: nextGroup.id,
        name: nextGroup.name,
        ...(nextGroup.thumbnail ? { thumbnailAssetId: nextGroup.thumbnail.id } : {})
      })
      onUpdateGroup(nextGroup)
      resetEditor()
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteGroup = async (group: DynamicGroup) => {
    if (deletingGroupId) return

    const confirmed = window.confirm('確定要刪除此作品檔案？')
    if (!confirmed) return

    setDeletingGroupId(group.id)
    try {
      await deleteDynamicGroup(group.id)
      sendDynamicEvent(wsIp, dynamicPort, 'GroupDelete', {
        groupId: group.id
      })
      onDeleteGroup(group.id)
      closeGroupMenu()
    } finally {
      setDeletingGroupId('')
    }
  }

  return (
    <main className="ipad-screen dynamic-screen apple-container">
      <header className="ipad-topbar">
        <div className="topbar-title-row">
          <button type="button" className="ipad-button ghost-button" onClick={onBack}>
            返回
          </button>
          <div className="min-w-0">
            <p className="eyebrow">動態藝術</p>
            <h1 className="screen-title">作品檔案</h1>
          </div>
        </div>
      </header>

      <section className="dynamic-library-workspace" aria-label="作品檔案列表">
        <button
          type="button"
          className="dynamic-create-card"
          onClick={() => setIsCreatorOpen(true)}
          aria-label="新建作品檔案"
        >
          <span className="dynamic-plus-mark">+</span>
          <strong>新建</strong>
        </button>

        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            className={`dynamic-group-card ${menuGroupId === group.id ? 'menu-active' : ''}`}
            onClick={() => handleGroupSelect(group)}
            onPointerDown={(event) => handleGroupPointerDown(event, group)}
            onPointerMove={handleGroupPointerMove}
            onPointerUp={handleGroupPointerEnd}
            onPointerCancel={handleGroupPointerEnd}
            onPointerLeave={handleGroupPointerEnd}
            onContextMenu={(event) => {
              event.preventDefault()
              openGroupMenu(group, event.clientX, event.clientY)
            }}
          >
            {group.thumbnail ? (
              <img src={group.thumbnail.url} alt={group.name} />
            ) : group.background ? (
              group.background.type === 'video' ? (
                <video src={group.background.url} muted playsInline />
              ) : (
                <img src={group.background.url} alt={group.name} />
              )
            ) : (
              <span className="dynamic-group-empty" />
            )}
            <span className="dynamic-group-name">{group.name}</span>
          </button>
        ))}
      </section>

      {activeMenuGroup && (
        <>
          <button
            type="button"
            className="dynamic-group-menu-overlay"
            onClick={closeGroupMenu}
            aria-label="關閉作品檔案選單"
          />
          <section
            className="dynamic-group-menu-popover"
            style={{ left: menuPosition.x, top: menuPosition.y }}
            role="menu"
            aria-label={`${activeMenuGroup.name} 選單`}
          >
            <button type="button" onClick={() => startEditGroup(activeMenuGroup)} role="menuitem">
              編輯作品檔案
            </button>
            <button
              type="button"
              className="danger-menu-button"
              onClick={() => handleDeleteGroup(activeMenuGroup)}
              role="menuitem"
            >
              {deletingGroupId === activeMenuGroup.id ? '刪除中' : '刪除作品檔案'}
            </button>
          </section>
        </>
      )}

      {isCreatorOpen && (
        <div className="dynamic-modal-overlay">
          <button type="button" className="settings-scrim" onClick={resetCreator} aria-label="關閉" />
          <section className="dynamic-create-modal">
            <div className="settings-heading">
              <div>
                <p className="eyebrow">作品檔案</p>
                <h2>新建作品檔案</h2>
              </div>
              <button type="button" className="mini-action-button" onClick={resetCreator}>
                關閉
              </button>
            </div>

            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleThumbnailChange}
            />

            <button
              type="button"
              className="dynamic-thumbnail-picker"
              onClick={() => thumbnailInputRef.current?.click()}
            >
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="作品檔案縮略圖預覽" />
              ) : (
                <span>上載縮略圖</span>
              )}
            </button>

            <label className="settings-field">
              <span>檔案名稱</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="ipad-input"
                placeholder="輸入作品檔案名稱"
              />
            </label>

            <div className="settings-actions">
              <button type="button" className="ipad-button secondary-button" onClick={resetCreator}>
                取消
              </button>
              <button type="button" className="ipad-button primary-button" onClick={handleCreateGroup}>
                {isCreating ? '建立中' : '建立'}
              </button>
            </div>
          </section>
        </div>
      )}

      {editingGroup && (
        <div className="dynamic-modal-overlay">
          <button type="button" className="settings-scrim" onClick={resetEditor} aria-label="關閉" />
          <section className="dynamic-create-modal">
            <div className="settings-heading">
              <div>
                <p className="eyebrow">作品檔案</p>
                <h2>編輯作品檔案</h2>
              </div>
              <button type="button" className="mini-action-button" onClick={resetEditor}>
                關閉
              </button>
            </div>

            <input
              ref={editThumbnailInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleEditThumbnailChange}
            />

            <button
              type="button"
              className="dynamic-thumbnail-picker"
              onClick={() => editThumbnailInputRef.current?.click()}
            >
              {editThumbnailPreview ? (
                <img src={editThumbnailPreview} alt="作品檔案縮略圖預覽" />
              ) : (
                <span>更換縮略圖</span>
              )}
            </button>

            <label className="settings-field">
              <span>檔案名稱</span>
              <input
                type="text"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="ipad-input"
                placeholder="輸入作品檔案名稱"
              />
            </label>

            <div className="settings-actions">
              <button type="button" className="ipad-button secondary-button" onClick={resetEditor}>
                取消
              </button>
              <button type="button" className="ipad-button primary-button" onClick={handleUpdateGroup}>
                {isSavingEdit ? '儲存中' : '儲存'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default DynamicGroupsPage
