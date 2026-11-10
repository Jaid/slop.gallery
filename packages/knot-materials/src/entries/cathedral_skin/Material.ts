import type {Texture} from 'three/webgpu'

import {color, float, mix, mx_noise_float, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const tileScale = vec2(54, 9)
/** Stained glass grown as a skin. Every wrapped tile keeps its own jewel hue, its own polish and its own candle-flicker, leaded by gold cames that flare when the light crosses them. Hue drifts dichroically toward the silhouette, tiles bevel under a wet glaze up close, and from across the room the leading dissolves into one glowing mosaic. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, view, facing, grazing, near} = viewerFrame()
    const q = uv().mul(tileScale)
    const id = wrapCell(q.floor(), tileScale)
    const local = q.fract()
    const random = cellNoiseVec3(vec3(id.x, id.y, 5.5))
    const edge = local.x.min(local.x.oneMinus()).min(local.y.min(local.y.oneMinus()))
    const hueShift = grazing.mul(0.35).add(view.y.mul(0.08))
    const jewel = cosinePalette(random.x.add(hueShift), [0.52, 0.48, 0.55], [0.48, 0.5, 0.48], [1, 1, 1], [0, 0.33, 0.67]).clamp(0, 1)
    const bevelShade = edge.mul(0.45).add(0.8)
    const grain = mx_noise_float(p.mul(44)).mul(0.5).add(0.5)
    const pane = jewel.mul(bevelShade).mul(grain.mul(0.14).mul(near).add(0.93))
    const grout = filteredRibbon(edge.sub(0.045), 0.03)
    const came = color('#8a6527')
    const flicker = time.mul(Math.PI).add(random.z.mul(6.283)).sin().mul(0.07).add(0.93)
    const backlit = facing.pow(1.5).mul(0.6).add(0.34)
    this.colorNode = mix(pane, came, grout)
    this.metalnessNode = grout.mul(0.9)
    this.roughnessNode = mix(mix(float(0.12), float(0.3), random.z), float(0.42), grout)
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.1
    this.normalNode = proceduralNormal(edge.add(random.y.mul(0.15)), 0.0015)
    this.clearcoatNormalNode = this.normalNode
    this.aoNode = float(1).sub(grout.mul(0.4))
    this.emissiveNode = pane.mul(backlit).mul(flicker).mul(0.55).add(color('#ffd98a').mul(glints(normalViewGeometry, 120)).mul(grout).mul(near).mul(0.5))
  }
}
