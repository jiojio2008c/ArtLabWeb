import { toPng } from 'html-to-image'
import { sendDynamicEvent } from './unityBridge.ts'

interface DynamicArchiveSnapshot {
  dataUrl: string
  width: number
  height: number
  capturedAt: number
}

interface DynamicArchiveOrigin {
  left: number
  top: number
  width: number
  height: number
}

interface DynamicArchiveSourceSnapshot extends DynamicArchiveSnapshot {
  origin: DynamicArchiveOrigin
}

type DynamicArchiveTransition = 'portal' | 'none'

const DYNAMIC_ARCHIVE_CAPTURE_CLASS = 'dynamic-archive-snapshot-capture'

const makeDynamicArchiveReplayId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `archive_${crypto.randomUUID()}`
  }

  return `archive_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

const sendDynamicArchiveEnter = (
  ip: string,
  port: number,
  replayId: string,
  startedAt = Date.now(),
  source?: DynamicArchiveSourceSnapshot
) => {
  sendDynamicEvent(ip, port, 'ArchiveEnter', {
    version: 3,
    replayId,
    startedAt,
    elapsedMs: Math.max(0, Date.now() - startedAt),
    source: source
      ? {
          dataUrl: source.dataUrl,
          width: source.width,
          height: source.height,
          capturedAt: source.capturedAt,
          origin: source.origin
        }
      : undefined
  })
}

const sendDynamicArchiveReturn = (
  ip: string,
  port: number,
  replayId: string
) => {
  sendDynamicEvent(ip, port, 'ArchiveReturn', {
    version: 2,
    replayId,
    startedAt: Date.now(),
    transition: 'none' satisfies DynamicArchiveTransition
  })
}

const captureDynamicArchiveSnapshot = async (
  element: HTMLElement
): Promise<DynamicArchiveSnapshot> => {
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined)
  }

  const width = Math.max(1, Math.round(element.getBoundingClientRect().width))
  const height = Math.max(1, Math.round(element.getBoundingClientRect().height))
  const pixelRatio = Math.min(1.5, Math.max(1, 1920 / width))
  element.classList.add(DYNAMIC_ARCHIVE_CAPTURE_CLASS)

  let dataUrl: string
  try {
    dataUrl = await toPng(element, {
      cacheBust: false,
      pixelRatio,
      width,
      height,
      skipAutoScale: true
    })
  } finally {
    element.classList.remove(DYNAMIC_ARCHIVE_CAPTURE_CLASS)
  }

  return { dataUrl, width, height, capturedAt: Date.now() }
}

const captureDynamicArchiveSourceSnapshot = async (
  element: HTMLElement,
  originElement: HTMLElement
): Promise<DynamicArchiveSourceSnapshot> => {
  const elementRect = element.getBoundingClientRect()
  const originRect = originElement.getBoundingClientRect()
  const snapshot = await captureDynamicArchiveSnapshot(element)

  return {
    ...snapshot,
    origin: {
      left: Math.max(0, originRect.left - elementRect.left),
      top: Math.max(0, originRect.top - elementRect.top),
      width: Math.max(1, originRect.width),
      height: Math.max(1, originRect.height)
    }
  }
}

const sendDynamicArchiveSnapshot = (
  ip: string,
  port: number,
  replayId: string,
  snapshot: DynamicArchiveSnapshot
) => {
  sendDynamicEvent(ip, port, 'ArchiveSnapshot', {
    version: 2,
    replayId,
    capturedAt: snapshot.capturedAt,
    transition: 'none' satisfies DynamicArchiveTransition,
    width: snapshot.width,
    height: snapshot.height,
    dataUrl: snapshot.dataUrl
  })
}

export {
  captureDynamicArchiveSnapshot,
  captureDynamicArchiveSourceSnapshot,
  makeDynamicArchiveReplayId,
  sendDynamicArchiveEnter,
  sendDynamicArchiveReturn,
  sendDynamicArchiveSnapshot
}
export type {
  DynamicArchiveOrigin,
  DynamicArchiveSnapshot,
  DynamicArchiveSourceSnapshot,
  DynamicArchiveTransition
}
