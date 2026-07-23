import { useEffect, useRef, useState } from 'react'
import { setDynamicBackground, type DynamicBackground, type DynamicGroup } from '../services/dynamicArtStorage.ts'
import { sendDynamicEvent, uploadUnityAsset } from '../services/unityBridge.ts'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedGroup, setUploadedGroup] = useState<DynamicGroup | undefined>()

  const currentGroup = uploadedGroup?.id === group.id ? uploadedGroup : group
  const currentBackground = getActiveBackground(currentGroup)

  useEffect(() => {
    setUploadedGroup(undefined)
  }, [group.id])

  const buildGroupSyncPayload = (nextGroup: DynamicGroup) => {
    const backgrounds = getBackgrounds(nextGroup)
    const activeBackground = getActiveBackground(nextGroup)

    return {
      groupId: nextGroup.id,
      name: nextGroup.name,
      appearMode: nextGroup.appearMode,
      appearIntervalMs: nextGroup.appearIntervalMs,
      activeBackgroundId: nextGroup.activeBackgroundId ?? activeBackground?.id,
      background: toBackgroundPayload(activeBackground),
      backgrounds: backgrounds.map((background) => toBackgroundPayload(background)),
      items: nextGroup.items.map((item) => ({
        itemId: item.id,
        assetId: item.media.id,
        gridIndex: item.gridIndex,
        position: item.position,
        scale: item.scale,
        rotation: item.rotation,
        flipX: item.flipX ?? false,
        flipY: item.flipY ?? false,
        animationId: item.animationId,
        moveMode: item.moveMode,
        movePercent: item.movePercent,
        moveSpeed: item.moveSpeed,
        moveTrack: item.moveTrack,
        order: item.order
      }))
    }
  }

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

      uploadUnityAsset({
        ip: wsIp,
        port: dynamicPort,
        file,
        fields: {
          role: 'background',
          groupId: group.id,
          assetId: background.id,
          mediaType: background.type,
          mimeType: background.mimeType
        }
      })

      sendDynamicEvent(wsIp, dynamicPort, 'BackgroundSet', {
        groupId: group.id,
        assetId: background.id,
        activeBackgroundId: background.id,
        name: background.name,
        mediaType: background.type,
        mimeType: background.mimeType
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
            返回作品檔案
          </button>
          <div className="min-w-0">
            <p className="eyebrow">動態藝術 · {currentGroup.name}</p>
            <h1 className="screen-title">背景上載</h1>
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
              <span>選擇圖片或影片作為動態藝術背景</span>
            </div>
          )}
        </div>

        <aside className="dynamic-side-panel">
          <p className="eyebrow">背景資源</p>
          <h2>上載背景</h2>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button type="button" className="ipad-button primary-button" onClick={() => inputRef.current?.click()}>
            {isUploading ? '處理中' : '選擇背景'}
          </button>
          <button
            type="button"
            className="ipad-button secondary-button"
            disabled={!currentBackground}
            onClick={handleContinue}
          >
            下一步
          </button>
          {currentBackground && (
            <div className="dynamic-meta-card">
              <span>目前背景</span>
              <strong>{currentBackground.name}</strong>
              <small>{currentBackground.type === 'video' ? '影片背景' : '圖片背景'}</small>
            </div>
          )}
        </aside>
      </section>
    </main>
  )
}

const getActiveBackground = (group: DynamicGroup): DynamicBackground | undefined => {
  return group.background
    ?? group.backgrounds?.find((background) => background.id === group.activeBackgroundId)
    ?? group.backgrounds?.[0]
}

const getBackgrounds = (group: DynamicGroup) => {
  if (group.backgrounds?.length) return group.backgrounds
  return group.background ? [group.background] : []
}

const toBackgroundPayload = (background?: DynamicBackground) => (
  background
    ? {
        assetId: background.id,
        name: background.name,
        mediaType: background.type,
        mimeType: background.mimeType
      }
    : null
)

export default DynamicBackgroundPage
