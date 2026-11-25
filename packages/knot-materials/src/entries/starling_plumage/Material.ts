import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentLocal, color, float, mix, normalLocal, tangentLocal, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Broad, overlapping coverts are large enough to read as feathers from across the room. Each vane has a raised rachis and diagonal barb grooves; a separate tangent-aligned lobe turns their melanin black into cobalt and bottle green. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.58)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const rows = tube.y.mul(7).floor()
    const featherGrid = vec2(tube.x.mul(15).add(rows.mod(2).mul(0.5)), tube.y.mul(7))
    const cell = featherGrid.floor()
    const point = featherGrid.fract().sub(0.5)
    const identity = cellNoiseVec3(vec3(cell.x.mod(15), cell.y.mod(7), 17.2))
    const bowedY = point.y.sub(point.x.mul(point.x).mul(identity.x.sub(0.5)).mul(0.18))
    const progress = point.x.add(0.5)
    const halfWidth = progress.mul(progress.oneMinus()).max(0).sqrt().mul(0.84).add(0.068)
    const footprint = featherGrid.fwidth().length().max(0.001)
    const vane = bowedY.abs().smoothstep(halfWidth.sub(footprint), halfWidth.add(footprint)).oneMinus().mul(progress.smoothstep(0.015, 0.075))
    const vaneRelief = bowedY.abs().smoothstep(halfWidth.mul(0.92), halfWidth.mul(1.06)).oneMinus().mul(progress.smoothstep(0.01, 0.075))
    const shaft = hairline(bowedY, 0.019).mul(vane)
    const contour = hairline(bowedY.abs().sub(halfWidth.mul(0.93)), 0.016).mul(vane)
    const barbPhase = bowedY.mul(20).add(point.x.mul(identity.y.mul(4).add(8))).add(identity.z.mul(TAU))
    const barbs = barbPhase.sin().abs().smoothstep(0.82, 0.95).mul(vane).mul(near.mul(0.72).add(0.28))
    const tangent = vec3(tangentLocal).normalize()
    const bitangent = vec3(bitangentLocal as unknown as Node<'vec3'>).normalize()
    const barbAngle = identity.x.mul(TAU).add(point.x.mul(0.65)).add(time.mul(0.013))
    const barbDirection = tangent.mul(barbAngle.cos()).add(bitangent.mul(barbAngle.sin())).normalize()
    const turn = view.dot(barbDirection).abs().smoothstep(0.28, 0.78).pow(1.15)
    const pigment = mix(color(hsl.integer(234, 100, 1)), color(hsl.integer(226, 46, 4)), identity.z.mul(0.13).add(facing.mul(0.025)).clamp())
    const structural = shaft.mul(0.82).add(contour.mul(0.25)).add(barbs.mul(intimate).mul(0.43)).clamp()
    const featherBody = mix(pigment, mix(color(hsl.integer(208, 39, 9)), color(hsl.integer(164, 31, 16)), identity.z), structural.mul(0.34))
    const flashColor = mix(color(hsl.integer(246, 100, 42)), color(hsl.integer(158, 100, 59)), identity.y)
    const flash = turn.pow(1.75).mul(vane).mul(grazing.mul(0.12).add(0.88))
    const flockGlints = cellularPoints(p.mul(24), 0.035, 0.17, 0.68).mul(vane).mul(near.mul(0.6).add(0.4))
    const plumageFlash = flash.mul(barbs.mul(0.5).add(shaft.mul(0.14)).add(flockGlints.mul(0.56)).add(0.24).clamp())
    this.positionNode = p.add(normalLocal.mul(vaneRelief.mul(progress.oneMinus().mul(0.42).add(0.58)).mul(0.009)))
    const rachisColor = mix(color(hsl.integer(188, 56, 13)), color(hsl.integer(129, 42, 40)), identity.x)
    this.colorNode = mix(mix(featherBody, rachisColor, shaft.mul(0.38).add(barbs.mul(intimate).mul(0.11)).clamp()), flashColor, plumageFlash.mul(0.98))
    this.metalness = 0
    this.roughnessNode = float(0.61).sub(plumageFlash.mul(0.38)).sub(shaft.mul(0.09)).add(contour.mul(0.07)).clamp(0.13, 0.76)
    this.anisotropy = 0.76
    this.anisotropyNode = vec2(0.76, 0)
    this.sheen = 0.42
    this.sheenNode = flashColor.mul(plumageFlash.mul(0.98).add(grazing.pow(2.2).mul(vane).mul(0.006)))
    this.sheenRoughness = 0.36
    this.clearcoat = 0
    const featherNormal = proceduralNormal(vane.mul(0.15).add(shaft.mul(0.92)).add(contour.mul(0.44)).add(barbs.mul(intimate).mul(0.4)), 0.00135)
    this.normalNode = featherNormal
    this.emissiveNode = flashColor.mul(plumageFlash.pow(1.5)).mul(near.mul(0.06).add(0.008))
  }
}
