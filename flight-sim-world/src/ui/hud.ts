import type { TimeOfDayName } from '../core/config'
import '../styles.css'

export type CameraMode = 'chase' | 'nearChase' | 'cockpit' | 'orbit'
export type GraphicsQuality = 'low' | 'high'
export type HudAction = 'begin' | 'pause' | 'resume' | 'reset' | 'camera' | 'sound' | 'tools' | 'quality' | 'timeCycle'
export type MessageTone = 'status' | 'warning' | 'danger'

export interface AttitudeSnapshot {
  pitch?: number
  roll?: number
  yaw?: number
}

export type AttitudeValue = AttitudeSnapshot | readonly [number, number, number] | number

export interface WorldLabelPosition {
  x?: number
  y?: number
  z?: number
}

export type WorldLabelCoordinate = WorldLabelPosition | readonly [number, number, number]

export interface ObjectiveSnapshot {
  text?: string
  label?: string
  title?: string
  complete?: boolean
}

export type ObjectiveValue = string | ObjectiveSnapshot

export interface WorldLabelSnapshot {
  name?: string
  label?: string
  text?: string
  x?: number
  y?: number
  screenX?: number
  screenY?: number
  position?: WorldLabelCoordinate
  screenPosition?: WorldLabelCoordinate
  distance?: number
  region?: string
  kind?: string
  tone?: string
  visible?: boolean
}

export interface HudSnapshot {
  title?: string
  region?: string | null
  location?: string | null
  airspeed?: number
  speed?: number
  altitude?: number
  height?: number
  heading?: number
  headingRadians?: number
  throttle?: number
  pitch?: number
  roll?: number
  pitchRadians?: number
  rollRadians?: number
  yaw?: number
  angleUnit?: 'radians' | 'degrees'
  attitude?: AttitudeValue
  wind?: number | string | { speed?: number; direction?: number; label?: string }
  windSpeed?: number
  windDirection?: number
  windDirectionRadians?: number
  windLabel?: string
  objective?: string | null
  objectives?: readonly ObjectiveValue[] | null
  nearbyLabels?: readonly (WorldLabelSnapshot | string)[] | null
  nearby?: readonly (WorldLabelSnapshot | string)[] | null
  worldLabels?: readonly (WorldLabelSnapshot | string)[] | null
  labels?: readonly (WorldLabelSnapshot | string)[] | null
  message?: string | null
  statusMessage?: string | null
  status?: string | null
  flightStatus?: string | null
  messageTone?: MessageTone
  stalled?: boolean
  crash?: boolean
  crashed?: boolean
  paused?: boolean
  cameraMode?: CameraMode | string
  graphicsQuality?: GraphicsQuality | string
  quality?: GraphicsQuality | string
  muted?: boolean
  timeOfDay?: TimeOfDayName
  autoTimeCycle?: boolean
  grounded?: boolean
  heldKeys?: readonly string[]
  heldKeyCodes?: readonly string[]
  debugOverlay?: {
    throttle?: number
    airspeed?: number
    pitch?: number
    roll?: number
    grounded?: boolean
    muted?: boolean
    heldKeys?: readonly string[]
  }
  showIntro?: boolean
  airspeedUnit?: string
  altitudeUnit?: string
  headingUnit?: string
}

export type HUDSnapshot = HudSnapshot
export type HudLabelSnapshot = WorldLabelSnapshot

export interface HudActionDetail {
  action: HudAction
  value?: string
  previousValue?: string
  source: 'api' | 'button' | 'control'
}

export interface HudOptions {
  root?: HTMLElement | null
  title?: string
  onAction?: (action: HudAction, detail: HudActionDetail) => void
  onBegin?: () => void
  onPause?: (paused: boolean) => void
  onReset?: () => void
  onCameraMode?: (mode: CameraMode) => void
  onQualityChange?: (quality: GraphicsQuality) => void
  onMuteToggle?: (muted: boolean) => void
  onAutoTimeCycleChange?: (enabled: boolean) => void
}

interface HudElementRefs {
  shell: HTMLElement | null
  region: HTMLElement | null
  location: HTMLElement | null
  airspeed: HTMLElement | null
  airspeedUnit: HTMLElement | null
  altitude: HTMLElement | null
  altitudeUnit: HTMLElement | null
  heading: HTMLElement | null
  throttle: HTMLElement | null
  throttleFill: HTMLElement | null
  throttleBar: HTMLElement | null
  attitude: HTMLElement | null
  attitudeHorizon: HTMLElement | null
  attitudePitch: HTMLElement | null
  attitudeRoll: HTMLElement | null
  wind: HTMLElement | null
  windArrow: HTMLElement | null
  objectives: HTMLElement | null
  objectivesList: HTMLElement | null
  worldLabels: HTMLElement | null
  status: HTMLElement | null
  pauseBanner: HTMLElement | null
  toolsButton: HTMLButtonElement | null
  toolsPanel: HTMLElement | null
  pauseButton: HTMLButtonElement | null
  pauseLabel: HTMLElement | null
  resetButton: HTMLButtonElement | null
  cameraMode: HTMLSelectElement | null
  quality: HTMLSelectElement | null
  timeOfDay: HTMLElement | null
  autoTimeCycle: HTMLSelectElement | null
  muteButton: HTMLButtonElement | null
  muteLabel: HTMLElement | null
  debugOverlay: HTMLElement | null
  debugThrottle: HTMLElement | null
  debugAirspeed: HTMLElement | null
  debugPitch: HTMLElement | null
  debugRoll: HTMLElement | null
  debugGrounded: HTMLElement | null
  debugMuted: HTMLElement | null
  debugHeldKeys: HTMLElement | null
  beginCard: HTMLElement | null
  beginButton: HTMLButtonElement | null
}

const CAMERA_MODES: readonly CameraMode[] = ['chase', 'nearChase', 'cockpit', 'orbit']
const GRAPHICS_QUALITIES: readonly GraphicsQuality[] = ['low', 'high']
const DEFAULT_TITLE = 'WINDWARD'
const DEFAULT_REGION = 'OPEN COUNTRY'
const DEFAULT_LOCATION = 'THE COASTAL AIR'
const DEFAULT_MESSAGE_TONES: readonly MessageTone[] = ['status', 'warning', 'danger']

const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value))

const finite = (value: number | undefined, fallback: number): number => value !== undefined && Number.isFinite(value) ? value : fallback

const asElement = (value: EventTarget | null): Element | null => {
  if (value === null || typeof Element === 'undefined') return null
  return value instanceof Element ? value : null
}

