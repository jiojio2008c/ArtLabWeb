import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const APP_URL = process.env.MAGICFLOOR_APP_URL || 'http://127.0.0.1:5173/'
const EDGE_PATH = process.env.MAGICFLOOR_EDGE_PATH
  || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUTPUT_DIR = new URL('../../app-store-assets/screenshots/ipad-pro-12-9/', import.meta.url)
const screenshotPath = (name) => fileURLToPath(new URL(name, OUTPUT_DIR))
const viewport = { width: 1366, height: 1024 }
const expectedPixelSize = {
  width: viewport.width * 2,
  height: viewport.height * 2
}
const now = Date.now()

const svgDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

const makeStaticMedia = (id, name, url, width = 1600, height = 900) => ({
  id,
  name,
  type: 'image',
  mimeType: url.endsWith('.png') ? 'image/png' : 'image/jpeg',
  url,
  width,
  height,
  updatedAt: now
})

const makeSvgMedia = (id, name, svg, width = 640, height = 480) => ({
  id,
  name,
  type: 'image',
  mimeType: 'image/svg+xml',
  url: svgDataUrl(svg),
  width,
  height,
  updatedAt: now
})

const itemArtwork = {
  whale: `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <defs>
        <linearGradient id="whale-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#9cf2ff"/>
          <stop offset="0.55" stop-color="#36b7d8"/>
          <stop offset="1" stop-color="#176b9b"/>
        </linearGradient>
        <filter id="whale-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="18" stdDeviation="14" flood-color="#053f67" flood-opacity=".32"/>
        </filter>
      </defs>
      <g filter="url(#whale-shadow)">
        <path d="M132 251c0-78 87-137 205-137 102 0 171 40 198 94 20 40 6 89-33 119-46 36-116 53-194 44-103-12-176-57-176-120Z" fill="url(#whale-body)"/>
        <path d="M519 202c32-46 79-58 101-48-14 25-25 43-56 57 31 7 48 26 55 50-39 9-78-10-103-42Z" fill="#247fa8"/>
        <path d="M215 326c42 18 101 24 159 9-21 45-78 66-126 42-19-10-31-28-33-51Z" fill="#d8fbff" opacity=".88"/>
        <path d="M323 119c18-38 53-59 82-55-1 34-24 64-62 75Z" fill="#54cbe2"/>
        <circle cx="442" cy="208" r="12" fill="#082f49"/>
        <circle cx="446" cy="204" r="4" fill="#fff"/>
        <path d="M471 244c-16 13-33 17-51 12" fill="none" stroke="#0b5474" stroke-width="7" stroke-linecap="round"/>
        <path d="M165 221c-28-26-57-27-78-11 20 22 44 32 73 30Z" fill="#42b9d2"/>
      </g>
    </svg>`,
  fish: `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <defs>
        <linearGradient id="fish-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffd86f"/>
          <stop offset=".55" stop-color="#ff8d49"/>
          <stop offset="1" stop-color="#f04d67"/>
        </linearGradient>
        <filter id="fish-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="16" stdDeviation="12" flood-color="#5b2358" flood-opacity=".28"/>
        </filter>
      </defs>
      <g filter="url(#fish-shadow)">
        <path d="M154 241c64-103 218-133 333-47 24 18 45 38 61 61-68 103-209 134-324 69-34-19-58-47-70-83Z" fill="url(#fish-body)"/>
        <path d="M162 236 61 149c3 54 25 91 65 113-34 25-52 61-49 109l91-76Z" fill="#ef5c78"/>
        <path d="M270 157c33-54 78-77 120-62-8 39-42 73-91 91Z" fill="#ffbe55"/>
        <path d="M286 327c41 50 88 66 127 45-17-39-51-65-101-75Z" fill="#e95176"/>
        <path d="M343 150c-5 70 11 136 49 202" fill="none" stroke="#fff2bd" stroke-width="18" stroke-linecap="round" opacity=".82"/>
        <path d="M420 163c-4 65 10 119 42 166" fill="none" stroke="#8a285d" stroke-width="14" stroke-linecap="round" opacity=".55"/>
        <circle cx="488" cy="220" r="17" fill="#31204f"/>
        <circle cx="493" cy="214" r="6" fill="#fff"/>
        <path d="M519 260c-17 8-31 9-46 3" fill="none" stroke="#7c2859" stroke-width="7" stroke-linecap="round"/>
      </g>
    </svg>`,
  jellyfish: `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <defs>
        <radialGradient id="jelly-bell" cx="45%" cy="35%" r="70%">
          <stop offset="0" stop-color="#fff4ff" stop-opacity=".96"/>
          <stop offset=".45" stop-color="#d4a8ff" stop-opacity=".9"/>
          <stop offset="1" stop-color="#7a5dde" stop-opacity=".88"/>
        </radialGradient>
        <filter id="jelly-glow" x="-50%" y="-50%" width="200%" height="220%">
          <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#8e74ff" flood-opacity=".55"/>
        </filter>
      </defs>
      <g filter="url(#jelly-glow)">
        <path d="M174 229c3-108 66-172 150-172s146 67 149 172c-36-22-71-20-106 6-37-28-73-28-108 0-29-23-58-25-85-6Z" fill="url(#jelly-bell)"/>
        <path d="M216 222c-4 72 52 70 21 145-12 28-5 48 19 60" fill="none" stroke="#b7a0ff" stroke-width="16" stroke-linecap="round"/>
        <path d="M292 229c-25 67 32 84 1 142-17 32-8 56 16 72" fill="none" stroke="#e0c9ff" stroke-width="18" stroke-linecap="round"/>
        <path d="M369 226c23 70-32 83-1 142 15 29 9 53-15 72" fill="none" stroke="#bca7ff" stroke-width="17" stroke-linecap="round"/>
        <path d="M433 217c12 55-30 72-5 123 13 26 9 49-9 68" fill="none" stroke="#8f79e8" stroke-width="14" stroke-linecap="round"/>
        <circle cx="279" cy="174" r="10" fill="#463b87"/>
        <circle cx="368" cy="174" r="10" fill="#463b87"/>
        <path d="M293 199c18 15 39 15 58 0" fill="none" stroke="#6253a7" stroke-width="7" stroke-linecap="round"/>
      </g>
    </svg>`,
  turtle: `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <defs>
        <radialGradient id="turtle-shell" cx="38%" cy="34%" r="70%">
          <stop offset="0" stop-color="#dffb7f"/>
          <stop offset=".55" stop-color="#64c97c"/>
          <stop offset="1" stop-color="#258e70"/>
        </radialGradient>
        <filter id="turtle-shadow" x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="0" dy="18" stdDeviation="13" flood-color="#174d55" flood-opacity=".3"/>
        </filter>
      </defs>
      <g filter="url(#turtle-shadow)">
        <ellipse cx="319" cy="244" rx="151" ry="112" fill="url(#turtle-shell)"/>
        <path d="M226 175c29 16 47 35 58 60-24 23-46 41-80 48-15-35-7-78 22-108Zm187 1c-31 14-52 35-64 60 24 25 48 41 81 48 15-36 8-78-17-108ZM239 320c30-18 52-32 78-39 22 21 34 45 33 77-38 16-82 2-111-38Zm163-1c-31-18-52-31-78-38-22 21-34 45-33 77 38 16 82 2 111-39Z" fill="#96de82" opacity=".72"/>
        <circle cx="502" cy="242" r="53" fill="#71cf8b"/>
        <circle cx="518" cy="228" r="7" fill="#183f49"/>
        <path d="M532 250c-10 8-21 9-31 4" fill="none" stroke="#275b55" stroke-width="6" stroke-linecap="round"/>
        <path d="M164 177c-57-37-91-21-106 13 45 22 84 28 120 10Zm4 134c-54 40-58 76-30 102 39-33 60-66 57-104Zm288-128c43-43 84-40 106-12-33 34-70 48-110 39Zm4 126c51 29 64 65 43 94-42-24-66-54-67-93Z" fill="#60bd82"/>
        <path d="m220 241 54-52 75 14 54 62-49 56-78-4Z" fill="none" stroke="#2f8d68" stroke-width="12" opacity=".7"/>
      </g>
    </svg>`,
  star: `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <defs>
        <linearGradient id="star-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff097"/>
          <stop offset=".48" stop-color="#ff9b6e"/>
          <stop offset="1" stop-color="#f35d88"/>
        </linearGradient>
        <filter id="star-shadow" x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="0" dy="18" stdDeviation="14" flood-color="#8b3d70" flood-opacity=".3"/>
        </filter>
      </defs>
      <g filter="url(#star-shadow)">
        <path d="m320 55 53 124 135-30-76 115 105 90-137 12-18 136-62-122-121 64 48-129-126-55 132-38Z" fill="url(#star-fill)"/>
        <circle cx="282" cy="251" r="12" fill="#6f355f"/>
        <circle cx="362" cy="251" r="12" fill="#6f355f"/>
        <path d="M293 285c19 17 40 17 59 0" fill="none" stroke="#8c3e6c" stroke-width="9" stroke-linecap="round"/>
        <circle cx="238" cy="285" r="16" fill="#ffb7ac" opacity=".75"/>
        <circle cx="403" cy="285" r="16" fill="#ffb7ac" opacity=".75"/>
      </g>
    </svg>`
}

