import { lerp } from './math'

export const WORLD = {
  size: 3600,
  halfSize: 1800,
  waterLevel: 2.4,
  airfield: {
    centerX: -650,
    centerZ: 750,
    elevation: 26,
    runwayLength: 430,
    runwayWidth: 40,
  },
  lighthouse: {
    x: 650,
    z: 430,
    baseHeight: 31,
  },
  bridgeZ: [-260, 310] as const,
  villages: [
    { name: 'Bellweather', x: -80, z: -570 },
    { name: 'Morrow Ridge', x: 155, z: 245 },
  ],
  mountain: {
    z: -1080,
    passX: 55,
  },
} as const

export type LandmarkDefinition = {
  readonly name: string
  readonly position: readonly [number, number, number]
  readonly labelRange: number
  readonly region: string
}

export const LANDMARKS: readonly LandmarkDefinition[] = [
  { name: 'Windward Airfield', position: [-650, 38, 750], labelRange: 900, region: 'The Home Field' },
  { name: 'Amberlight', position: [650, 82, 430], labelRange: 780, region: 'Coastal Bluffs' },
  { name: 'Lantern River', position: [-254, 44, -360], labelRange: 760, region: 'River Valley' },
  { name: 'Bellweather', position: [-80, 65, -570], labelRange: 680, region: 'Bellweather Town' },
  { name: 'Morrow Ridge', position: [155, 94, 245], labelRange: 700, region: 'Morrow Ridge' },
  { name: 'The High Pass', position: [55, 205, -1060], labelRange: 920, region: 'Mountain Spine' },
] as const

export type TimeOfDayName = 'dusk' | 'night' | 'dawn' | 'day'

export type TimeOfDayPreset = {
  readonly name: TimeOfDayName
  readonly skyZenith: number
  readonly skyUpper: number
  readonly skyHorizon: number
  readonly skyLower: number
  readonly fogColor: number
  readonly backgroundColor: number
  readonly waterDeep: number
  readonly waterShallow: number
  readonly hemisphereSky: number
  readonly hemisphereGround: number
  readonly hemisphereIntensity: number
  readonly keyColor: number
  readonly keyIntensity: number
  readonly keyPosition: readonly [number, number, number]
  readonly fillColor: number
  readonly fillIntensity: number
  readonly fillPosition: readonly [number, number, number]
  readonly fogNear: number
  readonly fogFar: number
  readonly lampIntensity: number
  readonly exposure: number
  readonly glowColor: number
  readonly glowStrength: number
  readonly cloudColor: number
  readonly cloudOpacity: number
  readonly worldCloudColor: number
  readonly worldCloudOpacity: number
  readonly starOpacity: number
  readonly moonPosition: readonly [number, number, number]
  readonly sunPosition: readonly [number, number, number]
  readonly moonColor: number
  readonly moonGlowColor: number
  readonly moonOpacity: number
  readonly sunColor: number
  readonly sunOpacity: number
}

