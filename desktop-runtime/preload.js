const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('runtimeApi', {
  onState: (callback) => {
    ipcRenderer.on('runtime-state', (_event, state) => callback(state))
  },
  onServerStatus: (callback) => {
    ipcRenderer.on('server-status', (_event, status) => callback(status))
  },
  requestState: () => ipcRenderer.send('request-runtime-state')
})