const ambientAudio = {
  id: 'audio-ocean-breeze',
  name: '海风轻音乐',
  type: 'audio',
  mimeType: 'audio/wav',
  url: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
  durationMs: 90000,
  updatedAt: now
}

const backgrounds = [
  {
    ...makeStaticMedia('bg-ocean-garden', '梦幻海洋', '/fish.png'),
    bgmAudioId: ambientAudio.id,
    backgroundTransition: 'curtain'
  },
  {
    ...makeStaticMedia('bg-color-city', '彩色城市', '/people.png'),
    backgroundTransition: 'cameraFlash'
  },
  {
    ...makeStaticMedia('bg-deep-sea', '星光深海', '/MainIcon/美麗海洋.jpg'),
    backgroundTransition: 'shadowPlay'
  }
]

const makeItem = ({
  id,
  name,
  artwork,
  position,
  order,
  scale,
  animationId,
  moveMode,
  movePercent,
  moveTrack,
  backgroundIds = []
}) => ({
  id,
  name,
  media: makeSvgMedia(`media-${id}`, name, artwork),
  position,
  gridIndex: order,
  scale,
  rotation: 0,
  flipX: false,
  flipY: false,
  animationMode: 'fixed',
  animationId,
  clickAnimationIds: [1, 4, 7],
  moveMode,
  movePercent,
  moveSpeed: 48 + order * 4,
  moveTrack,
  targetMode: 'loop',
  backgroundIds,
  isVisible: true,
  order,
  appearanceDelayMs: order * 700,
  createdAt: now + order,
  updatedAt: now + order
})

