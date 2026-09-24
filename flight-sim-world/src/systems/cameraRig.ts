import * as THREE from 'three'
import { WORLD } from '../core/config'
import { clamp, damp } from '../core/math'
import { getSurfaceHeight } from '../core/heightfield'

export enum CameraMode {
  Chase = 'chase',
  NearChase = 'nearChase',
  Cockpit = 'cockpit',
  Orbit = 'orbit',
}

export interface OrbitInput {
  x?: number
  y?: number
  zoom?: number
  yaw?: number
  pitch?: number
}

export interface FlightSnapshot {
  position: {
    readonly x: number
    readonly y: number
    readonly z: number
  }
  quaternion?: {
    readonly x: number
    readonly y: number
    readonly z: number
    readonly w: number
  }
  orientation?: {
    readonly x: number
    readonly y: number
    readonly z: number
    readonly w: number
  }
  rotation?: {
    readonly x: number
    readonly y: number
    readonly z: number
    readonly order?: THREE.EulerOrder
  }
  velocity?: {
    readonly x: number
    readonly y: number
    readonly z: number
  }
  grounded?: boolean
}

const WORLD_UP = new THREE.Vector3(0, 1, 0)
const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1)
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0)
const LOCAL_UP = new THREE.Vector3(0, 1, 0)
const COCKPIT_EYE = new THREE.Vector3(0, 0.62, -0.12)
const COCKPIT_PITCH = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -0.045,
)

const finiteOrZero = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) ? value : 0

const dampAngle = (current: number, target: number, lambda: number, delta: number): number => {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + difference * (1 - Math.exp(-lambda * delta))
}

const safeGroundHeight = (x: number, z: number): number =>
  Math.max(getSurfaceHeight(x, z), WORLD.waterLevel)

export class CameraRig {
  mode: CameraMode = CameraMode.Chase

