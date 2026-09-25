import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CameraMode, CameraRig } from '../src/systems/cameraRig'

const cameraBank = (camera: THREE.PerspectiveCamera): number => {
  const direction = new THREE.Vector3()
  const levelRight = new THREE.Vector3()
  const levelUp = new THREE.Vector3()
  const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
  const difference = new THREE.Vector3()
  camera.getWorldDirection(direction)
  levelRight.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize()
  levelUp.crossVectors(levelRight, direction).normalize()
  difference.crossVectors(levelUp, cameraUp)
  return Math.abs(Math.atan2(difference.dot(direction), levelUp.dot(cameraUp)))
}

const snapshot = (pitch: number, roll: number, grounded = false) => ({
  position: { x: -650, y: 32, z: 750 },
  quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0.2, roll, 'XYZ')),
  velocity: { x: 0, y: 0, z: -40 },
  grounded,
})

describe('CameraRig', () => {
  it('keeps the chase camera upright behind an extreme aircraft attitude', () => {
    const camera = new THREE.PerspectiveCamera(57, 1.44, 0.08, 1000)
    const rig = new CameraRig(camera, CameraMode.Chase)
    rig.update(1, snapshot(1.35, 1.2), false, {})

    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)
    expect(Number.isFinite(camera.position.x)).toBe(true)
    expect(Number.isFinite(camera.position.y)).toBe(true)
    expect(Number.isFinite(camera.position.z)).toBe(true)
    expect(direction.y).toBeGreaterThan(-0.65)
    expect(direction.y).toBeLessThan(0.65)
    expect(camera.position.y).toBeGreaterThan(0)
  })

  it('banks the chase camera to half of the aircraft roll', () => {
    const levelCamera = new THREE.PerspectiveCamera(57, 1.44, 0.08, 1000)
    const rolledCamera = new THREE.PerspectiveCamera(57, 1.44, 0.08, 1000)
    const levelRig = new CameraRig(levelCamera, CameraMode.Chase)
    const rolledRig = new CameraRig(rolledCamera, CameraMode.Chase)

    levelRig.update(1 / 60, snapshot(0.08, 0), false, {})
    rolledRig.update(1 / 60, snapshot(0.08, 0.8), false, {})

    expect(cameraBank(levelCamera)).toBeLessThan(0.01)
    expect(cameraBank(rolledCamera)).toBeGreaterThan(0.3)
    expect(cameraBank(rolledCamera)).toBeLessThan(0.5)
  })

  it('lags the interpolated aircraft pose instead of copying each frame', () => {
    const camera = new THREE.PerspectiveCamera(57, 1.44, 0.08, 1000)
    const rig = new CameraRig(camera, CameraMode.Chase)
    const initial = snapshot(0.08, 0.08)
    rig.update(1 / 60, initial, false, {})
    const initialX = camera.position.x
    const moved = {
      ...initial,
      position: { x: initial.position.x + 1, y: initial.position.y, z: initial.position.z },
    }

    rig.update(1 / 60, moved, false, {})

    expect(camera.position.x).toBeGreaterThan(initialX)
    expect(camera.position.x - initialX).toBeLessThan(1)
  })

  it('ignores non-finite timing and orbit input', () => {
    const camera = new THREE.PerspectiveCamera(57, 1.44, 0.08, 1000)
    const rig = new CameraRig(camera, CameraMode.Orbit)
    rig.update(Number.NaN, snapshot(0.2, 0.2), false, { x: Number.NaN, y: Number.NaN, zoom: Number.NaN })
    expect(Number.isFinite(camera.position.x)).toBe(true)
    expect(Number.isFinite(camera.position.y)).toBe(true)
    expect(Number.isFinite(camera.position.z)).toBe(true)
    expect(Number.isFinite(camera.quaternion.w)).toBe(true)
  })

  it('keeps cockpit view finite and upright during a bad pitch', () => {
    const camera = new THREE.PerspectiveCamera(57, 1.44, 0.08, 1000)
    const rig = new CameraRig(camera, CameraMode.Cockpit)
    rig.update(1, snapshot(-1.4, -1.1), false, {})

    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    expect(Number.isFinite(camera.position.y)).toBe(true)
    expect(up.y).toBeGreaterThan(0.2)
  })
})
