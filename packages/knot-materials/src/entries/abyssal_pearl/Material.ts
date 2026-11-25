import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, uv, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Mother-of-pearl inlay: staggered nacre tiles, each domed, grouted in dark shell and given its own aragonite thickness, so the thin-film spectrum breaks differently on every tile as you move. Growth bands inside each tile only resolve up close; from across the room the tiles dissolve into a single breathing pearl whose rim burns pastel. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const cols = 150
    const rows = 15
    const row = tube.y.mul(rows).floor()
    const shiftedX = tube.x.mul(cols).add(row.mod(2).mul(0.5))
    const cellX = shiftedX.floor()
    const localX = shiftedX.fract()
    const localY = tube.y.mul(rows).fract()
    const wrappedX = cellX.mod(cols)
    const rnd = cellNoiseVec3(vec3(wrappedX, row, 19.7))
    const rnd2 = cellNoiseVec3(vec3(wrappedX, row, 47.9))
// Distance to the nearest tile edge: the grout line and the dome both live here.
    const edgeX = localX.min(localX.oneMinus())
    const edgeY = localY.min(localY.oneMinus())
    const edge = edgeX.min(edgeY)
    const groove = edge.smoothstep(0.02, 0.11).oneMinus()
    const lx = localX.mul(2).sub(1)
    const ly = localY.mul(2).sub(1)
    const dome = lx.pow2().oneMinus().mul(ly.pow2().oneMinus()).clamp(0, 1)
// Growth bands run along each tile, warped by micro-noise and shifted per tile.
    const bandPhase = localX.mul(26).add(rnd.x.mul(9)).add(mx_noise_float(p.mul(16)).mul(1.4))
    const bands = opticalBands(bandPhase)
    const bandDelta = bands.sub(0.5).mul(intimate.mul(0.85).add(0.3))
    const mottle = mx_noise_float(p.mul(3.1)).mul(0.5).add(0.5)
    const tileTint = mix(mix(color(hsl.integer(81, 47, 92)), color(hsl.integer(354, 64, 77.5)), rnd.x), color(hsl.integer(170, 45, 81)), rnd.y.mul(0.6))
    const pastel = mix(tileTint, spectralColor(rnd.x.mul(6.28).add(rnd2.z.mul(3))), 0.28)
    const tileColor = pastel.mul(bandDelta.add(0.82)).mul(mottle.mul(0.12).add(0.9))
    this.colorNode = mix(tileColor, color(hsl.integer(66, 33, 18)), groove.mul(0.95))
    this.metalness = 0
    this.roughnessNode = float(0.42).add(groove.mul(0.3)).sub(bandDelta.mul(0.3)).clamp(0.12, 0.8)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.06).add(groove.mul(0.3))
// Every tile its own film thickness; the built-in iridescence does the angular colour travel.
    this.iridescenceNode = float(0.92).sub(groove.mul(0.7))
    this.iridescenceIOR = 1.32
    this.iridescenceThicknessNode = rnd.x.mul(360).add(230).add(bands.mul(110)).add(rnd2.y.mul(60))
    this.sheenNode = color(hsl.integer(347, 100, 94)).mul(0.7)
    this.sheenRoughness = 0.4
    this.normalNode = proceduralNormal(dome.mul(1.1).add(bands.mul(0.1)).sub(groove.mul(1)), float(0.0026).mul(intimate.mul(0.6).add(0.7)))
    const rimSpectrum = spectralColor(rnd.x.mul(6.28).add(grazing.mul(5)).add(rnd2.z.mul(2)))
    this.emissiveNode = rimSpectrum.mul(grazing.pow(3)).mul(0.38)
      .add(color(hsl.integer(71, 100, 97.4)).mul(dome).mul(rnd2.x.smoothstep(0.72, 0.95)).mul(near).mul(0.12))
  }
}