const mainItems = [
  makeItem({
    id: 'item-whale',
    name: '微笑蓝鲸',
    artwork: itemArtwork.whale,
    position: { x: 0.25, y: 0.34 },
    order: 0,
    scale: 0.78,
    animationId: 2,
    moveMode: 'right',
    movePercent: 30,
    moveTrack: 'top'
  }),
  makeItem({
    id: 'item-jellyfish',
    name: '发光水母',
    artwork: itemArtwork.jellyfish,
    position: { x: 0.52, y: 0.27 },
    order: 1,
    scale: 0.62,
    animationId: 5,
    moveMode: 'verticalWave',
    movePercent: 26,
    moveTrack: 'middle'
  }),
  makeItem({
    id: 'item-turtle',
    name: '绿海龟',
    artwork: itemArtwork.turtle,
    position: { x: 0.71, y: 0.54 },
    order: 2,
    scale: 0.68,
    animationId: 7,
    moveMode: 'orbit',
    movePercent: 24,
    moveTrack: 'middle'
  }),
  makeItem({
    id: 'item-fish',
    name: '珊瑚小鱼',
    artwork: itemArtwork.fish,
    position: { x: 0.4, y: 0.7 },
    order: 3,
    scale: 0.55,
    animationId: 4,
    moveMode: 'left',
    movePercent: 34,
    moveTrack: 'bottom'
  }),
  makeItem({
    id: 'item-star',
    name: '快乐海星',
    artwork: itemArtwork.star,
    position: { x: 0.81, y: 0.78 },
    order: 4,
    scale: 0.44,
    animationId: 1,
    moveMode: 'random',
    movePercent: 18,
    moveTrack: 'bottom'
  })
]