const normalizeCameraMode = (value: string | undefined): CameraMode => {
  const normalized = value?.trim().toLowerCase() ?? ''
  if (normalized === 'nearchase' || normalized === 'near-chase') return 'nearChase'
  return CAMERA_MODES.includes(normalized as CameraMode) ? normalized as CameraMode : 'chase'
}

const normalizeQuality = (value: string | undefined): GraphicsQuality => {
  const normalized = value?.trim().toLowerCase() ?? ''
  if (normalized === 'balanced' || normalized === 'medium') return 'high'
  return GRAPHICS_QUALITIES.includes(normalized as GraphicsQuality) ? normalized as GraphicsQuality : 'high'
}

const formatNumber = (value: number | undefined, digits = 0): string => {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

const radiansToDegrees = (value: number): number => value * (180 / Math.PI)

const formatHeading = (value: number | undefined): string => {
  if (value === undefined || !Number.isFinite(value)) return '—'
  const degrees = ((Math.round(value) % 360) + 360) % 360
  return `${String(degrees).padStart(3, '0')}°`
}

const formatThrottle = (value: number | undefined): string => {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return `${Math.round(clamp(value <= 1 ? value * 100 : value, 0, 100))}%`
}

const formatWind = (snapshot: HudSnapshot): { speed: string; direction: string; arrow: number } => {
  const wind = snapshot.wind
  let speedValue = snapshot.windSpeed
  let directionValue = snapshot.windDirectionRadians === undefined ? snapshot.windDirection : radiansToDegrees(snapshot.windDirectionRadians)
  let label = snapshot.windLabel
  if (typeof wind === 'number') speedValue = wind
  if (typeof wind === 'string') label = wind
  if (typeof wind === 'object' && wind !== null) {
    speedValue = wind.speed ?? speedValue
    directionValue = wind.direction ?? directionValue
    label = wind.label ?? label
  }
  const speed = finite(speedValue, 0)
  const direction = finite(directionValue, 0)
  return {
    speed: label ?? `${formatNumber(speed)} kt`,
    direction: `${formatHeading(direction)}`,
    arrow: direction,
  }
}

const getAttitude = (snapshot: HudSnapshot): { pitch: number; roll: number; yaw: number } => {
  const attitude = snapshot.attitude
  const radians = snapshot.angleUnit === 'radians'
  let pitch = snapshot.pitchRadians === undefined ? (snapshot.pitch ?? 0) : radiansToDegrees(snapshot.pitchRadians)
  let roll = snapshot.rollRadians === undefined ? (snapshot.roll ?? 0) : radiansToDegrees(snapshot.rollRadians)
  let yaw = snapshot.yaw ?? 0
  if (radians) {
    pitch = snapshot.pitchRadians === undefined ? radiansToDegrees(snapshot.pitch ?? 0) : pitch
    roll = snapshot.rollRadians === undefined ? radiansToDegrees(snapshot.roll ?? 0) : roll
  }
  const attitudeDegrees = (value: number | undefined, fallback: number): number => {
    if (value === undefined) return fallback
    return radians ? radiansToDegrees(value) : value
  }
  if (typeof attitude === 'number') pitch = attitudeDegrees(attitude, pitch)
  else if (Array.isArray(attitude)) {
    pitch = attitudeDegrees(attitude[0], pitch)
    roll = attitudeDegrees(attitude[1], roll)
    yaw = attitudeDegrees(attitude[2], yaw)
  } else if (attitude !== null && typeof attitude === 'object') {
    const values = attitude as AttitudeSnapshot
    pitch = attitudeDegrees(values.pitch, pitch)
    roll = attitudeDegrees(values.roll, roll)
    yaw = attitudeDegrees(values.yaw, yaw)
  }
  return { pitch: finite(pitch, 0), roll: finite(roll, 0), yaw: finite(yaw, 0) }
}

const getLabelText = (label: WorldLabelSnapshot): string => label.text ?? label.label ?? label.name ?? 'Unmarked place'

const coordinatePart = (coordinate: WorldLabelCoordinate | undefined, part: 'x' | 'y'): number | undefined => {
  if (coordinate === undefined) return undefined
  if (Array.isArray(coordinate)) return part === 'x' ? coordinate[0] : coordinate[1]
  const position = coordinate as WorldLabelPosition
  return position[part]
}

const getLabelX = (label: WorldLabelSnapshot): number => {
  const value = label.x ?? label.screenX ?? coordinatePart(label.position, 'x') ?? coordinatePart(label.screenPosition, 'x') ?? 50
  if (!Number.isFinite(value)) return 50
  return value >= 0 && value <= 1 ? value * 100 : value
}

const getLabelY = (label: WorldLabelSnapshot): number => {
  const value = label.y ?? label.screenY ?? coordinatePart(label.position, 'y') ?? coordinatePart(label.screenPosition, 'y') ?? 50
  if (!Number.isFinite(value)) return 50
  return value >= 0 && value <= 1 ? value * 100 : value
}

const escapeMarkup = (value: string): string => value.replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
}[character] ?? character))

