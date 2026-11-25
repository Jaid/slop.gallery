import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalLocal, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

function plumeLine(field: Node<'float'>, width: number) {
  const footprint = field.fwidth().max(0.0001)
  return field.abs().smoothstep(width, footprint.mul(1.2).add(width)).oneMinus()
}
function ellipse(point: Node<'vec2'>, radii: [number, number]) {
  return vec2(point.x.div(radii[0]), point.y.div(radii[1])).length()
}
/** Layered firebird feathers with microscopic barbs, metallic eyes and a traveling ignition. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.88)
    this.name = knotData.id
    const tube = uv()
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const row = tube.y.mul(4).floor()
    const tiled = vec2(tube.x.mul(26).add(row.mul(0.5)), tube.y.mul(4))
    const local = tiled.fract().sub(0.5)
    const identityCell = vec2(tube.x.mul(26).floor(), row)
    const random = cellNoiseVec3(vec3(wrapCell(identityCell, vec2(26, 4)), 31.8))
    const progress = local.y.add(0.5)
    const halfWidth = progress.mul(Math.PI).sin().mul(0.31).add(progress.oneMinus().mul(0.1)).add(0.025)
    const shapeField = local.x.abs().div(halfWidth).sub(1)
    const shapeFootprint = shapeField.fwidth().max(0.002)
    const feather = shapeField.smoothstep(0, shapeFootprint.mul(1.25)).oneMinus()
    const rawFeather = shapeField.smoothstep(-0.02, 0.04).oneMinus()
    const edge = plumeLine(shapeField, 0.035).mul(feather)
    const shaft = plumeLine(local.x, 0.012).mul(progress.smoothstep(0.04, 0.2)).mul(feather)
    const barbPhaseA = local.x.mul(116).add(progress.mul(31).add(random.x.mul(7)))
    const barbPhaseB = local.x.mul(116).sub(progress.mul(29).add(random.y.mul(7)))
    const barbs = opticalBands(barbPhaseA).mul(opticalBands(barbPhaseB)).mul(near).mul(feather)
    const eyePoint = vec2(local.x, progress.sub(0.39))
    const eyeRadius = ellipse(eyePoint, [0.235, 0.17])
    const eye = eyeRadius.smoothstep(0.98, 1.05).oneMinus().mul(feather)
    const eyeMiddle = eyeRadius.smoothstep(0.58, 0.66).oneMinus()
    const eyeCore = eyeRadius.smoothstep(0.24, 0.32).oneMinus()
    const eyeRing = eye.mul(eyeMiddle.oneMinus())
    const colorShift = view.dot(vec3(0.66, -0.31, 0.68).normalize()).mul(2.8).add(random.z.mul(4.5)).add(grazing.mul(2.2))
    const structuralColor = spectralColor(colorShift)
    const ember = mix(color(hsl.integer(22, 95, 20)), color(hsl.integer(44, 97, 62)), progress.pow(1.2))
    const goldenTip = mix(ember, color(hsl.integer(87, 100, 86.6)), progress.smoothstep(0.72, 0.98).mul(0.75))
    const featherColor = mix(goldenTip, structuralColor.mul(0.62).add(0.12), eyeRing.mul(0.9))
    const eyeColor = mix(color(hsl.integer(264, 68, 9)), color(hsl.integer(207, 88, 70)), facing.mul(0.38).add(random.x.mul(0.2)))
    let surface: Node<'vec3'> = mix(color(hsl.integer(356, 74, 5)), featherColor, feather)
    surface = mix(surface, eyeColor, eyeMiddle)
    surface = mix(surface, color(hsl.integer(320, 58, 3.4)), eyeCore)
    surface = mix(surface, color(hsl.integer(86, 100, 90.7)), shaft.mul(0.72).add(edge.mul(0.24)).clamp())
    surface = surface.mul(barbs.mul(0.11).add(0.94))
    this.colorNode = surface
    const gilding = shaft.mul(0.7).add(edge.mul(0.18)).add(progress.smoothstep(0.87, 1).mul(feather).mul(0.35)).clamp()
    this.metalnessNode = eyeRing.mul(0.72).add(gilding.mul(0.88)).add(feather.mul(0.08)).clamp()
    this.roughnessNode = mix(float(0.58), float(0.18), eyeRing.max(gilding)).sub(barbs.mul(0.08)).clamp(0.12, 0.72)
    this.clearcoatNode = eye.mul(0.5).add(feather.mul(0.12)).clamp()
    this.clearcoatRoughness = 0.085
    this.iridescenceNode = eyeRing.mul(0.95).add(feather.mul(grazing.pow(2)).mul(0.24)).clamp()
    this.iridescenceIOR = 1.34
    this.iridescenceThicknessNode = random.y.mul(380).add(progress.mul(220)).add(120)
    this.anisotropy = 0.8
    this.anisotropyNode = vec2(feather.mul(0.72), 0)
    const overlap = rawFeather.mul(progress.oneMinus().mul(0.0055).add(0.0012))
    this.positionNode = positionGeometry.add(normalLocal.mul(overlap))
    this.normalNode = proceduralNormal(overlap.add(shaft.mul(0.004)).add(edge.mul(0.0018)).add(barbs.mul(0.00045)), 1)
    const ignitionPhase = tube.x.mul(TAU * 3).sub(time.mul(0.68)).add(row.mul(0.9))
    const ignition = ignitionPhase.sin().mul(0.5).add(0.5).pow(12).mul(progress.smoothstep(0.68, 0.98)).mul(feather)
    const eyeAwake = time.mul(0.37).add(random.x.mul(TAU)).sin().mul(0.5).add(0.5).pow(7).mul(eyeCore).mul(intimate)
    this.emissiveNode = mix(color(hsl.integer(30, 100, 58.2)), color(hsl.integer(86.6, 100, 86.6)), progress).mul(ignition).mul(0.85).add(structuralColor.mul(eyeAwake).mul(0.5)).add(color(hsl.integer(68, 100, 79.6)).mul(edge).mul(grazing.pow(3)).mul(0.1))
  }
}
