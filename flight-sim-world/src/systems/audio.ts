export type AudioState = 'idle' | 'running' | 'suspended' | 'unsupported' | 'closed'

export interface AudioSystemOptions {
  contextFactory?: () => AudioContext | null
  autoUnlock?: boolean
  muted?: boolean
  storageKey?: string
}

export interface AudioFlightState {
  throttle?: number
  airspeed?: number
  speed?: number
  wind?: number
  grounded?: boolean
  verticalSpeed?: number
  pitch?: number
  impactSpeed?: number
}

export interface AudioMixState {
  throttle: number
  airspeed: number
  grounded: boolean
  verticalSpeed: number
  engineLevel: number
  enginePlaybackRate: number
  windLevel: number
  diveLevel: number
  nightLevel: number
}

export const AUDIO_MUTE_STORAGE_KEY = 'windward.audio.muted'

type AudioContextConstructor = new () => AudioContext

type AudioGlobal = typeof globalThis & {
  AudioContext?: AudioContextConstructor
  webkitAudioContext?: AudioContextConstructor
  localStorage?: Storage
}

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

const safeNumber = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback

const getAudioConstructor = (): AudioContextConstructor | null => {
  const scope = globalThis as AudioGlobal
  return scope.AudioContext ?? scope.webkitAudioContext ?? null
}

const getGestureTarget = (): EventTarget | null => {
  if (typeof document !== 'undefined') return document
  if (typeof window !== 'undefined') return window
  return null
}

const readStoredMute = (key: string): boolean | null => {
  try {
    const storage = (globalThis as AudioGlobal).localStorage
    if (storage === undefined) return null
    const value = storage.getItem(key)
    if (value === 'true') return true
    if (value === 'false') return false
    return null
  } catch {
    return null
  }
}

const writeStoredMute = (key: string, muted: boolean): void => {
  try {
    const storage = (globalThis as AudioGlobal).localStorage
    storage?.setItem(key, muted ? 'true' : 'false')
  } catch {
    return
  }
}

export class AudioSystem {
  private readonly contextFactory: (() => AudioContext | null) | null
  private readonly autoUnlock: boolean
  private readonly gestureTarget: EventTarget | null
  private readonly storageKey: string
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private engineGain: GainNode | null = null
  private engineFilter: BiquadFilterNode | null = null
  private windGain: GainNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private nightGain: GainNode | null = null
  private readonly engineOscillators: OscillatorNode[] = []
  private readonly sources: AudioScheduledSourceNode[] = []
  private startPromise: Promise<boolean> | null = null
  private throttle = 0
  private speed = 0
  private wind = 0
  private grounded = true
  private verticalSpeed = 0
  private nightLevel = 0.55
  private mutedValue: boolean
  private hasStoredPreference: boolean
  private enableOnFirstGesture: boolean
  private gestureUnlocked = false
  private stateValue: AudioState = 'idle'
  private gestureAttached = false
  private mixStateValue: AudioMixState = {
    throttle: 0,
    airspeed: 0,
    grounded: true,
    verticalSpeed: 0,
    engineLevel: 0.004,
    enginePlaybackRate: 0.72,
    windLevel: 0.0001,
    diveLevel: 0,
    nightLevel: 0.0015,
  }

  private readonly onGesture = (): void => {
    if (this.enableOnFirstGesture && !this.gestureUnlocked) {
      this.gestureUnlocked = true
      this.setMuted(false)
    }
    void this.unlock()
  }

  constructor(options: AudioSystemOptions = {}) {
    this.contextFactory = options.contextFactory ?? null
    this.autoUnlock = options.autoUnlock ?? true
    this.storageKey = options.storageKey ?? AUDIO_MUTE_STORAGE_KEY
    const storedMute = readStoredMute(this.storageKey)
    this.hasStoredPreference = storedMute !== null
    this.enableOnFirstGesture = options.muted === undefined && !this.hasStoredPreference
    this.mutedValue = options.muted ?? storedMute ?? true
    this.gestureTarget = getGestureTarget()
    if (this.autoUnlock) this.attachGestureUnlock()
  }

  get state(): AudioState {
    return this.stateValue
  }

  get supported(): boolean {
    return this.contextFactory !== null || getAudioConstructor() !== null
  }

  get available(): boolean {
    return this.supported && this.stateValue !== 'closed' && this.stateValue !== 'unsupported'
  }

