import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import DynamicPortalTransition from './components/dynamicTransitions/DynamicPortalTransition.tsx'
import DynamicArtworkTransition from './components/dynamicTransitions/DynamicArtworkTransition.tsx'
import InteractiveMagicTransition from './components/interactiveTransitions/InteractiveMagicTransition.tsx'
import DirectThemeUploadTransition from './components/interactiveTransitions/DirectThemeUploadTransition.tsx'
import DirectThemeUploadReturnTransition from './components/interactiveTransitions/DirectThemeUploadReturnTransition.tsx'
import type {
  DynamicArtworkTransitionRequest,
  DynamicTransitionOrigin
} from './components/dynamicTransitions/types.ts'
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
import { sendAppLaunchCommand, sendQrCodeCommand } from './services/unityBridge.ts'

interface ImageData {
  name: string
  url: string
}

interface DirectThemeUploadTransitionRequest {
  theme: DirectUploadTheme
  origin: DynamicTransitionOrigin
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
type TransitionDirection = 'forward' | 'backward' | 'neutral' | 'portal'
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
  const { t } = useTranslation()
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
  const [directThemeUploadTransition, setDirectThemeUploadTransition] = useState<DirectThemeUploadTransitionRequest | null>(null)
  const [directThemeUploadReturnTransition, setDirectThemeUploadReturnTransition] = useState(false)
  const [dynamicGroups, setDynamicGroups] = useState<DynamicGroup[]>([])
  const [dynamicGroupsLoaded, setDynamicGroupsLoaded] = useState(false)
  const [selectedDynamicGroupId, setSelectedDynamicGroupId] = useState('')
  const [selectedDynamicItemId, setSelectedDynamicItemId] = useState('')
  const [dynamicPortalOrigin, setDynamicPortalOrigin] = useState<DynamicTransitionOrigin | null>(null)
  const [interactivePortalOrigin, setInteractivePortalOrigin] = useState<DynamicTransitionOrigin | null>(null)
  const [dynamicArtworkTransition, setDynamicArtworkTransition] = useState<DynamicArtworkTransitionRequest | null>(null)
  const [dynamicArchiveReturnActive, setDynamicArchiveReturnActive] = useState(false)
  const dynamicArchiveReturnTimerRef = useRef<number | null>(null)
  const entryRootRef = useRef<HTMLElement>(null)
  const dynamicEntryCardRef = useRef<HTMLButtonElement>(null)
  const interactiveEntryCardRef = useRef<HTMLButtonElement>(null)
  const directSelectRootRef = useRef<HTMLElement>(null)
  const directUploadRootRef = useRef<HTMLElement>(null)

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

  useEffect(() => () => {
    if (dynamicArchiveReturnTimerRef.current !== null) {
      window.clearTimeout(dynamicArchiveReturnTimerRef.current)
    }
  }, [])

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
        setDynamicPortalOrigin(null)
        setInteractivePortalOrigin(null)
        setDirectThemeUploadTransition(null)
        setDirectThemeUploadReturnTransition(false)
        setDynamicArtworkTransition(null)
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

