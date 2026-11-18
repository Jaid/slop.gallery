import type {Node} from 'three/webgpu'

import {float, Fn, hash, If, mix, mx_noise_float, screenSize, screenUV, select, smoothstep, time, vec2, vec3} from 'three/tsl'
import {Color} from 'three/webgpu'

type Float = Node<'float'>
type Point = readonly [number, number]
// Pigments mixed on the palette, in the display space they will be laid over. Two families cross at the corners: deep blue-greens with pale scumbles and red earths picked out in ocher.
const pigment = (hex: string) => {
  const color = new Color(hex)
  const {r, g, b} = color.convertLinearToSRGB()
  return vec3(r, g, b)
}
const palette = {
  ink: pigment('#254951'),
  lake: pigment('#397b79'),
  jade: pigment('#76aaaa'),
  madder: pigment('#923e38'),
  sienna: pigment('#bd6549'),
  ocher: pigment('#dfa453'),
  linen: pigment('#e4d4ac'),
}
type Paint = keyof typeof palette
/** One sweep in the corner’s local canvas: where the brush lands and lifts, its half width and how far its path bows to the left. All in units of the screen’s short side. */
type Stroke = [start: Point, end: Point, halfWidth: number, bow: number, cool: Paint, warm: Paint]
const strokes: Array<Stroke> = [
  [[-0.045, 0.34], [0.072, -0.045], 0.039, -0.027, 'ink', 'madder'],
  [[0.27, -0.035], [-0.035, 0.16], 0.042, 0.027, 'lake', 'sienna'],
  [[0.008, 0.19], [0.165, 0.013], 0.024, 0.018, 'jade', 'ocher'],
  [[0.096, -0.026], [0.41, 0.019], 0.022, 0.023, 'lake', 'madder'],
  [[-0.018, 0.125], [0.187, 0.006], 0.013, -0.008, 'ocher', 'linen'],
]
/** The bristles in brush space, with x along the gesture (0–1) and y across it (±1 at the edges). The tip travels along the stationary mark, rather than sliding the paint over the image. */
const bristles = Fn(([at, across, phase, pixel]: [Float, Float, Float, Float]) => {
  const u = at.saturate()
  const pressure = u.mul(Math.PI).sin().mul(0.58).add(0.48).sub(u.mul(0.22)).add(u.mul(15).sin().mul(0.045))
  const side = across.div(pressure).add(u.mul(11).sin().mul(0.075))
  const grain = mx_noise_float(vec2(side.mul(12), u.mul(2.5)))
  // Clumps carry distinct loads of pigment. Finer striations vanish below a pixel at low render scales.
  const clump = mx_noise_float(vec2(side.mul(3.8), u.mul(1.8)))
  const furrow = clump.mul(0.5).add(grain.mul(0.8)).add(mx_noise_float(vec2(side.mul(29), u.mul(5))).mul(0.35).mul(smoothstep(0.01, 0.055, pixel).oneMinus()))
  const load = float(1).sub(u.mul(0.45)).sub(side.abs().pow2().mul(0.49)).add(furrow.mul(0.42))
  // The loaded belly lays down a solid swath. Toward its edge and lifted tail, individual hairs start to skip.
  const edges = smoothstep(pixel.negate(), pixel, pressure.sub(across.abs()).add(grain.mul(0.072)))
  const laid = smoothstep(0, 0.39, phase)
  const tip = laid.sub(at).sub(side.pow2().mul(0.022)).add(furrow.mul(0.042))
  const ends = smoothstep(0, 0.016, tip).mul(smoothstep(0, 0.025, at.add(furrow.mul(0.025))))
  // Let the old mark break back into streaks before the brush comes around again.
  const dry = smoothstep(0.58, 0.98, phase)
  const ink = smoothstep(0, 0.2, load.sub(dry.mul(1.7))).mul(edges).mul(ends).mul(dry.oneMinus()).mul(smoothstep(0, 0.035, phase))
  // A bead of newly deposited paint catches the light just behind the moving tips; it subsides where the brush lifts.
  const bead = smoothstep(0, 0.015, tip).mul(smoothstep(0.018, 0.055, tip).oneMinus()).mul(smoothstep(0.31, 0.4, phase).oneMinus())
  return vec3(ink, furrow, bead)
}, {
  at: 'float',
  across: 'float',
  phase: 'float',
  pixel: 'float',
  return: 'vec3',
})

