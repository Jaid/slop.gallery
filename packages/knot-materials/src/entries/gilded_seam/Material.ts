import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, normalLocal, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filament} from '../../lib/filament.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Celadon kept dim enough for the room to model it. Gold seams kindle as the camera approaches and flare when the light skims them. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.42)
    this.name = knotData.id
    const {p, view, facing, grazing, objectDistance} = viewerFrame()
    const proximity = objectDistance.smoothstep(1.45, 4.4).oneMinus()
    const warp = mx_noise_vec3(p.mul(1.35)).mul(0.36)
    const trigField = p.dot(vec3(2.4, 4.6, 1.4)).add(warp.x.mul(2.2)).sin().mul(0.58)
      .add(p.dot(vec3(-3.4, 2.1, 3.8)).add(warp.y.mul(2.2)).sin().mul(0.42))
    const major = cellularBoundary(p.add(warp).mul(2.7))
    const primary = filteredRibbon(trigField, 0.11)
    const secondary = filteredRibbon(major, 0.008).mul(0.55)
    const gold = primary.max(secondary).clamp(0, 1)
    const halo = trigField.abs().smoothstep(0.02, 0.32).oneMinus()
    const glazeNoise = mx_noise_float(p.mul(2.4)).mul(0.5).add(0.5)
    const porcelain = mix(color(hsl.integer(185, 35, 20)), color(hsl.integer(174, 20, 61)), facing.pow(0.65).mul(0.85).add(glazeNoise.mul(0.15)))
    const freckles = cellularPoints(p.mul(14), 0.045, 0.14, 0.7)
    const body = mix(porcelain, color(hsl.integer(36, 51, 41)), freckles.mul(gold.oneMinus()).mul(0.35))
    const craze = filament(p.x.mul(30).sin().add(p.y.mul(23).sin()).add(p.z.mul(27).sin()), 0.5).mul(proximity).mul(gold.oneMinus())
    const crazed = mix(body, body.mul(0.55), craze.mul(0.8))
    const goldAngle = view.dot(vec3(0.2, 0.96, 0.18).normalize()).mul(0.5).add(0.5)
    const goldColor = mix(color(hsl.integer(69, 80, 34)), color(hsl.integer(85, 100, 88.5)), facing.pow(0.45).mul(0.62).add(goldAngle.mul(0.38)))
    this.colorNode = mix(mix(crazed, goldColor, halo.mul(proximity).mul(0.28)), goldColor, gold)
    this.metalnessNode = gold.mul(0.98)
    this.roughnessNode = mix(float(0.48), float(0.18), gold).clamp(0.1, 0.62)
    this.clearcoatNode = gold.oneMinus().mul(0.28).add(0.04)
    this.clearcoatRoughness = 0.12
    this.ior = 1.52
    this.sheenNode = color(hsl.integer(85, 38, 91.5)).mul(gold.oneMinus()).mul(0.06)
    this.sheenRoughness = 0.6
    const pulse = time.mul(0.6).add(p.y.mul(3)).sin().mul(0.14).add(0.86)
    this.emissiveNode = color(hsl.integer(54, 100, 70.8)).mul(gold).mul(proximity.mul(0.9).add(0.08)).mul(pulse).mul(0.85)
      .add(color(hsl.integer(92, 100, 94.7)).mul(primary).mul(grazing.pow(1.15)).mul(0.7))
      .add(color(hsl.integer(65, 100, 79)).mul(halo).mul(proximity).mul(0.22))
    const goldApprox = trigField.abs().smoothstep(0.03, 0.24).oneMinus()
    this.normalNode = proceduralNormal(glazeNoise.sub(gold.mul(2.2)), 0.01)
    this.positionNode = p.add(normalLocal.mul(goldApprox.mul(-0.0045)))
  }
}
