import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {stroke, wave} from '../../candidates/gpt_astra/lib/exhibition/pattern.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Diamond-cut shell marquetry: independent optical axes, growth lamellae and recessed bronze joints. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {p, facing, grazing, intimate} = viewerFrame()
    const tube = uv()
    // Integer windings in both directions preserve the knot’s two UV closures.
    const q = vec2(tube.x.mul(32).add(tube.y.mul(4)), tube.x.mul(32).sub(tube.y.mul(4)))
    const tile = q.floor()
    const rnd = cellNoiseVec3(vec3(wrapCell(tile, vec2(4)), 8.7))
    const local = q.fract().sub(0.5)
    const fw = q.fwidth().length().max(0.00001)
    const edge = local.abs().x.max(local.abs().y).oneMinus().sub(0.5)
    const joint = stroke(edge, 0.018, fw)
    const lip = stroke(edge.sub(0.037), 0.009, fw).mul(joint.oneMinus())
    const origin = vec2(rnd.x.mul(0.28).add(0.52), rnd.y.mul(0.28).add(0.52))
    const radius = local.add(origin).length()
    const growth = radius.mul(95).add(mx_noise_float(p.mul(32)).mul(1.4))
    const striae = wave(growth).mul(0.65).add(wave(growth.mul(2.37)).mul(0.35))
    const drift = time.mul(0.22).sin().mul(0.06)
    const orient = rnd.z.mul(2).sub(1)
    const lustre = facing.mul(2.1).add(radius.mul(0.82)).add(orient.mul(0.9)).add(drift)
    const rose = lustre.mul(3.4).sin().mul(0.5).add(0.5)
    const blue = lustre.mul(3.4).add(2.1).sin().mul(0.5).add(0.5)
    const ivory = color(hsl.integer(80, 36, 88))
    const shell = mix(mix(ivory, color(hsl.integer(343, 44, 69)), rose.mul(0.6)), color(hsl.integer(219, 54, 66)), blue.mul(0.56))
      .mul(striae.mul(0.075).add(0.94))
    const tide = tube.x.mul(TAU * 6).add(tube.y.mul(TAU)).add(time.mul(0.11)).sin().mul(0.5).add(0.5)
    const bronze = mix(color(hsl.integer(61, 43, 37)), color(hsl.integer(75, 53, 70)), tide)
    this.colorNode = mix(shell, bronze, joint).add(color(hsl.integer(78, 100, 93.7)).mul(lip).mul(0.12))
    this.metalnessNode = mix(float(0.18), float(0.86), joint)
    this.roughnessNode = mix(float(0.24).add(rnd.z.mul(0.08)), float(0.3), joint)
    this.normalNode = proceduralNormal(joint.mul(-0.00065).add(lip.mul(0.00019)).add(striae.mul(intimate).mul(0.000065)), 1)
    this.clearcoat = 0.86
    this.clearcoatRoughness = 0.11
    this.clearcoatNormalNode = normalViewGeometry
    this.iridescenceNode = joint.oneMinus().mul(0.52)
    this.iridescenceIOR = 1.32
    this.iridescenceThicknessNode = radius.mul(75).add(rnd.z.mul(90)).add(290).add(striae.mul(12))
    this.anisotropy = 0.35
    this.anisotropyNode = local.add(origin).normalize().mul(joint.oneMinus()).mul(0.35)
    this.aoNode = joint.mul(-0.18).add(1)
    // Soft subsurface return, not a glowing outline.
    this.emissiveNode = shell.mul(grazing.pow(3)).mul(0.035)
  }
}
