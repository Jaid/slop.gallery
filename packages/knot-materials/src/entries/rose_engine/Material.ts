import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {coverage, periodicSurface, resolved, surfaceTile} from '../../candidates/gpt_sol/lib/gallerySurface.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Engine-turned guilloché, brass wire inlay and translucent-looking oxblood enamel. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = data.id
    const tube = uv()
    const {grazing, intimate, near} = viewerFrame()
    const tile = surfaceTile(tube, 16, 2)
    const seed = cellNoiseVec3(vec3(tile.cell, 173)).toVar()
    const q = tile.local
    const r = q.length().max(0.00001).toVar()
    const theta = atan(q.y, q.x).add(seed.z.mul(TAU))
    const turn = time.mul(0.055)
    const lobes = theta.mul(9).add(turn)
    const roseA = r.sub(lobes.cos().mul(0.055).add(0.26))
    const roseB = r.sub(lobes.sin().mul(0.047).add(0.177))
    const ribbonA = coverage(roseA, 0.009, tile.footprint)
    const ribbonB = coverage(roseB, 0.006, tile.footprint)
    const bezel = coverage(r.sub(0.427), 0.008, tile.footprint)
    const wire = ribbonA.max(ribbonB).max(bezel).toVar()
    const cutPhase = r.mul(760).add(lobes.cos().mul(15))
    const turning = cutPhase.cos().mul(resolved(cutPhase, 0.4, 2.3)).mul(0.5).add(0.5).toVar()
    const radialPhase = theta.mul(108).add(r.mul(18))
    const radial = coverage(radialPhase.sin(), 0.055, radialPhase.fwidth()).mul(resolved(radialPhase))
      .mul(r.smoothstep(0.06, 0.14)).mul(r.smoothstep(0.4, 0.43).oneMinus()).mul(intimate)
    const enamelNoise = mx_noise_float(periodicSurface(tube, 21, 3)).mul(0.5).add(0.5).toVar()
    const sheenSweep = tube.x.mul(TAU * 6).sub(tube.y.mul(TAU * 2)).add(time.mul(0.12)).sin().mul(0.5).add(0.5)
    const wine = mix(color(hsl.integer(354, 61, 6)), color(hsl.integer(14, 86, 25)), enamelNoise.mul(0.6).add(sheenSweep.mul(0.35)))
    const brass = mix(color(hsl.integer(70, 74, 57)), color(hsl.integer(88, 71, 85.5)), turning.mul(0.6).add(seed.y.mul(0.2)))
    this.colorNode = mix(wine.mul(turning.mul(0.13).add(0.87)), brass, wire)
      .add(color(hsl.integer(45, 69, 53)).mul(radial).mul(0.075))
    this.metalnessNode = wire.mul(0.95).add(radial.mul(0.2)).clamp()
    this.roughnessNode = mix(float(0.22), float(0.185), wire).add(turning.mul(0.045))
    this.anisotropyNode = vec2(theta.cos(), theta.sin()).mul(wire.mul(0.6).add(0.15))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.065
    this.ior = 1.51
    const height = wire.mul(0.0012).sub(radial.mul(0.00028)).add(turning.mul(0.00016).mul(intimate))
    this.normalNode = proceduralNormal(height, 0.75)
    this.clearcoatNormalNode = proceduralNormal(enamelNoise.mul(0.00025), 0.6)
    this.emissiveNode = color(hsl.integer(27, 82, 37)).mul(wire.oneMinus()).mul(sheenSweep).mul(near).mul(0.035)
    this.iridescenceNode = grazing.pow(3).mul(wire.oneMinus()).mul(0.14)
    this.iridescenceThicknessNode = float(320)
  }
}
