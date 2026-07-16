import { useEffect, useState } from 'react'
import EntryPage from './components/EntryPage.tsx'
import UploadPage from './components/UploadPage.tsx'
import DirectUploadCompletePage from './components/DirectUploadCompletePage.tsx'
import DirectUploadSelectPage from './components/DirectUploadSelectPage.tsx'
import SettingsPanel from './components/SettingsPanel.tsx'
import DynamicBackgroundPage from './components/DynamicBackgroundPage.tsx'
import DynamicGroupsPage from './components/DynamicGroupsPage.tsx'
import DynamicItemsPage from './components/DynamicItemsPage.tsx'
import DynamicControlPage from './components/DynamicControlPage.tsx'
import {
  loadNetworkSettings,
  saveNetworkSettings,
  type NetworkSettings
} from './services/appSettings.ts'
import { DIRECT_UPLOAD_THEMES, getDirectMasksForTheme, type DirectUploadTheme } from './services/directUploadThemes.ts'
import {
  loadDynamicGroups,
  type DynamicBackground,
  type DynamicGroup
} from './services/dynamicArtStorage.ts'
import { handleGlobalButtonPointerDown } from './services/uiFeedback.ts'

interface ImageData {
  name: string
  url: string
}

type Page =
  | 'entry'
  | 'dynamicBackground'
  | 'dynamicGroups'
  | 'dynamicItems'
  | 'dynamicControl'
  | 'directSelect'
  | 'directUpload'
  | 'directComplete'
type TransitionDirection = 'forward' | 'backward' | 'neutral'
type DynamicGroupsBackTarget = 'entry' | 'dynamicBackground'

