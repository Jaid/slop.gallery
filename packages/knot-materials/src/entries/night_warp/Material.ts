import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {fractalNoise} from '../../candidates/grok/lib/fractalNoise.ts'
import {palette} from '../../candidates/grok/lib/palette.ts'
import {screenRibbon} from '../../candidates/grok/lib/screenRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {starfield} from '../../lib/starfield.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A night loom. Fine anisotropic silk carries curtains of aurora that parallax through the tube, while a sparse starfield only appears in the grazing dark. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate, rim} = viewerFrame()
    const tube = uv()
    const warp = screenRibbon(tube.x.mul(160).sin(), 0.35)
    const weft = screenRibbon(tube.y.mul(42).add(tube.x.mul(6)).sin(), 0.28)
    const weave = warp.mul(0.7).add(weft.mul(0.45))
    const curtains = 5
    let glow: Node<'vec3'> = vec3(0)
    let veilSum: Node<'float'> = float(0)
    for (let index = 0;index < curtains;index++) {
      const depth = 0.015 + index * 0.028
      const q = p.sub(view.mul(depth))
      const fold = q.y.mul(5.5 + index * 0.4).add(q.x.mul(0.8)).add(time.mul(0.22 + index * 0.035)).add(fractalNoise(q.mul(1.3), 3).mul(1.6))
      const sheet = fold.sin()
      const veil = sheet.smoothstep(0.15, 0.85).pow(2.2).mul(1 - index * 0.12)
      const hue = palette(fold.mul(0.07).add(index * 0.16).add(0.5).fract(), [{
        at: 0,
        rgb: hsl.integer(173, 73, 8),
      }, {
        at: 0.18,
        rgb: hsl.integer(161, 98.6, 82),
      }, {
        at: 0.4,
        rgb: hsl.integer(201, 100, 89.2),
      }, {
        at: 0.62,
        rgb: hsl.integer(284, 100, 48.6),
      }, {
        at: 0.82,
        rgb: hsl.integer(358, 99, 64),
      }, {
        at: 1,
        rgb: hsl.integer(173, 73, 8),
      }])
      glow = glow.add(hue.mul(veil).mul(1.15))
      veilSum = veilSum.add(veil)
    }
    const silk = mix(color(hsl.integer(266, 28, 4.5)), color(hsl.integer(266, 34, 11)), weave.mul(0.55).add(facing.mul(0.08)))
    const stars = starfield(view.add(p.mul(0.2)), 34, 0.62).mul(grazing.pow(1.2)).mul(veilSum.smoothstep(0.4, 1.4).oneMinus())
    this.colorNode = mix(silk, glow.mul(0.55), veilSum.clamp().mul(0.72))
    this.metalnessNode = float(0.05).add(weave.mul(0.35))
    this.roughnessNode = float(0.42).sub(weave.mul(0.16)).sub(veilSum.mul(0.08)).clamp(0.16, 0.62)
    this.anisotropyNode = vec3(1, tube.y.mul(6).sin().mul(0.15), 0).xy.mul(0.95)
    this.sheenNode = color(hsl.integer(179, 100, 96.6)).mul(weave).mul(rim).mul(0.7)
    this.sheenRoughnessNode = float(0.22).add(weft.mul(0.25))
    this.iridescenceNode = grazing.pow(1.4).mul(0.85).add(veilSum.mul(0.15))
    this.iridescenceIOR = 1.33
    this.iridescenceThicknessNode = tube.x.mul(640).add(view.y.mul(80)).add(160).abs()
    this.clearcoatNode = float(0.15).add(facing.mul(0.15))
    this.clearcoatRoughness = 0.18
    const dust = mx_noise_float(p.mul(40)).smoothstep(0.72, 0.9).mul(intimate)
    this.emissiveNode = glow.mul(0.72).mul(near.mul(0.25).add(0.85)).add(stars.mul(1.3)).add(color(hsl.integer(173, 100, 93.8)).mul(weave).mul(rim).mul(0.16)).add(color(hsl.integer(340, 100, 89.6)).mul(dust).mul(0.2))
  }
}
