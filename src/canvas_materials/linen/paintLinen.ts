import type {MeshPhysicalNodeMaterial, Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, vec2} from 'three/tsl'

import {slopeNormal} from '#src/lib/materials/filters.ts'

/** what the linen is woven with: the material’s fields, or the proof editor’s sliders */
export type LinenKnobs = {
  /** how much of the bare threads shows, against what it was made with */
  fibers: Amount
  /** how deep the weave is, against what it was made with */
  relief: Amount
  /** how large the threads are against the size they were made at, which the position is divided by already */
  scale: Amount
  /** how strongly the threads catch grazing light */
  sheen: Amount
}
type Float = Node<'float'>

type Amount = Float | number

const tau = 2 * Math.PI
/** warp threads per meter across x and weft threads per meter across y, at scale 1 */
const warpCount = 125
const weftCount = 154
/** how wide a gaussian, in pixels, every wave of the weave is filtered with; at 2 pixels per cycle less than a fifth of a wave is left, too little to beat into moiré */
const blur = 0.6
const falloff = 2 * Math.PI ** 2 * blur ** 2
/** the share of the weave in which bare thread shows, all that is left of it once its crests are too fine to draw */
const bareShare = 0.176
/** how far apart the slub grain is sampled for its slope, in units of the position */
const grainStep = 0.001
/** what is left of a wave after the filter, by how many of its cycles a pixel spans */
const kept = (cycles: Float) => cycles.mul(cycles).mul(-falloff).exp()
const slubs = (position: Node<'vec2'>) => mx_noise_float(position.mul(vec2(11, 68)))

/**
 * Linen canvas: the paint sinks between warp and weft, which cross over and under each other, and the unbleached threads show through where it lies thin.
 *
 * The plain weave is a sum of a few waves, `0.5 + (cos X + cos Y) / 4 + 0.1225 (cos(X/2) cos(3Y/2) − cos(Y/2) cos(3X/2))` in radians along warp `X` and weft `Y`. Each wave is filtered on its own by how many of its cycles a pixel spans, so the threads stay as fine as the pixels can draw them, a view along the warp keeps the weft longer and whatever is too fine settles to its average instead of beating into moiré. The relief tilts the normal by the weave’s exact slope rather than one read from neighboring pixels.
 */
export default function paintLinen(material: MeshPhysicalNodeMaterial, image: Node<'vec3'>, position: Node<'vec2'>, {fibers, relief, scale, sheen}: LinenKnobs) {
  const dx = position.dFdx()
  const dy = position.dFdy()
  // How many threads of either kind a pixel spans, along the direction they change fastest on screen.
  const warpSpan = vec2(dx.x, dy.x).length().mul(warpCount).toVar('linenWarpSpan')
  const weftSpan = vec2(dx.y, dy.y).length().mul(weftCount).toVar('linenWeftSpan')
  // Each thread wavers a little.
  const thread = position.mul(vec2(warpCount, weftCount)).add(vec2(mx_noise_float(position.mul(19)), mx_noise_float(position.mul(17).add(9))).mul(0.19)).mul(tau).toVar('linenThread')
  const {x, y} = thread
  const [cosX, sinX, cosY, sinY] = [x.cos(), x.sin(), y.cos(), y.sin()]
  const [cosHalfX, sinHalfX, cosHalfY, sinHalfY] = [x.mul(0.5).cos(), x.mul(0.5).sin(), y.mul(0.5).cos(), y.mul(0.5).sin()]
  const [cosThreeHalvesX, sinThreeHalvesX, cosThreeHalvesY, sinThreeHalvesY] = [x.mul(1.5).cos(), x.mul(1.5).sin(), y.mul(1.5).cos(), y.mul(1.5).sin()]
  const warpKept = kept(warpSpan)
  const weftKept = kept(weftSpan)
  // The crossings, where warp and weft take turns lying on top, as two products of waves.
  const overKept = kept(warpSpan.mul(0.5)).mul(kept(weftSpan.mul(1.5))).toVar('linenOverKept')
  const underKept = kept(weftSpan.mul(0.5)).mul(kept(warpSpan.mul(1.5))).toVar('linenUnderKept')
  const over = cosHalfX.mul(cosThreeHalvesY)
  const under = cosHalfY.mul(cosThreeHalvesX)
  const weave = cosX.mul(warpKept).add(cosY.mul(weftKept)).mul(0.25).add(over.mul(overKept).sub(under.mul(underKept)).mul(0.1225)).add(0.5).toVar('linenWeave')
  const weaveSlope = vec2(
    sinX.mul(warpKept).mul(-0.25).add(sinThreeHalvesX.mul(cosHalfY).mul(underKept).mul(1.5).sub(sinHalfX.mul(cosThreeHalvesY).mul(overKept).mul(0.5)).mul(0.1225)).mul(tau * warpCount),
    sinY.mul(weftKept).mul(-0.25).add(sinHalfY.mul(cosThreeHalvesX).mul(underKept).mul(0.5).sub(sinThreeHalvesY.mul(cosHalfX).mul(overKept).mul(1.5)).mul(0.1225)).mul(tau * weftCount),
  )
  // The bare crests are sharper than any of the waves, so they settle into their share before the weave does.
  const sharpWeave = cosX.add(cosY).mul(0.25).add(over.sub(under).mul(0.1225)).add(0.5)
  const crests = mix(float(bareShare), sharpWeave.smoothstep(0.65, 0.95), kept(warpSpan.mul(2)).mul(kept(weftSpan.mul(2))))
  // Long slubs in the yarn, only a few threads across the weft, so they settle the same way.
  const slubKept = kept(warpSpan.mul(11 / warpCount)).mul(kept(weftSpan.mul(68 / weftCount))).mul(0.5).toVar('linenSlubKept')
  const slub = slubs(position).toVar('linenSlub')
  const grain = slub.mul(slubKept).add(0.5)
  const grainSlope = vec2(slubs(position.add(vec2(grainStep, 0))), slubs(position.add(vec2(0, grainStep)))).sub(slub).mul(slubKept.div(grainStep))
  const bare = crests.mul(grain.mul(0.75).add(0.25))
  material.colorNode = mix(image.mul(weave.sub(0.5).mul(0.33).sub(0.09).mul(relief).add(1)), color(hsl.integer(72, 32, 70)), bare.mul(fibers).mul(0.19).min(1))
  material.normalNode = slopeNormal(weaveSlope.mul(0.00155).add(grainSlope.mul(0.0007)).mul(relief).div(scale))
  material.roughness = 0.93
  material.sheenNode = color(hsl.integer(78, 35, 82)).mul(sheen)
}
