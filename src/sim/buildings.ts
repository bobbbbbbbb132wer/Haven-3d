// WHAT THIS FILE DOES
// The list of everything the player can build, plus helpers to check
// "is it unlocked?" and "can we afford it?". Pure data, no 3D in here.
// To add a building: add one line to BUILDINGS below.
import type { World } from './world'
import { availableOf } from './resources'

export interface ResourceDef {
  name: string
  /** Emoji placeholder until real icons exist. */
  icon: string
}

export const RESOURCES: Record<string, ResourceDef> = {
  wood: { name: 'Wood', icon: '🪵' },
  stone: { name: 'Stone', icon: '🪨' },
  metal: { name: 'Metal', icon: '⚙️' },
}

export interface BuildingDef {
  id: string
  name: string
  /** Emoji placeholder until real icons exist. */
  icon: string
  /** What it costs, e.g. { wood: 5 }. */
  cost: Record<string, number>
  /** Unlocked from the start of the game? */
  startsUnlocked?: boolean
  /** Shown in the tooltip while it is still locked. */
  unlockHint?: string
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'campfire', name: 'Campfire', icon: '🔥', cost: { wood: 5 }, startsUnlocked: true },
  { id: 'torch', name: 'Torch', icon: '🕯️', cost: { wood: 2 }, startsUnlocked: true },
  { id: 'tent', name: 'Tent', icon: '⛺', cost: { wood: 10 }, startsUnlocked: true },
  { id: 'bed', name: 'Bed', icon: '🛏️', cost: { wood: 12 }, startsUnlocked: true },
  { id: 'crate', name: 'Storage Crate', icon: '📦', cost: { wood: 15 }, startsUnlocked: true },
  { id: 'woodwall', name: 'Wooden Wall', icon: '🟫', cost: { wood: 6 }, startsUnlocked: true },
  { id: 'door', name: 'Door', icon: '🚪', cost: { wood: 8 }, startsUnlocked: true },
  {
    id: 'workbench',
    name: 'Workbench',
    icon: '🔨',
    cost: { wood: 20, stone: 5 },
    startsUnlocked: true,
  },
  { id: 'stonewall', name: 'Stone Wall', icon: '🧱', cost: { stone: 10 }, startsUnlocked: true },
  { id: 'farm', name: 'Farm Plot', icon: '🌱', cost: { wood: 5 }, unlockHint: 'Research: Farming' },
  {
    id: 'well',
    name: 'Well',
    icon: '🪣',
    cost: { wood: 10, stone: 25 },
    unlockHint: 'Research: Water Works',
  },
  {
    id: 'stove',
    name: 'Stove',
    icon: '🍳',
    cost: { stone: 10, metal: 10 },
    unlockHint: 'Needs a Workbench',
  },
  {
    id: 'forge',
    name: 'Forge',
    icon: '⚒️',
    cost: { stone: 40, metal: 10 },
    unlockHint: 'Research: Metalworking',
  },
  {
    id: 'tower',
    name: 'Watchtower',
    icon: '🗼',
    cost: { wood: 40, stone: 20 },
    unlockHint: 'Research: Defense',
  },
]

export function isUnlocked(world: World, id: string) {
  return world.unlockedBuildings.includes(id)
}

export function canAfford(world: World, def: BuildingDef) {
  return Object.entries(def.cost).every(([resource, need]) => availableOf(world, resource) >= need)
}
