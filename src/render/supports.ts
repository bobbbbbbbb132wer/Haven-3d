// WHAT THIS FILE DOES
// Wooden posts and a base slab that hold a building level above sloping ground ("raised supports").
import type { Scene } from '@babylonjs/core/scene'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Footprint } from '../sim/construction'
import { getTerrain, heightAt } from '../sim/terrain'

/** Builds posts and a slab under a footprint whose base is at height y. alpha < 1 for the ghost. */
export function createSupports(scene: Scene, fp: Footprint, y: number, alpha = 1): TransformNode {
  const root = new TransformNode('supports', scene)
  const mat = new StandardMaterial('supportsMat', scene)
  mat.diffuseColor = new Color3(0.42, 0.29, 0.17)
  mat.specularColor = Color3.Black()
  mat.alpha = alpha
  const t = getTerrain()

  const slab = MeshBuilder.CreateBox('slab', { width: fp.w, depth: fp.d, height: 0.2 }, scene)
  slab.parent = root
  slab.position.set(fp.x, y - 0.1, fp.z)
  slab.material = mat
  slab.isPickable = false

  // posts around the edge, about every 2 tiles
  const nx = Math.max(2, Math.ceil(fp.w / 2) + 1)
  const nz = Math.max(2, Math.ceil(fp.d / 2) + 1)
  for (let a = 0; a < nx; a++) {
    for (let b = 0; b < nz; b++) {
      if (a > 0 && a < nx - 1 && b > 0 && b < nz - 1) continue
      const px = fp.x - fp.w / 2 + 0.15 + ((fp.w - 0.3) * a) / (nx - 1)
      const pz = fp.z - fp.d / 2 + 0.15 + ((fp.d - 0.3) * b) / (nz - 1)
      const ground = t ? heightAt(t, px, pz) : 0
      const height = Math.max(0.1, y - 0.2 - ground + 0.4) // sink 0.4 into the ground
      const post = MeshBuilder.CreateBox('post', { width: 0.22, depth: 0.22, height }, scene)
      post.parent = root
      post.position.set(px, y - 0.2 - height / 2, pz)
      post.material = mat
      post.isPickable = false
    }
  }
  return root
}
