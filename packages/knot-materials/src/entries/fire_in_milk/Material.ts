import type {Node, Texture} from 'three/webgpu'

import {color, float, mix, mx_noise_float, normalLocal, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const plateletScale = vec2(150, 26)
/** One platelet of precious opal: a secret mirror tilted inside the milk, flashing only when the visitor, the lamp and its tilt agree. Its random identity survives the UV seam because the cell index is wrapped before hashing. */
function platelet(tube: Node<'vec2'>, seed: number) {
  const q = tube.mul(plateletScale)
  const id = wrapCell(q.floor(), plateletScale)
  const random = cellNoiseVec3(vec3(id.x, id.y, seed))
  const axis = normalLocal.normalize().add(random.mul(2).sub(1).mul(0.85)).add(vec3(0.001, 0.002, 0.003)).normalize()
  return {
    random,
    axis,
  }
}
/** Milk-white opal with play-of-color. Two buried platelet layers hold fixed random tilts; as the visitor circles, the reflected lamp sweeps across them and individual platelets ignite in spectral flashes, then go milky again. Nearer platelets resolve into a mosaic, distant ones melt into a soft shimmer under a thin-film skin. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const milk = mx_noise_float(p.mul(3.1)).mul(0.5).add(0.5)
    const body = mix(color('#e9e2d2'), color('#d7e4e2'), milk).add(color('#f7f1e3').mul(mx_noise_float(p.mul(11)).mul(0.5).add(0.5).mul(0.12)))
    const lamp = vec3(0.42, 0.78, 0.49).normalize()
    const halfDir = view.add(lamp).normalize()
    const breath = time.mul(Math.PI).sin().mul(0.12)
    const surface = platelet(tube, 7.3)
    const buried = platelet(tube.add(vec2(0.37, 0.41)), 19.9)
// Close up the flashes are hard and brief; from across the room they soften into shimmer.
    const sharpness = mix(float(14), float(60), near)
    const gateA = surface.random.y.smoothstep(0.18, 0.32)
    const gateB = buried.random.y.smoothstep(0.45, 0.57)
    const alignA = halfDir.dot(surface.axis).clamp(0, 1)
    const alignB = halfDir.dot(buried.axis).clamp(0, 1)
    const flashA = alignA.pow(sharpness).mul(gateA)
    const flashB = alignB.pow(sharpness.mul(0.6)).mul(gateB).mul(grazing.mul(0.7).add(0.3))
    const fireA = spectralColor(surface.random.x.mul(9).add(breath).add(facing.mul(1.4)))
    const fireB = spectralColor(buried.random.x.mul(9).add(2.4).sub(breath))
    const fire = fireA.mul(flashA.mul(3.8)).add(fireB.mul(flashB.mul(2.1)))
    const lit = body.add(fireA.mul(gateA).mul(0.24)).add(fire)
// Faint color also leaks around silhouette edges, as if light scattered inside the stone.
    const scatter = spectralColor(milk.mul(4).add(view.x.mul(2))).mul(grazing.pow(2)).mul(0.1)
    this.colorNode = lit.mul(0.92)
    this.metalness = 0
    this.roughnessNode = mix(float(0.34), float(0.13), flashA.max(flashB)).add(grazing.mul(0.08))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.07
    this.iridescence = 0.55
    this.iridescenceIOR = 1.32
    this.iridescenceThicknessNode = surface.random.z.mul(320).add(140).add(facing.mul(160))
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(26)).mul(0.7).add(mx_noise_float(p.mul(63)).mul(intimate).mul(0.3)), 0.0009)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = fire.mul(1.25).add(scatter).mul(near.mul(0.3).add(0.85))
  }
}
