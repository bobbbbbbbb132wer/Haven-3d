// WHAT THIS FILE DOES
// The ground as pure data: a grid of heights made from seeded noise, plus "can I build here?"
// checks and a mouse-ray-to-ground helper. No 3D in here (rule: never import Babylon in sim).
//
// SCALE: 1 unit = 1 metre = 1 tile. A colonist is about 1.7 tall, the campfire is 2 wide,
// trees are 4-9 tall. Heights go roughly from -6 (valleys) to +30 (mountain tops).
import { fbm, makeNoise2D, smoothstep } from './noise'

export const WORLD_SIZE = 192 // tiles per side. 128 = lighter, 256 = bigger
export const START_FLAT = 14 // radius of the guaranteed flat start area (around 0,0)
export const START_BLEND = 34 // flat area fades into hills by this radius
export const MAX_TILE_STEP = 0.55 // a tile steeper than this (height difference) can't be built on
export const MAX_FOOTPRINT_STEP = 0.9 // a whole building can't span more height than this

const HILL_HEIGHT = 7 // metres of rolling hills
const MOUNTAIN_HEIGHT = 24 // extra metres where mountains are allowed

export interface SceneryItem {
  type: string
  x: number
  z: number
  rot: number
  scale: number
}

export interface Terrain {
  size: number
  seed: number
  /** (size+1) x (size+1) heights, one per grid corner. Index = z * (size+1) + x. */
  heights: Float32Array
  /** 1 = this tile is flat enough to build on. Index = z * size + x. */
  buildable: Uint8Array
  /** 1 = a tree, bush, stone or stump is on this tile. */
  blocked: Uint8Array
  scenery: SceneryItem[]
  /** Optional extras from sim/worldgen.ts (one value per grid corner): grass variety, river-bank closeness, 1 = under the river. */
  tint?: Float32Array
  bank?: Float32Array
  water?: Uint8Array
  /** The river's centre line, one entry per metre of z: x, z, water height and half-width. */
  river?: { x: Float32Array; z: Float32Array; y: Float32Array; half: Float32Array }
}

/** A rectangle on the ground: centre x/z and size in tiles. */
export interface Rect {
  x: number
  z: number
  w: number
  d: number
}

export function generateTerrain(seed: number, size: number = WORLD_SIZE, flat = false): Terrain {
  const half = size / 2
  const nBroad = makeNoise2D(seed)
  const nMid = makeNoise2D(seed + 101)
  const nFine = makeNoise2D(seed + 202)
  const nWarp = makeNoise2D(seed + 303)
  const nMask = makeNoise2D(seed + 404)
  const nRidge = makeNoise2D(seed + 505)

  const stride = size + 1
  const heights = new Float32Array(stride * stride)

  for (let j = 0; j <= size; j++) {
    for (let i = 0; i <= size; i++) {
      const x = i - half
      const z = j - half

      // gentle domain warp: bends the coordinates so the hills don't look like perfect blobs
      const px = x + nWarp(x * 0.015, z * 0.015) * 5
      const pz = z + nWarp(x * 0.015 + 50, z * 0.015 + 50) * 5

      // 70% broad shapes, 23% medium hills, 7% fine detail
      const broad = fbm(nBroad, px * 0.011, pz * 0.011, 3)
      const mid = fbm(nMid, px * 0.035, pz * 0.035, 2)
      const fine = nFine(px * 0.12, pz * 0.12)
      let h = (0.7 * broad + 0.25 * mid + 0.05 * fine) * HILL_HEIGHT * 1.2

      // mountains only where a separate low-frequency mask allows them
      const mask = smoothstep(0.66, 0.88, (nMask(px * 0.008, pz * 0.008) + 1) / 2)
      const ridge = 1 - Math.abs(nRidge(px * 0.013, pz * 0.013))
      h += mask * ridge * ridge * MOUNTAIN_HEIGHT

      // guaranteed flat, buildable start area around the middle, blending into the hills
      const d = Math.hypot(x, z)
      h *= smoothstep(START_FLAT, START_BLEND, d)

      heights[j * stride + i] = h
    }
  }

  if (flat) heights.fill(0)

  const buildable = new Uint8Array(size * size)
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const a = heights[j * stride + i]
      const b = heights[j * stride + i + 1]
      const c = heights[(j + 1) * stride + i]
      const e = heights[(j + 1) * stride + i + 1]
      const range = Math.max(a, b, c, e) - Math.min(a, b, c, e)
      buildable[j * size + i] = range <= MAX_TILE_STEP ? 1 : 0
    }
  }

  return { size, seed, heights, buildable, blocked: new Uint8Array(size * size), scenery: [] }
}