    const rect = dynamicEntryCardRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      navigateTo('dynamicGroups')
      return
    }
    setDynamicPortalOrigin({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    })
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
    const rect = interactiveEntryCardRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      navigateTo('directSelect')
      return
    }
    setInteractivePortalOrigin({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    })
  }

  const handleSelectDirectTheme = (theme: DirectUploadTheme, card: HTMLButtonElement) => {
    if (directThemeUploadTransition) return

    sendAppLaunchCommand(networkSettings.wsIp, networkSettings.interactivePort, theme.launcherAppId)
    setSelectedDirectTheme(theme)
    setDirectUploadOpenMaskSelector(false)
    setDirectUploadResult(null)
    const rect = card.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      navigateTo('directUpload')
      return
    }

    setDirectThemeUploadTransition({
      theme,
      origin: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }
    })
  }

  const handleDirectUploadSuccess = (data: ImageData) => {
    setDirectUploadResult(data)
    navigateTo('directComplete')
  }

  const handleReturnFromDirectUpload = () => {
    if (directThemeUploadTransition || directThemeUploadReturnTransition) return
    setDirectThemeUploadReturnTransition(true)
  }

  const handleResetDirectUpload = () => {
    setDirectUploadResult(null)
    setDirectUploadOpenMaskSelector(true)
    navigateTo('directUpload')
  }

  const beginDynamicArtworkTransition = (group: DynamicGroup, origin?: DynamicTransitionOrigin) => {
    updateDynamicGroupState(group)
    setSelectedDynamicItemId('')
    const preview = group.thumbnail ?? group.background ?? group.items[0]?.media
    setDynamicArtworkTransition({
      direction: 'forward',
      groupId: group.id,
      groupName: group.name,
      previewUrl: preview?.url,
      previewType: preview?.type,
      origin
    })
  }

  const handleCreateDynamicGroup = (group: DynamicGroup) => {
    beginDynamicArtworkTransition(group)
  }

  const handleDeleteDynamicGroup = (groupId: string) => {
    setDynamicGroups((currentGroups) => currentGroups.filter((group) => group.id !== groupId))
    setSelectedDynamicGroupId((currentGroupId) => currentGroupId === groupId ? '' : currentGroupId)
    setSelectedDynamicItemId('')
  }

  const handleReturnFromDynamicGroups = () => {
    if (dynamicArchiveReturnTimerRef.current !== null) {
      window.clearTimeout(dynamicArchiveReturnTimerRef.current)
    }

    setDynamicArchiveReturnActive(true)
    navigateTo('entry')
    dynamicArchiveReturnTimerRef.current = window.setTimeout(() => {
      dynamicArchiveReturnTimerRef.current = null
      setDynamicArchiveReturnActive(false)
    }, 420)
  }

  const handleSelectDynamicGroup = (group: DynamicGroup, origin?: DynamicTransitionOrigin) => {
    beginDynamicArtworkTransition(group, origin)
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

  const handleReturnFromDynamicControl = () => {
    if (!selectedDynamicGroup || dynamicArtworkTransition) return
    const preview = selectedDynamicGroup.thumbnail ?? selectedDynamicGroup.background ?? selectedDynamicGroup.items[0]?.media
    setDynamicArtworkTransition({
      direction: 'backward',
      groupId: selectedDynamicGroup.id,
      groupName: selectedDynamicGroup.name,
      previewUrl: preview?.url,
      previewType: preview?.type
    })
  }

  const handleAuthenticated = () => {
    setCurrentPage('entry')
    setTransitionDirection('neutral')
    setSettingsOpen(false)
    setDirectUploadResult(null)
    setSelectedDynamicItemId('')
    setDynamicPortalOrigin(null)
    setInteractivePortalOrigin(null)
    setDirectThemeUploadTransition(null)
    setDirectThemeUploadReturnTransition(false)
    setDynamicArtworkTransition(null)
    setAuthStatus('authenticated')
  }

  const handleLogout = async () => {
    await logoutCurrentSession()
    setCurrentPage('entry')
    setTransitionDirection('neutral')
    setSettingsOpen(false)
    setDirectUploadResult(null)
    setSelectedDynamicItemId('')
    setDynamicPortalOrigin(null)
    setInteractivePortalOrigin(null)
    setDirectThemeUploadTransition(null)
    setDirectThemeUploadReturnTransition(false)
    setDynamicArtworkTransition(null)
    setCurrentAccount(null)
    setAccountLoading(false)
    setAuthStatus('unauthenticated')
  }

  const portraitLock = (
    <div className="portrait-lock" aria-hidden="true">
      <div>
        <strong>{t('orientation.title')}</strong>
        <span>{t('orientation.body')}</span>
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

  const dynamicTransitionClass = dynamicArtworkTransition
    ? `dynamic-story-route-active dynamic-story-route-${dynamicArtworkTransition.direction}`
    : dynamicPortalOrigin
      ? 'dynamic-portal-route-active'
      : interactivePortalOrigin
        ? 'interactive-magic-route-active'
        : directThemeUploadReturnTransition
          ? 'direct-theme-upload-return-route-active'
        : directThemeUploadTransition
          ? 'direct-theme-upload-route-active'
        : ''

  return (
    <div className={`min-h-screen bg-white ${dynamicTransitionClass} ${dynamicArchiveReturnActive ? 'dynamic-archive-return-active' : ''}`} onPointerDown={handleGlobalButtonPointerDown}>
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
            rootRef={entryRootRef}
            dynamicCardRef={dynamicEntryCardRef}
            interactiveCardRef={interactiveEntryCardRef}
            transitioning={Boolean(dynamicPortalOrigin || interactivePortalOrigin)}
            transitionType={dynamicPortalOrigin ? 'dynamic' : interactivePortalOrigin ? 'interactive' : undefined}
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
            onBack={handleReturnFromDynamicGroups}
            onCreateGroup={handleCreateDynamicGroup}
            onUpdateGroup={updateDynamicGroupState}
            onDeleteGroup={handleDeleteDynamicGroup}
            onSelectGroup={handleSelectDynamicGroup}
            portalArrival={Boolean(dynamicPortalOrigin)}
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
            onBack={handleReturnFromDynamicControl}
            onGroupChange={updateDynamicGroupState}
            initialItemId={selectedDynamicItemId}
          />
        ) : currentPage === 'directSelect' ? (
          <DirectUploadSelectPage
            rootRef={directSelectRootRef}
            selectedThemeId={selectedDirectTheme.id}
            transitioning={Boolean(directThemeUploadTransition || directThemeUploadReturnTransition)}
            onBackToEntry={() => navigateTo('entry')}
            onSelectTheme={handleSelectDirectTheme}
          />
        ) : currentPage === 'directUpload' ? (
          <UploadPage
            rootRef={directUploadRootRef}
            mode="direct"
            onUploadSuccess={handleDirectUploadSuccess}
            wsIp={networkSettings.wsIp}
            onWsIpChange={updateWsIp}
            selectedName="fish"
            onBackToHome={handleReturnFromDirectUpload}
            enableSupabaseUpload={false}
            selectedObjectIndex={0}
            uploadPort={networkSettings.interactivePort}
            shouldCacheArtwork={false}
            maskOptions={getDirectMasksForTheme(selectedDirectTheme)}
            directThemeName={t(selectedDirectTheme.labelKey)}
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
            rootRef={entryRootRef}
            dynamicCardRef={dynamicEntryCardRef}
            interactiveCardRef={interactiveEntryCardRef}
            transitioning={Boolean(dynamicPortalOrigin || interactivePortalOrigin)}
            transitionType={dynamicPortalOrigin ? 'dynamic' : interactivePortalOrigin ? 'interactive' : undefined}
          />
        )}
      </div>

      {dynamicPortalOrigin && (
        <DynamicPortalTransition
          origin={dynamicPortalOrigin}
          sourceRootRef={entryRootRef}
          sourceCardRef={dynamicEntryCardRef}
          onSceneSwitch={() => {
            setTransitionDirection('portal')
            setCurrentPage('dynamicGroups')
          }}
          onComplete={() => setDynamicPortalOrigin(null)}
        />
      )}

      {interactivePortalOrigin && (
        <InteractiveMagicTransition
          origin={interactivePortalOrigin}
          sourceRootRef={entryRootRef}
          sourceCardRef={interactiveEntryCardRef}
          onSceneSwitch={() => {
            setTransitionDirection('portal')
            setCurrentPage('directSelect')
          }}
          onComplete={() => setInteractivePortalOrigin(null)}
        />
      )}

      {directThemeUploadTransition && (
        <DirectThemeUploadTransition
          key={`direct-theme-upload-${directThemeUploadTransition.theme.id}`}
          origin={directThemeUploadTransition.origin}
          theme={directThemeUploadTransition.theme}
          sourceRootRef={directSelectRootRef}
          onSceneSwitch={() => {
            setTransitionDirection('portal')
            setCurrentPage('directUpload')
          }}
          onComplete={() => setDirectThemeUploadTransition(null)}
        />
      )}

      {directThemeUploadReturnTransition && (
        <DirectThemeUploadReturnTransition
          key={`direct-theme-upload-return-${selectedDirectTheme.id}`}
          theme={selectedDirectTheme}
          sourceRootRef={directUploadRootRef}
          targetRootRef={directSelectRootRef}
          onSceneSwitch={() => {
            setTransitionDirection('portal')
            setCurrentPage('directSelect')
          }}
          onComplete={() => setDirectThemeUploadReturnTransition(false)}
        />
      )}

      {dynamicArtworkTransition && (
        <DynamicArtworkTransition
          request={dynamicArtworkTransition}
          onSceneSwitch={() => {
            setTransitionDirection(dynamicArtworkTransition.direction === 'forward' ? 'forward' : 'backward')
            setCurrentPage(dynamicArtworkTransition.direction === 'forward' ? 'dynamicControl' : 'dynamicGroups')
          }}
          onComplete={() => setDynamicArtworkTransition(null)}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={networkSettings}
          account={currentAccount}
          accountLoading={accountLoading}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSettingsSave}
          onShowQrCode={sendQrCodeCommand}
          onLogout={handleLogout}
        />
      )}
    </div>
  )
}

export default App
