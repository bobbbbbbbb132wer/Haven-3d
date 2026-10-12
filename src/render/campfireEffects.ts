// WHAT THIS FILE DOES
// Makes a campfire feel alive: flickering light, wobbling flames, rising embers and smoke.
// The model has no animation, so everything here is done in code.
import type { Scene } from '@babylonjs/core/scene'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { PointLight } from '@babylonjs/core/Lights/pointLight'
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem'
import '@babylonjs/core/Particles/particleSystemComponent'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { FIRE } from '../config'

// A soft white dot drawn in code, so we need no image files
function makeSoftDot(scene: Scene) {
  const texture = new DynamicTexture('softDot', 64, scene, false)
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  texture.update()
  texture.hasAlpha = true
  return texture
}

/**
 * parts    = every mesh/node of the loaded campfire model
 * position = where the campfire sits in the world
 * Returns a function that removes all the effects again.
 */
export function addCampfireEffects(scene: Scene, parts: TransformNode[], position: Vector3) {
  // ----- 1. Find the flame parts by name ("Fire center", "Fire outside") -----
  const isFire = (node: TransformNode) => /^fire/i.test(node.name)
  const flames = parts
    .filter(
      (node) =>
        isFire(node) &&
        !parts.some((other) => other !== node && isFire(other) && node.isDescendantOf(other)),
    )
    .map((node, index) => {
      node.rotationQuaternion = null // so we can spin it with rotation.y
      return { node, baseScale: node.scaling.clone(), phase: index * 1.7, spin: index % 2 ? -1 : 1 }
    })
  if (flames.length === 0) console.warn('Campfire: no flame parts found to animate')

  // ----- 2. Flickering light -----
  const light = new PointLight('campfireGlow', position.add(new Vector3(0, 1.2, 0)), scene)
  light.diffuse = Color3.FromArray(FIRE.lightColor)
  light.intensity = FIRE.lightIntensity
  light.range = FIRE.lightRange

  // ----- 3. Embers (small glowing sparks) -----
  const dot = makeSoftDot(scene)
  const embers = new ParticleSystem('embers', 80, scene)
  embers.particleTexture = dot
  embers.emitter = position.add(new Vector3(0, 1.1, 0))
  embers.minEmitBox = new Vector3(-0.25, 0, -0.25)
  embers.maxEmitBox = new Vector3(0.25, 0.1, 0.25)
  embers.color1 = new Color4(1, 0.7, 0.2, 1)
  embers.color2 = new Color4(1, 0.35, 0.05, 1)
  embers.colorDead = new Color4(0.3, 0.05, 0, 0)
  embers.minSize = 0.03
  embers.maxSize = 0.08
  embers.minLifeTime = 0.8
  embers.maxLifeTime = 1.8
  embers.emitRate = FIRE.embersPerSecond
  embers.blendMode = ParticleSystem.BLENDMODE_ONEONE // glowing
  embers.gravity = new Vector3(0, 0.6, 0)
  embers.direction1 = new Vector3(-0.3, 1.2, -0.3)
  embers.direction2 = new Vector3(0.3, 2, 0.3)
  embers.minEmitPower = 0.4
  embers.maxEmitPower = 1
  embers.start()

  // ----- 4. Smoke -----
  const smoke = new ParticleSystem('smoke', 40, scene)
  smoke.particleTexture = dot
  smoke.emitter = position.add(new Vector3(0, 1.6, 0))
  smoke.minEmitBox = new Vector3(-0.2, 0, -0.2)
  smoke.maxEmitBox = new Vector3(0.2, 0.1, 0.2)
  smoke.color1 = new Color4(0.3, 0.3, 0.3, 0.35)
  smoke.color2 = new Color4(0.2, 0.2, 0.2, 0.3)
  smoke.colorDead = new Color4(0.1, 0.1, 0.1, 0)
  smoke.minSize = 0.5
  smoke.maxSize = 1.1
  smoke.minLifeTime = 2
  smoke.maxLifeTime = 3.5
  smoke.emitRate = FIRE.smokePerSecond
  smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD
  smoke.gravity = new Vector3(0, 0.3, 0)
  smoke.direction1 = new Vector3(-0.15, 0.8, -0.15)
  smoke.direction2 = new Vector3(0.15, 1.2, 0.15)
  smoke.minEmitPower = 0.3
  smoke.maxEmitPower = 0.6
  smoke.minAngularSpeed = -0.5
  smoke.maxAngularSpeed = 0.5
  smoke.start()

  // ----- 5. Every frame: wobble the flames and flicker the light -----
  const startTime = performance.now()
  const observer = scene.onBeforeRenderObservable.add(() => {
    const t = ((performance.now() - startTime) / 1000) * FIRE.flameSpeed

    for (const flame of flames) {
      const wave = Math.sin(t * 7 + flame.phase) * 0.6 + Math.sin(t * 13 + flame.phase * 2) * 0.4
      const stretch = 1 + FIRE.flameWobble * wave
      const squeeze = 1 - FIRE.flameWobble * 0.4 * wave
      flame.node.scaling.set(
        flame.baseScale.x * squeeze,
        flame.baseScale.y * stretch,
        flame.baseScale.z * squeeze,
      )
      flame.node.rotation.y = t * 0.5 * flame.spin
    }

    const mix = Math.sin(t * 17) * 0.5 + Math.sin(t * 29 + 2) * 0.3 + Math.sin(t * 53 + 5) * 0.2
    light.intensity = FIRE.lightIntensity * (1 + FIRE.lightFlicker * 0.5 * mix)
  })

  return () => {
    scene.onBeforeRenderObservable.remove(observer)
    light.dispose()
    embers.dispose()
    smoke.dispose()
  }
}