const makeShellMarkup = (title: string): string => `
  <div class="hud-shell" data-hud-shell>
    <header class="flight-header" aria-label="Flight atlas header">
      <div class="flight-header__identity">
        <p class="flight-header__kicker">A SMALL FLIGHT ATLAS</p>
        <h1 class="flight-header__title">${escapeMarkup(title)}</h1>
        <p class="flight-header__region"><span class="flight-header__region-mark" aria-hidden="true"></span><span data-region>${DEFAULT_REGION}</span></p>
      </div>
      <div class="flight-header__location" aria-label="Current location">
        <span class="flight-header__location-label">CURRENT POSITION</span>
        <span class="flight-header__location-value" data-location>${DEFAULT_LOCATION}</span>
        <span class="flight-header__time"><small>TIME</small><strong data-time-of-day aria-live="polite">DUSK</strong></span>
      </div>
      <div class="tools" data-ui>
        <button class="tools__toggle" id="tools-button" type="button" data-hud-action="tools" aria-label="Open flight tools" aria-expanded="false" aria-controls="tools-panel">
          <span class="tools__plus" aria-hidden="true">+</span><span>TOOLS</span>
        </button>
        <section class="tools-panel" id="tools-panel" data-tools-panel hidden aria-label="Flight tools">
          <div class="tools-panel__topline"><span>FLIGHT DESK</span><span class="tools-panel__rule"></span><span class="tools-panel__index">01</span></div>
          <h2 class="tools-panel__title">Quiet controls</h2>
          <div class="tools-panel__actions">
            <button class="tools-action" id="pause-button" type="button" data-hud-action="pause"><span class="tools-action__key">P</span><span data-pause-label>Pause flight</span></button>
            <button class="tools-action" id="reset-button" type="button" data-hud-action="reset"><span class="tools-action__key">R</span><span>Return to field</span></button>
            <button class="tools-action" id="mute-button" type="button" data-hud-action="sound"><span class="tools-action__sound" aria-hidden="true">◌</span><span data-mute-label>Sound on</span></button>
          </div>
          <label class="tools-field" for="camera-mode"><span>Camera mode</span><select id="camera-mode" data-hud-control="camera-mode"><option value="chase">Chase</option><option value="nearChase">Near chase</option><option value="cockpit">Cockpit</option><option value="orbit">Orbit</option></select></label>
          <label class="tools-field" for="quality-select"><span>Graphics quality</span><select id="quality-select" data-hud-control="graphics-quality"><option value="low">Low</option><option value="high">High</option></select></label>
          <label class="tools-field" for="auto-time-cycle"><span>Time cycle</span><select id="auto-time-cycle" data-hud-control="auto-time-cycle"><option value="off">Off</option><option value="auto">Auto</option></select></label>
          <p class="tools-panel__note">T moves forward. Shift + T moves back.</p>
        </section>
      </div>
    </header>
    <div class="world-labels" data-world-labels aria-hidden="true"></div>
    <aside class="objectives" data-objectives hidden aria-label="Current objectives">
      <div class="objectives__heading"><span>FIELD NOTES</span><span class="objectives__line"></span></div>
      <ul data-objectives-list></ul>
    </aside>
    <div class="pause-banner" data-pause-banner hidden role="status" aria-live="polite"><span class="pause-banner__mark" aria-hidden="true">Ⅱ</span><span>Flight paused</span><small>P or Esc to resume</small></div>
    <div class="status-message" data-status-message hidden role="status" aria-live="polite"></div>
    <aside class="debug-overlay" data-debug-overlay aria-label="Flight debug overlay">
      <div class="debug-overlay__heading"><span>FLIGHT TRACE</span><span data-debug-muted>true</span></div>
      <dl class="debug-overlay__grid">
        <div><dt>THROTTLE</dt><dd data-debug-throttle>0%</dd></div>
        <div><dt>AIRSPEED</dt><dd data-debug-airspeed>0 kt</dd></div>
        <div><dt>PITCH</dt><dd data-debug-pitch>0°</dd></div>
        <div><dt>ROLL</dt><dd data-debug-roll>0°</dd></div>
        <div><dt>GROUNDED</dt><dd data-debug-grounded>true</dd></div>
        <div><dt>HELD KEYS</dt><dd data-debug-held-keys>none</dd></div>
      </dl>
    </aside>
    <section class="flight-readout" aria-label="Flight instruments">
      <div class="flight-readout__lead"><span class="flight-readout__eyebrow">FLIGHT INSTRUMENTS</span><span class="flight-readout__rule"></span><span class="flight-readout__mode">WINDWARD / 01</span></div>
      <div class="flight-readout__grid">
        <div class="instrument instrument--airspeed"><span class="instrument__label">AIRSPEED</span><span class="instrument__value" data-airspeed>—</span><span class="instrument__unit" data-airspeed-unit>KT</span></div>
        <div class="instrument instrument--altitude"><span class="instrument__label">ALTITUDE</span><span class="instrument__value" data-altitude>—</span><span class="instrument__unit" data-altitude-unit>M</span></div>
        <div class="instrument instrument--heading"><span class="instrument__label">HEADING</span><span class="instrument__value" data-heading>—</span><span class="instrument__unit" data-heading-unit>°</span></div>
        <div class="instrument instrument--throttle"><div class="instrument__topline"><span class="instrument__label">THROTTLE</span><span class="instrument__value instrument__value--small" data-throttle>—</span></div><div class="throttle-track" data-throttle-bar role="meter" aria-label="Throttle" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="throttle-track__fill" data-throttle-fill></span></div></div>
        <div class="instrument instrument--attitude" data-attitude aria-label="Aircraft attitude"><div class="attitude"><div class="attitude__horizon" data-attitude-horizon><span class="attitude__line"></span><span class="attitude__mark"></span></div><span class="attitude__aircraft" aria-hidden="true">⌁</span></div><div class="attitude-readout"><span data-attitude-pitch>—</span><span data-attitude-roll>—</span></div></div>
        <div class="instrument instrument--wind"><span class="instrument__label">WIND</span><div class="wind-readout"><span class="wind-arrow" data-wind-arrow aria-hidden="true">↑</span><span class="instrument__value instrument__value--small" data-wind>—</span></div><span class="instrument__unit" data-wind-direction>—</span></div>
      </div>
    </section>
    <section class="begin-card" id="begin-card" data-begin-card aria-labelledby="begin-title" aria-describedby="begin-copy">
      <div class="begin-card__rule" aria-hidden="true"></div>
      <p class="begin-card__eyebrow">YOUR FIRST FLIGHT</p>
      <h2 class="begin-card__title" id="begin-title">Take the long way home.</h2>
      <p class="begin-card__copy" id="begin-copy">A small atlas, a soft engine, and a coast waiting beyond the light.</p>
      <div class="begin-card__controls" aria-label="Flight controls">
        <span><kbd>W / S</kbd><small>Throttle</small></span>
        <span><kbd>Shift</kbd><small>Boost</small></span>
        <span><kbd>A / D</kbd><small>Rudder</small></span>
        <span><kbd>← / →</kbd><small>Roll / turn</small></span>
        <span><kbd>↑ / ↓</kbd><small>Nose down / up</small></span>
        <span><kbd>Space</kbd><small>Brake</small></span>
        <span><kbd>Mouse</kbd><small>Aim nose</small></span>
        <span><kbd>M</kbd><small>Mute</small></span>
        <span><kbd>C</kbd><small>View</small></span>
        <span><kbd>R</kbd><small>Reset</small></span>
        <span><kbd>P / Esc</kbd><small>Pause</small></span>
        <span><kbd>T / Shift T</kbd><small>Time</small></span>
        <span><kbd>F</kbd><small>Flaps</small></span>
      </div>
      <button class="begin-card__button" id="begin-button" type="button" data-hud-action="begin">BEGIN FLIGHT <span aria-hidden="true">↗</span></button>
      <p class="begin-card__hint">Keyboard or mouse · sound is optional</p>
    </section>
  </div>
`

