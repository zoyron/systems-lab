import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUDIO_MUTE_STORAGE_KEY, AudioSystem } from '../src/systems/audio'

class FakeAudioParam {
  value = 0

  setValueAtTime(value: number): void {
    this.value = value
  }

  exponentialRampToValueAtTime(value: number): void {
    this.value = value
  }

  setTargetAtTime(value: number): void {
    this.value = value
  }
}

class FakeAudioNode {
  readonly connections: FakeAudioNode[] = []

  connect(destination: FakeAudioNode): FakeAudioNode {
    this.connections.push(destination)
    return destination
  }

  disconnect(): void {
    this.connections.length = 0
  }
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam()
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type = ''
  readonly frequency = new FakeAudioParam()
  readonly Q = new FakeAudioParam()
}

class FakeCompressorNode extends FakeAudioNode {
  readonly threshold = new FakeAudioParam()
  readonly knee = new FakeAudioParam()
  readonly ratio = new FakeAudioParam()
  readonly attack = new FakeAudioParam()
  readonly release = new FakeAudioParam()
}

class FakeScheduledNode extends FakeAudioNode {
  private readonly listeners = new Map<string, Set<(event: Event) => void>>()

  start(): void {}

  stop(): void {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? new Set<(event: Event) => void>()
    if (typeof listener === 'function') listeners.add(listener)
    else listeners.add((event) => listener.handleEvent(event))
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener === 'function') this.listeners.get(type)?.delete(listener)
  }
}

class FakeOscillatorNode extends FakeScheduledNode {
  type = ''
  readonly frequency = new FakeAudioParam()
}

class FakeBufferSourceNode extends FakeScheduledNode {
  buffer: unknown = null
  loop = false
  readonly playbackRate = new FakeAudioParam()
}

class FakeAudioContext {
  currentTime = 0
  sampleRate = 44100
  state: AudioContextState = 'running'
  readonly destination = new FakeAudioNode()

  createGain(): FakeGainNode {
    return new FakeGainNode()
  }

  createBiquadFilter(): FakeBiquadFilterNode {
    return new FakeBiquadFilterNode()
  }

  createDynamicsCompressor(): FakeCompressorNode {
    return new FakeCompressorNode()
  }

  createOscillator(): FakeOscillatorNode {
    return new FakeOscillatorNode()
  }

  createBufferSource(): FakeBufferSourceNode {
    return new FakeBufferSourceNode()
  }

  createBuffer(_channelCount: number, length: number): { getChannelData: (channel: number) => Float32Array } {
    return { getChannelData: () => new Float32Array(length) }
  }

  async resume(): Promise<void> {
    this.state = 'running'
  }

  async suspend(): Promise<void> {
    this.state = 'suspended'
  }

  async close(): Promise<void> {
    this.state = 'closed'
  }
}

const asAudioContext = (context: FakeAudioContext): AudioContext => context as unknown as AudioContext

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AudioSystem', () => {
  it('couples engine and wind mix to the flight state', () => {
    const context = new FakeAudioContext()
    const audio = new AudioSystem({ autoUnlock: false, muted: false, contextFactory: () => asAudioContext(context) })

    expect(audio.ensureStarted()).toBe(true)
    audio.update({ throttle: 0, airspeed: 0, grounded: true, verticalSpeed: 0 })
    const idle = audio.mixState
    expect(idle.engineLevel).toBeGreaterThan(0)
    expect(idle.engineLevel).toBeLessThan(0.02)
    expect(idle.windLevel).toBeLessThan(0.001)

    audio.update({ throttle: 0.8, airspeed: 70, grounded: false, verticalSpeed: 0 })
    const powered = audio.mixState
    expect(powered.engineLevel).toBeGreaterThan(idle.engineLevel)
    expect(powered.enginePlaybackRate).toBeGreaterThan(idle.enginePlaybackRate)
    expect(powered.windLevel).toBeGreaterThan(idle.windLevel)

    audio.update({ throttle: 0.1, airspeed: 100, grounded: false, verticalSpeed: -50 })
    const dive = audio.mixState
    expect(dive.diveLevel).toBeGreaterThan(0)
    expect(dive.windLevel).toBeGreaterThan(dive.engineLevel)
  })

  it('plays short stateful one-shots without starting a music layer', () => {
    const context = new FakeAudioContext()
    const audio = new AudioSystem({ autoUnlock: false, muted: false, contextFactory: () => asAudioContext(context) })
    audio.ensureStarted()

    expect(audio.throttleSurge()).toBe(true)
    expect(audio.takeoffRoll()).toBe(true)
    expect(audio.liftoff()).toBe(true)
    expect(audio.touchdown(0.8)).toBe(true)
    expect(audio.brake()).toBe(true)
    expect(audio.crash()).toBe(true)
    expect(audio.cameraClick()).toBe(true)
  })

  it('persists mute state and keeps the game usable when audio is unavailable', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    vi.stubGlobal('localStorage', storage)

    const first = new AudioSystem({ autoUnlock: false, storageKey: 'test.mute', contextFactory: () => null })
    expect(first.muted).toBe(true)
    first.setMuted(true)
    const second = new AudioSystem({ autoUnlock: false, storageKey: 'test.mute', contextFactory: () => null })
    expect(second.muted).toBe(true)

    const unavailable = new AudioSystem({ autoUnlock: false, muted: false, contextFactory: () => null })
    expect(unavailable.ensureStarted()).toBe(false)
    expect(unavailable.state).toBe('unsupported')
    expect(unavailable.available).toBe(false)
    expect(() => unavailable.update({ throttle: 1, airspeed: 50, grounded: false })).not.toThrow()
    expect(unavailable.touchdown(1)).toBe(false)
    unavailable.dispose()
  })

  it('uses the shared storage key for the application preference', () => {
    const values = new Map<string, string>([[AUDIO_MUTE_STORAGE_KEY, 'true']])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
    const audio = new AudioSystem({ autoUnlock: false, contextFactory: () => null })
    expect(audio.muted).toBe(true)
    expect(audio.toggleMute()).toBe(false)
    expect(audio.toggleMute()).toBe(true)
  })
})
