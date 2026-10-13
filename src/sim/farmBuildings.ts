// WHAT THIS FILE DOES
// The Farm Buildings pack (Quaternius, CC0) as plain data: which building ids exist, what model
// each one uses, its footprint in tiles and its cost. Pure data, no 3D in here.
// The models are src/assets/models/Farm_<Name>.glb (made by scripts/import-farm-buildings.mjs).
// The building menu and placement system read this through sim/buildings.ts and
// sim/buildingMeta.ts, so a new farm piece is one line here.
// To add one: add a line below + the .glb in src/assets/models. Nothing else.
import type { BuildingDef } from './buildings'
import type { BuildingMeta } from './buildingMeta'

export interface FarmBuilding {
  def: BuildingDef
  meta: BuildingMeta
  /** Key in src/assets/models (file name without .glb). */
  model: string
}

// Footprints are the model's real size rounded to whole tiles, so scale stays within about
// +-20% of the original. Proportions are never stretched (placement scales uniformly).
export const FARM_BUILDINGS: FarmBuilding[] = [
  {
    model: 'Farm_Barn',
    def: { id: 'barn', name: 'Barn', icon: '🏚️', cost: { wood: 40, stone: 10 }, startsUnlocked: true },
    meta: { category: 'storage', w: 8, d: 8 },
  },
  {
    model: 'Farm_BigBarn',
    def: { id: 'big_barn', name: 'Big Barn', icon: '🏚️', cost: { wood: 50, stone: 20 }, startsUnlocked: true },
    meta: { category: 'storage', w: 8, d: 8 },
  },
  {
    model: 'Farm_SmallBarn',
    def: { id: 'small_barn', name: 'Small Barn', icon: '🏠', cost: { wood: 30, stone: 5 }, startsUnlocked: true },
    meta: { category: 'storage', w: 6, d: 6 },
  },
  {
    model: 'Farm_OpenBarn',
    def: { id: 'open_barn', name: 'Open Barn', icon: '🛖', cost: { wood: 25 }, startsUnlocked: true },
    meta: { category: 'storage', w: 6, d: 6 },
  },
  {
    model: 'Farm_Silo',
    def: { id: 'silo', name: 'Silo', icon: '🌾', cost: { wood: 20, stone: 15 }, startsUnlocked: true },
    meta: { category: 'storage', w: 4, d: 4 },
  },
  {
    model: 'Farm_SiloHouse',
    def: { id: 'silo_house', name: 'Silo House', icon: '🏡', cost: { wood: 35, stone: 20 }, startsUnlocked: true },
    meta: { category: 'housing', w: 5, d: 4 },
  },
  {
    model: 'Farm_ChickenCoop',
    def: { id: 'chicken_coop', name: 'Chicken Coop', icon: '🐔', cost: { wood: 15 }, startsUnlocked: true },
    meta: { category: 'farming', w: 2, d: 2 },
  },
  {
    model: 'Farm_Windmill',
    def: { id: 'windmill', name: 'Windmill', icon: '🌬️', cost: { wood: 40, stone: 15, metal: 5 }, startsUnlocked: true },
    meta: { category: 'production', w: 7, d: 2 },
  },
  {
    model: 'Farm_TowerWindmill',
    def: { id: 'tower_windmill', name: 'Tower Windmill', icon: '🌬️', cost: { wood: 45, stone: 25, metal: 5 }, startsUnlocked: true },
    meta: { category: 'production', w: 8, d: 5 },
  },
  {
    model: 'Farm_WaterTower',
    def: { id: 'water_tower', name: 'Water Tower', icon: '💧', cost: { wood: 20, stone: 20, metal: 5 }, startsUnlocked: true },
    meta: { category: 'farming', w: 3, d: 3 },
  },
  {
    model: 'Farm_Fence',
    def: { id: 'fence', name: 'Fence', icon: '🚧', cost: { wood: 4 }, startsUnlocked: true },
    meta: { category: 'defense', w: 6, d: 1 },
  },
  {
    model: 'Farm_Fence2',
    def: { id: 'fence2', name: 'Fence (Rails)', icon: '🚧', cost: { wood: 4 }, startsUnlocked: true },
    meta: { category: 'defense', w: 6, d: 1 },
  },
]

/**
 * The existing Well building keeps its id, cost and unlock; it only gains the Farm_Well model.
 * 1x1 footprint: the model is about 1.3 m wide.
 */
export const WELL_MODEL = 'Farm_Well'
export const WELL_META: BuildingMeta = { category: 'farming', w: 1, d: 1 }

/** Building id -> model key, for every building that uses a model whose name differs from its id. */
export const MODEL_OF: Record<string, string> = {
  well: WELL_MODEL,
  ...Object.fromEntries(FARM_BUILDINGS.map((f) => [f.def.id, f.model])),
}
