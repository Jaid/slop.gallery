import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentView, color, float, mix, mx_atan2, positionViewDirection, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import {fill, stroke} from '../../candidates/gpt_sol/lib/exhibition/coverage.ts'
import {filteredCos, resolved} from '../../candidates/gpt_sol/lib/exhibition/fields.ts'
import {wavelength} from '../../candidates/gpt_sol/lib/exhibition/optics.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import data from './data.ts'

/** Security-foil guilloché: rotating local diffraction axes reveal different spectral orders. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = data.id
    const tube = uv()
    const {grazing, near, intimate} = viewerFrame()
    const grid = vec2(14, 2)
    const q = tube.mul(grid)
    const local = q.fract().sub(0.5)
    const identity = cellNoiseVec3(vec3(wrapCell(q.floor(), grid), 37.8))
    const r = local.length().max(0.0001).toVar()
    const angle = mx_atan2(local.y, local.x.add(0.000001)) as unknown as Node<'float'>
    const foot = q.fwidth().length().max(0.00001)
    const angleFoot = foot.div(r.max(0.08))
    const rose = angle.mul(7).cos().mul(0.055).add(angle.mul(13).sin().mul(0.021)).toVar()
    const groovePhase = r.add(rose).mul(175).add(identity.x.mul(TAU)).add(time.mul(0.08))
    const groove = stroke(filteredCos(groovePhase), 0.14, foot.mul(185)).mul(resolved(foot.mul(185), 0.6, 3.8)).toVar()
    const counterPhase = r.mul(131).sub(angle.mul(5).sin().mul(4.2)).sub(time.mul(0.055))
    const counter = stroke(filteredCos(counterPhase), 0.09, foot.mul(155)).mul(resolved(foot.mul(155), 0.7, 4)).toVar()
    const ring = stroke(r.sub(0.385), 0.009, foot).max(stroke(r.sub(0.27), 0.004, foot)).toVar()
    const rays = angle.mul(48).cos().smoothstep(0.8, 0.96).mul(resolved(angleFoot.mul(48), 0.5, 2)).mul(stroke(r.sub(0.327), 0.014, foot)).toVar()
    const emblem = stroke(r.sub(0.075), 0.006, foot).add(stroke(local.x.abs().add(local.y.abs()).sub(0.11), 0.007, foot)).clamp()
    const medallion = fill(r.sub(0.43), foot).toVar()
    const etching = groove.mul(0.75).max(counter.mul(0.5)).max(ring).max(rays).max(emblem).mul(medallion).toVar()
    const orientation = tube.x.mul(TAU * 3).add(tube.y.mul(TAU)).add(identity.z.mul(medallion).mul(0.45)).toVar()
    const V = positionViewDirection
    const viewAlong = V.dot(tangentView.normalize())
    const viewAround = V.dot(vec3(bitangentView as unknown as Node<'vec3'>).normalize())
    const dispersion = viewAlong.mul(orientation.cos()).add(viewAround.mul(orientation.sin()))
    const nm = dispersion.mul(210).add(515).add(r.mul(125).add(rose.mul(250)).mul(medallion))
    const first = wavelength(nm)
    const second = wavelength(nm.add(95)).mul(0.22)
    const diffracted = first.add(second).toVar()
    const brush = filteredCos(tube.y.mul(TAU * 1350).add(tube.x.mul(TAU * 29))).mul(intimate).toVar()
    const foil = mix(color(hsl.integer(236, 46, 17)), diffracted.mul(0.67).add(0.055), grazing.mul(0.45).add(0.43)).toVar()
    this.colorNode = mix(foil, color(hsl.integer(181, 32, 86)).mul(0.6).add(diffracted.mul(0.5)), etching.mul(0.8)).mul(brush.mul(0.035).add(0.97))
    this.metalness = 0.94
    this.roughnessNode = float(0.27).sub(etching.mul(0.08)).add(brush.mul(0.025))
    this.anisotropyNode = vec2(orientation.cos(), orientation.sin()).mul(0.63)
    this.normalNode = proceduralNormal(etching.mul(0.00065).add(brush.mul(0.000055)), 0.75)
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.13
    this.iridescenceNode = etching.mul(0.4).add(0.35)
    this.iridescenceThicknessNode = nm.mul(0.65).add(180)
    this.iridescenceIOR = 1.32
    this.emissiveNode = diffracted.mul(etching).mul(grazing.mul(0.11).add(0.025)).mul(near.mul(0.3).add(0.7))
  }
}
