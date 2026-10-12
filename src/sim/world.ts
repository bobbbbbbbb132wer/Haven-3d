// WHAT THIS FILE DOES
// The world as pure data: what the colony owns, what is unlocked, what is being built.
// RULE: never import Babylon (or touch the DOM) in the sim folder.
import { BUILDINGS } from './buildings'
import { createConstruction, type Construction } from './construction'

export interface World {
  /** What the colony owns, e.g. { wood: 20 }. */
  resources: Record<string, number>
  /** Cost promised to buildings under construction, e.g. { wood: 5 }. Saved with the world. */
  reserved: Record<string, number>
  /** Ids of the buildings the player has unlocked. */
  unlockedBuildings: string[]
  /** Construction sites and finished buildings. */
  construction: Construction
}

export function createWorld(): World {
  return {
    resources: { wood: 20, stone: 3, metal: 0 },
    reserved: {},
    unlockedBuildings: BUILDINGS.filter((b) => b.startsUnlocked).map((b) => b.id),
    construction: createConstruction(),
  }
}
