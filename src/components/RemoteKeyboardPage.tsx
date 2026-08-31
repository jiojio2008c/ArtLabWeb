import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Keyboard as KeyboardIcon,
  List,
  Monitor,
  Power,
  Radio,
  RotateCcw,
  Undo2,
  Volume1,
  Volume2,
  X,
  type LucideIcon
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  sendRemoteKeyboardPress,
  sendRemoteKeyboardTurn,
  type RemoteKeyboardControl,
  type RemoteKeyboardKey
} from '../services/unityBridge.ts'
import {
  playRemoteKeyDown,
  playRemoteKeyUp,
  playRemoteKnobRelease,
  playRemoteKnobTick,
  primeRemoteKeyboardAudio,
  type RemoteKnobSize
} from '../services/remoteKeyboardAudio.ts'
import BrandLogo from './BrandLogo.tsx'

interface RemoteKeyboardPageProps {
  wsIp: string
  port: number
  onBack: () => void
}

type KeySkin = 'black' | 'red' | 'green' | 'orange' | 'magenta' | 'cyan' | 'white'

interface RemoteKeyDefinition {
  id: string
  keys: readonly RemoteKeyboardKey[]
  ariaKey:
    | 'remoteKeyboard.keyEscape'
    | 'remoteKeyboard.keyHome'
    | 'remoteKeyboard.keyControlShift'
    | 'remoteKeyboard.keyAltF4'
    | 'remoteKeyboard.keySpaceN'
    | 'remoteKeyboard.keySpaceF'
    | 'remoteKeyboard.keyEnd'
    | 'remoteKeyboard.keyPageDown'
    | 'remoteKeyboard.keyShortcut'
  skin: KeySkin
  icon?: LucideIcon
  heading?: string
  modeNumber?: number
  lines?: readonly string[]
  weight?: number
}

interface PendingTurn {
  control: RemoteKeyboardControl
  key: RemoteKeyboardKey
  steps: number
}

interface RotaryControlProps {
  control: RemoteKeyboardControl
  size: RemoteKnobSize
  label: string
  negativeKey: RemoteKeyboardKey
  positiveKey: RemoteKeyboardKey
  onTurn: (control: RemoteKeyboardControl, key: RemoteKeyboardKey, steps: number) => void
  onTurnEnd: () => void
  brand?: boolean
  centerLabel?: string
  centerWeight?: number
  onCenterPress?: () => void
  children: React.ReactNode
}

const PRESET_8_KEYS = ['LeftControl', 'LeftAlt', 'Alpha8'] as const satisfies readonly RemoteKeyboardKey[]
const PRESET_8_WEIGHT = 0.49

