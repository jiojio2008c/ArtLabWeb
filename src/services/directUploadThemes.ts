import type { AppLauncherId } from './unityBridge.ts'

interface UploadMaskOption {
  id: string
  label: string
  src?: string
}

type DirectMaskPrefix = 'A' | 'B' | 'C'

interface DirectUploadTheme {
  id: string
  label: string
  cover: string
  maskPrefix: DirectMaskPrefix
  launcherAppId: AppLauncherId
}

const MAIN_ICON_BASE = '/MainIcon'
const MASK_BASE = '/Mask'

const DIRECT_UPLOAD_THEMES: DirectUploadTheme[] = [
  {
    id: 'ocean',
    label: '美麗海洋',
    cover: `${MAIN_ICON_BASE}/美麗海洋.jpg`,
    maskPrefix: 'C',
    launcherAppId: 'interactive-ocean'
  },
  {
    id: 'forest-1',
    label: '魔幻森林1',
    cover: `${MAIN_ICON_BASE}/魔幻森林1.jpg`,
    maskPrefix: 'A',
    launcherAppId: 'interactive-forest-1'
  },
  {
    id: 'forest-2',
    label: '魔幻森林2',
    cover: `${MAIN_ICON_BASE}/魔幻森林2.jpg`,
    maskPrefix: 'A',
    launcherAppId: 'interactive-forest-2'
  },
  {
    id: 'painting-real',
    label: '畫境成真',
    cover: `${MAIN_ICON_BASE}/畫境成真.png`,
    maskPrefix: 'B',
    launcherAppId: 'interactive-painting-real'
  }
]

const DIRECT_MASKS_BY_PREFIX: Record<DirectMaskPrefix, UploadMaskOption[]> = {
  A: [
    { id: 'A-01', label: '長頸鹿', src: `${MASK_BASE}/mask-animal-giraffe-01.png` },
    { id: 'A-02', label: '孔雀', src: `${MASK_BASE}/mask-animal-peacock-02.png` },
    { id: 'A-03', label: '狐狸', src: `${MASK_BASE}/mask-animal-fox-03.png` },
    { id: 'A-04', label: '斑馬', src: `${MASK_BASE}/mask-animal-zebra-04.png` },
    { id: 'A-05', label: '大象', src: `${MASK_BASE}/mask-animal-elephant-05.png` },
    { id: 'A-06', label: '鹿', src: `${MASK_BASE}/mask-animal-deer-06.png` }
  ],
  B: [
    { id: 'B-01', label: '建築群', src: `${MASK_BASE}/mask-building-complex-01.png` },
    { id: 'B-02', label: '建築立面', src: `${MASK_BASE}/mask-building-facade-02.png` },
    { id: 'B-03', label: '長型建築', src: `${MASK_BASE}/mask-building-long-block-03.png` },
    { id: 'B-04', label: 'L 型建築', src: `${MASK_BASE}/mask-building-l-shape-04.png` },
    { id: 'B-05', label: '貨車', src: `${MASK_BASE}/mask-vehicle-truck-05.png` },
    { id: 'B-06', label: '廂型車', src: `${MASK_BASE}/mask-vehicle-minivan-06.png` },
    { id: 'B-07', label: '轎車', src: `${MASK_BASE}/mask-vehicle-sedan-07.png` },
    { id: 'B-08', label: '小型車', src: `${MASK_BASE}/mask-vehicle-compact-car-08.png` }
  ],
  C: [
    { id: 'C-01', label: '旗魚', src: `${MASK_BASE}/mask-marine-marlin-01.png` },
    { id: 'C-02', label: '小丑魚', src: `${MASK_BASE}/mask-marine-clownfish-02.png` },
    { id: 'C-03', label: '河豚', src: `${MASK_BASE}/mask-marine-pufferfish-03.png` },
    { id: 'C-04', label: '海馬', src: `${MASK_BASE}/mask-marine-seahorse-04.png` },
    { id: 'C-05', label: '海龜', src: `${MASK_BASE}/mask-marine-sea-turtle-05.png` },
    { id: 'C-06', label: '魷魚', src: `${MASK_BASE}/mask-marine-squid-06.png` },
    { id: 'C-07', label: '神仙魚', src: `${MASK_BASE}/mask-marine-angelfish-07.png` },
    { id: 'C-08', label: '鮪魚', src: `${MASK_BASE}/mask-marine-tuna-08.png` },
    { id: 'C-09', label: '鯊魚', src: `${MASK_BASE}/mask-marine-shark-09.png` }
  ]
}

const getDirectMasksForTheme = (theme: DirectUploadTheme) => DIRECT_MASKS_BY_PREFIX[theme.maskPrefix]

export type { DirectMaskPrefix, DirectUploadTheme, UploadMaskOption }
export { DIRECT_MASKS_BY_PREFIX, DIRECT_UPLOAD_THEMES, getDirectMasksForTheme }
