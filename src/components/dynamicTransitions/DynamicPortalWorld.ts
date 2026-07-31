import * as THREE from 'three'
import { portalFragmentShader, portalVertexShader } from './portalShaders.ts'
import type { DynamicTransitionOrigin } from './types.ts'

interface FragmentRecord {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  base: THREE.Vector3
  burst: THREE.Vector3
  spin: THREE.Vector3
  baseScale: number
}

interface StreamData {
  geometry: THREE.BufferGeometry
  basePositions: Float32Array
  seeds: Float32Array
}

export interface DynamicPortalWorld {
  state: { progress: number }
  destroy: () => void
}

const COLORS = [0x27e2ff, 0x9762ff, 0xff4eb8, 0xf8e45e, 0x5df299, 0xffffff]
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const range = (value: number, start: number, end: number) => clamp01((value - start) / (end - start))
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3)
const easeInOutCubic = (value: number) => value < 0.5
  ? 4 * value * value * value
  : 1 - Math.pow(-2 * value + 2, 3) / 2

const createLine = (points: THREE.Vector3[], color: number) => {
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  return new THREE.LineSegments(geometry, material)
}

const createLaptop = () => {
  const group = new THREE.Group()
  group.add(createLine([
    new THREE.Vector3(-0.66, -0.12, 0.52), new THREE.Vector3(-0.58, 0.62, 0.52),
    new THREE.Vector3(-0.58, 0.62, 0.52), new THREE.Vector3(0.58, 0.62, 0.52),
    new THREE.Vector3(0.58, 0.62, 0.52), new THREE.Vector3(0.66, -0.12, 0.52),
    new THREE.Vector3(0.66, -0.12, 0.52), new THREE.Vector3(-0.66, -0.12, 0.52),
    new THREE.Vector3(-0.48, 0.48, 0.525), new THREE.Vector3(0.48, 0.48, 0.525),
    new THREE.Vector3(0.48, 0.48, 0.525), new THREE.Vector3(0.52, 0.02, 0.525),
    new THREE.Vector3(0.52, 0.02, 0.525), new THREE.Vector3(-0.52, 0.02, 0.525),
    new THREE.Vector3(-0.52, 0.02, 0.525), new THREE.Vector3(-0.48, 0.48, 0.525)
  ], 0x8fefff))
  group.add(createLine([
    new THREE.Vector3(-0.66, -0.12, 0.52), new THREE.Vector3(-0.88, -0.52, 0.36),
    new THREE.Vector3(-0.88, -0.52, 0.36), new THREE.Vector3(0.88, -0.52, 0.36),
    new THREE.Vector3(0.88, -0.52, 0.36), new THREE.Vector3(0.66, -0.12, 0.52),
    new THREE.Vector3(-0.54, -0.23, 0.48), new THREE.Vector3(0.54, -0.23, 0.48),
    new THREE.Vector3(-0.32, -0.34, 0.43), new THREE.Vector3(0.32, -0.34, 0.43),
    new THREE.Vector3(-0.24, -0.42, 0.39), new THREE.Vector3(0.24, -0.42, 0.39)
  ], 0xbc7cff))
  group.add(createLine([
    new THREE.Vector3(0, 0.4, 0.54), new THREE.Vector3(0.26, 0.24, 0.54),
    new THREE.Vector3(0.26, 0.24, 0.54), new THREE.Vector3(0, 0.08, 0.54),
    new THREE.Vector3(0, 0.08, 0.54), new THREE.Vector3(-0.26, 0.24, 0.54),
    new THREE.Vector3(-0.26, 0.24, 0.54), new THREE.Vector3(0, 0.4, 0.54),
    new THREE.Vector3(-0.26, 0.24, 0.54), new THREE.Vector3(0.26, 0.24, 0.54)
  ], 0xffffff))
  return group
}

const createParticleStream = (count: number): { points: THREE.Points; data: StreamData } => {
  const positions = new Float32Array(count * 3)
  const basePositions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const seeds = new Float32Array(count)

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3
    const side = Math.random() > 0.5 ? 1 : -1
    const x = side * (0.25 + Math.random() * 5.4)
    const y = (Math.random() - 0.5) * 6.2
    const z = -4 + Math.random() * 9
    basePositions.set([x, y, z], offset)
    positions.set([x, y, z], offset)
    seeds[index] = Math.random()
    const color = new THREE.Color(COLORS[index % COLORS.length])
    colors.set([color.r, color.g, color.b], offset)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const material = new THREE.PointsMaterial({
    size: 0.045,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  })
  return { points: new THREE.Points(geometry, material), data: { geometry, basePositions, seeds } }
}

