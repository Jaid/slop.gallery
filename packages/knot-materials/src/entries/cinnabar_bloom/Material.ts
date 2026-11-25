import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, uv, vec2} from 'three/tsl'

import {breath} from '../../candidates/gpt_sol/lib/exhibition/facetOptics.ts'
import {fill, polarAngle, stroke, tiles, torusNoise, wave} from '../../candidates/gpt_sol/lib/exhibition/patterns.ts'
import ReliefKnotMaterial, {engravedNormal} from '../../candidates/gpt_sol/lib/exhibition/ReliefKnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

function carving(tube: Node<'vec2'>) {
  const q = tube.mul(vec2(18, 4))
  const point = q.fract().sub(0.5).mul(vec2(1.8, 1))
  const radius = point.length()
  const angle = polarAngle(point)
  const petalRadius = angle.mul(6).cos().mul(0.065).add(0.335)
  const border = radius.sub(petalRadius)
  const dome = radius.div(petalRadius).clamp().oneMinus().pow(0.65)
  const petalGroove = angle.mul(6).cos().mul(0.5).add(0.5)
    .mul(radius.smoothstep(0.035, 0.18)).mul(radius.smoothstep(0.28, 0.4).oneMinus())
  const core = radius.smoothstep(0.02, 0.11).oneMinus()
  const vine = tube.x.mul(TAU * 18).sin().mul(0.12)
    .add(tube.y.mul(TAU * 4).sin().mul(0.2))
  const height = dome.mul(0.0075).sub(petalGroove.mul(0.0018)).add(core.mul(0.002))
    .add(vine.mul(0.0013)).add(torusNoise(tube, 3, 1, 7).mul(0.0005))
    .add(tube.x.mul(TAU * 3).add(breath).sin().mul(0.00022))
  return {
    point,
    radius,
    angle,
    border,
    dome,
    petalGroove,
    core,
    height,
  }
}

/** Many coats of vermilion lacquer, carved into layered six-petaled flowers and curling gold vines. */
export default class extends ReliefKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = data.id
    const tube = uv()
    const {p, facing, grazing, intimate} = viewerFrame()
    const baseNormal = this.sculpt(sampleTube => carving(sampleTube).height)
    const fields = carving(tube)
    const {random, footprint} = tiles(tube, 18, 4, 3.7)
    const aa = footprint.mul(1.6)
    const flower = fill(fields.border, aa).toVar()
    const rim = stroke(fields.border, 0.005, aa)
    const inner = stroke(fields.radius.sub(0.102), 0.004, aa)
    const petalVein = stroke(fields.angle.mul(6).sin().mul(fields.radius), 0.004, aa)
      .mul(fields.radius.smoothstep(0.055, 0.12)).mul(flower)
    const curl = tube.x.mul(TAU * 18).add(tube.y.mul(TAU * 4).sin().mul(1.3))
    const vine = stroke(curl.sin(), 0.028, curl.fwidth()).mul(flower.oneMinus())
    const gold = rim.add(inner.mul(0.8)).add(vine.mul(0.65)).clamp().toVar()
    const turning = fields.radius.mul(360).add(fields.angle.mul(12))
    const toolFootprint = fields.radius.fwidth().mul(360).add(aa.mul(12).div(fields.radius.max(0.04)))
    const tool = wave(turning, toolFootprint).mul(flower).mul(intimate).toVar()
    const pores = mx_noise_float(p.mul(240)).mul(p.mul(240).fwidth().length().smoothstep(0.4, 1.1).oneMinus())
    const red = mix(color(hsl.integer(28, 86, 13)), color(hsl.integer(30.6, 96, 43)), fields.dome.mul(0.75).add(facing.mul(0.15)).clamp())
    const raised = mix(red, color(hsl.integer(34, 93, 55)), fields.petalGroove.oneMinus().mul(flower).mul(0.2))
    const pigment = raised.mul(random.z.mul(0.09).add(0.93).mix(1, flower.oneMinus())).mul(tool.mul(0.045).add(0.96))
      .mul(petalVein.mul(-0.25).add(1))
    const leafGrain = mx_noise_float(p.mul(80)).mul(0.12).add(0.88)
    this.colorNode = mix(pigment, color(hsl.integer(81, 73, 78)).mul(leafGrain), gold)
    this.metalnessNode = gold.mul(0.86)
    this.roughnessNode = mix(float(0.3).add(fields.petalGroove.mul(0.12)), float(0.24), gold)
      .add(pores.mul(0.018)).clamp(0.2, 0.48)
    this.normalNode = engravedNormal(baseNormal, tool.mul(0.000055).sub(petalVein.mul(0.00018)).add(pores.mul(0.000035)))
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.16
    this.clearcoatNormalNode = baseNormal
    this.ior = 1.5
    this.aoNode = fields.dome.mul(0.35).add(0.65)
    // A restrained red subsurface impression, never emissive gold or glowing cracks.
    const lacquerLight = tube.x.mul(TAU * 3).add(breath).sin().mul(0.06).add(0.94)
    this.emissiveNode = color(hsl.integer(30.5, 97.5, 42)).mul(flower).mul(grazing.pow(3)).mul(lacquerLight).mul(0.055)
    this.anisotropy = 0.22
    this.anisotropyNode = vec2(fields.angle.cos(), fields.angle.sin()).mul(gold.mul(0.22))
    this.userData = {
      collection: 'The Unwritten Atlas',
      opticalEffect: 'carved lacquer and gold leaf',
    }
  }
}