const mainGroup = {
  id: 'app-store-ocean-adventure',
  name: '海洋奇遇',
  thumbnail: makeStaticMedia('thumb-ocean-adventure', '海洋奇遇', '/fish.png', 960, 540),
  background: backgrounds[0],
  backgrounds,
  activeBackgroundId: backgrounds[0].id,
  backgroundPlayMode: 'sequence',
  backgroundIntervalMs: 6000,
  appearMode: 'sequence',
  appearIntervalMs: 700,
  appearAnimation: 'trackSlide',
  backgroundTransition: 'curtain',
  audioLibrary: [ambientAudio],
  items: mainItems,
  libraryOrder: 0,
  createdAt: now - 7200000,
  updatedAt: now + 3000
}

const makeLibraryGroup = ({ id, name, thumbnail, background, libraryOrder, itemOffset }) => ({
  ...mainGroup,
  id,
  name,
  thumbnail: makeStaticMedia(`thumb-${id}`, name, thumbnail, 960, 540),
  background,
  backgrounds: [background],
  activeBackgroundId: background.id,
  backgroundPlayMode: 'fixed',
  items: mainItems.slice(0, 3).map((item, index) => ({
    ...item,
    id: `${id}-item-${index + 1}`,
    media: { ...item.media, id: `${id}-media-${index + 1}` },
    order: index
  })),
  libraryOrder,
  createdAt: now - itemOffset * 3600000,
  updatedAt: now - itemOffset * 1800000
})

const groups = [
  mainGroup,
  makeLibraryGroup({
    id: 'app-store-color-city',
    name: '彩色城市',
    thumbnail: '/people.png',
    background: backgrounds[1],
    libraryOrder: 1,
    itemOffset: 2
  }),
  makeLibraryGroup({
    id: 'app-store-starry-sea',
    name: '星光深海',
    thumbnail: '/MainIcon/美麗海洋.jpg',
    background: backgrounds[2],
    libraryOrder: 2,
    itemOffset: 4
  })
]

const fakeUser = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'review@magicfloor.local',
  email_confirmed_at: new Date(now - 86400000).toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { display_name: 'MagicFloor 演示账号' },
  identities: [],
  created_at: new Date(now - 86400000).toISOString(),
  updated_at: new Date(now).toISOString()
}

const fakeSession = {
  access_token: 'app-store-screenshot-access-token',
  token_type: 'bearer',
  expires_in: 31536000,
  expires_at: Math.floor(Date.now() / 1000) + 31536000,
  refresh_token: 'app-store-screenshot-refresh-token',
  user: fakeUser
}

const installSeedData = ({ session, seededGroups }) => {
  class ScreenshotAudioMock extends EventTarget {
    constructor(src = '') {
      super()
      this.src = src
      this.paused = true
      this.preload = ''
      this.loop = false
      this.volume = 1
      this.currentTime = 0
      this.duration = 90
    }

    play() {
      this.paused = false
      return Promise.resolve()
    }

    pause() {
      this.paused = true
    }

    removeAttribute(name) {
      if (name === 'src') this.src = ''
    }

    load() {}
  }

  Object.defineProperty(window, 'Audio', {
    configurable: true,
    writable: true,
    value: ScreenshotAudioMock
  })
  localStorage.setItem('magicfloor_supabase_auth_v1', JSON.stringify(session))
  localStorage.setItem('magicfloor_dynamic_groups_v1', JSON.stringify(seededGroups))
  localStorage.setItem('magicfloor_dynamic_folders_v1', '[]')
  localStorage.setItem('magicfloor_network_settings_v1', JSON.stringify({
    wsIp: '127.0.0.1',
    dynamicPort: 8080,
    interactivePort: 11701,
    advancedFeaturesEnabled: true,
    watermarkEnabled: true
  }))
  localStorage.setItem('magicfloor_locale_v1', 'zh-Hans')
}

