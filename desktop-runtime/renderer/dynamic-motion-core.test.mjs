import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  HORIZONTAL_MOTION_FRAME_COUNT,
  getDynamicHorizontalMotionKeyframes,
  getDynamicHorizontalMotionPoint,
  getDynamicOrbitKeyframes,
  getDynamicVerticalWaveKeyframes,
  getDynamicVerticalWaveOffsets,
  sampleDynamicHorizontalMotion,
  sampleDynamicOrbitMotion,
  sampleDynamicVerticalWave
} from './dynamic-motion-core.js'

const stageSize = { width: 1920, height: 1080 }
const item = {
  position: { x: 0.37, y: 0.58 },
  movePercent: 72,
  moveTrack: 'middle'
}

const rightStart = getDynamicHorizontalMotionPoint('right', 0, 72, stageSize)
const rightEnd = getDynamicHorizontalMotionPoint('right', 1, 72, stageSize)
const leftStart = getDynamicHorizontalMotionPoint('left', 0, 72, stageSize)
const leftEnd = getDynamicHorizontalMotionPoint('left', 1, 72, stageSize)
assert.deepEqual(rightStart, leftEnd)
assert.deepEqual(rightEnd, leftStart)
assert.equal(rightStart.x, -260)
assert.equal(rightEnd.x, 2180)

const rightFrames = getDynamicHorizontalMotionKeyframes('right', 72, stageSize)
assert.equal(rightFrames.length, HORIZONTAL_MOTION_FRAME_COUNT + 1)
assert.deepEqual(rightFrames[0], { offset: 0, ...rightStart })
assert.deepEqual(rightFrames.at(-1), { offset: 1, ...rightEnd })

for (const progress of [0.001, 0.037, 0.123]) {
  const scaled = progress * HORIZONTAL_MOTION_FRAME_COUNT
  const lowerIndex = Math.floor(scaled)
  const ratio = scaled - lowerIndex
  const lower = rightFrames[lowerIndex]
  const upper = rightFrames[lowerIndex + 1]
  const expected = {
    x: lower.x + (upper.x - lower.x) * ratio,
    y: lower.y + (upper.y - lower.y) * ratio
  }
  const actual = sampleDynamicHorizontalMotion('right', progress, 72, stageSize)
  assert.ok(
    Math.abs(actual.x - expected.x) < 1e-9
      && Math.abs(actual.y - expected.y) < 1e-9,
    `The EXE sample at ${progress} must match Web keyframe interpolation.`
  )
}

assert.notEqual(
  sampleDynamicHorizontalMotion('right', 0.037, 72, stageSize).y,
  getDynamicHorizontalMotionPoint('right', 0.037, 72, stageSize).y,
  'Non-keyframe sampling must follow the shared discrete Web trajectory rather than the continuous sine.'
)

const orbitFrames = getDynamicOrbitKeyframes(item, stageSize)
assert.equal(orbitFrames.length, 17)
assert.deepEqual(sampleDynamicOrbitMotion(item, 0, stageSize), {
  x: orbitFrames[0].x,
  y: orbitFrames[0].y
})
assert.deepEqual(sampleDynamicOrbitMotion(item, 0.5, stageSize), {
  x: orbitFrames[8].x,
  y: orbitFrames[8].y
})
assert.deepEqual(sampleDynamicOrbitMotion(item, 1, stageSize), {
  x: orbitFrames[0].x,
  y: orbitFrames[0].y
})

const verticalOffsets = getDynamicVerticalWaveOffsets(item, stageSize.height)
const verticalFrames = getDynamicVerticalWaveKeyframes(item, stageSize)
assert.deepEqual(verticalFrames.map(({ offset, y }) => ({ offset, y })), [
  { offset: 0, y: 0 },
  { offset: 0.35, y: verticalOffsets.waveDown },
  { offset: 0.7, y: verticalOffsets.waveUp },
  { offset: 1, y: 0 }
])
assert.ok(verticalFrames.slice(0, 3).every(({ easing }) => easing === 'cubic-bezier(0.333333, 0, 0.666667, 1)'))
assert.equal(sampleDynamicVerticalWave(0, verticalOffsets.waveDown, verticalOffsets.waveUp), 0)
assert.equal(sampleDynamicVerticalWave(0.35, verticalOffsets.waveDown, verticalOffsets.waveUp), verticalOffsets.waveDown)
assert.equal(sampleDynamicVerticalWave(0.7, verticalOffsets.waveDown, verticalOffsets.waveUp), verticalOffsets.waveUp)
assert.equal(sampleDynamicVerticalWave(1, verticalOffsets.waveDown, verticalOffsets.waveUp), 0)

const controlSource = readFileSync(new URL('../../src/components/DynamicControlPage.tsx', import.meta.url), 'utf8')
const playerSource = readFileSync(new URL('./player.js', import.meta.url), 'utf8')
assert.match(controlSource, /dynamic-motion-core\.js/)
assert.match(playerSource, /dynamic-motion-core\.js/)
assert.match(controlSource, /getDynamicHorizontalMotionKeyframes/)
assert.match(controlSource, /getDynamicVerticalWaveKeyframes/)
assert.match(playerSource, /sampleDynamicHorizontalMotion/)
assert.match(playerSource, /sampleDynamicOrbitMotion/)
assert.match(playerSource, /sampleDynamicVerticalWave/)

const styleSource = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')
assert.match(styleSource, /composed-vertical-wave-motion/)

console.log('Shared iPad/EXE motion sampling verified.')
