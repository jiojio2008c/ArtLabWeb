import { MessageCircleMore, Type } from 'lucide-react'
import {
  isDynamicBubbleItem,
  type DynamicBubbleContent,
  type DynamicItem
} from '../services/dynamicArtStorage.ts'
import DynamicBubbleVisual, { type DynamicBubbleDraft } from './DynamicBubbleVisual.tsx'

interface DynamicItemThumbnailProps {
  item: DynamicItem
  className?: string
  decorative?: boolean
}

const toDynamicBubbleDraft = (bubble: DynamicBubbleContent): DynamicBubbleDraft => ({
  bubbleType: bubble.bubbleType,
  styleId: bubble.styleId,
  title: bubble.title,
  bodyText: bubble.bodyText,
  revealMode: bubble.revealMode,
  revealIntervalMs: bubble.revealIntervalMs,
  fontSizePx: bubble.fontSizePx,
  textColor: bubble.textColor,
  titleMaskId: bubble.titleMaskId,
  paletteId: bubble.paletteId,
  maskColor: bubble.maskColor,
  maskOpacity: bubble.maskOpacity,
  widthPx: bubble.widthPx,
  heightPx: bubble.heightPx,
  image: bubble.image
    ? {
        url: bubble.image.url,
        name: bubble.image.name,
        mimeType: bubble.image.mimeType,
        width: bubble.image.width,
        height: bubble.image.height
      }
    : undefined
})

const DynamicItemThumbnail: React.FC<DynamicItemThumbnailProps> = ({
  item,
  className = '',
  decorative = false
}) => {
  if (!isDynamicBubbleItem(item)) {
    return (
      <img
        className={className}
        src={item.media.url}
        alt={decorative ? '' : item.name}
        draggable={false}
      />
    )
  }

  return (
    <span
      className={`dynamic-item-bubble-thumbnail ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : item.name}
      aria-hidden={decorative || undefined}
    >
      <DynamicBubbleVisual bubble={toDynamicBubbleDraft(item.bubble)} />
      <span className="dynamic-item-bubble-thumbnail-badge" aria-hidden="true">
        {item.bubble.bubbleType === 'title' ? <Type /> : <MessageCircleMore />}
      </span>
    </span>
  )
}

export { toDynamicBubbleDraft }
export default DynamicItemThumbnail
