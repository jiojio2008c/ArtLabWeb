const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const workspaceRoot = process.cwd()
const svgPath = path.join(workspaceRoot, 'presentation', 'hk', '香港版_MagicFloor_現場演講長圖.svg')
const pngPath = path.join(workspaceRoot, 'presentation', 'hk', '香港版_MagicFloor_現場演講長圖.png')

app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('force-color-profile', 'srgb')

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 1600,
    height: 900,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false
    }
  })

  await window.loadFile(svgPath)
  const pageSize = await window.webContents.executeJavaScript(`({ width: document.documentElement.viewBox.baseVal.width, height: document.documentElement.viewBox.baseVal.height })`)
  const debuggerSession = window.webContents.debugger
  debuggerSession.attach('1.3')
  await debuggerSession.sendCommand('Emulation.setDeviceMetricsOverride', {
    width: Math.round(pageSize.width),
    height: Math.round(pageSize.height),
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: Math.round(pageSize.width),
    screenHeight: Math.round(pageSize.height)
  })
  const screenshot = await debuggerSession.sendCommand('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    optimizeForSpeed: false
  })
  fs.writeFileSync(pngPath, Buffer.from(screenshot.data, 'base64'))
  debuggerSession.detach()
  window.destroy()
  app.quit()
})