const KEY_DEFINITIONS: readonly RemoteKeyDefinition[] = [
  { id: 'escape', keys: ['Escape'], ariaKey: 'remoteKeyboard.keyEscape', skin: 'black', icon: Undo2, weight: 0.56 },
  { id: 'home', keys: ['Home'], ariaKey: 'remoteKeyboard.keyHome', skin: 'red', icon: Power, weight: 0.64 },
  { id: 'control-shift', keys: ['LeftControl', 'LeftShift'], ariaKey: 'remoteKeyboard.keyControlShift', skin: 'black', icon: List, weight: 0.58 },
  { id: 'alt-f4', keys: ['LeftAlt', 'F4'], ariaKey: 'remoteKeyboard.keyAltF4', skin: 'red', icon: X, weight: 0.68 },
  { id: 'space-n', keys: ['Space', 'N'], ariaKey: 'remoteKeyboard.keySpaceN', skin: 'green', icon: Monitor, heading: 'On', weight: 0.5 },
  { id: 'space-f', keys: ['Space', 'F'], ariaKey: 'remoteKeyboard.keySpaceF', skin: 'red', icon: Monitor, heading: 'Off', weight: 0.54 },
  { id: 'end', keys: ['End'], ariaKey: 'remoteKeyboard.keyEnd', skin: 'red', icon: Radio, heading: 'Sensor', weight: 0.48 },
  { id: 'page-down', keys: ['PageDown'], ariaKey: 'remoteKeyboard.keyPageDown', skin: 'red', icon: RotateCcw, weight: 0.62 },
  { id: 'preset-1', keys: ['LeftControl', 'LeftAlt', 'Alpha1'], ariaKey: 'remoteKeyboard.keyShortcut', skin: 'orange', modeNumber: 1, lines: ['Floor', 'Normal', 'Full'], weight: 0.42 },
  { id: 'preset-2', keys: ['LeftControl', 'LeftAlt', 'Alpha2'], ariaKey: 'remoteKeyboard.keyShortcut', skin: 'orange', modeNumber: 2, lines: ['Floor', 'Normal', 'Slim'], weight: 0.43 },
  { id: 'preset-3', keys: ['LeftControl', 'LeftAlt', 'Alpha3'], ariaKey: 'remoteKeyboard.keyShortcut', skin: 'orange', modeNumber: 3, lines: ['Floor', 'Ultra', 'Full'], weight: 0.44 },
  { id: 'preset-4', keys: ['LeftControl', 'LeftAlt', 'Alpha4'], ariaKey: 'remoteKeyboard.keyShortcut', skin: 'magenta', modeNumber: 4, lines: ['Table', 'Full'], weight: 0.45 },
  { id: 'preset-5', keys: ['LeftControl', 'LeftAlt', 'Alpha5'], ariaKey: 'remoteKeyboard.keyShortcut', skin: 'magenta', modeNumber: 5, lines: ['Table', 'Slim'], weight: 0.46 },
  { id: 'preset-6', keys: ['LeftControl', 'LeftAlt', 'Alpha6'], ariaKey: 'remoteKeyboard.keyShortcut', skin: 'cyan', modeNumber: 6, lines: ['Wall', 'Full'], weight: 0.47 },
  { id: 'preset-7', keys: ['LeftControl', 'LeftAlt', 'Alpha7'], ariaKey: 'remoteKeyboard.keyShortcut', skin: 'cyan', modeNumber: 7, lines: ['Wall', 'Slim'], weight: 0.48 },
  { id: 'preset-8', keys: PRESET_8_KEYS, ariaKey: 'remoteKeyboard.keyShortcut', skin: 'white', modeNumber: 8, lines: ['Customise'], weight: PRESET_8_WEIGHT }
]

const KNOB_DETENT_DEGREES = 15
const TURN_BATCH_DELAY_MS = 38

const normalizeAngleDelta = (value: number) => {
  let normalized = value
  while (normalized > 180) normalized -= 360
  while (normalized < -180) normalized += 360
  return normalized
}

const pointAngle = (element: HTMLElement, clientX: number, clientY: number) => {
  const rect = element.getBoundingClientRect()
  const x = clientX - (rect.left + rect.width / 2)
  const y = clientY - (rect.top + rect.height / 2)
  return {
    angle: Math.atan2(y, x) * (180 / Math.PI),
    radius: Math.hypot(x, y),
    minimumRadius: Math.min(rect.width, rect.height) * 0.16
  }
}

