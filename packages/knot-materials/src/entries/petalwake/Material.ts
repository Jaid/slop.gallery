import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, time, uv, vec2, vec3} from 'three/tsl'

import {fill, stroke} from '../../candidates/gpt_sol/lib/exhibition/coverage.ts'
import {filteredCos, resolved} from '../../candidates/gpt_sol/lib/exhibition/fields.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import data from './data.ts'

/** Two overlapping courses of shell petals. The enamel stays smooth while their ribbed substrate breathes. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = data.id
    const tube = uv()
    const {facing, grazing, intimate} = viewerFrame()
    const count = vec2(44, 5)
    const domain = tube.mul(count)
    const foot = domain.fwidth().length().max(0.00001)
    let pigment: Node<'vec3'> = color(hsl.integer(193, 71, 27)).mul(1)
    let relief: Node<'float'> = float(0)
    let nacre: Node<'float'> = float(0)
    let ribs: Node<'float'> = float(0)
    let seam: Node<'float'> = float(0)
    for (const layer of [0, 1]) {
      const q = domain.add(vec2(layer * 0.5, layer * 0.5))
      const cell = wrapCell(q.floor(), count)
      const random = cellNoiseVec3(vec3(cell, 14 + layer))
      const local = q.fract().sub(0.5)
      const breathing = time.mul(0.38).add(cell.x.mul(0.37)).add(random.z.mul(6)).sin()
      const radius = vec2(local.x.div(local.y.mul(-0.23).add(0.43)), local.y.div(0.48)).length().toVar()
      const petal = fill(radius.sub(1), foot.mul(2.4)).toVar()
      const dome = radius.pow2().oneMinus().max(0).toVar()
      const edge = stroke(radius.sub(0.94), 0.026, foot.mul(2.4)).mul(petal).toVar()
      const angle = mx_atan2(local.x, local.y.add(0.57)) as unknown as Node<'float'>
      const phase = angle.mul(64).add(radius.mul(9)).add(breathing.mul(0.23))
      const rib = filteredCos(phase).mul(0.5).add(0.5).mul(dome).mul(resolved(foot, 0.08, 0.8)).toVar()
      const shell = mix(color(hsl.integer(45, 61, 90)), color(hsl.integer(139, 41, 94.4)), random.y)
      const blush = mix(shell, color(hsl.integer(5, 74, 44)), local.y.mul(-0.6).add(0.15).clamp().mul(random.x.mul(0.7).add(0.35)))
      const film = spectralColor(facing.mul(13).add(radius.mul(5.5)).add(random.x.mul(3)).add(breathing.mul(0.12))).toVar()
      const opal = mix(blush, film.mul(0.59).add(0.055), grazing.pow(1.35).mul(0.72).add(rib.mul(0.09))).toVar()
      pigment = mix(pigment, opal.mul(edge.mul(-0.16).add(1)), petal)
      relief = mix(relief, dome.mul(breathing.mul(0.12).add(1)).mul(0.0038).add(rib.mul(0.00024)), petal)
      nacre = mix(nacre, random.x.mul(0.28).add(0.6), petal)
      ribs = mix(ribs, rib, petal)
      seam = mix(seam, edge, petal)
    }
    this.colorNode = pigment
    this.metalness = 0.23
    this.roughnessNode = float(0.26).sub(ribs.mul(0.065)).add(seam.mul(0.12))
    this.normalNode = proceduralNormal(relief, intimate.mul(0.25).add(0.65))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.085
    this.iridescenceNode = nacre.mul(grazing.mul(0.55).add(0.2))
    this.iridescenceIOR = 1.38
    this.iridescenceThicknessNode = ribs.mul(90).add(nacre.mul(180)).add(280)
    this.sheen = 0.18
    this.sheenColor.set(hsl.integer(37, 100, 92))
    this.sheenRoughness = 0.4
    this.emissiveNode = pigment.mul(seam).mul(grazing.pow(3)).mul(0.07)
  }
}
