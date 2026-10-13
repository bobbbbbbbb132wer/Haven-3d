// WHAT THIS FILE DOES
// Lists the buildings that get a menu icon: only buildings that have a real model in
// src/assets/models (the file name must match the building id, e.g. campfire.glb -> 'campfire').
import type { Scene } from '@babylonjs/core/scene'
import { models } from '../assets'
import { loadModel } from '../render/assetLoader'
import { BUILDINGS as REAL_BUILDINGS } from '../sim/buildings'
import { modelOf } from '../sim/buildingMeta'

export interface IconDef {
  id: string
  name: string
  build: (scene: Scene) => Promise<void>
}

export const BUILDINGS: IconDef[] = REAL_BUILDINGS.filter((b) => modelOf(b.id) in models).map((b) => ({
  id: b.id,
  name: b.name,
  build: async (scene: Scene) => {
    await loadModel(scene, modelOf(b.id))
  },
}))