const MechanicalKey: React.FC<{
  definition: RemoteKeyDefinition
  onActivate: (keys: readonly RemoteKeyboardKey[]) => void
}> = ({ definition, onActivate }) => {
  const { t } = useTranslation()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pressedRef = useRef(false)
  const [pressed, setPressed] = useState(false)
  const Icon = definition.icon
  const ariaLabel = definition.ariaKey === 'remoteKeyboard.keyShortcut'
    ? t(definition.ariaKey, { number: definition.modeNumber })
    : t(definition.ariaKey)

  const release = (playSound: boolean) => {
    if (!pressedRef.current) return
    pressedRef.current = false
    setPressed(false)
    if (playSound) playRemoteKeyUp(definition.weight)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    primeRemoteKeyboardAudio()
    event.currentTarget.setPointerCapture(event.pointerId)
    pressedRef.current = true
    setPressed(true)
    playRemoteKeyDown(definition.weight)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pressedRef.current) return
    const target = document.elementFromPoint(event.clientX, event.clientY)
    const shouldActivate = Boolean(target && event.currentTarget.contains(target))
    release(true)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (event.pointerType !== 'mouse') event.currentTarget.blur()
    if (shouldActivate) onActivate(definition.keys)
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    release(true)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (event.pointerType !== 'mouse') event.currentTarget.blur()
  }

  const handleLostPointerCapture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    release(true)
    if (event.pointerType !== 'mouse') event.currentTarget.blur()
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) return
    playRemoteKeyDown(definition.weight)
    window.setTimeout(() => playRemoteKeyUp(definition.weight), 54)
    onActivate(definition.keys)
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`remote-key remote-key-${definition.skin} ${definition.modeNumber ? 'remote-key-preset' : ''} ${pressed ? 'is-pressed' : ''}`}
      data-ui-feedback="none"
      aria-label={ariaLabel}
      title={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
      onContextMenu={(event) => event.preventDefault()}
      onClick={handleClick}
    >
      <span className="remote-key-housing-highlight" aria-hidden="true" />
      <span className="remote-key-cap" aria-hidden="true">
        {definition.modeNumber ? (
          <span className="remote-key-mode-copy">
            <span className="remote-key-mode-number">{definition.modeNumber}</span>
            <span className="remote-key-mode-lines">
              {definition.lines?.map((line) => <span key={line}>{line}</span>)}
            </span>
          </span>
        ) : (
          <>
            {definition.heading && <strong>{definition.heading}</strong>}
            {Icon && <Icon />}
          </>
        )}
      </span>
    </button>
  )
}