  get muted(): boolean {
    return this.mutedValue
  }

  set muted(value: boolean) {
    this.setMuted(value)
  }

  get mutedState(): boolean {
    return this.mutedValue
  }

  get isMuted(): boolean {
    return this.mutedValue
  }

  get audioContext(): AudioContext | null {
    return this.context
  }

  getContext(): AudioContext | null {
    return this.context
  }

  get mixState(): AudioMixState {
    return { ...this.mixStateValue }
  }

  getMixState(): AudioMixState {
    return this.mixState
  }

  attachGestureUnlock(): void {
    if (!this.autoUnlock || this.gestureAttached || this.gestureTarget === null) return
    this.gestureAttached = true
    this.gestureTarget.addEventListener('pointerdown', this.onGesture, { passive: true })
    this.gestureTarget.addEventListener('keydown', this.onGesture, { passive: true })
    this.gestureTarget.addEventListener('touchstart', this.onGesture, { passive: true })
  }

  detachGestureUnlock(): void {
    if (!this.gestureAttached || this.gestureTarget === null) return
    this.gestureAttached = false
    this.gestureTarget.removeEventListener('pointerdown', this.onGesture)
    this.gestureTarget.removeEventListener('keydown', this.onGesture)
    this.gestureTarget.removeEventListener('touchstart', this.onGesture)
  }

  ensureStarted(): boolean {
    if (this.stateValue === 'closed') return false
    if (this.context !== null) {
      this.updateContextState()
      return true
    }
    const context = this.createContext()
    if (context === null) {
      this.stateValue = 'unsupported'
      this.detachGestureUnlock()
      return false
    }
    this.context = context
    try {
      this.buildGraph(context)
      this.stateValue = context.state === 'suspended' ? 'suspended' : 'running'
      this.applyMix()
      this.gestureUnlocked = true
      this.detachGestureUnlock()
      return true
    } catch {
      this.closeContext(context)
      this.context = null
      this.stateValue = 'unsupported'
      this.detachGestureUnlock()
      return false
    }
  }

  initialize(): boolean {
    return this.ensureStarted()
  }

  init(): boolean {
    return this.ensureStarted()
  }

  unlockAudio(): Promise<boolean> {
    return this.unlock()
  }

  onFirstGesture(): Promise<boolean> {
    return this.unlock()
  }

  async unlock(): Promise<boolean> {
    if (this.startPromise !== null) return this.startPromise
    const promise = this.performUnlock()
    this.startPromise = promise
    void promise.then(
      () => {
        if (this.startPromise === promise) this.startPromise = null
      },
      () => {
        if (this.startPromise === promise) this.startPromise = null
      },
    )
    return promise
  }

  async start(): Promise<boolean> {
    return this.unlock()
  }

  async resume(): Promise<boolean> {
    if (this.context === null && !this.ensureStarted()) return false
    if (this.context === null) return false
    try {
      if (typeof this.context.resume === 'function') await this.context.resume()
    } catch {
      this.stateValue = 'suspended'
      return false
    }
    this.stateValue = this.context.state === 'suspended' ? 'suspended' : 'running'
    return true
  }

  async suspend(): Promise<boolean> {
    if (this.context === null) return false
    try {
      if (typeof this.context.suspend === 'function') await this.context.suspend()
    } catch {
      return false
    }
    this.stateValue = 'suspended'
    return true
  }

  setThrottle(value: number): void {
    this.throttle = clamp01(value)
    this.applyMix()
  }

  setEngineLevel(value: number): void {
    this.setThrottle(value)
  }

  setEngineThrottle(value: number): void {
    this.setThrottle(value)
  }

  setSpeed(value: number): void {
    this.speed = Math.max(0, safeNumber(value, 0))
    this.applyMix()
  }

  setWind(value: number): void {
    this.wind = Math.max(0, safeNumber(value, 0))
    this.applyMix()
  }

  setWindSpeed(value: number): void {
    this.setWind(value)
  }

  setGrounded(value: boolean): void {
    this.grounded = value
    this.applyMix()
  }

  setVerticalSpeed(value: number): void {
    this.verticalSpeed = safeNumber(value, 0)
    this.applyMix()
  }

  setNightLevel(value: number): void {
    this.nightLevel = clamp01(value)
    this.applyMix()
  }

