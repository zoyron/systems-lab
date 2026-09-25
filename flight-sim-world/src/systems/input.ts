export type InputAction = 'camera' | 'reset' | 'flaps' | 'pause' | 'mute' | 'timeOfDay'

export type ContinuousInput =
  | 'pitch-up'
  | 'pitch-down'
  | 'roll-left'
  | 'roll-right'
  | 'yaw-left'
  | 'yaw-right'
  | 'throttle-up'
  | 'throttle-down'
  | 'boost'
  | 'brakes'

export interface OrbitDelta {
  x: number
  y: number
  zoom: number
}

export interface OrbitInput {
  yaw: number
  pitch: number
  zoom: number
}

export interface MouseAim {
  pitch: number
  roll: number
}

export interface InputState {
  pitch: number
  roll: number
  yaw: number
  throttle: number
  throttleDelta: number
  throttleAxis: number
  boost: boolean
  reverse: number
  brakes: number
  brake: boolean
  mousePitch: number
  mouseRoll: number
  aim: MouseAim
  heldKeys: readonly string[]
  heldKeyCodes: readonly string[]
  orbitDelta: OrbitDelta
}

export type InputControls = InputState

export type InputActionHandler = (event: KeyboardEvent) => void

export interface InputManagerOptions {
  target?: EventTarget | null
  keyboardTarget?: EventTarget | null
  onAction?: (action: InputAction, event: KeyboardEvent) => void
  onCamera?: InputActionHandler
  onReset?: InputActionHandler
  onFlaps?: InputActionHandler
  onPause?: InputActionHandler
  onMute?: InputActionHandler
  handlers?: Partial<Record<InputAction, InputActionHandler>>
}

export const CONTROL_DEFINITIONS = [
  { action: 'Throttle', keys: ['W / S'] },
  { action: 'Boost', keys: ['Shift'] },
  { action: 'Yaw / rudder', keys: ['A / D'] },
  { action: 'Roll / turn', keys: ['← / →'] },
  { action: 'Nose', keys: ['↑ Down', '↓ Up'] },
  { action: 'Brake', keys: ['Space'] },
  { action: 'Mouse aim', keys: ['Move'] },
  { action: 'Mute', keys: ['M'] },
  { action: 'Camera', keys: ['C'] },
  { action: 'Reset', keys: ['R'] },
  { action: 'Pause', keys: ['P / Esc'] },
  { action: 'Time of day', keys: ['T', 'Shift + T'] },
  { action: 'Flaps', keys: ['F'] },
  { action: 'Orbit', keys: ['Drag', 'Wheel'] },
] as const

const ACTION_VALUES: readonly InputAction[] = ['camera', 'reset', 'flaps', 'pause', 'mute', 'timeOfDay']
const MAX_MOUSE_PITCH = 0.35
const MAX_MOUSE_ROLL = 0.6
const MOUSE_PITCH_SENSITIVITY = 0.00075
const MOUSE_ROLL_SENSITIVITY = 0.00082
const AIM_DECAY_RATE = 1.7

const isInputAction = (value: ContinuousInput | InputAction): value is InputAction =>
  ACTION_VALUES.includes(value as InputAction)

const keyMatches = (event: KeyboardEvent, code: string, key: string): boolean => {
  const eventKey = typeof event.key === 'string' ? event.key : ''
  const eventCode = typeof event.code === 'string' ? event.code : ''
  const normalizedKey = eventKey.length === 1 ? eventKey.toLowerCase() : eventKey
  const normalizedExpectedKey = key.length === 1 ? key.toLowerCase() : key
  return eventCode === code || normalizedKey === normalizedExpectedKey
}

