import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, exp, float, Fn, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, positionViewDirection, sin, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/deepseek/lib/bumpNormal.ts'
import {voronoiSurface} from '../../candidates/deepseek/lib/voronoiSurface.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const coarsePeriod = vec2(40, 5)
const finePeriod = vec2(128, 16)
/** Broad, shallow depression along the main fissures; the crisp bevel lives in the shading normal. */
const faultPosition = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  const warp = mx_noise_vec3(p.mul(2.6).add(vec3(1.3, 7.1, 2.8))).xy.mul(0.58)
  const cells = voronoiSurface(tube.mul(coarsePeriod).add(warp), coarsePeriod, 21.3)
  const zone = mx_fractal_noise_float(p.mul(1.45).add(vec3(4.4, 0.7, 8.2)), 4, 2.05, 0.55).mul(0.5).add(0.5)
  const gate = zone.smoothstep(0.3, 0.56)
  const widthVar = mx_noise_float(p.mul(7.5).add(vec3(0.3, 2.4, 6.6))).mul(0.42).add(0.79)
  const width = gate.mul(0.14).add(0.04).mul(widthVar)
  const dent = cells.edge.smoothstep(0, width.mul(2.8)).oneMinus()
  return p.add(normal.mul(dent.mul(gate.mul(-0.005).sub(0.0026))))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const tube = uv()
    this.positionNode = faultPosition(tube)
    const epsilon = 0.0004
    const du = faultPosition(tube.add(vec2(epsilon, 0))).sub(faultPosition(tube.sub(vec2(epsilon, 0))))
    const dv = faultPosition(tube.add(vec2(0, epsilon))).sub(faultPosition(tube.sub(vec2(0, epsilon))))
    const surfaceNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {p, grazing, near} = viewerFrame()
    const warp = mx_noise_vec3(p.mul(2.6).add(vec3(1.3, 7.1, 2.8))).xy.mul(0.58)
    const cells = voronoiSurface(tube.mul(coarsePeriod).add(warp), coarsePeriod, 21.3)
    const zone = mx_fractal_noise_float(p.mul(1.45).add(vec3(4.4, 0.7, 8.2)), 4, 2.05, 0.55).mul(0.5).add(0.5)
    const gate = zone.smoothstep(0.3, 0.56)
    const widthVar = mx_noise_float(p.mul(7.5).add(vec3(0.3, 2.4, 6.6))).mul(0.42).add(0.79)
    const width = gate.mul(0.14).add(0.04).mul(widthVar)
    const edge = cells.edge.toVar()
    const aa = edge.fwidth().max(0.0015)
    const core = edge.smoothstep(0, width.add(aa)).oneMinus()
// Only part of the fracture field was repaired with gold; the rest stays a dark hairline.
    const goldMask = edge.smoothstep(width.mul(0.52), width.add(aa)).oneMinus().mul(gate).clamp()
    const fineWarp = mx_noise_vec3(p.mul(6.2).add(vec3(7.7, 2.2, 5.1))).xy.mul(0.32)
    const fineCells = voronoiSurface(tube.mul(finePeriod).add(fineWarp), finePeriod, 9.1)
    const fineAa = fineCells.edge.fwidth().max(0.001)
    const hairline = fineCells.edge.smoothstep(0, fineCells.edge.fwidth().mul(1.4).add(0.006)).oneMinus().mul(goldMask.oneMinus()).mul(0.42)
// Marble: cloudy ivory, cool shadows and two families of winding graphite veins.
    const turbulence = mx_fractal_noise_float(p.mul(2.55).add(vec3(3.4, 8.1, 1.2)), 5, 2.05, 0.54)
    const strata = sin(p.dot(vec3(4.7, 2.9, 3.6)).add(turbulence.mul(4.4)).add(1.3))
    const secondary = sin(p.dot(vec3(-2.2, 4.9, 2.4)).add(turbulence.mul(2.1)).add(4.7))
    const vein = strata.abs().smoothstep(0, 0.13).oneMinus()
    const vein2 = secondary.abs().smoothstep(0, 0.075).oneMinus()
    const cloud = mx_noise_float(p.mul(5.1).add(vec3(1.1, 6.4, 3.3))).mul(0.5).add(0.5)
    const marble = mix(mix(color(hsl.integer(214, 9, 11)), color(hsl.integer(207, 5, 41)), cloud.pow(1.35).mul(0.9)), color(hsl.integer(90, 20, 84)), vein.mul(0.62).add(vein2.mul(0.26)))
    const fleckField = mx_cell_noise_float(p.mul(118)).smoothstep(0.82, 0.92).mul(goldMask.oneMinus()).mul(near)
    const dirty = mix(mix(marble, color(hsl.integer(75, 58, 67)), fleckField.mul(0.55)), color(hsl.integer(73, 26, 40)), mx_noise_float(p.mul(28)).mul(0.14))
    const shadowRim = core.mul(goldMask.oneMinus()).mul(0.72)
    const bodyColor = mix(dirty, color(hsl.integer(226, 12, 4)), shadowRim).mul(hairline.oneMinus().mul(0.3).oneMinus())
