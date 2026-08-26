import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  Check,
  Cloud,
  Heading,
  ImagePlus,
  MessageCircle,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react'
import {
  bubbleShapeCommandsToSvgPath,
  deriveBubbleOutlineColor,
  getBubbleShapeDefinition,
  normalizeBubbleColor
} from '../../desktop-runtime/renderer/bubble-shape-catalog.js'
import DynamicBubbleVisual, {
  type DynamicBubbleDraft,
  type DynamicBubbleImageDraft,
  type DynamicBubbleStyleId,
  type DynamicBubbleTitleMaskId,
  type DynamicBubbleType
} from './DynamicBubbleVisual.tsx'
import './DynamicBubbleEditor.css'

export interface DynamicBubbleEditorSubmitValue extends DynamicBubbleDraft {
  name?: string
  imageFile?: File | null
  removeImage?: boolean
}

export interface DynamicBubbleEditorProps {
  open?: boolean
  mode?: 'create' | 'edit'
  initialValue?: Partial<DynamicBubbleDraft>
  stageBackgroundUrl?: string
  busy?: boolean
  resetKey?: string | number
  onCancel: () => void
  onSubmit: (value: DynamicBubbleEditorSubmitValue) => void | Promise<void>
}

interface EditorErrors {
  content?: string
  submit?: string
}

interface BubbleStyleOption {
  id: DynamicBubbleStyleId
  labelKey: string
  descriptionKey: string
}

interface BubbleShapeSwatchProps {
  styleId: DynamicBubbleStyleId
  surfaceColor: string
  outlineColor: string
}

const BubbleShapeSwatch: React.FC<BubbleShapeSwatchProps> = ({
  styleId,
  surfaceColor,
  outlineColor
}) => {
  const definition = getBubbleShapeDefinition(styleId)
  const shapePath = bubbleShapeCommandsToSvgPath(definition.bodyCommands)
  const { viewBox } = definition

  return (
    <span className="dynamic-bubble-style-swatch" aria-hidden="true">
      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
      >
        <path
          className="dynamic-bubble-style-swatch-body"
          d={shapePath}
          fill={surfaceColor}
          stroke={outlineColor}
        />
        {definition.decorations.map((decoration, index) => (
          <circle
            key={`${decoration.cx}-${decoration.cy}-${index}`}
            className="dynamic-bubble-style-swatch-decoration"
            cx={decoration.cx}
            cy={decoration.cy}
            r={decoration.radius}
            fill={surfaceColor}
            stroke={outlineColor}
          />
        ))}
      </svg>
    </span>
  )
}

const DIALOGUE_STYLES: BubbleStyleOption[] = [
  { id: 'dialogue-rounded-left', labelKey: 'bubbleEditor.style.dialogueRounded', descriptionKey: 'bubbleEditor.direction.left' },
  { id: 'dialogue-rounded-right', labelKey: 'bubbleEditor.style.dialogueRounded', descriptionKey: 'bubbleEditor.direction.right' },
  { id: 'dialogue-soft-left', labelKey: 'bubbleEditor.style.dialogueSoft', descriptionKey: 'bubbleEditor.direction.left' },
  { id: 'dialogue-soft-right', labelKey: 'bubbleEditor.style.dialogueSoft', descriptionKey: 'bubbleEditor.direction.right' },
  { id: 'dialogue-comic-left', labelKey: 'bubbleEditor.style.dialogueComic', descriptionKey: 'bubbleEditor.direction.left' },
  { id: 'dialogue-comic-right', labelKey: 'bubbleEditor.style.dialogueComic', descriptionKey: 'bubbleEditor.direction.right' }
]

const THOUGHT_STYLES: BubbleStyleOption[] = [
  { id: 'thought-cloud-left', labelKey: 'bubbleEditor.style.thoughtCloud', descriptionKey: 'bubbleEditor.direction.left' },
  { id: 'thought-cloud-right', labelKey: 'bubbleEditor.style.thoughtCloud', descriptionKey: 'bubbleEditor.direction.right' }
]

const TITLE_STYLES: BubbleStyleOption[] = [
  { id: 'title-rounded', labelKey: 'bubbleEditor.style.titleRounded', descriptionKey: 'bubbleEditor.styleHint.titleRounded' },
  { id: 'title-pill', labelKey: 'bubbleEditor.style.titlePill', descriptionKey: 'bubbleEditor.styleHint.titlePill' },
  { id: 'title-ticket', labelKey: 'bubbleEditor.style.titleTicket', descriptionKey: 'bubbleEditor.styleHint.titleTicket' },
  { id: 'title-underline', labelKey: 'bubbleEditor.style.titleUnderline', descriptionKey: 'bubbleEditor.styleHint.titleUnderline' },
  { id: 'title-none', labelKey: 'bubbleEditor.style.titleNone', descriptionKey: 'bubbleEditor.styleHint.titleNone' }
]

const LEGACY_TITLE_MASK_IDS: DynamicBubbleTitleMaskId[] = ['rounded', 'pill', 'ticket', 'underline', 'none']

const TEXT_COLORS = [
  { labelKey: 'bubbleEditor.color.inkBlack', color: '#20302d' },
  { labelKey: 'bubbleEditor.color.white', color: '#ffffff' },
  { labelKey: 'bubbleEditor.color.deepBlue', color: '#173b5f' },
  { labelKey: 'bubbleEditor.color.deepGreen', color: '#175a49' },
  { labelKey: 'bubbleEditor.color.warmRed', color: '#8b332c' },
  { labelKey: 'bubbleEditor.color.gold', color: '#b87512' }
]

