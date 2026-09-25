import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FLIGHT, WORLD } from '../src/core/config'
import { getSurfaceHeight, isRunwayPoint } from '../src/core/heightfield'
import { FlightModel, type FlightControls, type FlightEvent } from '../src/systems/flightModel'

const controls = (overrides: FlightControls = {}): FlightControls => ({
  throttle: 0,
  throttleInput: 0,
  pitch: 0,
  roll: 0,
  yaw: 0,
  brakes: false,
  reverse: false,
  boost: false,
  pitchActive: false,
  rollActive: false,
  yawActive: false,
  flaps: 0,
  ...overrides,
})

const advance = (model: FlightModel, steps: number, input: FlightControls): FlightEvent[] => {
  const events: FlightEvent[] = []
  for (let index = 0; index < steps; index += 1) {
    const event = model.step(FLIGHT.fixedStep, input)
    if (event !== null) events.push(event)
  }
  return events
}

const placeAirborne = (model: FlightModel, altitude = 120, speed = 42): void => {
  model.position.set(0, 600 + altitude, 0)
  model.velocity.set(0, 0, -speed)
}

describe('FlightModel arcade controls', () => {
  it('starts parked on the runway', () => {
    const model = new FlightModel()

    expect(isRunwayPoint(model.position.x, model.position.z)).toBe(true)
    expect(model.state.grounded).toBe(true)
    expect(model.state.airspeed).toBe(0)
    expect(model.state.heading).toBeCloseTo(0)
    expect(model.state.pitch).toBe(0)
    expect(model.state.roll).toBe(0)
  })

  it('taxis forward with W and backward with S without tumbling', () => {
    const forward = new FlightModel()
    const forwardStart = forward.position.z
    advance(forward, 240, controls({ throttle: 1, throttleInput: 1 }))
    expect(forward.state.grounded).toBe(true)
    expect(forward.state.airspeed).toBeGreaterThan(5)
    expect(forward.position.z).toBeLessThan(forwardStart)
    expect(Math.abs(forward.state.pitch)).toBeLessThan(0.01)
    expect(Math.abs(forward.state.roll)).toBeLessThan(0.01)

    const reverse = new FlightModel()
    const reverseStart = reverse.position.z
    advance(reverse, 240, controls({ throttleInput: -1, reverse: true }))
    expect(reverse.state.grounded).toBe(true)
    expect(reverse.position.z).toBeGreaterThan(reverseStart)
    expect(Math.abs(reverse.state.roll)).toBeLessThan(0.01)
  })

  it('does not take off while reverse is held, even with boost', () => {
    const model = new FlightModel()
    model.velocity.set(0, 0, -35)
    expect(model.velocity.length()).toBe(35)
    const events = advance(model, 240, controls({ throttle: 1, throttleInput: -1, reverse: true, boost: true }))
    expect(events.some((event) => event.type === 'takeoff')).toBe(false)
    expect(model.state.grounded).toBe(true)
  })

  it('steers the nose wheel with arrows while staying level on the ground', () => {
    const model = new FlightModel()
    const startHeading = model.state.heading
    advance(model, 120, controls({ throttle: 0.7, throttleInput: 1, roll: 1, rollActive: true }))
    expect(Math.abs(model.state.heading - startHeading)).toBeGreaterThan(0.03)
    expect(Math.abs(model.state.pitch)).toBeLessThan(0.01)
    expect(Math.abs(model.state.roll)).toBeLessThan(0.01)
  })

  it('dampens raw attitude targets before they reach the flight state', () => {
    const model = new FlightModel()
    placeAirborne(model, 120, 48)

    model.step(FLIGHT.fixedStep, controls({ throttle: 0.8, roll: 1, rollActive: true }))

    expect(model.controlState.roll).toBeGreaterThan(0)
    expect(model.controlState.roll).toBeLessThan(1)
    expect(Math.abs(model.state.roll)).toBeLessThan(0.1)
  })

  it('keeps fixed-step control response independent of render-frame chunking', () => {
    const oneCall = new FlightModel()
    const twoCalls = new FlightModel()
    placeAirborne(oneCall, 120, 48)
    placeAirborne(twoCalls, 120, 48)
    const input = controls({ throttle: 0.8, pitch: 0.5, roll: -0.7, yaw: 0.25, pitchActive: true, rollActive: true, yawActive: true })

    oneCall.step(FLIGHT.fixedStep * 2, input)
    twoCalls.step(FLIGHT.fixedStep, input)
    twoCalls.step(FLIGHT.fixedStep, input)

    expect(oneCall.position.distanceTo(twoCalls.position)).toBeLessThan(1e-8)
    expect(oneCall.orientation.angleTo(twoCalls.orientation)).toBeLessThan(1e-8)
  })

  it('takes off after forward taxi speed and throttle', () => {
    const model = new FlightModel()
    const events: FlightEvent[] = []
    for (let index = 0; index < 3000 && !events.some((event) => event.type === 'takeoff'); index += 1) {
      const event = model.step(FLIGHT.fixedStep, controls({ throttle: 1, throttleInput: 1 }))
      if (event !== null) events.push(event)
    }

    expect(events.some((event) => event.type === 'takeoff')).toBe(true)
    expect(model.state.grounded).toBe(false)
    advance(model, 180, controls({ throttle: 1, throttleInput: 1 }))
    expect(model.state.altitude).toBeGreaterThan(30)
    expect(model.state.airspeed).toBeGreaterThan(20)

    const boosted = new FlightModel()
    const boostedEvents: FlightEvent[] = []
    for (let index = 0; index < 3000 && !boostedEvents.some((event) => event.type === 'takeoff'); index += 1) {
      const event = boosted.step(FLIGHT.fixedStep, controls({ boost: true }))
      if (event !== null) boostedEvents.push(event)
    }
    expect(boostedEvents.some((event) => event.type === 'takeoff')).toBe(true)
  })

  it('uses arrow pitch to change the flight path and altitude', () => {
    const climb = new FlightModel()
    placeAirborne(climb, 120, 45)
    const climbStart = climb.position.y
    advance(climb, 180, controls({ throttle: 0.8, pitch: 1, pitchActive: true }))
    expect(climb.state.pitch).toBeGreaterThan(0)
    expect(climb.state.verticalSpeed).toBeGreaterThan(0)
    expect(climb.position.y).toBeGreaterThan(climbStart)

    const dive = new FlightModel()
    placeAirborne(dive, 120, 45)
    const diveStart = dive.position.y
    advance(dive, 180, controls({ throttle: 0.8, pitch: -1, pitchActive: true }))
    expect(dive.state.pitch).toBeLessThan(0)
    expect(dive.state.verticalSpeed).toBeLessThan(0)
    expect(dive.position.y).toBeLessThan(diveStart)
  })

  it('banks before turning and holds a bounded bank', () => {
    const model = new FlightModel()
    placeAirborne(model, 120, 48)
    const startHeading = model.state.heading
    advance(model, 480, controls({ throttle: 0.8, roll: 1, rollActive: true }))

    expect(model.state.roll).toBeGreaterThan(0.55)
    expect(model.state.roll).toBeLessThan(1.02)
    expect(Math.abs(model.state.heading - startHeading)).toBeGreaterThan(0.1)

    advance(model, 180, controls({ throttle: 0.8 }))
    expect(Math.abs(model.state.roll)).toBeLessThan(0.3)
  })

  it('returns toward level roll and gentle cruise pitch after release', () => {
    const model = new FlightModel()
    placeAirborne(model, 120, 48)
    model.orientation.setFromAxisAngle(new Vector3(0, 0, 1), 0.7)
    model.velocity.set(0, 0, -45)
    advance(model, 180, controls({ throttle: 0.7, pitch: 1, roll: 1, pitchActive: true, rollActive: true }))
    const bankAtRelease = Math.abs(model.state.roll)
    advance(model, 150, controls({ throttle: 0.7 }))

    expect(bankAtRelease).toBeGreaterThan(0.1)
    expect(Math.abs(model.state.roll)).toBeLessThan(bankAtRelease)
    expect(Math.abs(model.state.roll)).toBeLessThan(0.18)
    expect(Math.abs(model.state.pitch)).toBeLessThan(0.2)
  })

  it('maps yaw to heading changes without throttle changes', () => {
    const model = new FlightModel()
    placeAirborne(model, 120, 42)
    const startHeading = model.state.heading
    const startThrottle = model.state.throttle
    advance(model, 180, controls({ throttle: startThrottle, yaw: 1, yawActive: true }))

    expect(model.state.heading).toBeGreaterThan(startHeading)
    expect(model.state.throttle).toBe(startThrottle)
  })

  it('applies air brake drag while grounded brakes stop taxi', () => {
    const air = new FlightModel()
    placeAirborne(air, 120, 50)
    const normalSpeed = air.velocity.length()
    advance(air, 60, controls({ throttle: 0.7, brakes: true }))
    expect(air.velocity.length()).toBeLessThan(normalSpeed)

    const ground = new FlightModel()
    advance(ground, 240, controls({ throttle: 1, throttleInput: 1 }))
    const movingSpeed = ground.state.airspeed
    advance(ground, 120, controls({ throttle: 1, throttleInput: 1, brakes: true }))
    expect(ground.state.airspeed).toBeLessThan(movingSpeed)
  })

  it('crashes on terrain and water and resets to the runway', () => {
    const terrain = new FlightModel()
    const x = -420
    const z = -1000
    terrain.position.set(x, getSurfaceHeight(x, z) + 3, z)
    terrain.velocity.set(0, 0, -60)
    const terrainEvent = advance(terrain, 360, controls({
      throttle: 1,
      pitch: 1,
      roll: 1,
      pitchActive: true,
      rollActive: true,
      flaps: 1,
    })).find((event) => event.type === 'crash')
    expect(terrainEvent?.type).toBe('crash')
    expect(terrainEvent?.reason).toBe('terrain')
    expect(terrain.state.throttle).toBe(0)
    expect(terrain.state.flaps).toBe(0)
    expect(terrain.controlState.pitch).toBe(0)
    expect(terrain.controlState.roll).toBe(0)
    terrain.reset()
    expect(isRunwayPoint(terrain.position.x, terrain.position.z)).toBe(true)

    const water = new FlightModel()
    water.position.set(1000, WORLD.waterLevel, 1000)
    water.velocity.set(0, -1, 0)
    const waterEvent = water.step(FLIGHT.fixedStep, controls())
    expect(waterEvent?.type).toBe('crash')
    expect(waterEvent?.reason).toBe('water')
    water.reset()
    expect(water.state.grounded).toBe(true)
  })

  it('interpolates the rendered pose across the latest fixed physics step', () => {
    const model = new FlightModel()
    placeAirborne(model, 120, 48)
    const poseStart = model.position.clone()

    model.step(FLIGHT.fixedStep, controls({ throttle: 0.8 }))
    const poseCurrent = model.position.clone()
    const midpointPosition = new Vector3()
    const midpointOrientation = new Quaternion()
    model.writeInterpolatedPose(midpointPosition, midpointOrientation, 0.5)
    const midpointTravel = midpointPosition.distanceTo(poseStart)
    const fullStepTravel = poseCurrent.distanceTo(poseStart)

    expect(midpointTravel).toBeGreaterThan(0)
    expect(midpointTravel).toBeLessThan(fullStepTravel)
    expect(Number.isFinite(midpointOrientation.w)).toBe(true)

    model.step(FLIGHT.fixedStep * 0.75, controls({ throttle: 0.8 }))
    const latePosition = new Vector3()
    const lateOrientation = new Quaternion()
    model.writeInterpolatedPose(latePosition, lateOrientation)
    const lateTravel = latePosition.distanceTo(poseStart)
    expect(model.renderInterpolationAlpha).toBeGreaterThan(0)
    expect(model.renderInterpolationAlpha).toBeLessThan(1)
    expect(lateTravel).toBeGreaterThan(midpointTravel)
    expect(lateTravel).toBeLessThan(fullStepTravel)
  })

  it('reports a safe runway touchdown and clean landing', () => {
    const model = new FlightModel()
    const surface = getSurfaceHeight(WORLD.airfield.centerX, WORLD.airfield.centerZ)
    model.position.set(WORLD.airfield.centerX, surface + 8, WORLD.airfield.centerZ)
    model.velocity.set(0, -1, -20)
    const events = advance(model, 360, controls())
    expect(events.some((event) => event.type === 'touchdown')).toBe(true)
    expect(events.some((event) => event.type === 'cleanLanding')).toBe(true)
    expect(model.state.grounded).toBe(true)
  })
})