const hudInstances = new WeakMap<HTMLElement, Hud>()

export class Hud {
  private root: HTMLElement | null
  private readonly options: HudOptions
  private refs: HudElementRefs | null = null
  private current: HudSnapshot = {}
  private initialized = false
  private introVisible = true
  private messageTimer: number | null = null

  private readonly onClick = (event: Event): void => {
    const target = asElement(event.target)
    const element = target?.closest<HTMLElement>('[data-hud-action], [data-camera-mode]') ?? null
    if (element === null || this.root === null || !this.root.contains(element)) return
    if (typeof element.blur === 'function') element.blur()
    const action = element.dataset.hudAction
    if (action === 'begin') {
      event.preventDefault()
      this.begin()
      return
    }
    if (action === 'tools') {
      event.preventDefault()
      this.toggleTools()
      return
    }
    if (action === 'pause') {
      event.preventDefault()
      this.togglePause()
      return
    }
    if (action === 'reset') {
      event.preventDefault()
      this.reset()
      return
    }
    if (action === 'sound') {
      event.preventDefault()
      this.toggleMute('button')
      return
    }
    const cameraMode = element.dataset.cameraMode
    if (cameraMode !== undefined) this.setCameraMode(cameraMode, 'button')
  }

  private readonly onChange = (event: Event): void => {
    const element = asElement(event.target)
    if (element === null) return
    const select = element as HTMLSelectElement
    if (select.id === 'camera-mode') this.setCameraMode(select.value, 'control')
    if (select.id === 'quality-select') this.setGraphicsQuality(select.value, 'control')
    if (select.id === 'auto-time-cycle') this.setAutoTimeCycle(select.value === 'auto', 'control')
    select.blur()
  }

  constructor()
  constructor(root: HTMLElement | null, options?: HudOptions)
  constructor(options: HudOptions)
  constructor(rootOrOptions: HTMLElement | HudOptions | null = null, options: HudOptions = {}) {
    let root: HTMLElement | null
    let resolvedOptions: HudOptions = options
    if (typeof HTMLElement !== 'undefined' && rootOrOptions instanceof HTMLElement) {
      root = rootOrOptions
    } else if (rootOrOptions !== null) {
      const optionBag = rootOrOptions as HudOptions
      resolvedOptions = optionBag
      root = optionBag.root ?? this.findRoot()
    } else {
      root = this.findRoot()
    }
    this.root = root
    this.options = resolvedOptions
    this.initialize(root)
  }

  get element(): HTMLElement | null {
    return this.refs?.shell ?? null
  }

  get rootElement(): HTMLElement | null {
    return this.root
  }

  get isInitialized(): boolean {
    return this.initialized
  }

  get snapshot(): HudSnapshot {
    return { ...this.current }
  }

  initialize(root?: HTMLElement | null): this {
    if (this.initialized) return this
    const resolvedRoot = root ?? this.root ?? this.findRoot()
    if (resolvedRoot === null) return this
    this.root = resolvedRoot
    resolvedRoot.innerHTML = makeShellMarkup(this.options.title ?? DEFAULT_TITLE)
    resolvedRoot.classList.add('windward-ui')
    const query = <T extends Element>(selector: string): T | null => resolvedRoot.querySelector<T>(selector)
    this.refs = {
      shell: query<HTMLElement>('[data-hud-shell]'),
      region: query<HTMLElement>('[data-region]'),
      location: query<HTMLElement>('[data-location]'),
      airspeed: query<HTMLElement>('[data-airspeed]'),
      airspeedUnit: query<HTMLElement>('[data-airspeed-unit]'),
      altitude: query<HTMLElement>('[data-altitude]'),
      altitudeUnit: query<HTMLElement>('[data-altitude-unit]'),
      heading: query<HTMLElement>('[data-heading]'),
      throttle: query<HTMLElement>('[data-throttle]'),
      throttleFill: query<HTMLElement>('[data-throttle-fill]'),
      throttleBar: query<HTMLElement>('[data-throttle-bar]'),
      attitude: query<HTMLElement>('[data-attitude]'),
      attitudeHorizon: query<HTMLElement>('[data-attitude-horizon]'),
      attitudePitch: query<HTMLElement>('[data-attitude-pitch]'),
      attitudeRoll: query<HTMLElement>('[data-attitude-roll]'),
      wind: query<HTMLElement>('[data-wind]'),
      windArrow: query<HTMLElement>('[data-wind-arrow]'),
      objectives: query<HTMLElement>('[data-objectives]'),
      objectivesList: query<HTMLElement>('[data-objectives-list]'),
      worldLabels: query<HTMLElement>('[data-world-labels]'),
      status: query<HTMLElement>('[data-status-message]'),
      pauseBanner: query<HTMLElement>('[data-pause-banner]'),
      toolsButton: query<HTMLButtonElement>('#tools-button'),
      toolsPanel: query<HTMLElement>('#tools-panel'),
      pauseButton: query<HTMLButtonElement>('#pause-button'),
      pauseLabel: query<HTMLElement>('[data-pause-label]'),
      resetButton: query<HTMLButtonElement>('#reset-button'),
      cameraMode: query<HTMLSelectElement>('#camera-mode'),
      quality: query<HTMLSelectElement>('#quality-select'),
      timeOfDay: query<HTMLElement>('[data-time-of-day]'),
      autoTimeCycle: query<HTMLSelectElement>('#auto-time-cycle'),
       muteButton: query<HTMLButtonElement>('#mute-button'),
       muteLabel: query<HTMLElement>('[data-mute-label]'),
       debugOverlay: query<HTMLElement>('[data-debug-overlay]'),
       debugThrottle: query<HTMLElement>('[data-debug-throttle]'),
       debugAirspeed: query<HTMLElement>('[data-debug-airspeed]'),
       debugPitch: query<HTMLElement>('[data-debug-pitch]'),
       debugRoll: query<HTMLElement>('[data-debug-roll]'),
       debugGrounded: query<HTMLElement>('[data-debug-grounded]'),
       debugMuted: query<HTMLElement>('[data-debug-muted]'),
       debugHeldKeys: query<HTMLElement>('[data-debug-held-keys]'),
       beginCard: query<HTMLElement>('#begin-card'),

      beginButton: query<HTMLButtonElement>('#begin-button'),
    }
    this.refs.shell?.addEventListener('click', this.onClick)
    this.refs.shell?.addEventListener('change', this.onChange)
    this.initialized = true
    hudInstances.set(resolvedRoot, this)
    this.applyPaused(Boolean(this.current.paused))
    this.setIntroVisible(this.introVisible)
    return this
  }