const MASK_COLORS = [
  { labelKey: 'bubbleEditor.color.deepInk', color: '#263a3b' },
  { labelKey: 'bubbleEditor.color.cyanBlue', color: '#0c8fa4' },
  { labelKey: 'bubbleEditor.color.coral', color: '#dd6859' },
  { labelKey: 'bubbleEditor.color.warmSun', color: '#c88722' },
  { labelKey: 'bubbleEditor.color.violet', color: '#7567b4' },
  { labelKey: 'bubbleEditor.color.white', color: '#ffffff' }
]

const BUBBLE_SURFACE_COLORS = [
  { labelKey: 'bubbleEditor.color.white', color: '#ffffff' },
  { labelKey: 'bubbleEditor.color.warmWhite', color: '#fffef6' },
  { labelKey: 'bubbleEditor.color.softYellow', color: '#fff2b8' },
  { labelKey: 'bubbleEditor.color.coral', color: '#ffd6ce' },
  { labelKey: 'bubbleEditor.color.skyBlue', color: '#dcefff' },
  { labelKey: 'bubbleEditor.color.mint', color: '#dff5e8' },
  { labelKey: 'bubbleEditor.color.lavender', color: '#eee5ff' }
] as const

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const getStylesForType = (bubbleType: DynamicBubbleType) => {
  if (bubbleType === 'thought') return THOUGHT_STYLES
  if (bubbleType === 'title') return TITLE_STYLES
  return DIALOGUE_STYLES
}

const getDefaultStyleId = (bubbleType: DynamicBubbleType): DynamicBubbleStyleId => (
  bubbleType === 'thought'
    ? 'thought-cloud-right'
    : bubbleType === 'title' ? 'title-rounded' : 'dialogue-rounded-right'
)

const normalizeEditorStyleId = (
  bubbleType: DynamicBubbleType,
  styleId: DynamicBubbleStyleId | undefined
): DynamicBubbleStyleId => {
  const allowedStyles = getStylesForType(bubbleType)
  if (bubbleType === 'title') {
    return allowedStyles.some((style) => style.id === styleId)
      ? styleId as DynamicBubbleStyleId
      : getDefaultStyleId(bubbleType)
  }

  const canonicalStyleId = getBubbleShapeDefinition(styleId ?? getDefaultStyleId(bubbleType)).styleId as DynamicBubbleStyleId
  return allowedStyles.some((style) => style.id === canonicalStyleId)
    ? canonicalStyleId
    : getDefaultStyleId(bubbleType)
}

const getColorChannels = (color: string) => {
  const normalized = normalizeBubbleColor(color).slice(1, 7)
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) / 255)
}

const getRelativeLuminance = (color: string) => {
  const linearChannels = getColorChannels(color).map((channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ))
  return 0.2126 * linearChannels[0] + 0.7152 * linearChannels[1] + 0.0722 * linearChannels[2]
}

const isLightColor = (color: string) => {
  return getRelativeLuminance(color) > 0.58
}

