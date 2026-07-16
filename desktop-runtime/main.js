const { app, BrowserWindow, ipcMain } = require('electron')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')

const CONTROL_PORT = 8080
const MAX_BODY_BYTES = 512 * 1024 * 1024
const DEFAULT_GROUP_ID = 'default_group'

let mainWindow = null
let server = null
let dataDir = ''
let assetsDir = ''
let stateFile = ''

const runtimeState = {
  activeGroupId: null,
  groups: {},
  assets: {},
  preview: {
    enabled: false,
    groupId: null,
    appearMode: 'all',
    intervalMs: 800,
    replayId: 0,
    startedAt: Date.now()
  },
  server: {
    status: 'starting',
    port: CONTROL_PORT,
    addresses: []
  }
}

const safeSegment = (value) => {
  return String(value || 'asset').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'asset'
}

const makeId = (prefix) => {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`
}

const getLocalAddresses = () => {
  const interfaces = os.networkInterfaces()
  const addresses = []

  Object.values(interfaces).forEach((entries) => {
    entries?.forEach((entry) => {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address)
      }
    })
  })

  return addresses
}

const getExtension = (name, mimeType) => {
  const ext = path.extname(name || '').toLowerCase()
  if (/^\.[a-z0-9]+$/.test(ext)) return ext
  if (mimeType === 'image/jpeg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/gif') return '.gif'
  if (mimeType === 'video/quicktime') return '.mov'
  if (String(mimeType || '').startsWith('video/')) return '.mp4'
  return '.png'
}

const detectMediaType = (mimeType, name) => {
  if (String(mimeType || '').startsWith('video/')) return 'video'
  if (/\.(mp4|mov|webm)$/i.test(name || '')) return 'video'
  return 'image'
}

const ensureRuntimeDirs = () => {
  dataDir = path.join(app.getPath('userData'), 'runtime-data')
  assetsDir = path.join(dataDir, 'assets')
  stateFile = path.join(dataDir, 'runtime-state.json')
  fs.mkdirSync(assetsDir, { recursive: true })
}

const loadState = () => {
  try {
    if (!fs.existsSync(stateFile)) return
    const loaded = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    runtimeState.activeGroupId = loaded.activeGroupId ?? null
    runtimeState.groups = loaded.groups ?? {}
    runtimeState.assets = loaded.assets ?? {}
    runtimeState.preview = {
      ...runtimeState.preview,
      ...(loaded.preview ?? {}),
      enabled: false,
      startedAt: Date.now()
    }
  } catch (error) {
    console.error('Failed to load runtime state:', error)
  }
}

const saveState = () => {
  try {
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        activeGroupId: runtimeState.activeGroupId,
        groups: runtimeState.groups,
        assets: runtimeState.assets,
        preview: {
          ...runtimeState.preview,
          enabled: false
        }
      }, null, 2)
    )
  } catch (error) {
    console.error('Failed to save runtime state:', error)
  }
}

const assetUrl = (asset) => {
  if (!asset?.assetId) return ''
  const version = asset.updatedAt ?? 0
  return `http://127.0.0.1:${CONTROL_PORT}/assets/${encodeURIComponent(asset.assetId)}?v=${version}`
}

const getPublicState = () => {
  const assets = {}
  Object.entries(runtimeState.assets).forEach(([assetId, asset]) => {
    assets[assetId] = {
      assetId,
      role: asset.role,
      groupId: asset.groupId,
      itemId: asset.itemId,
      name: asset.name,
      mediaType: asset.mediaType,
      mimeType: asset.mimeType,
      updatedAt: asset.updatedAt,
      url: fs.existsSync(asset.filePath || '') ? assetUrl(asset) : ''
    }
  })

  return {
    activeGroupId: runtimeState.activeGroupId,
    groups: runtimeState.groups,
    assets,
    preview: runtimeState.preview,
    server: runtimeState.server
  }
}

const broadcastState = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('runtime-state', getPublicState())
}

const broadcastServerStatus = () => {
  runtimeState.server.addresses = getLocalAddresses()
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('server-status', runtimeState.server)
}

const ensureGroup = (groupId = DEFAULT_GROUP_ID, name = '作品檔案') => {
  const id = groupId || DEFAULT_GROUP_ID
  if (!runtimeState.groups[id]) {
    runtimeState.groups[id] = {
      groupId: id,
      name: name || '作品檔案',
      activeBackgroundId: null,
      backgrounds: [],
      items: [],
      appearMode: 'all',
      appearIntervalMs: 800,
      updatedAt: Date.now()
    }
  }
  return runtimeState.groups[id]
}

