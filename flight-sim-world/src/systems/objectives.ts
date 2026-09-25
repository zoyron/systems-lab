import { Vector3 } from 'three'
import { WORLD } from '../core/config'
import { getRiverCenterX, isRunwayPoint } from '../core/heightfield'
import type { FlightEvent, FlightState } from './flightModel'

export type ObjectiveId = 'lanterns' | 'lighthouse' | 'landing'

export type ObjectiveSnapshot = {
  readonly id: ObjectiveId
  readonly text: string
  readonly complete: boolean
  readonly progress: number
}

type Completion = {
  complete: boolean
  progress: number
}

const TAU = Math.PI * 2

const lanternPosition = new Vector3(getRiverCenterX(-360), 42, -360)
const lighthousePosition = new Vector3(WORLD.lighthouse.x, 84, WORLD.lighthouse.z)

const normalizeAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle))

export class Objectives {
  readonly lanternRingPosition = lanternPosition.clone()

  readonly lighthousePosition = lighthousePosition.clone()

  private readonly completions: Record<ObjectiveId, Completion> = {
    lanterns: { complete: false, progress: 0 },
    lighthouse: { complete: false, progress: 0 },
    landing: { complete: false, progress: 0 },
  }

  private previousLanternDistance = Number.POSITIVE_INFINITY

  private previousLighthouseAngle: number | null = null

  private lighthouseDirection: -1 | 1 | null = null

  private cleanLandingPending = false

  update(deltaTime: number, flight: FlightState, event: FlightEvent | null): void {
    this.updateLanterns(flight)
    this.updateLighthouse(deltaTime, flight)
    this.updateLanding(flight, event)
  }

  get snapshots(): ObjectiveSnapshot[] {
    return [
      {
        id: 'lanterns',
        text: 'Pass through the river lanterns',
        complete: this.completions.lanterns.complete,
        progress: this.completions.lanterns.progress,
      },
      {
        id: 'lighthouse',
        text: 'Circle the Amberlight beam',
        complete: this.completions.lighthouse.complete,
        progress: this.completions.lighthouse.progress,
      },
      {
        id: 'landing',
        text: 'Land softly and stop on the runway',
        complete: this.completions.landing.complete,
        progress: this.completions.landing.progress,
      },
    ]
  }

  get completeCount(): number {
    return this.snapshots.filter((objective) => objective.complete).length
  }

  reset(): void {
    for (const completion of Object.values(this.completions)) {
      completion.complete = false
      completion.progress = 0
    }
    this.previousLanternDistance = Number.POSITIVE_INFINITY
    this.previousLighthouseAngle = null
    this.lighthouseDirection = null
    this.cleanLandingPending = false
  }

  cancelPendingLanding(): void {
    this.cleanLandingPending = false
  }

  private updateLanterns(flight: FlightState): void {
    const completion = this.completions.lanterns
    if (completion.complete) {
      completion.progress = 1
      return
    }
    const distance = flight.position.distanceTo(this.lanternRingPosition)
    const crossed = this.previousLanternDistance > 24 && distance <= 24
    if (crossed && !flight.grounded) {
      completion.complete = true
      completion.progress = 1
    } else {
      completion.progress = Math.max(0, Math.min(0.96, 1 - distance / 150))
    }
    this.previousLanternDistance = distance
  }

  private updateLighthouse(deltaTime: number, flight: FlightState): void {
    const completion = this.completions.lighthouse
    if (completion.complete) {
      completion.progress = 1
      this.previousLighthouseAngle = null
      this.lighthouseDirection = null
      return
    }
    const deltaX = flight.position.x - this.lighthousePosition.x
    const deltaZ = flight.position.z - this.lighthousePosition.z
    const distance = Math.hypot(deltaX, deltaZ)
    if (distance > 285 || distance < 20 || flight.grounded || flight.position.y < 22) {
      this.previousLighthouseAngle = null
      this.lighthouseDirection = null
      return
    }
    const angle = Math.atan2(deltaZ, deltaX)
    if (this.previousLighthouseAngle !== null && deltaTime > 0 && deltaTime <= 0.25) {
      const signedDelta = normalizeAngle(angle - this.previousLighthouseAngle)
      if (Math.abs(signedDelta) > 0.0001) {
        if (this.lighthouseDirection === null) this.lighthouseDirection = signedDelta > 0 ? 1 : -1
        completion.progress = Math.max(
          0,
          Math.min(0.99, completion.progress + signedDelta / TAU * this.lighthouseDirection),
        )
        if (completion.progress >= 0.985) {
          completion.complete = true
          completion.progress = 1
        }
      }
    }
    this.previousLighthouseAngle = angle
  }

  private updateLanding(flight: FlightState, event: FlightEvent | null): void {
    const completion = this.completions.landing
    if (completion.complete) {
      completion.progress = 1
      return
    }
    if (event?.type === 'crash') this.cleanLandingPending = false
    if (event?.type === 'cleanLanding') this.cleanLandingPending = true
    if (this.cleanLandingPending && flight.grounded && flight.groundSpeed < 1.2 && isRunwayPoint(flight.position.x, flight.position.z)) {
      completion.complete = true
      completion.progress = 1
      this.cleanLandingPending = false
    }
  }
}
