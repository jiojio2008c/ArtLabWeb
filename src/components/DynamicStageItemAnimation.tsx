import { useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  ITEM_ANIMATION_MAX_ID,
  ITEM_ANIMATION_MIN_ID,
  sampleItemAnimation,
  subscribeItemAnimationFrame
} from '../../desktop-runtime/renderer/item-animation-core.js'

interface DynamicStageItemAnimationProps {
  animationId: number
  itemId: string
  enabled: boolean
  coordinateScale: number
  children: ReactNode
}

const resetAnimationStyles = (element: HTMLDivElement) => {
  element.style.removeProperty('opacity')
  element.style.removeProperty('transform')
}

const DynamicStageItemAnimation = ({
  animationId,
  itemId,
  enabled,
  coordinateScale,
  children
}: DynamicStageItemAnimationProps) => {
  const elementRef = useRef<HTMLDivElement>(null)
  const shouldAnimate = enabled
    && animationId >= ITEM_ANIMATION_MIN_ID
    && animationId <= ITEM_ANIMATION_MAX_ID

  useLayoutEffect(() => {
    const element = elementRef.current

    if (!element || !shouldAnimate) {
      if (element) resetAnimationStyles(element)
      return undefined
    }

    const applyAnimationFrame = (timeSeconds: number) => {
      const transform = sampleItemAnimation(animationId, itemId, timeSeconds)
      const offsetX = transform.offsetX * coordinateScale
      const offsetY = transform.offsetY * coordinateScale

      element.style.opacity = transform.alpha.toFixed(4)
      element.style.transform = [
        `translate3d(${offsetX.toFixed(3)}px, ${offsetY.toFixed(3)}px, 0)`,
        `rotate(${transform.rotation.toFixed(3)}deg)`,
        `matrix(1, ${transform.skewY.toFixed(5)}, ${transform.skewX.toFixed(5)}, 1, 0, 0)`,
        `scale(${transform.scaleX.toFixed(5)}, ${transform.scaleY.toFixed(5)})`
      ].join(' ')
    }

    applyAnimationFrame(performance.now() / 1000)
    const unsubscribe = subscribeItemAnimationFrame(applyAnimationFrame)
    return () => {
      unsubscribe()
      resetAnimationStyles(element)
    }
  }, [animationId, coordinateScale, enabled, itemId])

  return (
    <div
      ref={elementRef}
      className={`dynamic-stage-item-animation ${shouldAnimate ? 'is-animated' : ''}`}
      data-animation-id={animationId}
    >
      {children}
    </div>
  )
}

export default DynamicStageItemAnimation
