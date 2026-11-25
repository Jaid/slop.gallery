import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Walnut grain runs with the tube while alternating maple leaves turn across it. A dark knife joint separates them from proud brass stringing, allowing the surface to read as fitted veneer rather than a printed pattern. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.84)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const burl = mx_noise_float(p.mul(4.5)).mul(0.5).add(0.5)
    const joineryGrid = tube.mul(vec2(7, 4))
    const cell = joineryGrid.floor()
    const local = joineryGrid.fract().sub(0.5)
    const identity = cellNoiseVec3(vec3(cell.x.mod(7), cell.y.mod(4), 29.4))
    const diamondDistance = local.x.abs().add(local.y.abs())
    const mapleInset = diamondDistance.smoothstep(0.29, 0.45).oneMinus()
    const brassFillet = hairline(diamondDistance.sub(0.415), 0.032)
    const knifeJoint = hairline(diamondDistance.sub(0.462), 0.017).mul(mapleInset.oneMinus())
    const pinstripe = hairline(local.x.add(local.y.mul(identity.y.sub(0.5).mul(0.24))), 0.018).mul(mapleInset)
    const sunburst = hairline(local.x.add(local.y), 0.014).max(hairline(local.x.sub(local.y), 0.014)).mul(mapleInset).mul(intimate)
    const inlay = brassFillet.add(pinstripe.mul(0.66)).add(sunburst.mul(0.28)).clamp()
    const walnutPhase = tube.y.mul(TAU * 52).add(tube.x.mul(TAU * 4)).add(burl.mul(5.2)).add(mx_noise_float(p.mul(17)).mul(1.3))
    const walnutGrain = opticalBands(walnutPhase).mul(0.68).add(opticalBands(walnutPhase.mul(0.31).add(3.7)).mul(0.32))
    const mapleCoordinate = local.x.mul(15).add(local.y.mul(31)).add(identity.z.mul(7)).add(burl.mul(2.5))
    const mapleFigure = opticalBands(mapleCoordinate).mul(0.65).add(opticalBands(mapleCoordinate.mul(0.42).add(2.8)).mul(0.35))
    const walnut = mix(color(hsl.integer(45, 100, 4.5)), color(hsl.integer(38, 93, 31)), walnutGrain.mul(0.62).add(burl.mul(0.13)).clamp())
    const maple = mix(color(hsl.integer(44, 86, 29)), color(hsl.integer(79, 77, 82.3)), mapleFigure.mul(0.63).add(identity.z.mul(0.11)).clamp())
    const brass = mix(color(hsl.integer(49, 93, 33)), color(hsl.integer(88, 100, 87.7)), walnutGrain.mul(0.38).add(grazing.mul(0.18)).clamp())
    const aurora = mix(color(hsl.integer(182, 93.5, 72)), color(hsl.integer(306, 71, 58)), view.y.mul(0.5).add(0.5))
    const veneer = mix(walnut, maple, mapleInset)
    const assembled = mix(veneer, color(hsl.integer(43, 18, 4)), knifeJoint)
    const reliefFillet = diamondDistance.sub(0.415).abs().smoothstep(0.008, 0.048).oneMinus()
    const reliefKnife = diamondDistance.sub(0.462).abs().smoothstep(0.005, 0.024).oneMinus().mul(mapleInset.oneMinus())
    this.positionNode = p.add(normalLocal.mul(reliefFillet.mul(0.0075).add(mapleInset.mul(0.0008)).sub(reliefKnife.mul(0.0011))))
    const brassMask = brassFillet.add(sunburst.mul(0.28)).clamp()
    this.colorNode = mix(mix(assembled, brass, brassMask), aurora, pinstripe.mul(0.74))
    this.metalnessNode = brassMask
    this.roughnessNode = mix(float(0.47), float(0.08), brassMask).sub(walnutGrain.mul(mapleInset.oneMinus()).mul(0.06)).sub(mapleFigure.mul(mapleInset).mul(0.09)).add(knifeJoint.mul(0.12)).clamp(0.065, 0.5)
    this.anisotropy = 0.6
    this.anisotropyNode = vec2(0.6, 0)
    this.clearcoat = 0.14
    this.clearcoatRoughness = 0.16
    const veneerHeight = walnutGrain.mul(mapleInset.oneMinus()).mul(0.32).add(mapleFigure.mul(mapleInset).mul(0.26)).add(inlay.mul(0.7)).sub(knifeJoint.mul(0.34)).add(burl.mul(0.06))
    const woodNormal = proceduralNormal(veneerHeight, 0.00105)
    this.normalNode = woodNormal
    this.clearcoatNormalNode = proceduralNormal(burl, 0.00013)
    const brassGlint = glints(woodNormal, 112).mul(brassMask).mul(near)
    this.emissiveNode = color(hsl.integer(84, 75, 85)).mul(brassGlint).mul(intimate.mul(0.12).add(0.01)).add(aurora.mul(pinstripe).mul(near.mul(0.1).add(0.018)))
  }
}
