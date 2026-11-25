import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, Fn, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time, uv, vec2, vec3} from 'three/tsl'

import {filteredBox} from '../../candidates/claude_opus/lib/filteredBox.ts'
import {knotFrame} from '../../candidates/claude_opus/lib/knotFrameSurface.ts'
import {knotCircumference, knotLength, knotTubeRadius, tubeMetric, tubeTurns} from '../../candidates/claude_opus/lib/tubeMetric.ts'
import {wrap, wrapCentered} from '../../candidates/claude_opus/lib/wrap.ts'
import {knotCurve} from '../../lib/knotCurve.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Turns of the bamboo spiral that holds the paper, as in a chōchin; whole turns keep the seam closed. */
const ribTurns = 118
/** Paper strips glued edge to edge along the lantern. */
const strips = 7
/** Candles along the lantern; each lights its own warm pool. */
const candles = 6
/** Radius of the glowing flame core, which sets how quickly a shadow softens with depth. */
const flameRadius = 0.012
type Koi = {
  along: number
  around: number
  depth: number
  drift: number
  length: number
  phase: number
  speed: number
}
/** A seeded school spread evenly along the lantern, so every view holds a few fish at different depths. */
const school: Array<Koi> = Array.from({length: 14}, (_, index) => {
  const random = (salt: number) => {
    const x = Math.sin(index * 127.1 + salt * 311.7) * 43_758.5453
    return x - Math.floor(x)
  }
  return {
    along: (index + random(1) * 0.6) / 14 * 7.18,
    around: random(2),
    depth: 0.58 + random(3) * 0.36,
    drift: 0.05 + random(4) * 0.09,
    length: 0.15 + random(5) * 0.09,
    phase: random(6) * Math.PI * 2,
    speed: (random(7) < 0.5 ? -1 : 1) * (0.035 + random(8) * 0.025),
  }
})
/** Soft coverage of a signed distance, blurred over `blur` (in the same units). */
const soft = (distance: Node<'float'>, blur: Node<'float'>) => distance.smoothstep(blur.negate(), blur).oneMinus()
/** An ellipse’s approximate signed distance, rotated by `angle`. */
const ellipse = (q: Node<'vec2'>, center: [number, number], radii: [number, number], angle: number, scale: Node<'float'>) => {
  const d = q.sub(vec2(...center))
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const local = vec2(d.x.mul(c).add(d.y.mul(s)), d.y.mul(c).sub(d.x.mul(s))).div(vec2(...radii).mul(scale))
  return local.length().sub(1).mul(Math.min(...radii))
}
/** A koi seen from above, in body lengths: x runs from the snout (0) to the tail root (1), y across. Returns the soft coverage of the opaque body and of the translucent fins. */
const koiShape = Fn(([q, blur, phase]: [Node<'vec2'>, Node<'float'>, Node<'float'>]) => {
  const x = q.x
// A traveling wave swings the rear of the body; the head barely moves.
  const amplitude = x.add(0.1).max(0).pow2().mul(0.085)
  const spine = phase.sub(x.mul(5.2)).sin().mul(amplitude)
  const y = q.y.sub(spine)
// Blunt round head, broadest at a third, tapering to a slender peduncle.
  const head = x.sub(0.3).div(0.3).pow2().oneMinus().max(0).sqrt()
  const taper = x.sub(0.3).div(0.7).clamp().oneMinus().pow(0.75).mul(0.9).add(0.1)
  const halfWidth = x.lessThan(0.3).select(head, taper).mul(0.155).mul(x.smoothstep(-0.02, 0.02)).mul(x.smoothstep(0.98, 1.02).oneMinus())
  const body = soft(y.abs().sub(halfWidth), blur)
// The caudal fin opens like a fan and is forked at the trailing edge; it flutters with the stroke.
  const t = x.sub(0.9).div(0.4)
  const flutter = phase.mul(2).sin().mul(0.12).add(1)
  const fan = soft(y.abs().sub(t.clamp().mul(0.2).mul(flutter).add(0.02)), blur).mul(soft(t.sub(1).max(t.negate()), blur))
  const fork = soft(y.abs().sub(t.sub(0.6).max(0).mul(0.45)), blur).mul(t.smoothstep(0.6, 0.7))
  const tail = fan.mul(fork.oneMinus())
// Paddle-like pectoral fins and small pelvic fins, sculling slowly.
  const scull = phase.mul(0.6).sin().mul(0.18).add(0.9)
  let fins = tail
  for (const side of [-1, 1]) {
    fins = fins.max(soft(ellipse(vec2(x, y), [0.36, side * 0.17], [0.11, 0.045], side * 0.75, scull), blur))
    fins = fins.max(soft(ellipse(vec2(x, y), [0.62, side * 0.09], [0.06, 0.022], side * 0.6, scull), blur))
  }
  return vec2(body, fins.mul(body.oneMinus()))
})
/** A washi chōchin lit by candles, with koi circling inside. Their shadows on the paper sharpen as they rise toward it, the far wall shows faintly through the near one, and the school drifts toward a visitor who comes close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.35)
    this.name = knotData.id
    const tube = uv()
    const {p, cameraLocal, view, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const metric = tubeMetric(tube)
    const s = metric.x
    const turns = tubeTurns(tube)
    const frame = knotFrame(tube)
// The far wall as seen through this point of paper: the exit of the view ray across the tube’s cross-section.
    const viewAcross = view.sub(frame.along.mul(view.dot(frame.along)))
    const chord = n.dot(view).mul(2 * knotTubeRadius).div(viewAcross.dot(viewAcross).max(0.08)).min(0.5)
    const exit = p.sub(view.mul(chord)).sub(frame.center)
    const exitNormal = exit.sub(frame.along.mul(exit.dot(frame.along))).normalize()
    const farTurns = turns.add(atan(exitNormal.dot(frame.around), exitNormal.dot(frame.normal)).div(TAU))
    const farS = s.sub(view.dot(frame.along).mul(chord))
// Footprint of one pixel on the paper, in world units, so a crisp shadow never aliases.
    const footprint = metric.fwidth().length().max(0.0002)
    const shadows = (wallS: Node<'float'>, wallTurns: Node<'float'>, extraBlur: Node<'float'> | number) => {
      let shade: Node<'vec3'> = vec3(1)
      let finLight: Node<'float'> = float(0)
      for (const [index, koi] of school.entries()) {
// Where the fish is now: swimming along the lantern, meandering around it and slowly rising and diving.
        const wander = time.mul(0.23 + index * 0.017).add(koi.phase)
        const fishS = time.mul(koi.speed).add(koi.along)
        const fishU = fishS.div(knotLength)
// Where a close visitor stands, as an angle around the tube at this fish: the school gathers there, rising toward the paper.
        const curveAngle = fishU.mul(TAU * 2)
        const axis = knotCurve(curveAngle)
        const ahead = knotCurve(curveAngle.add(0.01))
        const tangent = ahead.sub(axis)
        const binormal = tangent.cross(ahead.add(axis)).normalize()
        const frameNormal = binormal.cross(tangent).normalize()
        const toViewer = cameraLocal.sub(axis)
        const viewerTurns = tubeTurns(vec2(fishU, atan(toViewer.dot(binormal), toViewer.dot(frameNormal).negate()).div(TAU)))
        const curiosity = intimate.mul(0.75)
        const roaming = wander.sin().mul(koi.drift).add(koi.around)
        const fishTurns = roaming.add(wrapCentered(viewerTurns.sub(roaming), 1).mul(curiosity))
        const depth = mix(time.mul(0.31 + index * 0.023).add(koi.phase * 1.7).sin().mul(0.16).add(koi.depth - 0.08).clamp(0.5, 0.96), float(0.93), curiosity)
// Shadows are cast from the axis, so a deeper fish throws a larger and softer shadow.
        const magnification = depth.reciprocal()
        const blur = depth.reciprocal().sub(1).mul(flameRadius).add(extraBlur).add(footprint)
        const heading = vec2(koi.speed, wander.cos().mul(koi.drift * (0.23 + index * 0.017) * knotCircumference)).normalize()
        const offset = vec2(wrapCentered(wallS.sub(fishS), knotLength), wrapCentered(wallTurns.sub(fishTurns), 1).mul(knotCircumference))
        const scale = magnification.mul(koi.length)
        const q = vec2(offset.dot(heading).negate().div(scale).add(0.4), offset.x.mul(heading.y).sub(offset.y.mul(heading.x)).div(scale))
        const stroke = time.mul(Math.abs(koi.speed) * 95).add(koi.phase)
        const coverage = koiShape(q, blur.div(scale), stroke)
// Shallow fish cast deep shadows; deep ones only dim the paper.
        const darkness = depth.smoothstep(0.45, 0.95).mul(0.25).add(0.7)
// Koi are not fully opaque: hi (red) patches pass red light, sumi (black) blocks it and ogon gold passes amber, so the shadows carry their markings.
        const varieties = [[0.62, 0.1, 0.03], [0.85, 0.5, 0.12], [0.04, 0.03, 0.03]] as const
        const variety = varieties[index % 3]
        const markings = mx_noise_float(vec3(q.mul(vec2(4.2, 8)), index * 3.1)).add(q.x.sub(0.45).mul(0.6))
        const patch = markings.smoothstep(-0.05, 0.08).mul(index % 3 === 2 ? 0.75 : 1)
        const bodyPass = mix(vec3(0.07, 0.05, 0.04), vec3(...variety), patch).mul(blur.div(scale).smoothstep(0.03, 0.25).oneMinus())
        const occlusion = vec3(1).sub(bodyPass).mul(coverage.x).mul(darkness)
        shade = shade.mul(vec3(1).sub(occlusion)).mul(coverage.y.mul(darkness).mul(0.45).oneMinus())
        finLight = finLight.add(coverage.y)
      }
      return {
        shade,
        finLight: finLight.clamp(),
      }
    }
    const nearWall = shadows(s, turns, 0)
    const farWall = shadows(farS, farTurns, 0.012)
// Washi: a cloudy formation of kozo fibers, glued in overlapping strips over a bamboo spiral. Texture lives in object space, so it has no seam.
    const cloud = mx_fractal_noise_float(p.mul(14), 3, 2, 0.55).mul(0.5).add(0.5)
    let fibers: Node<'float'> = float(0)
    for (const [index, axis] of [[0.8, 0.3, -0.5], [-0.2, 0.9, 0.4], [0.5, -0.4, 0.77]].entries()) {
// Fibers are long noise ridges: stretched 13× along a fixed direction in the paper.
      const direction = vec3(...axis).normalize()
      const stretched = p.add(direction.mul(p.dot(direction).mul(-0.92)))
      const field = mx_noise_float(stretched.mul(330).add(index * 7.3))
      const width = field.fwidth().max(0.001)
      fibers = fibers.add(field.abs().smoothstep(0, width.add(0.06)).oneMinus().mul(width.smoothstep(0.08, 0.35).oneMinus()))
    }
    const ribCoord = s.mul(ribTurns / knotLength).add(turns)
    const ribFootprint = ribCoord.fwidth()
    const rib = filteredBox(ribCoord.fract().sub(0.5), 0.045, ribFootprint)
    const ribHalo = ribCoord.fract().sub(0.5).div(0.12).pow2().negate().exp().mul(ribFootprint.smoothstep(0.2, 0.5).oneMinus())
    const seamCoord = turns.mul(strips)
    const seam = filteredBox(seamCoord.fract().sub(0.5), 0.035, seamCoord.fwidth())
// Thicker paper passes less light and redder light; seen edge-on, the path through the paper lengthens.
    const thickness = cloud.mul(0.45).add(fibers.mul(0.35)).add(seam.mul(0.6)).add(0.6).div(facing.max(0.2).sqrt())
    const transmittance = vec3(thickness.mul(-0.12).exp(), thickness.mul(-0.38).exp(), thickness.mul(-0.95).exp())
// Six candles, each flickering on its own, light pools along the lantern.
    const pool = s.mul(TAU * candles / knotLength).cos().mul(0.5).add(0.5)
// Each candle flickers on its own; its identity wraps with the knot, so the seam candle is one flame.
    const candleIndex = wrap(s.mul(candles / knotLength).add(0.5).floor(), candles)
    const flicker = mx_noise_float(vec3(time.mul(3.1), candleIndex, 0)).mul(0.07).add(mx_noise_float(p.mul(2).add(vec3(time.mul(11), 0, 3))).mul(0.03)).add(1)
    const candle = color(hsl.integer(70, 100, 83)).mul(pool.pow2().mul(0.45).add(0.75)).mul(flicker)
// The far wall reaches the eye only through the near paper: softened, dimmed and warmed.
    const through = mix(float(1), farWall.shade, facing.mul(0.6).add(0.15))
    const shade = nearWall.shade.mul(through).mul(rib.mul(0.85).oneMinus()).mul(ribHalo.mul(0.18).oneMinus())
// Fins are thin enough to glow amber where the light shines through them.
    const finGlow = color(hsl.integer(43, 100, 65.3)).mul(nearWall.finLight).mul(0.25)
    const glow = candle.mul(transmittance).mul(shade).add(finGlow.mul(transmittance))
    this.colorNode = mix(color(hsl.integer(74, 27, 41)), color(hsl.integer(61, 49, 15)), rib.mul(0.7))
    this.metalness = 0
    this.roughnessNode = mix(float(0.88), float(0.5), rib)
    this.sheenNode = color(hsl.integer(80, 100, 95.4)).mul(0.18)
    this.sheenRoughness = 0.6
// The paper sags a little between ribs and puckers along the fibers.
    const sag = ribCoord.fract().sub(0.5).mul(TAU).cos().mul(ribFootprint.smoothstep(0.15, 0.4).oneMinus()).mul(0.0007)
    this.normalNode = proceduralNormal(sag.add(fibers.mul(0.00012).mul(near)).add(cloud.mul(0.0002)), 1)
    this.emissiveNode = glow.mul(0.62).add(color(hsl.integer(78, 100, 89)).mul(grazing.pow(5)).mul(0.08))
  }
}