const defaultItem = (payload, order = 0) => {
  return {
    itemId: payload.itemId,
    assetId: payload.assetId ?? null,
    name: payload.name ?? payload.itemId ?? '物件',
    gridIndex: payload.gridIndex ?? 72,
    position: payload.position ?? { x: 0.5, y: 0.5 },
    scale: payload.scale ?? 1,
    rotation: payload.rotation ?? 0,
    flipX: payload.flipX ?? false,
    flipY: payload.flipY ?? false,
    animationId: payload.animationId ?? 0,
    moveMode: payload.moveMode ?? 'none',
    movePercent: payload.movePercent ?? 50,
    moveSpeed: payload.moveSpeed ?? 50,
    moveTrack: payload.moveTrack ?? 'middle',
    isVisible: payload.isVisible ?? true,
    order: payload.order ?? order,
    updatedAt: Date.now()
  }
}

const findItem = (group, itemId) => {
  return group.items.find((item) => item.itemId === itemId)
}

const upsertAssetMetadata = (metadata) => {
  if (!metadata.assetId) return
  runtimeState.assets[metadata.assetId] = {
    ...(runtimeState.assets[metadata.assetId] ?? {}),
    ...metadata,
    updatedAt: metadata.updatedAt ?? Date.now()
  }
}

const upsertBackground = (group, payload) => {
  if (!payload?.assetId) return
  const background = {
    assetId: payload.assetId,
    name: payload.name ?? payload.assetId,
    mediaType: payload.mediaType ?? payload.type ?? 'image',
    mimeType: payload.mimeType ?? ''
  }

  group.backgrounds = [
    background,
    ...group.backgrounds.filter((item) => item.assetId !== background.assetId)
  ]
  group.activeBackgroundId = payload.activeBackgroundId ?? background.assetId

  upsertAssetMetadata({
    assetId: background.assetId,
    role: 'background',
    groupId: group.groupId,
    name: background.name,
    mediaType: background.mediaType,
    mimeType: background.mimeType
  })
}

const parseDynamicMessage = (message) => {
  const prefix = 'MF|DynamicArt|'
  if (!message.startsWith(prefix)) return null

  const rest = message.slice(prefix.length)
  const separatorIndex = rest.indexOf('|')
  if (separatorIndex < 0) return null

  const eventName = rest.slice(0, separatorIndex)
  const jsonText = rest.slice(separatorIndex + 1)
  return {
    eventName,
    payload: jsonText ? JSON.parse(jsonText) : {}
  }
}

const setActiveGroup = (groupId, name) => {
  const group = ensureGroup(groupId, name)
  runtimeState.activeGroupId = group.groupId
  return group
}

