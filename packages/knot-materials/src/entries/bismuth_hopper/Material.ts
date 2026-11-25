import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, uv} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import {filament} from '../../lib/filament.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 4. BISMUTH HOPPER A synthetic metal crystal grown in a lab, its surface a stair-step spiral of right-angled terraces. Each tread oxidised into a different interference colour; edges clean, chrome-bright, infinitely sharp. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, rim, near} = viewerFrame()
    const tube = uv()
    // Stair-step geometry: two orthogonal pitches make the spiral.
    const stepU = tube.x.mul(Math.PI * 2 * 9)
    const stepV = tube.y.mul(Math.PI * 2 * 5)
    const stepField = stepU.add(stepV).mul(0.5)
    const stepIdx = stepField.floor()
    const stepPhase = stepField.fract()
    // Terrace face and bevel edge.
    const tread = stepPhase.smoothstep(0.14, 0.22).oneMinus().oneMinus()
    const bevel = filament(stepPhase.sub(0.5), 0.035)
    const riser = stepPhase.smoothstep(0.85, 1).mul(stepPhase.smoothstep(0.05, 0).oneMinus())
    // Interference-film rainbow gated by view-angle and step index.
    const film = facing.mul(0.95).add(stepIdx.mul(0.075)).add(p.y.mul(0.25))
    const rainbow = cosinePalette(film, [0.5, 0.5, 0.5], [0.52, 0.5, 0.5], [1, 1, 1], [0, 0.33, 0.67])
    const rainbowDeep = cosinePalette(film.add(0.18), [0.45, 0.42, 0.5], [0.55, 0.55, 0.5], [1, 1, 1], [0.1, 0.4, 0.7])
    // Oxidation drift — where the tarnish is thick vs. thin.
    const ox = mx_noise_float(p.mul(2.6)).mul(0.35).add(0.6)
    const oxFine = mx_fractal_noise_float(p.mul(9), 3, 2, 0.5).mul(0.3).add(0.7)
    // Chrome base and oxidised film.
    const chrome = mix(color(hsl.integer(248, 29, 96)), color(hsl.integer(257, 13, 55)), tread.mul(0.55).add(0.25))
    const oxidised = mix(chrome, rainbow, ox.mul(0.85).add(0.15))
    const oxidised2 = mix(oxidised, rainbowDeep, oxFine.mul(0.4))
    // Bevel highlight — pure chrome.
    const bevelCol = color(hsl.integer(0, 0, 100))
    this.colorNode = mix(oxidised2, bevelCol, bevel.mul(0.7))
    this.metalnessNode = float(0.9).sub(bevel.mul(0.1)).sub(riser.mul(0.25))
    this.roughnessNode = float(0.07)
      .add(bevel.mul(0.06))
      .add(riser.mul(0.28))
      .add(oxFine.mul(0.03))
    this.iridescence = 0.9
    this.iridescenceIOR = 1.6
    this.iridescenceThicknessNode = film.mul(260).add(240)
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.05
    this.normalNode = proceduralNormal(stepIdx.mul(0.015).add(bevel.mul(0.7)).add(riser.mul(0.4)), 0.009)
    this.emissiveNode
      = rainbow.mul(bevel).mul(near.mul(0.4).add(0.08)).mul(0.55)
        .add(rainbowDeep.mul(riser).mul(near.mul(0.2).add(0.05)).mul(0.2))
        .add(color(hsl.integer(245, 100, 78)).mul(rim).mul(0.09))
  }
}
