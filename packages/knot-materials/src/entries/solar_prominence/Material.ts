import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, mx_worley_noise_float, time, uv, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 3. SOLAR PROMINENCE A living star-surface. Granulated convection, magnetic sunspots, incandescent prominences arcing off the rim as you circle, and a limb-darkened plasma that breathes with the noise field. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, grazing, rim, intimate} = viewerFrame()
    const tube = uv()
    // Convective granulation — cellular boiling surface.
    const granWarp = mx_noise_vec3(p.mul(3).add(time.mul(0.08))).mul(0.6)
    const granCell = mx_worley_noise_float(p.mul(24).add(granWarp).add(vec3(time.mul(0.18), time.mul(0.12), 0)), 1, 0)
    const granCell2 = mx_worley_noise_float(p.mul(11).sub(granWarp).sub(vec3(0, time.mul(0.22), 0)), 1, 0)
    const gran = granCell.smoothstep(0.1, 0.8).oneMinus().mul(0.55).add(granCell2.smoothstep(0.1, 0.8).oneMinus().mul(0.45))
    // Magnetic sunspots — cooler, darker.
    const spotField = mx_fractal_noise_float(p.mul(1.7).add(time.mul(0.02)), 3, 2, 0.55)
    const spotCore = spotField.smoothstep(0.32, 0.55).oneMinus()
    const penumbra = spotField.smoothstep(0.2, 0.42).mul(spotCore.oneMinus())
    // Magnetic loops — arcade of filamentary ribbons.
    const loopPhase = tube.x.mul(Math.PI * 2 * 7)
      .add(mx_noise_float(p.mul(2.4)).mul(2.5))
    const loops = opticalLine(loopPhase.sin().mul(0.5), 0.045)
    const loopsFine = opticalLine(loopPhase.mul(1.7).sin().mul(0.5), 0.03).mul(intimate)
    // Prominences — plasma ejections standing off the limb.
    const promField = mx_noise_float(p.mul(9).sub(vec3(0, time.mul(0.55), 0)))
    const promFlick = mx_noise_float(p.mul(22).add(vec3(time.mul(0.9), 0, 0)))
    const prominence = promField.abs().mul(2).oneMinus().clamp().pow(4)
      .add(promFlick.abs().mul(3).oneMinus().clamp().pow(6).mul(0.6))
      .mul(grazing.pow(1.4))
    // Plasma temperature ladder.
    const hot = gran.mul(0.65).add(0.35)
    const plasma = mix(color(hsl.integer(31, 100, 57.9)), color(hsl.integer(85, 100, 86)), hot)
    const plasmaDeep = mix(color(hsl.integer(29, 100, 18)), plasma, spotCore)
    const penumbraCol = mix(plasma, color(hsl.integer(47, 100, 36)), penumbra.mul(0.7))
    // Limb darkening (edges cooler).
    const limb = facing.pow(0.55)
    this.colorNode = plasmaDeep.mul(limb.mul(0.55).add(0.55))
    this.roughnessNode = float(0.92)
      .sub(prominence.mul(0.35))
      .sub(loops.mul(0.15))
    this.metalness = 0
    this.clearcoat = 0.15
    this.clearcoatRoughness = 0.5
    this.normalNode = proceduralNormal(gran.mul(0.35).sub(spotCore.mul(0.15)).add(loops.mul(0.35)), 0.003)
    this.emissiveNode
      = plasma.mul(hot.mul(0.9).add(0.35)).mul(limb)
        .add(color(hsl.integer(50, 100, 68)).mul(loops).mul(0.85))
        .add(color(hsl.integer(62, 100, 73.8)).mul(loopsFine).mul(0.5))
        .add(color(hsl.integer(96, 100, 96)).mul(prominence).mul(2.6))
        .add(color(hsl.integer(39, 100, 62.4)).mul(rim).mul(grazing).mul(1.2))
        .add(color(hsl.integer(63, 100, 79)).mul(intimate).mul(0.12))
        .add(color(hsl.integer(37, 100, 13)).mul(spotCore).mul(0.4))
        .add(penumbraCol.mul(penumbra).mul(0.35))
  }
}
