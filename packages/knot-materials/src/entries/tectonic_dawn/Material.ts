import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, mx_worley_noise_vec3, normalViewGeometry, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A tectonic plate boundary seen through polished volcanic glass. */
function faultField(point: Node<'vec3'>, view: Node<'vec3'>, scale: number, seed: number, parallax: number) {
  const domain = point.mul(scale).add(vec3(seed, seed * 0.41, seed * -0.27)).add(view.mul(parallax))
  const warp = mx_fractal_noise_float(domain.mul(0.24).add(seed), 3, 2.08, 0.53)
  const crystalPosition = domain.add(vec3(warp.mul(0.18), warp.mul(-0.11), warp.mul(0.14)))
  const cells = mx_worley_noise_vec3(crystalPosition, 1, 0)
  const footprint = crystalPosition.fwidth().length()
  const boundary = cells.y.sub(cells.x)
  const seam = boundary.abs().smoothstep(0.014, footprint.add(0.052)).oneMinus()
  const plate = cells.x.smoothstep(0.025, 0.22).oneMinus()
  const crystalId = mx_worley_noise_float(crystalPosition, 1, 1)
  const crystalRandom = cellNoiseVec3(vec3(crystalId.mul(65_536), 7, 19))
  const interior = boundary.smoothstep(0, footprint.add(0.14)).mul(footprint.smoothstep(0.45, 1.5).oneMinus())
  const identity = mix(vec3(0.5), crystalRandom, interior)
  return {
    boundary,
    identity,
    plate,
    seam,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.22)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const broad = faultField(p, view, 4.1, 0.7, 0)
    const middle = faultField(p, view, 9.6, 7.3, -0.035)
    const fine = faultField(p, view, 21.5, 17.1, -0.075)
    const stoneNoise = mx_fractal_noise_float(p.mul(3.7).add(vec3(0, time.mul(0.018), 0)), 4, 2.06, 0.55)
    const mineral = mx_noise_float(p.mul(46).add(time.mul(0.004))).mul(0.5).add(0.5)
    const plateColor = mix(color(hsl.integer(266, 44, 4.6)), color(hsl.integer(245, 43, 17)), broad.plate.mul(0.58).add(stoneNoise.mul(0.18)).add(0.08))
    const warmFault = mix(color(hsl.integer(33, 83, 16)), color(hsl.integer(61, 100, 73.9)), fine.seam.mul(0.55).add(stoneNoise.mul(0.18)))
    const coolFault = mix(color(hsl.integer(253, 71, 13)), color(hsl.integer(205, 84, 78)), middle.seam.mul(0.5).add(facing.mul(0.2)))
    const faultColor = mix(coolFault, warmFault, fine.identity.x.mul(0.5).add(0.5))
    const seam = broad.seam.mul(0.72).add(middle.seam.mul(0.46)).add(fine.seam.mul(0.26)).clamp()
    const pulse = time.mul(1.15).add(p.x.mul(5.6)).sub(p.y.mul(3.1)).sin().mul(0.5).add(0.5)
    const heat = seam.mul(seam).mul(pulse.pow(2.2).mul(0.78).add(0.22))
    const inclusionCoord = p.mul(38)
    const inclusionRandom = cellNoiseVec3(inclusionCoord.floor())
    const inclusionCenter = inclusionRandom.mul(0.5).add(0.25)
    const inclusionFootprint = inclusionCoord.fwidth().length()
    const inclusionRadius = inclusionFootprint.add(0.18).min(0.24)
    const inclusionMask = inclusionCoord.fract().sub(inclusionCenter).length().smoothstep(0.06, inclusionRadius).oneMinus().mul(inclusionFootprint.smoothstep(0.32, 1.15).oneMinus())
    const inclusions = inclusionRandom.z.smoothstep(0.82, 0.96).mul(inclusionMask)
    this.colorNode = mix(plateColor, faultColor, seam.mul(0.78)).add(color(hsl.integer(94, 100, 94.8)).mul(inclusions.mul(0.18)))
    this.metalnessNode = float(0.42).add(broad.plate.mul(0.3)).add(fine.seam.mul(0.18))
    this.roughnessNode = float(0.13).add(stoneNoise.mul(0.09)).add(seam.mul(0.12)).add(mineral.mul(0.035))
    this.normalNode = proceduralNormal(seam.mul(-0.0035).add(fine.seam.mul(-0.0012)).add(stoneNoise.mul(0.00045)), 0.0032)
    this.clearcoat = 0.72
    this.clearcoatRoughnessNode = float(0.055).add(seam.mul(0.075))
    this.iridescenceNode = broad.plate.mul(0.18).add(grazing.mul(0.28))
    this.iridescenceThicknessNode = facing.mul(420).add(broad.identity.y.mul(210)).add(170)
    this.emissiveNode = faultColor.mul(heat.mul(1.2)).add(color(hsl.integer(98, 100, 95)).mul(inclusions.mul(0.32).mul(near))).add(color(hsl.integer(211, 100, 84.5)).mul(grazing.mul(0.065).mul(intimate.mul(0.45).add(0.15)))).add(color(hsl.integer(97, 100, 97.5)).mul(glints(normalViewGeometry, 120).mul(0.16).mul(near)))
  }
}
