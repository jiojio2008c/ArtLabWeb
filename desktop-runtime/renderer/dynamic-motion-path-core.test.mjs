import assert from 'node:assert/strict'
import {
  MAX_MOTION_PATH_POINTS,
  normalizeMotionPath,
  optimizeMotionPath,
  getPathMetrics,
  sampleMotionPath
} from './dynamic-motion-path-core.js'
import { readFileSync } from 'node:fs'

const path = normalizeMotionPath({ version: 1, points: [{ x: 9, y: 9 }, { x: 1, y: 0 }, { x: 1, y: 1 }] })
assert.deepEqual(path.points[0], { x: 0, y: 0 })
assert.deepEqual(sampleMotionPath(path, 0), { x: 0, y: 0 })
assert.deepEqual(sampleMotionPath(path, 1), { x: 1, y: 1 })
assert.deepEqual(sampleMotionPath(path, 0.5), { x: 1, y: 0 })

const metrics = getPathMetrics(path)
assert.equal(metrics.length, 2)
assert.deepEqual(sampleMotionPath(path, 0.75), { x: 1, y: 0.5 })
assert.equal(normalizeMotionPath({ version: 2, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }), undefined)
assert.equal(normalizeMotionPath({ version: 1, points: [{ x: 0, y: 0 }] }), undefined)

const stageSize = { width: 1920, height: 1080 }
const itemOrigin = { x: 0.25, y: 0.75 }
const relativePath = normalizeMotionPath({
  version: 1,
  points: [
    { x: 0, y: 0 },
    { x: 0.25, y: -0.5 }
  ]
})
const getRenderedCenter = (progress) => {
  const offset = sampleMotionPath(relativePath, progress)
  return {
    x: itemOrigin.x * stageSize.width + offset.x * stageSize.width,
    y: itemOrigin.y * stageSize.height + offset.y * stageSize.height
  }
}
assert.deepEqual(getRenderedCenter(0), { x: 480, y: 810 })
assert.deepEqual(getRenderedCenter(1), { x: 960, y: 270 })

const noisy = Array.from({ length: 180 }, (_, index) => ({ x: index / 179, y: Math.sin(index) * 0.001 }))
const optimized = optimizeMotionPath(noisy, { tolerance: 0.0001, smoothing: 1 })
assert.ok(optimized)
assert.ok(optimized.points.length <= MAX_MOTION_PATH_POINTS)
assert.deepEqual(optimized.points[0], { x: 0, y: 0 })

const playerSource = readFileSync(new URL('./player.js', import.meta.url), 'utf8')
assert.match(playerSource, /getMotionPathOffset\(motionPath, targetState\.progress\)/)
assert.match(playerSource, /normalizeMotionPath\(item\.motionPath\)/)
assert.match(playerSource, /const getMotionPathOffset = \(motionPath, progress\) =>/)
assert.match(playerSource, /targetX = pathOffset\.x[\s\S]*?targetY = pathOffset\.y/)
const renderStateSource = playerSource.slice(
  playerSource.indexOf('const getItemRenderState'),
  playerSource.indexOf('const applyItemRenderTransform')
)
assert.match(
  renderStateSource,
  /x: baseX \+ motion\.x \+ animation\.offsetX \+ advanced\.x/
)
console.log('Dynamic motion path normalization, optimization, and arc-length sampling verified.')
