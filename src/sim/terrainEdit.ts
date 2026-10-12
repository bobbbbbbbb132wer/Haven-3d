// WHAT THIS FILE DOES
// Changing the ground for real. It edits the terrain height data (the single source of truth that
// placement, raycasts and the 3D mesh all read) and works out foundations for buildings:
//   level   = flatten the ground under the building and blend it into the hills
//   raised  = leave the ground alone and stand the building on supports
//   natural = only on ground that is already almost flat (the old behaviour)
// Pure data, no 3D in here.
import { smoothstep } from './noise'
import {
  footprintBuildable,
  footprintHeight,
  MAX_TILE_STEP,
  type Rect,
  type Terrain,
} from './terrain'

export type FoundationMode = 'level' | 'raised' | 'natural'
export const FOUNDATION_MODES: FoundationMode[] = ['level', 'raised', 'natural']
export const FOUNDATION_LABEL: Record<FoundationMode, string> = {
  level: 'Level foundation',
  raised: 'Raised supports',
  natural: 'Natural ground',
}

export const MAX_LEVEL_RANGE = 4 // most height difference a level foundation will cut or fill
export const MAX_RAISED_RANGE = 3 // most height difference supports can span
export const LEVEL_BLEND = 3 // tiles over which levelled ground fades back into the hills

/** One ground corner that changes height. i/j are corner indices (0..size). */
export interface HeightChange {
  i: number
  j: number
  from: number
  to: number
}

/** Corner-index bounds (inclusive) of an edit. */
export interface EditBounds {
  i0: number
  j0: number
  i1: number
  j1: number
}

/** Answers "is this ground tile covered by a building or construction site?" (tile indices). */
export type TileTaken = (ti: number, tj: number) => boolean

export interface Foundation {
  ok: boolean
  /** Why it is not ok (empty when ok). */
  reason: string
  mode: FoundationMode
  /** Height the building's base sits at. */
  y: number
  /** Ground edits that will happen on confirm (level mode only). */
  changes: HeightChange[]
  /** Draw support posts under the building. */
  supports: boolean
}

let version = 0
/** Goes up every time the ground changes, so cached checks know to redo themselves. */
export const getTerrainVersion = () => version

const cornerOrigin = (t: Terrain, r: Rect) => {
  const half = t.size / 2
  return { i0: Math.round(r.x - r.w / 2 + half), j0: Math.round(r.z - r.d / 2 + half) }
}

// A corner is protected when a tree, rock, building or site touches one of its 4 tiles:
// moving it would make that thing float or sink.
function cornerProtected(t: Terrain, i: number, j: number, taken: TileTaken) {
  for (let dj = -1; dj <= 0; dj++) {
    for (let di = -1; di <= 0; di++) {
      const ti = i + di
      const tj = j + dj
      if (ti < 0 || tj < 0 || ti >= t.size || tj >= t.size) continue
      if (t.blocked[tj * t.size + ti] || taken(ti, tj)) return true
    }
  }
  return false
}

function fail(t: Terrain, r: Rect, mode: FoundationMode, reason: string): Foundation {
  return { ok: false, reason, mode, y: footprintHeight(t, r), changes: [], supports: false }
}

/** Works out whether a building can stand here with the chosen foundation, and what it changes. */
export function planFoundation(
  t: Terrain,
  r: Rect,
  mode: FoundationMode,
  taken: TileTaken,
): Foundation {
  const { i0, j0 } = cornerOrigin(t, r)
  if (i0 < 0 || j0 < 0 || i0 + r.w > t.size || j0 + r.d > t.size) {
    return fail(t, r, mode, 'Outside the map')
  }
  const s = t.size + 1
  let lo = Infinity
  let hi = -Infinity
  let sum = 0
  let n = 0
  for (let j = j0; j <= j0 + r.d; j++) {
    for (let i = i0; i <= i0 + r.w; i++) {
      const h = t.heights[j * s + i]
      if (h < lo) lo = h
      if (h > hi) hi = h
      sum += h
      n++
    }
  }
  for (let j = j0; j < j0 + r.d; j++) {
    for (let i = i0; i < i0 + r.w; i++) {
      if (t.blocked[j * t.size + i]) return fail(t, r, mode, 'Something is in the way (tree, rock or showroom)')
    }
  }

  if (mode === 'natural') {
    if (!footprintBuildable(t, r)) return fail(t, r, mode, 'Ground is not flat enough')
    return { ok: true, reason: '', mode, y: hi, changes: [], supports: hi - lo > 0.05 }
  }

  if (mode === 'raised') {
    if (hi - lo > MAX_RAISED_RANGE) return fail(t, r, mode, 'Ground too uneven for supports')
    return { ok: true, reason: '', mode, y: hi, changes: [], supports: hi - lo > 0.05 }
  }

  // level: flatten the footprint to its average height and blend the surroundings into it
  if (hi - lo > MAX_LEVEL_RANGE) return fail(t, r, mode, 'Ground too steep to level')
  const target = sum / n
  const changes: HeightChange[] = []
  for (let j = Math.max(0, j0 - LEVEL_BLEND); j <= Math.min(t.size, j0 + r.d + LEVEL_BLEND); j++) {
    for (
      let i = Math.max(0, i0 - LEVEL_BLEND);
      i <= Math.min(t.size, i0 + r.w + LEVEL_BLEND);
      i++
    ) {
      const dx = i < i0 ? i0 - i : i > i0 + r.w ? i - (i0 + r.w) : 0
      const dz = j < j0 ? j0 - j : j > j0 + r.d ? j - (j0 + r.d) : 0
      const dist = Math.hypot(dx, dz)
      if (dist >= LEVEL_BLEND) continue
      const from = t.heights[j * s + i]
      const to =
        dist === 0 ? target : from + (target - from) * (1 - smoothstep(0, LEVEL_BLEND, dist))
      if (Math.abs(to - from) < 0.005) continue
      if (cornerProtected(t, i, j, taken)) {
        if (dist === 0) return fail(t, r, mode, 'Buildings or trees block the levelling')
        continue // outside the footprint: just leave that corner as it is
      }
      changes.push({ i, j, from, to })
    }
  }
  return { ok: true, reason: '', mode, y: target, changes, supports: false }
}

/** Writes height changes into the terrain and refreshes the buildable flags. Returns the bounds. */
export function commitChanges(t: Terrain, changes: HeightChange[]): EditBounds | null {
  if (!changes.length) return null
  const s = t.size + 1
  let i0 = Infinity
  let j0 = Infinity
  let i1 = -Infinity
  let j1 = -Infinity
  for (const c of changes) {
    t.heights[c.j * s + c.i] = c.to
    i0 = Math.min(i0, c.i)
    j0 = Math.min(j0, c.j)
    i1 = Math.max(i1, c.i)
    j1 = Math.max(j1, c.j)
  }
  // a tile is buildable when its 4 corners are close in height (same rule as generateTerrain)
  for (let j = Math.max(0, j0 - 1); j <= Math.min(t.size - 1, j1); j++) {
    for (let i = Math.max(0, i0 - 1); i <= Math.min(t.size - 1, i1); i++) {
      const a = t.heights[j * s + i]
      const b = t.heights[j * s + i + 1]
      const c = t.heights[(j + 1) * s + i]
      const e = t.heights[(j + 1) * s + i + 1]
      const range = Math.max(a, b, c, e) - Math.min(a, b, c, e)
      t.buildable[j * t.size + i] = range <= MAX_TILE_STEP ? 1 : 0
    }
  }
  version++
  return { i0, j0, i1, j1 }
}
