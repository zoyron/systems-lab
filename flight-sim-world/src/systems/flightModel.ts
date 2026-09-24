import { Quaternion, Vector3 } from 'three'
import { FLIGHT, WORLD } from '../core/config'
import { getSurfaceHeight, isRunwayPoint, isWaterAt } from '../core/heightfield'

const GRAVITY = 9.81
const STALL_ANGLE = 0.3
const STALL_RECOVERY_ANGLE = 0.2
const LIFT_SLOPE = 4.8
const BASE_LIFT_COEFFICIENT = 0.12
const PARASITE_DRAG_COEFFICIENT = 0.024
const INDUCED_EFFICIENCY = 0.82
const SIDE_DRAG_COEFFICIENT = 0.12
const ROLLING_RESISTANCE = 0.42
const BRAKE_DECELERATION = 8.2
const LANDING_CONFIRMATION_TIME = 0.14
const MAX_BANK = 55 * Math.PI / 180
const MAX_PITCH = 24 * Math.PI / 180
const CRUISE_PITCH = 3.5 * Math.PI / 180
const ROLL_RESPONSE = 2.1
const PITCH_RESPONSE = 1.75
const MAX_ROLL_RATE = 1.3
const MAX_PITCH_RATE = 0.42
const GROUND_FORWARD_SPEED = 44
const GROUND_REVERSE_SPEED = 8
const GROUND_STEER_RATE = 0.82
const GROUND_MAX_STEER_RATE = 0.68
const AIR_TARGET_SPEED = 58
const AIR_MIN_SPEED = 8
const AIR_PATH_RESPONSE = 0.92
const EPSILON = 1e-9
const LOCAL_FORWARD = new Vector3(0, 0, -1)
const LOCAL_X = new Vector3(1, 0, 0)
const LOCAL_Y = new Vector3(0, 1, 0)
const LOCAL_Z = new Vector3(0, 0, 1)

export type FlightControls = {
  throttle?: number
  throttleAxis?: number
  throttleInput?: number
  pitch?: number
  roll?: number
  yaw?: number
  aileron?: number
  elevator?: number
  rudder?: number
  brakes?: number | boolean
  brake?: number | boolean
  reverse?: number | boolean
  boost?: boolean
  pitchActive?: boolean
  rollActive?: boolean
  yawActive?: boolean
  flaps?: number
}

export type FlightEventType =
  | 'takeoff'
  | 'touchdown'
  | 'bounce'
  | 'cleanLanding'
  | 'crash'
  | 'stallEnter'
  | 'stallExit'

export type FlightEventReason = 'hardImpact' | 'terrain' | 'water' | 'outOfBounds'

export type FlightEvent = {
  type: FlightEventType
  position: Vector3
  airspeed: number
  altitude: number
  verticalSpeed: number
  groundSpeed: number
  aoa: number
  impactSpeed?: number
  reason?: FlightEventReason
  reset?: boolean
}

export type FlightState = {
  position: Vector3
  velocity: Vector3
  orientation: Quaternion
  quaternion: Quaternion
  heading: number
  pitch: number
  roll: number
  altitude: number
  heightAboveGround: number
  groundHeight: number
  airspeed: number
  groundSpeed: number
  verticalSpeed: number
  grounded: boolean
  stalled: boolean
  aoa: number
  throttle: number
  brakes: number
  flaps: number
  crashed: boolean
}

export type FlightSnapshot = FlightState

type NormalizedControls = {
  throttle: number
  throttleInput: number
  pitch: number
  roll: number
  yaw: number
  brakes: number
  reverse: number
  boost: boolean
  pitchActive: boolean
  rollActive: boolean
  yawActive: boolean
  flaps: number
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

const finiteOrZero = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) ? value : 0

const brakeAmount = (value: number | boolean | undefined): number => {
  if (value === true) return 1
  if (value === false || value === undefined) return 0
  return clamp(finiteOrZero(value), 0, 1)
}

const defaultPosition = (): Vector3 => {
  const x = WORLD.airfield.centerX
  const z = WORLD.airfield.centerZ + WORLD.airfield.runwayLength / 2 - 24
  return new Vector3(x, getSurfaceHeight(x, z) + FLIGHT.wheelHeight, z)
}

export class FlightModel {
  public readonly position: Vector3

