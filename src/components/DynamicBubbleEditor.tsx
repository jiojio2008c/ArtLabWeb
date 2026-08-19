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

const DIALOGUE_STYLES: Array<{ id: DynamicBubbleStyleId; label: string; description: string }> = [
  { id: 'dialogue-rounded-left', label: '圆润·左', description: '尾巴向左' },
  { id: 'dialogue-rounded-right', label: '圆润·右', description: '尾巴向右' },
  { id: 'dialogue-soft-left', label: '轻柔·左', description: '尾巴向左' },
  { id: 'dialogue-soft-right', label: '轻柔·右', description: '尾巴向右' },
  { id: 'dialogue-comic-left', label: '漫画·左', description: '尾巴向左' },
  { id: 'dialogue-comic-right', label: '漫画·右', description: '尾巴向右' }
]

const THOUGHT_STYLES: Array<{ id: DynamicBubbleStyleId; label: string; description: string }> = [
  { id: 'thought-cloud-left', label: '云朵·左', description: '尾巴向左' },
  { id: 'thought-cloud-right', label: '云朵·右', description: '尾巴向右' },
  { id: 'thought-soft-left', label: '柔光·左', description: '尾巴向左' },
  { id: 'thought-soft-right', label: '柔光·右', description: '尾巴向右' }
]

const TITLE_STYLES: Array<{ id: DynamicBubbleStyleId; label: string; description: string }> = [
  { id: 'title-rounded', label: '圆角', description: '经典遮罩' },
  { id: 'title-pill', label: '胶囊', description: '柔和圆润' },
  { id: 'title-ticket', label: '标签', description: '俐落切角' },
  { id: 'title-underline', label: '下划线', description: '轻量简洁' },
  { id: 'title-none', label: '无', description: '纯文字' }
]

const LEGACY_TITLE_MASK_IDS: DynamicBubbleTitleMaskId[] = ['rounded', 'pill', 'ticket', 'underline', 'none']

const TEXT_COLORS = [
  { label: '墨黑', color: '#20302d' },
  { label: '白色', color: '#ffffff' },
  { label: '深蓝', color: '#173b5f' },
  { label: '深绿', color: '#175a49' },
  { label: '暖红', color: '#8b332c' },
  { label: '金色', color: '#b87512' }
]

const MASK_COLORS = [
  { label: '深墨', color: '#263a3b' },
  { label: '青蓝', color: '#0c8fa4' },
  { label: '珊瑚', color: '#dd6859' },
  { label: '暖阳', color: '#c88722' },
  { label: '紫罗兰', color: '#7567b4' },
  { label: '白色', color: '#ffffff' }
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const getStylesForType = (bubbleType: DynamicBubbleType) => {
  if (bubbleType === 'thought') return THOUGHT_STYLES
  if (bubbleType === 'title') return TITLE_STYLES
  return DIALOGUE_STYLES
}

const isLightColor = (color: string) => {
  const normalized = color.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return false
  const channels = [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) / 255)
  const linearChannels = channels.map((channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ))
  const luminance = 0.2126 * linearChannels[0] + 0.7152 * linearChannels[1] + 0.0722 * linearChannels[2]
  return luminance > 0.58
}

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
  titleMaskId: 'rounded',
  paletteId: 'ocean',
  maskColor: '#0c8fa4',
  maskOpacity: 0.92,
  widthPx: 1080,
  heightPx: 480
}

