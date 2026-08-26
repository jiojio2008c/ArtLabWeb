import assert from 'node:assert/strict'
import {
  TARGET_MOTION_KEYFRAME_SEGMENTS,
  getTargetMotionDurationMs,
  sampleTargetMotionProgress,
  sampleTargetMotionState,
  sampleTargetOneWayProgress,
  sampleTargetPingPongProgress
} from '../renderer/target-motion-core.js'
import { readFileSync } from 'node:fs'

const oneWayDurationMs = 1000

assert.ok(Math.abs(getTargetMotionDurationMs(50) - 3819) < 1e-9)
assert.ok(getTargetMotionDurationMs(1) > getTargetMotionDurationMs(100))

assert.equal(sampleTargetPingPongProgress(0, oneWayDurationMs), 0)
assert.equal(sampleTargetPingPongProgress(oneWayDurationMs / 2, oneWayDurationMs), 0.5)
assert.equal(sampleTargetPingPongProgress(oneWayDurationMs, oneWayDurationMs), 1)
assert.equal(sampleTargetPingPongProgress(oneWayDurationMs * 1.5, oneWayDurationMs), 0.5)
assert.equal(sampleTargetPingPongProgress(oneWayDurationMs * 2, oneWayDurationMs), 0)
assert.equal(sampleTargetPingPongProgress(oneWayDurationMs * 3, oneWayDurationMs), 1)

assert.equal(sampleTargetOneWayProgress(0, oneWayDurationMs), 0)
assert.equal(sampleTargetOneWayProgress(oneWayDurationMs / 2, oneWayDurationMs), 0.5)
assert.equal(sampleTargetOneWayProgress(oneWayDurationMs, oneWayDurationMs), 1)
assert.equal(sampleTargetOneWayProgress(oneWayDurationMs * 2, oneWayDurationMs), 1)

assert.equal(sampleTargetMotionProgress(oneWayDurationMs * 2, oneWayDurationMs, false), 1)
assert.equal(sampleTargetMotionProgress(oneWayDurationMs * 2, oneWayDurationMs, true), 0)

assert.deepEqual(
  sampleTargetMotionState(oneWayDurationMs + 79, oneWayDurationMs, {
    hideAfterTarget: true,
    settleMs: 80
  }),
  {
    progress: 1,
    arrived: false,
    hidden: false,
    visible: true,
    interactive: true,
    arrivalMs: 1080
  }
)
assert.equal(
  sampleTargetMotionState(oneWayDurationMs + 80, oneWayDurationMs, {
    hideAfterTarget: true,
    settleMs: 80
  }).hidden,
  true
)
assert.equal(
  sampleTargetMotionState(oneWayDurationMs * 5, oneWayDurationMs, {
    loop: true,
    hideAfterTarget: true
  }).hidden,
  false,
  'Looping target motion must never hide at a final arrival.'
)

for (const loop of [false, true]) {
  const animationDuration = loop ? oneWayDurationMs * 2 : oneWayDurationMs
  const elapsedMs = animationDuration * 0.037
  const scaled = 0.037 * TARGET_MOTION_KEYFRAME_SEGMENTS
  const lowerIndex = Math.floor(scaled)
  const ratio = scaled - lowerIndex
  const sampleAtIndex = (index) => {
    const keyframeElapsed = animationDuration * index / TARGET_MOTION_KEYFRAME_SEGMENTS
    return loop
      ? sampleTargetPingPongProgress(keyframeElapsed, oneWayDurationMs)
      : sampleTargetOneWayProgress(keyframeElapsed, oneWayDurationMs)
  }
  const expected = sampleAtIndex(lowerIndex)
    + (sampleAtIndex(lowerIndex + 1) - sampleAtIndex(lowerIndex)) * ratio
  assert.ok(
    Math.abs(sampleTargetMotionProgress(elapsedMs, oneWayDurationMs, loop) - expected) < 1e-12,
    `Target-point sampling must match Web keyframe interpolation when loop=${loop}.`
  )
}

const playerSource = readFileSync(new URL('../renderer/player.js', import.meta.url), 'utf8')
const webTargetSource = readFileSync(new URL('../../src/services/dynamicTargetMotion.ts', import.meta.url), 'utf8')
assert.match(
  webTargetSource,
  /target-motion-core\.js/,
  'The Web preview must import the shared target-point sampling core.'
)
assert.match(
  playerSource,
  /case 'orbit':\s*{[\s\S]*?sampleDynamicOrbitMotion[\s\S]*?return\s*{\s*x:\s*point\.x,\s*y:\s*point\.y,\s*scale:\s*1,\s*rotation:\s*0\s*}/,
  'Orbit movement must preserve the configured object size in desktop playback.'
)

console.log('Target-point one-way and optional loop motion verified.')
