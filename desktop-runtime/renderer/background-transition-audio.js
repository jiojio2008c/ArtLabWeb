export const BACKGROUND_TRANSITION_SOUND_DURATION_MS = Object.freeze({
  curtain: 1200,
  cameraFlash: 240,
  shadowPlay: 1400
})

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const createBackgroundTransitionAudio = (getContext) => {
  let outputContext = null
  let output = null
  let playbackEpoch = 0
  let muted = false
  const activeSources = new Set()

  const getOutput = (context) => {
    if (output && outputContext === context) return output

    const compressor = context.createDynamicsCompressor()
    const master = context.createGain()
    compressor.threshold.value = -14
    compressor.knee.value = 8
    compressor.ratio.value = 8
    compressor.attack.value = 0.003
    compressor.release.value = 0.16
    master.gain.value = 0.9
    compressor.connect(master)
    master.connect(context.destination)
    outputContext = context
    output = compressor
    return compressor
  }

  const registerSource = (source, voiceNodes) => {
    activeSources.add(source)
    source.addEventListener('ended', () => {
      activeSources.delete(source)
      voiceNodes.forEach((node) => {
        try {
          node.disconnect()
        } catch {
          // A stopped transition may already have disconnected its voice graph.
        }
      })
    }, { once: true })
  }

  const stop = () => {
    playbackEpoch += 1
    activeSources.forEach((source) => {
      try {
        source.stop()
      } catch {
        // Sources that ended naturally are already silent.
      }
    })
    activeSources.clear()
  }

  const scheduleNoise = (context, destination, options) => {
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * options.duration))
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
    const samples = buffer.getChannelData(0)
    const smoothing = clamp(options.smoothing ?? 0.35, 0, 0.96)
    let coloredSample = 0

    for (let index = 0; index < sampleCount; index += 1) {
      const whiteSample = Math.random() * 2 - 1
      coloredSample = coloredSample * smoothing + whiteSample * (1 - smoothing)
      samples[index] = coloredSample
    }

    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    const panner = typeof context.createStereoPanner === 'function'
      ? context.createStereoPanner()
      : null
    const start = options.start
    const end = start + options.duration
    const attack = Math.min(0.045, options.duration * 0.18)

    source.buffer = buffer
    filter.type = options.filterType ?? 'bandpass'
    filter.frequency.setValueAtTime(Math.max(40, options.frequencyFrom), start)
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, options.frequencyTo), end)
    filter.Q.setValueAtTime(options.resonance ?? 0.7, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.linearRampToValueAtTime(options.peak, start + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)

    source.connect(filter)
    filter.connect(gain)
    if (panner) {
      panner.pan.setValueAtTime(options.panFrom ?? 0, start)
      panner.pan.linearRampToValueAtTime(options.panTo ?? options.panFrom ?? 0, end)
      gain.connect(panner)
      panner.connect(destination)
    } else {
      gain.connect(destination)
    }

    registerSource(source, [source, filter, gain, ...(panner ? [panner] : [])])
    source.start(start)
    source.stop(end + 0.01)
  }

  const scheduleTone = (context, destination, options) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const panner = typeof context.createStereoPanner === 'function'
      ? context.createStereoPanner()
      : null
    const start = options.start
    const end = start + options.duration

    oscillator.type = options.type ?? 'triangle'
    oscillator.frequency.setValueAtTime(Math.max(40, options.frequencyFrom), start)
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(40, options.frequencyTo ?? options.frequencyFrom),
      end
    )
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(options.peak, start + Math.min(0.008, options.duration * 0.2))
    gain.gain.exponentialRampToValueAtTime(0.0001, end)

    oscillator.connect(gain)
    if (panner) {
      panner.pan.setValueAtTime(options.pan ?? 0, start)
      gain.connect(panner)
      panner.connect(destination)
    } else {
      gain.connect(destination)
    }

    registerSource(oscillator, [oscillator, gain, ...(panner ? [panner] : [])])
    oscillator.start(start)
    oscillator.stop(end + 0.01)
  }

  const scheduleCameraFlash = (context, destination, now) => {
    scheduleNoise(context, destination, {
      start: now,
      duration: 0.07,
      peak: 0.52,
      frequencyFrom: 2800,
      frequencyTo: 920,
      smoothing: 0.08,
      resonance: 0.9
    })
    scheduleNoise(context, destination, {
      start: now + 0.055,
      duration: 0.14,
      peak: 0.38,
      frequencyFrom: 1450,
      frequencyTo: 430,
      smoothing: 0.24,
      resonance: 0.72
    })
    scheduleTone(context, destination, {
      start: now + 0.048,
      duration: 0.14,
      peak: 0.26,
      frequencyFrom: 145,
      frequencyTo: 74,
      type: 'triangle'
    })
    scheduleTone(context, destination, {
      start: now,
      duration: 0.035,
      peak: 0.14,
      frequencyFrom: 2900,
      frequencyTo: 1250,
      type: 'square'
    })
  }

  const scheduleCurtain = (context, destination, now) => {
    for (const pan of [-1, 1]) {
      scheduleNoise(context, destination, {
        start: now,
        duration: 0.5,
        peak: 0.26,
        frequencyFrom: 2300,
        frequencyTo: 560,
        smoothing: 0.72,
        panFrom: pan * 0.92,
        panTo: pan * 0.08,
        filterType: 'lowpass',
        resonance: 0.5
      })
    }
    scheduleTone(context, destination, {
      start: now + 0.46,
      duration: 0.17,
      peak: 0.24,
      frequencyFrom: 112,
      frequencyTo: 62,
      type: 'sine'
    })
    scheduleTone(context, destination, {
      start: now + 0.5,
      duration: 0.12,
      peak: 0.11,
      frequencyFrom: 470,
      frequencyTo: 330,
      type: 'triangle'
    })
    for (const pan of [-1, 1]) {
      scheduleNoise(context, destination, {
        start: now + 0.58,
        duration: 0.59,
        peak: 0.22,
        frequencyFrom: 620,
        frequencyTo: 2550,
        smoothing: 0.68,
        panFrom: pan * 0.08,
        panTo: pan * 0.94,
        filterType: 'lowpass',
        resonance: 0.48
      })
    }
  }

  const scheduleShadowPlay = (context, destination, now) => {
    scheduleNoise(context, destination, {
      start: now,
      duration: 0.65,
      peak: 0.24,
      frequencyFrom: 980,
      frequencyTo: 310,
      smoothing: 0.84,
      panFrom: -0.9,
      panTo: 0.72,
      filterType: 'lowpass',
      resonance: 0.42
    })
    scheduleTone(context, destination, {
      start: now + 0.015,
      duration: 0.075,
      peak: 0.2,
      frequencyFrom: 320,
      frequencyTo: 185,
      type: 'triangle',
      pan: -0.72
    })
    scheduleTone(context, destination, {
      start: now + 0.045,
      duration: 0.065,
      peak: 0.14,
      frequencyFrom: 510,
      frequencyTo: 280,
      type: 'sine',
      pan: -0.68
    })
    scheduleTone(context, destination, {
      start: now + 0.61,
      duration: 0.11,
      peak: 0.22,
      frequencyFrom: 275,
      frequencyTo: 142,
      type: 'triangle',
      pan: 0.68
    })
    scheduleNoise(context, destination, {
      start: now + 0.69,
      duration: 0.68,
      peak: 0.21,
      frequencyFrom: 340,
      frequencyTo: 1180,
      smoothing: 0.82,
      panFrom: 0.78,
      panTo: -0.82,
      filterType: 'lowpass',
      resonance: 0.44
    })
    scheduleTone(context, destination, {
      start: now + 1.31,
      duration: 0.075,
      peak: 0.19,
      frequencyFrom: 290,
      frequencyTo: 155,
      type: 'triangle',
      pan: -0.7
    })
  }

  const schedule = (context, kind) => {
    const destination = getOutput(context)
    const now = context.currentTime + 0.012
    if (kind === 'cameraFlash') {
      scheduleCameraFlash(context, destination, now)
    } else if (kind === 'curtain') {
      scheduleCurtain(context, destination, now)
    } else {
      scheduleShadowPlay(context, destination, now)
    }
  }

  const play = (kind) => {
    const durationMs = BACKGROUND_TRANSITION_SOUND_DURATION_MS[kind] ?? 0
    if (!durationMs) return 0
    if (muted) return durationMs

    try {
      const context = getContext()
      if (!context) return durationMs

      stop()
      const currentEpoch = playbackEpoch
      const start = () => {
        if (currentEpoch !== playbackEpoch) return
        schedule(context, kind)
      }
      if (context.state === 'suspended') {
        context.resume().then(start).catch(() => {})
      } else {
        start()
      }
    } catch {
      // Transition visuals remain functional when WebAudio is unavailable.
    }
    return durationMs
  }

  const setMuted = (nextMuted) => {
    const shouldMute = Boolean(nextMuted)
    if (muted === shouldMute) return

    muted = shouldMute
    if (muted) stop()
  }

  return {
    play,
    stop,
    setMuted,
    getDuration: (kind) => BACKGROUND_TRANSITION_SOUND_DURATION_MS[kind] ?? 0
  }
}