const RotaryControl: React.FC<RotaryControlProps> = ({
  control,
  size,
  label,
  negativeKey,
  positiveKey,
  onTurn,
  onTurnEnd,
  brand = false,
  centerLabel,
  centerWeight = 0.49,
  onCenterPress,
  children
}) => {
  const knobRef = useRef<HTMLDivElement>(null)
  const rotationRef = useRef(-18)
  const dragRef = useRef<{
    pointerId: number
    lastAngle: number
    carry: number
  } | null>(null)
  const centerPressedRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const [centerPressed, setCenterPressed] = useState(false)

  const updateVisualRotation = (delta: number) => {
    rotationRef.current += delta
    knobRef.current?.style.setProperty('--remote-knob-angle', `${rotationRef.current}deg`)
  }

  const emitDetents = (direction: -1 | 1, steps: number) => {
    const key = direction < 0 ? negativeKey : positiveKey
    updateVisualRotation(direction * KNOB_DETENT_DEGREES * steps)
    playRemoteKnobTick(size, steps)
    onTurn(control, key, steps)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const point = pointAngle(event.currentTarget, event.clientX, event.clientY)
    if (point.radius < point.minimumRadius) return

    primeRemoteKeyboardAudio()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      lastAngle: point.angle,
      carry: 0
    }
    setDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const point = pointAngle(event.currentTarget, event.clientX, event.clientY)
    if (point.radius < point.minimumRadius) return

    const delta = normalizeAngleDelta(point.angle - drag.lastAngle)
    drag.lastAngle = point.angle
    if (Math.abs(delta) > 72) return

    updateVisualRotation(delta)
    drag.carry += delta
    const detents = Math.trunc(drag.carry / KNOB_DETENT_DEGREES)
    if (detents === 0) return

    drag.carry -= detents * KNOB_DETENT_DEGREES
    const steps = Math.abs(detents)
    playRemoteKnobTick(size, steps)
    onTurn(control, detents < 0 ? negativeKey : positiveKey, steps)
  }

  const finishPointerInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
    playRemoteKnobRelease(size)
    onTurnEnd()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const releaseCenterPress = (playSound: boolean) => {
    if (!centerPressedRef.current) return
    centerPressedRef.current = false
    setCenterPressed(false)
    if (playSound) playRemoteKeyUp(centerWeight)
  }

  const handleCenterPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    primeRemoteKeyboardAudio()
    event.currentTarget.setPointerCapture(event.pointerId)
    centerPressedRef.current = true
    setCenterPressed(true)
    playRemoteKeyDown(centerWeight)
  }

  const handleCenterPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (!centerPressedRef.current) return
    const target = document.elementFromPoint(event.clientX, event.clientY)
    const shouldActivate = Boolean(target && event.currentTarget.contains(target))
    releaseCenterPress(true)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (event.pointerType !== 'mouse') event.currentTarget.blur()
    if (shouldActivate) onCenterPress?.()
  }

  const handleCenterPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    releaseCenterPress(true)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (event.pointerType !== 'mouse') event.currentTarget.blur()
  }

  const handleCenterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) return
    event.preventDefault()
    primeRemoteKeyboardAudio()
    centerPressedRef.current = true
    setCenterPressed(true)
    playRemoteKeyDown(centerWeight)
    onCenterPress?.()
    window.setTimeout(() => releaseCenterPress(true), 54)
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const direction: -1 | 1 = event.deltaY < 0 ? -1 : 1
    emitDetents(direction, 1)
    onTurnEnd()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let direction: -1 | 1 | null = null
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') direction = -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') direction = 1
    if (direction === null) return

    event.preventDefault()
    emitDetents(direction, 1)
    onTurnEnd()
  }

  return (
    <div
      className={`remote-knob-control remote-knob-control-${size}`}
      data-control={control}
    >
      <div
        ref={knobRef}
        data-center-press={onCenterPress ? 'true' : undefined}
        className={`remote-knob remote-knob-${size} ${dragging ? 'is-dragging' : ''} ${centerPressed ? 'is-pressed' : ''}`}
        style={{ '--remote-knob-angle': '-18deg' } as CSSProperties}
        role="button"
        tabIndex={0}
        aria-label={label}
        title={label}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerInteraction}
        onPointerCancel={finishPointerInteraction}
        onLostPointerCapture={() => {
          if (!dragRef.current) return
          dragRef.current = null
          setDragging(false)
          onTurnEnd()
        }}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className="remote-knob-body" aria-hidden="true">
          <span className="remote-knob-ridges" />
          <span className="remote-knob-metal">
            {brand ? (
              <BrandLogo className="remote-knob-brand-logo" />
            ) : (
              <span className="remote-knob-indicator" />
            )}
          </span>
        </span>
      </div>
      {onCenterPress && (
        <button
          type="button"
          className={`remote-knob-center-button ${centerPressed ? 'is-pressed' : ''}`}
          aria-label={centerLabel ?? label}
          aria-pressed={centerPressed}
          title={centerLabel ?? label}
          data-ui-feedback="none"
          onPointerDown={handleCenterPointerDown}
          onPointerUp={handleCenterPointerUp}
          onPointerCancel={handleCenterPointerCancel}
          onLostPointerCapture={(event) => {
            event.stopPropagation()
            releaseCenterPress(true)
          }}
          onClick={handleCenterClick}
          onContextMenu={(event) => event.preventDefault()}
        />
      )}
      <div className="remote-knob-scale" aria-hidden="true">{children}</div>
    </div>
  )
}

