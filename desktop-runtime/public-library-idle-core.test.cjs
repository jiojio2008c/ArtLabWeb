const assert = require('node:assert/strict')
const test = require('node:test')

const {
  IPAD_CONTROL_IDLE_MS,
  shouldReturnFromIpadControl
} = require('./public-library-idle-core.cjs')

test('iPad control returns to the public library after five idle minutes', () => {
  assert.equal(IPAD_CONTROL_IDLE_MS, 5 * 60 * 1000)
  assert.equal(shouldReturnFromIpadControl('ipad', 1_000, 1_000 + IPAD_CONTROL_IDLE_MS), true)
  assert.equal(shouldReturnFromIpadControl('ipad', 1_000, 1_000 + IPAD_CONTROL_IDLE_MS - 1), false)
  assert.equal(shouldReturnFromIpadControl('local', 1_000, 1_000 + IPAD_CONTROL_IDLE_MS), false)
  assert.equal(shouldReturnFromIpadControl('ipad', 0, 1_000 + IPAD_CONTROL_IDLE_MS), false)
})
