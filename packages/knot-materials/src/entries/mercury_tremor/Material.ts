import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, time, vec2, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Slow surface-tension swell as a height field; its slope is recovered by proceduralNormal downstream. */
function waves(point: Node<'vec3'>) {
  const a = vec2(1, 0.6).normalize()
  const b = vec2(-0.35, 1).normalize()
  const p = vec2(point.x.add(point.z.mul(0.7)), point.y)
  const phaseA = p.dot(a).mul(5.2)
  const phaseB = p.dot(b).mul(8.7)
  const height = phaseA.sin().mul(0.55).add(phaseB.sin().mul(0.3)).add(p.dot(a).mul(2.3).sin().mul(0.35))
  return height
}

/** A knot cast in living mercury. Surface tension combs slow swells over the mirror; satellite droplets bead and tremble at the crests. Every step slides the whole room across its skin, and at the very rim a thin breath of oxide turns the reflection to oil-slick rainbows. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const t = time.mul(0.22)
    const swell = waves(p.add(vec3(t.mul(0.05), t.mul(0.04), float(0))))
    const micro = mx_noise_float(p.mul(38).add(vec3(float(0), float(0), t))).mul(0.5).add(0.5)
    const drop = beads(p.mul(8).add(41.5), 3.7)
    const beadHeight = drop.cap.mul(drop.core).mul(0.08)
    const height = swell.mul(0.032).add(beadHeight).add(micro.mul(intimate).mul(0.0015))
    this.positionNode = positionGeometry.add(normalLocal.mul(height))
    this.normalNode = proceduralNormal(height, 0.7).normalize()
    this.colorNode = color(hsl.integer(248, 8, 77))
    this.metalness = 1
    this.roughnessNode = float(0.025).add(drop.mask.mul(0.01)).add(micro.mul(near).mul(0.008))
    this.clearcoat = 0
    this.envMapIntensity = 1.05
// A whisper of tarnish only where the mirror turns edge-on to the eye.
    this.iridescenceNode = grazing.pow(4).mul(0.5)
    this.iridescenceIOR = 1.4
    this.iridescenceThicknessNode = float(320).add(micro.mul(140)).add(facing.mul(90))
    const jitter = vec3(mx_noise_float(p.mul(40)), mx_noise_float(p.mul(40).add(9)), mx_noise_float(p.mul(40).add(17))).sub(0.5)
    const shake = float(1).add(time.mul(3.1).add(drop.random.z.mul(20)).sin().mul(intimate).mul(0.5))
    const dewFlash = glints(normalViewGeometry.add(jitter.mul(0.3)), 150).mul(drop.mask).mul(near).mul(shake)
    this.emissiveNode = color(hsl.integer(255, 100, 90)).mul(grazing.pow(5).mul(0.05)).add(color(hsl.integer(0, 0, 100)).mul(dewFlash.mul(0.25)))
  }
}
