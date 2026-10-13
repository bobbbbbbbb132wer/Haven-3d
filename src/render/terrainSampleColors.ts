// WHAT THIS FILE DOES
// Picks the stylised colour of one terrain triangle: grass -> dirt -> rock by slope and height,
// sandy bank near the river, a pale riverbed under the water, grass variety from the Voronoi
// regions. Palette follows the Modular Terrain Pack materials. Pure maths (no 3D).
import { smoothstep } from '../sim/noise'

type RGB = [number, number, number]
const GRASS_LUSH: RGB = [0.16, 0.56, 0.17] // pack "Grass"
const GRASS_DRY: RGB = [0.6, 0.64, 0.3]
const DIRT: RGB = [0.62, 0.5, 0.36]
const ROCK: RGB = [0.63, 0.62, 0.61] // pack "Rock"
const ROCK_DARK: RGB = [0.42, 0.42, 0.45]
const SAND: RGB = [0.77, 0.69, 0.56] // pack "Dirt"
const BED: RGB = [0.6, 0.52, 0.38] // riverbed

export const WATER_RGB: RGB = [0.2, 0.588, 0.82] // pack "Water"

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/**
 * slope = 1 - normal.y (0 flat, 0.3 about 45 degrees). jitter is -1..1 per face.
 * under = how many metres this face is below the river's water surface (0 = dry land).
 */
export function faceColor(height: number, slope: number, tint: number, bank: number, jitter: number, under = 0): RGB {
  let c = mix(GRASS_LUSH, GRASS_DRY, tint)
  c = mix(c, DIRT, smoothstep(0.05, 0.14, slope) * 0.9)
  const rock = Math.min(1, smoothstep(0.15, 0.3, slope) + smoothstep(15, 25, height) * 0.5)
  c = mix(c, mix(ROCK, ROCK_DARK, smoothstep(0.25, 0.45, slope)), rock)
  c = mix(c, SAND, bank * (1 - rock) * 0.85)
  if (under > 0) {
    c = mix(c, BED, smoothstep(0, 0.2, under))
    const k = 1 - 0.3 * smoothstep(0.3, 1.5, under)
    c = [c[0] * k, c[1] * k, c[2] * k]
  }
  const b = 1 + jitter * 0.07
  return [c[0] * b, c[1] * b, c[2] * b]
}