const resolveCommand = (event: KeyboardEvent): ContinuousInput | InputAction | null => {
  if (keyMatches(event, 'KeyW', 'w')) return 'throttle-up'
  if (keyMatches(event, 'KeyS', 's')) return 'throttle-down'
  if (keyMatches(event, 'KeyA', 'a')) return 'yaw-left'
  if (keyMatches(event, 'KeyD', 'd')) return 'yaw-right'
  if (keyMatches(event, 'ArrowLeft', 'ArrowLeft') || keyMatches(event, '', 'Left')) return 'roll-left'
  if (keyMatches(event, 'ArrowRight', 'ArrowRight') || keyMatches(event, '', 'Right')) return 'roll-right'
  if (keyMatches(event, 'ArrowUp', 'ArrowUp') || keyMatches(event, '', 'Up')) return 'pitch-down'
  if (keyMatches(event, 'ArrowDown', 'ArrowDown') || keyMatches(event, '', 'Down')) return 'pitch-up'
  if (keyMatches(event, 'ShiftLeft', 'Shift') || keyMatches(event, 'ShiftRight', 'Shift')) return 'boost'
  if (keyMatches(event, 'Space', ' ')) return 'brakes'
  if (keyMatches(event, 'KeyC', 'c')) return 'camera'
  if (keyMatches(event, 'KeyR', 'r')) return 'reset'
  if (keyMatches(event, 'KeyF', 'f')) return 'flaps'
  if (keyMatches(event, 'KeyP', 'p') || keyMatches(event, 'Escape', 'Escape')) return 'pause'
  if (keyMatches(event, 'KeyM', 'm')) return 'mute'
  if (keyMatches(event, 'KeyT', 't')) return 'timeOfDay'
  return null
}

const commandKeyId = (event: KeyboardEvent): string => {
  if (typeof event.code === 'string' && event.code.length > 0) return event.code
  return `key:${typeof event.key === 'string' ? event.key.toLowerCase() : ''}`
}

const keyLabel = (event: KeyboardEvent): string => {
  const key = typeof event.key === 'string' ? event.key : ''
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toUpperCase()
  if (key === 'ArrowUp' || key === 'Up') return 'ArrowUp'
  if (key === 'ArrowDown' || key === 'Down') return 'ArrowDown'
  if (key === 'ArrowLeft' || key === 'Left') return 'ArrowLeft'
  if (key === 'ArrowRight' || key === 'Right') return 'ArrowRight'
  if (key === 'Shift') return 'Shift'
  if (key === 'Escape') return 'Escape'
  return key || 'Unknown'
}

const getElementTarget = (target: EventTarget | null): Element | null => {
  if (target === null || typeof Element === 'undefined') return null
  return target instanceof Element ? target : null
}

export const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = getElementTarget(target)
  if (element === null) return false
  if (typeof HTMLInputElement !== 'undefined' && element instanceof HTMLInputElement) return true
  if (typeof HTMLTextAreaElement !== 'undefined' && element instanceof HTMLTextAreaElement) return true
  if (typeof HTMLSelectElement !== 'undefined' && element instanceof HTMLSelectElement) return true
  return typeof HTMLElement !== 'undefined' && element instanceof HTMLElement && element.isContentEditable
}

const isUiTarget = (target: EventTarget | null): boolean => {
  const element = getElementTarget(target)
  if (element === null) return false
  return element.closest('#ui-root, button, input, select, textarea, a, [role="button"], [data-ui]') !== null
}

const clampUnit = (value: number): number => Math.max(-1, Math.min(1, value))
const clamp01 = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0

export const advanceThrottle = (current: number, throttleDelta: number, delta: number, boost = false): number => {
  if (boost) return clamp01(current)
  const safeDelta = Number.isFinite(delta) ? Math.max(0, Math.min(0.25, delta)) : 0
  return clamp01(clamp01(current) + clampUnit(throttleDelta) * safeDelta * 0.45)
}

const defaultPointerTarget = (): EventTarget | null => {
  if (typeof document === 'undefined') return null
  return document.getElementById('scene') ?? document.body ?? null
}

const defaultKeyboardTarget = (): EventTarget | null => {
  if (typeof window !== 'undefined') return window
  if (typeof document !== 'undefined') return document
  return null
}

const isEventTarget = (value: EventTarget | InputManagerOptions | null): value is EventTarget => {
  if (typeof value !== 'object' || value === null) return false
  if (!('addEventListener' in value)) return false
  return typeof value.addEventListener === 'function'
}

