// WHAT THIS FILE DOES
// Categories and footprints (in tiles) for each building, plus how long it takes to build.
// Pure data, no 3D in here. To categorise a new building, add one line to META.
import { FARM_BUILDINGS, MODEL_OF, WELL_META } from './farmBuildings'

export interface CategoryDef {
  id: string
  name: string
  icon: string
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'survival', name: 'Survival', icon: '🔥' },
  { id: 'housing', name: 'Housing', icon: '🏠' },
  { id: 'storage', name: 'Storage', icon: '📦' },
  { id: 'defense', name: 'Defense', icon: '🛡️' },
  { id: 'production', name: 'Production', icon: '🔨' },
  { id: 'farming', name: 'Farming', icon: '🌱' },
]

export interface BuildingMeta {
  category: string
  /** Footprint in tiles. */
  w: number
  d: number
}

export const META: Record<string, BuildingMeta> = {
  campfire: { category: 'survival', w: 2, d: 2 },
  torch: { category: 'survival', w: 1, d: 1 },
  tent: { category: 'housing', w: 3, d: 3 },
  bed: { category: 'housing', w: 1, d: 2 },
  crate: { category: 'storage', w: 1, d: 1 },
  woodwall: { category: 'defense', w: 1, d: 1 },
  stonewall: { category: 'defense', w: 1, d: 1 },
  door: { category: 'defense', w: 1, d: 1 },
  tower: { category: 'defense', w: 2, d: 2 },
  workbench: { category: 'production', w: 2, d: 1 },
  stove: { category: 'production', w: 1, d: 1 },
  forge: { category: 'production', w: 2, d: 2 },
  farm: { category: 'farming', w: 3, d: 3 },
  well: WELL_META,
  ...Object.fromEntries(FARM_BUILDINGS.map((f) => [f.def.id, f.meta])),
}

/** Key of the model in src/assets/models for a building (defaults to the building id). */
export function modelOf(id: string): string {
  return MODEL_OF[id] ?? id
}

export function metaOf(id: string): BuildingMeta {
  return META[id] ?? { category: 'misc', w: 1, d: 1 }
}

/** Bigger buildings take longer: 2 seconds plus 0.75 per tile of footprint. */
export function buildSeconds(id: string): number {
  const m = metaOf(id)
  return 2 + m.w * m.d * 0.75
}
