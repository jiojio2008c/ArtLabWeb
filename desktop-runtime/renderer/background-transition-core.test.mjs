import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_DYNAMIC_BACKGROUND_TRANSITION_DURATIONS,
  MAX_DYNAMIC_BACKGROUND_TRANSITION_DURATION_MS,
  MIN_DYNAMIC_BACKGROUND_TRANSITION_DURATION_MS,
  getDynamicBackgroundTransitionTiming,
  normalizeDynamicBackgroundTransitionDuration,
  normalizeDynamicBackgroundTransitionDurations
} from './background-transition-core.js'

test('normalizes transition duration defaults and bounds', () => {
  assert.deepEqual(
    normalizeDynamicBackgroundTransitionDurations(undefined),
    DEFAULT_DYNAMIC_BACKGROUND_TRANSITION_DURATIONS
  )
  assert.equal(
    normalizeDynamicBackgroundTransitionDuration('curtain', -1),
    MIN_DYNAMIC_BACKGROUND_TRANSITION_DURATION_MS
  )
  assert.equal(
    normalizeDynamicBackgroundTransitionDuration('shadowPlay', Number.POSITIVE_INFINITY),
    DEFAULT_DYNAMIC_BACKGROUND_TRANSITION_DURATIONS.shadowPlay
  )
  assert.equal(
    normalizeDynamicBackgroundTransitionDuration('curtain', MAX_DYNAMIC_BACKGROUND_TRANSITION_DURATION_MS + 1),
    MAX_DYNAMIC_BACKGROUND_TRANSITION_DURATION_MS
  )
  assert.equal(normalizeDynamicBackgroundTransitionDuration('none', 4000), 0)
})

test('scales curtain and shadow-play phases while preserving their ratios', () => {
  const curtain = getDynamicBackgroundTransitionTiming('curtain', { curtain: 4000 })
  assert.equal(curtain.durationMs, 4000)
  assert.equal(curtain.closeMs + curtain.openMs, 4000)
  assert.ok(Math.abs(curtain.closeMs / curtain.durationMs - 520 / 1200) < 0.001)

  const shadowPlay = getDynamicBackgroundTransitionTiming('shadowPlay', { shadowPlay: 2800 })
  assert.equal(shadowPlay.durationMs, 2800)
  assert.equal(shadowPlay.closeMs + shadowPlay.openMs, 2800)
  assert.ok(Math.abs(shadowPlay.closeMs / shadowPlay.durationMs - 650 / 1400) < 0.001)
})

test('keeps camera flash and direct switch timings fixed', () => {
  assert.deepEqual(
    getDynamicBackgroundTransitionTiming('cameraFlash', { curtain: 5000, shadowPlay: 5000 }),
    { closeMs: 150, openMs: 330, durationMs: 480 }
  )
  assert.deepEqual(
    getDynamicBackgroundTransitionTiming('none', { curtain: 5000, shadowPlay: 5000 }),
    { closeMs: 0, openMs: 0, durationMs: 0 }
  )
})
