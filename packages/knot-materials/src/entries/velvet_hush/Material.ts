import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, positionGeometry, uv} from 'three/tsl'

import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Wine-dark pile that swallows the light head-on and burns at the edges when the viewer passes. A damask is woven into the nap itself and answers only to the grazing eye, while two twisted cords of gold bullion wind around the form and strike sparks from the studio. Up close the pile resolves into fibers, crush marks and the thread's own twist. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const p = positionGeometry
    const tube = uv()
    const {rim, grazing, near, intimate} = viewerFrame()
// Ogee damask: nine motifs along the path, one around the tube, warped by the weave.
    const u = tube.x.mul(TAU * 9)
    const v = tube.y.mul(TAU)
    const warp = mx_noise_float(p.mul(2.5)).mul(1.2)
    const ogee = u.add(warp).sin().mul(0.55).add(v.add(warp).sin().mul(0.45))
    const motif = ogee.sin().mul(0.5).add(0.5).pow(1.5)
    const motifFine = ogee.mul(2).add(1.3).sin().mul(0.5).add(0.5).pow(2.2).mul(0.5)
    const damask = motif.mul(0.75).add(motifFine)
    const napEye = grazing.pow(1.2).mul(0.85).add(0.15)
    const fibre = mx_noise_float(p.mul(120)).mul(0.5).add(0.5)
    const crush = mx_noise_float(p.mul(3.2).add(7)).mul(0.5).add(0.5)
// Two twisted bullion cords helix along the form; integer windings keep both UV seams honest.
    const phase = tube.y.mul(TAU).sub(tube.x.mul(TAU * 3))
    const cord = filteredRibbon(phase.sin(), 0.14)
    const twist = opticalBands(phase.mul(9))
    const bullion = mix(color(hsl.integer(78, 77, 46)), color(hsl.integer(91, 77, 84)), twist.mul(0.45).add(0.35))
    const spark = glints(normalViewGeometry, twist.mul(60).add(70)).mul(cord).mul(near.mul(0.6).add(0.4))
    const relief = damask.mul(napEye).mul(0.5).add(fibre.mul(near).mul(0.35)).add(cord.mul(0.55)).add(twist.mul(cord).mul(0.25)).mul(intimate.add(near).clamp())
    this.colorNode = mix(color(hsl.integer(2, 59, 5.6)), bullion, cord)
    this.metalnessNode = cord
    this.roughnessNode = float(0.78).sub(damask.mul(napEye).mul(0.12)).mix(float(0.3), cord)
    this.aoNode = float(1).sub(crush.mul(0.12)).sub(damask.mul(napEye).mul(0.1))
    this.sheenNode = color(hsl.integer(13, 93, 45)).mul(damask.mul(0.7).add(0.8))
    this.sheenRoughnessNode = float(0.32)
    this.retroreflectivityNode = float(0.85)
    this.normalNode = proceduralNormal(relief, 0.0016)
    this.emissiveNode = color(hsl.integer(85, 100, 88.5)).mul(spark).mul(0.9)
      .add(color(hsl.integer(10, 100, 64.7)).mul(rim.pow(2.2)).mul(0.9))
  }
}