const createTrails = () => {
  const group = new THREE.Group()
  const materials: THREE.MeshBasicMaterial[] = []

  for (const side of [-1, 1]) {
    COLORS.forEach((color, index) => {
      const verticalOffset = (index - 2.5) * 0.14
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.18, verticalOffset * 0.3, -0.15),
        new THREE.Vector3(side * 1.1, verticalOffset + Math.sin(index) * 0.15, -0.2),
        new THREE.Vector3(side * 2.5, verticalOffset * 1.55 + Math.cos(index) * 0.25, -0.55),
        new THREE.Vector3(side * 5.2, verticalOffset * 2.4, -1.1)
      ])
      const geometry = new THREE.TubeGeometry(curve, 40, 0.012 + index * 0.0018, 5, false)
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
      materials.push(material)
      group.add(new THREE.Mesh(geometry, material))
    })
  }

  return { group, materials }
}

const createFragments = () => {
  const records: FragmentRecord[] = []
  const group = new THREE.Group()
  const fragmentColors = [0x5cdf8d, 0xa4ef53, 0x9bb7bd, 0x39dbe8, 0xad74ff, 0xff6eb3]

  for (let index = 0; index < 72; index += 1) {
    const width = 0.08 + Math.random() * 0.26
    const height = 0.08 + Math.random() * 0.3
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -width, -height, 0,
      width, -height * 0.35, 0,
      (Math.random() - 0.5) * width, height, 0
    ], 3))
    const material = new THREE.MeshBasicMaterial({
      color: fragmentColors[index % fragmentColors.length],
      transparent: true,
      opacity: 0,
      wireframe: index % 3 === 0,
      side: THREE.DoubleSide,
      blending: index % 3 === 0 ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false
    })
    const mesh = new THREE.Mesh(geometry, material)
    const side = Math.random() > 0.5 ? 1 : -1
    const base = new THREE.Vector3(
      side * (1.5 + Math.random() * 3.7),
      -1.1 - Math.random() * 2.5,
      -1.4 + Math.random() * 2.6
    )
    const burst = new THREE.Vector3(
      side * (0.7 + Math.random() * 2.6),
      -0.4 + Math.random() * 2.1,
      0.8 + Math.random() * 3.8
    )
    const spin = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 7
    )
    mesh.position.copy(base)
    group.add(mesh)
    records.push({ mesh, base, burst, spin, baseScale: 0.55 + Math.random() * 1.1 })
  }

  return { group, records }
}

const createWireLandscape = () => {
  const group = new THREE.Group()
  const materials: THREE.MeshBasicMaterial[] = []
  const makeMaterial = (color: number) => {
    const material = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    materials.push(material)
    return material
  }

  const mountainMaterial = makeMaterial(0x8cf5c8)
  ;[
    { x: 3.5, y: -1.9, scale: 1.15 },
    { x: 4.55, y: -2.35, scale: 0.72 },
    { x: 2.65, y: -2.55, scale: 0.58 }
  ].forEach(({ x, y, scale }) => {
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(scale, scale * 2, 7, 4), mountainMaterial)
    mountain.position.set(x, y, -0.8)
    group.add(mountain)
  })

  const treeMaterial = makeMaterial(0x7cff87)
  for (let index = 0; index < 5; index += 1) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 + index * 0.035, 1), treeMaterial)
    crown.position.set(-4.6 + index * 0.74, -2.25 + Math.sin(index) * 0.12, -1)
    group.add(crown)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.75, 5), treeMaterial)
    trunk.position.set(crown.position.x, crown.position.y - 0.58, -1)
    group.add(trunk)
  }

  return { group, materials }
}

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    mesh.geometry?.dispose()
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(material)) material.forEach((item) => item.dispose())
    else material?.dispose()
  })
}

