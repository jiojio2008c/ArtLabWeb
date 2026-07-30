import { useEffect, useState } from 'react'
import LoginPage from './components/LoginPage.tsx'
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
  type DynamicGroup
} from './services/dynamicArtStorage.ts'
import { markDynamicReceiverNeedsResync } from './services/dynamicArtReceiverSync.ts'
import { handleGlobalButtonPointerDown } from './services/uiFeedback.ts'
import { getCurrentSession, logoutCurrentSession, subscribeToAuthChanges } from './services/authService.ts'
import { loadCurrentUserAccount, type UserAccount } from './services/userProfileService.ts'
import { sendAppLaunchCommand } from './services/unityBridge.ts'

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
type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'

const pageOrder: Record<Page, number> = {
  entry: 0,
  dynamicGroups: 1,
  dynamicBackground: 2,
  dynamicItems: 3,
  dynamicControl: 4,
  directSelect: 1,
  directUpload: 2,
  directComplete: 3
}

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [currentPage, setCurrentPage] = useState<Page>('entry')
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>('neutral')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [currentAccount, setCurrentAccount] = useState<UserAccount | null>(null)
  const [accountLoading, setAccountLoading] = useState(false)
  const [networkSettings, setNetworkSettings] = useState<NetworkSettings>(() => loadNetworkSettings())
  const [directUploadResult, setDirectUploadResult] = useState<ImageData | null>(null)
  const [selectedDirectTheme, setSelectedDirectTheme] = useState<DirectUploadTheme>(() => DIRECT_UPLOAD_THEMES[0])
  const [directUploadOpenMaskSelector, setDirectUploadOpenMaskSelector] = useState(false)
  const [dynamicGroups, setDynamicGroups] = useState<DynamicGroup[]>([])
  const [dynamicGroupsLoaded, setDynamicGroupsLoaded] = useState(false)
  const [selectedDynamicGroupId, setSelectedDynamicGroupId] = useState('')
  const [selectedDynamicItemId, setSelectedDynamicItemId] = useState('')

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
    let active = true

    void getCurrentSession()
      .then((session) => {
        if (active) setAuthStatus(session ? 'authenticated' : 'unauthenticated')
      })
      .catch(() => {
        if (active) setAuthStatus('unauthenticated')
      })

    const unsubscribe = subscribeToAuthChanges((event, session) => {
      if (!active) return

      if (event === 'SIGNED_OUT' || !session) {
        setCurrentPage('entry')
        setTransitionDirection('neutral')
        setSettingsOpen(false)
        setDirectUploadResult(null)
        setSelectedDynamicItemId('')
        setCurrentAccount(null)
        setAccountLoading(false)
        setAuthStatus('unauthenticated')
        return
      }

      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setAuthStatus('authenticated')
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      setCurrentAccount(null)
      setAccountLoading(false)
      return
    }

    const controller = new AbortController()
    let active = true
    setAccountLoading(true)

    void loadCurrentUserAccount(controller.signal)
      .then((account) => {
        if (active) setCurrentAccount(account)
      })
      .catch(() => {
        if (active) setCurrentAccount(null)
      })
      .finally(() => {
        if (active) setAccountLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [authStatus])

  useEffect(() => {
    if (authStatus !== 'authenticated') return

    let active = true
    void (async () => {
      const groups = await loadDynamicGroups()
      if (active) {
        setDynamicGroups(groups)
        setDynamicGroupsLoaded(true)
      }
    })()

    return () => {
      active = false
    }
  }, [authStatus])

  const updateNetworkSettings = (nextSettings: NetworkSettings) => {
    saveNetworkSettings(nextSettings)
    setNetworkSettings(nextSettings)
  }

  const handleSettingsSave = (nextSettings: NetworkSettings) => {
    updateNetworkSettings(nextSettings)
    markDynamicReceiverNeedsResync(nextSettings.wsIp, nextSettings.dynamicPort)
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
    if (groups.length === 0) {
      setSelectedDynamicGroupId('')
      setSelectedDynamicItemId('')
    }
    navigateTo('dynamicGroups')
  }

  const handleOpenDynamicArt = () => {
    sendAppLaunchCommand(networkSettings.wsIp, networkSettings.interactivePort, 'dynamic-art')

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
    sendAppLaunchCommand(networkSettings.wsIp, networkSettings.interactivePort, theme.launcherAppId)
    setSelectedDirectTheme(theme)
    setDirectUploadOpenMaskSelector(false)
    setDirectUploadResult(null)
    navigateTo('directUpload')
  }

  const handleDirectUploadSuccess = (data: ImageData) => {
    setDirectUploadResult(data)
    navigateTo('directComplete')
  }

  const handleResetDirectUpload = () => {
    setDirectUploadResult(null)
    setDirectUploadOpenMaskSelector(true)
    navigateTo('directUpload')
  }

  const handleCreateDynamicGroup = (group: DynamicGroup) => {
    updateDynamicGroupState(group)
    setSelectedDynamicItemId('')
    navigateTo('dynamicControl')
  }

  const handleDeleteDynamicGroup = (groupId: string) => {
    setDynamicGroups((currentGroups) => currentGroups.filter((group) => group.id !== groupId))
    setSelectedDynamicGroupId((currentGroupId) => currentGroupId === groupId ? '' : currentGroupId)
    setSelectedDynamicItemId('')
  }

  const handleSelectDynamicGroup = (group: DynamicGroup) => {
    updateDynamicGroupState(group)
    setSelectedDynamicItemId('')
    navigateTo('dynamicControl')
  }

  const handleDynamicBackgroundComplete = (group: DynamicGroup) => {
    updateDynamicGroupState(group)
    setSelectedDynamicItemId('')
    navigateTo('dynamicItems')
  }

  const handleOpenDynamicControl = (itemId = '') => {
    if (!selectedDynamicGroup) return
    setSelectedDynamicItemId(itemId)
    navigateTo('dynamicControl')
  }

  const handleAuthenticated = () => {
    setCurrentPage('entry')
    setTransitionDirection('neutral')
    setSettingsOpen(false)
    setDirectUploadResult(null)
    setSelectedDynamicItemId('')
    setAuthStatus('authenticated')
  }

  const handleLogout = async () => {
    await logoutCurrentSession()
    setCurrentPage('entry')
    setTransitionDirection('neutral')
    setSettingsOpen(false)
    setDirectUploadResult(null)
    setSelectedDynamicItemId('')
    setCurrentAccount(null)
    setAccountLoading(false)
    setAuthStatus('unauthenticated')
  }

  const portraitLock = (
    <div className="portrait-lock" aria-hidden="true">
      <div>
        <strong>請橫屏使用 iPad</strong>
        <span>MagicFloor 為橫屏控制台設計，請旋轉設備繼續操作。</span>
      </div>
    </div>
  )

  if (authStatus !== 'authenticated') {
    return (
      <div className="min-h-screen bg-white" onPointerDown={handleGlobalButtonPointerDown}>
        {portraitLock}
        <div className="page-frame auth-page-frame">
          <LoginPage
            checkingSession={authStatus === 'checking'}
            onAuthenticated={handleAuthenticated}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white" onPointerDown={handleGlobalButtonPointerDown}>
      {portraitLock}

      <div key={currentPage} className={`page-frame page-${transitionDirection} page-view-${currentPage}`}>
        {currentPage === 'entry' ? (
          <EntryPage
            wsIp={networkSettings.wsIp}
            dynamicGroups={dynamicGroups}
            onOpenDynamicArt={handleOpenDynamicArt}
            onOpenDynamicGroup={handleSelectDynamicGroup}
            onOpenInteractiveArt={handleOpenInteractiveArt}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : currentPage === 'dynamicBackground' && selectedDynamicGroup ? (
          <DynamicBackgroundPage
            wsIp={networkSettings.wsIp}
            dynamicPort={networkSettings.dynamicPort}
            group={selectedDynamicGroup}
            onBack={() => navigateTo('dynamicGroups')}
            onGroupChange={updateDynamicGroupState}
            onContinue={handleDynamicBackgroundComplete}
          />
        ) : currentPage === 'dynamicGroups' ? (
          <DynamicGroupsPage
            groups={dynamicGroups}
            wsIp={networkSettings.wsIp}
            dynamicPort={networkSettings.dynamicPort}
            onBack={() => navigateTo('entry')}
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
            onBack={() => navigateTo('dynamicGroups')}
            onGroupChange={updateDynamicGroupState}
            initialItemId={selectedDynamicItemId}
          />
        ) : currentPage === 'directSelect' ? (
          <DirectUploadSelectPage
            selectedThemeId={selectedDirectTheme.id}
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
            openMaskSelector={directUploadOpenMaskSelector}
          />
        ) : currentPage === 'directComplete' ? (
          <DirectUploadCompletePage
            result={directUploadResult}
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
          account={currentAccount}
          accountLoading={accountLoading}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSettingsSave}
          onLogout={handleLogout}
        />
      )}
    </div>
  )
}

export default App