const normalizeInitialValue = (initialValue?: Partial<DynamicBubbleDraft>): DynamicBubbleDraft => {
  const bubbleType = initialValue?.bubbleType ?? DEFAULT_BUBBLE.bubbleType
  const allowedStyles = getStylesForType(bubbleType)
  const styleId = allowedStyles.some(({ id }) => id === initialValue?.styleId)
    ? initialValue?.styleId as DynamicBubbleStyleId
    : allowedStyles[0].id

  return {
    ...DEFAULT_BUBBLE,
    ...initialValue,
    bubbleType,
    styleId,
    titleMaskId: LEGACY_TITLE_MASK_IDS.includes(initialValue?.titleMaskId as DynamicBubbleTitleMaskId)
      ? initialValue?.titleMaskId as DynamicBubbleTitleMaskId
      : DEFAULT_BUBBLE.titleMaskId,
    paletteId: initialValue?.paletteId ?? (bubbleType === 'thought' ? 'ink' : 'ocean'),
    maskColor: initialValue?.maskColor ?? DEFAULT_BUBBLE.maskColor,
    maskOpacity: clamp(initialValue?.maskOpacity ?? DEFAULT_BUBBLE.maskOpacity, 0, 1),
    widthPx: initialValue?.widthPx ?? (bubbleType === 'thought' ? 940 : bubbleType === 'title' ? 900 : 1080),
    heightPx: initialValue?.heightPx ?? (bubbleType === 'thought' ? 680 : bubbleType === 'title' ? 220 : 480)
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
  const usesDarkSurface = draft.styleId.startsWith('dialogue-comic')
  const hasLowTextContrast = isStandaloneTitle
    ? draft.styleId !== 'title-none' && isLightColor(draft.textColor) === isLightColor(maskColor)
    : usesDarkSurface ? !isLightColor(draft.textColor) : isLightColor(draft.textColor)
  const previewBubble = useMemo<DynamicBubbleDraft>(() => ({
    ...draft,
    bodyText: draft.bodyText || (draft.bubbleType === 'thought' && draft.image
      ? ''
      : draft.bubbleType === 'title' ? '在这里输入标题' : '在这里输入气泡内容')
  }), [draft])

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
    setDraft((current) => ({
      ...current,
      bubbleType,
      styleId: bubbleType === 'thought'
        ? 'thought-cloud-right'
        : bubbleType === 'title' ? 'title-rounded' : 'dialogue-rounded-right',
      title: bubbleType === 'title' ? '' : current.title,
      bodyText: bubbleType === 'title' && !current.bodyText.trim()
        ? current.title
        : current.bodyText,
      textColor: bubbleType === 'title' ? '#ffffff' : '#20302d',
      paletteId: bubbleType === 'thought' ? 'ink' : 'ocean',
      maskColor: current.maskColor ?? '#0c8fa4',
      maskOpacity: clamp(current.maskOpacity, 0, 1),
      widthPx: bubbleType === 'thought' ? 940 : bubbleType === 'title' ? 900 : 1080,
      heightPx: bubbleType === 'thought' ? 680 : bubbleType === 'title' ? 220 : 480
    }))
    setErrors((current) => ({ ...current, content: undefined, submit: undefined }))
    setPlaybackKey((current) => current + 1)
  }

  const handleStyleChange = (styleId: DynamicBubbleStyleId) => {
    setDraft((current) => {
      const wasDarkSurface = current.styleId.startsWith('dialogue-comic')
      const nextUsesDarkSurface = styleId.startsWith('dialogue-comic')
      let textColor = current.textColor
      if (nextUsesDarkSurface && !wasDarkSurface && !isLightColor(textColor)) textColor = '#ffffff'
      if (!nextUsesDarkSurface && wasDarkSurface && isLightColor(textColor)) textColor = '#20302d'
      if (styleId === 'title-none' && current.styleId !== 'title-none' && isLightColor(textColor)) textColor = '#20302d'
      if (styleId.startsWith('title-') && styleId !== 'title-none' && current.styleId === 'title-none' && !isLightColor(textColor)) {
        textColor = '#ffffff'
      }
      return { ...current, styleId, textColor }
    })
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrors((current) => ({ ...current, content: '请选择图片文件。' }))
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
          ? '请输入文字或添加一张图片。'
          : draft.bubbleType === 'title' ? '请输入标题文字。' : '请输入气泡正文。'
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
      setErrors((current) => ({ ...current, submit: '暂时无法保存，请稍后再试。' }))
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
            <p>文字物件</p>
            <h2 id={titleId}>{mode === 'edit' ? '编辑气泡' : '添加气泡'}</h2>
            <span id={descriptionId}>填写内容并在左侧查看效果</span>
          </div>
          <button
            type="button"
            className="dynamic-bubble-icon-button"
            aria-label="关闭气泡编辑器"
            title="关闭"
            onClick={onCancel}
            disabled={isBusy}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="dynamic-bubble-editor-layout">
          <section className="dynamic-bubble-preview-pane" aria-label="气泡预览">
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
                ariaLabel="当前气泡效果预览"
              />
            </div>
            <div className="dynamic-bubble-preview-actions">
              <div>
                <strong>舞台预览</strong>
                <span>16:9</span>
              </div>
              <button
                type="button"
                className="dynamic-bubble-replay-button"
                onClick={() => setPlaybackKey((current) => current + 1)}
                disabled={draft.revealMode !== 'typewriter'}
              >
                <RefreshCw aria-hidden="true" />
                重播
              </button>
            </div>
          </section>

          <div className="dynamic-bubble-settings-pane">
            <div className="dynamic-bubble-settings-scroll">
              <fieldset className="dynamic-bubble-fieldset">
                <legend><span>1</span>气泡类型</legend>
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
                    <span><strong>对话气泡</strong><small>角色说话</small></span>
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
                    <span><strong>想象气泡</strong><small>想法或画面</small></span>
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
                    <span><strong>标题遮罩</strong><small>独立标题文字</small></span>
                    <Check className="dynamic-bubble-option-check" aria-hidden="true" />
                  </label>
                </div>
              </fieldset>

              <fieldset className="dynamic-bubble-fieldset">
                <legend><span>2</span>{isStandaloneTitle ? '标题样式' : '气泡样式'}</legend>
                <div className={`dynamic-bubble-style-options count-${styles.length}`}>
                  {styles.map((style) => (
                    <label key={style.id} className={draft.styleId === style.id ? 'is-selected' : ''}>
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
                        <span
                          className={`dynamic-bubble-style-swatch style-${style.id.replace(/-(left|right)$/, '')} direction-${style.id.endsWith('-left') ? 'left' : 'right'}`}
                          aria-hidden="true"
                        >
                          <i />
                        </span>
                      )}
                      <strong>{style.label}</strong>
                      <small>{style.description}</small>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="dynamic-bubble-fieldset">
                <legend><span>3</span>内容</legend>
                {isStandaloneTitle ? (
                  <label className="dynamic-bubble-text-field">
                    <span>标题文字</span>
                    <input
                      ref={titleTextInputRef}
                      type="text"
                      value={draft.bodyText}
                      maxLength={80}
                      placeholder="输入要显示的标题"
                      aria-invalid={Boolean(errors.content)}
                      aria-describedby={errors.content ? contentErrorId : undefined}
                      onChange={(event) => updateDraft('bodyText', event.target.value)}
                    />
                    <small>{draft.bodyText.length}/80</small>
                  </label>
                ) : (
                  <label className="dynamic-bubble-text-field">
                    <span>正文 {draft.bubbleType === 'thought' && <small>文字或图片至少填写一项</small>}</span>
                    <textarea
                      ref={bodyInputRef}
                      value={draft.bodyText}
                      maxLength={280}
                      rows={4}
                      placeholder={draft.bubbleType === 'thought' ? '输入想法，也可以只添加图片' : '输入角色要说的话'}
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
                      <span>图片 <small>可选</small></span>
                      <small>系统会打开相册、拍照或文件</small>
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
                          <img src={draft.image.url} alt={`已选择：${draft.image.name}`} />
                        </div>
                        <div>
                          <strong>{draft.image.name}</strong>
                          <span>完整居中显示</span>
                        </div>
                        <button
                          ref={imageActionRef}
                          type="button"
                          className="dynamic-bubble-small-button"
                          onClick={() => imageInputRef.current?.click()}
                        >
                          更换
                        </button>
                        <button
                          type="button"
                          className="dynamic-bubble-icon-button danger"
                          aria-label="移除图片"
                          title="移除图片"
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
                        <span><strong>添加图片</strong><small>任何尺寸都会完整显示</small></span>
                      </button>
                    )}
                  </div>
                )}

                {errors.content && (
                  <p id={contentErrorId} className="dynamic-bubble-field-error" role="alert">{errors.content}</p>
                )}
              </fieldset>

              <fieldset className="dynamic-bubble-fieldset">
                <legend><span>4</span>显示方式</legend>
                <div className="dynamic-bubble-reveal-options">
                  <label className={draft.revealMode === 'all' ? 'is-selected' : ''}>
                    <input
                      type="radio"
                      name="reveal-mode"
                      value="all"
                      checked={draft.revealMode === 'all'}
                      onChange={() => updateDraft('revealMode', 'all')}
                    />
                    <strong>全部显示</strong>
                    <small>立即显示完整内容</small>
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
                    <strong>逐字显示</strong>
                    <small>文字按顺序出现</small>
                  </label>
                </div>

                {draft.revealMode === 'typewriter' && (
                  <label className="dynamic-bubble-range-field">
                    <span><strong>显示速度</strong><output>{draft.revealIntervalMs <= 55 ? '快' : draft.revealIntervalMs >= 120 ? '慢' : '标准'}</output></span>
                    <input
                      type="range"
                      min="35"
                      max="160"
                      step="5"
                      value={195 - draft.revealIntervalMs}
                      aria-label="逐字显示速度"
                      onChange={(event) => {
                        updateDraft('revealIntervalMs', 195 - Number(event.target.value))
                        setPlaybackKey((current) => current + 1)
                      }}
                    />
                    <small><span>慢</span><span>标准</span><span>快</span></small>
                  </label>
                )}
              </fieldset>

              <fieldset className="dynamic-bubble-fieldset">
                <legend><span>5</span>文字外观</legend>
                <label className="dynamic-bubble-range-field">
                  <span><strong>文字大小</strong><output>{draft.fontSizePx}px</output></span>
                  <input
                    type="range"
                    min="32"
                    max="84"
                    step="2"
                    value={draft.fontSizePx}
                    onChange={(event) => updateDraft('fontSizePx', Number(event.target.value))}
                  />
                  <small><span>小</span><span>标准</span><span>大</span></small>
                </label>

                <div className="dynamic-bubble-color-field">
                  <span>文字颜色</span>
                  <div className="dynamic-bubble-color-options">
                    {TEXT_COLORS.map((textColor) => (
                      <label key={textColor.color} title={textColor.label}>
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
                        <small>{textColor.label}</small>
                      </label>
                    ))}
                    <label className={`dynamic-bubble-custom-color ${hasCustomTextColor ? 'is-selected' : ''}`}>
                      <input
                        type="color"
                        value={draft.textColor}
                        aria-label="自定义文字颜色"
                        onChange={(event) => updateDraft('textColor', event.target.value)}
                      />
                      <span
                        aria-hidden="true"
                        style={hasCustomTextColor ? { backgroundColor: draft.textColor, backgroundImage: 'none' } : undefined}
                      />
                      <small>自定义</small>
                    </label>
                  </div>
                  {hasLowTextContrast && (
                    <p className="dynamic-bubble-contrast-note" role="status">
                      {isStandaloneTitle
                        ? '文字与遮罩颜色接近，建议换一种文字颜色。'
                        : `对比度偏低，建议使用${usesDarkSurface ? '浅色' : '深色'}文字。`}
                    </p>
                  )}
                </div>

                {isStandaloneTitle && draft.styleId !== 'title-none' && (
                  <div className="dynamic-bubble-mask-appearance">
                    <div className="dynamic-bubble-color-field">
                      <span>遮罩颜色</span>
                      <div className="dynamic-bubble-color-options">
                        {MASK_COLORS.map((colorOption) => (
                          <label key={colorOption.color} title={colorOption.label}>
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
                            <small>{colorOption.label}</small>
                          </label>
                        ))}
                        <label className={`dynamic-bubble-custom-color ${hasCustomMaskColor ? 'is-selected' : ''}`}>
                          <input
                            type="color"
                            value={maskColor}
                            aria-label="自定义遮罩颜色"
                            onChange={(event) => updateDraft('maskColor', event.target.value)}
                          />
                          <span
                            aria-hidden="true"
                            style={hasCustomMaskColor ? { backgroundColor: maskColor, backgroundImage: 'none' } : undefined}
                          />
                          <small>自定义</small>
                        </label>
                      </div>
                    </div>

                    <label className="dynamic-bubble-range-field">
                      <span>
                        <strong>遮罩透明度</strong>
                        <output>{Math.round(draft.maskOpacity * 100)}%</output>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={Math.round(draft.maskOpacity * 100)}
                        aria-label="遮罩透明度"
                        onChange={(event) => updateDraft('maskOpacity', Number(event.target.value) / 100)}
                      />
                      <small><span>透明</span><span>半透明</span><span>不透明</span></small>
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
            取消
          </button>
          <button type="submit" className="dynamic-bubble-primary-button" disabled={isBusy}>
            {isBusy ? '正在保存…' : mode === 'edit' ? '保存' : '添加气泡'}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  )
}

export default DynamicBubbleEditor
