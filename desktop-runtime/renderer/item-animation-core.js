export const ITEM_ANIMATION_MIN_ID = 1
export const ITEM_ANIMATION_MAX_ID = 8

const hashString = (value) => {
  let hash = 0
  const text = String(value || '')
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

const createBaseTransform = () => ({
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  alpha: 1,
  offsetX: 0,
  offsetY: 0,
  skewX: 0,
  skewY: 0
})

export const sampleItemAnimation = (animationId, itemId, timeSeconds) => {
  const id = Number(animationId ?? 0)
  const seed = (hashString(itemId) % 360) * Math.PI / 180
  const time = timeSeconds + seed
  const base = createBaseTransform()

  switch (id) {
    case 1: {
      const pulse = Math.sin(time * 2.2)
      return {
        ...base,
        scaleX: 1 + pulse * 0.08,
        scaleY: 1 + pulse * 0.08
      }
    }

    case 2:
      return {
        ...base,
        rotation: Math.sin(time * 4.2) * 9,
        offsetX: Math.sin(time * 3.8) * 8
      }

    case 3:
      return {
        ...base,
        alpha: 0.38 + (Math.sin(time * 6.4) + 1) * 0.31
      }

    case 4:
      return {
        ...base,
        rotation: Math.sin(time * 2.4) * 18
      }

    case 5: {
      const bounce = Math.abs(Math.sin(time * 4.1))
      return {
        ...base,
        offsetY: -bounce * 70,
        scaleX: 1 + bounce * 0.05,
        scaleY: 1 - bounce * 0.08
      }
    }

    case 6:
      return {
        ...base,
        skewX: Math.sin(time * 4.6) * 0.18,
        scaleY: 1 + Math.sin(time * 5.2) * 0.06,
        offsetY: Math.sin(time * 3.2) * 10
      }

    case 7: {
      const flip = Math.cos(time * 5.6)
      return {
        ...base,
        scaleX: flip,
        skewY: Math.sin(time * 5.6) * 0.18,
        rotation: Math.sin(time * 2.7) * 5
      }
    }

    case 8: {
      const pulse = Math.sin(time * 3.3)
      return {
        ...base,
        alpha: 0.58 + (pulse + 1) * 0.21,
        scaleX: 1 + pulse * 0.035,
        scaleY: 1 + pulse * 0.035
      }
    }

    default:
      return base
  }
}

const frameSubscribers = new Set()
let frameRequestId = 0

const runAnimationFrame = (timestamp) => {
  frameSubscribers.forEach((subscriber) => subscriber(timestamp / 1000))
  frameRequestId = frameSubscribers.size > 0 ? requestAnimationFrame(runAnimationFrame) : 0
}

export const subscribeItemAnimationFrame = (subscriber) => {
  frameSubscribers.add(subscriber)
  if (!frameRequestId) frameRequestId = requestAnimationFrame(runAnimationFrame)

  return () => {
    frameSubscribers.delete(subscriber)
    if (frameSubscribers.size === 0 && frameRequestId) {
      cancelAnimationFrame(frameRequestId)
      frameRequestId = 0
    }
  }
}
