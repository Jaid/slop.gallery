import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A dry chitin membrane is deliberately satin rather than wet. Copper-colored ribs rise above shallowly sagging cells, and their network is sampled beneath the face to create movement with parallax. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.42)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const membraneNoise = mx_noise_float(p.mul(4.8)).mul(0.5).add(0.5)
    const underSkin = p.sub(view.mul(0.047))
    const reticulumField = cellularBoundary(underSkin.mul(9.4).add(membraneNoise.mul(0.55)))
    const reticulum = opticalLine(reticulumField, 0.025).mul(near.mul(0.4).add(0.6))
    const principalA = filament(underSkin.dot(vec3(0.71, -0.22, 0.67)).mul(17).sin(), 0.045)
    const principalB = filament(underSkin.dot(vec3(-0.38, 0.86, 0.34)).mul(11).sin().add(membraneNoise.sub(0.5).mul(0.32)), 0.052).mul(0.72)
    const veins = principalA.max(principalB).max(reticulum.mul(0.68))
    const pores = cellularPoints(underSkin.mul(46), 0.02, 0.15, 0.73).mul(intimate)
    const reliefReticulum = reticulumField.abs().smoothstep(0.018, 0.07).oneMinus()
    const reliefPrincipalA = underSkin.dot(vec3(0.71, -0.22, 0.67)).mul(17).sin().abs().smoothstep(0.12, 0.3).oneMinus()
    const reliefPrincipalB = underSkin.dot(vec3(-0.38, 0.86, 0.34)).mul(11).sin().add(membraneNoise.sub(0.5).mul(0.32)).abs().smoothstep(0.14, 0.34).oneMinus().mul(0.72)
    const reliefVeins = reliefPrincipalA.max(reliefPrincipalB).max(reliefReticulum.mul(0.68))
    const cellDepth = reticulumField.abs().smoothstep(0.02, 0.2).mul(0.5).add(0.5)
    const vellum = mix(color(hsl.integer(129, 58, 42)), color(hsl.integer(113, 63, 89.5)), membraneNoise.mul(0.52).add(facing.mul(0.1)).clamp())
    const copper = mix(color(hsl.integer(45, 70, 13)), color(hsl.integer(47, 82, 49)), membraneNoise.mul(0.55).add(0.16).clamp())
    const thinFilm = mix(color(hsl.integer(173, 46, 69)), color(hsl.integer(83, 52, 76)), view.dot(vec3(0.4, 0.25, 0.88).normalize()).mul(0.5).add(0.5))
    const membraneMask = veins.oneMinus()
    const height = veins.mul(0.78).sub(cellDepth.mul(membraneMask).mul(0.14)).add(pores.mul(0.12))
    this.positionNode = p.add(normalLocal.mul(reliefVeins.mul(0.008).sub(cellDepth.mul(reliefVeins.oneMinus()).mul(0.0007))))
    this.colorNode = mix(mix(vellum, thinFilm, grazing.pow(1.85).mul(membraneMask).mul(0.2)), copper, veins.mul(0.92).add(pores.mul(0.1)).clamp())
    this.metalnessNode = veins.mul(0.64)
    this.roughnessNode = mix(float(0.56), float(0.2), veins).add(pores.mul(0.05)).clamp(0.16, 0.64)
    this.transmission = 0.48
    this.thickness = 0.18
    this.ior = 1.36
    this.dispersion = 0.018
    this.attenuationColor.set(hsl.integer(130, 53, 70))
    this.attenuationDistance = 1.9
    this.clearcoat = 0
    this.sheen = 0.55
    this.sheenNode = color(hsl.integer(95, 67, 92)).mul(membraneMask.mul(0.6).add(veins.mul(0.08)))
    this.sheenColor.set(hsl.integer(95, 67, 92))
    this.sheenRoughness = 0.76
    this.iridescence = 0.32
    this.iridescenceIOR = 1.32
    this.iridescenceNode = grazing.pow(1.7).mul(membraneMask).mul(0.72)
    this.iridescenceThicknessNode = membraneNoise.mul(105).add(355)
    const wingNormal = proceduralNormal(height, 0.00094)
    this.normalNode = wingNormal
    this.clearcoatNormalNode = wingNormal
    const veinGlint = glints(wingNormal, 96).mul(veins).mul(near)
    this.emissiveNode = color(hsl.integer(89, 60, 77)).mul(veinGlint).mul(0.06).add(color(hsl.integer(132, 66, 78)).mul(membraneMask).mul(grazing.pow(2.8)).mul(near).mul(0.032)).add(thinFilm.mul(grazing.pow(3)).mul(pores).mul(intimate).mul(0.025))
  }
}
