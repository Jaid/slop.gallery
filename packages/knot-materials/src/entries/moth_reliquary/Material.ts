import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {palette} from '../../candidates/grok/lib/palette.ts'
import {screenFill, screenRibbon} from '../../candidates/grok/lib/screenRibbon.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Overlapping wing scales. Each scale is a curved tile with its own structural color, and the eyespots bloom only inside the near camera distance. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const period = vec2(18, 6)
    const tile = tube.mul(period)
    const cell = wrapCell(tile.floor(), period)
    const local = tile.fract()
    const id = cellNoiseVec3(vec3(cell, 11.2))
    const along = local.y
    const width = along.oneMinus().mul(0.34).add(0.1).add(id.x.mul(0.04))
    const side = local.x.sub(0.5).abs()
    const scaleMask = screenFill(side.sub(width)).mul(screenFill(along.sub(0.92))).mul(screenFill(along.negate().add(0.04)))
    const overlap = screenFill(side.sub(width.mul(0.72))).oneMinus().mul(scaleMask)
    const ridge = screenRibbon(local.x.sub(0.5), 0.05).mul(scaleMask)
    const barb = screenRibbon(local.y.mul(9).sin().sub(local.x.sub(0.5).mul(0.4)), 0.22).mul(scaleMask)
    const hue = palette(id.y.mul(0.82).add(view.y.mul(0.12)).add(grazing.mul(0.2)).fract(), [{
      at: 0,
      rgb: hsl.integer(43, 28, 9),
    }, {
      at: 0.22,
      rgb: hsl.integer(43, 90, 51),
    }, {
      at: 0.42,
      rgb: hsl.integer(77, 72, 81),
    }, {
      at: 0.62,
      rgb: hsl.integer(329, 69, 35),
    }, {
      at: 0.82,
      rgb: hsl.integer(185, 81, 39),
    }, {
      at: 1,
      rgb: hsl.integer(47, 35, 11),
    }])
    const dust = mix(color(hsl.integer(60, 33, 12)), hue, scaleMask)
    const eyePhase = cell.x.mul(0.37).add(cell.y.mul(0.21))
    const eyeGate = eyePhase.sin().abs().smoothstep(0.82, 0.93)
    const eyeLocal = local.sub(vec2(0.5, 0.58))
    const eyeRadius = eyeLocal.length()
    const ring = eyeRadius.smoothstep(0.34, 0.12).mul(eyeRadius.smoothstep(0.05, 0.16))
    const pupil = eyeRadius.smoothstep(0.11, 0.02)
    const eyespot = eyeGate.mul(intimate)
    const marked = mix(dust, mix(color(hsl.integer(96, 75, 91)), color(hsl.integer(264, 11, 9)), pupil), ring.add(pupil).mul(eyespot).mul(scaleMask))
    const powder = mx_noise_float(p.mul(36)).mul(0.5).add(0.5)
    this.colorNode = mix(marked, color(hsl.integer(82, 32, 94.6)), overlap.mul(0.18)).mul(powder.mul(0.08).add(0.94))
    const height = scaleMask.mul(along.mul(0.006).add(0.004)).add(ridge.mul(0.003)).add(eyespot.mul(pupil).mul(0.004))
    this.normalNode = proceduralNormal(height.add(barb.mul(0.0015)), 1.25)
    this.roughnessNode = mix(float(0.72), float(0.24), scaleMask.mul(facing.mul(0.6).add(0.4))).sub(eyespot.mul(0.1)).clamp(0.12, 0.84)
    this.metalnessNode = float(0.02).add(grazing.pow(1.6).mul(0.4)).add(eyespot.mul(0.15))
    this.sheenNode = hue.mul(scaleMask).mul(0.8)
    this.sheenRoughnessNode = float(0.38).add(powder.mul(0.2))
    this.iridescenceNode = scaleMask.mul(grazing.mul(0.85).add(0.2)).add(eyespot.mul(0.55))
    this.iridescenceIORNode = float(1.32).add(id.z.mul(0.28))
    this.iridescenceThicknessNode = id.x.mul(460).add(along.mul(220)).add(90)
    this.clearcoatNode = eyespot.mul(0.7).add(grazing.mul(0.12))
    this.clearcoatRoughness = 0.07
    const beat = time.mul(0.7).add(id.z.mul(6)).sin().mul(0.5).add(0.5)
    this.emissiveNode = hue.mul(ridge).mul(grazing).mul(near).mul(0.28).add(color(hsl.integer(91, 100, 92)).mul(eyespot).mul(scaleMask).mul(beat).mul(0.4)).add(color(hsl.integer(172, 100, 92)).mul(barb).mul(intimate).mul(grazing).mul(0.08))
  }
}
