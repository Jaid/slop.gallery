import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mx_fractal_noise_float, mx_noise_float, normalView, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Height in the rock, warped by the flow that carved it. */
const bedHeight = (p: Node<'vec3'>, scale: number) => {
  const fold = mx_fractal_noise_float(p.mul(scale), 4, 2.1, 0.55)
  const swell = mx_fractal_noise_float(p.mul(scale * 0.35).add(vec3(4.1, -2.3, 7.7)), 3, 2.05, 0.5)
  return p.y.mul(6.5).add(fold.mul(0.42)).add(swell.mul(0.9))
}

/** Sandstone, read the way a canyon is read. The beds are laid down flat and then the whole rock is folded, so on this knot they slice across the form at a constant angle and the whole geology is legible in one glance. Every bed is a different summer: iron red, ochre, bone, rust. The rock is sand-fine and dry, and where the water has kept it polished the studio runs along the bedding. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const height = bedHeight(p, 1.5)
    const bed = height.fract()
// The palette of the beds: iron red, vermilion, ochre, bone and a mauve that only shows in the shade.
    const bedColour = cosinePalette(height, [0.44, 0.21, 0.13], [0.36, 0.2, 0.12], [1, 1, 1], [0, 0.13, 0.26])
// Fine stratification inside each bed, and the coarse cross-bedding above it.
    const lamination = height.mul(9).sin().mul(0.5).add(0.5).pow(0.8)
    const crossBed = height.mul(3.1).add(mx_noise_float(p.mul(9)).mul(0.6)).sin().mul(0.5).add(0.5)
// The polished ribs the water leaves where it has run the same line for a hundred thousand years.
    const polish = bed.smoothstep(0.12, 0).oneMinus().add(bed.smoothstep(0.88, 1)).clamp()
    const grit = mx_noise_float(p.mul(210)).abs().pow(0.4).oneMinus()
    this.colorNode = bedColour
      .mul(lamination.mul(0.16).add(0.86))
      .mul(crossBed.mul(0.12).add(0.92))
      .mul(grit.mul(0.1).add(0.95))
      .add(color(hsl.integer(74, 100, 89)).mul(polish).mul(0.06))
    this.metalness = 0
    this.roughnessNode = float(0.74).sub(polish.mul(0.36)).add(grit.mul(0.12)).sub(crossBed.mul(0.06)).clamp(0.12, 0.9)
    this.ior = 1.54
    this.clearcoatNode = polish.mul(0.25)
    this.clearcoatRoughnessNode = float(0.1).add(grit.mul(0.2))
    this.normalNode = proceduralNormal(lamination.mul(0.0009).add(crossBed.mul(0.0006)).add(grit.mul(0.00012)), 0.55)
    const glint = glints(normalView, 120).mul(polish).mul(near.mul(0.5).add(0.5))
    this.emissiveNode = color(hsl.integer(69, 100, 87.2)).mul(glint).mul(0.35)
      .add(color(hsl.integer(51, 99, 74)).mul(bed.smoothstep(0.94, 1)).mul(grazing.pow(2.4)).mul(0.12))
      .add(color(hsl.integer(38, 74, 15)).mul(bed.smoothstep(0.06, 0)).mul(facing.oneMinus()).mul(0.1))
      .add(color(hsl.integer(62, 100, 82.5)).mul(intimate.mul(0.012)))
  }
}
