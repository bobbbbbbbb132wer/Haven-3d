// WHAT THIS FILE DOES
// Generates the playable world (fixed seed) as a Terrain: flat colony plains + gentle hills +
// domain-warped ridged mountain ranges + Voronoi regions + erosion-style valleys + a river that
// snakes between the ridges. Pure numbers, no 3D. Runs once at start-up, never per frame.
// No trees, rocks or other decorations are generated here.
import { fbm, makeNoise2D, smoothstep } from './noise'
import { MAX_TILE_STEP, WORLD_SIZE, type Terrain } from './terrain'

/** Where the colony starts: a broad, flat meadow. The camera starts here too. */
export const START = { x: -34, z: 40 }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function hash2(x: number, z: number, s: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// ---- Voronoi (cellular) noise: jittered feature points, nearest + second nearest ----
const CELL = 34
const V = { f1: 0, f2: 0, v1: 0, v2: 0 }
function voronoi(x: number, z: number, seed: number) {
  const gx = Math.floor(x / CELL)
  const gz = Math.floor(z / CELL)
  V.f1 = V.f2 = 1e9
  V.v1 = V.v2 = 0
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ix = gx + dx
      const iz = gz + dz
      const px = (ix + 0.15 + 0.7 * hash2(ix, iz, seed)) * CELL
      const pz = (iz + 0.15 + 0.7 * hash2(ix, iz, seed + 1)) * CELL
      const d = Math.hypot(x - px, z - pz)
      const val = hash2(ix, iz, seed + 2)
      if (d < V.f1) {
        V.f2 = V.f1
        V.v2 = V.v1
        V.f1 = d
        V.v1 = val
      } else if (d < V.f2) {
        V.f2 = d
        V.v2 = val
      }
    }
  }
}

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0)
  return Math.min(a, b) - (h * h) / (4 * k)
}