export default Fn(([frame]: [Node<'vec3'>]) => {
  const painted = frame.toVar()
  const short = screenSize.x.min(screenSize.y)
  const inward = screenUV.min(screenUV.oneMinus()).mul(screenSize).div(short)
  // A broken ground of long, shallow strokes joins the denser gestures at the corners. Two offset courses keep some wet paint while the neighboring brush lifts.
  for (const horizontal of [true, false]) {
    const depth = horizontal ? inward.y : inward.x
    If(depth.lessThan(0.09), () => {
      const along = (horizontal ? screenUV.x.mul(screenSize.x) : screenUV.y.mul(screenSize.y)).div(short)
      const far = (horizontal ? screenUV.y : screenUV.x).greaterThan(0.5)
      for (const course of [0, 1]) {
        const cell = along.div(course ? 0.46 : 0.59).add(course ? 0.68 : 0.15)
        const seed = cell.floor().add(float(far).mul(113)).add(course * 31 + (horizontal ? 5 : 61))
        const at = select(hash(seed).greaterThan(0.5), cell.fract(), cell.fract().oneMinus())
        const width = hash(seed.add(91)).mul(0.018).add(course ? 0.012 : 0.024)
        const bow = at.mul(Math.PI).sin().mul(0.026).add(at.mul(hash(seed.add(7)).sub(0.5)).mul(0.05))
        const across = depth.sub(bow).add(0.016).div(width)
        const mark = bristles(at, across, time.div(6 + course).add(hash(seed.add(17))).fract(), width.mul(short).reciprocal())
        const side = horizontal ? screenUV.x : screenUV.y
        const warm = select(far, side.oneMinus(), side)
        const base = mix(course ? palette.lake : palette.ink, course ? palette.sienna : palette.madder, warm)
        painted.assign(mix(painted, mix(base, palette.linen, mark.z.mul(0.25)).mul(mark.y.mul(0.24).add(1)), mark.x.mul(smoothstep(0, 0.035, at.min(at.oneMinus()))).mul(course ? 0.58 : 0.67)))
      }
    })
  }
  // Reflect the gestures into the corners but turn, scale and reload the brush differently at each. The center stays completely untouched.
  If(inward.x.max(inward.y).lessThan(0.49).and(inward.x.min(inward.y).lessThan(0.22)), () => {
    const right = screenUV.x.greaterThan(0.5)
    const bottom = screenUV.y.greaterThan(0.5)
    const turned = right.xor(bottom)
    const point = select(turned, inward.yx, inward).mul(select(bottom, vec2(1.14, 0.93), vec2(1, 1)))
    const corner = float(right).add(float(bottom).mul(2))
    for (const [[ax, ay], [bx, by], width, bow, cool, warm] of strokes) {
      const dx = bx - ax
      const dy = by - ay
      const length = Math.hypot(dx, dy)
      const offset = point.sub(vec2(ax, ay))
      const at = offset.dot(vec2(dx, dy)).div(length * length)
      const bend = at.saturate().mul(Math.PI).sin().mul(bow)
      const across = offset.dot(vec2(-dy / length, dx / length)).sub(bend).div(width)
      // Do not shade canvas that the brush cannot reach.
      If(at.greaterThan(-0.04).and(at.lessThan(1.04)).and(across.abs().lessThan(1.25)), () => {
        const phase = time.div(4.2 + width * 58).add(corner.mul(0.231)).add(length * 11).fract()
        const mark = bristles(at, across, phase, float(0.8 / width).div(short))
        const paint = select(turned, palette[warm], palette[cool])
        // Lighter strands of pigment combed through the brush, with a highlight on the loaded ridges.
        const tint = mix(paint, palette.linen, smoothstep(0.1, 0.8, mark.y.add(across.mul(0.22))).mul(0.46).add(mark.z.mul(0.26)))
        painted.assign(mix(painted, tint.mul(mark.y.mul(0.25).add(0.93)), mark.x.mul(0.92)))
      })
    }
  })
  return painted
})
