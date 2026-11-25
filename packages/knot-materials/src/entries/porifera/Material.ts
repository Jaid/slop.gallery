import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {Break, color, float, Fn, If, Loop, mix, mx_noise_float, negateOnBackSide, normalLocal, time, transformNormalToView, vec3, vec4} from 'three/tsl'

import {detail} from '../../candidates/gpt_astra/lib/exhibition/pattern.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const gyroid = Fn(([q]: [Node<'vec3'>]) => q.x.sin().mul(q.y.cos()).add(q.y.sin().mul(q.z.cos())).add(q.z.sin().mul(q.x.cos())))
const gradient = Fn(([q]: [Node<'vec3'>]) => vec3(
  q.x.cos().mul(q.y.cos()).sub(q.z.sin().mul(q.x.sin())),
  q.y.cos().mul(q.z.cos()).sub(q.x.sin().mul(q.y.sin())),
  q.z.cos().mul(q.x.cos()).sub(q.y.sin().mul(q.z.sin())),
))

/** An ivory skin cut through a living gyroid. Bounded local ray traversal exposes glazed inner walls. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {p, view, facing, intimate} = viewerFrame()
    const frequency = 32
    const drift = vec3(time.mul(0.1), time.mul(-0.073), time.mul(0.051))
    const initial = p.mul(frequency).add(drift)
    const opening = gyroid(initial).abs()
    const limit = facing.mul(0.14).add(0.01)
    const intersection = Fn(() => {
      // Hoist shared accessors before any early exit. TSL otherwise initializes its cached
      // geometry normal/view direction inside the loop, leaving immediate shell hits unlit.
      const maximum = limit.toVar()
      const direction = view.toVar()
      const travel = float(0).toVar()
      // |∇G| ≤ 2√3. Conservative advancement cannot jump through a gyroid wall.
      Loop(32, () => {
        const q = p.sub(direction.mul(travel)).mul(frequency).add(drift)
        const distance = gyroid(q).abs().sub(0.57).div(frequency * 3.5)
        If(distance.lessThan(0.00012), () => {
          Break()
        })
        travel.addAssign(distance.max(0.00012))
        If(travel.greaterThan(maximum), () => {
          travel.assign(maximum)
          Break()
        })
      })
      return vec4(p.sub(direction.mul(travel)).mul(frequency).add(drift), travel)
    })()
    const depth = intersection.w
    const wall = depth.smoothstep(0.0002, 0.003)
    const inward = depth.div(0.065).clamp()
    const fineQ = p.mul(230)
    const grain = mx_noise_float(fineQ).mul(detail(fineQ)).mul(intimate)
    const ivory = mix(color(hsl.integer(98, 30, 89)), color(hsl.integer(63, 35, 74)), opening.smoothstep(0.35, 0.7).mul(0.5))
    const glaze = mix(color(hsl.integer(183, 55, 68)), color(hsl.integer(214, 70, 24)), inward)
    this.colorNode = mix(ivory, glaze, wall).mul(grain.mul(0.06).add(1))
    const rawGradient = gradient(intersection.xyz).mul(gyroid(intersection.xyz).sign())
    // A stationary point at the traversal limit has no meaningful cavity normal.
    const safeGradient = rawGradient.dot(rawGradient).greaterThan(1e-10).select(rawGradient, normalLocal)
    const cavityNormal = negateOnBackSide(transformNormalToView(safeGradient.normalize()))
    const shellNormal = proceduralNormal(opening.smoothstep(0.32, 0.67).mul(-0.0012).add(grain.mul(0.00006)), 1)
    this.normalNode = mix(shellNormal, cavityNormal, wall.mul(0.94)).normalize()
    this.metalness = 0.02
    this.roughnessNode = mix(float(0.48), float(0.2), wall)
    this.clearcoatNode = wall.mul(0.8).add(0.12)
    this.clearcoatRoughnessNode = mix(float(0.32), float(0.09), wall)
    this.clearcoatNormalNode = this.normalNode
    this.aoNode = depth.mul(-21).exp().mul(0.8).add(0.2)
    this.emissiveNode = color(hsl.integer(186, 73, 28)).mul(inward).mul(0.035)
  }
}
