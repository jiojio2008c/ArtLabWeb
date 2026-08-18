import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Keyboard,
  List,
  Monitor,
  Power,
  RadioTower,
  RotateCcw,
  Undo2,
  X,
  type LucideIcon
} from 'lucide-react'
import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from 'react'

type LayoutMode = 'current' | 'reference'
type KeySkin = 'black' | 'red' | 'green' | 'orange' | 'magenta' | 'cyan' | 'white'
type KnobSize = 'small' | 'large'

interface KeyDefinition {
  id: string
  label: string
  skin: KeySkin
  icon?: LucideIcon
  heading?: string
  number?: number
  lines?: readonly string[]
  weight: number
}

interface KnobProps {
  id: string
  label: string
  size: KnobSize
  negative: React.ReactNode
  positive: React.ReactNode
  brand?: boolean
  onActivity: (message: string) => void
}

const KEYS: readonly KeyDefinition[] = [
  { id: 'escape', label: 'Escape', skin: 'black', icon: Undo2, weight: 0.56 },
  { id: 'home', label: 'Home', skin: 'red', icon: Power, weight: 0.64 },
  { id: 'control-shift', label: 'Left Control + Left Shift', skin: 'black', icon: List, weight: 0.58 },
  { id: 'alt-f4', label: 'Left Alt + F4', skin: 'red', icon: X, weight: 0.68 },
  { id: 'space-n', label: 'Space + N', skin: 'green', icon: Monitor, heading: 'On', weight: 0.5 },
  { id: 'space-f', label: 'Space + F', skin: 'red', icon: Monitor, heading: 'Off', weight: 0.54 },
  { id: 'end', label: 'End', skin: 'red', icon: RadioTower, heading: 'Sensor', weight: 0.48 },
  { id: 'page-down', label: 'Page Down', skin: 'red', icon: RotateCcw, weight: 0.62 },
  { id: 'preset-1', label: 'Preset 1', skin: 'orange', number: 1, lines: ['Floor', 'Normal', 'Full'], weight: 0.42 },
  { id: 'preset-2', label: 'Preset 2', skin: 'orange', number: 2, lines: ['Floor', 'Normal', 'Slim'], weight: 0.43 },
  { id: 'preset-3', label: 'Preset 3', skin: 'orange', number: 3, lines: ['Floor', 'Ultra', 'Full'], weight: 0.44 },
  { id: 'preset-4', label: 'Preset 4', skin: 'magenta', number: 4, lines: ['Table', 'Full'], weight: 0.45 },
  { id: 'preset-5', label: 'Preset 5', skin: 'magenta', number: 5, lines: ['Table', 'Slim'], weight: 0.46 },
  { id: 'preset-6', label: 'Preset 6', skin: 'cyan', number: 6, lines: ['Wall', 'Full'], weight: 0.47 },
  { id: 'preset-7', label: 'Preset 7', skin: 'cyan', number: 7, lines: ['Wall', 'Slim'], weight: 0.48 },
  { id: 'preset-8', label: 'Preset 8', skin: 'white', number: 8, lines: ['Customise'], weight: 0.49 }
]

let audioContext: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

const getAudio = () => {
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null

  if (!audioContext) audioContext = new AudioContextClass()
  if (audioContext.state === 'suspended') void audioContext.resume()

  if (!noiseBuffer) {
    const samples = Math.floor(audioContext.sampleRate * 0.09)
    noiseBuffer = audioContext.createBuffer(1, samples, audioContext.sampleRate)
    const channel = noiseBuffer.getChannelData(0)
    for (let index = 0; index < samples; index += 1) channel[index] = Math.random() * 2 - 1
  }

  return { context: audioContext, noise: noiseBuffer }
}

const playTransient = (
  frequency: number,
  duration: number,
  volume: number,
  noiseVolume: number,
  type: OscillatorType = 'triangle'
) => {
  const audio = getAudio()
  if (!audio) return
  const { context, noise } = audio
  const now = context.currentTime
  const output = context.createGain()
  const compressor = context.createDynamicsCompressor()
  const oscillator = context.createOscillator()
  const oscillatorGain = context.createGain()
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const noiseGain = context.createGain()

  compressor.threshold.setValueAtTime(-24, now)
  compressor.ratio.setValueAtTime(7, now)
  output.gain.setValueAtTime(1.45, now)
  output.connect(compressor)
  compressor.connect(context.destination)

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, now)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(42, frequency * 0.58), now + duration)
  oscillatorGain.gain.setValueAtTime(volume, now)
  oscillatorGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  oscillator.connect(oscillatorGain)
  oscillatorGain.connect(output)

  source.buffer = noise
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(2100, now)
  filter.Q.setValueAtTime(0.72, now)
  noiseGain.gain.setValueAtTime(noiseVolume, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(duration, 0.055))
  source.connect(filter)
  filter.connect(noiseGain)
  noiseGain.connect(output)

  oscillator.start(now)
  oscillator.stop(now + duration + 0.01)
  source.start(now)
  source.stop(now + Math.min(duration, 0.065))
}

