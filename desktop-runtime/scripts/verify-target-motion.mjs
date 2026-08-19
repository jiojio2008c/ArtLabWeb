import assert from 'node:assert/strict'
import {
  sampleTargetMotionProgress,
  sampleTargetOneWayProgress,
  sampleTargetPingPongProgress
} from '../renderer/target-motion-core.js'
import { readFileSync } from 'node:fs'

const oneWayDurationMs = 1000

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

const playerSource = readFileSync(new URL('../renderer/player.js', import.meta.url), 'utf8')
assert.match(
  playerSource,
  /case 'orbit':\s*{[\s\S]*?return\s*{\s*x,\s*y,\s*scale:\s*1,\s*rotation:\s*0\s*}/,
  'Orbit movement must preserve the configured object size in desktop playback.'
)

console.log('Target-point one-way and optional loop motion verified.')
