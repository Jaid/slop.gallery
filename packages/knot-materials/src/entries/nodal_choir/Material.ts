import type {Node, Texture} from 'three/webgpu'

import {color, float, mix, mx_cell_noise_float, mx_noise_float, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const tau = Math.PI * 2
/** Sand grains lie on a grid whose integer counts keep the grains periodic around both seams. */
const grains = vec2(240, 36)
/** Chladni figure on the torus: nodal lines are where the value crosses zero, and sand settles there. */
const chladni = (u: Node<'float'>, v: Node<'float'>, m: number, n: number) => u.mul(m).cos().mul(v.mul(n).cos()).sub(u.mul(n).cos().mul(v.mul(m).cos()))
/** A bronze plate sounding two standing-wave modes, crossfaded slowly. Sand gathers on the nodes, and the plate sounds harder as you approach. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {near} = viewerFrame()
    const tube = uv()
    const u = tube.x.mul(tau)
    const v = tube.y.mul(tau)
    const morph = time.mul(0.35)
    const modeA = chladni(u, v, 14, 2)
    const modeB = chladni(u, v, 10, 3)
    const amplitude = near.mul(0.6).add(0.4)
    const wave = modeA.mul(morph.cos()).add(modeB.mul(morph.sin())).mul(amplitude)
    const nodal = wave.abs().smoothstep(0.02, 0.08).oneMinus()
    const grid = tube.mul(grains)
    const grain = wrapCell(grid.floor(), grains)
    const grainRandom = mx_cell_noise_float(vec3(grain, 3.7))
    const local = grid.fract().sub(0.5)
    const speck = local.length().smoothstep(0.2, 0.32).oneMinus().mul(grainRandom.smoothstep(0.35, 0.6))
    const sand = nodal.mul(speck)
    const plate = mix(color('#2a2119'), color('#4a3a2a'), mx_noise_float(positionGeometry.mul(25)).mul(0.5).add(0.5))
    this.colorNode = mix(plate, color('#e8d6ab'), sand)
    this.metalnessNode = mix(float(0.85), float(0), sand)
    this.roughnessNode = mix(float(0.32), float(0.8), sand)
    const height = wave.mul(0.0035).add(sand.mul(0.0007))
    this.normalNode = proceduralNormal(height, 1)
    this.emissiveNode = color('#ffb066').mul(wave.abs().mul(0.6).clamp().pow(4)).mul(near.mul(0.08))
  }
}
