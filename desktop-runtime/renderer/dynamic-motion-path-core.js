const MAX_MOTION_PATH_POINTS = 64
const MOTION_PATH_VERSION = 1

const finite = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y)

const normalizePoint = (point) => ({
  x: finite(point?.x),
  y: finite(point?.y)
})

const normalizeMotionPath = (path) => {
  if (!path || Number(path.version) !== MOTION_PATH_VERSION || !Array.isArray(path.points)) return undefined
  const points = path.points.map(normalizePoint)
  if (points.length < 2) return undefined
  points[0] = { x: 0, y: 0 }
  const unique = [points[0]]
  for (const point of points.slice(1)) {
    if (distance(point, unique[unique.length - 1]) > 1e-6) unique.push(point)
  }
  if (unique.length < 2) return undefined
  const limited = unique.length <= MAX_MOTION_PATH_POINTS
    ? unique
    : Array.from({ length: MAX_MOTION_PATH_POINTS }, (_, index) => (
      unique[Math.round(index * (unique.length - 1) / (MAX_MOTION_PATH_POINTS - 1))]
    ))
  return { version: MOTION_PATH_VERSION, points: limited }
}

const perpendicularDistance = (point, start, end) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return distance(point, start)
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / Math.hypot(dx, dy)
}

const simplifyRdp = (points, tolerance) => {
  if (points.length <= 2) return points.slice()
  let splitIndex = -1
  let splitDistance = tolerance
  for (let index = 1; index < points.length - 1; index += 1) {
    const candidate = perpendicularDistance(points[index], points[0], points[points.length - 1])
    if (candidate > splitDistance) {
      splitDistance = candidate
      splitIndex = index
    }
  }
  if (splitIndex < 0) return [points[0], points[points.length - 1]]
  return simplifyRdp(points.slice(0, splitIndex + 1), tolerance).slice(0, -1)
    .concat(simplifyRdp(points.slice(splitIndex), tolerance))
}

const smoothPoints = (points, radius = 1) => {
  if (radius <= 0 || points.length < 3) return points.slice()
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return point
    const start = Math.max(0, index - radius)
    const end = Math.min(points.length - 1, index + radius)
    const window = points.slice(start, end + 1)
    return {
      x: window.reduce((sum, value) => sum + value.x, 0) / window.length,
      y: window.reduce((sum, value) => sum + value.y, 0) / window.length
    }
  })
}

const optimizeMotionPath = (points, { tolerance = 0.005, smoothing = 1, debounceDistance = 0.001 } = {}) => {
  const source = Array.isArray(points) ? points.map(normalizePoint) : []
  if (source.length < 2) return undefined
  source[0] = { x: 0, y: 0 }
  const debounced = [source[0]]
  for (const point of source.slice(1)) {
    if (distance(point, debounced[debounced.length - 1]) >= Math.max(0, finite(debounceDistance, 0.001))) {
      debounced.push(point)
    }
  }
  if (distance(debounced.at(-1), source.at(-1)) > 1e-6) debounced.push(source.at(-1))
  const simplified = simplifyRdp(debounced, Math.max(0, finite(tolerance, 0.005)))
  const smoothed = smoothPoints(simplified, Math.max(0, Math.floor(finite(smoothing, 1))))
  return normalizeMotionPath({ version: MOTION_PATH_VERSION, points: smoothed })
}

const getPathMetrics = (path) => {
  const normalized = normalizeMotionPath(path)
  if (!normalized) return undefined
  const cumulative = [0]
  for (let index = 1; index < normalized.points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distance(normalized.points[index - 1], normalized.points[index]))
  }
  const length = cumulative[cumulative.length - 1]
  return { path: normalized, cumulative, length }
}

const sampleMotionPath = (path, progress) => {
  const metrics = getPathMetrics(path)
  if (!metrics || metrics.length <= 1e-9) return { x: 0, y: 0 }
  const ratio = Math.min(1, Math.max(0, finite(progress)))
  const target = metrics.length * ratio
  let index = 1
  while (index < metrics.cumulative.length && metrics.cumulative[index] < target) index += 1
  if (index >= metrics.cumulative.length) return metrics.path.points.at(-1)
  const start = metrics.path.points[index - 1]
  const end = metrics.path.points[index]
  const segment = metrics.cumulative[index] - metrics.cumulative[index - 1]
  const local = segment > 0 ? (target - metrics.cumulative[index - 1]) / segment : 0
  return { x: start.x + (end.x - start.x) * local, y: start.y + (end.y - start.y) * local }
}

export {
  MAX_MOTION_PATH_POINTS,
  MOTION_PATH_VERSION,
  normalizeMotionPath,
  optimizeMotionPath,
  getPathMetrics,
  sampleMotionPath
}
