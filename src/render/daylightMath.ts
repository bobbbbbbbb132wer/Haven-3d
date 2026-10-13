// WHAT THIS FILE DOES
// Works out sun, moon and sky settings for a time of day. Pure maths (no 3D library).
import { smoothstep } from '../sim/noise'
import { sunHeight } from '../sim/clock'

type RGB = [number, number, number]
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const SKY_NIGHT: RGB = [0.02, 0.03, 0.09]
const SKY_DAY: RGB = [0.55, 0.75, 0.95]
const SKY_DUSK: RGB = [0.92, 0.5, 0.32]

export interface Lighting {
  /** 0 = night, 1 = full day. */
  day: number
  sky: RGB
  ambient: number
  ambientColor: RGB
  sunIntensity: number
  sunColor: RGB
  /** Direction the sunlight travels (sun to ground). */
  sunDir: RGB
  moonIntensity: number
  moonDir: RGB
}

export function lightingFor(f: number): Lighting {
  const s = sunHeight(f)
  const day = smoothstep(-0.12, 0.3, s)
  const twilight = Math.exp(-Math.pow(s / 0.22, 2)) // strongest at sunrise and sunset
  const ang = (f - 0.25) * Math.PI * 2 // 0 = sunrise in the east, PI/2 = noon, PI = sunset
  const px = Math.cos(ang)
  const py = Math.sin(ang)
  const pz = 0.35
  const len = Math.hypot(px, py, pz)
  const p: RGB = [px / len, py / len, pz / len] // sun position (unit)
  return {
    day,
    sky: mix(mix(SKY_NIGHT, SKY_DAY, day), SKY_DUSK, twilight * 0.55),
    ambient: lerp(0.24, 0.65, day),
    ambientColor: mix([0.55, 0.62, 0.95], [1, 1, 1], day),
    sunIntensity: 0.55 * smoothstep(0, 0.25, s),
    sunColor: mix([1, 0.96, 0.88], [1, 0.55, 0.3], twilight),
    sunDir: [-p[0], -p[1], -p[2]],
    moonIntensity: 0.3 * (1 - day),
    moonDir: [p[0], p[1], p[2]], // the moon sits opposite the sun
  }
}