  init(root?: HTMLElement | null): this {
    return this.initialize(root)
  }

  update(snapshot: HudSnapshot): void {
    if (!this.initialized) this.initialize()
    if (this.refs === null) return
    this.current = { ...this.current, ...snapshot }
    const refs = this.refs
    const current = this.current
    if (snapshot.title !== undefined) this.updateTitle(snapshot.title)
    if (snapshot.region !== undefined && refs.region !== null) refs.region.textContent = snapshot.region?.toUpperCase() ?? ''
    if (snapshot.location !== undefined && refs.location !== null) refs.location.textContent = snapshot.location?.toUpperCase() ?? ''
    if ((snapshot.airspeed !== undefined || snapshot.speed !== undefined) && refs.airspeed !== null) refs.airspeed.textContent = formatNumber(snapshot.airspeed ?? snapshot.speed)
    if (snapshot.airspeedUnit !== undefined && refs.airspeedUnit !== null) refs.airspeedUnit.textContent = snapshot.airspeedUnit
    if ((snapshot.altitude !== undefined || snapshot.height !== undefined) && refs.altitude !== null) refs.altitude.textContent = formatNumber(snapshot.altitude ?? snapshot.height)
    if (snapshot.altitudeUnit !== undefined && refs.altitudeUnit !== null) refs.altitudeUnit.textContent = snapshot.altitudeUnit
    if ((snapshot.heading !== undefined || snapshot.headingRadians !== undefined) && refs.heading !== null) {
      const heading = snapshot.headingRadians === undefined
        ? snapshot.angleUnit === 'radians' ? radiansToDegrees(snapshot.heading ?? 0) : snapshot.heading
        : radiansToDegrees(snapshot.headingRadians)
      refs.heading.textContent = formatHeading(heading)
    }
    if (snapshot.headingUnit !== undefined) {
      const headingUnit = refs.shell?.querySelector<HTMLElement>('[data-heading-unit]')
      if (headingUnit !== null && headingUnit !== undefined) headingUnit.textContent = snapshot.headingUnit
    }
    if (snapshot.throttle !== undefined) this.updateThrottle(snapshot.throttle)
    if (snapshot.pitch !== undefined || snapshot.roll !== undefined || snapshot.pitchRadians !== undefined || snapshot.rollRadians !== undefined || snapshot.yaw !== undefined || snapshot.attitude !== undefined || snapshot.angleUnit !== undefined) this.updateAttitude(getAttitude(current))
    if (snapshot.wind !== undefined || snapshot.windSpeed !== undefined || snapshot.windDirection !== undefined || snapshot.windDirectionRadians !== undefined || snapshot.windLabel !== undefined) this.updateWind(current)
    if (snapshot.objective !== undefined || snapshot.objectives !== undefined) this.updateObjectives(snapshot)
    if (snapshot.nearbyLabels !== undefined || snapshot.nearby !== undefined || snapshot.worldLabels !== undefined || snapshot.labels !== undefined) this.updateWorldLabels(snapshot)
    if (snapshot.paused !== undefined) this.applyPaused(snapshot.paused)
    if (snapshot.cameraMode !== undefined) this.applyCameraMode(snapshot.cameraMode)
     if (snapshot.graphicsQuality !== undefined || snapshot.quality !== undefined) this.applyGraphicsQuality(snapshot.graphicsQuality ?? snapshot.quality ?? 'high')
     if (snapshot.muted !== undefined) this.setMuted(snapshot.muted)
     if (snapshot.timeOfDay !== undefined) this.applyTimeOfDay(snapshot.timeOfDay)
     if (snapshot.autoTimeCycle !== undefined) this.applyAutoTimeCycle(snapshot.autoTimeCycle)
     if (snapshot.grounded !== undefined || snapshot.heldKeys !== undefined || snapshot.heldKeyCodes !== undefined || snapshot.debugOverlay !== undefined) this.updateDebugOverlay(snapshot)
     if (snapshot.showIntro !== undefined) this.setIntroVisible(snapshot.showIntro)

    if (snapshot.message !== undefined || snapshot.statusMessage !== undefined || snapshot.status !== undefined || snapshot.flightStatus !== undefined || snapshot.stalled !== undefined || snapshot.crash !== undefined || snapshot.crashed !== undefined) this.updateMessage(snapshot)
    this.updateStateClass(snapshot)
  }

  updateSnapshot(snapshot: HudSnapshot): void {
    this.update(snapshot)
  }

  setWorldLabels(labels: readonly (WorldLabelSnapshot | string)[] | null): void {
    this.update({ worldLabels: labels })
  }

  setObjectives(objectives: readonly ObjectiveValue[] | ObjectiveValue | null): void {
    const values = objectives === null ? null : Array.isArray(objectives) ? objectives : [objectives]
    this.update({ objectives: values })
  }

  setStatus(message: string | null, tone: MessageTone = 'status'): void {
    this.showMessage(message, tone)
  }

  setStatusMessage(message: string | null, tone: MessageTone = 'status'): void {
    this.setStatus(message, tone)
  }

  setPaused(paused: boolean): void {
    this.applyPaused(paused)
    this.options.onPause?.(paused)
    this.emit(paused ? 'pause' : 'resume', { value: paused ? 'paused' : 'flying', source: 'api' })
  }

  togglePause(): void {
    const paused = !this.current.paused
    this.applyPaused(paused)
    this.emit(paused ? 'pause' : 'resume', { value: paused ? 'paused' : 'flying', source: 'button' })
    this.options.onPause?.(paused)
  }

  setToolsOpen(open: boolean): void {
    const refs = this.refs
    if (refs === null) return
    if (refs.toolsPanel !== null) refs.toolsPanel.hidden = !open
    refs.toolsButton?.setAttribute('aria-expanded', open ? 'true' : 'false')
    refs.toolsButton?.setAttribute('aria-label', open ? 'Close flight tools' : 'Open flight tools')
    refs.shell?.classList.toggle('tools-is-open', open)
  }

  toggleTools(): void {
    const panel = this.refs?.toolsPanel
    const open: boolean = panel === null || panel === undefined ? true : Boolean(panel.hidden)
    this.setToolsOpen(open)
    this.emit('tools', { value: open ? 'open' : 'closed', source: 'button' })
  }

