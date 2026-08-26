import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import LoginPage from './components/LoginPage.tsx'
import EntryPage from './components/EntryPage.tsx'
import RemoteKeyboardPage from './components/RemoteKeyboardPage.tsx'
import UploadPage from './components/UploadPage.tsx'
import DirectUploadCompletePage from './components/DirectUploadCompletePage.tsx'
import DirectUploadSelectPage from './components/DirectUploadSelectPage.tsx'
import HomeReturnConfirmDialog from './components/HomeReturnConfirmDialog.tsx'
import type { HomeReturnScope } from './components/HomeReturnConfirmDialog.tsx'
import SettingsPanel from './components/SettingsPanel.tsx'
import DynamicBackgroundPage from './components/DynamicBackgroundPage.tsx'
import DynamicGroupsPage from './components/DynamicGroupsPage.tsx'
import DynamicItemsPage from './components/DynamicItemsPage.tsx'
import DynamicControlPage from './components/DynamicControlPage.tsx'
import { getContentAwareThumbnailSource } from './components/ContentAwareThumbnail.tsx'
import DynamicPortalTransition from './components/dynamicTransitions/DynamicPortalTransition.tsx'
import DynamicArtworkTransition from './components/dynamicTransitions/DynamicArtworkTransition.tsx'
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
  getDynamicItemMedia,
  loadDynamicGroups,
  type DynamicGroup
} from './services/dynamicArtStorage.ts'
import {
  captureDynamicArchiveSourceSnapshot,
  makeDynamicArchiveReplayId,
  sendDynamicArchiveEnter,
  sendDynamicArchiveReturn,
  type DynamicArchiveSourceSnapshot
} from './services/dynamicArtArchiveSync.ts'
import { markDynamicReceiverNeedsResync } from './services/dynamicArtReceiverSync.ts'
import { removeDynamicCreationFlowSession } from './services/dynamicCreationFlowStorage.ts'
import type { DynamicCreationFlowExperience } from './services/dynamicCreationFlowCore.js'
import { handleGlobalButtonPointerDown } from './services/uiFeedback.ts'
import { getCurrentSession, logoutCurrentSession, subscribeToAuthChanges } from './services/authService.ts'
import { loadCurrentUserAccount, type UserAccount } from './services/userProfileService.ts'
import { sendAppCloseCommand, sendAppLaunchCommand, sendDynamicEvent, sendQrCodeCommand } from './services/unityBridge.ts'
import { preloadImage } from './services/transitionPerformance.ts'

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
  | 'remoteKeyboard'
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
  remoteKeyboard: 1,
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
  const [dynamicArchiveGroups, setDynamicArchiveGroups] = useState<DynamicGroup[]>([])
  const [dynamicGroupsLoaded, setDynamicGroupsLoaded] = useState(false)
  const [selectedDynamicGroupId, setSelectedDynamicGroupId] = useState('')
  const [selectedDynamicItemId, setSelectedDynamicItemId] = useState('')
  const [dynamicEditorExperience, setDynamicEditorExperience] = useState<DynamicCreationFlowExperience>('free')
  const [dynamicPortalOrigin, setDynamicPortalOrigin] = useState<DynamicTransitionOrigin | null>(null)
  const [interactivePortalOrigin, setInteractivePortalOrigin] = useState<DynamicTransitionOrigin | null>(null)
  const [dynamicArtworkTransition, setDynamicArtworkTransition] = useState<DynamicArtworkTransitionRequest | null>(null)
  const [dynamicArchiveReturnActive, setDynamicArchiveReturnActive] = useState(false)
  const [dynamicArchiveReplayId, setDynamicArchiveReplayId] = useState('')
  const [homeReturnScope, setHomeReturnScope] = useState<HomeReturnScope | null>(null)
  const [homeReturnPending, setHomeReturnPending] = useState(false)
  const dynamicArchiveReturnTimerRef = useRef<number | null>(null)
  const dynamicArchiveSyncTimerRefs = useRef<number[]>([])
  const dynamicArchiveOpeningRef = useRef(false)
  const homeReturnRequestRef = useRef<HomeReturnScope | null>(null)
  const homeReturnPendingRef = useRef(false)
  const homeReturnResetTimerRef = useRef<number | null>(null)
  const dynamicHomeReturnBlockedRef = useRef(false)
  const interactiveHomeReturnBlockedRef = useRef(false)
  const entryRootRef = useRef<HTMLElement>(null)
  const dynamicEntryCardRef = useRef<HTMLButtonElement>(null)
  const interactiveEntryCardRef = useRef<HTMLButtonElement>(null)
  const directSelectRootRef = useRef<HTMLElement>(null)
  const directUploadRootRef = useRef<HTMLElement>(null)

  dynamicHomeReturnBlockedRef.current = Boolean(dynamicPortalOrigin || dynamicArtworkTransition)
  interactiveHomeReturnBlockedRef.current = Boolean(
    interactivePortalOrigin
    || directThemeUploadTransition
    || directThemeUploadReturnTransition
  )

  const selectedDynamicGroup = dynamicGroups.find((group) => group.id === selectedDynamicGroupId)

  const mergeDynamicArchiveGroups = (currentGroups: DynamicGroup[], nextGroups: DynamicGroup[]) => {
    const currentById = new Map(currentGroups.map((group) => [group.id, group]))
    const getMediaSignature = (media: DynamicGroup['thumbnail'] | DynamicGroup['background']) => media
      ? [media.id, media.name, media.type, media.url, media.width ?? 0, media.height ?? 0].join(':')
      : ''
    const getGroupSignature = (group: DynamicGroup) => JSON.stringify([
      group.id,
      group.name,
      group.folderId ?? '',
      group.libraryOrder ?? -1,
      group.activeBackgroundId ?? '',
      getMediaSignature(group.thumbnail),
      getMediaSignature(group.background),
      (group.backgrounds ?? []).map((background) => getMediaSignature(background)),
      group.items.map((item) => [
        item.id,
        item.name,
        item.kind,
        item.kind === 'bubble'
          ? JSON.stringify(item.bubble)
          : getMediaSignature(item.media)
      ])
    ])
    const mergedGroups = nextGroups.map((group) => {
      const currentGroup = currentById.get(group.id)
      return currentGroup && getGroupSignature(currentGroup) === getGroupSignature(group)
        ? currentGroup
        : group
    })
    const unchanged = mergedGroups.length === currentGroups.length
      && mergedGroups.every((group, index) => group === currentGroups[index])
    return unchanged ? currentGroups : mergedGroups
  }

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

  const clearDynamicArchiveSyncTimers = () => {
    dynamicArchiveSyncTimerRefs.current.forEach((timerId) => window.clearTimeout(timerId))
    dynamicArchiveSyncTimerRefs.current = []
  }

  const syncDynamicArchiveEnter = (
    replayId: string,
    startedAt: number,
    source?: DynamicArchiveSourceSnapshot
  ) => {
    clearDynamicArchiveSyncTimers()

    const sendArchive = () => {
      sendDynamicArchiveEnter(
        networkSettings.wsIp,
        networkSettings.dynamicPort,
        replayId,
        startedAt,
        source
      )
    }

    sendArchive()
    dynamicArchiveSyncTimerRefs.current = [700, 1700, 3200, 5200, 8000].map((delay) => (
      window.setTimeout(sendArchive, delay)
    ))
  }

  useEffect(() => () => {
    if (dynamicArchiveReturnTimerRef.current !== null) {
      window.clearTimeout(dynamicArchiveReturnTimerRef.current)
    }
    if (homeReturnResetTimerRef.current !== null) {
      window.clearTimeout(homeReturnResetTimerRef.current)
    }
    clearDynamicArchiveSyncTimers()
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
        homeReturnRequestRef.current = null
        homeReturnPendingRef.current = false
        if (homeReturnResetTimerRef.current !== null) {
          window.clearTimeout(homeReturnResetTimerRef.current)
          homeReturnResetTimerRef.current = null
        }
        setHomeReturnScope(null)
        setHomeReturnPending(false)
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

  const updateNetworkSettings = useCallback((nextSettings: NetworkSettings) => {
    const normalizedSettings = {
      ...nextSettings,
      advancedFeaturesEnabled: true
    }
    saveNetworkSettings(normalizedSettings)
    setNetworkSettings(normalizedSettings)
  }, [])

  const handleSettingsSave = useCallback((nextSettings: NetworkSettings) => {
    updateNetworkSettings(nextSettings)
    markDynamicReceiverNeedsResync(nextSettings.wsIp, nextSettings.dynamicPort)
    sendDynamicEvent(nextSettings.wsIp, nextSettings.dynamicPort, 'DisplaySettings', {
      watermarkEnabled: nextSettings.watermarkEnabled
    })
  }, [updateNetworkSettings])

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
    if (dynamicArchiveOpeningRef.current) return
    dynamicArchiveOpeningRef.current = true

    void (async () => {
      const sourceRoot = entryRootRef.current
      const sourceCard = dynamicEntryCardRef.current
      const groupsPromise = dynamicGroupsLoaded
        ? Promise.resolve(dynamicGroups)
        : loadDynamicGroups()
      const sourcePromise = sourceRoot && sourceCard
        ? captureDynamicArchiveSourceSnapshot(sourceRoot, sourceCard).catch((error) => {
            console.warn('Dynamic archive source mirror capture failed:', error)
            return undefined
          })
        : Promise.resolve(undefined)
      const [groups, source] = await Promise.all([groupsPromise, sourcePromise])

      if (!dynamicGroupsLoaded) {
        setDynamicGroups(groups)
        setDynamicGroupsLoaded(true)
      }

      const replayId = makeDynamicArchiveReplayId()
      const startedAt = Date.now()
      setDynamicArchiveReplayId(replayId)
      sendAppLaunchCommand(networkSettings.wsIp, networkSettings.interactivePort, 'dynamic-art')
      syncDynamicArchiveEnter(replayId, startedAt, source)
      openDynamicArtWithGroups(groups)
    })().finally(() => {
      dynamicArchiveOpeningRef.current = false
    })
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

  const handleDirectUploadSuccess = async (data: ImageData) => {
    await preloadImage(data.url, 1500)
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

  const handleReturnFromDirectComplete = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    setDirectUploadResult(null)
    setDirectUploadOpenMaskSelector(false)
    setDirectThemeUploadTransition(null)
    setDirectThemeUploadReturnTransition(false)
    navigateTo('directUpload')
  }

  const resolveDynamicEditorExperience = (_experience: DynamicCreationFlowExperience) => 'free' as const

  const beginDynamicArtworkTransition = (
    group: DynamicGroup,
    origin?: DynamicTransitionOrigin,
    experience?: DynamicCreationFlowExperience
  ) => {
    clearDynamicArchiveSyncTimers()
    setDynamicArchiveGroups((currentGroups) => mergeDynamicArchiveGroups(currentGroups, dynamicGroups))
    updateDynamicGroupState(group)
    setSelectedDynamicItemId('')
    if (experience) setDynamicEditorExperience(resolveDynamicEditorExperience(experience))
    const preview = group.thumbnail
      ?? group.background
      ?? group.items.map(getDynamicItemMedia).find(Boolean)
    setDynamicArtworkTransition({
      direction: 'forward',
      groupId: group.id,
      groupName: group.name,
      previewUrl: group.thumbnail?.type === 'image'
        ? getContentAwareThumbnailSource(group.thumbnail.url)
        : preview?.url,
      previewType: preview?.type,
      origin
    })
  }

  const handleCreateDynamicGroup = (group: DynamicGroup) => {
    beginDynamicArtworkTransition(group, undefined, 'free')
  }

  const handleDeleteDynamicGroup = (groupId: string) => {
    removeDynamicCreationFlowSession(groupId)
    setDynamicGroups((currentGroups) => currentGroups.filter((group) => group.id !== groupId))
    setSelectedDynamicGroupId((currentGroupId) => currentGroupId === groupId ? '' : currentGroupId)
    setSelectedDynamicItemId('')
  }

  const completeDynamicArchiveReturn = () => {
    clearDynamicArchiveSyncTimers()
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

  const requestHomeReturn = useCallback((scope: HomeReturnScope) => {
    if (homeReturnRequestRef.current !== null || homeReturnPendingRef.current) return
    if (scope === 'dynamic-art' && dynamicHomeReturnBlockedRef.current) return
    if (scope === 'interactive-art' && interactiveHomeReturnBlockedRef.current) return

    homeReturnRequestRef.current = scope
    setHomeReturnScope(scope)
  }, [])

  const cancelHomeReturn = useCallback(() => {
    if (homeReturnPendingRef.current) return
    homeReturnRequestRef.current = null
    setHomeReturnScope(null)
  }, [])

  const confirmHomeReturn = () => {
    const scope = homeReturnRequestRef.current
    if (!scope || homeReturnPendingRef.current) return

    homeReturnPendingRef.current = true
    setHomeReturnPending(true)
    sendAppCloseCommand(
      networkSettings.wsIp,
      networkSettings.interactivePort,
      scope
    )
    homeReturnRequestRef.current = null

    if (scope === 'dynamic-art') {
      completeDynamicArchiveReturn()
    } else {
      navigateTo('entry')
    }

    if (homeReturnResetTimerRef.current !== null) {
      window.clearTimeout(homeReturnResetTimerRef.current)
    }
    homeReturnResetTimerRef.current = window.setTimeout(() => {
      homeReturnResetTimerRef.current = null
      setHomeReturnScope(null)
      homeReturnPendingRef.current = false
      setHomeReturnPending(false)
    }, 180)
  }

  const handleReturnFromDynamicGroups = useCallback(() => {
    requestHomeReturn('dynamic-art')
  }, [requestHomeReturn])

  const handleReturnFromDirectSelect = useCallback(() => {
    requestHomeReturn('interactive-art')
  }, [requestHomeReturn])

  const handleSelectDynamicGroup = (group: DynamicGroup, origin?: DynamicTransitionOrigin) => {
    beginDynamicArtworkTransition(group, origin, 'free')
  }

  const handleDynamicBackgroundComplete = (group: DynamicGroup) => {
    updateDynamicGroupState(group)
    setSelectedDynamicItemId('')
    navigateTo('dynamicItems')
  }

  const handleOpenDynamicControl = (itemId = '') => {
    if (!selectedDynamicGroup) return
    setDynamicEditorExperience('free')
    setSelectedDynamicItemId(itemId)
    navigateTo('dynamicControl')
  }

  const handleReturnFromDynamicControl = () => {
    if (!selectedDynamicGroup || dynamicArtworkTransition) return
    setDynamicArchiveGroups((currentGroups) => mergeDynamicArchiveGroups(currentGroups, dynamicGroups))
    setDynamicArchiveReplayId(makeDynamicArchiveReplayId())
    const preview = selectedDynamicGroup.thumbnail
      ?? selectedDynamicGroup.background
      ?? selectedDynamicGroup.items.map(getDynamicItemMedia).find(Boolean)
    setDynamicArtworkTransition({
      direction: 'backward',
      groupId: selectedDynamicGroup.id,
      groupName: selectedDynamicGroup.name,
      previewUrl: selectedDynamicGroup.thumbnail?.type === 'image'
        ? getContentAwareThumbnailSource(selectedDynamicGroup.thumbnail.url)
        : preview?.url,
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
    homeReturnRequestRef.current = null
    homeReturnPendingRef.current = false
    if (homeReturnResetTimerRef.current !== null) {
      window.clearTimeout(homeReturnResetTimerRef.current)
      homeReturnResetTimerRef.current = null
    }
    setHomeReturnScope(null)
    setHomeReturnPending(false)
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
    homeReturnRequestRef.current = null
    homeReturnPendingRef.current = false
    if (homeReturnResetTimerRef.current !== null) {
      window.clearTimeout(homeReturnResetTimerRef.current)
      homeReturnResetTimerRef.current = null
    }
    setHomeReturnScope(null)
    setHomeReturnPending(false)
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
      <div className="app-shell magic-floor-route-surface min-h-screen" onPointerDown={handleGlobalButtonPointerDown}>
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

  const backwardDynamicArtworkTransition = dynamicArtworkTransition?.direction === 'backward'
  const forwardDynamicArtworkTransition = dynamicArtworkTransition?.direction === 'forward'
  const shouldRenderDynamicGroups = currentPage === 'dynamicGroups'
    || currentPage === 'dynamicControl'
    || Boolean(dynamicArtworkTransition)
  const shouldRenderDynamicControl = Boolean(
    selectedDynamicGroup
    && (currentPage === 'dynamicControl' || Boolean(dynamicArtworkTransition))
  )
  const dualDynamicArtworkRoute = Boolean(
    shouldRenderDynamicGroups
    && shouldRenderDynamicControl
  )
  const archiveTransitionPrepared = backwardDynamicArtworkTransition
    || (currentPage === 'dynamicControl' && !forwardDynamicArtworkTransition)
  const renderedDynamicArchiveGroups = currentPage === 'dynamicGroups' && !dynamicArtworkTransition
    ? dynamicGroups
    : dynamicArchiveGroups.length > 0
      ? dynamicArchiveGroups
      : dynamicGroups
  const dynamicArtSurfaceActive = Boolean(
    dynamicPortalOrigin
    || dynamicArtworkTransition
    || currentPage === 'dynamicGroups'
    || currentPage === 'dynamicBackground'
    || currentPage === 'dynamicItems'
    || currentPage === 'dynamicControl'
  )
  const magicFloorSurfaceActive = currentPage === 'entry'
    || currentPage === 'directSelect'
    || currentPage === 'remoteKeyboard'

  return (
    <div className={`app-shell min-h-screen ${dynamicTransitionClass} ${dynamicArchiveReturnActive ? 'dynamic-archive-return-active' : ''} ${dynamicArtSurfaceActive ? 'dynamic-art-route-surface' : ''} ${magicFloorSurfaceActive ? 'magic-floor-route-surface' : ''}`} onPointerDown={handleGlobalButtonPointerDown}>
      {portraitLock}

      <div className={`page-frame page-${transitionDirection} page-view-${currentPage} ${dualDynamicArtworkRoute ? 'dynamic-story-dual-route' : ''}`}>
        {shouldRenderDynamicGroups || shouldRenderDynamicControl ? (
          <>
            {shouldRenderDynamicGroups && (
              <DynamicGroupsPage
                key="dynamic-groups-route"
                groups={renderedDynamicArchiveGroups}
                wsIp={networkSettings.wsIp}
                dynamicPort={networkSettings.dynamicPort}
                onBack={handleReturnFromDynamicGroups}
                onCreateGroup={handleCreateDynamicGroup}
                onUpdateGroup={updateDynamicGroupState}
                onDeleteGroup={handleDeleteDynamicGroup}
                onSelectGroup={handleSelectDynamicGroup}
                portalArrival={Boolean(dynamicPortalOrigin)}
                transitionPrepared={Boolean(archiveTransitionPrepared)}
                archiveReplayId={dynamicArchiveReplayId}
              />
            )}
            {shouldRenderDynamicControl && selectedDynamicGroup && (
              <DynamicControlPage
                key="dynamic-control-route"
                group={selectedDynamicGroup}
                wsIp={networkSettings.wsIp}
                dynamicPort={networkSettings.dynamicPort}
                advancedFeaturesEnabled
                watermarkEnabled={networkSettings.watermarkEnabled}
                onBack={handleReturnFromDynamicControl}
                onGroupChange={updateDynamicGroupState}
                initialItemId={selectedDynamicItemId}
                initialExperience={dynamicEditorExperience}
                transitionPreparing={Boolean(forwardDynamicArtworkTransition)}
              />
            )}
          </>
        ) : currentPage === 'entry' ? (
          <EntryPage
            wsIp={networkSettings.wsIp}
            dynamicGroups={dynamicGroups}
            onOpenDynamicArt={handleOpenDynamicArt}
            onOpenDynamicGroup={handleSelectDynamicGroup}
            onOpenInteractiveArt={handleOpenInteractiveArt}
            onOpenRemoteKeyboard={() => navigateTo('remoteKeyboard')}
            onOpenSettings={() => setSettingsOpen(true)}
            rootRef={entryRootRef}
            dynamicCardRef={dynamicEntryCardRef}
            interactiveCardRef={interactiveEntryCardRef}
            transitioning={Boolean(dynamicPortalOrigin || interactivePortalOrigin)}
            transitionType={dynamicPortalOrigin ? 'dynamic' : interactivePortalOrigin ? 'interactive' : undefined}
          />
        ) : currentPage === 'remoteKeyboard' ? (
          <RemoteKeyboardPage
            wsIp={networkSettings.wsIp}
            port={networkSettings.interactivePort}
            onBack={() => navigateTo('entry')}
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
        ) : currentPage === 'dynamicItems' && selectedDynamicGroup ? (
          <DynamicItemsPage
            group={selectedDynamicGroup}
            wsIp={networkSettings.wsIp}
            dynamicPort={networkSettings.dynamicPort}
            onBack={() => navigateTo('dynamicGroups')}
            onGroupChange={updateDynamicGroupState}
            onOpenControl={handleOpenDynamicControl}
          />
        ) : currentPage === 'directSelect' ? (
          <DirectUploadSelectPage
            rootRef={directSelectRootRef}
            selectedThemeId={selectedDirectTheme.id}
            transitioning={Boolean(directThemeUploadTransition || directThemeUploadReturnTransition)}
            onBackToEntry={handleReturnFromDirectSelect}
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
            directThemeCover={selectedDirectTheme.cover}
            directThemeAccent={selectedDirectTheme.accent}
            directThemeSecondary={selectedDirectTheme.secondary}
            openMaskSelector={directUploadOpenMaskSelector}
          />
        ) : currentPage === 'directComplete' ? (
          <DirectUploadCompletePage
            result={directUploadResult}
            onBackToOptions={handleReturnFromDirectComplete}
            onReupload={handleResetDirectUpload}
          />
        ) : (
          <EntryPage
            wsIp={networkSettings.wsIp}
            dynamicGroups={dynamicGroups}
            onOpenDynamicArt={handleOpenDynamicArt}
            onOpenDynamicGroup={handleSelectDynamicGroup}
            onOpenInteractiveArt={handleOpenInteractiveArt}
            onOpenRemoteKeyboard={() => navigateTo('remoteKeyboard')}
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
          variant="dynamic"
          onSceneSwitch={() => {
            setTransitionDirection('portal')
            setCurrentPage('dynamicGroups')
          }}
          onComplete={() => setDynamicPortalOrigin(null)}
        />
      )}

      {interactivePortalOrigin && (
        <DynamicPortalTransition
          origin={interactivePortalOrigin}
          sourceRootRef={entryRootRef}
          sourceCardRef={interactiveEntryCardRef}
          targetRootRef={directSelectRootRef}
          targetRevealSelector=".direct-magic-header, .direct-theme-card-motion"
          variant="interactive"
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
            if (dynamicArtworkTransition.direction === 'backward') {
              sendDynamicArchiveReturn(
                networkSettings.wsIp,
                networkSettings.dynamicPort,
                dynamicArchiveReplayId
              )
            }
            flushSync(() => {
              setTransitionDirection(dynamicArtworkTransition.direction === 'forward' ? 'forward' : 'backward')
              setCurrentPage(dynamicArtworkTransition.direction === 'forward' ? 'dynamicControl' : 'dynamicGroups')
            })
          }}
          onComplete={() => {
            flushSync(() => {
              setTransitionDirection('portal')
              setDynamicArtworkTransition(null)
            })
          }}
        />
      )}

      {homeReturnScope && (
        <HomeReturnConfirmDialog
          scope={homeReturnScope}
          pending={homeReturnPending}
          onCancel={cancelHomeReturn}
          onConfirm={confirmHomeReturn}
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
