export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

export const lerp = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount

export const inverseLerp = (from: number, to: number, value: number): number =>
  clamp((value - from) / (to - from), 0, 1)

export const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const amount = inverseLerp(edge0, edge1, value)
  return amount * amount * (3 - 2 * amount)
}

export const damp = (current: number, target: number, lambda: number, deltaTime: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * deltaTime))

export const seededRandom = (seed: number): (() => number) => {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

export const formatHeading = (radians: number): number => {
  const degrees = ((radians * 180) / Math.PI + 360) % 360
  return Math.round(degrees)
}