export function generateWorld(seed: number, size: number = WORLD_SIZE): Terrain {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const N = size
  const S = N + 1
  const H = N / 2

  const nWarpA = makeNoise2D(seed + 11)
  const nWarpB = makeNoise2D(seed + 12)
  const nRidge = makeNoise2D(seed + 13)
  const nRidge2 = makeNoise2D(seed + 14)
  const nHill = makeNoise2D(seed + 15)
  const nMask = makeNoise2D(seed + 16)
  const nRiver = makeNoise2D(seed + 17)
  const nDetail = makeNoise2D(seed + 18)

  /** Centre line of the river (x for a given z): two sine waves plus a little noise. */
  const riverX = (z: number) =>
    clamp(-4 + 15 * Math.sin(z * 0.062 + 0.9) + 8 * Math.sin(z * 0.145 + 2.1) + 6 * nRiver(z * 0.03, 0.5), -0.4 * H, 0.4 * H)

  const h = new Float32Array(S * S)
  const mask = new Float32Array(S * S) // how mountainous (0 plains .. 1 mountains)
  const tint = new Float32Array(S * S)

  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const k = j * S + i
      const x = i - H
      const z = j - H
      const t = j / N // 0 = north .. 1 = south

      // domain warp (twists everything so nothing looks like a grid)
      const wx = x + 14 * nWarpA(x * 0.011, z * 0.011)
      const wz = z + 14 * nWarpB(x * 0.011 + 9, z * 0.011 + 9)

      // Voronoi regions (irregular borders, per-region character)
      voronoi(wx, wz, seed)
      const bl = 0.5 + 0.5 * smoothstep(0, 8, V.f2 - V.f1)
      const val = lerp(V.v2, V.v1, bl) // continuous across borders
      const edge = 1 - smoothstep(0, 3.5, V.f2 - V.f1) // 1 on region borders
      tint[k] = clamp(val + 0.25 * nDetail(x * 0.03, z * 0.03), 0, 1)

      // where the mountains are: mostly north + the sides, plains stay south/west for the colony
      const m0 =
        0.62 * (1 - t) +
        0.28 * clamp(Math.abs(x) / H, 0, 1) +
        0.3 * nMask(x * 0.012, z * 0.012) +
        0.34 * (val - 0.5)
      const mk = smoothstep(0.4, 0.74, m0)
      mask[k] = mk

      // winding ridges: ridged noise measured relative to the river so ranges follow its bends
      const rx = x - riverX(z)
      const qx = rx * 0.03 + 0.9 * nWarpA(wx * 0.02, wz * 0.02)
      const qz = z * 0.011 + 0.9 * nWarpB(wx * 0.02, wz * 0.02)
      let r1 = 1 - Math.abs(nRidge(qx, qz))
      r1 *= r1
      let r2 = 1 - Math.abs(nRidge2(wx * 0.045, wz * 0.045))
      r2 = r2 * r2 * r2
      let r3 = 1 - Math.abs(nRidge2(wx * 0.11 + 30, wz * 0.11))
      r3 *= r3
      const mountain = (5 + 26 * r1 + 7 * r1 * r2 + 2.2 * r3 * r1) * mk
      const crag = edge * 2.2 * mk // rocky creases along region borders

      // plains + gentle rolling hills
      const hillW = smoothstep(0.35, 0.75, val)
      const hill = (0.45 + 3.2 * hillW) * fbm(nHill, x * 0.022, z * 0.022, 3)
      const plain = 0.6 + 0.3 * nDetail(x * 0.05, z * 0.05)
      let height = (plain + hill) * (1 - 0.8 * mk) + mountain + crag

      // a broad, almost flat meadow in the south-west for colony building
      const d = Math.hypot(x - START.x, z - START.z)
      const flat = smoothstep(46, 22, d)
      height = lerp(height, 0.5 + 0.12 * nDetail(x * 0.06, z * 0.06), flat)
      h[k] = height
    }
  }

  // ---- erosion 1: flow accumulation carves gullies and valleys into the mountains ----
  const order = Uint32Array.from({ length: S * S }, (_, k) => k).sort((a, b) => h[b] - h[a])
  const acc = new Float32Array(S * S).fill(1)
  for (let o = 0; o < order.length; o++) {
    const k = order[o]
    const i = k % S
    const j = (k - i) / S
    let low = -1
    let lowH = h[k]
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || nj < 0 || ni >= S || nj >= S) continue
        const nk = nj * S + ni
        if (h[nk] < lowH) {
          lowH = h[nk]
          low = nk
        }
      }
    }
    if (low >= 0) acc[low] += acc[k]
  }
  for (let k = 0; k < S * S; k++) {
    h[k] -= Math.min(2.6, 0.17 * Math.sqrt(acc[k] - 1)) * mask[k]
  }

  // ---- erosion 2: thermal (steep slopes slump into scree) ----
  const delta = new Float32Array(S * S)
  const TALUS = 0.85
  for (let it = 0; it < 14; it++) {
    delta.fill(0)
    for (let j = 1; j < S - 1; j++) {
      for (let i = 1; i < S - 1; i++) {
        const k = j * S + i
        const nb = [k - 1, k + 1, k - S, k + S]
        for (let q = 0; q < 4; q++) {
          const dh = h[k] - h[nb[q]]
          if (dh > TALUS) {
            const m = (dh - TALUS) * 0.2
            delta[k] -= m
            delta[nb[q]] += m
          }
        }
      }
    }
    for (let k = 0; k < S * S; k++) h[k] += delta[k]
  }

  // ---- river: bed always runs downhill (north to south), valley walls cut into the ridges ----
  const rx = new Float32Array(S)
  const rz = new Float32Array(S)
  const ground = new Float32Array(S)
  for (let k = 0; k < S; k++) {
    rz[k] = k - H
    rx[k] = riverX(rz[k])
    const ci = clamp(Math.round(rx[k] + H), 0, N)
    ground[k] = h[k * S + ci]
  }
  const bed = new Float32Array(S)
  const halfW = new Float32Array(S)
  for (let k = 0; k < S; k++) {
    let sum = 0
    let cnt = 0
    for (let q = Math.max(0, k - 14); q <= Math.min(N, k + 14); q++) {
      sum += ground[q]
      cnt++
    }
    const t = k / N
    const avg = sum / cnt
    bed[k] = k === 0 ? avg : Math.min(bed[k - 1] + 0.0, avg, bed[k - 1] - 0.012)
    halfW[k] = 1.7 + 2.0 * t
  }
  const bedY = new Float32Array(S)
  for (let k = 0; k < S; k++) bedY[k] = bed[k] - (1.0 + 0.9 * (k / N))

  const bank = new Float32Array(S * S)
  const water = new Uint8Array(S * S) // 1 = under the river
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const x = i - H
      const z = j - H
      let best = 1e9
      let bk = j
      for (let q = Math.max(0, j - 22); q <= Math.min(N, j + 22); q++) {
        const d = Math.hypot(x - rx[q], z - rz[q])
        if (d < best) {
          best = d
          bk = q
        }
      }
      const k = j * S + i
      const wall = bedY[bk] + 0.45 * Math.max(0, best - halfW[bk]) + 1.6 * nDetail(x * 0.07, z * 0.07) * smoothstep(3, 12, best)
      h[k] = smin(h[k], wall, 2.2)
      bank[k] = 1 - smoothstep(halfW[bk] + 0.3, halfW[bk] + 3.4, best)
      water[k] = best <= halfW[bk] + 1.1 ? 1 : 0
    }
  }

  const river = {
    x: rx,
    z: rz,
    y: Float32Array.from(bedY, (b) => b + 0.55),
    half: Float32Array.from(halfW, (w) => w + 1.1),
  }

  // a tile can be built on if it is flat enough and none of its corners are under the river
  const buildable = new Uint8Array(N * N)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * S + i
      const c = [h[k], h[k + 1], h[k + S], h[k + S + 1]]
      const wet = water[k] || water[k + 1] || water[k + S] || water[k + S + 1]
      buildable[j * N + i] = !wet && Math.max(...c) - Math.min(...c) <= MAX_TILE_STEP ? 1 : 0
    }
  }

  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
  console.log(`world generated: ${N}x${N} in ${ms.toFixed(0)} ms`)
  return { size: N, seed, heights: h, buildable, blocked: new Uint8Array(N * N), scenery: [], tint, bank, water, river }
}
