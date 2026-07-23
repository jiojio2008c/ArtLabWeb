interface DynamicAnimationPreviewMeta {
  id: number
  label: string
  shortLabel: string
  className: string
}

export const DYNAMIC_ANIMATION_PREVIEWS: DynamicAnimationPreviewMeta[] = [
  { id: 0, label: '無動畫', shortLabel: '無', className: 'none' },
  { id: 1, label: '呼吸縮放', shortLabel: '呼吸', className: 'breathe' },
  { id: 2, label: '搖擺', shortLabel: '搖擺', className: 'swing' },
  { id: 3, label: '閃爍', shortLabel: '閃爍', className: 'blink' },
  { id: 4, label: '輕微旋轉', shortLabel: '旋轉', className: 'rotate' },
  { id: 5, label: '彈跳', shortLabel: '彈跳', className: 'bounce' },
  { id: 6, label: '波動', shortLabel: '波動', className: 'wave' },
  { id: 7, label: '快速翻轉', shortLabel: '翻轉', className: 'flip' },
  { id: 8, label: '透明脈衝', shortLabel: '脈衝', className: 'pulse' },
  { id: 9, label: '組合效果', shortLabel: '組合', className: 'combo' }
]

export const getDynamicAnimationPreview = (animationId: number) => (
  DYNAMIC_ANIMATION_PREVIEWS.find((animation) => animation.id === animationId) ?? DYNAMIC_ANIMATION_PREVIEWS[0]
)

interface DynamicAnimationPreviewProps {
  animationId: number
}

const DynamicAnimationPreview = ({ animationId }: DynamicAnimationPreviewProps) => {
  const preview = getDynamicAnimationPreview(animationId)

  return (
    <div
      className={`dynamic-animation-preview-stage dynamic-animation-preview-stage-${preview.className}`}
      aria-label={`${preview.label}預覽`}
    >
      <div className="dynamic-animation-preview-backdrop" />
      <div className="dynamic-animation-preview-floor" />
      <div key={preview.id} className={`dynamic-animation-preview-person dynamic-animation-preview-person-${preview.className}`}>
        <img src="/AnimationPreview/user_landscape.png" alt="" draggable={false} />
      </div>
    </div>
  )
}

export default DynamicAnimationPreview