const RemoteKeyboardPage: React.FC<RemoteKeyboardPageProps> = ({ wsIp, port, onBack }) => {
  const { t } = useTranslation()
  const pendingTurnRef = useRef<PendingTurn | null>(null)
  const turnTimerRef = useRef<number | null>(null)

  const flushPendingTurn = useCallback(() => {
    if (turnTimerRef.current !== null) {
      window.clearTimeout(turnTimerRef.current)
      turnTimerRef.current = null
    }

    const pending = pendingTurnRef.current
    pendingTurnRef.current = null
    if (!pending) return
    sendRemoteKeyboardTurn(wsIp, port, pending.control, pending.key, pending.steps)
  }, [port, wsIp])

  useEffect(() => {
    primeRemoteKeyboardAudio()
    return () => flushPendingTurn()
  }, [flushPendingTurn])

  const queueTurn = (
    control: RemoteKeyboardControl,
    key: RemoteKeyboardKey,
    steps: number
  ) => {
    let pending = pendingTurnRef.current
    if (pending && (pending.control !== control || pending.key !== key)) {
      flushPendingTurn()
      pending = null
    }

    let remainingSteps = Math.max(1, Math.round(steps))
    if (pending) {
      const availableSteps = 32 - pending.steps
      const appendedSteps = Math.min(availableSteps, remainingSteps)
      pendingTurnRef.current = {
        ...pending,
        steps: pending.steps + appendedSteps
      }
      remainingSteps -= appendedSteps

      if (pendingTurnRef.current.steps === 32) {
        flushPendingTurn()
      }
    }

    while (remainingSteps > 32) {
      sendRemoteKeyboardTurn(wsIp, port, control, key, 32)
      remainingSteps -= 32
    }

    if (remainingSteps > 0) {
      pendingTurnRef.current = { control, key, steps: remainingSteps }
    }

    if (pendingTurnRef.current && turnTimerRef.current === null) {
      turnTimerRef.current = window.setTimeout(flushPendingTurn, TURN_BATCH_DELAY_MS)
    }
  }

  const sendPress = (keys: readonly RemoteKeyboardKey[]) => {
    flushPendingTurn()
    sendRemoteKeyboardPress(wsIp, port, keys)
  }

  return (
    <main className="ipad-screen remote-keyboard-screen apple-container">
      <header className="ipad-topbar remote-keyboard-header">
        <button type="button" className="remote-keyboard-back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          <span>{t('remoteKeyboard.back')}</span>
        </button>

        <div className="remote-keyboard-heading">
          <p><KeyboardIcon aria-hidden="true" /> MagicFloor</p>
          <h1>{t('remoteKeyboard.title')}</h1>
        </div>

        <span className="remote-keyboard-header-balance" aria-hidden="true" />
      </header>

      <section className="remote-keyboard-workspace">
        <div className="remote-keyboard-device" role="group" aria-label={t('remoteKeyboard.panel')}>
          <span className="remote-device-rim" aria-hidden="true" />
          <span className="remote-device-screw screw-top-left" aria-hidden="true" />
          <span className="remote-device-screw screw-top-right" aria-hidden="true" />
          <span className="remote-device-screw screw-bottom-left" aria-hidden="true" />
          <span className="remote-device-screw screw-bottom-right" aria-hidden="true" />

          <div className="remote-key-grid">
            {KEY_DEFINITIONS.map((definition) => (
              <MechanicalKey
                key={definition.id}
                definition={definition}
                onActivate={sendPress}
              />
            ))}
          </div>

          <div className="remote-knob-deck">
            <RotaryControl
              control="volume"
              size="small"
              label={t('remoteKeyboard.volumeKnob')}
              negativeKey="Minus"
              positiveKey="Plus"
              onTurn={queueTurn}
              onTurnEnd={flushPendingTurn}
            >
              <span className="remote-scale-volume remote-scale-volume-low"><Volume1 /></span>
              <span className="remote-scale-volume remote-scale-volume-high"><Volume2 /></span>
            </RotaryControl>

            <RotaryControl
              control="vertical"
              size="small"
              label={t('remoteKeyboard.verticalKnob')}
              negativeKey="UpArrow"
              positiveKey="DownArrow"
              onTurn={queueTurn}
              onTurnEnd={flushPendingTurn}
            >
              <span className="remote-scale-arrow remote-scale-arrow-up"><ArrowUp /></span>
              <span className="remote-scale-arrow remote-scale-arrow-down"><ArrowDown /></span>
            </RotaryControl>

            <RotaryControl
              control="horizontal"
              size="large"
              label={t('remoteKeyboard.horizontalKnob')}
              negativeKey="LeftArrow"
              positiveKey="RightArrow"
              onTurn={queueTurn}
              onTurnEnd={flushPendingTurn}
              brand
              centerLabel={t('remoteKeyboard.keyShortcut', { number: 8 })}
              centerWeight={PRESET_8_WEIGHT}
              onCenterPress={() => sendPress(PRESET_8_KEYS)}
            >
              <span className="remote-scale-arrow remote-scale-arrow-left">←</span>
              <span className="remote-scale-arrow remote-scale-arrow-right">→</span>
            </RotaryControl>
          </div>
        </div>
      </section>
    </main>
  )
}

export default RemoteKeyboardPage
