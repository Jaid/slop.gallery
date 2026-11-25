import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, positionWorld, time, vec3} from 'three/tsl'

import {cellGrain} from '../../candidates/gpt_sol/lib/cellGrain.ts'
import {filament} from '../../candidates/gpt_sol/lib/filament.ts'
import {multiGlint} from '../../candidates/gpt_sol/lib/multiGlint.ts'
import {viewerFrame} from '../../candidates/gpt_sol/lib/viewerFrame.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

function pulse01(value: Node<'float'>, centre: number, width: number) {
  const footprint = value.fwidth().max(0.0001)
  return value
    .sub(centre)
    .abs()
    .smoothstep(width, footprint.mul(1.25).add(width))
    .oneMinus()
}

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 1.2
    const {p, grazing, near, intimate} = viewerFrame()
    const world = positionWorld
    const verticalWarp = mx_noise_float(vec3(world.x.mul(2.3), world.z.mul(2.3), world.y.mul(0.65)))
    const streamPhase = world.x
      .mul(18)
      .add(world.z.mul(13))
      .add(verticalWarp.mul(3.1))
      .add(world.y
        .mul(2.5)
        .sin()
        .mul(0.35))
    const tributaryPhase = world.x
      .mul(-11)
      .add(world.z.mul(21))
      .add(verticalWarp.mul(2.2))
      .sub(world.y
        .mul(1.8)
        .sin()
        .mul(0.28))
    const stream = filament(streamPhase.sin(), 0.055)
    const tributary = filament(tributaryPhase.sin(), 0.045)
    const rivulet = stream.max(tributary.mul(0.65))
    const laneRandom = mx_cell_noise_float(vec3(streamPhase
      .mul(0.16)
      .floor(), 7.3, 2.1))
    const dropPhase = world.y
      .mul(6.5)
      .add(time.mul(0.8))
      .add(laneRandom.mul(5))
      .add(near.mul(1.2))
      .fract()
    const bead = pulse01(dropPhase, 0.48, 0.1)
    const filmNoise = mx_fractal_noise_float(p.mul(3.2).add(8.4), 3, 2, 0.5)
      .mul(0.5)
      .add(0.5)
    const filmEdge = float(0.74)
      .sub(near.mul(0.17))
    const film = filmNoise.smoothstep(filmEdge, filmEdge.add(0.13))
    const droplets = cellGrain(vec3(world.x, world.y.add(time.mul(0.045)), world.z), 54, 0.985)
    const wet = film
      .mul(0.5)
      .add(rivulet.mul(bead.mul(0.75).add(0.35)))
      .add(droplets.mask
        .mul(near)
        .mul(0.85))
      .clamp()
    const pores = cellGrain(p, 34, 0.935)
    const stoneNoise = mx_fractal_noise_float(p.mul(14), 4, 2, 0.5)
      .mul(0.5)
      .add(0.5)
    const mineral = mx_noise_float(p.mul(4.1).add(vec3(3.7, -8.1, 5.4)))
      .abs()
      .smoothstep(0.45, 0.8)
    const dryStone = mix(color(hsl.integer(227, 9, 5)), color(hsl.integer(237, 4, 23)), stoneNoise)
    const mineralStone = mix(dryStone, color(hsl.integer(82, 21, 38)), mineral.mul(0.2))
    const wetTint = mix(color(hsl.integer(232, 18, 5)), color(hsl.integer(219, 46, 20)), grazing.mul(0.62))
    const wetStone = mix(mineralStone, wetTint, wet.mul(0.76))
    this.colorNode = mix(wetStone, color(hsl.integer(196, 23, 2)), pores.mask.mul(0.82))
    this.metalness = 0.06
    this.roughnessNode = float(0.78)
      .mix(0.06, wet)
      .add(pores.mask.mul(0.08))
      .clamp(0.045, 0.88)
    const streamProfile = streamPhase
      .sin()
      .abs()
      .smoothstep(0, 0.22)
      .oneMinus()
    const tributaryProfile = tributaryPhase
      .sin()
      .abs()
      .smoothstep(0, 0.2)
      .oneMinus()
    const beadProfile = dropPhase
      .sub(0.48)
      .abs()
      .smoothstep(0.09, 0.18)
      .oneMinus()
    const basaltHeight = stoneNoise
      .mul(0.003)
      .add(streamProfile.mul(0.0015))
      .add(tributaryProfile.mul(0.001))
      .add(beadProfile
        .mul(streamProfile)
        .mul(0.003))
    const basaltNormal = proceduralNormal(basaltHeight, 0.9)
    this.normalNode = basaltNormal
    this.clearcoat = 1
    this.clearcoatNode = wet
    this.clearcoatNormalNode = basaltNormal
    this.clearcoatRoughnessNode = film
      .mul(0.07)
      .add(0.022)
    this.specularIntensityNode = wet
      .mul(0.5)
      .add(0.45)
    const mica = cellGrain(p, 95, 0.991)
    const rainGlint = multiGlint(basaltNormal, 48)
    const micaGlint = multiGlint(basaltNormal, 110)
    this.emissiveNode = color(hsl.integer(225, 99, 89))
      .mul(rainGlint)
      .mul(wet)
      .mul(near.mul(0.14).add(0.025))
      .add(color(hsl.integer(75, 100, 88.4))
        .mul(mica.mask)
        .mul(micaGlint)
        .mul(intimate)
        .mul(0.9))
  }
}