  setFlightState(throttle: number, speed: number, wind?: number, grounded?: boolean, verticalSpeed?: number): void
  setFlightState(state: AudioFlightState): void
  setFlightState(
    throttleOrState: number | AudioFlightState,
    speed = this.speed,
    wind = this.wind,
    grounded?: boolean,
    verticalSpeed = this.verticalSpeed,
  ): void {
    if (typeof throttleOrState === 'number') {
      this.throttle = clamp01(throttleOrState)
      this.speed = Math.max(0, safeNumber(speed, 0))
      this.wind = Math.max(0, safeNumber(wind, 0))
      this.grounded = grounded ?? (this.speed > 1 ? false : this.grounded)
      this.verticalSpeed = safeNumber(verticalSpeed, 0)
    } else {
      this.throttle = clamp01(throttleOrState.throttle ?? 0)
      this.speed = Math.max(0, safeNumber(throttleOrState.airspeed ?? throttleOrState.speed ?? 0, 0))
      this.wind = Math.max(0, safeNumber(throttleOrState.wind ?? this.wind, 0))
      this.grounded = throttleOrState.grounded ?? this.grounded
      this.verticalSpeed = safeNumber(throttleOrState.verticalSpeed ?? 0, 0)
    }
    this.applyMix()
  }

  update(throttle: number, speed: number, wind?: number, grounded?: boolean, verticalSpeed?: number): void
  update(state: AudioFlightState): void
  update(
    throttleOrState: number | AudioFlightState,
    speed?: number,
    wind?: number,
    grounded?: boolean,
    verticalSpeed?: number,
  ): void {
    if (typeof throttleOrState === 'number') {
      this.setFlightState(throttleOrState, speed ?? this.speed, wind, grounded, verticalSpeed)
    } else {
      this.setFlightState(throttleOrState)
    }
  }

  setMuted(value: boolean): boolean {
    this.mutedValue = Boolean(value)
    this.hasStoredPreference = true
    this.enableOnFirstGesture = false
    writeStoredMute(this.storageKey, this.mutedValue)
    this.applyMix()
    return this.mutedValue
  }

  toggleMute(): boolean {
    this.setMuted(!this.mutedValue)
    return this.mutedValue
  }

  toggleMuted(): boolean {
    return this.toggleMute()
  }

  throttleSurge(): boolean {
    return this.playTone(116, 0.24, 0.045, 'sawtooth', 58) || this.playNoiseBurst(0.22, 0.025, 920)
  }

  takeoffRoll(): boolean {
    return this.playNoiseBurst(0.72, 0.035, 480)
  }

  liftoff(): boolean {
    return this.playNoiseBurst(0.5, 0.03, 1250) || this.playTone(180, 0.34, 0.025, 'sine', 72)
  }

  touchdown(intensity = 1): boolean {
    const amount = clamp01(intensity)
    if (amount <= 0) return false
    const playedTone = this.playTone(118, 0.38, 0.16 * amount, 'sine', 42)
    const playedNoise = this.playNoiseBurst(0.28, 0.045 * amount, 260)
    return playedTone || playedNoise
  }

  playTouchdown(intensity = 1): boolean {
    return this.touchdown(intensity)
  }

  touchdownBump(intensity = 1): boolean {
    return this.touchdown(intensity)
  }

  brake(): boolean {
    if (!this.grounded) return false
    return this.playNoiseBurst(0.18, 0.028, 1700)
  }

  crash(): boolean {
    return this.playTone(76, 0.48, 0.12, 'sine', 28)
  }

  waterHit(): boolean {
    return this.playNoiseBurst(0.42, 0.075, 520)
  }

  cameraClick(): boolean {
    return this.playTone(620, 0.045, 0.018, 'square', 420)
  }

  dispose(): void {
    this.detachGestureUnlock()
    const context = this.context
    this.stopSources()
    if (context !== null) this.closeContext(context)
    this.context = null
    this.masterGain = null
    this.engineGain = null
    this.engineFilter = null
    this.windGain = null
    this.windFilter = null
    this.nightGain = null
    this.stateValue = 'closed'
    this.startPromise = null
  }

  destroy(): void {
    this.dispose()
  }

