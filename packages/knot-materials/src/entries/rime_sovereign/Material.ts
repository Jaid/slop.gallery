import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, int, mix, mx_fractal_noise_float, mx_worley_noise_vec3, mx_worley_noise_vec3_style, negateOnBackSide, normalLocal, time, transformNormalToView, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Facet lattices at two sizes. The fine one tilts only as the viewer comes close, so proximity reveals more crystal. */
const coarseScale = 15
const fineScale = 46
/** How far a facet's normal may tip away from the surface. Wide tilts spread sparkle across a wide range of angles. */
const tilt = 0.55
/** Voronoi crystal lattice. `id` is a stable random vector per facet, `seam` is 1 on the frost lines between facets. */
function crystals(position: Node<'vec3'>) {
  const id = mx_worley_noise_vec3_style(position, float(1), int(1), int(0))
  const edges = mx_worley_noise_vec3(position, float(1), int(0))
  const seam = edges.y.sub(edges.x).smoothstep(0, 0.12).oneMinus()
  return {
    id,
    seam,
  }
}
/** Each facet holds a different star: a pastel hue drawn from its own random identity. */
const starColor = (id: Node<'float'>) => cosinePalette(id, [0.62, 0.7, 0.82], [0.3, 0.3, 0.2], [1, 1, 1], [0, 0.33, 0.67])
/** Hard-frozen ice: each facet tips a different way and catches the studio light. Frost creeps and recedes once every 2 s. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {p, rim, near} = viewerFrame()
// Every motion below has a period of exactly 2 s, so the angle loop and the 16 s video close seamlessly.
    const breath = time.mul(Math.PI).sin().mul(0.5).add(0.5)
    const field = mx_fractal_noise_float(p.mul(2.6).add(vec3(0, 0, breath.mul(0.35))), 4, 2, 0.5).mul(0.5).add(0.5)
    const cover = field.add(breath.mul(0.1).sub(0.05)).smoothstep(0.42, 0.58)
    const coarse = crystals(p.mul(coarseScale))
    const fine = crystals(p.mul(fineScale))
// Each facet twinkles on its own phase, so the frost never pulses as one block.
    const twinkle = time.mul(Math.PI).add(coarse.id.z.mul(Math.PI * 2)).sin().mul(0.5).add(0.5)
    const normal = normalLocal.normalize()
      .add(coarse.id.mul(2).sub(1).normalize().mul(cover.mul(tilt).mul(twinkle.mul(0.4).add(0.6))))
      .add(fine.id.mul(2).sub(1).normalize().mul(cover.mul(near).mul(0.35)))
      .normalize()
    const star = starColor(coarse.id.x)
    const abyss = color(hsl.integer(247, 67, 7))
    const glacier = color(hsl.integer(248, 81, 43))
    const ice = color(hsl.integer(231, 100, 97))
    const frost = mix(mix(glacier, ice, coarse.id.y.smoothstep(0.1, 0.9)), star, 0.55)
    this.colorNode = mix(mix(abyss, frost, cover), ice, coarse.seam.mul(cover).mul(0.85))
    this.metalness = 0
    this.roughnessNode = mix(float(0.4), float(0.05), cover)
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.03
// Thin-film interference, with a film thickness that differs from facet to facet.
    this.iridescenceNode = cover.mul(0.85)
    this.iridescenceIOR = 1.31
    this.iridescenceThicknessNode = mix(float(180), float(640), coarse.id.z)
    this.normalNode = negateOnBackSide(transformNormalToView(normal))
// Sparkle takes the color of the star inside its facet.
    this.emissiveNode = star.mul(glints(transformNormalToView(normal), 160)).mul(cover).mul(1.2)
      .add(color(hsl.integer(238, 100, 81)).mul(rim).mul(0.12))
  }
}