const applyDynamicEvent = (eventName, payload) => {
  switch (eventName) {
    case 'GroupCreate': {
      const group = ensureGroup(payload.groupId, payload.name)
      group.name = payload.name ?? group.name
      group.updatedAt = Date.now()
      if (!runtimeState.activeGroupId) runtimeState.activeGroupId = group.groupId
      break
    }

    case 'GroupSelect': {
      setActiveGroup(payload.groupId, payload.name)
      break
    }

    case 'GroupUpdate': {
      const group = ensureGroup(payload.groupId, payload.name)
      group.name = payload.name ?? group.name
      group.thumbnailAssetId = payload.thumbnailAssetId ?? group.thumbnailAssetId
      group.updatedAt = Date.now()
      break
    }

    case 'GroupDelete': {
      delete runtimeState.groups[payload.groupId]
      if (runtimeState.activeGroupId === payload.groupId) {
        runtimeState.activeGroupId = null
        runtimeState.preview.enabled = false
      }
      break
    }

    case 'GroupSelectAndSync':
    case 'GroupStateSync': {
      const group = setActiveGroup(payload.groupId, payload.name)
      group.name = payload.name ?? group.name
      group.appearMode = payload.appearMode ?? group.appearMode ?? 'all'
      group.appearIntervalMs = payload.appearIntervalMs ?? group.appearIntervalMs ?? 800
      group.activeBackgroundId = payload.activeBackgroundId ?? group.activeBackgroundId

      const backgrounds = Array.isArray(payload.backgrounds)
        ? payload.backgrounds
        : payload.background
          ? [payload.background]
          : []

      group.backgrounds = backgrounds
        .filter((background) => background?.assetId)
        .map((background) => {
          upsertAssetMetadata({
            assetId: background.assetId,
            role: 'background',
            groupId: group.groupId,
            name: background.name ?? background.assetId,
            mediaType: background.mediaType ?? background.type ?? 'image',
            mimeType: background.mimeType ?? ''
          })
          return {
            assetId: background.assetId,
            name: background.name ?? background.assetId,
            mediaType: background.mediaType ?? background.type ?? 'image',
            mimeType: background.mimeType ?? ''
          }
        })

      if (!group.activeBackgroundId && group.backgrounds[0]) {
        group.activeBackgroundId = group.backgrounds[0].assetId
      }

      const existingItems = new Map(group.items.map((item) => [item.itemId, item]))
      group.items = (payload.items ?? []).map((itemPayload, index) => {
        const existing = existingItems.get(itemPayload.itemId) ?? {}
        const nextItem = defaultItem({
          ...existing,
          ...itemPayload
        }, index)

        upsertAssetMetadata({
          assetId: nextItem.assetId,
          role: 'item',
          groupId: group.groupId,
          itemId: nextItem.itemId,
          name: nextItem.name,
          mediaType: 'image',
          mimeType: ''
        })

        return nextItem
      })
      group.updatedAt = Date.now()
      break
    }

    case 'GroupAppearMode': {
      const group = ensureGroup(payload.groupId)
      group.appearMode = payload.mode ?? payload.appearMode ?? group.appearMode
      group.appearIntervalMs = payload.intervalMs ?? payload.appearIntervalMs ?? group.appearIntervalMs
      group.updatedAt = Date.now()
      break
    }

    case 'PreviewMode': {
      const groupId = payload.groupId ?? runtimeState.activeGroupId
      if (groupId) setActiveGroup(groupId)
      runtimeState.preview = {
        enabled: Boolean(payload.enabled),
        groupId,
        appearMode: payload.appearMode ?? ensureGroup(groupId).appearMode ?? 'all',
        intervalMs: payload.intervalMs ?? ensureGroup(groupId).appearIntervalMs ?? 800,
        replayId: payload.replayId ?? runtimeState.preview.replayId + 1,
        startedAt: Date.now()
      }
      break
    }

    case 'BackgroundSet': {
      const group = ensureGroup(payload.groupId)
      upsertBackground(group, payload)
      group.updatedAt = Date.now()
      break
    }

    case 'BackgroundDelete': {
      const group = ensureGroup(payload.groupId)
      const deleteIds = new Set(payload.assetIds ?? [])
      group.backgrounds = group.backgrounds.filter((background) => !deleteIds.has(background.assetId))
      group.activeBackgroundId = payload.nextActiveAssetId ?? group.backgrounds[0]?.assetId ?? null
      group.updatedAt = Date.now()
      break
    }

    case 'ItemCreate': {
      const group = ensureGroup(payload.groupId)
      const existing = findItem(group, payload.itemId)
      if (existing) {
        Object.assign(existing, defaultItem({ ...existing, ...payload }, existing.order))
      } else {
        group.items.push(defaultItem(payload, group.items.length))
      }
      upsertAssetMetadata({
        assetId: payload.assetId,
        role: 'item',
        groupId: group.groupId,
        itemId: payload.itemId,
        name: payload.name ?? payload.assetId,
        mediaType: 'image',
        mimeType: ''
      })
      group.updatedAt = Date.now()
      break
    }

    case 'ItemUpdate': {
      const group = ensureGroup(payload.groupId)
      const item = findItem(group, payload.itemId)
      if (item) {
        item.assetId = payload.assetId ?? item.assetId
        item.name = payload.name ?? item.name
        item.updatedAt = Date.now()
      }
      upsertAssetMetadata({
        assetId: payload.assetId,
        role: 'item',
        groupId: group.groupId,
        itemId: payload.itemId,
        name: payload.name ?? payload.assetId,
        mediaType: payload.mediaType ?? 'image',
        mimeType: payload.mimeType ?? ''
      })
      group.updatedAt = Date.now()
      break
    }

    case 'ItemDelete': {
      const group = ensureGroup(payload.groupId)
      group.items = group.items.filter((item) => item.itemId !== payload.itemId)
      group.items.forEach((item, index) => {
        item.order = index
      })
      group.updatedAt = Date.now()
      break
    }

    case 'ItemSelect': {
      const group = ensureGroup(payload.groupId)
      group.activeItemId = payload.itemId
      break
    }

    case 'ItemTransform': {
      const group = ensureGroup(payload.groupId)
      const item = findItem(group, payload.itemId)
      if (item) {
        item.gridIndex = payload.gridIndex ?? item.gridIndex
        item.position = payload.position ?? item.position
        item.scale = payload.scale ?? item.scale
        item.rotation = payload.rotation ?? item.rotation
        item.updatedAt = Date.now()
      }
      group.updatedAt = Date.now()
      break
    }

    case 'ItemDeform': {
      const group = ensureGroup(payload.groupId)
      const item = findItem(group, payload.itemId)
      if (item) {
        item.flipX = payload.flipX ?? item.flipX
        item.flipY = payload.flipY ?? item.flipY
        item.updatedAt = Date.now()
      }
      break
    }

    case 'ItemAnimation': {
      const group = ensureGroup(payload.groupId)
      const item = findItem(group, payload.itemId)
      if (item) {
        item.animationId = payload.animationId ?? item.animationId
        item.updatedAt = Date.now()
      }
      break
    }

    case 'ItemMotion': {
      const group = ensureGroup(payload.groupId)
      const item = findItem(group, payload.itemId)
      if (item) {
        item.moveMode = payload.mode ?? payload.moveMode ?? item.moveMode
        item.movePercent = payload.percent ?? payload.movePercent ?? item.movePercent
        item.moveSpeed = payload.speed ?? payload.moveSpeed ?? item.moveSpeed
        item.moveTrack = payload.track ?? payload.moveTrack ?? item.moveTrack
        item.updatedAt = Date.now()
      }
      break
    }

    case 'ItemSettingsCopy': {
      const group = ensureGroup(payload.groupId)
      const source = findItem(group, payload.sourceItemId)
      const target = findItem(group, payload.targetItemId)
      if (source && target) {
        const fields = payload.fields ?? [
          'scale',
          'rotation',
          'flipX',
          'flipY',
          'animationId',
          'moveMode',
          'movePercent',
          'moveSpeed',
          'moveTrack'
        ]
        fields.forEach((field) => {
          if (field in source) target[field] = source[field]
        })
        target.updatedAt = Date.now()
      }
      break
    }

    default:
      console.log('Unhandled dynamic event:', eventName, payload)
  }

  saveState()
  broadcastState()
}

