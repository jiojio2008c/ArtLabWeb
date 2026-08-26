const assert = require('node:assert/strict')
const test = require('node:test')
const {
  isSameGroupStateRevision,
  shouldApplyGroupStateRevision,
  shouldApplyGroupUploadSideEffect,
  shouldApplySelectionRevision
} = require('./group-state-revision-core.cjs')

test('group state revisions reject stale full-state payloads', () => {
  assert.equal(shouldApplyGroupStateRevision(200, 199), false)
  assert.equal(shouldApplyGroupStateRevision(200, 200), false)
  assert.equal(shouldApplyGroupStateRevision(200, 201), true)
  assert.equal(isSameGroupStateRevision(200, 200), true)
})

test('a delete tombstone rejects stale recreation but permits a newer state', () => {
  const deletedRevision = 200
  assert.equal(shouldApplyGroupStateRevision(deletedRevision, 199), false)
  assert.equal(shouldApplyGroupStateRevision(deletedRevision, undefined), false)
  assert.equal(shouldApplyGroupStateRevision(deletedRevision, 201), true)
})

test('legacy payloads without revisions remain compatible', () => {
  assert.equal(shouldApplyGroupStateRevision(200, undefined), false)
  assert.equal(shouldApplyGroupStateRevision(undefined, 200), true)
  assert.equal(shouldApplyGroupStateRevision(undefined, undefined), true)
})

test('selection revisions reject delayed group activation', () => {
  assert.equal(shouldApplySelectionRevision(500, 499), false)
  assert.equal(shouldApplySelectionRevision(500, 500), false)
  assert.equal(shouldApplySelectionRevision(500, 501), true)
  assert.equal(shouldApplySelectionRevision(undefined, undefined), true)
  assert.equal(shouldApplySelectionRevision(500, undefined), false)
})

test('uploads at the pending full-state revision may finish in any order', () => {
  assert.equal(shouldApplyGroupUploadSideEffect(200, 199), false)
  assert.equal(shouldApplyGroupUploadSideEffect(200, 200), true)
  assert.equal(shouldApplyGroupUploadSideEffect(200, 201), true)
  assert.equal(shouldApplyGroupUploadSideEffect(200, undefined), false)
  assert.equal(shouldApplyGroupUploadSideEffect(undefined, undefined), true)
})
