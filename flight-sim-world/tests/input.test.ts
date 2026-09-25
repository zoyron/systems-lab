import { describe, expect, it, vi } from 'vitest'
import { advanceThrottle, InputManager } from '../src/systems/input'

class EventTargetDouble {
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
  }

  dispatchEvent(event: Event): boolean {
    this.emit(event.type, event)
    return true
  }
}

const keyEvent = (code: string, key: string, shiftKey = false, repeat = false): KeyboardEvent => ({
  code,
  key,
  target: null,
  shiftKey,
  repeat,
  preventDefault: () => undefined,
} as unknown as KeyboardEvent)

const pointerEvent = (type: string, clientX: number, clientY: number, button = 0): PointerEvent => ({
  type,
  clientX,
  clientY,
  button,
  pointerId: 1,
  target: null,
  currentTarget: null,
  preventDefault: () => undefined,
} as unknown as PointerEvent)

const press = (target: EventTargetDouble, code: string, key: string, shiftKey = false, repeat = false): void => {
  target.emit('keydown', keyEvent(code, key, shiftKey, repeat))
}

const release = (target: EventTargetDouble, code: string, key: string): void => {
  target.emit('keyup', keyEvent(code, key))
}

describe('InputManager flight mappings', () => {
  it('maps W and S to throttle without changing pitch', () => {
    const target = new EventTargetDouble()
    const input = new InputManager(target, { keyboardTarget: target })

    press(target, 'KeyW', 'w')
    expect(input.getState()).toMatchObject({ pitch: 0, throttleAxis: 1, throttleDelta: 1, reverse: 0 })
    expect(input.getFlightControls(0.65)).toMatchObject({ pitch: 0, throttle: 0.65, throttleDelta: 1 })
    release(target, 'KeyW', 'w')

    press(target, 'KeyS', 's')
    expect(input.getState()).toMatchObject({ pitch: 0, throttleAxis: -1, throttleDelta: -1, reverse: 1 })
    input.dispose()
  })

  it('maps arrows to nose and roll commands', () => {
    const target = new EventTargetDouble()
    const input = new InputManager(target, { keyboardTarget: target })

    press(target, 'ArrowUp', 'ArrowUp')
    expect(input.getState()).toMatchObject({ pitch: -1, throttleDelta: 0 })
    release(target, 'ArrowUp', 'ArrowUp')

    press(target, 'ArrowDown', 'ArrowDown')
    expect(input.getState()).toMatchObject({ pitch: 1, throttleDelta: 0 })
    release(target, 'ArrowDown', 'ArrowDown')

    press(target, 'ArrowLeft', 'ArrowLeft')
    expect(input.getState()).toMatchObject({ roll: -1, pitch: 0 })
    release(target, 'ArrowLeft', 'ArrowLeft')

    press(target, 'ArrowRight', 'ArrowRight')
    expect(input.getState()).toMatchObject({ roll: 1, throttleDelta: 0 })
    input.dispose()
  })

  it('maps A and D to yaw, Shift to boost, and Space to brakes', () => {
    const target = new EventTargetDouble()
    const input = new InputManager(target, { keyboardTarget: target })

    press(target, 'KeyA', 'a')
    expect(input.getState()).toMatchObject({ yaw: -1, roll: 0, throttleDelta: 0 })
    release(target, 'KeyA', 'a')

    press(target, 'KeyD', 'd')
    expect(input.getState()).toMatchObject({ yaw: 1, roll: 0 })
    release(target, 'KeyD', 'd')

    press(target, 'ShiftLeft', 'Shift')
    expect(input.getState()).toMatchObject({ boost: true, pitch: 0, throttleDelta: 0 })
    press(target, 'KeyS', 's')
    expect(input.getState()).toMatchObject({ boost: true, reverse: 1, throttleDelta: -1 })
    release(target, 'KeyS', 's')
    expect(input.getFlightControls(0.4)).toMatchObject({ throttle: 1, boost: true })
    release(target, 'ShiftLeft', 'Shift')

    press(target, 'Space', ' ')
    expect(input.getState()).toMatchObject({ brakes: 1, brake: true, pitch: 0 })
    input.dispose()
  })

  it('rejects old pitch and throttle aliases', () => {
    const target = new EventTargetDouble()
    const input = new InputManager(target, { keyboardTarget: target })

    for (const [code, key] of [['KeyQ', 'q'], ['KeyE', 'e'], ['ControlLeft', 'Control'], ['KeyB', 'b'], ['Equal', '=']] as const) {
      press(target, code, key)
    }
    expect(input.getState()).toMatchObject({ pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, brakes: 0 })
    input.dispose()
  })

  it('keeps simultaneous controls independent and reports held keys', () => {
    const target = new EventTargetDouble()
    const input = new InputManager(target, { keyboardTarget: target })

    press(target, 'KeyW', 'w')
    press(target, 'ArrowUp', 'ArrowUp')
    press(target, 'KeyA', 'a')
    expect(input.getState()).toMatchObject({ pitch: -1, yaw: -1, throttleDelta: 1 })
    expect(input.getState().heldKeys).toEqual(expect.arrayContaining(['W', 'ArrowUp', 'A']))
    input.dispose()
  })

  it('uses low-sensitivity mouse aim without changing throttle', () => {
    const target = new EventTargetDouble()
    const input = new InputManager(target, { keyboardTarget: target })

    target.emit('pointerdown', pointerEvent('pointerdown', 200, 200))
    target.emit('pointermove', pointerEvent('pointermove', 200, 100))
    expect(input.getState().pitch).toBeLessThan(0)
    expect(input.getState().roll).toBe(0)
    expect(input.getState().throttleDelta).toBe(0)

    target.emit('pointermove', pointerEvent('pointermove', 300, 200))
    expect(input.getState().roll).toBeGreaterThan(0)
    expect(input.getState().throttleDelta).toBe(0)
    input.dispose()
  })

  it('toggles mute from the M action', () => {
    const target = new EventTargetDouble()
    const onMute = vi.fn()
    const input = new InputManager(target, { keyboardTarget: target, onMute })

    press(target, 'KeyM', 'm')
    expect(onMute).toHaveBeenCalledOnce()
    expect(input.consumeActions()).toContain('mute')
    input.dispose()
  })

  it('dispatches one time action per T press and preserves Shift direction', () => {
    const target = new EventTargetDouble()
    const onAction = vi.fn()
    const input = new InputManager(target, { keyboardTarget: target, onAction })

    press(target, 'KeyT', 't')
    press(target, 'KeyT', 't', false, true)
    expect(onAction).toHaveBeenCalledOnce()
    expect(onAction.mock.calls[0]?.[1].shiftKey).toBe(false)
    release(target, 'KeyT', 't')

    press(target, 'KeyT', 'T', true)
    expect(onAction).toHaveBeenCalledTimes(2)
    expect(onAction.mock.calls[1]?.[1].shiftKey).toBe(true)
    input.dispose()
  })
})

describe('sticky throttle', () => {
  it('keeps the current level when W is released and only S reduces it', () => {
    let throttle = advanceThrottle(0.4, 0, 1 / 60)
    throttle = advanceThrottle(throttle, 1, 1 / 60)
    const afterIncrease = throttle
    expect(advanceThrottle(throttle, 0, 1 / 60)).toBeCloseTo(afterIncrease)
    expect(advanceThrottle(afterIncrease, -1, 1 / 60)).toBeLessThan(afterIncrease)
  })

  it('boosts effective throttle without committing the sticky level', () => {
    const sticky = advanceThrottle(0.4, 1, 1)
    expect(sticky).toBeGreaterThan(0.4)
    expect(advanceThrottle(sticky, 0, 1, true)).toBeCloseTo(sticky)
  })
})