  public readonly velocity: Vector3

  public readonly orientation: Quaternion

  public readonly state: FlightState

  private readonly initialPosition: Vector3

  private readonly initialOrientation: Quaternion

  private readonly forwardAxis = new Vector3()

  private readonly upAxis = new Vector3()

  private readonly rightAxis = new Vector3()

  private readonly horizontalForward = new Vector3()

  private readonly lateralVelocity = new Vector3()

  private readonly levelRight = new Vector3()

  private readonly levelUp = new Vector3()

  private readonly pathVelocity = new Vector3()

  private readonly pathError = new Vector3()

  private readonly rotation = new Quaternion()

  private readonly force = new Vector3()

  private readonly acceleration = new Vector3()

  private readonly terrainNormal = new Vector3()

  private accumulator = 0

  private grounded = true

  private stalledState = false

  private aoaState = 0

  private landingPending = false

  private landingElapsed = 0

  private crashedState = false

  private crashEventPending = false

  private crashReason: FlightEventReason = 'terrain'

  constructor(position?: Vector3, orientation?: Quaternion) {
    this.initialPosition = (position ?? defaultPosition()).clone()
    this.initialOrientation = (orientation ?? new Quaternion()).clone().normalize()
    this.position = this.initialPosition.clone()
    this.velocity = new Vector3()
    this.orientation = this.initialOrientation.clone()
    this.state = {
      position: this.position,
      velocity: this.velocity,
      orientation: this.orientation,
      quaternion: this.orientation,
      heading: 0,
      pitch: 0,
      roll: 0,
      altitude: this.position.y,
      heightAboveGround: 0,
      groundHeight: 0,
      airspeed: 0,
      groundSpeed: 0,
      verticalSpeed: 0,
      grounded: true,
      stalled: false,
      aoa: 0,
      throttle: 0,
      brakes: 0,
      flaps: 0,
      crashed: false,
    }
    this.reset()
  }

  get snapshot(): FlightSnapshot {
    return this.state
  }

  getState(): FlightSnapshot {
    return this.state
  }

  get quaternion(): Quaternion {
    return this.orientation
  }

  get heading(): number {
    return this.state.heading
  }

  get pitch(): number {
    return this.state.pitch
  }

  get roll(): number {
    return this.state.roll
  }

  get altitude(): number {
    return this.state.altitude
  }

  get airspeed(): number {
    return this.state.airspeed
  }

  get isGrounded(): boolean {
    return this.state.grounded
  }

  get groundedState(): boolean {
    return this.state.grounded
  }

  get stalled(): boolean {
    return this.state.stalled
  }

  get isStalled(): boolean {
    return this.state.stalled
  }

  get isCrashed(): boolean {
    return this.state.crashed
  }

  reset(position?: Vector3, orientation?: Quaternion): void {
    this.position.copy(position ?? this.initialPosition)
    this.orientation.copy(orientation ?? this.initialOrientation).normalize()
    this.velocity.set(0, 0, 0)
    this.accumulator = 0
    this.grounded = this.position.y <= getSurfaceHeight(this.position.x, this.position.z) + FLIGHT.wheelHeight + 0.08
    this.stalledState = false
    this.aoaState = 0
    this.landingPending = false
    this.landingElapsed = 0
    this.crashedState = false
    this.crashEventPending = false
    this.crashReason = 'terrain'
    this.state.throttle = 0
    this.state.brakes = 0
    this.state.flaps = 0
    this.state.crashed = false
    this.updateState()
  }

  step(dt: number, controls: FlightControls = {}): FlightEvent | null {
    const normalizedControls = this.normalizeControls(controls)
    this.state.throttle = normalizedControls.throttle
    this.state.brakes = normalizedControls.brakes
    this.state.flaps = normalizedControls.flaps

    if (this.crashedState) {
      this.updateState()
      if (!this.crashEventPending) return null
      this.crashEventPending = false
      return this.makeEvent('crash', this.crashReason, this.state.airspeed)
    }

    if (!Number.isFinite(dt) || dt <= 0) {
      this.updateState()
      return null
    }

    const frameTime = Math.min(dt, FLIGHT.maxFrameTime)
    this.accumulator = Math.min(this.accumulator + frameTime, FLIGHT.maxFrameTime)
    let event: FlightEvent | null = null

    while (this.accumulator + EPSILON >= FLIGHT.fixedStep) {
      this.accumulator -= FLIGHT.fixedStep
      if (this.accumulator < 0) this.accumulator = 0
      const nextEvent = this.integrate(FLIGHT.fixedStep, normalizedControls)
      if (nextEvent?.type === 'crash') {
        event = nextEvent
        this.crashEventPending = false
        this.accumulator = 0
        break
      }
      if (event === null && nextEvent !== null) event = nextEvent
    }

    this.updateState()
    return event
  }

