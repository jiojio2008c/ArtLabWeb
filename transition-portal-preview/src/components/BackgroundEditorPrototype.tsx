import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { ImagePlus, Trash2, X } from 'lucide-react'
import {
  playIntervalWheelSelection,
  playIntervalWheelTick,
  prepareIntervalWheelAudio
} from '../intervalWheelAudio'

type BackgroundPlaybackMode = 'fixed' | 'random' | 'sequence'
type IntervalUnit = 'seconds' | 'minutes'

interface BackgroundEditorPrototypeProps {
  open: boolean
  onClose: () => void
}

interface IntervalWheelProps {
  value: number
  onChange: (value: number) => void
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

const MIN_INTERVAL = 1
const MAX_INTERVAL = 100
const WHEEL_STEP_PX = 46

const clampInterval = (value: number) => Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, value))

const IntervalWheel: React.FC<IntervalWheelProps> = ({ value, onChange }) => {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<WheelDragState | null>(null)
  const collapseTimerRef = useRef<number | null>(null)
  const selectionSoundTimerRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const cancelEditRef = useRef(false)

  useEffect(() => {
    if (!editing) setDraft(String(value))
  }, [editing, value])

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
    const boundedValue = clampInterval(Math.round(nextValue))
    if (boundedValue !== value) onChange(boundedValue)
    setDraft(String(boundedValue))
    return boundedValue
  }

  const stepValue = (step: number) => {
    clearCollapseTimer()
    const nextValue = setBoundedValue(value + step)
    if (nextValue !== value) {
      playIntervalWheelTick(nextValue > value ? 1 : -1)
      scheduleSelectionSound()
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
    if (drag.axis === 'vertical' && drag.changed) playIntervalWheelSelection()

    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (editing || event.button !== 0) return
    prepareIntervalWheelAudio()
    clearCollapseTimer()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startValue: value,
      lastValue: value,
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
    const nextValue = clampInterval(drag.startValue + requestedSteps)
    const appliedSteps = nextValue - drag.startValue
    const residualOffset = rawDelta + appliedSteps * WHEEL_STEP_PX
    const boundaryOffset = (
      (nextValue === MAX_INTERVAL && residualOffset < 0)
      || (nextValue === MIN_INTERVAL && residualOffset > 0)
    ) ? 0 : residualOffset
    setDragOffset(boundaryOffset)

    if (nextValue !== drag.lastValue) {
      playIntervalWheelTick(nextValue > drag.lastValue ? 1 : -1)
      drag.lastValue = nextValue
      drag.changed = true
    }

    if (nextValue !== value) onChange(nextValue)
  }

  const beginEditing = () => {
    if (suppressClickRef.current) return
    clearCollapseTimer()
    cancelEditRef.current = false
    setDraft(String(value))
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
      setDraft(String(value))
      setEditing(false)
      scheduleCollapse()
      return
    }
    const parsedValue = Number(draft)
    const nextValue = Number.isFinite(parsedValue) ? clampInterval(Math.round(parsedValue)) : value
    onChange(nextValue)
    setDraft(String(nextValue))
    setEditing(false)
    scheduleCollapse()
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (editing || Math.abs(event.deltaY) < 1) return
    event.preventDefault()
    stepValue(event.deltaY > 0 ? 1 : -1)
  }

  const previousValue = value > MIN_INTERVAL ? value - 1 : null
  const nextValue = value < MAX_INTERVAL ? value + 1 : null
  const visibleWheelValues = Array.from(
    { length: 5 },
    (_, index) => value + index - 2
  ).filter((wheelValue) => wheelValue >= MIN_INTERVAL && wheelValue <= MAX_INTERVAL)
  const wheelStyle = { '--interval-wheel-offset': `${dragOffset}px` } as CSSProperties

  const renderDigitWindow = (position: 'previous' | 'current' | 'next') => (
    <div
      className={`interval-wheel-digit-window interval-wheel-digit-window-${position}`}
      aria-hidden="true"
    >
      <div className="interval-wheel-digit-reel">
        {visibleWheelValues.map((wheelValue) => (
          <span
            key={wheelValue}
            className="interval-wheel-digit"
            style={{ '--interval-wheel-digit-position': wheelValue - value } as CSSProperties}
          >
            {wheelValue}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div
      className={`interval-wheel ${expanded ? 'is-expanded' : ''} ${dragging ? 'is-dragging' : ''} ${editing ? 'is-editing' : ''}`}
      onWheel={handleWheel}
    >
      <div className="interval-wheel-viewport" aria-label="切換間隔數字選擇">
        <div className="interval-wheel-track" style={wheelStyle}>
          {previousValue !== null && (
            <>
              <button
                type="button"
                className="interval-wheel-cell interval-wheel-neighbor interval-wheel-previous"
                onClick={() => stepValue(-1)}
                disabled={editing}
                tabIndex={expanded ? 0 : -1}
                aria-label={`選擇 ${previousValue}`}
              />
              {!editing && renderDigitWindow('previous')}
            </>
          )}

          <div className="interval-wheel-cell interval-wheel-current">
            {editing ? (
              <input
                ref={inputRef}
                type="number"
                min={MIN_INTERVAL}
                max={MAX_INTERVAL}
                step="1"
                inputMode="numeric"
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
                aria-label="輸入切換間隔，範圍 1 至 100"
              />
            ) : (
              <button
                type="button"
                className="interval-wheel-value"
                role="spinbutton"
                aria-valuemin={MIN_INTERVAL}
                aria-valuemax={MAX_INTERVAL}
                aria-valuenow={value}
                aria-label={`切換間隔 ${value}，點按輸入或上下滑動調整`}
                onClick={beginEditing}
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
              >
              </button>
            )}
          </div>

          {nextValue !== null && (
            <>
              <button
                type="button"
                className="interval-wheel-cell interval-wheel-neighbor interval-wheel-next"
                onClick={() => stepValue(1)}
                disabled={editing}
                tabIndex={expanded ? 0 : -1}
                aria-label={`選擇 ${nextValue}`}
              />
              {!editing && renderDigitWindow('next')}
            </>
          )}

          {!editing && renderDigitWindow('current')}
        </div>
      </div>
    </div>
  )
}

const mockBackgrounds = [
  { id: 'forest', name: '森林樹屋.png', src: '/assets/magic-floor-background.webp' },
  { id: 'garden', name: '奇幻花園.png', src: '/assets/interactive-forest-1.jpg' },
  { id: 'ocean', name: '海洋舞台.png', src: '/assets/interactive-ocean.jpg' }
]

const BackgroundEditorPrototype: React.FC<BackgroundEditorPrototypeProps> = ({ open, onClose }) => {
  const [playbackMode, setPlaybackMode] = useState<BackgroundPlaybackMode>('random')
  const [intervalValue, setIntervalValue] = useState(5)
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('seconds')
  const [activeBackgroundId, setActiveBackgroundId] = useState('garden')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.requestAnimationFrame(() => closeButtonRef.current?.focus({ preventScroll: true }))
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  const allSelected = selectedIds.length === mockBackgrounds.length
  const someSelected = selectedIds.length > 0 && !allSelected

  return createPortal(
    <div className="background-prototype-backdrop" role="presentation">
      <section
        className="background-prototype-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="background-prototype-title"
      >
        <header className="background-prototype-heading">
          <div>
            <p>舞台背景</p>
            <h2 id="background-prototype-title">編輯背景 <span>{mockBackgrounds.length} 個素材</span></h2>
          </div>
          <button ref={closeButtonRef} type="button" className="background-prototype-close" onClick={onClose} aria-label="關閉編輯背景">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className={`background-prototype-playback ${playbackMode === 'fixed' ? 'is-fixed' : ''}`}>
          <div className="background-prototype-modes" aria-label="背景切換方式">
            {([
              ['fixed', '固定背景'],
              ['random', '隨機切換'],
              ['sequence', '逐個切換']
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={playbackMode === mode ? 'active' : ''}
                onClick={() => setPlaybackMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          {playbackMode !== 'fixed' && (
            <div className="background-prototype-interval">
              <span>切換間隔</span>
              <div className="background-prototype-interval-controls">
                <IntervalWheel value={intervalValue} onChange={setIntervalValue} />
                <select value={intervalUnit} onChange={(event) => setIntervalUnit(event.target.value as IntervalUnit)} aria-label="切換間隔單位">
                  <option value="seconds">秒</option>
                  <option value="minutes">分鐘</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="background-prototype-toolbar">
          <label>
            <input
              type="checkbox"
              checked={allSelected}
              ref={(input) => {
                if (input) input.indeterminate = someSelected
              }}
              onChange={() => setSelectedIds(allSelected ? [] : mockBackgrounds.map((background) => background.id))}
            />
            <span>全選</span>
          </label>
          <span>按住卡片拖曳可調整播放順序</span>
          <strong>已選 {selectedIds.length}</strong>
        </div>

        <div className="background-prototype-list">
          {mockBackgrounds.map((background, index) => {
            const checked = selectedIds.includes(background.id)
            const active = activeBackgroundId === background.id
            return (
              <article key={background.id} className={`background-prototype-card ${active ? 'active' : ''} ${checked ? 'checked' : ''}`}>
                <label className="background-prototype-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelectedIds((current) => (
                      current.includes(background.id)
                        ? current.filter((id) => id !== background.id)
                        : [...current, background.id]
                    ))}
                  />
                </label>
                <span className="background-prototype-order">{String(index + 1).padStart(2, '0')}</span>
                <button type="button" className="background-prototype-preview" onClick={() => setActiveBackgroundId(background.id)} aria-label={`選擇 ${background.name}`}>
                  <img src={background.src} alt="" />
                </button>
                <button type="button" className="background-prototype-copy" onClick={() => setActiveBackgroundId(background.id)}>
                  <strong>{background.name}</strong>
                  <small>{active ? '目前背景' : '圖片背景'}</small>
                </button>
              </article>
            )
          })}
        </div>

        <footer className="background-prototype-actions">
          <button type="button" className="background-prototype-delete" disabled={selectedIds.length === 0}>
            <Trash2 aria-hidden="true" />
            <span>刪除選取</span>
          </button>
          <button type="button" className="background-prototype-add">
            <ImagePlus aria-hidden="true" />
            <span>新增背景</span>
          </button>
        </footer>
      </section>
    </div>,
    document.body
  )
}

export default BackgroundEditorPrototype