  setCameraMode(mode: CameraMode | string, source: HudActionDetail['source'] = 'api'): void {
    const normalized = this.applyCameraMode(mode)
    this.options.onCameraMode?.(normalized)
    this.emit('camera', { value: normalized, source })
  }

  cycleCameraMode(): CameraMode {
    const current = normalizeCameraMode(this.current.cameraMode)
    const index = CAMERA_MODES.indexOf(current)
    const next = CAMERA_MODES[(index + 1) % CAMERA_MODES.length] ?? 'chase'
    this.setCameraMode(next)
    return next
  }

  setGraphicsQuality(quality: GraphicsQuality | string, source: HudActionDetail['source'] = 'api'): void {
    const normalized = this.applyGraphicsQuality(quality)
    this.options.onQualityChange?.(normalized)
    this.emit('quality', { value: normalized, source })
  }

  setAutoTimeCycle(enabled: boolean, source: HudActionDetail['source'] = 'api'): void {
    const normalized = this.applyAutoTimeCycle(enabled)
    this.options.onAutoTimeCycleChange?.(normalized)
    this.emit('timeCycle', { value: normalized ? 'auto' : 'off', source })
  }

  private applyCameraMode(mode: CameraMode | string): CameraMode {
    const normalized = normalizeCameraMode(mode)
    this.current.cameraMode = normalized
    const cameraMode = this.refs?.cameraMode
    if (cameraMode !== null && cameraMode !== undefined) cameraMode.value = normalized
    this.refs?.shell?.querySelectorAll<HTMLElement>('[data-camera-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.cameraMode === normalized ? 'true' : 'false')
    })
    return normalized
  }

  private applyGraphicsQuality(quality: GraphicsQuality | string): GraphicsQuality {
    const normalized = normalizeQuality(quality)
    this.current.graphicsQuality = normalized
    const qualitySelect = this.refs?.quality
    if (qualitySelect !== null && qualitySelect !== undefined) qualitySelect.value = normalized
    return normalized
  }

  private applyTimeOfDay(timeOfDay: TimeOfDayName): void {
    this.current.timeOfDay = timeOfDay
    if (this.refs?.timeOfDay != null) this.refs.timeOfDay.textContent = timeOfDay.toUpperCase()
  }

  private applyAutoTimeCycle(enabled: boolean): boolean {
    const normalized = Boolean(enabled)
    this.current.autoTimeCycle = normalized
    if (this.refs?.autoTimeCycle != null) this.refs.autoTimeCycle.value = normalized ? 'auto' : 'off'
    return normalized
  }

  setMuted(muted: boolean): boolean {
    const normalized = Boolean(muted)
    this.current.muted = normalized
    const muteLabel = this.refs?.muteLabel
    const muteButton = this.refs?.muteButton
    if (muteLabel !== null && muteLabel !== undefined) muteLabel.textContent = normalized ? 'Sound off' : 'Sound on'
    if (muteButton !== null && muteButton !== undefined) muteButton.setAttribute('aria-pressed', normalized ? 'true' : 'false')
    this.updateDebugOverlay({ muted: normalized })
    return normalized
  }

  toggleMute(source: HudActionDetail['source'] = 'api'): boolean {
    const muted = this.setMuted(!this.current.muted)
    this.options.onMuteToggle?.(muted)
    this.emit('sound', { value: muted ? 'muted' : 'on', source })
    return muted
  }

  reset(): void {
    const muted = this.current.muted === true
    this.current.paused = false
    this.current.muted = muted
    this.current.stalled = false
    this.current.crash = false
    this.current.crashed = false
    this.current.message = null
    this.current.statusMessage = null
    this.current.status = null
    this.current.flightStatus = null
    this.applyPaused(false)
    this.clearMessage()
    this.setMuted(muted)
    this.setToolsOpen(false)
    this.updateStateClass({})
    this.options.onReset?.()
    this.emit('reset', { source: 'button' })
  }

  begin(): void {
    this.setIntroVisible(false)
    this.refs?.beginButton?.blur()
    this.options.onBegin?.()
    this.emit('begin', { source: 'button' })
  }

  showIntro(show = true): void {
    this.setIntroVisible(show)
  }

  setIntroVisible(visible: boolean): void {
    this.introVisible = visible
    const beginCard = this.refs?.beginCard
    if (beginCard !== null && beginCard !== undefined) beginCard.hidden = !visible
  }

  showMessage(message: string | null, tone: MessageTone = 'status', duration?: number): void {
    const refs = this.refs
    if (refs === null || refs.status === null) return
    if (message === null || message.trim().length === 0) {
      this.clearMessage()
      return
    }
    refs.status.textContent = message
    refs.status.dataset.tone = DEFAULT_MESSAGE_TONES.includes(tone) ? tone : 'status'
    refs.status.hidden = false
    refs.shell?.classList.remove('has-warning', 'has-danger')
    if (tone === 'warning') refs.shell?.classList.add('has-warning')
    if (tone === 'danger') refs.shell?.classList.add('has-danger')
    if (this.messageTimer !== null && typeof window !== 'undefined') window.clearTimeout(this.messageTimer)
    this.messageTimer = null
    if (duration !== undefined && duration > 0 && typeof window !== 'undefined') {
      this.messageTimer = window.setTimeout(() => {
        this.clearMessage()
        this.messageTimer = null
      }, duration)
    }
  }

  clearMessage(): void {
    const refs = this.refs
    if (refs !== null && refs.status !== null) {
      refs.status.hidden = true
      refs.status.textContent = ''
    }
    refs?.shell?.classList.remove('has-warning', 'has-danger')
    if (this.messageTimer !== null && typeof window !== 'undefined') window.clearTimeout(this.messageTimer)
    this.messageTimer = null
  }

  getRoot(): HTMLElement | null {
    return this.root
  }

  getElement<T extends HTMLElement = HTMLElement>(selector: string): T | null {
    return this.refs?.shell?.querySelector<T>(selector) ?? null
  }

  destroy(): void {
    if (this.messageTimer !== null && typeof window !== 'undefined') window.clearTimeout(this.messageTimer)
    this.messageTimer = null
    this.refs?.shell?.removeEventListener('click', this.onClick)
    this.refs?.shell?.removeEventListener('change', this.onChange)
    if (this.root !== null) hudInstances.delete(this.root)
    this.refs?.shell?.remove()
    this.root?.classList.remove('windward-ui')
    this.refs = null
    this.initialized = false
  }

  dispose(): void {
    this.destroy()
  }

  private findRoot(): HTMLElement | null {
    if (typeof document === 'undefined') return null
    return document.getElementById('ui-root')
  }

  private updateDebugOverlay(snapshot: HudSnapshot): void {
    const refs = this.refs
    if (refs === null) return
    const debug = snapshot.debugOverlay
    const throttleValue = debug?.throttle ?? snapshot.throttle ?? this.current.throttle ?? 0
    const airspeedValue = debug?.airspeed ?? snapshot.airspeed ?? snapshot.speed ?? this.current.airspeed ?? this.current.speed ?? 0
    const snapshotAngleUnit = snapshot.angleUnit ?? this.current.angleUnit
    const pitchFromRadians = snapshot.pitchRadians !== undefined
      ? radiansToDegrees(snapshot.pitchRadians)
      : snapshot.pitch !== undefined
        ? snapshotAngleUnit === 'radians' ? radiansToDegrees(snapshot.pitch) : snapshot.pitch
        : this.current.pitchRadians !== undefined
          ? radiansToDegrees(this.current.pitchRadians)
          : this.current.angleUnit === 'radians' && this.current.pitch !== undefined
            ? radiansToDegrees(this.current.pitch)
            : this.current.pitch ?? 0
    const rollFromRadians = snapshot.rollRadians !== undefined
      ? radiansToDegrees(snapshot.rollRadians)
      : snapshot.roll !== undefined
        ? snapshotAngleUnit === 'radians' ? radiansToDegrees(snapshot.roll) : snapshot.roll
        : this.current.rollRadians !== undefined
          ? radiansToDegrees(this.current.rollRadians)
          : this.current.angleUnit === 'radians' && this.current.roll !== undefined
            ? radiansToDegrees(this.current.roll)
            : this.current.roll ?? 0
    const pitchValue = debug?.pitch ?? pitchFromRadians
    const rollValue = debug?.roll ?? rollFromRadians
    const grounded = debug?.grounded ?? snapshot.grounded ?? this.current.grounded ?? true
    const muted = debug?.muted ?? snapshot.muted ?? this.current.muted ?? false
    const heldKeys = debug?.heldKeys ?? snapshot.heldKeys ?? this.current.heldKeys ?? []
    const throttlePercent = Math.round(clamp(throttleValue <= 1 ? throttleValue * 100 : throttleValue, 0, 100))
    const pitchDegrees = Math.round(finite(pitchValue, 0))
    const rollDegrees = Math.round(finite(rollValue, 0))
    if (refs.debugThrottle !== null) refs.debugThrottle.textContent = `${throttlePercent}%`
    if (refs.debugAirspeed !== null) refs.debugAirspeed.textContent = `${formatNumber(finite(airspeedValue, 0), 1)} kt`
    if (refs.debugPitch !== null) refs.debugPitch.textContent = `${pitchDegrees >= 0 ? '+' : ''}${pitchDegrees}°`
    if (refs.debugRoll !== null) refs.debugRoll.textContent = `${rollDegrees >= 0 ? '+' : ''}${rollDegrees}°`
    if (refs.debugGrounded !== null) refs.debugGrounded.textContent = grounded ? 'true' : 'false'
    if (refs.debugMuted !== null) refs.debugMuted.textContent = muted ? 'true' : 'false'
    if (refs.debugHeldKeys !== null) refs.debugHeldKeys.textContent = heldKeys.length === 0 ? 'none' : heldKeys.join(' · ')
    this.current.grounded = grounded
    this.current.heldKeys = [...heldKeys]
    this.current.muted = muted
  }

  private updateThrottle(value: number): void {
    const refs = this.refs
    if (refs === null) return
    const percentage = Math.round(clamp(value <= 1 ? value * 100 : value, 0, 100))
    if (refs.throttle !== null) refs.throttle.textContent = formatThrottle(value)
    if (refs.throttleFill !== null) refs.throttleFill.style.width = `${percentage}%`
    if (refs.throttleBar !== null) refs.throttleBar.setAttribute('aria-valuenow', String(percentage))
  }

  private updateAttitude(attitude: { pitch: number; roll: number; yaw: number }): void {
    const refs = this.refs
    if (refs === null) return
    const pitch = clamp(attitude.pitch, -90, 90)
    const roll = clamp(attitude.roll, -180, 180)
    if (refs.attitudePitch !== null) refs.attitudePitch.textContent = `P ${pitch >= 0 ? '+' : ''}${Math.round(pitch)}°`
    if (refs.attitudeRoll !== null) refs.attitudeRoll.textContent = `R ${roll >= 0 ? '+' : ''}${Math.round(roll)}°`
    if (refs.attitudeHorizon !== null) {
      refs.attitudeHorizon.style.setProperty('--attitude-roll', `${roll}deg`)
      refs.attitudeHorizon.style.setProperty('--attitude-pitch', `${clamp(pitch, -30, 30) * 0.7}px`)
    }
    if (refs.attitude !== null) refs.attitude.setAttribute('aria-label', `Aircraft attitude, pitch ${Math.round(pitch)} degrees, roll ${Math.round(roll)} degrees`)
  }

  private updateWind(snapshot: HudSnapshot): void {
    const refs = this.refs
    if (refs === null) return
    const wind = formatWind(snapshot)
    if (refs.wind !== null) refs.wind.textContent = wind.speed
    if (refs.windArrow !== null) refs.windArrow.style.transform = `rotate(${wind.arrow}deg)`
    const direction = refs.shell?.querySelector<HTMLElement>('[data-wind-direction]')
    if (direction !== null && direction !== undefined) direction.textContent = wind.direction
  }

  private updateObjectives(snapshot: HudSnapshot): void {
    const refs = this.refs
    if (refs === null || refs.objectives === null || refs.objectivesList === null) return
    const values: ObjectiveValue[] = []
    if (snapshot.objectives !== undefined && snapshot.objectives !== null) values.push(...snapshot.objectives)
    if (snapshot.objective !== undefined && snapshot.objective !== null && !values.includes(snapshot.objective)) values.push(snapshot.objective)
    refs.objectives.hidden = values.length === 0
    refs.objectivesList.replaceChildren()
    for (const value of values) {
      const item = document.createElement('li')
      const objective = typeof value === 'string' ? { text: value } : value
      item.textContent = objective.text ?? objective.label ?? objective.title ?? ''
      if (objective.complete === true) item.classList.add('is-complete')
      refs.objectivesList.append(item)
    }
  }

  private updateWorldLabels(snapshot: HudSnapshot): void {
    const refs = this.refs
    if (refs === null || refs.worldLabels === null) return
    const labels = snapshot.worldLabels ?? snapshot.nearbyLabels ?? snapshot.nearby ?? snapshot.labels ?? []
    refs.worldLabels.replaceChildren()
    for (const rawLabel of labels) {
      const label: WorldLabelSnapshot = typeof rawLabel === 'string' ? { name: rawLabel } : rawLabel
      if (label.visible === false) continue
      const element = document.createElement('div')
      element.className = 'world-label'
      if (label.kind !== undefined) element.dataset.kind = label.kind
      if (label.tone !== undefined) element.dataset.tone = label.tone
      element.style.setProperty('--label-x', `${clamp(getLabelX(label), -10, 110)}%`)
      element.style.setProperty('--label-y', `${clamp(getLabelY(label), -10, 110)}%`)
      const marker = document.createElement('span')
      marker.className = 'world-label__marker'
      marker.setAttribute('aria-hidden', 'true')
      const text = document.createElement('span')
      text.className = 'world-label__text'
      text.textContent = getLabelText(label)
      element.append(marker, text)
      if (label.distance !== undefined && Number.isFinite(label.distance)) {
        const distance = document.createElement('small')
        distance.textContent = `${Math.round(label.distance)} m`
        element.append(distance)
      }
      refs.worldLabels.append(element)
    }
  }

  private updateMessage(snapshot: HudSnapshot): void {
    const explicitMessage = snapshot.message !== undefined ? snapshot.message : snapshot.statusMessage
    if (explicitMessage !== undefined) {
      this.showMessage(explicitMessage, snapshot.messageTone ?? this.inferTone(snapshot))
      return
    }
    const status = snapshot.flightStatus ?? snapshot.status
    const normalizedStatus = status?.toLowerCase()
    if (status !== undefined && status !== null && normalizedStatus !== undefined && !['flying', 'normal', 'ok', 'ready'].includes(normalizedStatus)) {
      this.showMessage(status, this.inferTone(snapshot))
      return
    }
    if (status !== undefined && status !== null && normalizedStatus !== undefined && ['flying', 'normal', 'ok', 'ready'].includes(normalizedStatus)) {
      this.clearMessage()
      return
    }
    if (snapshot.stalled === true || snapshot.crashed === true || snapshot.crash === true) {
      this.showMessage(snapshot.crashed === true || snapshot.crash === true ? 'CRASHED — RETURN TO THE FIELD' : 'STALL — LOWER THE NOSE', snapshot.crashed === true || snapshot.crash === true ? 'danger' : 'warning')
      return
    }
    if (snapshot.stalled === false || snapshot.crashed === false || snapshot.crash === false) this.clearMessage()
  }

  private inferTone(snapshot: HudSnapshot): MessageTone {
    if (snapshot.crashed === true || snapshot.crash === true) return 'danger'
    if (snapshot.stalled === true) return 'warning'
    return snapshot.messageTone ?? 'status'
  }

  private updateStateClass(snapshot: HudSnapshot): void {
    const refs = this.refs
    if (refs?.shell == null) return
    const stalled = snapshot.stalled ?? this.current.stalled ?? false
    const crashed = snapshot.crashed ?? snapshot.crash ?? this.current.crashed ?? this.current.crash ?? false
    refs.shell.classList.toggle('is-paused', this.current.paused === true)
    refs.shell.classList.toggle('is-stalled', stalled)
    refs.shell.classList.toggle('is-crashed', crashed)
  }

  private applyPaused(paused: boolean): void {
    this.current.paused = paused
    const refs = this.refs
    if (refs === null) return
    if (refs.pauseBanner !== null) refs.pauseBanner.hidden = !paused
    refs.shell?.classList.toggle('is-paused', paused)
    if (refs.pauseLabel !== null) refs.pauseLabel.textContent = paused ? 'Resume flight' : 'Pause flight'
    refs.pauseButton?.setAttribute('aria-label', paused ? 'Resume flight' : 'Pause flight')
  }

  private emit(action: HudAction, detail: Omit<HudActionDetail, 'action'>): void {
    const payload: HudActionDetail = { action, ...detail }
    this.options.onAction?.(action, payload)
    if (this.root === null || typeof CustomEvent === 'undefined') return
    this.root.dispatchEvent(new CustomEvent<HudActionDetail>('hud-action', { detail: payload, bubbles: true }))
  }

  private updateTitle(title: string): void {
    const titleElement = this.refs?.shell?.querySelector<HTMLElement>('.flight-header__title')
    if (titleElement !== null && titleElement !== undefined) titleElement.textContent = title
  }
}