  private normalizeControls(controls: FlightControls): NormalizedControls {
    const throttleInput = clamp(finiteOrZero(controls.throttleInput ?? controls.throttleAxis), -1, 1)
    const reverse = brakeAmount(controls.reverse ?? (throttleInput < 0 ? true : false))
    return {
      throttle: clamp(controls.boost === true ? 1 : finiteOrZero(controls.throttle), 0, 1),
      throttleInput,
      pitch: clamp(finiteOrZero(controls.pitch ?? controls.elevator), -1, 1),
      roll: clamp(finiteOrZero(controls.roll ?? controls.aileron), -1, 1),
      yaw: clamp(finiteOrZero(controls.yaw ?? controls.rudder), -1, 1),
      brakes: brakeAmount(controls.brakes ?? controls.brake),
      reverse,
      boost: controls.boost === true,
      pitchActive: controls.pitchActive ?? Math.abs(controls.pitch ?? controls.elevator ?? 0) > 0.01,
      rollActive: controls.rollActive ?? Math.abs(controls.roll ?? controls.aileron ?? 0) > 0.01,
      yawActive: controls.yawActive ?? Math.abs(controls.yaw ?? controls.rudder ?? 0) > 0.01,
      flaps: clamp(finiteOrZero(controls.flaps), 0, 1),
    }
  }

  private integrate(dt: number, controls: NormalizedControls): FlightEvent | null {
    this.updateAxes()
    const groundHeight = getSurfaceHeight(this.position.x, this.position.z)
    const contactHeight = groundHeight + FLIGHT.wheelHeight
    const canRemainGrounded = this.grounded && this.position.y <= contactHeight + 0.08 && this.velocity.y <= 0.08

    if (this.isInWater()) return this.crash('water')
    if (canRemainGrounded) return this.integrateGround(dt, controls)

    this.grounded = false
    return this.integrateAir(dt, controls)
  }

