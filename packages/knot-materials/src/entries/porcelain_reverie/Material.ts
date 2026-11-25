import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {angle, coverage, ring, stroke, wave} from '../../candidates/gpt_astra/lib/exhibition/fields.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Cobalt underglaze, gold overglaze and a translucent-looking ivory ceramic body. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, facing, intimate} = viewerFrame()
    const tube = uv()
    const q = tube.mul(vec2(16, 3))
    const aa = q.fwidth().length().max(0.0001)
    const c = q.fract().sub(0.5).mul(vec2(1.22, 1))
    const r = c.length()
    const theta = angle(c)
    const granulation = mx_noise_float(p.mul(95)).mul(0.5).add(0.5)
    const petalRadius = theta.mul(5).cos().mul(0.065).add(0.235)
    const flowerDistance = r.sub(petalRadius)
    const pigmentEdge = flowerDistance.add(granulation.sub(0.5).mul(0.012))
    const flower = coverage(pigmentEdge, aa.add(0.003))
    const outline = stroke(flowerDistance, 0.009, aa)
    const eye = coverage(r.sub(0.055), aa)
    const petalInk = wave(theta.mul(10).add(r.mul(24))).mul(0.5).add(0.5)
    const brush = wave(r.mul(220).add(theta.mul(5).sin().mul(3))).mul(intimate)
    const wash = r.div(petalRadius).clamp().mul(0.64).add(petalInk.mul(0.2)).add(granulation.mul(0.16)).clamp()
    const cobalt = mix(color(hsl.integer(259, 85, 17.4)), color(hsl.integer(250, 60, 48)), wash).mul(brush.mul(0.12).add(0.94))
    // Interlocking sinuous stems continue through every module boundary.
    const vine = c.x.sub(q.y.mul(Math.PI * 2).sin().mul(0.31))
    const vineMask = stroke(vine, 0.008, aa).mul(flower.oneMinus())
    const halo = ring(r, 0.39, 0.0035, aa)
    const gilding = outline.mul(0.65).max(vineMask).max(eye).max(halo.mul(0.7))
    const ivory = mix(color(hsl.integer(89, 58, 94)), color(hsl.integer(197, 17, 90)), facing.oneMinus().mul(0.28))
    let painted = mix(ivory, cobalt, flower)
    painted = mix(painted, color(hsl.integer(263, 77, 19)), ring(r, 0.073, 0.009, aa))
    this.colorNode = mix(painted, color(hsl.integer(77, 71, 62)), gilding)
    this.metalnessNode = gilding.mul(0.82)
    this.roughnessNode = mix(float(0.22), float(0.3), gilding).add(granulation.mul(0.028))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.07
    this.ior = 1.48
    const height = flower.mul(0.00055).add(gilding.mul(0.00085)).add(granulation.mul(0.00012).mul(intimate))
    this.normalNode = proceduralNormal(height, 0.6)
    // A slow kiln-light memory runs only through the gilt, never through the blue paint.
    const memory = tube.x.mul(Math.PI * 12).sub(time.mul(0.24)).sin().mul(0.5).add(0.5).pow(8)
    this.emissiveNode = color(hsl.integer(78, 100, 84)).mul(gilding).mul(memory).mul(intimate).mul(0.12)
  }
}
