// WHAT THIS FILE DOES
// Draws colonists. The models are src/assets/models/Colonist_Male.glb and Colonist_Female.glb:
// Quaternius Universal Base Characters carrying the Colony Animation Library (25 animations +
// A_TPose, one shared 65-bone rig). Use spawnColonist() to put one in the world and
// actor.play(COLONIST_ANIMS.walk) to switch what it is doing. The sim does not create
// colonists yet, so nothing calls spawnColonist in the game; the showroom previews them.
import '@babylonjs/core/Animations/animatable'
import type { Scene } from '@babylonjs/core/scene'
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { loadModel } from './assetLoader'

export const COLONIST_MODELS = ['Colonist_Male', 'Colonist_Female'] as const
export type ColonistModel = (typeof COLONIST_MODELS)[number]

/** Animation names inside the colonist models, grouped by what a colonist is doing. */
export const COLONIST_ANIMS = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  walkFormal: 'Walk_Formal_Loop',
  jog: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  crouchIdle: 'Crouch_Idle_Loop',
  crouchWalk: 'Crouch_Fwd_Loop',
  jumpStart: 'Jump_Start',
  jumpLoop: 'Jump_Loop',
  jumpLand: 'Jump_Land',
  swimIdle: 'Swim_Idle_Loop',
  swim: 'Swim_Fwd_Loop',
  pickUp: 'PickUp_Table',
  push: 'Push_Loop',
  repair: 'Fixing_Kneeling',
  interact: 'Interact',
  idleTorch: 'Idle_Torch_Loop',
  sitDown: 'Sitting_Enter',
  sitIdle: 'Sitting_Idle_Loop',
  standUp: 'Sitting_Exit',
  talk: 'Idle_Talking_Loop',
  sitTalk: 'Sitting_Talking_Loop',
  hitChest: 'Hit_Chest',
  hitHead: 'Hit_Head',
  death: 'Death01',
  tPose: 'A_TPose',
} as const

const ONE_SHOT = new Set<string>([
  COLONIST_ANIMS.jumpStart, COLONIST_ANIMS.jumpLand, COLONIST_ANIMS.pickUp, COLONIST_ANIMS.interact,
  COLONIST_ANIMS.sitDown, COLONIST_ANIMS.standUp, COLONIST_ANIMS.hitChest, COLONIST_ANIMS.hitHead,
  COLONIST_ANIMS.death,
])

function playGroup(groups: AnimationGroup[], name: string, loop?: boolean) {
  const g = groups.find((a) => a.name === name)
  if (!g) {
    console.warn(`colonist animation not found: ${name}`)
    return
  }
  for (const other of groups) if (other !== g) other.stop()
  g.start(loop ?? !ONE_SHOT.has(name))
}

export interface ColonistActor {
  /** Move and turn this node to place the colonist. */
  holder: TransformNode
  /** Switch animation (see COLONIST_ANIMS). One-shots play once, the rest loop. */
  play: (anim: string, loop?: boolean) => void
  dispose: () => void
}

/** Loads one colonist standing at (x, y, z), idling. The model's feet are at the node's origin. */
export async function spawnColonist(scene: Scene, model: ColonistModel, x: number, y: number, z: number): Promise<ColonistActor> {
  const { meshes, animationGroups } = await loadModel(scene, model)
  const holder = new TransformNode(`colonist_${model}`, scene)
  meshes[0].parent = holder
  for (const m of meshes) m.isPickable = false
  holder.position.set(x, y, z)
  const actor: ColonistActor = {
    holder,
    play: (anim, loop) => playGroup(animationGroups, anim, loop),
    dispose: () => {
      for (const g of animationGroups) g.dispose()
      holder.dispose(false, true)
    },
  }
  actor.play(COLONIST_ANIMS.idle)
  return actor
}

/** Showroom helper: loops through every animation of a loaded colonist, a few seconds each. */
export function cycleAnimations(scene: Scene, groups: AnimationGroup[], seconds = 3.5) {
  const names = groups.map((g) => g.name).filter((n) => n !== COLONIST_ANIMS.tPose)
  if (!names.length) return
  let i = 0
  let t = seconds // switch on the first frame
  scene.onBeforeRenderObservable.add(() => {
    t += scene.getEngine().getDeltaTime() / 1000
    if (t < seconds) return
    t = 0
    playGroup(groups, names[i++ % names.length], true)
  })
}