const getContrastRatio = (firstColor: string, secondColor: string) => {
  const firstLuminance = getRelativeLuminance(firstColor)
  const secondLuminance = getRelativeLuminance(secondColor)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

const defaultDialogueShape = getBubbleShapeDefinition('dialogue-rounded-right')

const DEFAULT_BUBBLE: DynamicBubbleDraft = {
  bubbleType: 'dialogue',
  styleId: 'dialogue-rounded-right',
  title: '',
  bodyText: '',
  revealMode: 'all',
  revealIntervalMs: 80,
  fontSizePx: 52,
  textColor: '#20302d',
  surfaceId: 'light',
  surfaceColor: defaultDialogueShape.defaultSurfaceColor,
  outlineColor: defaultDialogueShape.defaultOutlineColor,
  titleMaskId: 'rounded',
  paletteId: 'ocean',
  maskColor: '#0c8fa4',
  maskOpacity: 0.92,
  widthPx: defaultDialogueShape.defaultWidth,
  heightPx: defaultDialogueShape.defaultHeight
}

const normalizeInitialValue = (initialValue?: Partial<DynamicBubbleDraft>): DynamicBubbleDraft => {
  const bubbleType = initialValue?.bubbleType ?? DEFAULT_BUBBLE.bubbleType
  const styleId = normalizeEditorStyleId(bubbleType, initialValue?.styleId)
  const shapeDefinition = bubbleType === 'title' ? null : getBubbleShapeDefinition(styleId)
  const defaultSurfaceColor = shapeDefinition?.defaultSurfaceColor ?? '#ffffff'
  const defaultOutlineColor = shapeDefinition?.defaultOutlineColor ?? '#263a3b'

  return {
    ...DEFAULT_BUBBLE,
    ...initialValue,
    bubbleType,
    styleId,
    surfaceColor: normalizeBubbleColor(initialValue?.surfaceColor, defaultSurfaceColor),
    outlineColor: normalizeBubbleColor(initialValue?.outlineColor, defaultOutlineColor),
    titleMaskId: LEGACY_TITLE_MASK_IDS.includes(initialValue?.titleMaskId as DynamicBubbleTitleMaskId)
      ? initialValue?.titleMaskId as DynamicBubbleTitleMaskId
      : DEFAULT_BUBBLE.titleMaskId,
    paletteId: initialValue?.paletteId ?? (bubbleType === 'thought' ? 'ink' : 'ocean'),
    maskColor: initialValue?.maskColor ?? DEFAULT_BUBBLE.maskColor,
    maskOpacity: clamp(initialValue?.maskOpacity ?? DEFAULT_BUBBLE.maskOpacity, 0, 1),
    widthPx: initialValue?.widthPx ?? shapeDefinition?.defaultWidth ?? 900,
    heightPx: initialValue?.heightPx ?? shapeDefinition?.defaultHeight ?? 220
  }
}

const getFocusableElements = (dialog: HTMLElement) => Array.from(dialog.querySelectorAll<HTMLElement>(
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
)).filter((element) => (
  element.tabIndex >= 0
  && !element.hasAttribute('hidden')
  && element.getAttribute('aria-hidden') !== 'true'
))

const DynamicBubbleEditor: React.FC<DynamicBubbleEditorProps> = ({
  open = true,
  mode = 'create',
  initialValue,
  stageBackgroundUrl,
  busy = false,
  resetKey,
  onCancel,
  onSubmit
}) => {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const contentErrorId = useId()
  const dialogRef = useRef<HTMLFormElement>(null)
  const bubbleTypeInputRef = useRef<HTMLInputElement>(null)
  const bodyInputRef = useRef<HTMLTextAreaElement>(null)
  const titleTextInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageActionRef = useRef<HTMLButtonElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const generatedImageUrlRef = useRef<string | null>(null)
  const wasOpenRef = useRef(false)
  const lastResetKeyRef = useRef(resetKey)
  const initialImageUrlRef = useRef(initialValue?.image?.url)
  const [draft, setDraft] = useState<DynamicBubbleDraft>(() => normalizeInitialValue(initialValue))
  const [playbackKey, setPlaybackKey] = useState(0)
  const [errors, setErrors] = useState<EditorErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const isBusy = busy || submitting
  const isStandaloneTitle = draft.bubbleType === 'title'
  const styles = getStylesForType(draft.bubbleType)
  const hasCustomTextColor = !TEXT_COLORS.some(({ color }) => color.toLowerCase() === draft.textColor.toLowerCase())
  const maskColor = draft.maskColor ?? '#0c8fa4'
  const hasCustomMaskColor = !MASK_COLORS.some(({ color }) => color.toLowerCase() === maskColor.toLowerCase())
  const activeShapeDefinition = isStandaloneTitle ? null : getBubbleShapeDefinition(draft.styleId)
  const surfaceColor = normalizeBubbleColor(
    draft.surfaceColor,
    activeShapeDefinition?.defaultSurfaceColor ?? defaultDialogueShape.defaultSurfaceColor
  )
  const outlineColor = normalizeBubbleColor(
    draft.outlineColor,
    activeShapeDefinition?.defaultOutlineColor ?? deriveBubbleOutlineColor(surfaceColor)
  )
  const surfaceMatchesStyleDefault = Boolean(
    activeShapeDefinition
    && surfaceColor.toLowerCase() === activeShapeDefinition.defaultSurfaceColor.toLowerCase()
  )
  const showStyleDefaultSurface = Boolean(
    activeShapeDefinition
    && !BUBBLE_SURFACE_COLORS.some(({ color }) => (
      color.toLowerCase() === activeShapeDefinition.defaultSurfaceColor.toLowerCase()
    ))
  )
  const usesDefaultSurface = Boolean(
    surfaceMatchesStyleDefault
    && activeShapeDefinition
    && outlineColor.toLowerCase() === activeShapeDefinition.defaultOutlineColor.toLowerCase()
  )
  const hasCustomSurfaceColor = !surfaceMatchesStyleDefault
    && !BUBBLE_SURFACE_COLORS.some(({ color }) => color.toLowerCase() === surfaceColor.toLowerCase())
  const usesDarkSurface = !isLightColor(surfaceColor)
  const hasLowTextContrast = isStandaloneTitle
    ? draft.styleId !== 'title-none' && getContrastRatio(draft.textColor, maskColor) < 3
    : getContrastRatio(draft.textColor, surfaceColor) < 3
  const previewBubble = useMemo<DynamicBubbleDraft>(() => ({
    ...draft,
    bodyText: draft.bodyText || (draft.bubbleType === 'thought' && draft.image
      ? ''
      : draft.bubbleType === 'title'
        ? t('bubbleEditor.preview.titlePlaceholder')
        : t('bubbleEditor.preview.bodyPlaceholder'))
  }), [draft, t])

  const clearGeneratedImageUrl = useCallback(() => {
    if (!generatedImageUrlRef.current) return
    URL.revokeObjectURL(generatedImageUrlRef.current)
    generatedImageUrlRef.current = null
  }, [])

  const resetEditor = useCallback(() => {
    clearGeneratedImageUrl()
    const nextDraft = normalizeInitialValue(initialValue)
    initialImageUrlRef.current = initialValue?.image?.url
    setDraft(nextDraft)
    setErrors({})
    setPlaybackKey((current) => current + 1)
  }, [clearGeneratedImageUrl, initialValue])

  useEffect(() => {
    const resetKeyChanged = lastResetKeyRef.current !== resetKey
    if (open && (!wasOpenRef.current || resetKeyChanged)) {
      if (!wasOpenRef.current) {
        previousActiveElementRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      }
      lastResetKeyRef.current = resetKey
      resetEditor()
      const focusFrame = window.requestAnimationFrame(() => bubbleTypeInputRef.current?.focus())
      wasOpenRef.current = true
      return () => window.cancelAnimationFrame(focusFrame)
    }

    if (!open && wasOpenRef.current) {
      wasOpenRef.current = false
      clearGeneratedImageUrl()
      const previousActiveElement = previousActiveElementRef.current
      previousActiveElementRef.current = null
      window.requestAnimationFrame(() => {
        if (previousActiveElement?.isConnected) previousActiveElement.focus()
      })
    }
  }, [clearGeneratedImageUrl, open, resetEditor, resetKey])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!isBusy) onCancel()
        return
      }

      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusableElements = getFocusableElements(dialog)
      if (focusableElements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && (document.activeElement === firstElement || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && (document.activeElement === lastElement || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isBusy, onCancel, open])

  useEffect(() => () => {
    clearGeneratedImageUrl()
    if (wasOpenRef.current) previousActiveElementRef.current?.focus()
  }, [clearGeneratedImageUrl])

  const updateDraft = <Key extends keyof DynamicBubbleDraft>(
    key: Key,
    value: DynamicBubbleDraft[Key]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }))
    if (key === 'bodyText' || key === 'image') {
      setErrors((current) => ({ ...current, content: undefined, submit: undefined }))
    }
  }

  const handleBubbleTypeChange = (bubbleType: DynamicBubbleType) => {
    setDraft((current) => {
      const styleId = getDefaultStyleId(bubbleType)
      const shapeDefinition = bubbleType === 'title' ? null : getBubbleShapeDefinition(styleId)
      const nextSurfaceColor = shapeDefinition?.defaultSurfaceColor ?? '#ffffff'
      return {
        ...current,
        bubbleType,
        styleId,
        title: bubbleType === 'title' ? '' : current.title,
        bodyText: bubbleType === 'title' && !current.bodyText.trim()
          ? current.title
          : current.bodyText,
        textColor: bubbleType === 'title' || !isLightColor(nextSurfaceColor) ? '#ffffff' : '#20302d',
        surfaceColor: nextSurfaceColor,
        outlineColor: shapeDefinition?.defaultOutlineColor ?? '#263a3b',
        paletteId: bubbleType === 'thought' ? 'ink' : 'ocean',
        maskColor: current.maskColor ?? '#0c8fa4',
        maskOpacity: clamp(current.maskOpacity, 0, 1),
        widthPx: shapeDefinition?.defaultWidth ?? 900,
        heightPx: shapeDefinition?.defaultHeight ?? 220
      }
    })
    setErrors((current) => ({ ...current, content: undefined, submit: undefined }))
    setPlaybackKey((current) => current + 1)
  }

  const handleStyleChange = (styleId: DynamicBubbleStyleId) => {
    setDraft((current) => {
      if (current.bubbleType !== 'title') {
        const currentDefinition = getBubbleShapeDefinition(current.styleId)
        const nextDefinition = getBubbleShapeDefinition(styleId)
        const currentUsesDefault = normalizeBubbleColor(current.surfaceColor).toLowerCase()
          === currentDefinition.defaultSurfaceColor.toLowerCase()
          && normalizeBubbleColor(current.outlineColor).toLowerCase()
            === currentDefinition.defaultOutlineColor.toLowerCase()
        const surfaceColor = currentUsesDefault
          ? nextDefinition.defaultSurfaceColor
          : normalizeBubbleColor(current.surfaceColor, nextDefinition.defaultSurfaceColor)
        const outlineColor = currentUsesDefault
          ? nextDefinition.defaultOutlineColor
          : normalizeBubbleColor(current.outlineColor, deriveBubbleOutlineColor(surfaceColor))
        const textColor = currentUsesDefault && getContrastRatio(current.textColor, surfaceColor) < 3
          ? isLightColor(surfaceColor) ? '#20302d' : '#ffffff'
          : current.textColor
        return {
          ...current,
          styleId: nextDefinition.styleId as DynamicBubbleStyleId,
          surfaceColor,
          outlineColor,
          textColor,
          widthPx: nextDefinition.defaultWidth,
          heightPx: nextDefinition.defaultHeight
        }
      }

      let textColor = current.textColor
      if (styleId === 'title-none' && current.styleId !== 'title-none' && isLightColor(textColor)) textColor = '#20302d'
      if (styleId.startsWith('title-') && styleId !== 'title-none' && current.styleId === 'title-none' && !isLightColor(textColor)) {
        textColor = '#ffffff'
      }
      return { ...current, styleId, textColor }
    })
  }

  const setBubbleSurfaceColor = (nextColor: string) => {
    const normalizedSurfaceColor = normalizeBubbleColor(nextColor, surfaceColor)
    setDraft((current) => ({
      ...current,
      surfaceColor: normalizedSurfaceColor,
      outlineColor: deriveBubbleOutlineColor(normalizedSurfaceColor)
    }))
  }

  const restoreBubbleSurface = () => {
    if (!activeShapeDefinition) return
    setDraft((current) => ({
      ...current,
      surfaceColor: activeShapeDefinition.defaultSurfaceColor,
      outlineColor: activeShapeDefinition.defaultOutlineColor
    }))
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrors((current) => ({ ...current, content: t('bubbleEditor.error.imageFileRequired') }))
      return
    }

    clearGeneratedImageUrl()
    const imageUrl = URL.createObjectURL(file)
    generatedImageUrlRef.current = imageUrl
    const nextImage: DynamicBubbleImageDraft = {
      url: imageUrl,
      name: file.name,
      mimeType: file.type,
      file
    }
    updateDraft('image', nextImage)

    const image = new Image()
    image.onload = () => {
      setDraft((current) => current.image?.url === imageUrl
        ? { ...current, image: { ...current.image, width: image.naturalWidth, height: image.naturalHeight } }
        : current)
    }
    image.src = imageUrl
  }

  const removeImage = () => {
    clearGeneratedImageUrl()
    updateDraft('image', undefined)
    window.requestAnimationFrame(() => imageActionRef.current?.focus())
  }

  const validate = () => {
    if (!draft.bodyText.trim() && (draft.bubbleType !== 'thought' || !draft.image)) {
      setErrors({
        content: draft.bubbleType === 'thought'
          ? t('bubbleEditor.error.thoughtContentRequired')
          : draft.bubbleType === 'title'
            ? t('bubbleEditor.error.titleRequired')
            : t('bubbleEditor.error.bodyRequired')
      })
      if (draft.bubbleType === 'title') titleTextInputRef.current?.focus()
      else bodyInputRef.current?.focus()
      return false
    }

    return true
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isBusy || !validate()) return

    setSubmitting(true)
    setErrors({})
    try {
      const imageFile = draft.bubbleType === 'thought' ? draft.image?.file : undefined
      await onSubmit({
        ...draft,
        title: draft.bubbleType === 'title' ? '' : draft.title,
        image: draft.bubbleType === 'thought' ? draft.image : undefined,
        imageFile,
        removeImage: Boolean(initialImageUrlRef.current) && (draft.bubbleType !== 'thought' || !draft.image),
        surfaceId: draft.surfaceId ?? 'light'
      })
    } catch {
      setErrors((current) => ({ ...current, submit: t('bubbleEditor.error.saveFailed') }))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="dynamic-bubble-editor-backdrop">
      <div className="dynamic-bubble-editor-scrim" aria-hidden="true" />
      <form
        ref={dialogRef}
        className="dynamic-bubble-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onSubmit={handleSubmit}
        tabIndex={-1}
      >
        <header className="dynamic-bubble-editor-heading">
          <div>
            <p>{t('bubbleEditor.eyebrow')}</p>
            <h2 id={titleId}>{t(mode === 'edit' ? 'bubbleEditor.heading.edit' : 'bubbleEditor.heading.add')}</h2>
            <span id={descriptionId}>{t('bubbleEditor.description')}</span>
          </div>
          <button
            type="button"
            className="dynamic-bubble-icon-button"
            aria-label={t('bubbleEditor.closeEditorAria')}
            title={t('common.close')}
            onClick={onCancel}
            disabled={isBusy}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="dynamic-bubble-editor-layout">
          <section className="dynamic-bubble-preview-pane" aria-label={t('bubbleEditor.preview.regionAria')}>
            <div
              className={`dynamic-bubble-stage-preview ${stageBackgroundUrl ? 'has-background' : ''}`}
              style={stageBackgroundUrl ? { backgroundImage: `url("${stageBackgroundUrl}")` } : undefined}
            >
              <span className="dynamic-bubble-stage-grid" aria-hidden="true" />
              <DynamicBubbleVisual
                bubble={previewBubble}
                animate
                playbackKey={playbackKey}
                revealDelayMs={0}
                ariaLabel={t('bubbleEditor.preview.currentAria')}
              />
            </div>
            <div className="dynamic-bubble-preview-actions">
              <div>
                <strong>{t('edit.stagePreview')}</strong>
                <span>16:9</span>
              </div>
              <button
                type="button"
                className="dynamic-bubble-replay-button"
                onClick={() => setPlaybackKey((current) => current + 1)}
                disabled={draft.revealMode !== 'typewriter'}
              >
                <RefreshCw aria-hidden="true" />
                {t('bubbleEditor.preview.replay')}
              </button>
            </div>
          </section>

          <div className="dynamic-bubble-settings-pane">
            <div className="dynamic-bubble-settings-scroll">
              <fieldset className="dynamic-bubble-fieldset">
                <legend><span>1</span>{t('bubbleEditor.section.type')}</legend>
                <div className="dynamic-bubble-type-options">
                  <label className={draft.bubbleType === 'dialogue' ? 'is-selected' : ''}>
                    <input
                      ref={draft.bubbleType === 'dialogue' ? bubbleTypeInputRef : undefined}
                      type="radio"
                      name="bubble-type"
                      value="dialogue"
                      checked={draft.bubbleType === 'dialogue'}
                      onChange={() => handleBubbleTypeChange('dialogue')}
                    />
                    <span className="dynamic-bubble-option-icon"><MessageCircle aria-hidden="true" /></span>
                    <span><strong>{t('bubbleEditor.type.dialogue')}</strong><small>{t('bubbleEditor.type.dialogueHint')}</small></span>
                    <Check className="dynamic-bubble-option-check" aria-hidden="true" />
                  </label>
                  <label className={draft.bubbleType === 'thought' ? 'is-selected' : ''}>
                    <input
                      ref={draft.bubbleType === 'thought' ? bubbleTypeInputRef : undefined}
                      type="radio"
                      name="bubble-type"
                      value="thought"
                      checked={draft.bubbleType === 'thought'}
                      onChange={() => handleBubbleTypeChange('thought')}
                    />
                    <span className="dynamic-bubble-option-icon"><Cloud aria-hidden="true" /></span>
                    <span><strong>{t('bubbleEditor.type.thought')}</strong><small>{t('bubbleEditor.type.thoughtHint')}</small></span>
                    <Check className="dynamic-bubble-option-check" aria-hidden="true" />
                  </label>
                  <label className={draft.bubbleType === 'title' ? 'is-selected' : ''}>
                    <input
                      ref={draft.bubbleType === 'title' ? bubbleTypeInputRef : undefined}
                      type="radio"
                      name="bubble-type"
                      value="title"
                      checked={draft.bubbleType === 'title'}
                      onChange={() => handleBubbleTypeChange('title')}
                    />
                    <span className="dynamic-bubble-option-icon"><Heading aria-hidden="true" /></span>
                    <span><strong>{t('bubbleEditor.type.title')}</strong><small>{t('bubbleEditor.type.titleHint')}</small></span>
                    <Check className="dynamic-bubble-option-check" aria-hidden="true" />
                  </label>
                </div>
              </fieldset>

              <fieldset className="dynamic-bubble-fieldset">
                <legend><span>2</span>{t(isStandaloneTitle ? 'bubbleEditor.section.titleStyle' : 'bubbleEditor.section.bubbleStyle')}</legend>
                <div className={`dynamic-bubble-style-options count-${styles.length}`}>
                  {styles.map((style) => {
                    const styleLabel = t(style.labelKey)
                    const styleDescription = t(style.descriptionKey)
                    const styleDefinition = isStandaloneTitle ? null : getBubbleShapeDefinition(style.id)
                    const swatchSurfaceColor = usesDefaultSurface && styleDefinition
                      ? styleDefinition.defaultSurfaceColor
                      : surfaceColor
                    const swatchOutlineColor = usesDefaultSurface && styleDefinition
                      ? styleDefinition.defaultOutlineColor
                      : outlineColor
                    return (
                    <label
                      key={style.id}
                      className={draft.styleId === style.id ? 'is-selected' : ''}
                      title={`${styleLabel} · ${styleDescription}`}
                    >
                      <input
                        type="radio"
                        name="bubble-style"
                        value={style.id}
                        checked={draft.styleId === style.id}
                        onChange={() => handleStyleChange(style.id)}
                      />
                      {isStandaloneTitle ? (
                        <span
                          className={`dynamic-bubble-title-style-swatch mask-${style.id.replace('title-', '')}`}
                          aria-hidden="true"
                        />
                      ) : (
                        <BubbleShapeSwatch
                          styleId={style.id}
                          surfaceColor={swatchSurfaceColor}
                          outlineColor={swatchOutlineColor}
                        />
                      )}
                      <strong>{styleLabel}</strong>
                      <small>{styleDescription}</small>
                    </label>
                    )
                  })}
                </div>

                {!isStandaloneTitle && (
                  <div className="dynamic-bubble-surface-field">
                    <div className="dynamic-bubble-surface-heading">
                      <span>{t('bubbleEditor.surfaceColor')}</span>
                      <small>{t('bubbleEditor.surfaceColorHint')}</small>
                    </div>
                    <div
                      className="dynamic-bubble-color-options dynamic-bubble-surface-color-options"
                      role="radiogroup"
                      aria-label={t('bubbleEditor.surfaceColor')}
                    >
                      {showStyleDefaultSurface && activeShapeDefinition && (
                        <label
                          className={surfaceMatchesStyleDefault ? 'is-selected' : ''}
                          title={t('bubbleEditor.color.styleDefault')}
                        >
                          <input
                            type="radio"
                            name="bubble-surface-color"
                            value={activeShapeDefinition.defaultSurfaceColor}
                            checked={surfaceMatchesStyleDefault}
                            onChange={restoreBubbleSurface}
                          />
                          <span
                            style={{
                              backgroundColor: activeShapeDefinition.defaultSurfaceColor,
                              borderColor: activeShapeDefinition.defaultOutlineColor
                            }}
                            aria-hidden="true"
                          >
                            {surfaceMatchesStyleDefault && <Check />}
                          </span>
                          <small>{t('bubbleEditor.color.styleDefault')}</small>
                        </label>
                      )}
                      {BUBBLE_SURFACE_COLORS.map((colorOption) => {
                        const colorLabel = t(colorOption.labelKey)
                        const selected = surfaceColor.toLowerCase() === colorOption.color.toLowerCase()
                        return (
                          <label
                            key={colorOption.color}
                            className={selected ? 'is-selected' : ''}
                            title={colorLabel}
                          >
                            <input
                              type="radio"
                              name="bubble-surface-color"
                              value={colorOption.color}
                              checked={selected}
                              onChange={() => setBubbleSurfaceColor(colorOption.color)}
                            />
                            <span
                              style={{
                                backgroundColor: colorOption.color,
                                borderColor: deriveBubbleOutlineColor(colorOption.color)
                              }}
                              aria-hidden="true"
                            >
                              {selected && <Check />}
                            </span>
                            <small>{colorLabel}</small>
                          </label>
                        )
                      })}
                      <label
                        className={`dynamic-bubble-custom-color ${hasCustomSurfaceColor ? 'is-selected' : ''}`}
                        title={t('bubbleEditor.color.custom')}
                      >
                        <input
                          type="color"
                          value={surfaceColor.slice(0, 7)}
                          aria-label={t('bubbleEditor.color.custom')}
                          onChange={(event) => setBubbleSurfaceColor(event.target.value)}
                        />
                        <span
                          aria-hidden="true"
                          style={hasCustomSurfaceColor
                            ? {
                                backgroundColor: surfaceColor,
                                backgroundImage: 'none',
                                borderColor: outlineColor
                              }
                            : undefined}
                        >
                          {hasCustomSurfaceColor && <Check />}
                        </span>
                        <small>{t('bubbleEditor.color.custom')}</small>
                      </label>
                    </div>
                    <button
                      type="button"
                      className="dynamic-bubble-reset-color-button"
                      onClick={restoreBubbleSurface}
                      disabled={usesDefaultSurface}
                      aria-label={t('bubbleEditor.restoreDefaultAria')}
                    >
                      {t('bubbleEditor.restoreDefault')}
                    </button>
                  </div>
                )}
              </fieldset>

              <fieldset className="dynamic-bubble-fieldset">
                <legend><span>3</span>{t('bubbleEditor.section.content')}</legend>
                {isStandaloneTitle ? (
                  <label className="dynamic-bubble-text-field">
                    <span>{t('bubbleEditor.content.titleText')}</span>
                    <input
                      ref={titleTextInputRef}
                      type="text"
                      value={draft.bodyText}
                      maxLength={80}
                      placeholder={t('bubbleEditor.content.titlePlaceholder')}
                      aria-invalid={Boolean(errors.content)}
                      aria-describedby={errors.content ? contentErrorId : undefined}
                      onChange={(event) => updateDraft('bodyText', event.target.value)}
                    />
                    <small>{draft.bodyText.length}/80</small>
                  </label>
                ) : (
                  <label className="dynamic-bubble-text-field">
                    <span>
                      {t('bubbleEditor.content.body')}
                      {draft.bubbleType === 'thought' && <small>{t('bubbleEditor.content.thoughtRequirement')}</small>}
                    </span>
                    <textarea
                      ref={bodyInputRef}
                      value={draft.bodyText}
                      maxLength={280}
                      rows={4}
                      placeholder={t(draft.bubbleType === 'thought'
                        ? 'bubbleEditor.content.thoughtPlaceholder'
                        : 'bubbleEditor.content.dialoguePlaceholder')}
                      aria-invalid={Boolean(errors.content)}
                      aria-describedby={errors.content ? contentErrorId : undefined}
                      onChange={(event) => updateDraft('bodyText', event.target.value)}
                    />
                    <small>{draft.bodyText.length}/280</small>
                  </label>
                )}

                {draft.bubbleType === 'thought' && (
                  <div className="dynamic-bubble-image-field">
                    <div className="dynamic-bubble-field-label">
                      <span>{t('bubbleEditor.image.label')} <small>{t('bubbleEditor.image.optional')}</small></span>
                      <small>{t('bubbleEditor.image.pickerHint')}</small>
                    </div>
                    <input
                      ref={imageInputRef}
                      className="dynamic-bubble-visually-hidden"
                      type="file"
                      accept="image/*"
                      tabIndex={-1}
                      onChange={handleImageChange}
                    />
                    {draft.image ? (
                      <div className="dynamic-bubble-image-selection">
                        <div className="dynamic-bubble-image-selection-preview">
                          <img src={draft.image.url} alt={t('bubbleEditor.image.selectedAlt', { name: draft.image.name })} />
                        </div>
                        <div>
                          <strong>{draft.image.name}</strong>
                          <span>{t('bubbleEditor.image.fitStatus')}</span>
                        </div>
                        <button
                          ref={imageActionRef}
                          type="button"
                          className="dynamic-bubble-small-button"
                          onClick={() => imageInputRef.current?.click()}
                        >
                          {t('bubbleEditor.image.replace')}
                        </button>
                        <button
                          type="button"
                          className="dynamic-bubble-icon-button danger"
                          aria-label={t('bubbleEditor.image.remove')}
                          title={t('bubbleEditor.image.remove')}
                          onClick={removeImage}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        ref={imageActionRef}
                        type="button"
                        className="dynamic-bubble-image-add-button"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        <ImagePlus aria-hidden="true" />
                        <span><strong>{t('bubbleEditor.image.add')}</strong><small>{t('bubbleEditor.image.fitHint')}</small></span>
                      </button>
                    )}
                  </div>
                )}

                {errors.content && (
                  <p id={contentErrorId} className="dynamic-bubble-field-error" role="alert">{errors.content}</p>
                )}
              </fieldset>

              <fieldset className="dynamic-bubble-fieldset">
                <legend><span>4</span>{t('bubbleEditor.section.reveal')}</legend>
                <div className="dynamic-bubble-reveal-options">
                  <label className={draft.revealMode === 'all' ? 'is-selected' : ''}>
                    <input
                      type="radio"
                      name="reveal-mode"
                      value="all"
                      checked={draft.revealMode === 'all'}
                      onChange={() => updateDraft('revealMode', 'all')}
                    />
                    <strong>{t('bubbleEditor.reveal.all')}</strong>
                    <small>{t('bubbleEditor.reveal.allHint')}</small>
                  </label>
                  <label className={draft.revealMode === 'typewriter' ? 'is-selected' : ''}>
                    <input
                      type="radio"
                      name="reveal-mode"
                      value="typewriter"
                      checked={draft.revealMode === 'typewriter'}
                      onChange={() => {
                        updateDraft('revealMode', 'typewriter')
                        setPlaybackKey((current) => current + 1)
                      }}
                    />
                    <strong>{t('bubbleEditor.reveal.typewriter')}</strong>
                    <small>{t('bubbleEditor.reveal.typewriterHint')}</small>
                  </label>
                </div>

                {draft.revealMode === 'typewriter' && (
                  <label className="dynamic-bubble-range-field">
                    <span>
                      <strong>{t('bubbleEditor.reveal.speed')}</strong>
                      <output>{t(draft.revealIntervalMs <= 55
                        ? 'bubbleEditor.speed.fast'
                        : draft.revealIntervalMs >= 120
                          ? 'bubbleEditor.speed.slow'
                          : 'bubbleEditor.speed.standard')}</output>
                    </span>
                    <input
                      type="range"
                      min="35"
                      max="160"
                      step="5"
                      value={195 - draft.revealIntervalMs}
                      aria-label={t('bubbleEditor.reveal.speedAria')}
                      onChange={(event) => {
                        updateDraft('revealIntervalMs', 195 - Number(event.target.value))
                        setPlaybackKey((current) => current + 1)
                      }}
                    />
                    <small>
                      <span>{t('bubbleEditor.speed.slow')}</span>
                      <span>{t('bubbleEditor.speed.standard')}</span>
                      <span>{t('bubbleEditor.speed.fast')}</span>
                    </small>
                  </label>
                )}
              </fieldset>

              <fieldset className="dynamic-bubble-fieldset">
                <legend><span>5</span>{t('bubbleEditor.section.textAppearance')}</legend>
                <label className="dynamic-bubble-range-field">
                  <span><strong>{t('bubbleEditor.text.size')}</strong><output>{draft.fontSizePx}px</output></span>
                  <input
                    type="range"
                    min="32"
                    max="84"
                    step="2"
                    value={draft.fontSizePx}
                    onChange={(event) => updateDraft('fontSizePx', Number(event.target.value))}
                  />
                  <small>
                    <span>{t('bubbleEditor.size.small')}</span>
                    <span>{t('bubbleEditor.size.standard')}</span>
                    <span>{t('bubbleEditor.size.large')}</span>
                  </small>
                </label>

                <div className="dynamic-bubble-color-field">
                  <span>{t('bubbleEditor.text.color')}</span>
                  <div className="dynamic-bubble-color-options">
                    {TEXT_COLORS.map((textColor) => {
                      const colorLabel = t(textColor.labelKey)
                      return (
                      <label key={textColor.color} title={colorLabel}>
                        <input
                          type="radio"
                          name="text-color"
                          value={textColor.color}
                          checked={draft.textColor.toLowerCase() === textColor.color.toLowerCase()}
                          onChange={() => updateDraft('textColor', textColor.color)}
                        />
                        <span style={{ backgroundColor: textColor.color }} aria-hidden="true">
                          {draft.textColor.toLowerCase() === textColor.color.toLowerCase() && <Check />}
                        </span>
                        <small>{colorLabel}</small>
                      </label>
                      )
                    })}
                    <label className={`dynamic-bubble-custom-color ${hasCustomTextColor ? 'is-selected' : ''}`}>
                      <input
                        type="color"
                        value={draft.textColor}
                        aria-label={t('bubbleEditor.text.customColorAria')}
                        onChange={(event) => updateDraft('textColor', event.target.value)}
                      />
                      <span
                        aria-hidden="true"
                        style={hasCustomTextColor ? { backgroundColor: draft.textColor, backgroundImage: 'none' } : undefined}
                      />
                      <small>{t('bubbleEditor.color.custom')}</small>
                    </label>
                  </div>
                  {hasLowTextContrast && (
                    <p className="dynamic-bubble-contrast-note" role="status">
                      {isStandaloneTitle
                        ? t('bubbleEditor.contrastMaskText')
                        : t(usesDarkSurface
                            ? 'bubbleEditor.contrastUseLight'
                            : 'bubbleEditor.contrastUseDark')}
                    </p>
                  )}
                </div>

                {isStandaloneTitle && draft.styleId !== 'title-none' && (
                  <div className="dynamic-bubble-mask-appearance">
                    <div className="dynamic-bubble-color-field">
                      <span>{t('bubbleEditor.mask.color')}</span>
                      <div className="dynamic-bubble-color-options">
                        {MASK_COLORS.map((colorOption) => {
                          const colorLabel = t(colorOption.labelKey)
                          return (
                          <label key={colorOption.color} title={colorLabel}>
                            <input
                              type="radio"
                              name="mask-color"
                              value={colorOption.color}
                              checked={maskColor.toLowerCase() === colorOption.color.toLowerCase()}
                              onChange={() => updateDraft('maskColor', colorOption.color)}
                            />
                            <span style={{ backgroundColor: colorOption.color }} aria-hidden="true">
                              {maskColor.toLowerCase() === colorOption.color.toLowerCase() && <Check />}
                            </span>
                            <small>{colorLabel}</small>
                          </label>
                          )
                        })}
                        <label className={`dynamic-bubble-custom-color ${hasCustomMaskColor ? 'is-selected' : ''}`}>
                          <input
                            type="color"
                            value={maskColor}
                            aria-label={t('bubbleEditor.mask.customColorAria')}
                            onChange={(event) => updateDraft('maskColor', event.target.value)}
                          />
                          <span
                            aria-hidden="true"
                            style={hasCustomMaskColor ? { backgroundColor: maskColor, backgroundImage: 'none' } : undefined}
                          />
                          <small>{t('bubbleEditor.color.custom')}</small>
                        </label>
                      </div>
                    </div>

                    <label className="dynamic-bubble-range-field">
                      <span>
                        <strong>{t('bubbleEditor.mask.opacity')}</strong>
                        <output>{Math.round(draft.maskOpacity * 100)}%</output>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={Math.round(draft.maskOpacity * 100)}
                        aria-label={t('bubbleEditor.mask.opacity')}
                        onChange={(event) => updateDraft('maskOpacity', Number(event.target.value) / 100)}
                      />
                      <small>
                        <span>{t('bubbleEditor.opacity.transparent')}</span>
                        <span>{t('bubbleEditor.opacity.semiTransparent')}</span>
                        <span>{t('bubbleEditor.opacity.opaque')}</span>
                      </small>
                    </label>
                  </div>
                )}
              </fieldset>
            </div>
          </div>
        </div>

        <footer className="dynamic-bubble-editor-actions">
          <div className="dynamic-bubble-action-status" aria-live="polite">
            {errors.submit && <p role="alert">{errors.submit}</p>}
          </div>
          <button type="button" className="dynamic-bubble-secondary-button" onClick={onCancel} disabled={isBusy}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="dynamic-bubble-primary-button" disabled={isBusy}>
            {isBusy ? t('bubbleEditor.saving') : t(mode === 'edit' ? 'common.save' : 'bubbleEditor.heading.add')}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  )
}

export default DynamicBubbleEditor
