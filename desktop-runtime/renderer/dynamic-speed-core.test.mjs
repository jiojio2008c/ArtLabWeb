import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  getDynamicMoveDurationSeconds,
  getDynamicMoveSpeedSlowdownFactor,
  normalizeDynamicMoveSpeed
} from './dynamic-speed-core.js'

test('normalizes movement speed to the persisted 0-100 range', () => {
  assert.equal(normalizeDynamicMoveSpeed(undefined), 50)
  assert.equal(normalizeDynamicMoveSpeed(null), 50)
  assert.equal(normalizeDynamicMoveSpeed(-10), 0)
  assert.equal(normalizeDynamicMoveSpeed(125), 100)
  assert.equal(normalizeDynamicMoveSpeed(Number.NaN), 50)
})

test('applies the requested slowdown curve only below 50 percent', () => {
  assert.equal(getDynamicMoveSpeedSlowdownFactor(0), 2.5)
  assert.equal(getDynamicMoveSpeedSlowdownFactor(25), 1.375)
  assert.equal(getDynamicMoveSpeedSlowdownFactor(50), 1)
  assert.equal(getDynamicMoveSpeedSlowdownFactor(75), 1)
  assert.equal(getDynamicMoveSpeedSlowdownFactor(100), 1)
})

test('preserves legacy duration at 50 percent and above', () => {
  const baseSeconds = 5.5
  assert.equal(getDynamicMoveDurationSeconds(50, baseSeconds), 5.5275)
  assert.equal(getDynamicMoveDurationSeconds(75, baseSeconds), 4.02875)
  assert.equal(getDynamicMoveDurationSeconds(100, baseSeconds), 2.53)
})

test('extends the low-speed duration without changing the legacy curve', () => {
  const baseSeconds = 5.5
  assert.equal(getDynamicMoveDurationSeconds(0, baseSeconds), 21.162625000000006)
  assert.equal(getDynamicMoveDurationSeconds(25, baseSeconds), 9.661093750000001)
  assert.ok(getDynamicMoveDurationSeconds(0, baseSeconds) > getDynamicMoveDurationSeconds(25, baseSeconds))
  assert.ok(getDynamicMoveDurationSeconds(25, baseSeconds) > getDynamicMoveDurationSeconds(50, baseSeconds))
})

test('iPad and EXE movement paths use the shared duration helper', async () => {
  const [controlSource, playerSource, targetSource] = await Promise.all([
    readFile(new URL('../../src/components/DynamicControlPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./player.js', import.meta.url), 'utf8'),
    readFile(new URL('./target-motion-core.js', import.meta.url), 'utf8')
  ])

  assert.match(controlSource, /dynamic-speed-core\.js/)
  assert.match(controlSource, /getDynamicMoveDurationSeconds/)
  assert.match(playerSource, /dynamic-speed-core\.js/)
  assert.match(playerSource, /return getDynamicMoveDurationSeconds\(speed, baseSeconds\)/)
  assert.match(targetSource, /dynamic-speed-core\.js/)
  assert.match(targetSource, /getDynamicMoveDurationSeconds\(moveSpeed, safeBaseSeconds\)/)
})