// The gold is a real metal, grained by cooling and brightened where the core still remembers heat.
    const goldGrain = mx_noise_float(p.mul(64).add(vec3(2.2, 9.4, 0.8))).mul(0.5).add(0.5)
    const goldBase = mix(color(hsl.integer(48, 95, 37)), color(hsl.integer(82, 100, 82)), goldGrain.smoothstep(0.16, 0.8))
    const gold = mix(goldBase, color(hsl.integer(96, 100, 94.4)), core.pow(3).mul(0.6)).add(color(hsl.integer(56.5, 100, 70.7)).mul(core.mul(goldMask).mul(0.22)))
    this.colorNode = mix(bodyColor, gold, goldMask)
    this.metalnessNode = goldMask.mul(0.96).max(fleckField.mul(0.7))
    this.roughnessNode = mix(float(0.27), float(0.14), goldMask).add(goldGrain.mul(0.035))
    this.ior = 1.48
    this.clearcoatNode = goldMask.oneMinus().mul(0.45)
    this.clearcoatRoughnessNode = float(0.055).add(cloud.mul(0.03))
// A sharp central channel and a raised meniscus, laid over the broad geometric dent.
    const channel = edge.smoothstep(0, width.mul(1.35).add(aa)).oneMinus().mul(-0.0025)
    const meniscus = edge.smoothstep(0, width.mul(0.44).add(aa)).oneMinus().mul(goldMask.mul(0.0022))
    const hairGroove = fineCells.edge.smoothstep(0, fineAa.mul(2.2).add(0.012)).oneMinus().mul(-0.0009).mul(goldMask.oneMinus())
    const marbleGrain = mx_noise_float(p.mul(58).add(vec3(5.1, 2.7, 8.8))).mul(near.mul(0.00042))
    const moltenShimmer = mx_noise_float(p.mul(19).add(vec3(0, 0, time.mul(0.32)))).mul(goldMask).mul(near.mul(0.0007))
    const detailHeight = channel.add(meniscus).add(hairGroove).add(marbleGrain).add(moltenShimmer)
    const detailStrength = edge.fwidth().smoothstep(0.006, 0.05).oneMinus().mul(0.85)
    const bump = bumpNormal(detailHeight, surfaceNormal, detailStrength)
    this.normalNode = bump
    this.clearcoatNormalNode = bump
    const facing = surfaceNormal.dot(positionViewDirection).abs().clamp()
// Heat travels slowly along the seam; the gold itself stays cool enough to be metal.
    const wave = sin(tube.x.mul(TAU * 2.6).sub(time.mul(0.42))).mul(0.5).add(0.5)
    const heat = wave.mul(0.62).add(0.2).add(mx_noise_float(p.mul(7.5).add(vec3(0, 0, time.mul(0.09)))).mul(0.14)).clamp()
    const hot = goldMask.mul(core.pow(2)).mul(heat)
    const hotColor = mix(color(hsl.integer(39.6, 100, 63)), color(hsl.integer(96, 100, 95.1)), heat.mul(heat))
    const bounce = color(hsl.integer(55, 99, 74.4)).mul(exp(edge.sub(width).max(0).mul(-34)).mul(gate).mul(0.15)).mul(heat)
    const dust = mx_cell_noise_float(p.mul(132)).smoothstep(0.78, 0.92).mul(goldMask.mul(0.35).add(exp(edge.sub(width).max(0).mul(-18)).mul(gate).mul(0.35))).mul(near)
    const sparkle = glints(surfaceNormal, 80).mul(goldMask).mul(near).mul(0.55)
    this.emissiveNode = hotColor.mul(hot).mul(0.55)
      .add(bounce)
      .add(color(hsl.integer(69, 99, 82)).mul(dust).mul(0.55))
      .add(color(hsl.integer(84, 100, 92.6)).mul(sparkle))
      .add(color(hsl.integer(48, 71, 37)).mul(grazing.pow(3)).mul(0.1))
      .add(color(hsl.integer(67, 21, 46)).mul(facing.pow(7)).mul(0.035))
  }
}
