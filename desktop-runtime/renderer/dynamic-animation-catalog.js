export const DYNAMIC_ANIMATION_MIN_ID = 0
export const DYNAMIC_ANIMATION_MAX_ID = 17
export const DYNAMIC_FIXED_ANIMATION_MIN_ID = 1
export const LEGACY_DYNAMIC_ANIMATION_MAX_ID = 9

export const DYNAMIC_ANIMATION_IDS = Object.freeze(
  Array.from(
    { length: DYNAMIC_ANIMATION_MAX_ID - DYNAMIC_FIXED_ANIMATION_MIN_ID + 1 },
    (_, index) => index + DYNAMIC_FIXED_ANIMATION_MIN_ID
  )
)

export const LEGACY_DYNAMIC_ANIMATION_IDS = Object.freeze(
  DYNAMIC_ANIMATION_IDS.filter((animationId) => animationId <= LEGACY_DYNAMIC_ANIMATION_MAX_ID)
)

export const DYNAMIC_ANIMATION_CATALOG = Object.freeze([
  { id: 0, key: 'none', labelKey: 'animation.none', shortLabelKey: 'animation.shortNone', className: 'none' },
  { id: 1, key: 'breathe', labelKey: 'animation.breathe', shortLabelKey: 'animation.shortBreathe', className: 'breathe' },
  { id: 2, key: 'swing', labelKey: 'animation.swing', shortLabelKey: 'animation.shortSwing', className: 'swing' },
  { id: 3, key: 'blink', labelKey: 'animation.blink', shortLabelKey: 'animation.shortBlink', className: 'blink' },
  { id: 4, key: 'rotate', labelKey: 'animation.rotate', shortLabelKey: 'animation.shortRotate', className: 'rotate' },
  { id: 5, key: 'bounce', labelKey: 'animation.bounce', shortLabelKey: 'animation.shortBounce', className: 'bounce' },
  { id: 6, key: 'wave', labelKey: 'animation.wave', shortLabelKey: 'animation.shortWave', className: 'wave' },
  { id: 7, key: 'flip', labelKey: 'animation.flip', shortLabelKey: 'animation.shortFlip', className: 'flip' },
  { id: 8, key: 'pulse', labelKey: 'animation.pulse', shortLabelKey: 'animation.shortPulse', className: 'pulse' },
  { id: 9, key: 'walk', labelKey: 'animation.walk', shortLabelKey: 'animation.shortWalk', className: 'walk' },
  { id: 10, key: 'danceOne', labelKey: 'animation.danceOne', shortLabelKey: 'animation.shortDanceOne', className: 'dance-one' },
  { id: 11, key: 'danceTwo', labelKey: 'animation.danceTwo', shortLabelKey: 'animation.shortDanceTwo', className: 'dance-two' },
  { id: 12, key: 'jellyJump', labelKey: 'animation.jellyJump', shortLabelKey: 'animation.shortJellyJump', className: 'jelly-jump' },
  { id: 13, key: 'jumpFlip', labelKey: 'animation.jumpFlip', shortLabelKey: 'animation.shortJumpFlip', className: 'jump-flip' },
  { id: 14, key: 'pullRight', labelKey: 'animation.pullRight', shortLabelKey: 'animation.shortPullRight', className: 'pull-right' },
  { id: 15, key: 'raiseHand', labelKey: 'animation.raiseHand', shortLabelKey: 'animation.shortRaiseHand', className: 'raise-hand' },
  { id: 16, key: 'rolling', labelKey: 'animation.rolling', shortLabelKey: 'animation.shortRolling', className: 'rolling' },
  { id: 17, key: 'unityWave', labelKey: 'animation.unityWave', shortLabelKey: 'animation.shortUnityWave', className: 'unity-wave' }
])

const clampInteger = (value, minimum, maximum, fallback) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.trunc(number)))
}

export const normalizeDynamicAnimationId = (value) => (
  clampInteger(value, DYNAMIC_ANIMATION_MIN_ID, DYNAMIC_ANIMATION_MAX_ID, 0)
)

export const normalizeDynamicAnimationMode = (value, animationId = 0) => {
  if (value === 'none' || value === 'fixed' || value === 'random') return value
  return normalizeDynamicAnimationId(animationId) === 0 ? 'none' : 'fixed'
}

export const getDefaultClickAnimationIds = (legacy = false) => (
  [...(legacy ? LEGACY_DYNAMIC_ANIMATION_IDS : DYNAMIC_ANIMATION_IDS)]
)

export const normalizeDynamicClickAnimationIds = (value, legacy = false) => {
  const source = Array.isArray(value) ? value : []
  const allowed = new Set(DYNAMIC_ANIMATION_IDS)
  const normalized = Array.from(new Set(
    source
      .map((animationId) => Number(animationId))
      .filter((animationId) => Number.isInteger(animationId) && allowed.has(animationId))
  )).sort((first, second) => first - second)

  return normalized.length > 0 ? normalized : getDefaultClickAnimationIds(legacy)
}

export const getDynamicAnimationMode = (item) => (
  normalizeDynamicAnimationMode(item?.animationMode, item?.animationId)
)

export const getDynamicClickAnimationIds = (item) => (
  normalizeDynamicClickAnimationIds(
    item?.clickAnimationIds,
    !Array.isArray(item?.clickAnimationIds)
  )
)

const hashString = (value) => {
  let hash = 2166136261
  const text = String(value ?? '')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export const resolveDynamicAnimationId = (
  mode,
  animationId,
  availableAnimationIds = DYNAMIC_ANIMATION_IDS,
  seed = ''
) => {
  const normalizedMode = normalizeDynamicAnimationMode(mode, animationId)
  if (normalizedMode === 'none') return 0
  if (normalizedMode === 'fixed') return normalizeDynamicAnimationId(animationId)

  const candidates = normalizeDynamicClickAnimationIds(availableAnimationIds, false)
  return candidates[hashString(seed) % candidates.length]
}

export const getDynamicAnimationDefinition = (animationId) => (
  DYNAMIC_ANIMATION_CATALOG.find((definition) => definition.id === normalizeDynamicAnimationId(animationId))
    ?? DYNAMIC_ANIMATION_CATALOG[0]
)