export class InputManager {
  private readonly pointerTarget: EventTarget | null
  private readonly keyboardTarget: EventTarget | null
  private readonly actionHandler?: (action: InputAction, event: KeyboardEvent) => void
  private readonly handlers: Partial<Record<InputAction, InputActionHandler>>
  private readonly heldKeys = new Set<string>()
  private readonly heldKeyLabels = new Map<string, number>()
  private readonly heldCommands = new Map<ContinuousInput, number>()
  private orbitValue: OrbitDelta = { x: 0, y: 0, zoom: 0 }
  private actionQueue: InputAction[] = []
  private pointerId: number | null = null
  private pointerButton = 0
  private pointerX = 0
  private pointerY = 0
  private hasPointerPosition = false
  private aimPitch = 0
  private aimRoll = 0
  private isEnabled = true
  private isAttached = false

  private readonly onKeyDown = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent
    if (isUiTarget(keyboardEvent.target) || isEditableTarget(keyboardEvent.target)) return
    const command = resolveCommand(keyboardEvent)
    if (command === null || (!this.isEnabled && !isInputAction(command))) return
    keyboardEvent.preventDefault()
    const keyId = commandKeyId(keyboardEvent)
    if (isInputAction(command)) {
      if (keyboardEvent.repeat || this.heldKeys.has(keyId)) return
      this.heldKeys.add(keyId)
      const label = keyLabel(keyboardEvent)
      this.heldKeyLabels.set(label, (this.heldKeyLabels.get(label) ?? 0) + 1)
      this.actionQueue.push(command)
      this.dispatchAction(command, keyboardEvent)
      return
    }
    if (this.heldKeys.has(keyId)) return
    this.heldKeys.add(keyId)
    const label = keyLabel(keyboardEvent)
    this.heldKeyLabels.set(label, (this.heldKeyLabels.get(label) ?? 0) + 1)
    this.heldCommands.set(command, (this.heldCommands.get(command) ?? 0) + 1)
  }

  private readonly onKeyUp = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent
    const command = resolveCommand(keyboardEvent)
    if (command === null) return
    if ((!this.isEnabled && !isInputAction(command)) || isUiTarget(keyboardEvent.target) || isEditableTarget(keyboardEvent.target)) return
    keyboardEvent.preventDefault()
    const keyId = commandKeyId(keyboardEvent)
    if (!this.heldKeys.delete(keyId)) return
    const label = keyLabel(keyboardEvent)
    const labelCount = this.heldKeyLabels.get(label) ?? 0
    if (labelCount <= 1) this.heldKeyLabels.delete(label)
    else this.heldKeyLabels.set(label, labelCount - 1)
    if (!isInputAction(command)) {
      const count = this.heldCommands.get(command) ?? 0
      if (count <= 1) this.heldCommands.delete(command)
      else this.heldCommands.set(command, count - 1)
    }
  }

  private readonly onBlur = (): void => {
    this.clearHeldInput()
  }

  private readonly onPointerDown = (event: Event): void => {
    if (!this.isEnabled || isUiTarget(event.target)) return
    const pointerEvent = event as PointerEvent
    const button = typeof pointerEvent.button === 'number' ? pointerEvent.button : 0
    if (button !== 0 && button !== 2) return
    const pointerId = typeof pointerEvent.pointerId === 'number' ? pointerEvent.pointerId : 0
    const clientX = typeof pointerEvent.clientX === 'number' ? pointerEvent.clientX : 0
    const clientY = typeof pointerEvent.clientY === 'number' ? pointerEvent.clientY : 0
    this.pointerId = pointerId
    this.pointerButton = button
    this.pointerX = clientX
    this.pointerY = clientY
    this.hasPointerPosition = true
    const target = getElementTarget(event.currentTarget)
    if (target !== null && 'setPointerCapture' in target) {
      try {
        ;(target as Element & { setPointerCapture: (id: number) => void }).setPointerCapture(pointerId)
      } catch {
        this.pointerId = pointerId
      }
    }
    event.preventDefault()
  }

  private readonly onMouseDown = (event: Event): void => {
    if (this.pointerId !== null) return
    this.onPointerDown(event)
  }

  private readonly onPointerMove = (event: Event): void => {
    if (!this.isEnabled || isUiTarget(event.target)) return
    const pointerEvent = event as PointerEvent
    const clientX = typeof pointerEvent.clientX === 'number' ? pointerEvent.clientX : this.pointerX
    const clientY = typeof pointerEvent.clientY === 'number' ? pointerEvent.clientY : this.pointerY
    if (!this.hasPointerPosition) {
      this.pointerX = clientX
      this.pointerY = clientY
      this.hasPointerPosition = true
      return
    }
    const deltaX = clientX - this.pointerX
    const deltaY = clientY - this.pointerY
    this.pointerX = clientX
    this.pointerY = clientY
    this.aimPitch = Math.max(-MAX_MOUSE_PITCH, Math.min(MAX_MOUSE_PITCH, this.aimPitch + deltaY * MOUSE_PITCH_SENSITIVITY))
    this.aimRoll = Math.max(-MAX_MOUSE_ROLL, Math.min(MAX_MOUSE_ROLL, this.aimRoll + deltaX * MOUSE_ROLL_SENSITIVITY))
    if (this.pointerId !== null) {
      const eventPointerId = typeof pointerEvent.pointerId === 'number' ? pointerEvent.pointerId : 0
      if (this.pointerId !== 0 && eventPointerId !== this.pointerId) return
      if (this.pointerButton === 2 || this.pointerId !== null) {
        this.orbitValue.x += deltaX
        this.orbitValue.y += deltaY
      }
    }
    event.preventDefault()
  }

  private readonly onMouseMove = (event: Event): void => {
    if (this.pointerId === null) this.onPointerMove(event)
  }

  private readonly onPointerUp = (event: Event): void => {
    const pointerEvent = event as PointerEvent
    const eventPointerId = typeof pointerEvent.pointerId === 'number' ? pointerEvent.pointerId : 0
    if (this.pointerId !== null && this.pointerId !== 0 && eventPointerId !== this.pointerId) return
    const releasedPointerId = this.pointerId
    this.pointerId = null
    this.pointerButton = 0
    const target = getElementTarget(event.currentTarget)
    if (target !== null && 'releasePointerCapture' in target) {
      try {
        ;(target as Element & { releasePointerCapture: (id: number) => void }).releasePointerCapture(releasedPointerId ?? 0)
      } catch {
        this.pointerId = null
      }
    }
  }

  private readonly onMouseUp = (event: Event): void => {
    if (this.pointerId === null) return
    this.onPointerUp(event)
  }

  private readonly onWheel = (event: Event): void => {
    if (!this.isEnabled || isUiTarget(event.target)) return
    const wheelEvent = event as WheelEvent
    const delta = typeof wheelEvent.deltaY === 'number' ? wheelEvent.deltaY : 0
    const scale = wheelEvent.deltaMode === 1 ? 16 : wheelEvent.deltaMode === 2 && typeof window !== 'undefined' ? window.innerHeight : 1
    this.orbitValue.zoom += delta * scale
    wheelEvent.preventDefault()
  }

  constructor()
  constructor(options?: InputManagerOptions)
  constructor(target: EventTarget | null, options?: InputManagerOptions)
  constructor(targetOrOptions: EventTarget | InputManagerOptions | null = null, maybeOptions: InputManagerOptions = {}) {
    const directTarget = isEventTarget(targetOrOptions) ? targetOrOptions : null
    const options = directTarget === null && targetOrOptions !== null && !isEventTarget(targetOrOptions)
      ? targetOrOptions as InputManagerOptions
      : maybeOptions
    this.pointerTarget = directTarget ?? (options.target === undefined ? defaultPointerTarget() : options.target)
    this.keyboardTarget = options.keyboardTarget === undefined ? defaultKeyboardTarget() : options.keyboardTarget
    this.actionHandler = options.onAction
    this.handlers = {
      ...options.handlers,
      ...(options.onCamera === undefined ? {} : { camera: options.onCamera }),
      ...(options.onReset === undefined ? {} : { reset: options.onReset }),
      ...(options.onFlaps === undefined ? {} : { flaps: options.onFlaps }),
      ...(options.onPause === undefined ? {} : { pause: options.onPause }),
      ...(options.onMute === undefined ? {} : { mute: options.onMute }),
    }
    this.attach()
  }

  get enabled(): boolean {
    return this.isEnabled
  }

  get orbitDelta(): OrbitDelta {
    return { ...this.orbitValue }
  }

  get orbit(): OrbitDelta {
    return this.getOrbitDelta()
  }

  get orbitX(): number {
    return this.orbitValue.x
  }

  get orbitY(): number {
    return this.orbitValue.y
  }

  get zoomDelta(): number {
    return this.orbitValue.zoom
  }

  get pendingActions(): readonly InputAction[] {
    return [...this.actionQueue]
  }

  get actions(): readonly InputAction[] {
    return this.pendingActions
  }

  get state(): InputState {
    return this.getState()
  }

  attach(): void {
    if (this.isAttached) return
    this.isAttached = true
    this.keyboardTarget?.addEventListener('keydown', this.onKeyDown)
    this.keyboardTarget?.addEventListener('keyup', this.onKeyUp)
    this.keyboardTarget?.addEventListener('blur', this.onBlur)
    this.pointerTarget?.addEventListener('pointerdown', this.onPointerDown, { passive: false })
    this.pointerTarget?.addEventListener('pointermove', this.onPointerMove, { passive: false })
    this.pointerTarget?.addEventListener('pointerup', this.onPointerUp)
    this.pointerTarget?.addEventListener('pointercancel', this.onPointerUp)
    if (typeof PointerEvent === 'undefined') {
      this.pointerTarget?.addEventListener('mousedown', this.onMouseDown)
      this.pointerTarget?.addEventListener('mousemove', this.onMouseMove)
      this.pointerTarget?.addEventListener('mouseup', this.onMouseUp)
    }
    this.pointerTarget?.addEventListener('wheel', this.onWheel, { passive: false })
  }

  detach(): void {
    if (!this.isAttached) return
    this.isAttached = false
    this.keyboardTarget?.removeEventListener('keydown', this.onKeyDown)
    this.keyboardTarget?.removeEventListener('keyup', this.onKeyUp)
    this.keyboardTarget?.removeEventListener('blur', this.onBlur)
    this.pointerTarget?.removeEventListener('pointerdown', this.onPointerDown)
    this.pointerTarget?.removeEventListener('pointermove', this.onPointerMove)
    this.pointerTarget?.removeEventListener('pointerup', this.onPointerUp)
    this.pointerTarget?.removeEventListener('pointercancel', this.onPointerUp)
    if (typeof PointerEvent === 'undefined') {
      this.pointerTarget?.removeEventListener('mousedown', this.onMouseDown)
      this.pointerTarget?.removeEventListener('mousemove', this.onMouseMove)
      this.pointerTarget?.removeEventListener('mouseup', this.onMouseUp)
    }
    this.pointerTarget?.removeEventListener('wheel', this.onWheel)
    this.clearHeldInput()
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (!enabled) this.clearHeldInput()
  }

  update(delta = 0): InputState {
    const safeDelta = Math.max(0, Math.min(0.25, Number.isFinite(delta) ? delta : 0))
    if (safeDelta > 0) {
      const decay = Math.exp(-AIM_DECAY_RATE * safeDelta)
      this.aimPitch *= decay
      this.aimRoll *= decay
    }
    return this.getState()
  }

  getState(): InputState {
    const keyboardPitch = this.axis('pitch-up', 'pitch-down')
    const keyboardRoll = this.axis('roll-right', 'roll-left')
    const keyboardYaw = this.axis('yaw-right', 'yaw-left')
    const mousePitch = clampUnit(this.aimPitch / MAX_MOUSE_PITCH)
    const mouseRoll = clampUnit(this.aimRoll / MAX_MOUSE_ROLL)
    const pitch = clampUnit(keyboardPitch + mousePitch)
    const roll = clampUnit(keyboardRoll + mouseRoll)
    const throttleAxis = this.axis('throttle-up', 'throttle-down')
    const boost = this.isCommandActive('boost')
    const throttle = boost ? 1 : throttleAxis
    const brakes = this.isCommandActive('brakes') ? 1 : 0
    return {
      pitch,
      roll,
      yaw: keyboardYaw,
      throttle,
      throttleDelta: throttleAxis,
      throttleAxis,
      boost,
      reverse: throttleAxis < 0 ? 1 : 0,
      brakes,
      brake: brakes > 0,
      mousePitch,
      mouseRoll,
      aim: { pitch: this.aimPitch, roll: this.aimRoll },
      heldKeys: [...this.heldKeyLabels.keys()],
      heldKeyCodes: [...this.heldKeys],
      orbitDelta: this.getOrbitDelta(),
    }
  }

  getControls(): InputState {
    return this.getState()
  }

  getFlightControls(currentThrottle = 0): InputState {
    const state = this.getState()
    return { ...state, throttle: state.boost ? 1 : clamp01(currentThrottle) }
  }

  getOrbitDelta(): OrbitDelta {
    return { ...this.orbitValue }
  }

  consumeOrbitDelta(): OrbitDelta {
    const delta = this.getOrbitDelta()
    this.orbitValue = { x: 0, y: 0, zoom: 0 }
    return delta
  }

  consumeOrbit(): OrbitDelta {
    return this.consumeOrbitDelta()
  }

  getOrbitInput(scale = 0.01): OrbitInput {
    const delta = this.getOrbitDelta()
    return { yaw: delta.x * scale, pitch: delta.y * scale, zoom: delta.zoom * scale }
  }

  consumeOrbitInput(scale = 0.01): OrbitInput {
    const input = this.getOrbitInput(scale)
    this.consumeOrbitDelta()
    return input
  }

  getActions(): readonly InputAction[] {
    return this.pendingActions
  }

  consumeActions(): InputAction[] {
    const actions = [...this.actionQueue]
    this.actionQueue = []
    return actions
  }

  drainActions(): InputAction[] {
    return this.consumeActions()
  }

  hasAction(action: InputAction): boolean {
    return this.actionQueue.includes(action)
  }

  isPressed(command: ContinuousInput): boolean {
    return this.isCommandActive(command)
  }

  consumeAction(action: InputAction): boolean {
    const index = this.actionQueue.indexOf(action)
    if (index < 0) return false
    this.actionQueue.splice(index, 1)
    return true
  }

  reset(): void {
    this.clearHeldInput()
    this.actionQueue = []
    this.orbitValue = { x: 0, y: 0, zoom: 0 }
  }

  clear(): void {
    this.reset()
  }

  destroy(): void {
    this.detach()
    this.reset()
  }

  dispose(): void {
    this.destroy()
  }

  private axis(positive: ContinuousInput, negative: ContinuousInput): number {
    return clampUnit((this.isCommandActive(positive) ? 1 : 0) - (this.isCommandActive(negative) ? 1 : 0))
  }

  private isCommandActive(command: ContinuousInput): boolean {
    return (this.heldCommands.get(command) ?? 0) > 0
  }

  private clearHeldInput(): void {
    this.heldKeys.clear()
    this.heldKeyLabels.clear()
    this.heldCommands.clear()
    this.pointerId = null
    this.pointerButton = 0
    this.aimPitch = 0
    this.aimRoll = 0
    this.hasPointerPosition = false
  }

  private dispatchAction(action: InputAction, event: KeyboardEvent): void {
    const handler = this.handlers[action]
    if (handler !== undefined) handler(event)
    this.actionHandler?.(action, event)
  }
}

export const createInputManager = (options?: InputManagerOptions): InputManager => new InputManager(options)
export const createInput = createInputManager
