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
}

const MAIN_ICON_BASE = '/MainIcon'
const MASK_BASE = '/Mask'

const DIRECT_UPLOAD_THEMES: DirectUploadTheme[] = [
  {
    id: 'forest-1',
    label: '魔幻森林1',
    cover: `${MAIN_ICON_BASE}/魔幻森林1.jpg`,
    maskPrefix: 'A'
  },
  {
    id: 'forest-2',
    label: '魔幻森林2',
    cover: `${MAIN_ICON_BASE}/魔幻森林2.jpg`,
    maskPrefix: 'A'
  },
  {
    id: 'painting-real',
    label: '畫境成真',
    cover: `${MAIN_ICON_BASE}/畫境成真.png`,
    maskPrefix: 'B'
  },
  {
    id: 'ocean',
    label: '美麗海洋',
    cover: `${MAIN_ICON_BASE}/美麗海洋.jpg`,
    maskPrefix: 'C'
  }
]

const DIRECT_MASKS_BY_PREFIX: Record<DirectMaskPrefix, UploadMaskOption[]> = {
  A: [
    { id: 'A-02', label: 'A-02', src: `${MASK_BASE}/A-02.png` },
    { id: 'A-03', label: 'A-03', src: `${MASK_BASE}/A-03.png` },
    { id: 'A-05', label: 'A-05', src: `${MASK_BASE}/A-05.png` },
    { id: 'A-06', label: 'A-06', src: `${MASK_BASE}/A-06.png` }
  ],
  B: [
    { id: 'B-01', label: 'B-01', src: `${MASK_BASE}/B-01_revised.png` },
    { id: 'B-02', label: 'B-02', src: `${MASK_BASE}/B-02_revised.png` },
    { id: 'B-03', label: 'B-03', src: `${MASK_BASE}/B-03_revised.png` },
    { id: 'B-04', label: 'B-04', src: `${MASK_BASE}/B-04_revised.png` },
    { id: 'B-05', label: 'B-05', src: `${MASK_BASE}/B-05_revised.png` },
    { id: 'B-06', label: 'B-06', src: `${MASK_BASE}/B-06_revised.png` },
    { id: 'B-07', label: 'B-07', src: `${MASK_BASE}/B-07_revised.png` },
    { id: 'B-08', label: 'B-08', src: `${MASK_BASE}/B-08_revised.png` }
  ],
  C: [
    { id: 'C-01', label: 'C-01', src: `${MASK_BASE}/C-01.png` },
    { id: 'C-02', label: 'C-02', src: `${MASK_BASE}/C-02.png` },
    { id: 'C-03', label: 'C-03', src: `${MASK_BASE}/C-03.png` },
    { id: 'C-04', label: 'C-04', src: `${MASK_BASE}/C-04.png` },
    { id: 'C-05', label: 'C-05', src: `${MASK_BASE}/C-05.png` },
    { id: 'C-06', label: 'C-06', src: `${MASK_BASE}/C-06.png` },
    { id: 'C-07', label: 'C-07', src: `${MASK_BASE}/C-07.png` },
    { id: 'C-08', label: 'C-08', src: `${MASK_BASE}/C-08.png` },
    { id: 'C-09', label: 'C-09', src: `${MASK_BASE}/C-09.png` }
  ]
}

const getDirectMasksForTheme = (theme: DirectUploadTheme) => DIRECT_MASKS_BY_PREFIX[theme.maskPrefix]

export type { DirectMaskPrefix, DirectUploadTheme, UploadMaskOption }
export { DIRECT_MASKS_BY_PREFIX, DIRECT_UPLOAD_THEMES, getDirectMasksForTheme }