const resolveRoot = (root?: HTMLElement | null): HTMLElement | null => root ?? (typeof document === 'undefined' ? null : document.getElementById('ui-root'))

export const initHUD = (rootOrOptions?: HTMLElement | HudOptions | null, options?: HudOptions): Hud => {
  const optionBag = rootOrOptions !== null && typeof rootOrOptions === 'object' && (typeof HTMLElement === 'undefined' || !(rootOrOptions instanceof HTMLElement))
    ? rootOrOptions as HudOptions
    : null
  const resolvedOptions = optionBag ?? options
  const requestedRoot = optionBag === null ? rootOrOptions as HTMLElement | null | undefined : optionBag.root
  const resolvedRoot = resolveRoot(requestedRoot)
  if (resolvedRoot !== null) {
    const existing = hudInstances.get(resolvedRoot)
    if (existing !== undefined) return existing
  }
  return new Hud(resolvedRoot, resolvedOptions)
}

export const initializeHUD = initHUD
export const initialize = initHUD
export const mountHUD = initHUD
export const mountHud = initHUD
export const createHUD = initHUD
export const initHud = initHUD
export const createHud = initHUD
export { Hud as HUD }
export { Hud as HudController }

export const getHUD = (root?: HTMLElement | null): Hud | null => {
  const resolvedRoot = resolveRoot(root)
  return resolvedRoot === null ? null : hudInstances.get(resolvedRoot) ?? null
}

export const getHud = getHUD

export const updateHUD = (snapshot: HudSnapshot, target?: Hud | HTMLElement | null): void => {
  if (target instanceof Hud) {
    target.update(snapshot)
    return
  }
  const root = resolveRoot(target)
  if (root === null) return
  const hud = hudInstances.get(root) ?? initHUD(root)
  hud.update(snapshot)
}

export const updateHud = updateHUD
