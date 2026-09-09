import { detectMaskCards, type MaskCardTemplate } from './maskCardScanCore.ts'

let templates: MaskCardTemplate[] = []
let preferredMaskId = ''

self.onmessage = (event: MessageEvent) => {
  const message = event.data as
    | { type: 'config'; templates: MaskCardTemplate[]; preferredMaskId: string }
    | { type: 'frame'; width: number; height: number; buffer: ArrayBuffer }

  if (message.type === 'config') {
    templates = message.templates
    preferredMaskId = message.preferredMaskId
    return
  }

  if (message.type !== 'frame') return

  const result = detectMaskCards(
    { width: message.width, height: message.height, data: new Uint8Array(message.buffer) },
    templates,
    preferredMaskId
  )
  self.postMessage({ type: 'result', result })
}
