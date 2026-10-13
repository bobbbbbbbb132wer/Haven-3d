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

  // ---- river: a lowered channel (flat riverbed, sloping banks) holding one level water surface ----
  const SUB = 4 // centre-line samples per metre, so distances to the river come out smooth
  const M = N * SUB + 1
  const cx = new Float32Array(M)
  const cz = new Float32Array(M)
  for (let m = 0; m < M; m++) {
    cz[m] = -H + m / SUB
    cx[m] = riverX(cz[m])
  }
  const tAt = (m: number) => m / (M - 1) // 0 at the river's start (north) .. 1 at its end (south)
  const wwOf = (m: number) => 2.4 + 2.6 * tAt(m) // half-width of the water surface, metres
  const dwOf = (m: number) => 0.9 + 0.7 * tAt(m) // water depth, metres

  // 1. nearest centre-line sample (and distance) for every grid corner
  const nearM = new Uint16Array(S * S)
  const dist = new Float32Array(S * S)
  const WIN = 25 * SUB
  for (let j = 0; j < S; j++) {
    const mc = j * SUB
    for (let i = 0; i < S; i++) {
      const x = i - H
      const z = j - H
      let best = 1e9
      let bm = mc
      for (let m = Math.max(0, mc - WIN); m <= Math.min(M - 1, mc + WIN); m++) {
        const dx = x - cx[m]
        const dz = z - cz[m]
        const d2 = dx * dx + dz * dz
        if (d2 < best) {
          best = d2
          bm = m
        }
      }
      nearM[j * S + i] = bm
      dist[j * S + i] = Math.sqrt(best)
    }
  }

  // 2. ground height under the centre line (bilinear), and the lowest ground beside it
  const hAtF = (x: number, z: number) => {
    const gx = clamp(x + H, 0, N - 1e-6)
    const gz = clamp(z + H, 0, N - 1e-6)
    const i = Math.floor(gx)
    const j = Math.floor(gz)
    const u = gx - i
    const v = gz - j
    const k = j * S + i
    return lerp(lerp(h[k], h[k + 1], u), lerp(h[k + S], h[k + S + 1], u), v)
  }
  const movingAvg = (src: Float32Array, r: number) => {
    const pre = new Float64Array(M + 1)
    for (let m = 0; m < M; m++) pre[m + 1] = pre[m] + src[m]
    const out = new Float32Array(M)
    for (let m = 0; m < M; m++) {
      const a0 = Math.max(0, m - r)
      const b0 = Math.min(M - 1, m + r)
      out[m] = (pre[b0 + 1] - pre[a0]) / (b0 - a0 + 1)
    }
    return out
  }
  const ground = new Float32Array(M)
  for (let m = 0; m < M; m++) ground[m] = hAtF(cx[m], cz[m])
  const groundS = movingAvg(ground, 14 * SUB)
  const band = new Float32Array(M).fill(1e9)
  for (let k = 0; k < S * S; k++) {
    const m = nearM[k]
    if (dist[k] <= wwOf(m) + 4) band[m] = Math.min(band[m], h[k])
  }
  const bandMin = new Float32Array(M)
  for (let m = 0; m < M; m++) {
    let v = 1e9
    for (let q = Math.max(0, m - 2 * SUB); q <= Math.min(M - 1, m + 2 * SUB); q++) v = Math.min(v, band[q])
    bandMin[m] = v > 1e8 ? groundS[m] : v
  }

  // 3. water surface: always a little below the banks, smooth, and never flowing uphill
  const cand = new Float32Array(M)
  for (let m = 0; m < M; m++) cand[m] = Math.min(groundS[m] - 0.5, bandMin[m] - 0.25)
  const candS = movingAvg(cand, 10 * SUB)
  const surf = new Float32Array(M)
  for (let m = 0; m < M; m++) {
    const v = Math.min(cand[m], candS[m])
    surf[m] = m === 0 ? v : Math.min(v, surf[m - 1] - 0.003)
  }

  // 4. carve the channel: flat riverbed, sloping underwater banks, then a gentle bank up to the land
  const bank = new Float32Array(S * S)
  const water = new Uint8Array(S * S) // 1 = this corner is under water
  const wlevel = new Float32Array(S * S).fill(NaN) // water surface height near the river, else NaN
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const k = j * S + i
      const m = nearM[k]
      const d = dist[k]
      const ww = wwOf(m)
      const wb = 0.55 * ww
      const dw = dwOf(m)
      const bedY = surf[m] - dw
      let T: number
      if (d <= wb) T = bedY
      else if (d <= ww) T = bedY + (dw * (d - wb)) / (ww - wb)
      else T = surf[m] + 0.5 * (d - ww) + 1.6 * nDetail((i - H) * 0.07, (j - H) * 0.07) * smoothstep(3, 12, d - ww)
      h[k] = smin(h[k], T, 0.9)
      if (d <= ww + 2.5) wlevel[k] = surf[m]
      bank[k] = 1 - smoothstep(ww + 0.2, ww + 3.2, d)
      water[k] = wlevel[k] > h[k] ? 1 : 0
    }
  }

  // ---- mountain landmarks: pack Mountain models crowning the highest ridge tops ----
  const peaks: NonNullable<Terrain['peaks']> = []
  const cands: { i: number; j: number; hh: number }[] = []
  for (let j = 10; j < N - 10; j += 3) {
    for (let i = 10; i < N - 10; i += 3) {
      const hk = h[j * S + i]
      if (hk < 19) continue
      cands.push({ i, j, hh: hk })
    }
  }
  cands.sort((a, b) => b.hh - a.hh)
  for (const c of cands) {
    if (peaks.length >= 14) break
    const x = c.i - H
    const z = c.j - H
    if (Math.hypot(x - START.x, z - START.z) < 60) continue
    if (dist[c.j * S + c.i] < 24) continue
    if (peaks.some((p) => Math.hypot(p.x - x, p.z - z) < 20)) continue
    const scale = 1.5 + 0.8 * hash2(c.i, c.j, seed + 90)
    const yaw = hash2(c.i, c.j, seed + 91) * Math.PI * 2
    const id = `Mountain_${1 + Math.floor(hash2(c.i, c.j, seed + 92) * 4)}`
    // the base sits at the lowest ground under the footprint, so it never floats
    const r = Math.ceil(2.2 * scale)
    let lo = 1e9
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) lo = Math.min(lo, h[(c.j + dj) * S + c.i + di])
    }
    peaks.push({ id, x, z, y: lo - 0.4, scale, yaw })
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
  return { size: N, seed, heights: h, buildable, blocked: new Uint8Array(N * N), scenery: [], tint, bank, water, wlevel, peaks }
}
