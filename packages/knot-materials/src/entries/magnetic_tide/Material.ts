import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, negateOnBackSide, positionViewDirection, time, transformNormalToView, uv, varying, vec2} from 'three/tsl'

import {approach} from '../../candidates/gpt_astra/lib/exhibition/optics.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Vertex-only finite differences preserve highlights on smooth, displaced tube surfaces. */
function sculptedTube(tube: Node<'vec2'>, height: (tube: Node<'vec2'>) => Node<'float'>) {
  const surface = Fn(([q]: [Node<'vec2'>]) => {
    const {position, normal} = knotFrame(q)
    return position.add(normal.mul(height(q)))
  })
  const epsilon = 0.00012
  const du = surface(tube.add(vec2(epsilon, 0))).sub(surface(tube.sub(vec2(epsilon, 0))))
  const dv = surface(tube.add(vec2(0, epsilon))).sub(surface(tube.sub(vec2(0, epsilon))))
  return {
    position: surface(tube),
    normal: negateOnBackSide(varying(transformNormalToView(du.cross(dv).normalize())).normalize()),
  }
}
function field(q: Node<'vec2'>) {
  const phase = q.x.mul(TAU * 14).add(q.y.mul(TAU * 3)).add(q.y.mul(TAU * 2).sin().mul(0.8)).sub(time.mul(0.48))
  const ridge = phase.cos().mul(0.5).add(0.5).pow(4)
  const modulation = q.y.mul(TAU * 5).sub(q.x.mul(TAU * 2)).add(time.mul(0.21)).cos().mul(0.5).add(0.5)
  return {
    ridge,
    modulation,
  }
}
/** A polished magnetic sea rises in seamless traveling ridges, with surface normals reconstructed from the displaced tube. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.3)
    this.name = knotData.id
    const q = uv()
    const near = approach(viewerFrame().objectDistance)
    // Every displacement frequency closes on both UV seams. No fragment derivatives enter this graph.
    const height = (tube: Node<'vec2'>) => {
      const {ridge, modulation} = field(tube)
      return ridge.mul(modulation.mul(0.017).add(0.013)).sub(0.004).mul(near.mul(0.18).add(0.82))
    }
    const surface = sculptedTube(q, height)
    this.positionNode = surface.position
    this.normalNode = surface.normal
    this.clearcoatNormalNode = surface.normal
    const {ridge, modulation} = field(q)
    const facing = surface.normal.dot(positionViewDirection).abs().clamp()
    const rim = facing.oneMinus()
    const oil = rim.pow(3).mul(ridge).mul(0.64)
    this.colorNode = mix(mix(color(hsl.integer(251, 27, 19)), color(hsl.integer(211, 10, 67.5)), ridge.mul(0.65).add(modulation.mul(0.12))), color(hsl.integer(83, 52, 60)), oil)
    this.metalness = 1
    this.roughnessNode = mix(float(0.2), float(0.095), ridge).add(near.oneMinus().mul(0.025))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.055
    this.anisotropy = 0.3
    this.anisotropyNode = vec2(0.28, 0.12)
    this.iridescence = 0.28
    this.iridescenceNode = oil.mul(0.45)
    this.iridescenceThicknessNode = modulation.mul(90).add(260)
    this.emissiveNode = color(hsl.integer(242, 51, 50)).mul(rim.pow(5)).mul(0.026)
  }
}