const waitForVisuals = async (page, delayMs = 650) => {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready
  })
  await page.waitForFunction(() => Array.from(document.images).every((image) => {
    const bounds = image.getBoundingClientRect()
    const style = getComputedStyle(image)
    const isVisible = bounds.width > 0
      && bounds.height > 0
      && style.display !== 'none'
      && style.visibility !== 'hidden'
    return !isVisible || (image.complete && image.naturalWidth > 0)
  }), undefined, { timeout: 15000 })
  await page.waitForTimeout(delayMs)
}

const waitForTransitionExit = async (page, selector) => {
  await page.locator(selector).waitFor({ state: 'detached', timeout: 15000 })
}

const readPngDimensions = async (path) => {
  const png = await readFile(path)
  const hasPngSignature = png.length >= 24
    && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && png.subarray(12, 16).toString('ascii') === 'IHDR'
  if (!hasPngSignature) throw new Error(`Invalid PNG output: ${path}`)
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20)
  }
}

const openLibrary = async (page) => {
  await page.locator('.entry-choice-card.dynamic-choice-card').click()
  await page.locator('.dynamic-library-screen').waitFor({ state: 'visible', timeout: 15000 })
  await waitForTransitionExit(page, '.dynamic-portal-transition-layer')
  await page.locator('[data-library-entity-id="app-store-ocean-adventure"]').waitFor({ state: 'visible' })
  await waitForVisuals(page, 900)
}

const openControl = async (page) => {
  await openLibrary(page)
  await page.locator(
    '[data-library-entity-id="app-store-ocean-adventure"] .dynamic-library-icon-main'
  ).click()
  await page.locator('.dynamic-control-screen').waitFor({ state: 'visible', timeout: 15000 })
  await page.locator('[data-layer-item-id="item-whale"]').waitFor({ state: 'visible' })
  await waitForVisuals(page, 1100)
}

const openInteractiveThemes = async (page) => {
  await page.locator('.interactive-choice-card').click()
  await page.locator('.direct-select-screen').waitFor({ state: 'visible', timeout: 15000 })
  await waitForTransitionExit(page, '.direct-theme-upload-transition')
  await page.locator('[data-theme-id="ocean"]').waitFor({ state: 'visible' })
  await waitForVisuals(page, 900)
}

