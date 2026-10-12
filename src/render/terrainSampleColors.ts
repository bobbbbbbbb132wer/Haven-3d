// WHAT THIS FILE DOES
// Picks the stylised colour of one terrain triangle: grass -> dirt -> rock by slope and height,
// sandy dirt near the river, grass variety from the Voronoi regions. Pure maths (no 3D).
import { smoothstep } from '../sim/noise'

type RGB = [number, number, number]
const GRASS_LUSH: RGB = [0.3, 0.6, 0.26]
const GRASS_DRY: RGB = [0.6, 0.64, 0.3]
const DIRT: RGB = [0.5, 0.37, 0.24]
const ROCK: RGB = [0.5, 0.5, 0.54]
const ROCK_DARK: RGB = [0.36, 0.36, 0.4]
const SAND: RGB = [0.74, 0.67, 0.46]

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/** slope = 1 - normal.y (0 flat, 0.3 about 45 degrees). jitter is -1..1 per face. */
export function faceColor(height: number, slope: number, tint: number, bank: number, jitter: number): RGB {
  let c = mix(GRASS_LUSH, GRASS_DRY, tint)
  c = mix(c, DIRT, smoothstep(0.05, 0.14, slope) * 0.9)
  const rock = Math.min(1, smoothstep(0.15, 0.3, slope) + smoothstep(15, 25, height) * 0.5)
  c = mix(c, mix(ROCK, ROCK_DARK, smoothstep(0.25, 0.45, slope)), rock)
  c = mix(c, SAND, bank * (1 - rock) * 0.85)
  const b = 1 + jitter * 0.07
  return [c[0] * b, c[1] * b, c[2] * b]
}
