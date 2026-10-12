// WHAT THIS FILE DOES
// The shared colony stockpile rules. world.resources holds what is STORED.
// world.reserved = cost promised to buildings under construction. Available = stored - reserved.
// Also keeps a short history so the UI can show a net trend per minute. No 3D in here.
import type { World } from './world'

export function reservedOf(world: World, id: string) {
  return world.reserved[id] ?? 0
}

export function availableOf(world: World, id: string) {
  return Math.max(0, (world.resources[id] ?? 0) - reservedOf(world, id))
}

/** Promise this cost to a building order (stored stays the same until consume). */
export function reserve(world: World, cost: Record<string, number>) {
  for (const [r, n] of Object.entries(cost)) world.reserved[r] = reservedOf(world, r) + n
}

/** Give a reservation back (for cancelled orders). */
export function release(world: World, cost: Record<string, number>) {
  for (const [r, n] of Object.entries(cost)) {
    world.reserved[r] = Math.max(0, reservedOf(world, r) - n)
  }
}

/** Spend a reserved cost for real: removes it from stored and from reserved. */
export function consume(world: World, cost: Record<string, number>) {
  for (const [r, n] of Object.entries(cost)) {
    world.resources[r] = Math.max(0, (world.resources[r] ?? 0) - n)
    world.reserved[r] = Math.max(0, reservedOf(world, r) - n)
  }
}

// ---- trend: net change per minute over (up to) the last 60 seconds ----
interface Sample {
  t: number
  v: Record<string, number>
}
const history: Sample[] = []
const WINDOW_MS = 60_000

export function sample(world: World, nowMs: number) {
  history.push({ t: nowMs, v: { ...world.resources } })
  while (history.length > 2 && nowMs - history[0].t > WINDOW_MS) history.shift()
}

export function trendPerMin(id: string): number {
  if (history.length < 2) return 0
  const a = history[0]
  const b = history[history.length - 1]
  const secs = (b.t - a.t) / 1000
  if (secs < 5) return 0 // too little data to say
  return (((b.v[id] ?? 0) - (a.v[id] ?? 0)) / secs) * 60
}
