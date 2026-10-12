// WHAT THIS FILE DOES
// Puts the trees, bushes, stumps and stones into the world. Each model is loaded once and then
// copied as lightweight instances, so hundreds of them stay fast.
import type { Scene } from '@babylonjs/core/scene'
import '@babylonjs/core/Meshes/instancedMesh' // needed for instances to work
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { loadModel } from './assetLoader'
import { models } from '../assets'
import { SCENERY } from '../sim/scenery'
import { heightAt, type SceneryItem, type Terrain } from '../sim/terrain'

async function placeGroup(scene: Scene, type: string, items: SceneryItem[], t: Terrain) {
  const { meshes } = await loadModel(scene, type)
  const root = meshes[0]

  // work out how much to scale it so it ends up the size we want (in metres)
  const b = root.getHierarchyBoundingVectors(true)
  const def = SCENERY[type] ?? { w: 1 }
  const base = def.h
    ? def.h / Math.max(b.max.y - b.min.y, 0.001)
    : (def.w ?? 1) / Math.max(b.max.x - b.min.x, b.max.z - b.min.z, 0.001)

  items.forEach((it, n) => {
    const holder = new TransformNode(`${type}_${n}`, scene)
    holder.position.set(it.x, heightAt(t, it.x, it.z) - 0.05, it.z)
    holder.rotation.y = it.rot
    holder.scaling.setAll(base * it.scale)

    // the first one uses the loaded model itself, the rest are instances of it
    const node = n === 0 ? root : root.instantiateHierarchy(holder)
    if (n === 0) root.parent = holder
    for (const m of node?.getChildMeshes() ?? []) m.isPickable = false
    if (n === 0) for (const m of meshes) m.isPickable = false
  })
}

export async function spawnScenery(scene: Scene, t: Terrain) {
  const groups = new Map<string, SceneryItem[]>()
  for (const it of t.scenery) {
    if (!(it.type in models)) continue // model file not in src/assets/models, skip it
    const list = groups.get(it.type) ?? []
    list.push(it)
    groups.set(it.type, list)
  }
  for (const [type, items] of groups) {
    try {
      await placeGroup(scene, type, items, t)
    } catch (err) {
      console.error(`scenery failed for ${type}:`, err)
    }
  }
}
