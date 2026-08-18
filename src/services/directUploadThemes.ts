import type { AppLauncherId } from './unityBridge.ts'

interface UploadMaskOption {
  id: string
  labelKey: MaskLabelKey
  src?: string
}

type DirectMaskPrefix = 'A' | 'B' | 'C'

interface DirectUploadTheme {
  id: string
  labelKey: ThemeLabelKey
  cover: string
  accent: string
  secondary: string
  maskPrefix: DirectMaskPrefix
  launcherAppId: AppLauncherId
}

type ThemeLabelKey = 'theme.ocean' | 'theme.forest1' | 'theme.forest2' | 'theme.paintingReal'
type MaskLabelKey =
  | 'mask.giraffe' | 'mask.peacock' | 'mask.fox' | 'mask.zebra' | 'mask.elephant' | 'mask.deer'
  | 'mask.buildingComplex' | 'mask.buildingFacade' | 'mask.longBuilding' | 'mask.lShapeBuilding'
  | 'mask.truck' | 'mask.minivan' | 'mask.sedan' | 'mask.compactCar'
  | 'mask.marlin' | 'mask.clownfish' | 'mask.pufferfish' | 'mask.seahorse' | 'mask.seaTurtle'
  | 'mask.squid' | 'mask.angelfish' | 'mask.tuna' | 'mask.shark'
  | 'mask.none' | 'mask.dinosaur' | 'mask.bear' | 'mask.fish' | 'mask.fullBody' | 'mask.portrait'

const MAIN_ICON_BASE = '/MainIcon'
const MASK_BASE = '/Mask'

const DIRECT_UPLOAD_THEMES: DirectUploadTheme[] = [
  {
    id: 'ocean',
    labelKey: 'theme.ocean',
    accent: '#76efff',
    secondary: '#3b75ff',
    cover: `${MAIN_ICON_BASE}/美麗海洋.jpg`,
    maskPrefix: 'C',
    launcherAppId: 'interactive-ocean'
  },
  {
    id: 'forest-1',
    labelKey: 'theme.forest1',
    accent: '#b6ff8e',
    secondary: '#8f5cff',
    cover: `${MAIN_ICON_BASE}/魔幻森林1.jpg`,
    maskPrefix: 'A',
    launcherAppId: 'interactive-forest-1'
  },
  {
    id: 'forest-2',
    labelKey: 'theme.forest2',
    accent: '#78ffd2',
    secondary: '#ff68bf',
    cover: `${MAIN_ICON_BASE}/魔幻森林2.jpg`,
    maskPrefix: 'A',
    launcherAppId: 'interactive-forest-2'
  },
  {
    id: 'painting-real',
    labelKey: 'theme.paintingReal',
    accent: '#ffd878',
    secondary: '#ff6da8',
    cover: `${MAIN_ICON_BASE}/畫境成真.png`,
    maskPrefix: 'B',
    launcherAppId: 'interactive-painting-real'
  }
]

const DIRECT_MASKS_BY_PREFIX: Record<DirectMaskPrefix, UploadMaskOption[]> = {
  A: [
    { id: 'A-01', labelKey: 'mask.giraffe', src: `${MASK_BASE}/mask-animal-giraffe-01.png` },
    { id: 'A-02', labelKey: 'mask.peacock', src: `${MASK_BASE}/mask-animal-peacock-02.png` },
    { id: 'A-03', labelKey: 'mask.fox', src: `${MASK_BASE}/mask-animal-fox-03.png` },
    { id: 'A-04', labelKey: 'mask.zebra', src: `${MASK_BASE}/mask-animal-zebra-04.png` },
    { id: 'A-05', labelKey: 'mask.elephant', src: `${MASK_BASE}/mask-animal-elephant-05.png` },
    { id: 'A-06', labelKey: 'mask.deer', src: `${MASK_BASE}/mask-animal-deer-06.png` }
  ],
  B: [
    { id: 'B-01', labelKey: 'mask.buildingComplex', src: `${MASK_BASE}/mask-building-complex-01.png` },
    { id: 'B-02', labelKey: 'mask.buildingFacade', src: `${MASK_BASE}/mask-building-facade-02.png` },
    { id: 'B-03', labelKey: 'mask.longBuilding', src: `${MASK_BASE}/mask-building-long-block-03.png` },
    { id: 'B-04', labelKey: 'mask.lShapeBuilding', src: `${MASK_BASE}/mask-building-l-shape-04.png` },
    { id: 'B-05', labelKey: 'mask.truck', src: `${MASK_BASE}/mask-vehicle-truck-05.png` },
    { id: 'B-06', labelKey: 'mask.minivan', src: `${MASK_BASE}/mask-vehicle-minivan-06.png` },
    { id: 'B-07', labelKey: 'mask.sedan', src: `${MASK_BASE}/mask-vehicle-sedan-07.png` },
    { id: 'B-08', labelKey: 'mask.compactCar', src: `${MASK_BASE}/mask-vehicle-compact-car-08.png` }
  ],
  C: [
    { id: 'C-01', labelKey: 'mask.marlin', src: `${MASK_BASE}/mask-marine-marlin-01.png` },
    { id: 'C-02', labelKey: 'mask.clownfish', src: `${MASK_BASE}/mask-marine-clownfish-02.png` },
    { id: 'C-03', labelKey: 'mask.pufferfish', src: `${MASK_BASE}/mask-marine-pufferfish-03.png` },
    { id: 'C-04', labelKey: 'mask.seahorse', src: `${MASK_BASE}/mask-marine-seahorse-04.png` },
    { id: 'C-05', labelKey: 'mask.seaTurtle', src: `${MASK_BASE}/mask-marine-sea-turtle-05.png` },
    { id: 'C-06', labelKey: 'mask.squid', src: `${MASK_BASE}/mask-marine-squid-06.png` },
    { id: 'C-07', labelKey: 'mask.angelfish', src: `${MASK_BASE}/mask-marine-angelfish-07.png` },
    { id: 'C-08', labelKey: 'mask.tuna', src: `${MASK_BASE}/mask-marine-tuna-08.png` },
    { id: 'C-09', labelKey: 'mask.shark', src: `${MASK_BASE}/mask-marine-shark-09.png` }
  ]
}

const getDirectMasksForTheme = (theme: DirectUploadTheme) => DIRECT_MASKS_BY_PREFIX[theme.maskPrefix]

export type { DirectMaskPrefix, DirectUploadTheme, MaskLabelKey, ThemeLabelKey, UploadMaskOption }
export { DIRECT_MASKS_BY_PREFIX, DIRECT_UPLOAD_THEMES, getDirectMasksForTheme }
