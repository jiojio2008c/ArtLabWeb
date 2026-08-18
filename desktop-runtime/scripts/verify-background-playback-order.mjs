import assert from 'node:assert/strict'

import { getDynamicBackgroundPlaybackStartIndex } from '../renderer/background-playback-core.js'

const ipadBackgrounds = [
  { id: 'forest' },
  { id: 'ocean' },
  { id: 'city' }
]

assert.equal(getDynamicBackgroundPlaybackStartIndex([], 'city', 'sequence'), -1)
assert.equal(getDynamicBackgroundPlaybackStartIndex(ipadBackgrounds, 'city', 'fixed'), 2)
assert.equal(getDynamicBackgroundPlaybackStartIndex(ipadBackgrounds, 'ocean', 'random'), 1)
assert.equal(
  getDynamicBackgroundPlaybackStartIndex(ipadBackgrounds, 'city', 'sequence'),
  0,
  'Ordered playback must always begin with the first persisted background.'
)

const desktopBackgrounds = ipadBackgrounds.map(({ id }) => ({ assetId: id }))
assert.equal(getDynamicBackgroundPlaybackStartIndex(desktopBackgrounds, 'city', 'fixed'), 2)
assert.equal(getDynamicBackgroundPlaybackStartIndex(desktopBackgrounds, 'city', 'sequence'), 0)
assert.equal(getDynamicBackgroundPlaybackStartIndex(desktopBackgrounds, 'missing', 'fixed'), 0)

console.log('Background playback order verification passed.')
