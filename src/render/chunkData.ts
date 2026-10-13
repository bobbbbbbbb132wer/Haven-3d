// WHAT THIS FILE DOES
// Turns a square block of the terrain (a "chunk") into flat-shaded low-poly triangle data.
// Chunks share their edge heights and use the same triangle split as heightAt(), so there are
// no seams or cracks and models sit exactly on the visible ground. Pure maths (no 3D library).
import type { Terrain } from '../sim/terrain'
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

  const tri = (ai: number, aj: number, bi: number, bj: number, ci2: number, cj2: number) => {
    const ka = aj * S + ai
    const kb = bj * S + bi
    const kc = cj2 * S + ci2
    const ay = h[ka], by = h[kb], cy = h[kc]
    const ax = ai - H, az = aj - H, bx = bi - H, bz = bj - H, cx = ci2 - H, cz = cj2 - H
    let nxv = (by - ay) * (cz - az) - (bz - az) * (cy - ay)
    let nyv = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
    let nzv = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    const len = Math.hypot(nxv, nyv, nzv) || 1
    nxv /= len; nyv /= len; nzv /= len
    if (nyv < 0) { nxv = -nxv; nyv = -nyv; nzv = -nzv } // ground faces always point up
    const jitter = (((ai * 73856093) ^ (aj * 19349663) ^ (ci2 * 83492791) ^ (cj2 * 2654435)) & 255) / 127.5 - 1
    const tint = t.tint ? (t.tint[ka] + t.tint[kb] + t.tint[kc]) / 3 : 0.3
    const bank = t.bank ? (t.bank[ka] + t.bank[kb] + t.bank[kc]) / 3 : 0
    let under = 0
    if (t.wlevel) {
      const wa = t.wlevel[ka], wb = t.wlevel[kb], wc = t.wlevel[kc]
      if (wa === wa && wb === wb && wc === wc) under = Math.max(0, (wa + wb + wc - ay - by - cy) / 3)
    }
    const rgb = faceColor((ay + by + cy) / 3, 1 - nyv, tint, bank, jitter, under)
    pos[p] = ax; pos[p + 1] = ay; pos[p + 2] = az
    pos[p + 3] = bx; pos[p + 4] = by; pos[p + 5] = bz
    pos[p + 6] = cx; pos[p + 7] = cy; pos[p + 8] = cz
    for (let q = 0; q < 3; q++) {
      nor[p + q * 3] = nxv; nor[p + q * 3 + 1] = nyv; nor[p + q * 3 + 2] = nzv
      col[c] = rgb[0]; col[c + 1] = rgb[1]; col[c + 2] = rgb[2]; col[c + 3] = 1
      c += 4
    }
    p += 9
  }

  for (let j = j0; j < j0 + nz; j++) {
    for (let i = i0; i < i0 + nx; i++) {
      // same split as heightAt(): a=(i,j) b=(i+1,j) c=(i,j+1) d=(i+1,j+1) -> (a,b,c) and (b,d,c)
      tri(i, j, i + 1, j, i, j + 1)
      tri(i + 1, j, i + 1, j + 1, i, j + 1)
    }
  }
}