  private async performUnlock(): Promise<boolean> {
    const started = this.ensureStarted()
    if (!started || this.context === null) return false
    try {
      if (typeof this.context.resume === 'function') await this.context.resume()
    } catch {
      this.stateValue = 'suspended'
      return false
    }
    this.stateValue = this.context.state === 'suspended' ? 'suspended' : 'running'
    return true
  }

  private createContext(): AudioContext | null {
    try {
      if (this.contextFactory !== null) return this.contextFactory()
      const AudioContextClass = getAudioConstructor()
      return AudioContextClass === null ? null : new AudioContextClass()
    } catch {
      return null
    }
  }

  private buildGraph(context: AudioContext): void {
    const masterGain = context.createGain()
    masterGain.gain.value = this.mutedValue ? 0 : 0.72
    this.masterGain = masterGain

    if (typeof context.createDynamicsCompressor === 'function') {
      const limiter = context.createDynamicsCompressor()
      limiter.threshold.value = -10
      limiter.knee.value = 12
      limiter.ratio.value = 8
      limiter.attack.value = 0.003
      limiter.release.value = 0.18
      masterGain.connect(limiter)
      limiter.connect(context.destination)
    } else {
      masterGain.connect(context.destination)
    }

    const engineGain = context.createGain()
    engineGain.gain.value = 0.0001
    const engineFilter = context.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 900
    engineFilter.Q.value = 0.7
    engineGain.connect(engineFilter)
    engineFilter.connect(masterGain)
    this.engineGain = engineGain
    this.engineFilter = engineFilter

    const engineOscillator = context.createOscillator()
    engineOscillator.type = 'sawtooth'
    engineOscillator.frequency.value = 42
    const engineOscillatorGain = context.createGain()
    engineOscillatorGain.gain.value = 0.55
    engineOscillator.connect(engineOscillatorGain)
    engineOscillatorGain.connect(engineGain)
    engineOscillator.start()
    this.engineOscillators.push(engineOscillator)
    this.sources.push(engineOscillator)

    const engineOvertone = context.createOscillator()
    engineOvertone.type = 'triangle'
    engineOvertone.frequency.value = 84
    const engineOvertoneGain = context.createGain()
    engineOvertoneGain.gain.value = 0.16
    engineOvertone.connect(engineOvertoneGain)
    engineOvertoneGain.connect(engineGain)
    engineOvertone.start()
    this.engineOscillators.push(engineOvertone)
    this.sources.push(engineOvertone)

    const windGain = context.createGain()
    windGain.gain.value = 0.0001
    const windFilter = context.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 720
    windFilter.Q.value = 0.45
    const windSource = context.createBufferSource()
    windSource.buffer = this.createNoiseBuffer(context)
    windSource.loop = true
    windSource.connect(windFilter)
    windFilter.connect(windGain)
    windGain.connect(masterGain)
    windSource.start()
    this.windGain = windGain
    this.windFilter = windFilter
    this.sources.push(windSource)

    const nightGain = context.createGain()
    nightGain.gain.value = 0.0001
    nightGain.connect(masterGain)
    const nightOscillator = context.createOscillator()
    nightOscillator.type = 'sine'
    nightOscillator.frequency.value = 57
    const nightOvertone = context.createOscillator()
    nightOvertone.type = 'sine'
    nightOvertone.frequency.value = 86
    const nightOvertoneGain = context.createGain()
    nightOvertoneGain.gain.value = 0.18
    nightOscillator.connect(nightGain)
    nightOvertone.connect(nightOvertoneGain)
    nightOvertoneGain.connect(nightGain)
    nightOscillator.start()
    nightOvertone.start()
    this.nightGain = nightGain
    this.sources.push(nightOscillator, nightOvertone)
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const sampleRate = safeNumber(context.sampleRate, 44100)
    const length = Math.max(1, Math.floor(sampleRate * 2))
    const buffer = context.createBuffer(1, length, sampleRate)
    const channel = buffer.getChannelData(0)
    for (let index = 0; index < length; index += 1) channel[index] = Math.random() * 2 - 1
    return buffer
  }

  private playTone(
    startFrequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    endFrequency: number,
  ): boolean {
    if (!this.canPlayOneShot()) return false
    const context = this.context
    const masterGain = this.masterGain
    if (context === null || masterGain === null) return false
    try {
      const now = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(Math.max(1, startFrequency), now)
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      oscillator.connect(gain)
      gain.connect(masterGain)
      oscillator.start(now)
      oscillator.stop(now + duration + 0.02)
      oscillator.addEventListener('ended', () => {
        oscillator.disconnect()
        gain.disconnect()
      }, { once: true })
      return true
    } catch {
      return false
    }
  }

