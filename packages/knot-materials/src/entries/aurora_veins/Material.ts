import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mx_noise_float, time, vec3} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const tone = (hue: Node<'float'>, shift: number) => vec3(hue.add(shift), hue.add(shift).add(2.1), hue.add(shift).add(4.2)).cos().mul(0.5).add(0.5)

/** Three curtains of polar light, hung at different depths inside black glass. Circling slides you between the sheets. Coming close lifts the violet curtain and makes the green one flutter. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.05)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const curtain = (depth: number, seed: number, scale: number) => {
      const q = p.sub(view.mul(depth))
      const warp = mx_noise_float(q.mul(1.3).add(seed)).mul(1.6)
      const column = q.x.mul(scale).add(q.z.mul(scale * 0.65)).add(warp).add(time.mul(0.08))
      const fall = q.y.mul(2.4).add(time.mul(0.35)).add(warp)
      const sheet = column.add(fall.sin().mul(0.7))
      const wave = sheet.sin()
      return {
        body: wave.abs().smoothstep(0.72, 0.08).mul(fall.cos().mul(0.25).add(0.75)),
        edge: filament(wave, 0.12),
        hue: column,
      }
    }
    const green = curtain(0.03, 0.2, 1.15)
    const violet = curtain(0.18, 3.4, 1.7)
    const rose = curtain(0.34, 6.6, 2.3)
    const light = tone(green.hue, 0.4).mul(green.edge.mul(1.4).add(green.body.mul(0.35)))
      .add(tone(violet.hue, 2.2).mul(violet.edge.mul(1.2).add(violet.body.mul(0.25))))
      .add(tone(rose.hue, 4.4).mul(rose.edge.mul(1.6).add(rose.body.mul(0.2))).mul(near.mul(0.6).add(0.4)))
    this.colorNode = color(hsl.integer(259, 25, 4))
    this.metalness = 0
    this.roughnessNode = float(0.45).add(grazing.mul(0.2))
    this.clearcoat = 0.25
    this.clearcoatRoughness = 0.08
    this.transmission = 0.15
    this.thickness = 0.4
    this.ior = 1.45
    this.iridescenceNode = grazing.mul(0.45)
    this.iridescenceIOR = 1.25
    this.iridescenceThicknessNode = float(180).add(facing.mul(200))
    this.emissiveNode = light.mul(1.5)
      .add(color(hsl.integer(169, 100, 97.8)).mul(green.edge).mul(0.4))
      .add(color(hsl.integer(344, 100, 89)).mul(rose.edge).mul(near).mul(0.5))
      .add(color(hsl.integer(173, 99, 94.3)).mul(grazing.pow(4)).mul(intimate).mul(0.25))
  }
}
