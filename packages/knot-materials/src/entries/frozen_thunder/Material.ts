import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, Fn, Loop, mix, mx_noise_float, mx_noise_vec3, normalLocal, positionGeometry, vec2, vec3, vec4} from 'three/tsl'

import {glitter} from '../../candidates/claude_sonnet/lib/glitter.ts'
import {loopTurn} from '../../candidates/claude_sonnet/lib/loopClock.ts'
import {rgb} from '../../candidates/claude_sonnet/lib/rgb.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const steps = 40
/** Depth the march reaches into the glass, in object units – a little more than the tube's radius. */
const reach = 0.26
/** Distance to a curve made from the intersection of two noise sheets; zero exactly on the curve. */
function curve(q: Node<'vec3'>, frequency: number, offset: number) {
  const s = q.mul(frequency).add(offset)
  const a = mx_noise_float(s)
  const b = mx_noise_float(s.add(vec3(17.3, -4.1, 9.2)))
  return vec2(a, b).length()
}
/** One sample of the frozen discharge. A trunk, its branches and their twigs are three nested scales of the same curve; each finer scale only grows near the coarser one, which is what gives a Lichtenberg figure its fractal look. `pulse` is a smooth arrival-time field, so a bright front can run outward along every path at once. x = trunk, y = branch, z = twig, w = pulse. */
const discharge = Fn(([q]: [Node<'vec3'>]) => {
  const warped = q.add(mx_noise_vec3(q.mul(2.3)).mul(0.2))
  const jag = mx_noise_float(q.mul(11)).mul(0.05)
  const trunkDistance = curve(warped, 2.5, 0).add(jag)
  const trunk = trunkDistance.div(0.045).pow2().negate().exp()
  const nearTrunk = trunkDistance.smoothstep(0.08, 0.55).oneMinus()
  const branchDistance = curve(warped.add(jag), 6.4, 31).add(mx_noise_float(q.mul(23)).mul(0.035))
  const branch = branchDistance.div(0.036).pow2().negate().exp().mul(nearTrunk)
  const nearBranch = branchDistance.smoothstep(0.06, 0.45).oneMinus().mul(nearTrunk.mul(0.75).add(0.25))
  const twigDistance = curve(warped.add(jag.mul(2)), 15, 77).add(mx_noise_float(q.mul(47)).mul(0.03))
  const twig = twigDistance.div(0.03).pow2().negate().exp().mul(nearBranch)
  const arrival = mx_noise_float(q.mul(1.7).add(5.5)).mul(0.5).add(0.5).add(trunkDistance.mul(0.35))
  return vec4(trunk, branch, twig, arrival)
})
const ramp = {
  core: rgb(hsl.integer(298, 100, 96)),
  hot: rgb(hsl.integer(292, 100, 62.3)),
  cold: rgb(hsl.integer(266, 100, 48)),
  deep: rgb(hsl.integer(266, 95, 18)),
}
/** A block of black glass with a Lichtenberg figure trapped inside. The figure is a real volume: the eye marches through the tube along a refracted ray, so branches at different depths slide against each other as you move and cross without ever sitting on the surface. A slow front of light travels outward through the branches, and finer twigs only ignite as you approach. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const p = positionGeometry
    const {view, facing, grazing, near, intimate, rim} = viewerFrame()
    const inward = normalLocal.normalize().negate()
// Snell's law compressed: the ray leans toward the inward normal, so the figure appears magnified and shifts with the viewpoint.
    const direction = view.negate().mul(0.66).add(inward.mul(0.34)).normalize()
    const twigGain = near.mul(0.55).add(intimate.mul(0.6)).add(0.18)
    const march = Fn(() => {
      const glow = vec3(0).toVar()
      const haze = float(0).toVar()
      Loop(steps, ({i}) => {
        const t = float(i).add(0.5).div(steps)
        const depth = t.mul(reach)
        const q = p.add(direction.mul(depth))
        const field = discharge(q)
        const fade = depth.mul(-4.2).exp()
        const front = field.w.mul(3.2).sub(loopTurn).fract()
        const pulse = front.smoothstep(0, 0.06).mul(front.smoothstep(0.06, 0.34).oneMinus()).mul(1.9).add(0.28)
        const density = field.x.mul(1.6).add(field.y.mul(1.1)).add(field.z.mul(twigGain))
        const color = mix(mix(ramp.cold, ramp.hot, field.y.max(field.z).clamp()), ramp.core, field.x.pow(3).mul(pulse.mul(0.4)).clamp())
        glow.addAssign(color.mul(density).mul(pulse).mul(fade))
        haze.addAssign(density.mul(fade))
      })
      return vec4(glow.div(steps).mul(9.5), haze.div(steps))
    })()
    const figure = march.xyz
    const haze = march.w
    const sparkle = glitter(p, 0.011, 90, 0.5).sparkle
    this.colorNode = mix(rgb(hsl.integer(272, 50, 3)), rgb(hsl.integer(273, 68, 7)), grazing.pow(2))
    this.metalness = 0
    this.roughness = 0.03
    this.ior = 1.5
    this.clearcoat = 1
    this.clearcoatRoughness = 0.012
    this.iridescence = 0.25
    this.iridescenceIOR = 1.25
    this.iridescenceThicknessMinimum = 180
    this.iridescenceThicknessMaximum = 420
    this.emissiveNode = figure.mul(facing.mul(0.25).add(0.85))
      .add(ramp.deep.mul(haze.pow(1.5)).mul(1.6))
      .add(ramp.hot.mul(sparkle).mul(haze.mul(4).min(1)).mul(intimate).mul(0.4))
      .add(ramp.cold.mul(rim).mul(0.06))
  }
}
