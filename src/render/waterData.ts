// WHAT THIS FILE DOES
// Builds the river's water surface as flat-shaded low-poly triangles that follow the terrain grid:
// one continuous surface that fills the lowered channel. Wherever the bank rises above the water
// the surface simply ends inside the bank, so there are no gaps, floating strips or thin ribbons.
// Colour is clearer and paler in the shallows so the riverbed shows through. Pure maths.
import type { Terrain } from '../sim/terrain'
import { WATER_RGB } from './terrainSampleColors'

export interface WaterBuffers {
  pos: Float32Array
  nor: Float32Array
  col: Float32Array
  /** Unit (x,z) flow direction per vertex, used to animate travelling waves in the shader. */
  flow: Float32Array
}

export function buildWater(t: Terrain): WaterBuffers | null {
  const wl = t.wlevel
  if (!wl) return null
  const N = t.size
  const S = N + 1
  const H = N / 2
  const h = t.heights
  const fl = t.flow
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const flow: number[] = []

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const ks = [j * S + i, j * S + i + 1, (j + 1) * S + i, (j + 1) * S + i + 1] // a b c d
      // only cells that have at least one corner really under water
      if (!ks.some((k) => wl[k] === wl[k] && h[k] < wl[k] - 0.01)) continue
      let sum = 0
      let n = 0
      for (const k of ks) if (wl[k] === wl[k]) { sum += wl[k]; n++ }
      const avg = sum / n
      // dry corners keep the local level, but never above their own ground: otherwise, where a
      // quad straddles the bank, that corner's patch of water would poke up out of the hillside
      // instead of staying hidden inside it, which is what made the edges look like they floated.
      const W = ks.map((k) => (wl[k] === wl[k] ? wl[k] : Math.min(avg, h[k] - 0.02)))
      const X = [i - H, i + 1 - H, i - H, i + 1 - H]
      const Z = [j - H, j - H, j + 1 - H, j + 1 - H]
      const D = ks.map((k, q) => Math.max(0, W[q] - h[k]))
      const F = ks.map((k) => (fl ? [fl[k * 2], fl[k * 2 + 1]] : [0, 1]))
      const jitter = ((((i * 73856093) ^ (j * 19349663)) & 255) / 127.5 - 1) * 0.04
      for (const tri of [[0, 1, 2], [1, 3, 2]]) {
        const [a, b, c] = tri
        let nx = (W[b] - W[a]) * (Z[c] - Z[a]) - (Z[b] - Z[a]) * (W[c] - W[a])
        let ny = (Z[b] - Z[a]) * (X[c] - X[a]) - (X[b] - X[a]) * (Z[c] - Z[a])
        let nz = (X[b] - X[a]) * (W[c] - W[a]) - (W[b] - W[a]) * (X[c] - X[a])
        const len = Math.hypot(nx, ny, nz) || 1
        nx /= len; ny /= len; nz /= len
        if (ny < 0) { nx = -nx; ny = -ny; nz = -nz }
        for (const q of tri) {
          pos.push(X[q], W[q], Z[q])
          nor.push(nx, ny, nz)
          flow.push(F[q][0], F[q][1])
          const depth = Math.min(1, D[q] / 1.1)
          const pale = 0.35 * (1 - depth) // shallow = paler
          col.push(
            Math.min(1, (WATER_RGB[0] + (0.9 - WATER_RGB[0]) * pale) * (1 + jitter)),
            Math.min(1, (WATER_RGB[1] + (0.95 - WATER_RGB[1]) * pale) * (1 + jitter)),
            Math.min(1, (WATER_RGB[2] + (0.95 - WATER_RGB[2]) * pale) * (1 + jitter)),
            0.32 + 0.5 * depth, // see-through at the edge, mostly solid in the middle
          )
        }
      }
    }
  }
  if (pos.length === 0) return null
  return {
    pos: Float32Array.from(pos),
    nor: Float32Array.from(nor),
    col: Float32Array.from(col),
    flow: Float32Array.from(flow),
  }
}
