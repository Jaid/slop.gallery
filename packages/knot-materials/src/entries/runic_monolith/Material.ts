import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** carved dark stone; a teal ignition wave sweeps the glyphs, gold leaf glints inside the grooves */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.6
    const {p, facing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const gx = tube.x.mul(64)
    const gy = tube.y.mul(4)
    const rnd = cellNoiseVec3(vec3(gx.floor(), gy.floor(), 5.5))
    const rnd2 = cellNoiseVec3(vec3(gx.floor(), gy.floor(), 9.2))
    const local = vec2(gx.fract(), gy.fract())
    const stroke = (r: Node<'vec3'>, offset: number) => opticalLine(local.x.mul(r.x.mul(4).sub(2)).add(local.y.mul(r.y.mul(4).sub(2))).add(r.z.mul(2).sub(1)).add(offset), 0.05)
    const window = local.x.smoothstep(0.1, 0.2).mul(local.x.smoothstep(0.8, 0.9).oneMinus()).mul(local.y.smoothstep(0.15, 0.25)).mul(local.y.smoothstep(0.75, 0.85).oneMinus())
    const glyph = stroke(rnd, 0).max(stroke(rnd2, 0.35)).max(stroke(rnd.mul(rnd2), 0.7)).mul(window)
    const stone = mx_fractal_noise_float(p.mul(9), 4, 2, 0.5).mul(0.5).add(0.5)
    const sweep = tube.x.mul(Math.PI * 4).sub(time.mul(0.9)).sin().mul(0.5).add(0.5).pow(5)
    const faceBoost = facing.pow(3).mul(0.8).add(0.35)
    const veins = filament(mx_fractal_noise_float(p.mul(12), 3, 2, 0.5), 0.02).mul(intimate)
    this.colorNode = mix(mix(color(hsl.integer(279, 17, 10)), color(hsl.integer(270, 20, 17)), stone), color(hsl.integer(76, 58, 42)), glyph.mul(0.85))
    this.metalnessNode = glyph.mul(0.9)
    this.roughnessNode = float(0.9).sub(glyph.mul(0.55)).clamp()
    this.clearcoat = 0.1
    this.clearcoatRoughness = 0.6
    this.normalNode = proceduralNormal(glyph.mul(0.9).add(stone.mul(0.2)), 0.0016)
    this.emissiveNode = color(hsl.integer(172, 99, 88)).mul(glyph).mul(sweep.mul(1.2).add(0.25)).mul(faceBoost).mul(near.mul(0.6).add(0.45))
      .add(color(hsl.integer(85, 100, 88.5)).mul(glyph).mul(glints(normalViewGeometry, 70)).mul(0.6))
      .add(color(hsl.integer(176, 99.9, 87.9)).mul(veins).mul(0.5))
      .add(color(hsl.integer(172, 92, 52)).mul(rim).mul(0.25))
  }
}