const splitHeaderParameters = (value) => {
  const result = {}
  String(value || '').split(';').forEach((part) => {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (!rawKey) return
    const key = rawKey.trim()
    const joinedValue = rawValue.join('=').trim()
    result[key] = joinedValue.replace(/^"|"$/g, '')
  })
  return result
}

const parseMultipart = (buffer, contentType) => {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '')
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2]
  if (!boundary) throw new Error('Missing multipart boundary')

  const boundaryBuffer = Buffer.from(`--${boundary}`)
  const fields = {}
  let file = null
  let cursor = 0

  while (cursor < buffer.length) {
    const boundaryIndex = buffer.indexOf(boundaryBuffer, cursor)
    if (boundaryIndex < 0) break

    let partStart = boundaryIndex + boundaryBuffer.length
    if (buffer[partStart] === 45 && buffer[partStart + 1] === 45) break
    if (buffer[partStart] === 13 && buffer[partStart + 1] === 10) partStart += 2

    const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, partStart)
    if (nextBoundaryIndex < 0) break

    let part = buffer.slice(partStart, nextBoundaryIndex)
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.slice(0, -2)
    }

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd >= 0) {
      const headerText = part.slice(0, headerEnd).toString('utf8')
      const body = part.slice(headerEnd + 4)
      const headers = {}
      headerText.split('\r\n').forEach((line) => {
        const separator = line.indexOf(':')
        if (separator > 0) {
          headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim()
        }
      })

      const disposition = splitHeaderParameters(headers['content-disposition'])
      const name = disposition.name
      if (name) {
        if (disposition.filename !== undefined) {
          file = {
            fieldName: name,
            filename: disposition.filename || 'upload',
            contentType: headers['content-type'] || 'application/octet-stream',
            data: body
          }
        } else {
          fields[name] = body.toString('utf8')
        }
      }
    }

    cursor = nextBoundaryIndex
  }

  return { fields, file }
}

const readRequestBody = (request) => {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0

    request.on('data', (chunk) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })

    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

