import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setDynamicBackground, type DynamicBackground, type DynamicGroup } from '../services/dynamicArtStorage.ts'
import {
  reserveDynamicGroupStateRevision,
  sendDynamicEvent,
  uploadUnityAsset
} from '../services/unityBridge.ts'
import { buildGroupSyncPayload } from '../services/dynamicArtReceiverSync.ts'

interface DynamicBackgroundPageProps {
  wsIp: string
  dynamicPort: number
  group: DynamicGroup
  onBack: () => void
  onGroupChange: (group: DynamicGroup) => void
  onContinue: (group: DynamicGroup) => void
}

const DynamicBackgroundPage: React.FC<DynamicBackgroundPageProps> = ({
  wsIp,
  dynamicPort,
  group,
  onBack,
  onGroupChange,
  onContinue
}) => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedGroup, setUploadedGroup] = useState<DynamicGroup | undefined>()

  const currentGroup = uploadedGroup?.id === group.id ? uploadedGroup : group
  const currentBackground = getActiveBackground(currentGroup)

  useEffect(() => {
    setUploadedGroup(undefined)
  }, [group.id])

  const syncGroupToPc = (nextGroup: DynamicGroup, eventName: 'GroupStateSync' | 'GroupSelectAndSync' = 'GroupStateSync') => {
    sendDynamicEvent(wsIp, dynamicPort, eventName, buildGroupSyncPayload(nextGroup))
  }

  const handleContinue = () => {
    syncGroupToPc(currentGroup, 'GroupSelectAndSync')
    onContinue(currentGroup)
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const nextGroup = await setDynamicBackground(group.id, file)
      const background = nextGroup ? getActiveBackground(nextGroup) : undefined
      if (!nextGroup || !background) return

      const stateRevision = reserveDynamicGroupStateRevision(nextGroup.id, nextGroup.updatedAt)

      uploadUnityAsset({
        ip: wsIp,
        port: dynamicPort,
        file,
        fields: {
          role: 'background',
          groupId: group.id,
          assetId: background.id,
          mediaType: background.type,
          mimeType: background.mimeType,
          stateRevision
        }
      })

      sendDynamicEvent(wsIp, dynamicPort, 'BackgroundSet', {
        groupId: group.id,
        assetId: background.id,
        activeBackgroundId: background.id,
        name: background.name,
        mediaType: background.type,
        mimeType: background.mimeType,
        stateRevision
      })

      setUploadedGroup(nextGroup)
      onGroupChange(nextGroup)
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  return (
    <main className="ipad-screen dynamic-screen apple-container">
      <header className="ipad-topbar">
        <div className="topbar-title-row">
          <button type="button" className="ipad-button ghost-button" onClick={onBack}>
            {t('background.back')}
          </button>
          <div className="min-w-0">
            <p className="eyebrow">{t('background.eyebrow', { name: currentGroup.name })}</p>
            <h1 className="screen-title">{t('background.title')}</h1>
          </div>
        </div>
      </header>

      <section className="dynamic-background-workspace">
        <div className="dynamic-background-stage">
          {currentBackground ? (
            currentBackground.type === 'video' ? (
              <video src={currentBackground.url} controls playsInline className="dynamic-background-media" />
            ) : (
              <img src={currentBackground.url} alt={currentBackground.name} className="dynamic-background-media" />
            )
          ) : (
            <div className="dynamic-empty-stage">
              <strong>16:9</strong>
              <span>{t('background.prompt')}</span>
            </div>
          )}
        </div>

        <aside className="dynamic-side-panel">
          <p className="eyebrow">{t('background.resource')}</p>
          <h2>{t('background.upload')}</h2>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button type="button" className="ipad-button primary-button" onClick={() => inputRef.current?.click()}>
            {isUploading ? t('common.processing') : t('background.select')}
          </button>
          <button
            type="button"
            className="ipad-button secondary-button"
            disabled={!currentBackground}
            onClick={handleContinue}
          >
            {t('common.next')}
          </button>
          {currentBackground && (
            <div className="dynamic-meta-card">
              <span>{t('background.current')}</span>
              <strong>{currentBackground.name}</strong>
              <small>{currentBackground.type === 'video' ? t('background.video') : t('background.image')}</small>
            </div>
          )}
        </aside>
      </section>
    </main>
  )
}

const getActiveBackground = (group: DynamicGroup): DynamicBackground | undefined => {
  const backgrounds = group.backgrounds?.length
    ? group.backgrounds
    : group.background
      ? [group.background]
      : []
  const activeBackgroundId = String(group.activeBackgroundId ?? '').trim()
  return backgrounds.find((background) => background.id === activeBackgroundId)
    ?? backgrounds.find((background) => background.id === group.background?.id)
    ?? backgrounds[0]
}

export default DynamicBackgroundPage