  private playNoiseBurst(duration: number, volume: number, frequency: number): boolean {
    if (!this.canPlayOneShot()) return false
    const context = this.context
    const masterGain = this.masterGain
    if (context === null || masterGain === null) return false
    try {
      const now = context.currentTime
      const source = context.createBufferSource()
      const filter = context.createBiquadFilter()
      const gain = context.createGain()
      source.buffer = this.createNoiseBuffer(context)
      filter.type = 'bandpass'
      filter.frequency.value = frequency
      filter.Q.value = 0.7
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(masterGain)
      source.start(now)
      source.stop(now + duration + 0.02)
      source.addEventListener('ended', () => {
        source.disconnect()
        filter.disconnect()
        gain.disconnect()
      }, { once: true })
      return true
    } catch {
      return false
    }
  }

  private canPlayOneShot(): boolean {
    return this.context !== null && !this.mutedValue && this.stateValue !== 'closed' && this.stateValue !== 'unsupported'
  }

  private applyMix(): void {
    const throttle = this.throttle
    const speed = Math.min(140, Math.max(0, this.speed))
    const diveSpeed = Math.max(0, -this.verticalSpeed)
    const engineLevel = 0.004 + throttle * 0.075
    const enginePlaybackRate = 0.72 + throttle * 0.68 + Math.min(speed, 120) / 120 * 0.34
    const windLevel = this.grounded
      ? 0.0001
      : Math.min(0.18, speed * 0.00145 + diveSpeed * 0.0022 + this.wind * 0.00012)
    const diveLevel = clamp01(diveSpeed / 32)
    this.mixStateValue = {
      throttle,
      airspeed: this.speed,
      grounded: this.grounded,
      verticalSpeed: this.verticalSpeed,
      engineLevel,
      enginePlaybackRate,
      windLevel,
      diveLevel,
      nightLevel: 0.0015 * this.nightLevel,
    }
    if (this.context === null) return
    const now = this.context.currentTime
    const engineFrequency = 28 + this.mixStateValue.enginePlaybackRate * 8 + throttle * 80 + speed * 0.2
    this.engineOscillators.forEach((oscillator, index) => {
      const ratio = index === 0 ? 1 : 2
      this.setAudioParam(oscillator.frequency, engineFrequency * ratio, now, 0.08)
    })
    this.setAudioParam(this.engineFilter?.frequency ?? null, 560 + throttle * 1450 + speed * 2, now, 0.1)
    this.setAudioParam(this.engineGain?.gain ?? null, engineLevel, now, 0.09)
    this.setAudioParam(this.windFilter?.frequency ?? null, 580 + speed * 5 + diveSpeed * 12, now, 0.12)
    this.setAudioParam(this.windGain?.gain ?? null, windLevel, now, 0.12)
    this.setAudioParam(this.nightGain?.gain ?? null, this.mixStateValue.nightLevel, now, 0.2)
    this.setAudioParam(this.masterGain?.gain ?? null, this.mutedValue ? 0 : 0.72, now, 0.05)
  }

  private setAudioParam(parameter: AudioParam | null, value: number, now: number, timeConstant: number): void {
    if (parameter === null) return
    try {
      parameter.setTargetAtTime(value, now, timeConstant)
    } catch {
      try {
        parameter.value = value
      } catch {
        return
      }
    }
  }

  private updateContextState(): void {
    if (this.context === null) return
    if (this.context.state === 'closed') this.stateValue = 'closed'
    else if (this.context.state === 'suspended') this.stateValue = 'suspended'
    else this.stateValue = 'running'
  }

  private stopSources(): void {
    for (const source of this.sources) {
      try {
        source.stop()
      } catch {
        continue
      }
    }
    this.sources.length = 0
    this.engineOscillators.length = 0
  }

  private closeContext(context: AudioContext): void {
    try {
      const closeResult = context.close()
      if (closeResult !== undefined) void closeResult.catch(() => undefined)
    } catch {
      return
    }
  }
}

export const createAudioSystem = (options?: AudioSystemOptions): AudioSystem => new AudioSystem(options)
export const createAudio = createAudioSystem
