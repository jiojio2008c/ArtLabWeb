import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const servicePath = new URL('../src/services/artworkLaunchAudio.ts', import.meta.url)
const audioPath = new URL('../466.mp3', import.meta.url)
const [source, audioBytes] = await Promise.all([
  readFile(servicePath, 'utf8'),
  readFile(audioPath)
])

assert.ok(audioBytes.byteLength > 0, '466.mp3 must be present and non-empty')
assert.match(
  source,
  /new URL\('\.\.\/\.\.\/466\.mp3', import\.meta\.url\)\.href/,
  'The upload launch sound must resolve 466.mp3 through Vite'
)
assert.match(
  source,
  /const DEFAULT_ARTWORK_LAUNCH_VOLUME = 1\.3/,
  'The upload launch sound must default to a 1.3 gain'
)
assert.match(
  source,
  /master\.gain\.setValueAtTime\(normalizedVolume, now\)/,
  'The 1.3 level must be applied through a Web Audio GainNode'
)
assert.match(
  source,
  /element\.volume = clamp\(normalizedVolume, 0, 1\)/,
  'The HTMLAudioElement fallback must stay within the standard 0-1 range'
)
assert.doesNotMatch(source, /createOscillator|scheduleTone|scheduleAirLift/, 'The old synthesized launch sound must be removed')

console.log('Artwork launch audio checks passed.')
