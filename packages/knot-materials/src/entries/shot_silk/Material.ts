import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentLocal, color, float, fwidth, mix, mx_cell_noise_float, negateOnBackSide, normalLocal, select, tangentLocal, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {knotArcLength} from '../../candidates/claude_haiku/lib/knotArcLength.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Warp threads per knot length and per tube turn. Arc-length pitches agree within 0.6%, so crossings are square. Both counts are multiples of 4, so the twill closes at the seams. */
const alongThreads = 212
const aroundThreads = 24
/** Thread rise as a fraction of its pitch. */
const relief = 0.75
/** Changeant twill: a teal warp over a rose weft. Which hue shows depends on the viewing angle. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const {facing, grazing} = viewerFrame()
    const along = knotArcLength(uv().x)
    const a = along.mul(alongThreads)
    const b = uv().y.mul(aroundThreads)
    const i = a.floor()
    const j = b.floor()
    const xa = a.fract().mul(2).sub(1)
    const xb = b.fract().mul(2).sub(1)
// Two-over-two twill: the warp floats on top wherever (i + j) mod 4 is 0 or 1.
    const warpTop = select(i.add(j).mod(4).lessThan(2), float(1), float(0))
    const weftTop = warpTop.oneMinus()
// Each visible thread is a parabolic dome across its own width. A warp runs along the knot, so its width is around the tube.
    const height = mix(float(1).sub(xa.mul(xa)), float(1).sub(xb.mul(xb)), warpTop)
    const slopeA = weftTop.mul(xa).mul(-4)
    const slopeB = warpTop.mul(xb).mul(-4)
// Relief is shaded only where threads are resolved. Finer than a pixel, the crossings average to their blended tone.
    const footprint = fwidth(a).max(fwidth(b))
    const resolved = footprint.smoothstep(0.25, 0.9).oneMinus()
    const tiltA = slopeA.mul(relief).mul(resolved)
    const tiltB = slopeB.mul(relief).mul(resolved)
// The TSL type of bitangentLocal is widened by its normalize chain, so it is asserted to its runtime vec3.
    const bitangent = bitangentLocal as unknown as Node<'vec3'>
    const normal = normalLocal.normalize()
      .sub(tangentLocal.normalize().mul(tiltA))
      .sub(bitangent.mul(tiltB))
      .normalize()
    const warp = color(hsl.integer(179, 100, 65))
    const weft = color(hsl.integer(5, 90, 53.4))
    const base = mix(weft, warp, warpTop)
    const opposite = mix(warp, weft, warpTop)
// Each thread has its own dye lot: a warp is identified by its place around the tube, a weft by its place along the knot.
    const seed = select(warpTop.greaterThan(0.5), vec3(j, float(0.5), float(1.7)), vec3(i, float(9.1), float(3.3)))
    const jitter = mx_cell_noise_float(seed)
// A soft wave of light runs once around the knot. Its period is 2 s, so the angle loops and the 16 s video close.
    const wave = along.mul(Math.PI * 2).sub(time.mul(Math.PI)).sin().mul(0.5).add(0.5)
// Head-on, the cloth shows its base hue. At grazing angles the opposite hue takes over.
    const flip = facing.smoothstep(0.2, 0.8)
// Threads catch light at their crown and fall into a deep valley where they cross the next thread.
    const crown = height.pow(0.7).mul(0.62).add(0.38)
    const shade = crown.mul(jitter.mul(0.2).add(0.9)).mul(wave.mul(0.14).add(0.93))
    const threadTone = mix(opposite, base, flip).mul(shade)
    this.colorNode = mix(mix(weft, warp, flip), threadTone, resolved)
    this.metalness = 0
    this.roughnessNode = height.oneMinus().mul(0.12).add(0.2)
// Highlights stretch along the thread that is on top: along the knot for the warp, around the tube for the weft.
    this.anisotropyNode = vec2(warpTop, weftTop).mul(0.8)
    this.sheenNode = opposite.mul(wave.mul(0.5).add(0.5)).mul(0.6)
    this.sheenRoughnessNode = float(0.3)
    this.normalNode = negateOnBackSide(transformNormalToView(normal))
    this.emissiveNode = opposite.mul(grazing.pow(3)).mul(0.1)
  }
}
