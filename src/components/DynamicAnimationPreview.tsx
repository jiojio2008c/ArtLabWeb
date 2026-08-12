import WalkAnimationCanvas from './WalkAnimationCanvas.tsx'
import UnityAnimationCanvas from './UnityAnimationCanvas.tsx'
import { useTranslation } from 'react-i18next'
import {
  DYNAMIC_ANIMATION_CATALOG,
  getDynamicAnimationDefinition
} from '../../desktop-runtime/renderer/dynamic-animation-catalog.js'
import {
  UNITY_EXTRA_ANIMATION_MAX_ID,
  UNITY_EXTRA_ANIMATION_MIN_ID
} from '../../desktop-runtime/renderer/unity-animation-core.js'

interface DynamicAnimationPreviewMeta {
  id: number
  labelKey: string
  shortLabelKey: string
  className: string
}

export const DYNAMIC_ANIMATION_PREVIEWS: readonly DynamicAnimationPreviewMeta[] = DYNAMIC_ANIMATION_CATALOG

export const getDynamicAnimationPreview = (animationId: number) => (
  getDynamicAnimationDefinition(animationId)
)

interface DynamicAnimationPreviewProps {
  animationId: number
  replayKey?: string | number
}

const DynamicAnimationPreview = ({ animationId, replayKey = 0 }: DynamicAnimationPreviewProps) => {
  const { t } = useTranslation()
  const preview = getDynamicAnimationPreview(animationId)
  const isUnityAnimation = preview.id >= UNITY_EXTRA_ANIMATION_MIN_ID
    && preview.id <= UNITY_EXTRA_ANIMATION_MAX_ID

  return (
    <div
      className={`dynamic-animation-preview-stage dynamic-animation-preview-stage-${preview.className}`}
      aria-label={t('animation.preview', { name: t(preview.labelKey) })}
    >
      <div className="dynamic-animation-preview-backdrop" />
      <div className="dynamic-animation-preview-floor" />
      <div key={preview.id} className={`dynamic-animation-preview-person dynamic-animation-preview-person-${preview.className}`}>
        {preview.id === 9 ? (
          <WalkAnimationCanvas
            src="/AnimationPreview/user_landscape.png"
            className="dynamic-animation-preview-walk-canvas"
            ariaLabel={t('animation.walkPreview')}
            replayKey={`${preview.id}:${replayKey}`}
          />
        ) : isUnityAnimation ? (
          <UnityAnimationCanvas
            src="/AnimationPreview/user_landscape.png"
            animationId={preview.id}
            className="dynamic-animation-preview-unity-canvas"
            ariaLabel={t('animation.preview', { name: t(preview.labelKey) })}
            replayKey={`${preview.id}:${replayKey}`}
            overscanX={1.32}
            overscanY={1.42}
            forceLoop
          />
        ) : (
          <img src="/AnimationPreview/user_landscape.png" alt="" draggable={false} />
        )}
      </div>
    </div>
  )
}

export default DynamicAnimationPreview