export const TIME_OF_DAY_PRESETS: readonly TimeOfDayPreset[] = [
  {
    name: 'dusk',
    skyZenith: 0x20143d,
    skyUpper: 0x3a2457,
    skyHorizon: 0x856477,
    skyLower: 0xc18b7b,
    fogColor: 0x76617a,
    backgroundColor: 0x21162f,
    waterDeep: 0x0b303b,
    waterShallow: 0x17606a,
    hemisphereSky: 0x9b8ab4,
    hemisphereGround: 0x353642,
    hemisphereIntensity: 1.45,
    keyColor: 0xc6c4ff,
    keyIntensity: 1.65,
    keyPosition: [-820, 1280, -680],
    fillColor: 0xf0a06d,
    fillIntensity: 0.48,
    fillPosition: [760, 420, -920],
    fogNear: 980,
    fogFar: 3150,
    lampIntensity: 1,
    exposure: 1.08,
    glowColor: 0xff997e,
    glowStrength: 1,
    cloudColor: 0x8a7894,
    cloudOpacity: 0.16,
    worldCloudColor: 0x96869e,
    worldCloudOpacity: 0.13,
    starOpacity: 0.72,
    moonPosition: [-2050, 2150, -6100],
    sunPosition: [-3000, 600, -5200],
    moonColor: 0xf5dfbd,
    moonGlowColor: 0xe8c6ae,
    moonOpacity: 1,
    sunColor: 0xffd7a0,
    sunOpacity: 0,
  },
  {
    name: 'night',
    skyZenith: 0x07142b,
    skyUpper: 0x102744,
    skyHorizon: 0x294761,
    skyLower: 0x48566b,
    fogColor: 0x263a55,
    backgroundColor: 0x081321,
    waterDeep: 0x061a2a,
    waterShallow: 0x0d3c50,
    hemisphereSky: 0x55759c,
    hemisphereGround: 0x151b2a,
    hemisphereIntensity: 0.78,
    keyColor: 0xaecaff,
    keyIntensity: 1.15,
    keyPosition: [-1250, 1650, -850],
    fillColor: 0x52739d,
    fillIntensity: 0.32,
    fillPosition: [900, 520, -1050],
    fogNear: 680,
    fogFar: 2500,
    lampIntensity: 1.65,
    exposure: 1.12,
    glowColor: 0x315985,
    glowStrength: 0.42,
    cloudColor: 0x536b84,
    cloudOpacity: 0.11,
    worldCloudColor: 0x536b84,
    worldCloudOpacity: 0.09,
    starOpacity: 0.94,
    moonPosition: [-1900, 2500, -6200],
    sunPosition: [-3100, 500, -5300],
    moonColor: 0xffffff,
    moonGlowColor: 0xb7d2ff,
    moonOpacity: 1,
    sunColor: 0xffd7a0,
    sunOpacity: 0,
  },
  {
    name: 'dawn',
    skyZenith: 0x7189ad,
    skyUpper: 0x9da8c1,
    skyHorizon: 0xe1a3a5,
    skyLower: 0xf0b68c,
    fogColor: 0xc4a7b0,
    backgroundColor: 0x7887a0,
    waterDeep: 0x183d4a,
    waterShallow: 0x3d7c82,
    hemisphereSky: 0xaec6e1,
    hemisphereGround: 0x4a4855,
    hemisphereIntensity: 1.68,
    keyColor: 0xffc6a1,
    keyIntensity: 1.35,
    keyPosition: [-1500, 650, -900],
    fillColor: 0x9ebbe0,
    fillIntensity: 0.55,
    fillPosition: [1050, 760, -1150],
    fogNear: 1050,
    fogFar: 3400,
    lampIntensity: 0.48,
    exposure: 1,
    glowColor: 0xff987d,
    glowStrength: 0.88,
    cloudColor: 0xc3acb3,
    cloudOpacity: 0.19,
    worldCloudColor: 0xc3acb3,
    worldCloudOpacity: 0.155,
    starOpacity: 0.12,
    moonPosition: [-3900, 900, -4700],
    sunPosition: [-3600, 1150, -4900],
    moonColor: 0xf2d9d1,
    moonGlowColor: 0xf0b6ac,
    moonOpacity: 0.18,
    sunColor: 0xffb982,
    sunOpacity: 0.76,
  },
  {
    name: 'day',
    skyZenith: 0x86a8ca,
    skyUpper: 0xaec4d7,
    skyHorizon: 0xd8d0bd,
    skyLower: 0xe7c9a7,
    fogColor: 0xbec9c5,
    backgroundColor: 0x9eb6c7,
    waterDeep: 0x1c5960,
    waterShallow: 0x4b9b98,
    hemisphereSky: 0xc5d9e9,
    hemisphereGround: 0x6d6c65,
    hemisphereIntensity: 2.35,
    keyColor: 0xffefd0,
    keyIntensity: 2.2,
    keyPosition: [-900, 2100, -1100],
    fillColor: 0xb9d5ea,
    fillIntensity: 0.62,
    fillPosition: [1200, 1350, -1350],
    fogNear: 1350,
    fogFar: 3900,
    lampIntensity: 0.06,
    exposure: 0.92,
    glowColor: 0xffd6a2,
    glowStrength: 0.32,
    cloudColor: 0xd1d2cd,
    cloudOpacity: 0.24,
    worldCloudColor: 0xd1d2cd,
    worldCloudOpacity: 0.197,
    starOpacity: 0,
    moonPosition: [-4200, 4200, -4300],
    sunPosition: [-3000, 5000, -4300],
    moonColor: 0xffffff,
    moonGlowColor: 0xffe1a8,
    moonOpacity: 0,
    sunColor: 0xffe0a4,
    sunOpacity: 1,
  },
]

export const TIME_OF_DAY_TRANSITION_SECONDS = 1.5
export const TIME_OF_DAY_AUTO_CYCLE_SECONDS = 14

const TIME_OF_DAY_COLOR_KEYS = new Set([
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
])

export const mixHexColor = (from: number, to: number, amount: number): number => {
  const fromRed = (from >>> 16) & 0xff
  const fromGreen = (from >>> 8) & 0xff
  const fromBlue = from & 0xff
  const toRed = (to >>> 16) & 0xff
  const toGreen = (to >>> 8) & 0xff
  const toBlue = to & 0xff
  const red = Math.round(lerp(fromRed, toRed, amount))
  const green = Math.round(lerp(fromGreen, toGreen, amount))
  const blue = Math.round(lerp(fromBlue, toBlue, amount))
  return red * 0x10000 + green * 0x100 + blue
}

const blendTimeValue = (from: unknown, to: unknown, amount: number, isColor: boolean): unknown => {
  if (typeof from === 'number' && typeof to === 'number') {
    return isColor ? mixHexColor(from, to, amount) : lerp(from, to, amount)
  }
  if (Array.isArray(from) && Array.isArray(to)) {
    return from.map((value, index) => blendTimeValue(value, to[index], amount, false))
  }
  return to
}

export const mixTimeOfDayPreset = (
  from: TimeOfDayPreset,
  to: TimeOfDayPreset,
  amount: number,
): TimeOfDayPreset => {
  const fromValues = from as unknown as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [key, toValue] of Object.entries(to)) {
    result[key] = blendTimeValue(fromValues[key], toValue, amount, TIME_OF_DAY_COLOR_KEYS.has(key))
  }
  return result as unknown as TimeOfDayPreset
}

export const FLIGHT = {
  fixedStep: 1 / 120,
  maxFrameTime: 0.25,
  mass: 760,
  wingArea: 17,
  aspectRatio: 7.4,
  airDensity: 1.225,
  maxThrust: 3350,
  rollRate: 1.7,
  pitchRate: 0.82,
  yawRate: 0.43,
  stallSpeed: 25,
  takeoffSpeed: 31,
  crashVerticalSpeed: 11.5,
  safeLandingVerticalSpeed: 6.5,
  safeLandingSpeed: 38,
  wheelHeight: 1.42,
} as const