  private integrateGround(dt: number, controls: NormalizedControls): FlightEvent | null {
    const incomingVerticalSpeed = Math.max(0, -this.velocity.y)
    if (incomingVerticalSpeed > 0.05) {
      this.position.y = getSurfaceHeight(this.position.x, this.position.z) + FLIGHT.wheelHeight
      return this.resolveTouchdown(incomingVerticalSpeed)
    }

    this.grounded = true
    this.velocity.y = 0
    this.updateAxes()

    const groundSpeed = Math.hypot(this.velocity.x, this.velocity.z)
    const steeringInput = clamp(controls.yaw + controls.roll + controls.pitch * 0.22, -1, 1)
    const steeringAuthority = 0.35 + clamp(groundSpeed / 30, 0, 1) * 0.65
    const steeringRate = Math.min(GROUND_MAX_STEER_RATE, GROUND_STEER_RATE * steeringAuthority)
    this.rotateLocal(LOCAL_Y, -steeringInput * steeringRate * dt)
    this.updateAxes()

    this.horizontalForward.set(this.forwardAxis.x, 0, this.forwardAxis.z)
    if (this.horizontalForward.lengthSq() < EPSILON) this.horizontalForward.copy(LOCAL_FORWARD)
    this.horizontalForward.normalize()
    this.orientation.setFromUnitVectors(LOCAL_FORWARD, this.horizontalForward).normalize()
    this.updateAxes()

    const forwardSpeed = this.velocity.dot(this.horizontalForward)
    let targetSpeed = 0
    if (controls.brakes <= 0.02) {
      if (controls.throttleInput < -0.01 || controls.reverse > 0.5) targetSpeed = -GROUND_REVERSE_SPEED
      else if (controls.throttleInput > 0.01 || controls.boost) targetSpeed = GROUND_FORWARD_SPEED * Math.max(0.12, controls.throttle)
      else if (controls.throttle > 0.01) targetSpeed = GROUND_FORWARD_SPEED * controls.throttle
    }

    const driveAcceleration = clamp((targetSpeed - forwardSpeed) * 1.8, -10, 7)
    this.velocity.addScaledVector(this.horizontalForward, driveAcceleration * dt)

    const speedAfterDrive = this.hypotHorizontalVelocity()
    if (speedAfterDrive > EPSILON) {
      const resistance = controls.brakes > 0.02
        ? ROLLING_RESISTANCE + controls.brakes * BRAKE_DECELERATION
        : ROLLING_RESISTANCE + 0.5 * FLIGHT.airDensity * speedAfterDrive * speedAfterDrive * FLIGHT.wingArea * PARASITE_DRAG_COEFFICIENT / FLIGHT.mass
      const nextSpeed = Math.max(0, speedAfterDrive - resistance * dt)
      const speedScale = nextSpeed / speedAfterDrive
      this.velocity.x *= speedScale
      this.velocity.z *= speedScale
    }

    const alignedSpeed = this.velocity.dot(this.horizontalForward)
    this.lateralVelocity.copy(this.velocity).addScaledVector(this.horizontalForward, -alignedSpeed)
    this.velocity.addScaledVector(this.lateralVelocity, -Math.min(1, 12 * dt))

    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    if (Math.abs(this.position.x) > WORLD.halfSize + 200 || Math.abs(this.position.z) > WORLD.halfSize + 200) {
      return this.crash('outOfBounds')
    }
    const surfaceHeight = getSurfaceHeight(this.position.x, this.position.z)
    this.position.y = surfaceHeight + FLIGHT.wheelHeight
    this.velocity.y = 0
    this.aoaState = 0
    this.stalledState = false

    if (this.landingPending) {
      this.landingElapsed += dt
      const currentGroundSpeed = Math.hypot(this.velocity.x, this.velocity.z)
      if (this.landingElapsed >= LANDING_CONFIRMATION_TIME && currentGroundSpeed <= FLIGHT.safeLandingSpeed && isRunwayPoint(this.position.x, this.position.z)) {
        this.landingPending = false
        this.updateState()
        return this.makeEvent('cleanLanding')
      }
    }

    const currentForwardSpeed = this.velocity.dot(this.horizontalForward)
    const onRunway = isRunwayPoint(this.position.x, this.position.z)
    const forwardInput = controls.throttleInput >= -0.01 && controls.reverse <= 0.5
    const canTakeoff = onRunway && currentForwardSpeed >= FLIGHT.takeoffSpeed && controls.throttle > 0.2 && controls.brakes < 0.05 && forwardInput
    if (canTakeoff) {
      this.grounded = false
      this.landingPending = false
      this.position.y = surfaceHeight + FLIGHT.wheelHeight + 0.03
      this.rotateLocal(LOCAL_X, 0.1)
      this.velocity.y = Math.max(0.8, currentForwardSpeed * 0.018)
      this.aoaState = this.calculateAoa()
      this.updateState()
      return this.makeEvent('takeoff')
    }

    this.updateState()
    return null
  }

