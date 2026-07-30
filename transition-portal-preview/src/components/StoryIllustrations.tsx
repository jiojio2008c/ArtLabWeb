interface IllustrationProps {
  className?: string
}

export const BaoIllustration: React.FC<IllustrationProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 180 140" role="img" aria-label="包子作品">
    <defs>
      <linearGradient id="bao-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffdf6" />
        <stop offset="1" stopColor="#e7d9bd" />
      </linearGradient>
      <filter id="bao-shadow" x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#5f4a2d" floodOpacity=".24" />
      </filter>
    </defs>
    <ellipse cx="90" cy="118" rx="54" ry="11" fill="#765f44" opacity=".2" />
    <path d="M42 101C28 78 41 52 61 42C59 25 76 15 89 31C100 12 121 25 117 44C143 54 151 83 134 104C118 124 58 124 42 101Z" fill="url(#bao-body)" stroke="#d8c39c" strokeWidth="4" filter="url(#bao-shadow)" />
    <path d="M89 31L79 48M89 31L98 49M70 37L77 52M109 37L101 53" fill="none" stroke="#d5bd91" strokeWidth="4" strokeLinecap="round" />
    <circle cx="70" cy="79" r="4" fill="#4d4439" />
    <circle cx="109" cy="79" r="4" fill="#4d4439" />
    <path d="M80 91C86 97 94 97 100 91" fill="none" stroke="#9b6b63" strokeWidth="4" strokeLinecap="round" />
    <path d="M45 34C35 24 45 13 52 5M87 22C78 12 85 4 91 0M128 36C119 25 129 14 134 7" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".72" />
  </svg>
)

export const TigerIllustration: React.FC<IllustrationProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 180 190" role="img" aria-label="老虎素材">
    <defs>
      <filter id="tiger-shadow" x="-40%" y="-30%" width="180%" height="190%">
        <feDropShadow dx="0" dy="9" stdDeviation="6" floodColor="#163832" floodOpacity=".3" />
      </filter>
    </defs>
    <g filter="url(#tiger-shadow)">
      <path d="M45 70C24 47 35 25 57 39C75 20 111 21 128 42C151 31 160 57 140 76V121C140 155 118 173 89 173C59 173 38 153 40 121Z" fill="#f2a629" stroke="#51341d" strokeWidth="5" />
      <path d="M48 48L31 29L62 37M128 48L149 31L121 38" fill="#f7b742" stroke="#51341d" strokeWidth="5" strokeLinejoin="round" />
      <path d="M77 33L84 59M101 34L95 59M53 67L73 75M127 66L107 75M50 100L72 96M130 100L108 96" fill="none" stroke="#51341d" strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="89" cy="112" rx="32" ry="29" fill="#fff4da" />
      <circle cx="72" cy="83" r="5" fill="#1d2825" />
      <circle cx="107" cy="83" r="5" fill="#1d2825" />
      <path d="M82 104L96 104L89 113Z" fill="#51341d" />
      <path d="M89 113C81 124 72 123 68 119M89 113C96 124 107 123 111 118" fill="none" stroke="#51341d" strokeWidth="4" strokeLinecap="round" />
      <path d="M57 142L50 176M121 142L128 176" stroke="#51341d" strokeWidth="8" strokeLinecap="round" />
    </g>
  </svg>
)

export const CrabIllustration: React.FC<IllustrationProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 190 140" role="img" aria-label="螃蟹素材">
    <defs>
      <filter id="crab-shadow" x="-40%" y="-40%" width="180%" height="210%">
        <feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#15362e" floodOpacity=".28" />
      </filter>
    </defs>
    <g filter="url(#crab-shadow)" fill="none" stroke="#74312d" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M54 70C55 40 73 25 95 25C119 25 136 43 136 72C136 100 119 117 94 117C69 117 53 99 54 70Z" fill="#ef6754" />
      <path d="M55 58C34 49 23 35 29 22C39 20 51 29 58 42M134 58C155 49 168 35 161 22C150 20 139 29 132 42" />
      <path d="M35 24L19 13L20 38ZM160 23L175 12L175 38Z" fill="#ff8770" />
      <path d="M54 84L27 95M58 98L36 116M135 84L162 96M132 98L154 117" />
    </g>
    <circle cx="80" cy="60" r="7" fill="#fff" stroke="#74312d" strokeWidth="4" />
    <circle cx="110" cy="60" r="7" fill="#fff" stroke="#74312d" strokeWidth="4" />
    <circle cx="80" cy="60" r="2.5" fill="#24312d" />
    <circle cx="110" cy="60" r="2.5" fill="#24312d" />
    <path d="M84 78C91 84 99 84 106 78" fill="none" stroke="#74312d" strokeWidth="4" strokeLinecap="round" />
  </svg>
)
