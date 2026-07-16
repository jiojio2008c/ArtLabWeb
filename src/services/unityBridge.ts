interface UploadUnityAssetOptions {
  ip: string
  port: number
  file: File
  fields?: Record<string, string | number | boolean | undefined>
}

const buildUnityUrl = (ip: string, port: number) => `http://${ip.trim()}:${port}`

const sendUnityText = (ip: string, port: number, message: string) => {
  const trimmedIp = ip.trim()
  if (!trimmedIp) return

  const xhr = new XMLHttpRequest()
  xhr.open('POST', buildUnityUrl(trimmedIp, port), true)
  xhr.setRequestHeader('Content-Type', 'text/plain')
  xhr.send(message)
}

const uploadUnityAsset = ({ ip, port, file, fields }: UploadUnityAssetOptions) => {
  const trimmedIp = ip.trim()
  if (!trimmedIp) return

  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', file.name)

  Object.entries(fields ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.append(key, String(value))
    }
  })

  const xhr = new XMLHttpRequest()
  xhr.open('POST', buildUnityUrl(trimmedIp, port), true)
  xhr.send(formData)
}

const makeDynamicEventMessage = (eventName: string, payload: Record<string, unknown>) => {
  return `MF|DynamicArt|${eventName}|${JSON.stringify(payload)}`
}

const sendDynamicEvent = (
  ip: string,
  port: number,
  eventName: string,
  payload: Record<string, unknown>
) => {
  sendUnityText(ip, port, makeDynamicEventMessage(eventName, payload))
}

export { buildUnityUrl, makeDynamicEventMessage, sendDynamicEvent, sendUnityText, uploadUnityAsset }
