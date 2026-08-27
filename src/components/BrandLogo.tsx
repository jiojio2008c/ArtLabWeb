import type { FC } from 'react'

interface BrandLogoProps {
  className?: string
}

export const RIGHT_LOGO_URL = new URL('../../Right_Logo.png', import.meta.url).href

const BrandLogo: FC<BrandLogoProps> = ({ className = '' }) => (
  <img
    className={`entry-brand-logo ${className}`.trim()}
    src={RIGHT_LOGO_URL}
    alt="MagicFloor"
    draggable={false}
  />
)

export default BrandLogo