const playKeyDown = (weight: number) => {
  playTransient(126 - weight * 34, 0.075, 0.17 + weight * 0.08, 0.13 + weight * 0.05, 'square')
}

const playKeyUp = (weight: number) => {
  playTransient(176 - weight * 22, 0.045, 0.1 + weight * 0.03, 0.09, 'triangle')
}

const playKnobTick = (size: KnobSize) => {
  playTransient(size === 'large' ? 112 : 158, 0.043, size === 'large' ? 0.17 : 0.12, 0.11, 'square')
}

const playKnobRelease = (size: KnobSize) => {
  playTransient(size === 'large' ? 86 : 132, 0.06, 0.11, 0.08, 'triangle')
}

const normalizeAngle = (value: number) => {
  let result = value
  while (result > 180) result -= 360
  while (result < -180) result += 360
  return result
}

const getPointerAngle = (element: HTMLElement, clientX: number, clientY: number) => {
  const bounds = element.getBoundingClientRect()
  return Math.atan2(
    clientY - (bounds.top + bounds.height / 2),
    clientX - (bounds.left + bounds.width / 2)
  ) * (180 / Math.PI)
}

const MechanicalKey = ({
  definition,
  onActivity
}: {
  definition: KeyDefinition
  onActivity: (message: string) => void
}) => {
  const [pressed, setPressed] = useState(false)
  const pressedRef = useRef(false)
  const Icon = definition.icon

  const release = (announce: boolean) => {
    if (!pressedRef.current) return
    pressedRef.current = false
    setPressed(false)
    playKeyUp(definition.weight)
    if (announce) onActivity(definition.label)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pressedRef.current = true
    setPressed(true)
    playKeyDown(definition.weight)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const activate = Boolean(element && event.currentTarget.contains(element))
    release(activate)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <button
      type="button"
      className={`kp-key kp-key-${definition.skin} ${pressed ? 'is-pressed' : ''}`}
      aria-label={definition.label}
      title={definition.label}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => release(false)}
      onLostPointerCapture={() => release(false)}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.detail !== 0) return
        playKeyDown(definition.weight)
        window.setTimeout(() => playKeyUp(definition.weight), 52)
        onActivity(definition.label)
      }}
    >
      <span className="kp-key-housing" aria-hidden="true" />
      <span className="kp-key-cap" aria-hidden="true">
        {definition.number ? (
          <span className="kp-key-mode">
            <strong>{definition.number}</strong>
            <span>{definition.lines?.map((line) => <small key={line}>{line}</small>)}</span>
          </span>
        ) : (
          <>
            {definition.heading && <strong className="kp-key-heading">{definition.heading}</strong>}
            {Icon && <Icon />}
          </>
        )}
      </span>
    </button>
  )
}

