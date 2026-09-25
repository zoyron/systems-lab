import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  TIME_OF_DAY_PRESETS,
  TIME_OF_DAY_TRANSITION_SECONDS,
  WORLD,
  mixTimeOfDayPreset,
} from '../src/core/config'
import { getRegionAt, getSurfaceHeight, getTerrainHeight } from '../src/core/heightfield'
import { World } from '../src/world/world'

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

  it('binds the transitioned fog to the rendered scene', () => {
    const dusk = TIME_OF_DAY_PRESETS[0]
    const night = TIME_OF_DAY_PRESETS[1]
    expect(dusk).toBeDefined()
    expect(night).toBeDefined()
    if (dusk === undefined || night === undefined) return

    const scene = new THREE.Scene()
    const world = new World(scene)
    expect(scene.fog).toBeInstanceOf(THREE.Fog)
    const fog = scene.fog as THREE.Fog
    world.applyTimeOfDay(dusk, night, 1)

    expect(scene.fog).toBe(fog)
    expect(fog.color.getHex()).toBe(night.fogColor)
    expect(fog.far).toBe(night.fogFar)
    world.dispose()
  })

  it('keeps the requested time order and blends interrupted transitions', () => {
    expect(TIME_OF_DAY_PRESETS.map((preset) => preset.name)).toEqual(['dusk', 'night', 'dawn', 'day'])
    expect(TIME_OF_DAY_TRANSITION_SECONDS).toBeGreaterThanOrEqual(1.2)
    expect(TIME_OF_DAY_TRANSITION_SECONDS).toBeLessThanOrEqual(1.8)

    const dusk = TIME_OF_DAY_PRESETS[0]
    const night = TIME_OF_DAY_PRESETS[1]
    expect(dusk).toBeDefined()
    expect(night).toBeDefined()
    if (dusk === undefined || night === undefined) return

    const midpoint = mixTimeOfDayPreset(dusk, night, 0.5)
    expect(midpoint.name).toBe('night')
    expect(midpoint.keyPosition[1]).toBeGreaterThan(dusk.keyPosition[1])
    expect(midpoint.keyPosition[1]).toBeLessThan(night.keyPosition[1])
    expect(midpoint.lampIntensity).toBeGreaterThan(dusk.lampIntensity)
  })
})
