import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  TIME_OF_DAY_PRESETS,
  TIME_OF_DAY_TRANSITION_SECONDS,
  WORLD,
  mixTimeOfDayPreset,
} from '../src/core/config'
import { getRegionAt, getSurfaceHeight, getTerrainHeight } from '../src/core/heightfield'
import { Sky } from '../src/world/sky'
import { World } from '../src/world/world'

const timeOfDayColorKeys = [
  'skyZenith',
  'skyUpper',
  'skyHorizon',
  'skyLower',
  'fogColor',
  'backgroundColor',
  'waterDeep',
  'waterShallow',
  'hemisphereSky',
  'hemisphereGround',
  'keyColor',
  'fillColor',
  'glowColor',
  'cloudColor',
  'worldCloudColor',
  'moonColor',
  'moonGlowColor',
  'sunColor',
] as const

const blendColorChannels = (from: number, to: number, amount: number): number => {
  const fromRed = (from >>> 16) & 0xff
  const fromGreen = (from >>> 8) & 0xff
  const fromBlue = from & 0xff
  const toRed = (to >>> 16) & 0xff
  const toGreen = (to >>> 8) & 0xff
  const toBlue = to & 0xff
  return Math.round(fromRed + (toRed - fromRed) * amount) * 0x10000
    + Math.round(fromGreen + (toGreen - fromGreen) * amount) * 0x100
    + Math.round(fromBlue + (toBlue - fromBlue) * amount)
}

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

  it('keeps the requested time order and blends interrupted transitions by color channel', () => {
    expect(TIME_OF_DAY_PRESETS.map((preset) => preset.name)).toEqual(['dusk', 'night', 'dawn', 'day'])
    expect(TIME_OF_DAY_TRANSITION_SECONDS).toBeGreaterThanOrEqual(1.2)
    expect(TIME_OF_DAY_TRANSITION_SECONDS).toBeLessThanOrEqual(1.8)

    const dusk = TIME_OF_DAY_PRESETS[0]
    const night = TIME_OF_DAY_PRESETS[1]
    const dawn = TIME_OF_DAY_PRESETS[2]
    expect(dusk).toBeDefined()
    expect(night).toBeDefined()
    expect(dawn).toBeDefined()
    if (dusk === undefined || night === undefined || dawn === undefined) return

    const midpoint = mixTimeOfDayPreset(dusk, night, 0.5)
    expect(midpoint.name).toBe('night')
    expect(midpoint.keyPosition[1]).toBeGreaterThan(dusk.keyPosition[1])
    expect(midpoint.keyPosition[1]).toBeLessThan(night.keyPosition[1])
    expect(midpoint.lampIntensity).toBeGreaterThan(dusk.lampIntensity)

    for (let index = 0; index < TIME_OF_DAY_PRESETS.length - 1; index += 1) {
      const from = TIME_OF_DAY_PRESETS[index]
      const to = TIME_OF_DAY_PRESETS[index + 1]
      expect(from).toBeDefined()
      expect(to).toBeDefined()
      if (from === undefined || to === undefined) continue
      for (const amount of [0, 0.25, 0.5, 0.75, 1]) {
        const blended = mixTimeOfDayPreset(from, to, amount)
        for (const key of timeOfDayColorKeys) {
          expect(blended[key]).toBe(blendColorChannels(from[key], to[key], amount))
        }
      }
    }

    const interrupted = mixTimeOfDayPreset(dusk, night, 0.4)
    const resumedAtStart = mixTimeOfDayPreset(interrupted, dawn, 0)
    for (const key of timeOfDayColorKeys) {
      expect(resumedAtStart[key]).toBe(interrupted[key])
    }
    const resumed = mixTimeOfDayPreset(interrupted, dawn, 0.2)
    for (const key of timeOfDayColorKeys) {
      expect(resumed[key]).toBe(blendColorChannels(interrupted[key], dawn[key], 0.2))
    }
  })

  it('applies channel-wise transition colors to sky and world materials', () => {
    const dusk = TIME_OF_DAY_PRESETS[0]
    const night = TIME_OF_DAY_PRESETS[1]
    expect(dusk).toBeDefined()
    expect(night).toBeDefined()
    if (dusk === undefined || night === undefined) return

    const scene = new THREE.Scene()
    const sky = new Sky(scene)
    const world = new World(scene)
    try {
      sky.applyTimeOfDay(dusk, night, 0.5)
      world.applyTimeOfDay(dusk, night, 0.5)

      const dome = sky.object.getObjectByName('TimeOfDayHorizonGradient')
      expect(dome).toBeInstanceOf(THREE.Mesh)
      if (!(dome instanceof THREE.Mesh)) return
      const material = dome.material
      expect(material).toBeInstanceOf(THREE.ShaderMaterial)
      if (!(material instanceof THREE.ShaderMaterial)) return
      const zenith = material.uniforms.uZenith?.value
      expect(zenith).toBeInstanceOf(THREE.Color)
      if (!(zenith instanceof THREE.Color)) return

      const fog = scene.fog
      const background = scene.background
      expect(fog).toBeInstanceOf(THREE.Fog)
      expect(background).toBeInstanceOf(THREE.Color)
      if (!(fog instanceof THREE.Fog) || !(background instanceof THREE.Color)) return

      expect(zenith.getHex()).toBe(0x141434)
      expect(fog.color.getHex()).toBe(0x4e4e68)
      expect(background.getHex()).toBe(blendColorChannels(dusk.backgroundColor, night.backgroundColor, 0.5))
    } finally {
      sky.dispose()
      world.dispose()
    }
  })
})
