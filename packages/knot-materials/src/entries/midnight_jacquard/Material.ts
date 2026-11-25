import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, time, uv, vec2} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Jacquard silk: the damask motif is not printed but woven – inside the motif the warp rides on top, outside it the weft does. Head-on the pattern nearly vanishes into indigo; walk to a slant and the flipped threads catch the light at different angles, so the brocade blooms out of the dark and sinks back as you pass. Gold thread is woven through the motif's outline and every seventh warp. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const tube = uv()
// Large damask continents from 3D noise, seamless around the knot's closed path.
    const motifField = mx_fractal_noise_float(p.mul(2.7).add(11.3), 3, 2, 0.5).mul(0.5).add(0.5)
    const motif = motifField.smoothstep(0.54, 0.63)
    const motifEdge = filament(motifField.sub(0.585), 0.045)
    const motifInner = filament(motifField.sub(0.72), 0.02).mul(motif)
// The weave itself: warp and weft cells trading places, flipped inside the motif.
    const weaveCoord = vec2(tube.x.mul(300), tube.y.mul(54))
    const cell = weaveCoord.floor()
    const frac = weaveCoord.fract()
    const parity = cell.x.add(cell.y).mod(2)
    const topness = mix(parity, parity.oneMinus(), motif)
    const warpProfile = frac.y.mul(Math.PI).sin()
    const weftProfile = frac.x.mul(Math.PI).sin()
    const weaveHeight = mix(weftProfile, warpProfile, topness)
    const threadShade = mix(frac.x, frac.y, topness)
// Real gold thread: every seventh warp row, plus the woven outline of the damask.
    const goldThread = cell.y.mod(7).lessThan(0.5).select(float(1), float(0)).mul(topness)
    const goldMask = motifEdge.add(motifInner.mul(0.7)).add(goldThread.mul(0.85)).clamp(0, 1)
// A slow lustre travels the length of the cloth once per exhibition loop.
    const travelling = tube.x.mul(Math.PI * 8).sub(time.mul(Math.PI * 2)).sin().mul(0.5).add(0.5).pow(3)
    const silk = mix(color(hsl.integer(286, 71, 8)), color(hsl.integer(296, 77, 15)), threadShade.mul(0.6).add(motif.mul(0.25)))
    const silkBurgundy = mix(silk, color(hsl.integer(344, 65, 20)), motif.mul(0.65))
    this.colorNode = mix(silkBurgundy, color(hsl.integer(79, 75, 77)), goldMask)
    this.metalnessNode = goldMask.mul(0.95)
    this.roughnessNode = mix(float(0.6), float(0.26), goldMask).add(weaveHeight.mul(-0.07))
// The sheen carries the pattern: flipped threads fuzz differently inside the motif.
    this.sheenNode = mix(color(hsl.integer(284, 80, 21)), color(hsl.integer(300, 100, 72)), motif).mul(1.1)
    this.sheenRoughnessNode = mix(float(0.48), float(0.2), motif)
    this.anisotropyNode = vec2(topness.oneMinus(), topness).mul(0.7)
    const detail = intimate.mul(0.7).add(0.55)
    const weaveNormal = proceduralNormal(weaveHeight.mul(0.85).add(motif.mul(0.22)), float(0.0021).mul(detail))
    this.normalNode = weaveNormal
    const sparkle = glints(weaveNormal, 72)
    this.emissiveNode = color(hsl.integer(286, 99, 53)).mul(motif).mul(grazing.pow(2)).mul(0.32)
      .add(color(hsl.integer(85, 100, 88.5)).mul(goldMask).mul(sparkle).mul(near.mul(1.2).add(0.25)))
      .add(color(hsl.integer(279, 100, 45.6)).mul(travelling).mul(grazing).mul(motif.mul(0.5).add(0.12)).mul(0.22))
  }
}