  private readonly aircraftPosition = new THREE.Vector3()
  private readonly aircraftQuaternion = new THREE.Quaternion()
  private readonly aircraftForward = new THREE.Vector3()
  private readonly aircraftUp = new THREE.Vector3()
  private readonly aircraftRight = new THREE.Vector3()
  private readonly trackingForward = new THREE.Vector3()
  private readonly trackingRight = new THREE.Vector3()
  private readonly trackingUp = new THREE.Vector3()
  private readonly safeAircraftForward = new THREE.Vector3()
  private readonly safeAircraftRight = new THREE.Vector3()
  private readonly safeAircraftUp = new THREE.Vector3()
  private readonly safeAircraftQuaternion = new THREE.Quaternion()
  private readonly desiredPosition = new THREE.Vector3()
  private readonly desiredTarget = new THREE.Vector3()
  private readonly previousPosition = new THREE.Vector3()
  private readonly lookDirection = new THREE.Vector3()
  private readonly cameraBack = new THREE.Vector3()
  private readonly basis = new THREE.Matrix4()
  private readonly desiredQuaternion = new THREE.Quaternion()
  private readonly snapshotEuler = new THREE.Euler()
  private orbitYaw = 0.68
  private orbitPitch = 0.31
  private orbitDistance = 18
  private targetOrbitYaw = this.orbitYaw
  private targetOrbitPitch = this.orbitPitch
  private targetOrbitDistance = this.orbitDistance
  private needsSnap = true

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    initialMode: CameraMode = CameraMode.Chase,
  ) {
    this.mode = initialMode
    if (camera.near > 0.08) {
      camera.near = 0.08
      camera.updateProjectionMatrix()
    }
  }

  next(): CameraMode {
    const modes = [
      CameraMode.Chase,
      CameraMode.NearChase,
      CameraMode.Cockpit,
      CameraMode.Orbit,
    ]
    const currentIndex = modes.indexOf(this.mode)
    this.mode = modes[(currentIndex + 1) % modes.length] ?? CameraMode.Chase
    return this.mode
  }

  setMode(mode: CameraMode): CameraMode {
    this.mode = mode
    return this.mode
  }

  orbitBy(deltaYaw: number, deltaPitch: number): void {
    this.targetOrbitYaw += finiteOrZero(deltaYaw)
    this.targetOrbitPitch = clamp(this.targetOrbitPitch + finiteOrZero(deltaPitch), -0.08, 1.15)
  }

  zoomOrbit(deltaDistance: number): void {
    this.targetOrbitDistance = clamp(this.targetOrbitDistance + finiteOrZero(deltaDistance), 10, 32)
  }

  reset(snapImmediately = true): void {
    this.mode = CameraMode.Chase
    this.orbitYaw = 0.68
    this.orbitPitch = 0.31
    this.orbitDistance = 18
    this.targetOrbitYaw = this.orbitYaw
    this.targetOrbitPitch = this.orbitPitch
    this.targetOrbitDistance = this.orbitDistance
    if (snapImmediately) this.snap()
  }

  snap(): void {
    this.needsSnap = true
  }

  update(
    delta: number,
    aircraft: THREE.Object3D | FlightSnapshot,
    grounded = false,
    orbitInput: OrbitInput = {},
  ): void {
    const safeDelta = Number.isFinite(delta) ? clamp(delta, 0, 0.1) : 0
    const snapshot = aircraft as FlightSnapshot
    const object = aircraft as THREE.Object3D

    if (object instanceof THREE.Object3D) {
      object.getWorldPosition(this.aircraftPosition)
      object.getWorldQuaternion(this.aircraftQuaternion)
    } else {
      this.aircraftPosition.set(
        snapshot.position.x,
        snapshot.position.y,
        snapshot.position.z,
      )
      const snapshotQuaternion = snapshot.quaternion ?? snapshot.orientation
      if (snapshotQuaternion) {
        this.aircraftQuaternion.set(
          snapshotQuaternion.x,
          snapshotQuaternion.y,
          snapshotQuaternion.z,
          snapshotQuaternion.w,
        )
      } else if (snapshot.rotation) {
        this.snapshotEuler.set(
          snapshot.rotation.x,
          snapshot.rotation.y,
          snapshot.rotation.z,
          snapshot.rotation.order ?? 'XYZ',
        )
        this.aircraftQuaternion.setFromEuler(this.snapshotEuler)
      } else {
        this.aircraftQuaternion.identity()
      }
    }

    const isGrounded = grounded || snapshot.grounded === true
    this.aircraftForward.copy(LOCAL_FORWARD).applyQuaternion(this.aircraftQuaternion).normalize()
    this.aircraftUp.copy(LOCAL_UP).applyQuaternion(this.aircraftQuaternion).normalize()
    this.aircraftRight.copy(LOCAL_RIGHT).applyQuaternion(this.aircraftQuaternion).normalize()
    this.buildTrackingBasis()

    if (this.mode === CameraMode.Orbit) this.applyOrbitInput(orbitInput, safeDelta)
    this.calculateDesiredView(isGrounded)

    if (this.needsSnap) {
      this.camera.position.copy(this.desiredPosition)
      this.camera.quaternion.copy(this.desiredQuaternion)
      this.needsSnap = false
    } else {
      this.previousPosition.copy(this.camera.position)
      const positionLambda = this.mode === CameraMode.Cockpit ? 10 : 7.5
      const rotationLambda = this.mode === CameraMode.Cockpit ? 12 : 8.5
      this.camera.position.set(
        damp(this.camera.position.x, this.desiredPosition.x, positionLambda, safeDelta),
        damp(this.camera.position.y, this.desiredPosition.y, positionLambda, safeDelta),
        damp(this.camera.position.z, this.desiredPosition.z, positionLambda, safeDelta),
      )
      this.raisePathAboveGround(this.previousPosition, this.camera.position, 0.7)
      this.camera.quaternion.slerp(this.desiredQuaternion, 1 - Math.exp(-rotationLambda * safeDelta))
    }

    this.keepCameraAboveGround(this.camera.position, 0.38)
    this.keepCameraInWorld(this.camera.position)
    this.keepCameraAboveGround(this.camera.position, 0.38)
    this.camera.updateMatrixWorld()
  }

  private buildTrackingBasis(): void {
    this.trackingForward.copy(this.aircraftForward)
    this.trackingForward.y = clamp(this.trackingForward.y, -0.36, 0.36)
    if (this.trackingForward.lengthSq() < 0.0001) this.trackingForward.set(0, 0, -1)
    this.trackingForward.normalize()
    this.trackingRight.crossVectors(this.trackingForward, WORLD_UP)
    if (this.trackingRight.lengthSq() < 0.0001) this.trackingRight.copy(this.aircraftRight)
    else this.trackingRight.normalize()
    const bank = clamp(Math.atan2(this.aircraftRight.y, Math.max(0.001, this.aircraftUp.y)), -0.9, 0.9)
    this.trackingRight.applyAxisAngle(this.trackingForward, -bank * 0.18).normalize()
    this.trackingUp.crossVectors(this.trackingRight, this.trackingForward)
    if (this.trackingUp.lengthSq() < 0.0001) this.trackingUp.set(0, 1, 0)
    else this.trackingUp.normalize()
    this.buildSafeAircraftQuaternion()
  }

  private buildSafeAircraftQuaternion(): void {
    this.safeAircraftForward.copy(this.trackingForward)
    this.safeAircraftRight.crossVectors(this.safeAircraftForward, WORLD_UP)
    if (this.safeAircraftRight.lengthSq() < 0.0001) this.safeAircraftRight.set(1, 0, 0)
    else this.safeAircraftRight.normalize()
    this.safeAircraftUp.crossVectors(this.safeAircraftRight, this.safeAircraftForward)
    if (this.safeAircraftUp.lengthSq() < 0.0001) this.safeAircraftUp.set(0, 1, 0)
    else this.safeAircraftUp.normalize()
    this.cameraBack.copy(this.safeAircraftForward).multiplyScalar(-1)
    this.basis.makeBasis(this.safeAircraftRight, this.safeAircraftUp, this.cameraBack)
    this.safeAircraftQuaternion.setFromRotationMatrix(this.basis).normalize()
  }

  private applyOrbitInput(input: OrbitInput, delta: number): void {
    if (input.x !== undefined || input.y !== undefined) {
      this.orbitBy(finiteOrZero(input.x) * 0.006, finiteOrZero(input.y) * 0.005)
    }
    if (input.yaw !== undefined && Number.isFinite(input.yaw)) this.targetOrbitYaw = input.yaw
    if (input.pitch !== undefined && Number.isFinite(input.pitch)) {
      this.targetOrbitPitch = clamp(input.pitch, -0.08, 1.15)
    }
    if (input.zoom !== undefined) this.zoomOrbit(finiteOrZero(input.zoom) * 0.012)
    if (this.needsSnap) {
      this.orbitYaw = this.targetOrbitYaw
      this.orbitPitch = this.targetOrbitPitch
      this.orbitDistance = this.targetOrbitDistance
    } else {
      this.orbitYaw = dampAngle(this.orbitYaw, this.targetOrbitYaw, 12, delta)
      this.orbitPitch = damp(this.orbitPitch, this.targetOrbitPitch, 12, delta)
      this.orbitDistance = damp(this.orbitDistance, this.targetOrbitDistance, 10, delta)
    }
  }

  private calculateDesiredView(grounded: boolean): void {
    if (this.mode === CameraMode.Cockpit) {
      this.desiredPosition.copy(COCKPIT_EYE).applyQuaternion(this.safeAircraftQuaternion)
      this.desiredPosition.add(this.aircraftPosition)
      this.desiredQuaternion.copy(this.safeAircraftQuaternion).multiply(COCKPIT_PITCH)
      this.keepCameraAboveGround(this.desiredPosition, 0.3)
      return
    }

    if (this.mode === CameraMode.Orbit) {
      const horizontalDistance = Math.cos(this.orbitPitch) * this.orbitDistance
      this.desiredPosition.set(
        this.aircraftPosition.x + Math.sin(this.orbitYaw) * horizontalDistance,
        this.aircraftPosition.y + Math.sin(this.orbitPitch) * this.orbitDistance,
        this.aircraftPosition.z + Math.cos(this.orbitYaw) * horizontalDistance,
      )
      this.desiredTarget.copy(this.aircraftPosition).addScaledVector(WORLD_UP, 1)
      this.setLookQuaternion(this.desiredTarget)
      this.keepCameraAboveGround(this.desiredPosition, 0.8)
      return
    }

    const near = this.mode === CameraMode.NearChase
    const sideOffset = near ? (grounded ? 1.75 : 2.05) : grounded ? 3.1 : 3.35
    const verticalOffset = near ? (grounded ? 2.7 : 3.15) : grounded ? 4.6 : 5.2
    const rearOffset = near ? (grounded ? 9.8 : 10.4) : grounded ? 16.5 : 17.5
    this.desiredPosition
      .copy(this.aircraftPosition)
      .addScaledVector(this.trackingForward, -rearOffset)
      .addScaledVector(this.trackingRight, sideOffset)
      .addScaledVector(WORLD_UP, verticalOffset)
    this.desiredTarget
      .copy(this.aircraftPosition)
      .addScaledVector(this.trackingForward, near ? 2.4 : 4.5)
      .addScaledVector(WORLD_UP, near ? 0.72 : 0.9)
    this.setLookQuaternion(this.desiredTarget)
    this.keepCameraAboveGround(this.desiredPosition, near ? 0.65 : 0.85)
  }

  private setLookQuaternion(target: THREE.Vector3): void {
    this.lookDirection.subVectors(target, this.desiredPosition)
    if (this.lookDirection.lengthSq() < 0.0001) this.lookDirection.copy(this.trackingForward)
    else this.lookDirection.normalize()
    this.cameraBack.copy(this.lookDirection).multiplyScalar(-1)
    this.trackingRight.crossVectors(this.lookDirection, WORLD_UP)
    if (this.trackingRight.lengthSq() < 0.0001) this.trackingRight.copy(this.safeAircraftRight)
    else this.trackingRight.normalize()
    this.trackingUp.crossVectors(this.trackingRight, this.lookDirection)
    if (this.trackingUp.lengthSq() < 0.0001) this.trackingUp.copy(WORLD_UP)
    else this.trackingUp.normalize()
    this.basis.makeBasis(this.trackingRight, this.trackingUp, this.cameraBack)
    this.desiredQuaternion.setFromRotationMatrix(this.basis).normalize()
  }

  private keepCameraAboveGround(position: THREE.Vector3, clearance: number): void {
    position.y = Math.max(position.y, safeGroundHeight(position.x, position.z) + clearance)
  }

  private keepCameraInWorld(position: THREE.Vector3): void {
    position.x = clamp(position.x, -WORLD.halfSize, WORLD.halfSize)
    position.z = clamp(position.z, -WORLD.halfSize, WORLD.halfSize)
  }

  private raisePathAboveGround(
    from: THREE.Vector3,
    to: THREE.Vector3,
    clearance: number,
  ): void {
    const samples = 5
    for (let index = 1; index <= samples; index += 1) {
      const amount = index / samples
      const x = from.x + (to.x - from.x) * amount
      const z = from.z + (to.z - from.z) * amount
      const y = from.y + (to.y - from.y) * amount
      const minimumY = safeGroundHeight(x, z) + clearance
      if (y < minimumY) to.y += (minimumY - y) * amount
    }
  }
}
