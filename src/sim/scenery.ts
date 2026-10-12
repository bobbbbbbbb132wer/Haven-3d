// WHAT THIS FILE DOES
// Decides where trees, bushes, stumps and stones go (forest patches, treeline, rocky slopes)
// and marks those tiles as taken so nothing can be built on them. Pure data, no 3D in here.
import { fbm, makeNoise2D, makeRng } from './noise'
import type { Terrain } from './terrain'

/** How big each model should be, in metres. h = target height, w = target width. */
export const SCENERY: Record<string, { h?: number; w?: number }> = {
  tree_average_regular: { h: 7 },
  tree_average_lush: { h: 7.5 },
  tree_average_bare: { h: 7 },
  tree_small_regular: { h: 4 },
  tree_small_bare: { h: 2.5 },
  tree_spruce_small_01: { h: 9 },
  tree_spruce_small_02: { h: 9 },
  tree_spruce_tiny_01: { h: 5 },
  tree_spruce_tiny_02: { h: 5 },
  bush_average: { w: 1.6 },
  bush_average_bare: { w: 1.4 },
  bush_group_average: { w: 2 },
  bush_group_big: { w: 2.6 },
  bush_group_small: { w: 1.4 },
  stump_average_flat: { w: 1.1 },
  stump_average_high: { w: 1.1 },
  stump_average_low: { w: 1 },
  stump_average_hollow: { w: 1.1 },
  stone_average_01: { w: 1.1 },
  stone_average_01_mossy: { w: 1.1 },
  stone_group_average: { w: 1.8 },
  stone_group_average_mossy: { w: 1.8 },
}

const CLEAR_RADIUS = 18 // nothing grows this close to the start (the campfire spot)
const TREELINE = 16 // no trees above this height

function pick(list: [string, number][], r: number): string {
  const total = list.reduce((a, [, w]) => a + w, 0)
  let t = r * total
  for (const [name, w] of list) {
    t -= w
    if (t <= 0) return name
  }
  return list[list.length - 1][0]
}

const BROADLEAF: [string, number][] = [
  ['tree_average_regular', 3],
  ['tree_average_lush', 2],
  ['tree_small_regular', 1.5],
  ['tree_average_bare', 0.4],
  ['tree_small_bare', 0.3],
]
const SPRUCE: [string, number][] = [
  ['tree_spruce_small_01', 2],
  ['tree_spruce_small_02', 2],
  ['tree_spruce_tiny_01', 1],
  ['tree_spruce_tiny_02', 1],
]
const BUSHES: [string, number][] = [
  ['bush_average', 3],
  ['bush_average_bare', 1],
  ['bush_group_small', 2],
  ['bush_group_average', 1.5],
  ['bush_group_big', 0.7],
]
const STUMPS: [string, number][] = [
  ['stump_average_low', 2],
  ['stump_average_flat', 1.5],
  ['stump_average_high', 1.5],
  ['stump_average_hollow', 1],
]
const STONES: [string, number][] = [
  ['stone_average_01', 3],
  ['stone_average_01_mossy', 2],
  ['stone_group_average', 1],
  ['stone_group_average_mossy', 0.7],
]

export function scatterScenery(t: Terrain) {
  const rng = makeRng(t.seed + 7)
  const nForest = makeNoise2D(t.seed + 606)
  const nBiome = makeNoise2D(t.seed + 707)
  const half = t.size / 2
  const s = t.size + 1

  for (let j = 0; j < t.size; j++) {
    for (let i = 0; i < t.size; i++) {
      const cx = i - half + 0.5
      const cz = j - half + 0.5
      if (Math.hypot(cx, cz) < CLEAR_RADIUS) continue

      const a = t.heights[j * s + i]
      const b = t.heights[j * s + i + 1]
      const c = t.heights[(j + 1) * s + i]
      const e = t.heights[(j + 1) * s + i + 1]
      const slope = Math.max(a, b, c, e) - Math.min(a, b, c, e)
      const h = (a + b + c + e) / 4

      const forest = fbm(nForest, cx * 0.045, cz * 0.045, 2) // forest patches
      const biome = nBiome(cx * 0.02, cz * 0.02) // broadleaf vs spruce regions
      const flat = slope < 1.0 && h < TREELINE

      const r = rng()
      let type: string | null = null
      if (flat && forest > 0.08) {
        const pTree = Math.min(0.13, (forest - 0.08) * 0.38)
        if (r < pTree) {
          const spruce = biome > 0.15 || h > 8
          type = pick(spruce ? SPRUCE : BROADLEAF, rng())
        } else if (r < pTree + 0.012) type = pick(BUSHES, rng())
        else if (r < pTree + 0.018) type = pick(STUMPS, rng())
      } else if (flat && forest > -0.1 && r < 0.03) {
        type = pick(BUSHES, rng()) // bushes thin out around the forest edge
      }
      if (!type) {
        const pStone = slope > 0.7 ? 0.025 : 0.003
        if (rng() < pStone) type = pick(STONES, rng())
      }
      if (!type) continue

      const x = cx + (rng() - 0.5) * 0.6
      const z = cz + (rng() - 0.5) * 0.6
      t.scenery.push({
        type,
        x,
        z,
        rot: rng() * Math.PI * 2,
        scale: 0.85 + rng() * 0.3,
      })
      t.blocked[j * t.size + i] = 1
    }
  }
}
