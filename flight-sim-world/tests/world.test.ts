import { describe, expect, it } from 'vitest'
import { WORLD } from '../src/core/config'
import { getRegionAt, getSurfaceHeight, getTerrainHeight } from '../src/core/heightfield'

describe('World surface and regions', () => {
  it('uses the visible runway top as the landing surface', () => {
    expect(getSurfaceHeight(WORLD.airfield.centerX, WORLD.airfield.centerZ)).toBeCloseTo(WORLD.airfield.elevation + 0.7)
  })

  it('places the two villages on separate raised ridges', () => {
    const [bellweather, morrow] = WORLD.villages
    expect(bellweather).toBeDefined()
    expect(morrow).toBeDefined()
    if (bellweather === undefined || morrow === undefined) return
    const bellweatherHeight = getTerrainHeight(bellweather.x, bellweather.z)
    const morrowHeight = getTerrainHeight(morrow.x, morrow.z)
    expect(bellweatherHeight).toBeGreaterThan(35)
    expect(morrowHeight).toBeGreaterThan(35)
    expect(Math.hypot(bellweather.x - morrow.x, bellweather.z - morrow.z)).toBeGreaterThan(700)
  })

  it('uses stable landmark regions for the coast, river, and pass', () => {
    expect(getRegionAt(WORLD.lighthouse.x, 100, WORLD.lighthouse.z)).toBe('Coastal Bluffs')
    expect(getRegionAt(-254, 60, -360)).toBe('River Valley')
    expect(getRegionAt(WORLD.mountain.passX, 170, WORLD.mountain.z + 120)).toBe('Mountain Spine')
  })
})
