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

export const FLIGHT = {
  fixedStep: 1 / 120,
  maxFrameTime: 0.1,
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
