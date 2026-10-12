// WHAT THIS FILE DOES
// Loads 3D models and textures that you drop into src/assets.
import type { Scene } from '@babylonjs/core/scene'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import '@babylonjs/loaders/glTF'
import { models, textures } from '../assets'

// Works out the file type from the embedded data. Prefer .glb, it is the safest.
function formatOf(url: string): string {
  if (url.startsWith('data:model/gltf+json')) return '.gltf'
  return '.glb'
}

export async function loadModel(scene: Scene, name: string) {
  const url = models[name]
  if (!url) throw new Error(`Model not found: ${name}`)
  return SceneLoader.ImportMeshAsync('', '', url, scene, undefined, formatOf(url))
}

export function loadTexture(scene: Scene, name: string) {
  const url = textures[name]
  if (!url) throw new Error(`Texture not found: ${name}`)
  return new Texture(url, scene)
}
