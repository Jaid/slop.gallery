import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn as fn, mix, mx_noise_float, negateOnBackSide, transformNormalToView, uv, varying, vec2} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const sugarRelief = 0.009
/** Three ribbons make twelve turns along the tube; all fields close at both UV seams. */
function sugarPhase(tube: Node<'vec2'>) {
  return tube.x.mul(12).add(tube.y.mul(3)).mul(TAU)
}
function sugarHeight(tube: Node<'vec2'>) {
  return sugarPhase(tube).mul(2).cos().mul(0.5).add(0.5).pow(2).mul(sugarRelief)
}
const sugarPosition = fn(([tube]: [Node<'vec2'>]) => {
  const frame = knotFrame(tube)
  return frame.position.add(frame.normal.mul(sugarHeight(tube)))
})
/** Central differences shade the actual fluted surface rather than the undeformed tube. */
const sugarSurfaceNormal = fn(([tube]: [Node<'vec2'>]) => {
  const epsilon = 0.0001
  const du = sugarPosition(tube.add(vec2(epsilon, 0))).sub(sugarPosition(tube.sub(vec2(epsilon, 0))))
  const dv = sugarPosition(tube.add(vec2(0, epsilon))).sub(sugarPosition(tube.sub(vec2(0, epsilon))))
  return du.cross(dv).normalize()
})

/** Pulled raspberry candy with a mint pinstripe and a finely sugared, fluted glaze. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const tube = uv()
    const phase = sugarPhase(tube)
    const footprint = phase.fwidth().max(0.001)
    const resolved = footprint.smoothstep(0.5, 2.5).oneMinus()
    const raspberry = phase.sin().smoothstep(footprint.negate().add(0.05), footprint.add(0.15))
    const mint = phase.cos().smoothstep(footprint.negate().add(0.86), footprint.add(0.94))
    const {p, view, intimate} = viewerFrame()
    const frostQ = p.mul(170)
    const frostVisibility = frostQ.fwidth().length().smoothstep(0.3, 1.4).oneMinus().mul(intimate)
    const frost = mx_noise_float(frostQ).smoothstep(0.16, 0.62).mul(frostVisibility)
    const bubbleQ = p.sub(view.mul(0.012)).mul(65)
    const bubbleVisibility = bubbleQ.fwidth().length().smoothstep(0.3, 1.2).oneMinus().mul(intimate)
    const bubbles = cellularPoints(bubbleQ, 0.025, 0.15, 0.8).mul(bubbleVisibility)
    const cream = color(hsl.integer(89, 100, 95.4))
    const striped = mix(mix(cream, color(hsl.integer(13, 95, 48)), raspberry), color(hsl.integer(183, 88, 58)), mint)
    this.colorNode = mix(mix(color(hsl.integer(7, 66, 74)), striped, resolved), cream, frost.mul(0.36).add(bubbles.mul(0.15)))
    this.positionNode = sugarPosition(tube)
    this.normalNode = negateOnBackSide(varying(transformNormalToView(sugarSurfaceNormal(tube))).normalize())
    this.metalness = 0
    this.roughnessNode = float(0.17).add(frost.mul(0.3)).add(bubbles.mul(0.06))
    this.ior = 1.47
    this.transmission = 0.12
    this.thickness = 0.065
    this.clearcoat = 1
    this.clearcoatRoughness = 0.095
    this.clearcoatNormalNode = this.normalNode
  }
}
