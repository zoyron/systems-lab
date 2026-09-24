import { describe, expect, it } from 'vitest'
import { WORLD } from '../src/core/config'
import { getTerrainHeight } from '../src/core/heightfield'
import { FlightModel } from '../src/systems/flightModel'
import { Objectives } from '../src/systems/objectives'

describe('Objectives', () => {
  it('completes when the aircraft crosses the lantern ring', () => {
    const objectives = new Objectives()
    const flight = new FlightModel().getState()
    flight.grounded = false

    flight.position.copy(objectives.lanternRingPosition)
    flight.position.z += 30
    objectives.update(1 / 60, flight, null)
    flight.position.z = objectives.lanternRingPosition.z
    objectives.update(1 / 60, flight, null)

    expect(objectives.snapshots[0]?.complete).toBe(true)
  })

  it('accumulates a full lighthouse circle', () => {
    const objectives = new Objectives()
    const flight = new FlightModel().getState()
    flight.grounded = false
    flight.position.set(650, 100, 430)
    objectives.update(1 / 60, flight, null)

    for (let index = 1; index <= 151; index += 1) {
      const angle = (index / 150) * Math.PI * 2
      flight.position.set(650 + Math.cos(angle) * 150, 100, 430 + Math.sin(angle) * 150)
      objectives.update(1 / 60, flight, null)
    }

    expect(objectives.snapshots[1]?.complete).toBe(true)
  })

  it('does not count back-and-forth movement as a lighthouse circle', () => {
    const objectives = new Objectives()
    const flight = new FlightModel().getState()
    flight.grounded = false
    flight.position.set(800, 100, 430)
    objectives.update(1 / 60, flight, null)

    for (let index = 0; index < 300; index += 1) {
      const angle = index % 2 === 0 ? 0.4 : -0.4
      flight.position.set(650 + Math.cos(angle) * 150, 100, 430 + Math.sin(angle) * 150)
      objectives.update(1 / 60, flight, null)
    }

    expect(objectives.snapshots[1]?.complete).toBe(false)
  })

  it('completes a clean landing only after stopping on the runway', () => {
    const objectives = new Objectives()
    const flight = new FlightModel().getState()
    flight.position.set(WORLD.airfield.centerX, getTerrainHeight(WORLD.airfield.centerX, WORLD.airfield.centerZ) + 1.5, WORLD.airfield.centerZ)
    flight.grounded = true
    flight.groundSpeed = 4
    objectives.update(1 / 60, flight, {
      type: 'cleanLanding',
      position: flight.position.clone(),
      airspeed: 4,
      altitude: flight.position.y,
      verticalSpeed: 0,
      groundSpeed: 4,
      aoa: 0,
    })
    expect(objectives.snapshots[2]?.complete).toBe(false)

    flight.groundSpeed = 0.5
    objectives.update(1 / 60, flight, null)
    expect(objectives.snapshots[2]?.complete).toBe(true)
  })
})