const handleUpload = (buffer, contentType) => {
  const { fields, file } = parseMultipart(buffer, contentType)
  if (!file) throw new Error('Missing multipart file')

  const assetId = fields.assetId || makeId('media')
  const groupId = fields.groupId || DEFAULT_GROUP_ID
  const name = fields.name || file.filename || assetId
  const mimeType = fields.mimeType || file.contentType || 'application/octet-stream'
  const mediaType = fields.mediaType || detectMediaType(mimeType, name)
  const extension = getExtension(name, mimeType)
  const filePath = path.join(assetsDir, `${safeSegment(assetId)}${extension}`)

  fs.writeFileSync(filePath, file.data)

  const asset = {
    assetId,
    role: fields.role || 'item',
    groupId,
    itemId: fields.itemId || null,
    name,
    mediaType,
    mimeType,
    filePath,
    updatedAt: Date.now()
  }

  runtimeState.assets[assetId] = asset

  const group = ensureGroup(groupId)
  if (asset.role === 'background') {
    upsertBackground(group, {
      assetId,
      name,
      mediaType,
      mimeType
    })
  } else if (asset.role === 'item' && fields.itemId) {
    const item = findItem(group, fields.itemId)
    if (item) {
      item.assetId = assetId
      item.name = item.name || name
      item.updatedAt = Date.now()
    }
  }

  saveState()
  broadcastState()

  return { ok: true, assetId, role: asset.role, groupId }
}

const writeCorsHeaders = (response) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const sendJson = (response, statusCode, data) => {
  writeCorsHeaders(response)
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(data))
}

const handleAssetRequest = (request, response, pathname) => {
  const assetId = decodeURIComponent(pathname.replace(/^\/assets\//, ''))
  const asset = runtimeState.assets[assetId]

  if (!asset?.filePath || !fs.existsSync(asset.filePath)) {
    sendJson(response, 404, { ok: false, error: 'Asset not found' })
    return
  }

  writeCorsHeaders(response)
  response.writeHead(200, {
    'Content-Type': asset.mimeType || 'application/octet-stream',
    'Cache-Control': 'no-store'
  })
  fs.createReadStream(asset.filePath).pipe(response)
}

const requestHandler = async (request, response) => {
  writeCorsHeaders(response)

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

  try {
    if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
      handleAssetRequest(request, response, url.pathname)
      return
    }

    if (request.method === 'GET' && url.pathname === '/status') {
      sendJson(response, 200, getPublicState())
      return
    }

    if (request.method !== 'POST') {
      sendJson(response, 404, { ok: false, error: 'Not found' })
      return
    }

    const contentType = String(request.headers['content-type'] || '')
    const body = await readRequestBody(request)

    if (contentType.includes('multipart/form-data')) {
      const result = handleUpload(body, contentType)
      sendJson(response, 200, result)
      return
    }

    const message = body.toString('utf8').trim()
    const dynamicEvent = parseDynamicMessage(message)
    if (dynamicEvent) {
      applyDynamicEvent(dynamicEvent.eventName, dynamicEvent.payload)
      sendJson(response, 200, { ok: true, eventName: dynamicEvent.eventName })
      return
    }

    sendJson(response, 200, { ok: true, ignored: true })
  } catch (error) {
    console.error('HTTP request failed:', error)
    sendJson(response, 500, {
      ok: false,
      error: error.message || 'Request failed'
    })
  }
}

const startServer = () => {
  server = http.createServer(requestHandler)
  server.on('error', (error) => {
    runtimeState.server.status = 'error'
    runtimeState.server.error = error.message
    broadcastServerStatus()
  })
  server.listen(CONTROL_PORT, '0.0.0.0', () => {
    runtimeState.server.status = 'listening'
    runtimeState.server.error = ''
    broadcastServerStatus()
    broadcastState()
  })
}

const createWindow = () => {
  const windowedForTesting = process.env.MAGICFLOOR_WINDOWED === '1'

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: !windowedForTesting,
    backgroundColor: '#05070a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  mainWindow.webContents.once('did-finish-load', () => {
    broadcastServerStatus()
    broadcastState()
  })
}

app.whenReady().then(() => {
  ensureRuntimeDirs()
  loadState()
  createWindow()
  startServer()
})

ipcMain.on('request-runtime-state', () => {
  broadcastServerStatus()
  broadcastState()
})

app.on('window-all-closed', () => {
  if (server) server.close()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
