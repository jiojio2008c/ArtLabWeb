import WalkAnimationCanvas from './WalkAnimationCanvas.tsx'
import { useTranslation } from 'react-i18next'

interface DynamicAnimationPreviewMeta {
  id: number
  labelKey: string
  shortLabelKey: string
  className: string
}

export const DYNAMIC_ANIMATION_PREVIEWS: DynamicAnimationPreviewMeta[] = [
  { id: 0, labelKey: 'animation.none', shortLabelKey: 'animation.shortNone', className: 'none' },
  { id: 1, labelKey: 'animation.breathe', shortLabelKey: 'animation.shortBreathe', className: 'breathe' },
  { id: 2, labelKey: 'animation.swing', shortLabelKey: 'animation.shortSwing', className: 'swing' },
  { id: 3, labelKey: 'animation.blink', shortLabelKey: 'animation.shortBlink', className: 'blink' },
  { id: 4, labelKey: 'animation.rotate', shortLabelKey: 'animation.shortRotate', className: 'rotate' },
  { id: 5, labelKey: 'animation.bounce', shortLabelKey: 'animation.shortBounce', className: 'bounce' },
  { id: 6, labelKey: 'animation.wave', shortLabelKey: 'animation.shortWave', className: 'wave' },
  { id: 7, labelKey: 'animation.flip', shortLabelKey: 'animation.shortFlip', className: 'flip' },
  { id: 8, labelKey: 'animation.pulse', shortLabelKey: 'animation.shortPulse', className: 'pulse' },
  { id: 9, labelKey: 'animation.walk', shortLabelKey: 'animation.shortWalk', className: 'walk' }
]

export const getDynamicAnimationPreview = (animationId: number) => (
  DYNAMIC_ANIMATION_PREVIEWS.find((animation) => animation.id === animationId) ?? DYNAMIC_ANIMATION_PREVIEWS[0]
)

interface DynamicAnimationPreviewProps {
  animationId: number
}

const DynamicAnimationPreview = ({ animationId }: DynamicAnimationPreviewProps) => {
  const { t } = useTranslation()
  const preview = getDynamicAnimationPreview(animationId)

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
            replayKey={preview.id}
          />
        ) : (
          <img src="/AnimationPreview/user_landscape.png" alt="" draggable={false} />
        )}
      </div>
    </div>
  )
}

export default DynamicAnimationPreview