// ---- the one terrain the game is using right now ----
let current: Terrain | null = null
export const setTerrain = (t: Terrain) => (current = t)
export const getTerrain = () => current

/** Ground height at any x/z (smoothly blended between grid corners). */
export function heightAt(t: Terrain, x: number, z: number): number {
  const half = t.size / 2
  const fx = Math.min(Math.max(x + half, 0), t.size)
  const fz = Math.min(Math.max(z + half, 0), t.size)
  const i = Math.min(Math.floor(fx), t.size - 1)
  const j = Math.min(Math.floor(fz), t.size - 1)
  const u = fx - i
  const v = fz - j
  const s = t.size + 1
  const h00 = t.heights[j * s + i]
  const h10 = t.heights[j * s + i + 1]
  const h01 = t.heights[(j + 1) * s + i]
  const h11 = t.heights[(j + 1) * s + i + 1]
  // The ground mesh splits every tile into two triangles along the corner (1,0)-(0,1), so use
  // the same triangles here. Models, trees and the ghost then sit exactly ON the visible ground
  // instead of sinking into it on slopes.
  if (u + v <= 1) return h00 + u * (h10 - h00) + v * (h01 - h00)
  return h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11)
}

/** First tile (corner index) of a footprint. */
function origin(t: Terrain, r: Rect) {
  const half = t.size / 2
  return { i0: Math.round(r.x - r.w / 2 + half), j0: Math.round(r.z - r.d / 2 + half) }
}

/** Height a building should sit at: the average of the ground under it. */
export function footprintHeight(t: Terrain, r: Rect): number {
  const { i0, j0 } = origin(t, r)
  const s = t.size + 1
  let sum = 0
  let n = 0
  for (let j = j0; j <= j0 + r.d; j++) {
    for (let i = i0; i <= i0 + r.w; i++) {
      if (i < 0 || j < 0 || i > t.size || j > t.size) continue
      sum += t.heights[j * s + i]
      n++
    }
  }
  return n ? sum / n : 0
}

/** Is this whole rectangle on the map, flat enough, and free of trees, rocks and bushes? */
export function footprintBuildable(t: Terrain, r: Rect): boolean {
  const { i0, j0 } = origin(t, r)
  if (i0 < 0 || j0 < 0 || i0 + r.w > t.size || j0 + r.d > t.size) return false
  const s = t.size + 1
  let lo = Infinity
  let hi = -Infinity
  for (let j = j0; j <= j0 + r.d; j++) {
    for (let i = i0; i <= i0 + r.w; i++) {
      const h = t.heights[j * s + i]
      if (h < lo) lo = h
      if (h > hi) hi = h
    }
  }
  if (hi - lo > MAX_FOOTPRINT_STEP) return false
  for (let j = j0; j < j0 + r.d; j++) {
    for (let i = i0; i < i0 + r.w; i++) {
      const k = j * t.size + i
      if (!t.buildable[k] || t.blocked[k]) return false
    }
  }
  return true
}

/** Where a ray (from the camera through the mouse) first hits the ground. Null = it misses. */
export function raycastGround(
  t: Terrain,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
): { x: number; y: number; z: number } | null {
  const half = t.size / 2
  if (oy < heightAt(t, ox, oz)) return null // camera is inside a hill
  const STEP = 0.5
  let prev = 0
  for (let s = STEP; s <= 700; s += STEP) {
    const x = ox + dx * s
    const z = oz + dz * s
    if (Math.abs(x) > half || Math.abs(z) > half) {
      prev = s
      continue
    }
    if (oy + dy * s < heightAt(t, x, z)) {
      let lo = prev
      let hi = s
      for (let k = 0; k < 10; k++) {
        const mid = (lo + hi) / 2
        if (oy + dy * mid < heightAt(t, ox + dx * mid, oz + dz * mid)) hi = mid
        else lo = mid
      }
      const px = ox + dx * hi
      const pz = oz + dz * hi
      return { x: px, y: heightAt(t, px, pz), z: pz }
    }
    prev = s
  }
  return null
}
