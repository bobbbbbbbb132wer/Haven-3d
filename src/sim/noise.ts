// WHAT THIS FILE DOES
// Seeded random numbers and smooth 2D noise (simplex noise). Same seed = same result, always.
// Pure maths, no 3D in here.

/** Small seeded random number generator. Call it to get a number from 0 up to (not including) 1. */
export function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6
const GRAD = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export type Noise2D = (x: number, y: number) => number

/** Smooth noise that returns roughly -1 to 1. Each seed gives a different landscape. */
export function makeNoise2D(seed: number): Noise2D {
  const rng = makeRng(seed)
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = p[i]
    p[i] = p[j]
    p[j] = t
  }
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]

  return (xin, yin) => {
    const s = (xin + yin) * F2
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)
    const t = (i + j) * G2
    const x0 = xin - (i - t)
    const y0 = yin - (j - t)
    const i1 = x0 > y0 ? 1 : 0
    const j1 = x0 > y0 ? 0 : 1
    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2
    const ii = i & 255
    const jj = j & 255
    let n = 0
    let f = 0.5 - x0 * x0 - y0 * y0
    if (f > 0) {
      const g = GRAD[perm[ii + perm[jj]] & 7]
      f *= f
      n += f * f * (g[0] * x0 + g[1] * y0)
    }
    f = 0.5 - x1 * x1 - y1 * y1
    if (f > 0) {
      const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7]
      f *= f
      n += f * f * (g[0] * x1 + g[1] * y1)
    }
    f = 0.5 - x2 * x2 - y2 * y2
    if (f > 0) {
      const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7]
      f *= f
      n += f * f * (g[0] * x2 + g[1] * y2)
    }
    return 70 * n
  }
}

/** Several layers of noise added together: big shapes first, then finer and finer detail. */
export function fbm(n: Noise2D, x: number, y: number, octaves: number): number {
  let sum = 0
  let amp = 1
  let norm = 0
  let freq = 1
  for (let o = 0; o < octaves; o++) {
    sum += amp * n(x * freq, y * freq)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

export const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
