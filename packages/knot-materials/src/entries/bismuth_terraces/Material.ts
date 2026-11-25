import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.18)
    this.name = knotData.id
    const p = positionGeometry
    const {grazing, near, intimate} = viewerFrame()
    const grid = uv().mul(vec2(9, 4))
    const cell = grid.floor()
    const identity = cellNoiseVec3(vec3(cell, 29.4))
    const local = grid.fract().sub(0.5)
    const squareRadius = local.x.abs().max(local.y.abs())
    // Concentric square terraces are a small nod to bismuth’s impossible staircases. Every tile has a
    // different rotation and oxidation phase, so the seam is read as a crystal boundary, not wallpaper.
    const terraceLevel = squareRadius.mul(11).floor().div(11)
    const shelfPosition = squareRadius.mul(11).fract()
    const terrace = terraceLevel.mul(1.35).add(identity.x.mul(TAU * 0.16)).sin().mul(0.5).add(0.5)
    const lip = shelfPosition.smoothstep(0.02, 0.16).oneMinus()
    const diagonalPhase = local.x.add(local.y).mul(25).add(identity.y.mul(TAU)).add(time.mul(-0.035))
    const diagonal = opticalLine(diagonalPhase.sin(), 0.055).mul(near.mul(0.8).add(0.2))
    const fineNoise = mx_noise_float(p.mul(54).add(vec3(time.mul(0.01), 0, 0))).mul(0.5).add(0.5)
    const edge = lip.add(diagonal.mul(0.62)).clamp()
    const filmPhase = terraceLevel.mul(9).add(identity.z.mul(3.7)).add(grazing.mul(2.8)).add(time.mul(0.025))
    const spectrum = spectralColor(filmPhase)
    const midnight = mix(color(hsl.integer(293, 52, 4.6)), color(hsl.integer(307, 69, 13)), terrace.mul(0.62).add(fineNoise.mul(0.09)))
    const oxide = mix(color(hsl.integer(332, 81, 26)), spectrum, terrace.mul(0.35).add(edge.mul(0.8)).clamp())
    const surface = mix(midnight, oxide, terrace.mul(0.5).add(edge.mul(0.65)).clamp())
    const relief = terrace.mul(0.0012).add(edge.mul(0.0012)).add(fineNoise.mul(near).mul(0.0003))
    this.colorNode = surface
    this.metalness = 0.96
    this.roughnessNode = float(0.2).sub(edge.mul(0.1)).sub(grazing.mul(0.035)).add(fineNoise.mul(0.025)).clamp(0.055, 0.32)
    this.iridescence = 1
    this.iridescenceIOR = 1.32
    this.iridescenceThicknessNode = terrace.mul(420).add(grazing.mul(290)).add(110)
    this.clearcoat = 0.92
    this.clearcoatRoughness = 0.035
    this.anisotropy = 0.38
    this.positionNode = p.add(normalLocal.mul(terraceLevel.mul(0.0034).add(lip.mul(0.0008))))
    this.normalNode = proceduralNormal(relief, 0.68)
    this.emissiveNode = spectrum.mul(edge).mul(grazing.pow(2.4).mul(0.12).add(near.mul(0.018))).add(color(hsl.integer(332, 100, 84)).mul(lip).mul(intimate).mul(0.06))
  }
}
