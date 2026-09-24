import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CameraMode, CameraRig } from '../src/systems/cameraRig'

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
