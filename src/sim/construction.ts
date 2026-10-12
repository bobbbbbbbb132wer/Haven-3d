// WHAT THIS FILE DOES
// Tracks buildings under construction and finished ones: where they are, what space they use,
// and how much build time is left. Pure data, no 3D in here.

/** A rectangle on the ground: centre x/z and size in tiles (already rotated). */
export interface Footprint {
  x: number
  z: number
  w: number
  d: number
}

export interface Site extends Footprint {
  uid: number
  id: string
  /** 0-3, quarter turns. */
  rot: number
  total: number
  left: number
  /** Height the base sits at (set when placed on terrain). */
  y?: number
  /** Foundation used: level, raised or natural. */
  foundation?: string
}

export interface Construction {
  sites: Site[]
  built: (Footprint & { id: string })[]
  nextUid: number
}

export function createConstruction(): Construction {
  return { sites: [], built: [], nextUid: 1 }
}

function hit(a: Footprint, b: Footprint) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-6
  )
}

export function overlaps(c: Construction, f: Footprint) {
  return c.sites.some((s) => hit(s, f)) || c.built.some((b) => hit(b, f))
}

export function addSite(
  c: Construction,
  id: string,
  f: Footprint,
  rot: number,
  seconds: number,
): Site {
  const site: Site = { ...f, uid: c.nextUid++, id, rot, total: seconds, left: seconds }
  c.sites.push(site)
  return site
}

export function progress(s: Site) {
  return 1 - s.left / s.total
}

/** Advances all sites by dt seconds. Returns the ones that just finished. */
export function tick(c: Construction, dt: number): Site[] {
  const done: Site[] = []
  for (const s of c.sites) {
    s.left -= dt
    if (s.left <= 0) done.push(s)
  }
  for (const s of done) {
    c.sites.splice(c.sites.indexOf(s), 1)
    c.built.push({ id: s.id, x: s.x, z: s.z, w: s.w, d: s.d })
  }
  return done
}
