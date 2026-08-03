export type InteractiveThemeEffect = 'ocean' | 'forest-one' | 'forest-two' | 'painting'

export interface InteractiveThemeMask {
  id: string
  label: string
  image: string
}

export interface InteractiveTheme {
  id: string
  title: string
  maskLabel: string
  image: string
  effect: InteractiveThemeEffect
  accent: string
  secondary: string
  masks: InteractiveThemeMask[]
}

const mask = (id: string, label: string, fileName: string): InteractiveThemeMask => ({
  id,
  label,
  image: `/assets/masks/${fileName}`
})

const INTERACTIVE_THEMES: InteractiveTheme[] = [
  {
    id: 'ocean',
    title: '美麗海洋',
    maskLabel: '多種魚類',
    image: '/assets/interactive-ocean.jpg',
    effect: 'ocean',
    accent: '#76efff',
    secondary: '#3b75ff',
    masks: [
      mask('C-01', '旗魚', 'mask-marine-marlin-01.png'),
      mask('C-02', '小丑魚', 'mask-marine-clownfish-02.png'),
      mask('C-03', '河豚', 'mask-marine-pufferfish-03.png'),
      mask('C-04', '海馬', 'mask-marine-seahorse-04.png')
    ]
  },
  {
    id: 'forest-1',
    title: '魔幻森林1',
    maskLabel: '多種動物',
    image: '/assets/interactive-forest-1.jpg',
    effect: 'forest-one',
    accent: '#b6ff8e',
    secondary: '#8f5cff',
    masks: [
      mask('A-01', '長頸鹿', 'mask-animal-giraffe-01.png'),
      mask('A-02', '孔雀', 'mask-animal-peacock-02.png'),
      mask('A-03', '狐狸', 'mask-animal-fox-03.png'),
      mask('A-04', '斑馬', 'mask-animal-zebra-04.png')
    ]
  },
  {
    id: 'forest-2',
    title: '魔幻森林2',
    maskLabel: '多種動物',
    image: '/assets/interactive-forest-2.jpg',
    effect: 'forest-two',
    accent: '#78ffd2',
    secondary: '#ff68bf',
    masks: [
      mask('A-01', '長頸鹿', 'mask-animal-giraffe-01.png'),
      mask('A-02', '孔雀', 'mask-animal-peacock-02.png'),
      mask('A-03', '狐狸', 'mask-animal-fox-03.png'),
      mask('A-04', '斑馬', 'mask-animal-zebra-04.png')
    ]
  },
  {
    id: 'painting',
    title: '畫境成真',
    maskLabel: '繽紛建築',
    image: '/assets/interactive-painting.png',
    effect: 'painting',
    accent: '#ffd878',
    secondary: '#ff6da8',
    masks: [
      mask('B-01', '建築群', 'mask-building-complex-01.png'),
      mask('B-02', '建築立面', 'mask-building-facade-02.png'),
      mask('B-03', '長型建築', 'mask-building-long-block-03.png'),
      mask('B-04', 'L 型建築', 'mask-building-l-shape-04.png')
    ]
  }
]

export { INTERACTIVE_THEMES }
