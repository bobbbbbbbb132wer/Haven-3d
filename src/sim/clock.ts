// WHAT THIS FILE DOES
// The game clock: day number and time of day. Pure numbers, no 3D.
// One game day lasts DAY_SECONDS of real time at normal speed (scale 1).
export const DAY_SECONDS = 240
export const START_HOUR = 8

export interface Clock {
  /** Game seconds since day 1, 00:00 (already includes the speed scale). */
  seconds: number
  /** 1 = normal speed. Press N in the game to toggle fast time for testing. */
  scale: number
}

export const createClock = (): Clock => ({ seconds: (START_HOUR / 24) * DAY_SECONDS, scale: 1 })

export function advanceClock(c: Clock, dtSeconds: number) {
  c.seconds += dtSeconds * c.scale
}

export const dayNumber = (c: Clock) => Math.floor(c.seconds / DAY_SECONDS) + 1

/** 0 = midnight, 0.25 = 06:00, 0.5 = noon, 0.75 = 18:00. */
export const dayFraction = (c: Clock) => (c.seconds % DAY_SECONDS) / DAY_SECONDS

export function clockText(c: Clock): string {
  const mins = Math.floor(dayFraction(c) * 24 * 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** -1 (midnight) .. +1 (noon). Zero at 06:00 sunrise and 18:00 sunset. */
export const sunHeight = (f: number) => -Math.cos(f * Math.PI * 2)

export function phaseName(f: number): string {
  const h = f * 24
  if (h < 5 || h >= 19) return 'Night'
  if (h < 7) return 'Dawn'
  if (h < 11) return 'Morning'
  if (h < 15) return 'Midday'
  if (h < 17) return 'Afternoon'
  return 'Dusk'
}
