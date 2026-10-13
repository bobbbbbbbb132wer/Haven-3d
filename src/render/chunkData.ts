// WHAT THIS FILE DOES
// Turns a square block of the terrain (a "chunk") into flat-shaded low-poly triangle data.
// Chunks share their edge heights and use the same triangle split as heightAt(), so there are
// no seams or cracks and models sit exactly on the visible ground. Pure maths (no 3D library).
import type { Terrain } from '../sim/terrain'
import { smoothstep } from '../sim/noise'
import { faceColor } from './terrainSampleColors'

export const CHUNK = 32 // cells per chunk side

export const chunksPerSide = (t: Terrain) => Math.ceil(t.size / CHUNK)

/** Number of cells in this chunk along x and z (edge chunks can be smaller). */
export function chunkCells(t: Terrain, ci: number, cj: number) {
  return {
    i0: ci * CHUNK,
    j0: cj * CHUNK,
    nx: Math.min(CHUNK, t.size - ci * CHUNK),
    nz: Math.min(CHUNK, t.size - cj * CHUNK),
  }
}

/** Fills the buffers (sized cells * 6 vertices) for one chunk. Safe to call again after an edit. */
export function fillChunk(t: Terrain, ci: number, cj: number, pos: Float32Array, nor: Float32Array, col: Float32Array) {
  const { i0, j0, nx, nz } = chunkCells(t, ci, cj)
  const S = t.size + 1
  const H = t.size / 2
  const h = t.heights
  let p = 0
  let c = 0

  // Face normal of one triangle (always pointing up). Pure maths.
  const faceNormal = (ai: number, aj: number, bi: number, bj: number, ci2: number, cj2: number): [number, number, number] => {
    const ay = h[aj * S + ai], by = h[bj * S + bi], cy = h[cj2 * S + ci2]
    const bx = bi - ai, bz = bj - aj, cx = ci2 - ai, cz = cj2 - aj
    let x = (by - ay) * cz - bz * (cy - ay)
    let y = bz * cx - bx * cz
    let z = bx * (cy - ay) - (by - ay) * cx
    const len = Math.hypot(x, y, z) || 1
    x /= len; y /= len; z /= len
    return y < 0 ? [-x, -y, -z] : [x, y, z]
  }

  // One triangle, flat-shaded. Colour inputs are shared by the whole cell, so the two triangles
  // of a cell never get different shades unless the ground there is genuinely sloped.
  const tri = (
    ai: number, aj: number, bi: number, bj: number, ci2: number, cj2: number,
    n: [number, number, number], cell: { height: number; tint: number; bank: number; under: number; jitter: number },
  ) => {
    const ay = h[aj * S + ai], by = h[bj * S + bi], cy = h[cj2 * S + ci2]
    const ax = ai - H, az = aj - H, bx = bi - H, bz = bj - H, cx = ci2 - H, cz = cj2 - H
    const rgb = faceColor(cell.height, 1 - n[1], cell.tint, cell.bank, cell.jitter, cell.under)
    pos[p] = ax; pos[p + 1] = ay; pos[p + 2] = az
    pos[p + 3] = bx; pos[p + 4] = by; pos[p + 5] = bz
    pos[p + 6] = cx; pos[p + 7] = cy; pos[p + 8] = cz
    for (let q = 0; q < 3; q++) {
      nor[p + q * 3] = n[0]; nor[p + q * 3 + 1] = n[1]; nor[p + q * 3 + 2] = n[2]
      col[c] = rgb[0]; col[c + 1] = rgb[1]; col[c + 2] = rgb[2]; col[c + 3] = 1
      c += 4
    }
    p += 9
  }

  for (let j = j0; j < j0 + nz; j++) {
    for (let i = i0; i < i0 + nx; i++) {
      // same split as heightAt(): a=(i,j) b=(i+1,j) c=(i,j+1) d=(i+1,j+1) -> (a,b,c) and (b,d,c)
      const ka = j * S + i, kb = ka + 1, kc = ka + S, kd = kc + 1
      const n1 = faceNormal(i, j, i + 1, j, i, j + 1)
      const n2 = faceNormal(i + 1, j, i + 1, j + 1, i, j + 1)

      // Gentle ground: both triangles share the cell's averaged normal, so a flat-shaded cell
      // is one even shade. Steep ground keeps its own facet normals (hills and cliffs stay crisp).
      let ax = n1[0] + n2[0], ay = n1[1] + n2[1], az = n1[2] + n2[2]
      const al = Math.hypot(ax, ay, az) || 1
      ax /= al; ay /= al; az /= al
      const w = 1 - smoothstep(0.06, 0.16, 1 - Math.min(n1[1], n2[1]))
      const mixN = (n: [number, number, number]): [number, number, number] => {
        const x = n[0] + (ax - n[0]) * w, y = n[1] + (ay - n[1]) * w, z = n[2] + (az - n[2]) * w
        const l = Math.hypot(x, y, z) || 1
        return [x / l, y / l, z / l]
      }

      // colour inputs averaged over the cell's four corners (not per triangle)
      let under = 0
      if (t.wlevel) {
        const wa = t.wlevel[ka], wb = t.wlevel[kb], wc = t.wlevel[kc], wd = t.wlevel[kd]
        if (wa === wa && wb === wb && wc === wc && wd === wd) {
          under = Math.max(0, (wa + wb + wc + wd - h[ka] - h[kb] - h[kc] - h[kd]) / 4)
        }
      }
      const jitter = ((((i * 73856093) ^ (j * 19349663)) >>> 0) & 255) / 127.5 - 1
      const cell = {
        height: (h[ka] + h[kb] + h[kc] + h[kd]) / 4,
        tint: t.tint ? (t.tint[ka] + t.tint[kb] + t.tint[kc] + t.tint[kd]) / 4 : 0.3,
        bank: t.bank ? (t.bank[ka] + t.bank[kb] + t.bank[kc] + t.bank[kd]) / 4 : 0,
        under,
        jitter: jitter * 0.6, // a little per-cell variety, no per-triangle checker
      }
      tri(i, j, i + 1, j, i, j + 1, mixN(n1), cell)
      tri(i + 1, j, i + 1, j + 1, i, j + 1, mixN(n2), cell)
    }
  }
}
