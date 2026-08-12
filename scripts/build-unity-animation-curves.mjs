import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = path.join(root, 'ThreeJSPhotoAnimation', 'unity-animation-curves.json')
const outputPath = path.join(root, 'desktop-runtime', 'renderer', 'unity-animation-curves.js')

const selectedProperties = {
  Dance02Anim: ['blendShape.Shapekey01', 'blendShape.Shapekey02'],
  DanceAnim: ['blendShape.Shapekey07', 'blendShape.Shapekey08'],
  JellyJumpAnim: ['blendShape.Shapekey03', 'blendShape.Shapekey04'],
  JumpFlipAnim: [
    'blendShape.Shapekey03',
    'blendShape.Shapekey04',
    'm_LocalPosition.z',
    'm_LocalRotation.w',
    'm_LocalRotation.x',
    'm_LocalRotation.y',
    'm_LocalRotation.z'
  ],
  PullRightAnimation: ['blendShape.Key 19', 'blendShape.Key 21', 'blendShape.Key 22'],
  RaiseHandAnimation: ['blendShape.Key 10', 'blendShape.Key 11'],
  RollingAnimation: [
    'm_LocalPosition.z',
    'm_LocalRotation.w',
    'm_LocalRotation.x',
    'm_LocalRotation.y',
    'm_LocalRotation.z'
  ],
  WaveAnimation: ['blendShape.Key 19', 'blendShape.Key 20']
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'))
const clips = source.clips
  .filter((clip) => selectedProperties[clip.name])
  .map((clip) => ({
    name: clip.name,
    duration: clip.duration,
    loopTime: clip.loopTime,
    curves: clip.curves
      .filter((curve) => selectedProperties[clip.name].includes(curve.property))
      .map((curve) => ({
        property: curve.property,
        keys: curve.keys.map((key) => ({
          time: key.time,
          value: key.value,
          inTangent: key.inTangent,
          outTangent: key.outTangent
        }))
      }))
  }))

const output = [
  '// Generated from ThreeJSPhotoAnimation/unity-animation-curves.json.',
  '// Run `node scripts/build-unity-animation-curves.mjs` after replacing the Unity export.',
  `export const UNITY_ANIMATION_CURVES = ${JSON.stringify(clips, null, 2)}`,
  ''
].join('\n')

await writeFile(outputPath, output, 'utf8')
