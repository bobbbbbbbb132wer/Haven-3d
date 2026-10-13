// WHAT THIS FILE DOES
// Draws the colony status board (day, time, day/night bar, resources, colony and world stats) onto
// a canvas. Called a few times per second, and only while the camera is near the showroom.
import type { World } from '../sim/world'
import { RESOURCES, BUILDINGS } from '../sim/buildings'
import { trendPerMin } from '../sim/resources'
import { clockText, dayFraction, dayNumber, phaseName, sunHeight } from '../sim/clock'

export const STATS_W = 1024
export const STATS_H = 512

export interface ExtraStats {
  fps: number
  seed: number
  size: number
  chunks: number
  buildablePct: number
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function drawStats(ctx: CanvasRenderingContext2D, world: World, ex: ExtraStats) {
  const W = STATS_W
  const H = STATS_H
  const f = dayFraction(world.clock)
  const isDay = sunHeight(f) > 0
  const FONT = 'Roboto, system-ui, sans-serif'

  // background + frame
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#18262f')
  bg.addColorStop(1, '#0d151b')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#7ec8a0'
  ctx.lineWidth = 6
  round(ctx, 4, 4, W - 8, H - 8, 18)
  ctx.stroke()

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#7ec8a0'
  ctx.font = `bold 34px ${FONT}`
  ctx.fillText('HAVEN  ·  COLONY STATUS', 32, 56)

  // day + time + phase
  ctx.fillStyle = '#e8edf2'
  ctx.font = `bold 78px ${FONT}`
  ctx.fillText(`Day ${dayNumber(world.clock)}`, 32, 150)
  ctx.font = `bold 78px ${FONT}`
  ctx.fillText(clockText(world.clock), 330, 150)
  ctx.fillStyle = isDay ? '#ffd166' : '#9db4ff'
  ctx.font = `bold 34px ${FONT}`
  ctx.fillText(phaseName(f), 610, 120)
  ctx.fillStyle = '#9aa7b5'
  ctx.font = `22px ${FONT}`
  ctx.fillText(world.clock.scale === 1 ? 'normal speed (N = fast time)' : `fast time x${world.clock.scale}`, 610, 150)

  // sun / moon icon
  const ix = 940
  const iy = 100
  if (isDay) {
    ctx.fillStyle = '#ffd166'
    ctx.beginPath(); ctx.arc(ix, iy, 26, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 5
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * 36, iy + Math.sin(a) * 36); ctx.lineTo(ix + Math.cos(a) * 48, iy + Math.sin(a) * 48); ctx.stroke()
    }
  } else {
    ctx.fillStyle = '#c9d6ff'
    ctx.beginPath(); ctx.arc(ix, iy, 30, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#0f1822'
    ctx.beginPath(); ctx.arc(ix + 14, iy - 8, 26, 0, Math.PI * 2); ctx.fill()
  }

  // 24-hour bar: dark = night, yellow = day, white line = now
  const bx = 32
  const by = 186
  const bw = W - 64
  const bh = 26
  ctx.fillStyle = '#0b1230'
  ctx.fillRect(bx, by, bw, bh)
  ctx.fillStyle = '#e6b84a'
  ctx.fillRect(bx + bw * 0.25, by, bw * 0.5, bh)
  ctx.fillStyle = '#e8edf2'
  ctx.fillRect(bx + bw * f - 3, by - 8, 6, bh + 16)
  ctx.fillStyle = '#9aa7b5'
  ctx.font = `18px ${FONT}`
  ctx.textAlign = 'center'
  for (const [h, label] of [[0, '00'], [6, '06'], [12, '12'], [18, '18'], [24, '24']] as const) {
    ctx.fillText(label, bx + (bw * h) / 24, by + bh + 22)
  }
  ctx.textAlign = 'left'

  // three columns
  const colY = 276
  const heading = (text: string, x: number) => {
    ctx.fillStyle = '#7ec8a0'
    ctx.font = `bold 26px ${FONT}`
    ctx.fillText(text, x, colY)
  }
  const row = (label: string, value: string, x: number, i: number, valueX: number) => {
    const y = colY + 44 + i * 40
    ctx.fillStyle = '#9aa7b5'
    ctx.font = `24px ${FONT}`
    ctx.fillText(label, x, y)
    ctx.fillStyle = '#e8edf2'
    ctx.font = `bold 26px ${FONT}`
    ctx.fillText(value, valueX, y)
  }

  heading('RESOURCES', 32)
  let i = 0
  for (const [id, def] of Object.entries(RESOURCES)) {
    const stored = Math.floor(world.resources[id] ?? 0)
    const res = world.reserved[id] ?? 0
    const trend = trendPerMin(id)
    const y = colY + 44 + i * 40
    ctx.fillStyle = '#e8edf2'
    ctx.font = `26px ${FONT}`
    ctx.fillText(`${def.icon} ${def.name}`, 32, y)
    ctx.font = `bold 28px ${FONT}`
    ctx.fillText(String(stored), 190, y)
    ctx.fillStyle = '#9aa7b5'
    ctx.font = `20px ${FONT}`
    ctx.fillText(`${res ? res + ' reserved  ' : ''}${trend >= 0.05 ? '+' : ''}${Math.abs(trend) < 0.05 ? '0' : trend.toFixed(1)}/min`, 250, y)
    i++
  }

  const con = world.construction
  const sites = con.sites.length
  heading('COLONY', 400)
  row('Colonists', '0', 400, 0, 580) // TODO: world.colonists.length once colonists exist
  row('Buildings', String(con.built.length), 400, 1, 580)
  row('Building now', String(sites), 400, 2, 580)
  row('Unlocked', `${world.unlockedBuildings.length}/${BUILDINGS.length}`, 400, 3, 580)

  heading('WORLD', 700)
  row('Seed', String(ex.seed), 700, 0, 860)
  row('Size', `${ex.size}x${ex.size} m`, 700, 1, 860)
  row('Chunks', String(ex.chunks), 700, 2, 860)
  row('Buildable', `${ex.buildablePct}%`, 700, 3, 860)
  ctx.fillStyle = '#9aa7b5'
  ctx.font = `20px ${FONT}`
  ctx.fillText(`${Math.round(ex.fps)} FPS`, 700, colY + 44 + 4 * 40)
}