export const createDynamicPortalWorld = (
  canvas: HTMLCanvasElement,
  origin: DynamicTransitionOrigin
): DynamicPortalWorld => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x07152f, 0.055)
  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 80)
  camera.position.set(0, 0, 8)

  const portalGroup = new THREE.Group()
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uOpacity: { value: 0 }
    },
    vertexShader: portalVertexShader,
    fragmentShader: portalFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  })
  portalGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(3.3, 3.75), glowMaterial))

  const edgesGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.32, 2.64, 0.76))
  const cyanEdges = new THREE.LineSegments(edgesGeometry, new THREE.LineBasicMaterial({
    color: 0x65edff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending
  }))
  const violetEdges = new THREE.LineSegments(edgesGeometry.clone(), new THREE.LineBasicMaterial({
    color: 0xa344ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending
  }))
  violetEdges.scale.setScalar(1.045)
  portalGroup.add(cyanEdges, violetEdges)
  const laptop = createLaptop()
  portalGroup.add(laptop)
  scene.add(portalGroup)

  const particleCount = window.innerWidth >= 1100 ? 620 : 420
  const { points: particles, data: particleData } = createParticleStream(particleCount)
  scene.add(particles)
  const particleMaterial = particles.material as THREE.PointsMaterial
  const { group: trails, materials: trailMaterials } = createTrails()
  const { group: fragments, records: fragmentRecords } = createFragments()
  const { group: wireLandscape, materials: wireMaterials } = createWireLandscape()
  scene.add(trails, fragments, wireLandscape)

  const state = { progress: 0 }
  const clock = new THREE.Clock()
  let frameId = 0
  let originPosition = new THREE.Vector3()
  let originScale = 1

  const screenToWorld = (screenX: number, screenY: number) => {
    const vector = new THREE.Vector3(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1,
      0.5
    )
    vector.unproject(camera)
    const direction = vector.sub(camera.position).normalize()
    const distance = -camera.position.z / direction.z
    return camera.position.clone().add(direction.multiplyScalar(distance))
  }

  const updateOrigin = () => {
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
    const center = screenToWorld(origin.left + origin.width / 2, origin.top + origin.height / 2)
    const left = screenToWorld(origin.left, origin.top + origin.height / 2)
    const right = screenToWorld(origin.left + origin.width, origin.top + origin.height / 2)
    originPosition = center
    originScale = left.distanceTo(right) / 2.32
  }
  updateOrigin()

  const resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    updateOrigin()
  }
  window.addEventListener('resize', resize)

  const render = () => {
    const elapsed = clock.getElapsedTime()
    const progress = state.progress
    const activation = easeOutCubic(range(progress, 0, 0.2))
    const travel = easeInOutCubic(range(progress, 0.16, 0.62))
    const penetration = easeInOutCubic(range(progress, 0.58, 0.92))
    const visibility = 1 - range(progress, 0.86, 1)

    portalGroup.position.lerpVectors(originPosition, new THREE.Vector3(0, 0, 0), travel)
    const portalScale = THREE.MathUtils.lerp(originScale * (1 + Math.sin(elapsed * 9) * 0.025 * activation), 1.48, travel)
    portalGroup.scale.setScalar(portalScale * THREE.MathUtils.lerp(1, 4.25, penetration))
    portalGroup.rotation.set(
      THREE.MathUtils.lerp(-0.03, 0.08, travel) + Math.sin(elapsed * 1.5) * 0.018,
      THREE.MathUtils.lerp(-0.18, 0.02, travel) + Math.sin(elapsed * 1.2) * 0.025,
      Math.sin(elapsed * 1.7) * 0.012 * activation
    )
    camera.position.z = THREE.MathUtils.lerp(8, 3.25, penetration)

    glowMaterial.uniforms.uTime.value = elapsed
    glowMaterial.uniforms.uProgress.value = progress
    glowMaterial.uniforms.uOpacity.value = activation * visibility
    ;(cyanEdges.material as THREE.LineBasicMaterial).opacity = activation * visibility
    ;(violetEdges.material as THREE.LineBasicMaterial).opacity = activation * 0.72 * visibility
    laptop.traverse((child) => {
      const line = child as THREE.LineSegments
      if (line.material) (line.material as THREE.LineBasicMaterial).opacity = activation * visibility
    })

    const streamVisibility = range(progress, 0.14, 0.38) * (1 - range(progress, 0.8, 1))
    particleMaterial.opacity = streamVisibility * 0.88
    const positionAttribute = particleData.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let index = 0; index < particleCount; index += 1) {
      const offset = index * 3
      const seed = particleData.seeds[index]
      const radialPush = 1 + penetration * (1.5 + seed * 1.9)
      positionAttribute.array[offset] = particleData.basePositions[offset] * radialPush
      positionAttribute.array[offset + 1] = particleData.basePositions[offset + 1] * (1 + penetration * 0.72)
      positionAttribute.array[offset + 2] = particleData.basePositions[offset + 2] + ((elapsed * (0.45 + seed) + progress * 6.5) % 9)
    }
    positionAttribute.needsUpdate = true

    const trailVisibility = range(progress, 0.2, 0.46) * (1 - range(progress, 0.78, 0.98))
    trailMaterials.forEach((material, index) => {
      material.opacity = trailVisibility * (0.42 + (index % COLORS.length) * 0.055)
    })
    trails.scale.setScalar(0.55 + easeOutCubic(range(progress, 0.18, 0.7)) * 0.82)

    const fragmentBurst = easeOutCubic(range(progress, 0.2, 0.68))
    const fragmentFade = 1 - range(progress, 0.72, 0.96)
    fragmentRecords.forEach((record, index) => {
      record.mesh.position.copy(record.base).addScaledVector(record.burst, fragmentBurst)
      record.mesh.rotation.set(
        record.spin.x * fragmentBurst,
        record.spin.y * fragmentBurst,
        record.spin.z * fragmentBurst + elapsed * 0.08 * (index % 2 ? 1 : -1)
      )
      record.mesh.scale.setScalar(record.baseScale * (0.35 + fragmentBurst * 0.9))
      record.mesh.material.opacity = range(progress, 0.15, 0.35) * fragmentFade * (record.mesh.material.wireframe ? 0.9 : 0.62)
    })

    const wireVisibility = range(progress, 0.18, 0.42) * (1 - range(progress, 0.7, 0.94))
    wireMaterials.forEach((material) => { material.opacity = wireVisibility * 0.78 })
    wireLandscape.scale.setScalar(1 + penetration * 0.32)

    renderer.render(scene, camera)
    frameId = window.requestAnimationFrame(render)
  }
  render()

  return {
    state,
    destroy: () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      disposeObject(scene)
      renderer.dispose()
    }
  }
}
