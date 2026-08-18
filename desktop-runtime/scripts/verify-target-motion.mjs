import assert from 'node:assert/strict'
import {
  sampleTargetMotionProgress,
  sampleTargetOneWayProgress,
  sampleTargetPingPongProgress
} from '../renderer/target-motion-core.js'

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

console.log('Target-point one-way and optional loop motion verified.')
