import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, uv, vec2, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A couched gold cord winding across the nap: signed distance to its path plus the couching stitches. */
function thread(tile: Node<'vec2'>) {
  const alongPhase = tile.x.mul(Math.PI * 2)
  const wander = alongPhase.sin().mul(0.34).add(alongPhase.mul(2).cos().mul(0.14))
  const slope = alongPhase.cos().mul(Math.PI * 2 * 0.34).sub(alongPhase.mul(2).sin().mul(Math.PI * 4 * 0.14))
  const cord = tile.y.add(wander).fract().sub(0.5)
  const footprint = tile.y.fwidth().add(tile.x.fwidth().mul(slope.abs()))
  const rawBody = cord.abs().smoothstep(0.119, 0.1785).oneMinus()
  const body = cord.abs().smoothstep(0.119, footprint.min(0.1).add(0.1785)).oneMinus()
  const plyPhase = cord.mul(24).add(alongPhase.mul(11))
  const plyVisibility = footprint.mul(24).add(tile.x.fwidth().mul(Math.PI * 22)).smoothstep(0.6, 3).oneMinus()
  const ply = plyPhase.sin().mul(plyVisibility).mul(0.5).add(0.5)
  const stitchPhase = tile.x.mul(20)
  const rawStitch = stitchPhase.fract().sub(0.5).abs().div(0.22).smoothstep(0.5, 1).oneMinus()
  const stitchVisibility = stitchPhase.fwidth().smoothstep(0.15, 0.5).oneMinus()
  const stitch = mix(float(0.33), rawStitch, stitchVisibility)
  return {
    along: vec2(1, slope.negate()).normalize(),
    body,
    rawBody,
    rawDent: rawStitch.mul(rawBody),
    dent: stitch.mul(body),
    luster: ply,
  }
}

/** Wine-dark silk velvet with a single gold cord couched across the nap. The pile swallows front light and lets it out only at the folds, so walking around the knot reads the drape in slow crimson blooms; the gold, held down by tiny silk stitches, keeps its own private sunset however you turn. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const pile = mx_fractal_noise_float(p.mul(48), 2, 2, 0.5)
    const nap = mx_noise_float(p.mul(260).add(7)).mul(0.5).add(0.5)
    const fold = mx_fractal_noise_float(p.mul(2.2).add(3), 3, 2, 0.5)
    const cord = thread(tube)
    const pileVisibility = p.mul(96).fwidth().length().smoothstep(0.25, 1).oneMinus()
    const napVisibility = p.mul(260).fwidth().length().smoothstep(0.25, 1).oneMinus()
    const filteredPile = pile.mul(pileVisibility)
    const filteredNap = mix(float(0.5), nap, napVisibility)
    // Microscopic nap belongs in filtered shading, not undersampled vertex displacement.
    const pileHeight = pile.mul(0.04).add(cord.rawBody.mul(1.2)).sub(cord.rawDent.mul(0.55))
    this.positionNode = positionGeometry.add(normalLocal.mul(pileHeight.mul(0.005)))
    const surfaceHeight = filteredPile.mul(0.04).add(filteredNap.mul(intimate).mul(0.12)).add(cord.body.mul(1.2)).sub(cord.dent.mul(0.55))
    this.normalNode = proceduralNormal(surfaceHeight.mul(0.005), 1)
    const wine = color(hsl.integer(3, 78, 4))
    const crest = color(hsl.integer(11, 81, 14))
    const body = mix(wine, crest, fold.mul(0.7).add(filteredPile.mul(0.08)).clamp())
    const gold = mix(color(hsl.integer(76, 92, 60)), color(hsl.integer(93, 100, 92.4)), cord.luster)
    this.colorNode = mix(body, gold, cord.body.clamp(0, 1))
    this.metalnessNode = cord.body.mul(0.55)
    this.roughnessNode = float(0.92).add(filteredNap.mul(0.06)).sub(cord.body.mul(0.6))
    this.sheenNode = color(hsl.integer(14, 90, 36.5)).mul(cord.body.oneMinus().clamp())
    this.sheenRoughness = 0.5
    this.retroreflectivityNode = cord.body.oneMinus().clamp().mul(0.9)
    this.anisotropyNode = cord.along.mul(cord.body.mul(0.85))
    this.clearcoat = 0
    this.envMapIntensity = 0.55
    this.aoNode = cord.dent.mul(0.4).oneMinus()
    const jitter = vec3(mx_noise_float(p.mul(210)), mx_noise_float(p.mul(210).add(9)), mx_noise_float(p.mul(210).add(17))).sub(0.5)
    const napGlint = glints(normalViewGeometry.add(jitter.mul(0.1)).normalize(), 90).mul(napVisibility).mul(near).mul(0.08)
    const cordGlint = glints(normalViewGeometry, cord.luster.mul(110).add(60)).mul(cord.body).mul(2)
    this.emissiveNode = color(hsl.integer(5, 76, 6)).mul(grazing.pow(3).mul(0.16)).add(gold.mul(cord.body).mul(0.5)).add(gold.mul(cordGlint.mul(0.9))).add(color(hsl.integer(11, 100, 67)).mul(napGlint))
  }
}
