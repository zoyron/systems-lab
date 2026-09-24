import { LANDMARKS, WORLD } from './config'
import { smoothstep } from './math'

const airfieldWeight = (x: number, z: number): number => {
  const dx = (x - WORLD.airfield.centerX) / 190
  const dz = (z - WORLD.airfield.centerZ) / 430
  const distance = Math.sqrt(dx * dx + dz * dz)
  return 1 - smoothstep(0.72, 1.08, distance)
}

export const getRiverCenterX = (z: number): number =>
  -170 + Math.sin(z * 0.00225) * 155 + Math.sin(z * 0.0061) * 34

export const distanceToRiver = (x: number, z: number): number =>
  Math.abs(x - getRiverCenterX(z))

const riverWeight = (x: number, z: number): number =>
  (1 - smoothstep(30, 135, distanceToRiver(x, z))) * smoothstep(-1760, -1500, z) * (1 - smoothstep(1320, 1510, z))

const bayWeight = (x: number, z: number): number => {
  const coast = 705 + Math.sin(z * 0.0024) * 64 + Math.sin(z * 0.0067) * 24
  return smoothstep(coast, coast + 240, x)
}

export const getTerrainHeight = (x: number, z: number): number => {
  const broadRoll = Math.sin(x * 0.0019) * 4.8 + Math.cos(z * 0.0021) * 3.7
  const smallRoll = Math.sin(x * 0.007 + z * 0.003) * 1.7 + Math.cos(z * 0.008 - x * 0.002) * 1.2
  let height = 14 + broadRoll + smallRoll

  const forestShelf = Math.exp(-((x + 1180) ** 2) / 520000) * (1 - smoothstep(0.15, 0.85, bayWeight(x, z)))
  height += forestShelf * (22 + Math.cos(z * 0.004) * 7)

  const bellweatherRidge = Math.exp(-(((x + 80) ** 2) / 150000 + ((z + 570) ** 2) / 230000))
  const morrowRidge = Math.exp(-(((x - 155) ** 2) / 170000 + ((z - 245) ** 2) / 210000))
  height += bellweatherRidge * 27 + morrowRidge * 31

  const ridgeDistance = (z - WORLD.mountain.z) / 330
  const ridge = Math.exp(-(ridgeDistance * ridgeDistance))
  const passNotch = 1 - 0.82 * Math.exp(-((x - WORLD.mountain.passX) ** 2) / 26000)
  const peakShape = 0.55 + Math.exp(-((x + 420) ** 2) / 220000) * 0.45 + Math.exp(-((x - 760) ** 2) / 180000) * 0.35
  height += ridge * passNotch * peakShape * 205

  const coastalBluff = Math.exp(-((x - 610) ** 2) / 42000) * Math.exp(-((z - 430) ** 2) / 160000)
  height += coastalBluff * 22

  const riverCut = riverWeight(x, z)
  height = height * (1 - riverCut * 0.88) + (-4.2) * riverCut * 0.88

  const bay = bayWeight(x, z)
  height = height * (1 - bay) - 13 * bay

  const airfield = airfieldWeight(x, z)
  height = height * (1 - airfield) + WORLD.airfield.elevation * airfield

  return height
}

export const isRunwayPoint = (x: number, z: number): boolean =>
  Math.abs(x - WORLD.airfield.centerX) <= WORLD.airfield.runwayWidth / 2 + 1 &&
  Math.abs(z - WORLD.airfield.centerZ) <= WORLD.airfield.runwayLength / 2

export const isAirfieldPoint = (x: number, z: number): boolean => airfieldWeight(x, z) > 0.58

export const isWaterAt = (x: number, z: number): boolean => {
  if (bayWeight(x, z) > 0.14) return true
  return riverWeight(x, z) > 0.68 && getTerrainHeight(x, z) < WORLD.waterLevel
}

export const getSurfaceHeight = (x: number, z: number): number =>
  isRunwayPoint(x, z) ? WORLD.airfield.elevation + 0.7 : getTerrainHeight(x, z)

export const getRegionAt = (x: number, y: number, z: number): string => {
  if (y > 390) return 'Open Sky'
  if (z < -720) return 'Mountain Spine'
  if (x > 560 && z > -130 && z < 760) return 'Coastal Bluffs'
  if (Math.hypot(x - WORLD.airfield.centerX, z - WORLD.airfield.centerZ) < 500) return 'The Home Field'
  for (const village of WORLD.villages) {
    if (Math.hypot(x - village.x, z - village.z) < 235) return `${village.name} Town`
  }
  if (distanceToRiver(x, z) < 165) return 'River Valley'
  let closest = LANDMARKS[0]
  let closestDistance = Number.POSITIVE_INFINITY
  for (const landmark of LANDMARKS) {
    const dx = x - landmark.position[0]
    const dz = z - landmark.position[2]
    const distance = dx * dx + dz * dz
    if (distance < closestDistance) {
      closest = landmark
      closestDistance = distance
    }
  }
  return closest?.region ?? 'Open Country'
}
