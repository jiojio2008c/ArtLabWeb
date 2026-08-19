import { useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent
} from 'react'
import {
  playIntervalWheelSelection,
  playIntervalWheelTick,
  prepareIntervalWheelAudio
} from '../services/intervalWheelAudio.ts'

interface IntervalWheelProps {
  value: number
  min?: number
  max?: number
  step?: number
  inputMode?: 'numeric' | 'decimal'
  allowDirectInput?: boolean
  className?: string
  onChange: (value: number) => void
  onCommit?: (value: number) => void
  ariaLabel: string
}

interface WheelDragState {
  pointerId: number
  startX: number
  startY: number
  startValue: number
  lastValue: number
  changed: boolean
  moved: boolean
  axis: 'pending' | 'horizontal' | 'vertical'
}

const WHEEL_STEP_PX = 46
const EPSILON = 0.000001

const getPrecision = (step: number) => {
  const stepText = String(step)
  if (stepText.includes('e-')) return Number(stepText.split('e-')[1]) || 0
  return stepText.includes('.') ? stepText.split('.')[1]?.length ?? 0 : 0
}

const roundToPrecision = (value: number, precision: number) => {
  const multiplier = 10 ** precision
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier
}

const IntervalWheel: React.FC<IntervalWheelProps> = ({
  value,
  min = 1,
  max = 100,
  step = 1,
  inputMode = 'numeric',
  allowDirectInput = true,
  className,
  onChange,
  onCommit,
  ariaLabel
}) => {
  const precision = getPrecision(step)
  const clampValue = (nextValue: number) => (
    roundToPrecision(Math.min(max, Math.max(min, nextValue)), precision)
  )
  const boundedValue = clampValue(value)

  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(boundedValue))
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<WheelDragState | null>(null)
  const collapseTimerRef = useRef<number | null>(null)
  const selectionSoundTimerRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const cancelEditRef = useRef(false)
  const isEditing = allowDirectInput && editing

  useEffect(() => {
    if (!editing) setDraft(String(boundedValue))
  }, [boundedValue, editing])

  useEffect(() => {
    if (allowDirectInput || !editing) return
    cancelEditRef.current = false
    setDraft(String(boundedValue))
    setEditing(false)
  }, [allowDirectInput, boundedValue, editing])

  useEffect(() => () => {
    if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current)
    if (selectionSoundTimerRef.current !== null) window.clearTimeout(selectionSoundTimerRef.current)
  }, [])

  const clearCollapseTimer = () => {
    if (collapseTimerRef.current === null) return
    window.clearTimeout(collapseTimerRef.current)
    collapseTimerRef.current = null
  }

  const scheduleCollapse = () => {
    clearCollapseTimer()
    collapseTimerRef.current = window.setTimeout(() => {
      if (!dragRef.current) setExpanded(false)
      collapseTimerRef.current = null
    }, 520)
  }

  const scheduleSelectionSound = () => {
    if (selectionSoundTimerRef.current !== null) window.clearTimeout(selectionSoundTimerRef.current)
    selectionSoundTimerRef.current = window.setTimeout(() => {
      playIntervalWheelSelection()
      selectionSoundTimerRef.current = null
    }, 130)
  }

  const setBoundedValue = (nextValue: number) => {
    const nextBoundedValue = clampValue(nextValue)
    if (Math.abs(nextBoundedValue - boundedValue) > EPSILON) onChange(nextBoundedValue)
    setDraft(String(nextBoundedValue))
    return nextBoundedValue
  }

  const stepValue = (stepDelta: number) => {
    clearCollapseTimer()
    const nextValue = setBoundedValue(boundedValue + stepDelta * step)
    if (Math.abs(nextValue - boundedValue) > EPSILON) {
      playIntervalWheelTick(nextValue > boundedValue ? 1 : -1)
      scheduleSelectionSound()
      onCommit?.(nextValue)
    }
  }

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    suppressClickRef.current = drag.moved && !cancelled
    dragRef.current = null
    setDragging(false)
    setExpanded(false)
    setDragOffset(0)
    clearCollapseTimer()

    if (cancelled) {
      suppressClickRef.current = false
      return
    }

    if (drag.axis === 'vertical' && drag.changed) {
      playIntervalWheelSelection()
      onCommit?.(drag.lastValue)
    }

    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (isEditing || event.button !== 0) return
    event.stopPropagation()
    prepareIntervalWheelAudio()
    clearCollapseTimer()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startValue: boundedValue,
      lastValue: boundedValue,
      changed: false,
      moved: false,
      axis: 'pending'
    }
    setDragging(true)
    setDragOffset(0)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startX
    const rawDelta = event.clientY - drag.startY
    if (Math.hypot(deltaX, rawDelta) >= 6) {
      drag.moved = true
      if (drag.axis === 'pending') {
        drag.axis = Math.abs(rawDelta) >= Math.abs(deltaX) ? 'vertical' : 'horizontal'
        setExpanded(drag.axis === 'vertical')
      }
    }

    if (drag.axis !== 'vertical') {
      setDragOffset(0)
      return
    }

    const requestedSteps = Math.trunc(-rawDelta / WHEEL_STEP_PX)
    const nextValue = clampValue(drag.startValue + requestedSteps * step)
    const appliedSteps = Math.round((nextValue - drag.startValue) / step)
    const residualOffset = rawDelta + appliedSteps * WHEEL_STEP_PX
    const boundaryOffset = (
      (nextValue >= max - EPSILON && residualOffset < 0)
      || (nextValue <= min + EPSILON && residualOffset > 0)
    ) ? 0 : residualOffset
    setDragOffset(boundaryOffset)

    if (Math.abs(nextValue - drag.lastValue) > EPSILON) {
      playIntervalWheelTick(nextValue > drag.lastValue ? 1 : -1)
      drag.lastValue = nextValue
      drag.changed = true
    }

    if (Math.abs(nextValue - boundedValue) > EPSILON) onChange(nextValue)
  }

  const beginEditing = () => {
    if (!allowDirectInput || suppressClickRef.current) return
    clearCollapseTimer()
    cancelEditRef.current = false
    setDraft(String(boundedValue))
    setExpanded(false)
    setEditing(true)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
      inputRef.current?.select()
    })
  }

  const commitDraft = () => {
    if (cancelEditRef.current) {
      cancelEditRef.current = false
      setDraft(String(boundedValue))
      setEditing(false)
      scheduleCollapse()
      return
    }

    const parsedValue = Number(draft)
    const nextValue = Number.isFinite(parsedValue) ? setBoundedValue(parsedValue) : boundedValue
    onCommit?.(nextValue)
    setEditing(false)
    scheduleCollapse()
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (isEditing || Math.abs(event.deltaY) < 1) return
    event.preventDefault()
    stepValue(event.deltaY > 0 ? 1 : -1)
  }

  const previousValue = boundedValue - step >= min - EPSILON ? clampValue(boundedValue - step) : null
  const nextValue = boundedValue + step <= max + EPSILON ? clampValue(boundedValue + step) : null
  const visibleWheelValues = Array.from({ length: 5 }, (_, offset) => ({
    offset: offset - 2,
    value: clampValue(boundedValue + (offset - 2) * step)
  })).filter(({ offset, value: wheelValue }) => (
    wheelValue >= min - EPSILON
    && wheelValue <= max + EPSILON
    && (offset === 0 || Math.abs(wheelValue - boundedValue) > EPSILON)
  ))
  const wheelStyle = { '--dynamic-interval-wheel-offset': `${dragOffset}px` } as CSSProperties
  const rootClassName = [
    'dynamic-interval-wheel',
    expanded && 'is-expanded',
    dragging && 'is-dragging',
    isEditing && 'is-editing',
    className
  ].filter(Boolean).join(' ')

  const renderDigitWindow = (position: 'previous' | 'current' | 'next') => (
    <div
      className={`dynamic-interval-wheel-digit-window dynamic-interval-wheel-digit-window-${position}`}
      aria-hidden="true"
    >
      <div className="dynamic-interval-wheel-digit-reel">
        {visibleWheelValues.map((wheelValue) => (
          <span
            key={`${wheelValue.offset}:${wheelValue.value}`}
            className="dynamic-interval-wheel-digit"
            style={{ '--dynamic-interval-wheel-digit-position': wheelValue.offset } as CSSProperties}
          >
            {wheelValue.value}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div
      className={rootClassName}
      onWheel={handleWheel}
    >
      <div className="dynamic-interval-wheel-viewport">
        <div className="dynamic-interval-wheel-track" style={wheelStyle}>
          {previousValue !== null && (
            <>
              <button
                type="button"
                className="dynamic-interval-wheel-cell dynamic-interval-wheel-neighbor dynamic-interval-wheel-previous"
                onClick={() => stepValue(-1)}
                disabled={isEditing}
                tabIndex={expanded ? 0 : -1}
                aria-label={`${ariaLabel}: ${previousValue}`}
                data-silent="true"
              />
              {!isEditing && renderDigitWindow('previous')}
            </>
          )}

          <div className="dynamic-interval-wheel-cell dynamic-interval-wheel-current">
            {isEditing ? (
              <input
                ref={inputRef}
                type="number"
                min={min}
                max={max}
                step={step}
                inputMode={inputMode}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') {
                    cancelEditRef.current = true
                    event.currentTarget.blur()
                  }
                }}
                aria-label={ariaLabel}
              />
            ) : (
              <button
                type="button"
                className="dynamic-interval-wheel-value"
                role="spinbutton"
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={boundedValue}
                aria-label={`${ariaLabel}: ${boundedValue}`}
                onClick={allowDirectInput ? beginEditing : undefined}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={(event) => finishDrag(event)}
                onPointerCancel={(event) => finishDrag(event, true)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    stepValue(1)
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    stepValue(-1)
                  }
                }}
                data-silent="true"
              />
            )}
          </div>

          {nextValue !== null && (
            <>
              <button
                type="button"
                className="dynamic-interval-wheel-cell dynamic-interval-wheel-neighbor dynamic-interval-wheel-next"
                onClick={() => stepValue(1)}
                disabled={isEditing}
                tabIndex={expanded ? 0 : -1}
                aria-label={`${ariaLabel}: ${nextValue}`}
                data-silent="true"
              />
              {!isEditing && renderDigitWindow('next')}
            </>
          )}

          {!isEditing && renderDigitWindow('current')}
        </div>
      </div>
    </div>
  )
}

export default IntervalWheel