const pageOrder: Record<Page, number> = {
  entry: 0,
  dynamicBackground: 1,
  dynamicGroups: 2,
  dynamicItems: 3,
  dynamicControl: 4,
  directSelect: 1,
  directUpload: 2,
  directComplete: 3
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('entry')
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>('neutral')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [networkSettings, setNetworkSettings] = useState<NetworkSettings>(() => loadNetworkSettings())
  const [directUploadResult, setDirectUploadResult] = useState<ImageData | null>(null)
  const [selectedDirectTheme, setSelectedDirectTheme] = useState<DirectUploadTheme>(() => DIRECT_UPLOAD_THEMES[0])
  const [dynamicGroups, setDynamicGroups] = useState<DynamicGroup[]>([])
  const [dynamicGroupsLoaded, setDynamicGroupsLoaded] = useState(false)
  const [draftBackground, setDraftBackground] = useState<DynamicBackground | undefined>()
  const [selectedDynamicGroupId, setSelectedDynamicGroupId] = useState('')
  const [selectedDynamicItemId, setSelectedDynamicItemId] = useState('')
  const [dynamicGroupsBackTarget, setDynamicGroupsBackTarget] = useState<DynamicGroupsBackTarget>('entry')

  const selectedDynamicGroup = dynamicGroups.find((group) => group.id === selectedDynamicGroupId)

  const navigateTo = (nextPage: Page) => {
    const nextDirection =
      pageOrder[nextPage] > pageOrder[currentPage]
        ? 'forward'
        : pageOrder[nextPage] < pageOrder[currentPage]
          ? 'backward'
          : 'neutral'
    setTransitionDirection(nextDirection)
    setCurrentPage(nextPage)
  }

  useEffect(() => {
    void (async () => {
      const groups = await loadDynamicGroups()
      setDynamicGroups(groups)
      setDynamicGroupsLoaded(true)
    })()
  }, [])

  const updateNetworkSettings = (nextSettings: NetworkSettings) => {
    saveNetworkSettings(nextSettings)
    setNetworkSettings(nextSettings)
  }

  const updateWsIp = (wsIp: string) => {
    updateNetworkSettings({
      ...networkSettings,
      wsIp
    })
  }

  const updateDynamicGroupState = (nextGroup: DynamicGroup) => {
    setDynamicGroups((currentGroups) => {
      const index = currentGroups.findIndex((group) => group.id === nextGroup.id)
      if (index < 0) return [nextGroup, ...currentGroups]

      const nextGroups = [...currentGroups]
      nextGroups[index] = nextGroup
      return nextGroups
    })
    setSelectedDynamicGroupId(nextGroup.id)
  }

  const openDynamicArtWithGroups = (groups: DynamicGroup[]) => {
    if (groups.length > 0) {
      setDynamicGroupsBackTarget('entry')
      navigateTo('dynamicGroups')
      return
    }

    setDynamicGroupsBackTarget('dynamicBackground')
    navigateTo('dynamicBackground')
  }

  const handleOpenDynamicArt = () => {
    if (dynamicGroupsLoaded) {
      openDynamicArtWithGroups(dynamicGroups)
      return
    }

    void (async () => {
      const groups = await loadDynamicGroups()
      setDynamicGroups(groups)
      setDynamicGroupsLoaded(true)
      openDynamicArtWithGroups(groups)
    })()
  }

  const handleOpenInteractiveArt = () => {
    setDirectUploadResult(null)
    navigateTo('directSelect')
  }

  const handleSelectDirectTheme = (theme: DirectUploadTheme) => {
    setSelectedDirectTheme(theme)
    setDirectUploadResult(null)
    navigateTo('directUpload')
  }

  const handleDirectUploadSuccess = (data: ImageData) => {
    setDirectUploadResult(data)
    navigateTo('directComplete')
  }

  const handleResetDirectUpload = () => {
    setDirectUploadResult(null)
    navigateTo('directUpload')
  }

  const handleCreateDynamicGroup = (group: DynamicGroup) => {
    updateDynamicGroupState(group)
    setDynamicGroupsBackTarget('entry')
  }

  const handleDeleteDynamicGroup = (groupId: string) => {
    setDynamicGroups((currentGroups) => currentGroups.filter((group) => group.id !== groupId))
    setSelectedDynamicGroupId((currentGroupId) => currentGroupId === groupId ? '' : currentGroupId)
    setSelectedDynamicItemId('')
  }

  const handleSelectDynamicGroup = (group: DynamicGroup) => {
    updateDynamicGroupState(group)
    setSelectedDynamicItemId('')
    navigateTo('dynamicItems')
  }

  const handleOpenDynamicControl = (itemId = '') => {
    if (!selectedDynamicGroup) return
    setSelectedDynamicItemId(itemId)
    navigateTo('dynamicControl')
  }

  return (
    <div className="min-h-screen bg-white" onPointerDown={handleGlobalButtonPointerDown}>
      <div className="portrait-lock" aria-hidden="true">
        <div>
          <strong>請橫屏使用 iPad</strong>
          <span>MagicFloor 為橫屏控制台設計，請旋轉設備繼續操作。</span>
        </div>
      </div>

      <div key={currentPage} className={`page-frame page-${transitionDirection}`}>
        {currentPage === 'entry' ? (
          <EntryPage
            wsIp={networkSettings.wsIp}
            dynamicGroups={dynamicGroups}
            onOpenDynamicArt={handleOpenDynamicArt}
            onOpenDynamicGroup={handleSelectDynamicGroup}
            onOpenInteractiveArt={handleOpenInteractiveArt}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : currentPage === 'dynamicBackground' ? (
          <DynamicBackgroundPage
            wsIp={networkSettings.wsIp}
            dynamicPort={networkSettings.dynamicPort}
            draftBackground={draftBackground}
            onBackToEntry={() => navigateTo('entry')}
            onBackgroundReady={setDraftBackground}
            onContinue={() => {
              setDynamicGroupsBackTarget('dynamicBackground')
              navigateTo('dynamicGroups')
            }}
          />
        ) : currentPage === 'dynamicGroups' ? (
          <DynamicGroupsPage
            groups={dynamicGroups}
            draftBackground={draftBackground}
            wsIp={networkSettings.wsIp}
            dynamicPort={networkSettings.dynamicPort}
            onBack={() => navigateTo(dynamicGroupsBackTarget)}
            onCreateGroup={handleCreateDynamicGroup}
            onUpdateGroup={updateDynamicGroupState}
            onDeleteGroup={handleDeleteDynamicGroup}
            onSelectGroup={handleSelectDynamicGroup}
          />
        ) : currentPage === 'dynamicItems' && selectedDynamicGroup ? (
          <DynamicItemsPage
            group={selectedDynamicGroup}
            wsIp={networkSettings.wsIp}
            dynamicPort={networkSettings.dynamicPort}
            onBack={() => navigateTo('dynamicGroups')}
            onGroupChange={updateDynamicGroupState}
            onOpenControl={handleOpenDynamicControl}
          />
        ) : currentPage === 'dynamicControl' && selectedDynamicGroup ? (
          <DynamicControlPage
            group={selectedDynamicGroup}
            wsIp={networkSettings.wsIp}
            dynamicPort={networkSettings.dynamicPort}
            onBack={() => navigateTo('dynamicItems')}
            onGroupChange={updateDynamicGroupState}
            initialItemId={selectedDynamicItemId}
          />
        ) : currentPage === 'directSelect' ? (
          <DirectUploadSelectPage
            selectedThemeId={selectedDirectTheme.id}
            wsIp={networkSettings.wsIp}
            uploadPort={networkSettings.interactivePort}
            onBackToEntry={() => navigateTo('entry')}
            onSelectTheme={handleSelectDirectTheme}
          />
        ) : currentPage === 'directUpload' ? (
          <UploadPage
            mode="direct"
            onUploadSuccess={handleDirectUploadSuccess}
            wsIp={networkSettings.wsIp}
            onWsIpChange={updateWsIp}
            selectedName="fish"
            onBackToHome={() => navigateTo('directSelect')}
            enableSupabaseUpload={false}
            selectedObjectIndex={0}
            uploadPort={networkSettings.interactivePort}
            shouldCacheArtwork={false}
            maskOptions={getDirectMasksForTheme(selectedDirectTheme)}
            directThemeName={selectedDirectTheme.label}
          />
        ) : currentPage === 'directComplete' ? (
          <DirectUploadCompletePage
            result={directUploadResult}
            wsIp={networkSettings.wsIp}
            uploadPort={networkSettings.interactivePort}
            onBackToEntry={() => navigateTo('entry')}
            onReupload={handleResetDirectUpload}
          />
        ) : (
          <EntryPage
            wsIp={networkSettings.wsIp}
            dynamicGroups={dynamicGroups}
            onOpenDynamicArt={handleOpenDynamicArt}
            onOpenDynamicGroup={handleSelectDynamicGroup}
            onOpenInteractiveArt={handleOpenInteractiveArt}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </div>

      {settingsOpen && (
        <SettingsPanel
          settings={networkSettings}
          onClose={() => setSettingsOpen(false)}
          onSave={updateNetworkSettings}
        />
      )}
    </div>
  )
}

export default App
