import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {jewel, segment, stroke, tile} from '../../candidates/gpt_sol/lib/ornament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

// Individual stars are stitched into whole animals, rather than merely scattered over a cat silhouette.
const paths: ReadonlyArray<readonly [readonly [number, number], readonly [number, number]]> = [
  [[0.18, 0.76], [0.24, 0.94]],
  [[0.24, 0.94], [0.38, 0.82]],
  [[0.38, 0.82], [0.62, 0.82]],
  [[0.62, 0.82], [0.76, 0.94]],
  [[0.76, 0.94], [0.82, 0.76]],
  [[0.82, 0.76], [0.77, 0.55]],
  [[0.77, 0.55], [0.63, 0.47]],
  [[0.63, 0.47], [0.5, 0.44]],
  [[0.5, 0.44], [0.37, 0.47]],
  [[0.37, 0.47], [0.23, 0.55]],
  [[0.23, 0.55], [0.18, 0.76]],
  [[0.29, 0.5], [0.28, 0.31]],
  [[0.28, 0.31], [0.35, 0.16]],
  [[0.35, 0.16], [0.58, 0.13]],
  [[0.58, 0.13], [0.66, 0.21]],
  [[0.66, 0.21], [0.6, 0.35]],
  [[0.6, 0.35], [0.5, 0.44]],
  [[0.58, 0.13], [0.76, 0.1]],
  [[0.76, 0.1], [0.89, 0.19]],
  [[0.89, 0.19], [0.86, 0.35]],
  [[0.86, 0.35], [0.77, 0.38]],
  [[0.4, 0.63], [0.5, 0.55]],
  [[0.5, 0.55], [0.6, 0.63]],
  [[0.13, 0.43], [0.05, 0.37]],
  [[0.87, 0.43], [0.95, 0.38]],
]
const stars: ReadonlyArray<readonly [number, number]> = [[0.18, 0.76], [0.24, 0.94], [0.38, 0.82], [0.62, 0.82], [0.76, 0.94], [0.82, 0.76], [0.77, 0.55], [0.63, 0.47], [0.5, 0.44], [0.37, 0.47], [0.23, 0.55], [0.28, 0.31], [0.35, 0.16], [0.58, 0.13], [0.66, 0.21], [0.6, 0.35], [0.76, 0.1], [0.89, 0.19], [0.86, 0.35], [0.77, 0.38], [0.4, 0.63], [0.5, 0.55], [0.6, 0.63], [0.05, 0.37], [0.95, 0.38]]
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.24)
    this.name = knotData.id
    const {p, grazing, near, view} = viewerFrame()
    const chart = uv().mul(vec2(6, 2))
    const cell = chart.floor()
    const point = tile(uv(), 6, 2)
    const identity = mx_cell_noise_float(vec3(cell, 4))
    const twinkle = time.mul(identity.mul(1.6).add(1.4)).add(identity.mul(19)).sin().mul(0.15).add(0.85)
    let threads: Node<'float'> = float(0)
    for (const [a, b] of paths) {
      threads = threads.max(stroke(segment(point, a, b), 0.014))
    }
    let nodes: Node<'float'> = float(0)
    for (const star of stars) {
      nodes = nodes.max(jewel(point, star, 0.025))
    }
    const eyes = jewel(point, [0.39, 0.7], 0.032).add(jewel(point, [0.61, 0.7], 0.032)).clamp()
    const nose = jewel(point, [0.5, 0.57], 0.016)
    const whiskers = stroke(segment(point, [0.5, 0.54], [0.12, 0.5]), 0.0025).max(stroke(segment(point, [0.5, 0.54], [0.88, 0.5]), 0.0025)).mul(near)
    const silhouette = threads.mul(0.64).add(nodes.mul(twinkle).mul(1.4)).add(whiskers.mul(0.35)).clamp()
    const nebula = mx_noise_float(p.mul(4).add(vec3(0, time.mul(0.015), 0))).mul(0.5).add(0.5)
    const dustCell = p.mul(65)
    const dustRnd = mx_cell_noise_float(dustCell.floor())
    const dust = dustCell.fract().sub(0.5).length().smoothstep(0.06, 0.16).oneMinus().mul(dustRnd.smoothstep(0.978, 0.99)).mul(near.mul(0.7).add(0.25))
    const midnight = mix(color(hsl.integer(268, 74, 7)), color(hsl.integer(257, 51, 24)), nebula.mul(0.6).add(grazing.mul(0.16)))
    const catTint = mix(color(hsl.integer(244, 100, 78.6)), color(hsl.integer(355, 100, 87.5)), identity)
    this.colorNode = mix(midnight, color(hsl.integer(254, 59, 33)), silhouette.mul(0.55))
    this.metalness = 0.18
    this.roughnessNode = float(0.78).sub(silhouette.mul(0.32))
    this.clearcoat = 0.18
    this.clearcoatRoughness = 0.11
    this.sheenNode = float(0.12)
    this.sheenRoughness = 0.6
    this.emissiveNode = catTint.mul(silhouette).mul(1.7).add(color(hsl.integer(93, 100, 92.5)).mul(eyes.mul(1.65).add(nose.mul(0.45))).mul(twinkle)).add(color(hsl.integer(261, 61, 65)).mul(dust).mul(0.9)).add(catTint.mul(grazing.pow(3)).mul(0.11)).add(color(hsl.integer(259, 59, 63)).mul(view.z.abs()).mul(nebula).mul(0.025))
  }
}