  private integrateAir(dt: number, controls: NormalizedControls): FlightEvent | null {
    this.grounded = false
    this.updateAxes()

    const currentRoll = this.currentRollAngle()
    const targetBank = clamp(controls.roll * MAX_BANK, -MAX_BANK, MAX_BANK)
    const rollResponse = controls.rollActive ? ROLL_RESPONSE + 0.35 : ROLL_RESPONSE
    const rollRate = clamp((targetBank - currentRoll) * rollResponse, -MAX_ROLL_RATE, MAX_ROLL_RATE)
    this.rotateLocal(LOCAL_Z, -rollRate * dt)
    this.updateAxes()

    const currentPitch = this.currentPitch()
    const targetPitch = clamp(CRUISE_PITCH + controls.pitch * MAX_PITCH, -MAX_PITCH, MAX_PITCH + CRUISE_PITCH)
    const pitchResponse = controls.pitchActive ? PITCH_RESPONSE + 0.25 : PITCH_RESPONSE
    const pitchRate = clamp((targetPitch - currentPitch) * pitchResponse, -MAX_PITCH_RATE, MAX_PITCH_RATE)
    this.rotateLocal(LOCAL_X, pitchRate * dt)
    this.updateAxes()

    const airspeedBeforeControl = Math.max(0.1, this.velocity.length())
    const controlAuthority = clamp(0.55 + airspeedBeforeControl / 55, 0.55, 1.15)
    const bankAngle = this.currentRollAngle()
    const forwardSpeedBeforeYaw = Math.max(1, this.velocity.dot(this.forwardAxis))
    const sideSpeedBeforeYaw = this.velocity.dot(this.rightAxis)
    const coordinatedYaw = Math.sin(bankAngle) * GRAVITY / Math.max(airspeedBeforeControl, 25) * 1.35
    const sideslipYaw = clamp(sideSpeedBeforeYaw / Math.max(forwardSpeedBeforeYaw, 12) * 0.42, -0.26, 0.26)
    const yawRate = controls.yaw * FLIGHT.yawRate + coordinatedYaw + sideslipYaw
    this.rotateLocal(LOCAL_Y, -yawRate * controlAuthority * dt)
    this.updateAxes()

    this.aoaState = this.calculateAoa()
    const airspeed = this.velocity.length()
    const stalled = this.stallCondition(airspeed, this.aoaState)
    const enteredStall = stalled && !this.stalledState
    const exitedStall = !stalled && this.stalledState
    this.stalledState = stalled

    const lift = this.calculateLift(airspeed, this.aoaState, stalled, controls.flaps)
    const liftCoefficient = this.calculateLiftCoefficient(this.aoaState, stalled, controls.flaps)
    const dynamicPressure = 0.5 * FLIGHT.airDensity * airspeed * airspeed
    const inducedCoefficient = liftCoefficient * liftCoefficient / (Math.PI * FLIGHT.aspectRatio * INDUCED_EFFICIENCY)
    const dragMultiplier = 1 + controls.brakes * 2.6
    const dragMagnitude = dynamicPressure * FLIGHT.wingArea * (PARASITE_DRAG_COEFFICIENT + inducedCoefficient + (stalled ? 0.08 : 0)) * dragMultiplier
    const sideSpeed = this.velocity.dot(this.rightAxis)
    const targetSpeed = Math.max(AIR_MIN_SPEED, controls.throttle * AIR_TARGET_SPEED)
    this.pathVelocity.copy(this.forwardAxis).multiplyScalar(targetSpeed)
    this.pathError.copy(this.pathVelocity).sub(this.velocity)

    this.force.set(0, -FLIGHT.mass * GRAVITY, 0)
    this.force.addScaledVector(this.forwardAxis, controls.throttle * FLIGHT.maxThrust)
    this.force.addScaledVector(this.upAxis, lift)
    this.force.addScaledVector(this.pathError, FLIGHT.mass * 0.88)
    if (airspeed > EPSILON) this.force.addScaledVector(this.velocity, -dragMagnitude / airspeed)
    this.force.addScaledVector(this.rightAxis, -sideSpeed * Math.abs(sideSpeed) * SIDE_DRAG_COEFFICIENT)

    this.acceleration.copy(this.force).multiplyScalar(dt / FLIGHT.mass)
    this.velocity.add(this.acceleration)
    const pathBlend = 1 - Math.exp(-AIR_PATH_RESPONSE * dt)
    this.velocity.lerp(this.pathVelocity, pathBlend * 0.22)
    this.position.addScaledVector(this.velocity, dt)

    if (stalled) this.rotateLocal(LOCAL_X, -0.18 * dt)
    this.updateAxes()
    this.aoaState = this.calculateAoa()

    if (this.isInWater()) return this.crash('water')
    if (Math.abs(this.position.x) > WORLD.halfSize + 200 || Math.abs(this.position.z) > WORLD.halfSize + 200) {
      return this.crash('outOfBounds')
    }

    const surfaceHeight = getSurfaceHeight(this.position.x, this.position.z)
    const contactHeight = surfaceHeight + FLIGHT.wheelHeight
    if (this.position.y <= contactHeight) {
      const impactSpeed = this.terrainImpactSpeed()
      this.position.y = contactHeight
      return this.resolveTouchdown(impactSpeed)
    }

    this.updateState()
    if (enteredStall) return this.makeEvent('stallEnter')
    if (exitedStall) return this.makeEvent('stallExit')
    return null
  }