const RotaryKnob = ({
  id,
  label,
  size,
  negative,
  positive,
  brand = false,
  onActivity
}: KnobProps) => {
  const touchRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; lastAngle: number; carry: number } | null>(null)
  const angleRef = useRef(-18)
  const [angle, setAngle] = useState(-18)
  const [dragging, setDragging] = useState(false)

  const turn = (direction: -1 | 1, steps = 1) => {
    const next = angleRef.current + direction * 15 * steps
    angleRef.current = next
    setAngle(next)
    playKnobTick(size)
    onActivity(`${label} ${direction < 0 ? '−' : '+'}`)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      lastAngle: getPointerAngle(event.currentTarget, event.clientX, event.clientY),
      carry: 0
    }
    setDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const pointerAngle = getPointerAngle(event.currentTarget, event.clientX, event.clientY)
    const delta = normalizeAngle(pointerAngle - drag.lastAngle)
    drag.lastAngle = pointerAngle
    if (Math.abs(delta) > 70) return

    angleRef.current += delta
    setAngle(angleRef.current)
    drag.carry += delta
    const detents = Math.trunc(drag.carry / 15)
    if (detents === 0) return
    drag.carry -= detents * 15
    playKnobTick(size)
    onActivity(`${label} ${detents < 0 ? '−' : '+'}`)
  }

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
    playKnobRelease(size)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    turn(event.deltaY < 0 ? -1 : 1)
    window.setTimeout(() => playKnobRelease(size), 55)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    turn(event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1)
    window.setTimeout(() => playKnobRelease(size), 55)
  }

  return (
    <div className={`kp-knob-control kp-knob-control-${size}`} data-knob={id}>
      <div className="kp-knob-scale" aria-hidden="true">
        <span className="kp-knob-negative">{negative}</span>
        <span className="kp-knob-scale-marks" />
        <span className="kp-knob-positive">{positive}</span>
      </div>
      <div
        ref={touchRef}
        className={`kp-knob-touch kp-knob-${size} ${dragging ? 'is-dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={-180}
        aria-valuemax={180}
        aria-valuenow={Math.round(normalizeAngle(angle))}
        title={label}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={() => {
          if (!dragRef.current) return
          dragRef.current = null
          setDragging(false)
          playKnobRelease(size)
        }}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span
          className="kp-knob-dial"
          style={{ '--kp-knob-angle': `${angle}deg` } as CSSProperties}
          aria-hidden="true"
        >
          <span className="kp-knob-ridges" />
          <span className="kp-knob-metal">
            {brand ? (
              <span className="kp-knob-brand"><small>Magic</small><strong>FLOOR</strong></span>
            ) : (
              <span className="kp-knob-indicator" />
            )}
          </span>
        </span>
      </div>
    </div>
  )
}

const KeyboardControllerPrototype = () => {
  const [layout, setLayout] = useState<LayoutMode>('reference')
  const [lastActivity, setLastActivity] = useState('Ready')

  return (
    <main className="keyboard-prototype-page">
      <header className="keyboard-prototype-header">
        <button
          type="button"
          className="keyboard-prototype-back"
          aria-label="返回转场测试页"
          onClick={() => window.location.assign(window.location.pathname)}
        >
          <ChevronLeft aria-hidden="true" />
          <span>返回</span>
        </button>

        <div className="keyboard-prototype-heading">
          <p><Keyboard aria-hidden="true" /> MagicFloor</p>
          <h1>鍵盤控制</h1>
        </div>

        <div className="keyboard-layout-switch" role="group" aria-label="面板版式">
          <button
            type="button"
            className={layout === 'current' ? 'is-active' : ''}
            aria-pressed={layout === 'current'}
            onClick={() => setLayout('current')}
          >
            當前版
          </button>
          <button
            type="button"
            className={layout === 'reference' ? 'is-active' : ''}
            aria-pressed={layout === 'reference'}
            onClick={() => setLayout('reference')}
          >
            參考圖版
          </button>
        </div>
      </header>

      <section className="keyboard-prototype-workspace">
        <div
          className={`kp-device kp-device-${layout}`}
          data-layout={layout}
          role="group"
          aria-label="MagicFloor 鍵盤控制器"
        >
          <span className="kp-device-rim" aria-hidden="true" />
          <span className="kp-device-screw kp-screw-top-left" aria-hidden="true" />
          <span className="kp-device-screw kp-screw-top-right" aria-hidden="true" />
          <span className="kp-device-screw kp-screw-bottom-left" aria-hidden="true" />
          <span className="kp-device-screw kp-screw-bottom-right" aria-hidden="true" />

          <div className="kp-key-grid">
            {KEYS.map((definition) => (
              <MechanicalKey
                key={definition.id}
                definition={definition}
                onActivity={setLastActivity}
              />
            ))}
          </div>

          <div className="kp-knob-deck">
            <RotaryKnob
              id="volume"
              size="small"
              label="音量"
              negative={<span>−</span>}
              positive={<span>+</span>}
              onActivity={setLastActivity}
            />
            <RotaryKnob
              id="vertical"
              size="small"
              label="上下控制"
              negative={<ChevronUp />}
              positive={<ChevronDown />}
              onActivity={setLastActivity}
            />
            <RotaryKnob
              id="horizontal"
              size="large"
              label="左右控制"
              negative={<ChevronLeft />}
              positive={<ChevronRight />}
              brand
              onActivity={setLastActivity}
            />
          </div>

          <span className="kp-device-engraving" aria-hidden="true">Keyboard Controller</span>
          <output className="kp-device-activity" aria-live="polite">{lastActivity}</output>
        </div>
      </section>
    </main>
  )
}

export default KeyboardControllerPrototype
