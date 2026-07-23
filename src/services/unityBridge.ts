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

const sendUnityTextAsync = (ip: string, port: number, message: string) => {
  const trimmedIp = ip.trim()
  if (!trimmedIp) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUnityUrl(trimmedIp, port), true)
    xhr.setRequestHeader('Content-Type', 'text/plain')
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Request failed with status ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Network request failed'))
    xhr.ontimeout = () => reject(new Error('Network request timed out'))
    xhr.send(message)
  })
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

const uploadUnityAssetAsync = ({ ip, port, file, fields }: UploadUnityAssetOptions) => {
  const trimmedIp = ip.trim()
  if (!trimmedIp) return Promise.resolve()

  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', file.name)

  Object.entries(fields ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.append(key, String(value))
    }
  })

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUnityUrl(trimmedIp, port), true)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Asset upload failed with status ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Asset upload network request failed'))
    xhr.ontimeout = () => reject(new Error('Asset upload request timed out'))
    xhr.send(formData)
  })
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

const sendDynamicEventAsync = (
  ip: string,
  port: number,
  eventName: string,
  payload: Record<string, unknown>
) => {
  return sendUnityTextAsync(ip, port, makeDynamicEventMessage(eventName, payload))
}

export {
  buildUnityUrl,
  makeDynamicEventMessage,
  sendDynamicEvent,
  sendDynamicEventAsync,
  sendUnityText,
  sendUnityTextAsync,
  uploadUnityAsset,
  uploadUnityAssetAsync
}