  private resolveTouchdown(impactSpeed: number): FlightEvent | null {
    this.updateTerrainNormal()
    const groundSpeed = Math.hypot(this.velocity.x, this.velocity.z)
    const onRunway = isRunwayPoint(this.position.x, this.position.z)
    const bank = Math.abs(this.currentRollAngle())
    const pitch = Math.abs(this.currentPitch())
    const steepTerrain = this.terrainNormal.y < 0.86
    const impossibleAttitude = bank > 0.62 || pitch > 0.78
    if (impactSpeed > FLIGHT.crashVerticalSpeed || steepTerrain || impossibleAttitude) return this.crash('terrain', impactSpeed)
    if (!onRunway && (impactSpeed > 4.6 || groundSpeed > 18)) return this.crash('terrain', impactSpeed)

    if (impactSpeed > FLIGHT.safeLandingVerticalSpeed || (onRunway && groundSpeed > FLIGHT.safeLandingSpeed)) {
      this.position.y = getSurfaceHeight(this.position.x, this.position.z) + FLIGHT.wheelHeight + 0.02
      this.velocity.y = Math.max(1.1, impactSpeed * 0.28)
      this.grounded = false
      this.landingPending = false
      this.updateState()
      const event = this.makeEvent('touchdown', undefined, impactSpeed)
      return { ...event, type: 'bounce' }
    }

    this.grounded = true
    this.velocity.y = 0
    if (onRunway) this.alignToGround()
    this.landingPending = onRunway && groundSpeed <= FLIGHT.safeLandingSpeed && bank < 0.2 && pitch < 0.36
    this.landingElapsed = 0
    this.stalledState = false
    this.updateState()
    return this.makeEvent('touchdown', undefined, impactSpeed)
  }

  private calculateLift(speed: number, aoa: number, stalled: boolean, flaps: number): number {
    const coefficient = this.calculateLiftCoefficient(aoa, stalled, flaps)
    return 0.5 * FLIGHT.airDensity * speed * speed * FLIGHT.wingArea * coefficient
  }

  private calculateLiftCoefficient(aoa: number, stalled: boolean, flaps: number): number {
    const flapLift = flaps * 0.38
    const linearCoefficient = BASE_LIFT_COEFFICIENT + LIFT_SLOPE * aoa + flapLift
    const absoluteAoa = Math.abs(aoa)
    let coefficient = linearCoefficient
    if (absoluteAoa > STALL_ANGLE) {
      const peakCoefficient = BASE_LIFT_COEFFICIENT + LIFT_SLOPE * Math.sign(aoa) * STALL_ANGLE + flapLift
      const stallFade = Math.max(0.28, 1 - (absoluteAoa - STALL_ANGLE) * 2.2)
      coefficient = peakCoefficient * stallFade
    }
    if (stalled) coefficient *= 0.38
    return clamp(coefficient, -1.25, 1.5)
  }

  private stallCondition(speed: number, aoa: number): boolean {
    if (speed < 3) return false
    if (Math.abs(aoa) <= STALL_ANGLE) return false
    if (aoa > 0) return true
    return speed < FLIGHT.stallSpeed * 1.1 && aoa < -STALL_RECOVERY_ANGLE
  }

  private calculateAoa(): number {
    this.updateAxes()
    const airspeed = this.velocity.length()
    if (airspeed < 0.5) return 0
    const forwardSpeed = Math.max(0.5, this.velocity.dot(this.forwardAxis))
    const verticalSpeed = this.velocity.dot(this.upAxis)
    const aoa = clamp(Math.atan2(-verticalSpeed, forwardSpeed), -Math.PI / 2, Math.PI / 2)
    return Math.abs(aoa) < EPSILON ? 0 : aoa
  }

  private rotateLocal(axis: Vector3, angle: number): void {
    if (Math.abs(angle) < EPSILON) return
    this.rotation.setFromAxisAngle(axis, angle)
    this.orientation.multiply(this.rotation).normalize()
  }

  private currentPitch(): number {
    return Math.asin(clamp(this.forwardAxis.y, -1, 1))
  }

  private currentRollAngle(): number {
    return Math.atan2(-this.rightAxis.y, Math.max(0.001, this.upAxis.y))
  }