const captureDefinitions = [
  {
    name: '01-home.png',
    ready: '.entry-screen',
    setup: async () => {}
  },
  {
    name: '02-artwork-library.png',
    ready: '.dynamic-library-screen',
    setup: openLibrary
  },
  {
    name: '03-stage-control.png',
    ready: '.dynamic-control-screen',
    setup: openControl
  },
  {
    name: '04-object-properties.png',
    ready: '.dynamic-property-overlay-panel',
    setup: async (page) => {
      await openControl(page)
      await page.locator(
        '[data-layer-item-id="item-whale"] .dynamic-layer-property-button'
      ).click()
      await page.locator('.dynamic-property-overlay-panel').waitFor({ state: 'visible' })
    }
  },
  {
    name: '05-background-editor.png',
    ready: '.dynamic-background-modal',
    setup: async (page) => {
      await openControl(page)
      await page.locator('.background-action').click()
      await page.locator('.dynamic-background-modal').waitFor({ state: 'visible' })
      const settingsScroll = page.locator('.dynamic-background-settings-scroll')
      await waitForVisuals(page, 250)
      await settingsScroll.evaluate(async (element) => {
        element.scrollTop = element.scrollHeight - element.clientHeight
        await new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        })
      })
      const bottomControlsVisible = await settingsScroll.evaluate((element) => {
        const scrollBounds = element.getBoundingClientRect()
        return [
          '.dynamic-background-bgm-actions',
          '.dynamic-background-bgm-clear-all'
        ].every((selector) => {
          const control = element.querySelector(selector)
          if (!control) return false
          const controlBounds = control.getBoundingClientRect()
          return controlBounds.top >= scrollBounds.top - 1
            && controlBounds.bottom <= scrollBounds.bottom + 1
        })
      })
      if (!bottomControlsVisible) {
        throw new Error('Background BGM controls are outside the screenshot viewport')
      }
    }
  },
  {
    name: '06-appearance-settings.png',
    ready: '.dynamic-appearance-modal',
    setup: async (page) => {
      await openControl(page)
      await page.locator('.appear-action').click()
      await page.locator('.dynamic-appearance-modal').waitFor({ state: 'visible' })
    }
  },
  {
    name: '07-live-preview.png',
    ready: '.dynamic-control-screen.dynamic-previewing',
    allowAnimations: true,
    setup: async (page) => {
      await openControl(page)
      await page.locator('.preview-action.primary-button').click()
      await page.locator('.dynamic-control-screen.dynamic-previewing').waitFor({ state: 'visible' })
      await waitForVisuals(page, 3500)
      await page.evaluate(() => {
        document.getAnimations().forEach((animation) => animation.pause())
      })
    }
  },
  {
    name: '08-interactive-themes.png',
    ready: '.direct-select-screen',
    setup: openInteractiveThemes
  },
  {
    name: '09-mask-editor.png',
    ready: '.mask-workspace .mask-source-image',
    setup: async (page) => {
      await openInteractiveThemes(page)
      await page.locator('[data-theme-id="ocean"]').click()
      await page.locator('.upload-screen').waitFor({ state: 'visible', timeout: 15000 })
      await waitForTransitionExit(page, '.direct-theme-upload-transition')
      const sampleImage = await readFile(new URL('../../public/fish.png', import.meta.url))
      await page.locator('input[type="file"]').setInputFiles({
        name: '海洋作品.png',
        mimeType: 'image/png',
        buffer: sampleImage
      })
      await page.locator('.mask-workspace .mask-source-image').waitFor({ state: 'visible' })
      const maskOptions = page.locator('.mask-option')
      if (await maskOptions.count() >= 5) await maskOptions.nth(4).click()
    }
  },
  {
    name: '10-remote-keyboard.png',
    ready: '.remote-keyboard-device',
    setup: async (page) => {
      await page.locator('.entry-remote-keyboard-button').click()
      await page.locator('.remote-keyboard-device').waitFor({ state: 'visible', timeout: 15000 })
    }
  }
]

await mkdir(OUTPUT_DIR, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE_PATH, headless: true })
const results = []

try {
  for (const definition of captureDefinitions) {
    const context = await browser.newContext({
      viewport,
      screen: viewport,
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
      locale: 'zh-CN',
      colorScheme: 'light',
      reducedMotion: 'reduce'
    })
    await context.addInitScript(installSeedData, {
      session: fakeSession,
      seededGroups: groups
    })

    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fakeUser)
      })
    })
    await page.route('**/rest/v1/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]'
      })
    })
    await page.route(/^http:\/\/127\.0\.0\.1:(8080|11701)(\/.*)?$/, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
          },
          body: ''
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '{}'
      })
    })

    try {
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
      await page.locator('.entry-screen').waitFor({ state: 'visible', timeout: 15000 })
      await definition.setup(page)
      await page.locator(definition.ready).waitFor({ state: 'visible', timeout: 15000 })
      await waitForVisuals(page)
      const outputPath = screenshotPath(definition.name)
      await page.screenshot({
        path: outputPath,
        type: 'png',
        fullPage: false,
        animations: definition.allowAnimations ? 'allow' : 'disabled'
      })
      const pixelSize = await readPngDimensions(outputPath)
      if (pixelSize.width !== expectedPixelSize.width || pixelSize.height !== expectedPixelSize.height) {
        throw new Error(
          `${definition.name} is ${pixelSize.width}x${pixelSize.height}; expected ${expectedPixelSize.width}x${expectedPixelSize.height}`
        )
      }
      const uniqueErrors = [...new Set(errors)]
      if (uniqueErrors.length > 0) {
        throw new Error(`${definition.name} browser errors:\n${uniqueErrors.join('\n')}`)
      }
      results.push({
        name: definition.name,
        outputPath,
        viewport,
        pixelWidth: pixelSize.width,
        pixelHeight: pixelSize.height,
        errors: uniqueErrors
      })
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`)
