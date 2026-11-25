import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, dot, float, max, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, vec2, vec3} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A plate of octahedrite iron, polished and acid-bitten: the Widmanstätten figure of a cooling asteroid. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
// A single crystal: kamacite bands and the taenite that refuses to give way to the acid, cut on the
// octahedron's own planes, so the ribbons cross at the angles a slowly cooling iron would.
    const families = [vec3(1, 1, 1), vec3(1, -1, 1), vec3(-1, 1, 1), vec3(1, 1, -1)]
    const ribbon = (phase: Node<'float'>, spacing: number) => phase.div(spacing).fract().sub(0.5).abs()
// Three octahedral families, each a narrow ribbon: together they cross the plate without tiling it.
    let band: Node<'float'> = float(0)
    let fine: Node<'float'> = float(0)
    for (const [index, family] of families.entries()) {
      const phase = dot(p, family.normalize())
      band = max(band, ribbon(phase, 0.16).smoothstep(0.09, 0.055).mul(index === 3 ? 0.7 : 1))
      fine = max(fine, ribbon(phase, 0.041).smoothstep(0.15, 0.1))
    }
// Acid bites the soft iron and leaves the nickel ribbons standing out as mirrors.
    const etch = band.oneMinus().mul(0.8).add(fine.mul(0.5).mul(near.mul(0.6).add(0.4))).clamp(0, 1)
    const lip = max(band, fine.mul(0.3).mul(near))
// Polishing: fine directional scratches from the lap, and the pits the sky left behind.
    const scratch = filament(mx_noise_float(vec3(p.x.mul(240), p.y.mul(240), p.z.mul(30))), 0.006).mul(intimate.mul(0.6))
    const pitField = mx_fractal_noise_float(p.mul(11), 2, 2.2, 0.5)
    const pits = pitField.abs().smoothstep(0.08, 0.26).oneMinus().mul(near.mul(0.6).add(0.25))
    const tarnish = mx_fractal_noise_float(p.mul(3.4), 3, 2.2, 0.5).mul(0.5).add(0.5)
// The relief is shallow: a few microns of iron dissolved away, and a mirror left in the seams.
    const relief = band.mul(0.3).add(etch.mul(0.12)).add(pits.mul(0.14)).add(scratch.mul(0.02))
// Only a smooth, derivative-free term reaches the vertex stage; the figure itself is a normal map.
    this.positionNode = positionGeometry.add(normalLocal.mul(tarnish.sub(0.5).mul(knotData.displacement)))
    const nickel = mix(color(hsl.integer(253, 13, 73)), color(hsl.integer(256, 11, 54)), tarnish.mul(0.45))
    const iron = mix(color(hsl.integer(67, 14, 18)), color(hsl.integer(59, 13, 9)), tarnish.mul(0.6))
    const oxide = color(hsl.integer(56, 66, 42))
    this.colorNode = mix(mix(iron, nickel, band).add(oxide.mul(etch.mul(pits.mul(0.6).add(0.4))).mul(0.22)), color(hsl.integer(251, 20, 86)), scratch.mul(0.25))
    this.metalness = 1
    this.roughnessNode = etch.mul(0.3).add(pits.mul(0.1)).sub(lip.mul(0.08)).add(tarnish.mul(0.06)).add(0.12).clamp(0.09, 0.6)
    this.anisotropy = 0.45
    this.anisotropyNode = vec2(1, 0.35)
    const surface = proceduralNormal(relief, 0.1)
    this.normalNode = surface
// Nothing here glows: the whole performance is carried by the way iron answers the light.
    const glint = glints(surface, 180).mul(mx_noise_float(p.mul(320)).mul(0.5).add(0.5)).mul(intimate)
    this.emissiveNode = color(hsl.integer(253, 44, 92)).mul(glint).mul(lip.oneMinus()).mul(0.55)
      .add(color(hsl.integer(65, 100, 80)).mul(lip).mul(grazing.pow(2.5)).mul(near.mul(0.3).add(0.15)).mul(0.1))
  }
}
