import assert from 'node:assert/strict'

import {
  BACKGROUND_TRANSITION_SOUND_DURATION_MS,
  createBackgroundTransitionAudio
} from '../renderer/background-transition-audio.js'

const createAudioParam = () => ({
  value: 0,
  setValueAtTime(value) {
    this.value = value
  },
  linearRampToValueAtTime(value) {
    this.value = value
  },
  exponentialRampToValueAtTime(value) {
    this.value = value
  }
})

const createNode = () => ({
  connect() {},
  disconnect() {}
})

const createSource = (sources) => {
  const listeners = new Map()
  const source = {
    ...createNode(),
    startCalls: 0,
    stopCalls: 0,
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    start() {
      this.startCalls += 1
    },
    stop() {
      this.stopCalls += 1
    }
  }
  sources.push(source)
  return source
}

const createMockContext = ({ suspended = false } = {}) => {
  const sources = []
  const resumeResolvers = []
  const context = {
    state: suspended ? 'suspended' : 'running',
    currentTime: 2,
    sampleRate: 8000,
    destination: createNode(),
    sources,
    resumeResolvers,
    createDynamicsCompressor() {
      return {
        ...createNode(),
        threshold: createAudioParam(),
        knee: createAudioParam(),
        ratio: createAudioParam(),
        attack: createAudioParam(),
        release: createAudioParam()
      }
    },
    createGain() {
      return { ...createNode(), gain: createAudioParam() }
    },
    createBuffer(_channels, sampleCount) {
      const samples = new Float32Array(sampleCount)
      return { getChannelData: () => samples }
    },
    createBufferSource() {
      return createSource(sources)
    },
    createBiquadFilter() {
      return {
        ...createNode(),
        frequency: createAudioParam(),
        Q: createAudioParam()
      }
    },
    createStereoPanner() {
      return { ...createNode(), pan: createAudioParam() }
    },
    createOscillator() {
      const oscillator = createSource(sources)
      oscillator.frequency = createAudioParam()
      return oscillator
    },
    resume() {
      return new Promise((resolve) => {
        resumeResolvers.push(() => {
          context.state = 'running'
          resolve()
        })
      })
    }
  }
  return context
}

const expectedDurations = {
  cameraFlash: 240,
  curtain: 1200,
  shadowPlay: 1400
}

assert.deepEqual(BACKGROUND_TRANSITION_SOUND_DURATION_MS, expectedDurations)

for (const [kind, duration] of Object.entries(expectedDurations)) {
  const context = createMockContext()
  const audio = createBackgroundTransitionAudio(() => context)
  assert.equal(audio.getDuration(kind), duration)
  assert.equal(audio.play(kind), duration)
  assert.ok(context.sources.length >= 4, `${kind} should create a layered transition sound`)
  assert.ok(context.sources.every((source) => source.startCalls === 1), `${kind} should start every source`)

  const scheduledStopCalls = context.sources.reduce((total, source) => total + source.stopCalls, 0)
  audio.stop()
  const stoppedCalls = context.sources.reduce((total, source) => total + source.stopCalls, 0)
  assert.equal(stoppedCalls, scheduledStopCalls + context.sources.length)
}

const suspendedContext = createMockContext({ suspended: true })
const suspendedAudio = createBackgroundTransitionAudio(() => suspendedContext)
suspendedAudio.play('curtain')
suspendedAudio.stop()
assert.equal(suspendedContext.resumeResolvers.length, 1)
suspendedContext.resumeResolvers[0]()
await Promise.resolve()
assert.equal(suspendedContext.sources.length, 0, 'stopped pending audio must not start after resume')

console.log('Background transition audio verification passed.')