  private updateTerrainNormal(): void {
    const sample = 2
    const west = getSurfaceHeight(this.position.x - sample, this.position.z)
    const east = getSurfaceHeight(this.position.x + sample, this.position.z)
    const north = getSurfaceHeight(this.position.x, this.position.z - sample)
    const south = getSurfaceHeight(this.position.x, this.position.z + sample)
    this.terrainNormal.set(west - east, sample * 2, north - south).normalize()
  }

  private terrainImpactSpeed(): number {
    this.updateTerrainNormal()
    return Math.max(0, -this.velocity.dot(this.terrainNormal))
  }

  private alignToGround(): void {
    this.horizontalForward.set(this.forwardAxis.x, 0, this.forwardAxis.z)
    if (this.horizontalForward.lengthSq() < EPSILON) this.horizontalForward.copy(LOCAL_FORWARD)
    this.horizontalForward.normalize()
    this.orientation.setFromUnitVectors(LOCAL_FORWARD, this.horizontalForward).normalize()
    this.updateAxes()
  }

  private updateAxes(): void {
    this.forwardAxis.set(0, 0, -1).applyQuaternion(this.orientation).normalize()
    this.upAxis.set(0, 1, 0).applyQuaternion(this.orientation).normalize()
    this.rightAxis.set(1, 0, 0).applyQuaternion(this.orientation).normalize()
  }

  private hypotHorizontalVelocity(): number {
    return Math.hypot(this.velocity.x, this.velocity.z)
  }

  private isInWater(): boolean {
    return this.position.y <= WORLD.waterLevel + FLIGHT.wheelHeight && isWaterAt(this.position.x, this.position.z)
  }

  private crash(reason: FlightEventReason, impactSpeed?: number): FlightEvent {
    const event = this.makeEvent('crash', reason, impactSpeed)
    this.velocity.set(0, 0, 0)
    this.grounded = true
    this.landingPending = false
    this.stalledState = false
    this.aoaState = 0
    this.crashedState = true
    this.crashEventPending = true
    this.crashReason = reason
    this.updateState()
    return event
  }

  private makeEvent(type: FlightEventType, reason?: FlightEventReason, impactSpeed?: number): FlightEvent {
    return {
      type,
      position: this.position.clone(),
      airspeed: this.velocity.length(),
      altitude: this.position.y,
      verticalSpeed: this.velocity.y,
      groundSpeed: Math.hypot(this.velocity.x, this.velocity.z),
      aoa: this.aoaState,
      ...(reason === undefined ? {} : { reason }),
      ...(impactSpeed === undefined ? {} : { impactSpeed }),
    }
  }

  private updateState(): void {
    this.updateAxes()
    const groundHeight = getSurfaceHeight(this.position.x, this.position.z)
    const horizontalLength = Math.hypot(this.forwardAxis.x, this.forwardAxis.z)
    if (horizontalLength > EPSILON) {
      const heading = Math.atan2(this.forwardAxis.x, -this.forwardAxis.z)
      this.state.heading = Math.abs(heading) < EPSILON ? 0 : heading
      this.horizontalForward.set(this.forwardAxis.x, 0, this.forwardAxis.z).normalize()
      this.levelRight.set(-this.horizontalForward.z, 0, this.horizontalForward.x).normalize()
      this.levelUp.crossVectors(this.levelRight, this.horizontalForward).normalize()
      const roll = Math.atan2(-this.rightAxis.dot(this.levelUp), this.rightAxis.dot(this.levelRight))
      this.state.roll = Math.abs(roll) < EPSILON ? 0 : roll
    } else {
      const roll = Math.atan2(-this.rightAxis.y, Math.max(0.001, this.upAxis.y))
      this.state.roll = Math.abs(roll) < EPSILON ? 0 : roll
    }
    this.state.pitch = Math.asin(clamp(this.forwardAxis.y, -1, 1))
    this.state.altitude = this.position.y
    this.state.heightAboveGround = this.position.y - groundHeight
    this.state.groundHeight = groundHeight
    this.state.airspeed = this.velocity.length()
    this.state.groundSpeed = Math.hypot(this.velocity.x, this.velocity.z)
    this.state.verticalSpeed = this.velocity.y
    this.state.grounded = this.grounded
    this.state.stalled = this.stalledState
    this.state.aoa = this.aoaState
    this.state.crashed = this.crashedState
  }
}
