import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  getDesktopTrackSlideOffsetX,
  sampleDesktopEntranceProgress
} from './desktop-appearance-motion-core.js'

const STAGE_WIDTH = 1920
const HALF_ITEM_WIDTH = 142.5
const EDGE_PADDING = 72

const getWorldX = (positionX, entranceProgress) => (
  positionX * STAGE_WIDTH
  + getDesktopTrackSlideOffsetX({
    positionX,
    stageWidth: STAGE_WIDTH,
    halfWidth: HALF_ITEM_WIDTH,
    edgePadding: EDGE_PADDING,
    entranceProgress
  })
)

test('nine-item animation 09 scenario enters from each configured starting side', () => {
  const items = Array.from({ length: 9 }, (_, index) => ({
    animationId: 9,
    positionX: index % 2 === 0 ? 0.9 : 0.1
  }))

  items.forEach((item, index) => {
    const entranceWorldX = getWorldX(item.positionX, 0)
    const configuredWorldX = getWorldX(item.positionX, 1)

    if (index % 2 === 0) {
      assert.ok(
        entranceWorldX > STAGE_WIDTH,
        `Odd-numbered item ${index + 1} must enter from beyond the right edge.`
      )
    } else {
      assert.ok(
        entranceWorldX < 0,
        `Even-numbered item ${index + 1} must enter from beyond the left edge.`
      )
    }

    assert.equal(configuredWorldX, item.positionX * STAGE_WIDTH)
  })
})

test('desktop entrance progress stays complete while an item fades out', () => {
  const schedule = {
    entranceStartMs: 800,
    entranceDurationMs: 560,
    appearanceCompleteMs: 1360,
    hideStartMs: 5000,
    hideCompleteMs: 5420
  }

  assert.equal(sampleDesktopEntranceProgress(schedule, 799, 0), 0)
  assert.equal(sampleDesktopEntranceProgress(schedule, 1080, 0.5), 0.5)
  assert.equal(sampleDesktopEntranceProgress(schedule, 1360, 1), 1)
  assert.equal(
    sampleDesktopEntranceProgress(schedule, 5210, 0.5),
    1,
    'Fade-out alpha must not reverse the completed entrance position.'
  )
  assert.equal(getWorldX(0.1, sampleDesktopEntranceProgress(schedule, 5210, 0.5)), 192)
})

test('desktop player uses position-based slide direction and independent entrance progress', async () => {
  const playerSource = await readFile(new URL('./player.js', import.meta.url), 'utf8')
  const playbackFunction = playerSource.slice(
    playerSource.indexOf('const getAdvancedItemPlaybackState'),
    playerSource.indexOf('const speedToCycleSeconds')
  )
  const trackSlideBranch = playbackFunction.slice(
    playbackFunction.indexOf("} else if (appearAnimation === 'trackSlide')"),
    playbackFunction.indexOf('\n  }\n\n  const targetActive')
  )

  assert.match(playbackFunction, /sampleDesktopEntranceProgress\(/)
  assert.match(trackSlideBranch, /getDesktopTrackSlideOffsetX\(/)
  assert.doesNotMatch(
    trackSlideBranch,
    /getMoveTrack\(item\)/,
    'A vertical movement track must not decide the horizontal entrance side.'
  )
})
