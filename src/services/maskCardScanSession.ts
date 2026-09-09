import {
  detectMaskCards,
  type GrayImage,
  type MaskCardDetectResult,
  type MaskCardTemplate
} from './maskCardScanCore.ts'
import MaskCardScanWorker from './maskCardScan.worker.ts?worker'

type ScanWorkerMessage = { type: 'result'; result: MaskCardDetectResult }

export const createMaskCardScanSession = (onResult: (result: MaskCardDetectResult) => void) => {
  let worker: Worker | null = null
  let busy = false
  let disposed = false
  let templates: MaskCardTemplate[] = []
  let preferredMaskId = ''

  try {
    worker = new MaskCardScanWorker()
    worker.onmessage = (event: MessageEvent<ScanWorkerMessage>) => {
      busy = false
      if (disposed || event.data?.type !== 'result') return
      onResult(event.data.result)
    }
    worker.onerror = () => {
      busy = false
      worker?.terminate()
      worker = null
    }
  } catch {
    worker = null
  }

  const setTemplates = (nextTemplates: MaskCardTemplate[], nextPreferredMaskId: string) => {
    templates = nextTemplates
    preferredMaskId = nextPreferredMaskId
    worker?.postMessage({
      type: 'config',
      templates: nextTemplates,
      preferredMaskId: nextPreferredMaskId
    })
  }

  const submit = (frame: GrayImage) => {
    if (disposed || busy || templates.length === 0) return false
    busy = true

    if (worker) {
      const payload = frame.data.slice()
      worker.postMessage(
        { type: 'frame', width: frame.width, height: frame.height, buffer: payload.buffer },
        [payload.buffer]
      )
      return true
    }

    const snapshot = {
      width: frame.width,
      height: frame.height,
      data: frame.data.slice()
    }
    queueMicrotask(() => {
      if (disposed) return
      const result = detectMaskCards(snapshot, templates, preferredMaskId)
      busy = false
      onResult(result)
    })
    return true
  }

  const dispose = () => {
    disposed = true
    busy = false
    worker?.terminate()
    worker = null
    templates = []
  }

  return { setTemplates, submit, dispose }
}
