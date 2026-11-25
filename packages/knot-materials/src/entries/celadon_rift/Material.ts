import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_fractal_noise_vec3, negateOnBackSide, normalLocal, positionGeometry, transformNormalToView, vec3} from 'three/tsl'

import {voronoi3} from '../../candidates/deepseek/lib/voronoi.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A celadon vessel that was smashed and put back together with gold. The lattice is heavily warped so the breaks are long, jagged and unequal — a pot shatters into a dozen pieces, not a thousand tiles — and every seam is a river of lacquer and gold leaf standing proud of the glaze, thicker where the break ran deep. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const scale = 4.2
// Warping hard is what turns a Voronoi diagram into a fracture.
    const warp = mx_fractal_noise_vec3(p.mul(3.4), 3, 2.2, 0.55).mul(0.85)
    const q = p.mul(scale).add(warp)
    const cell = voronoi3(q)
    const footprint = q.fwidth().length().max(0.0001)
    const identity = cellNoiseVec3(cell.key)
    const identity2 = cellNoiseVec3(cell.key.add(vec3(41.3, 7.7, 19.1)))
    const resolved = footprint.smoothstep(0.14, 0.8).oneMinus()
// Each break has its own width, and a few places never separated at all.
    const breakDepth = mx_fractal_noise_float(p.mul(2.3).add(vec3(17, 5, 3)), 3, 2.1, 0.5).mul(0.5).add(0.5)
    const seamWidth = footprint.mul(0.6).add(identity.x.mul(0.02)).add(breakDepth.mul(0.03)).add(0.014)
// Three zones: the open crack, the gold that fills it, then the glaze.
    const goldBand = cell.edge.smoothstep(0, seamWidth).oneMinus()
    const openCrack = cell.edge.smoothstep(0, seamWidth.mul(0.28)).oneMinus()
    const glazeMask = cell.edge.smoothstep(seamWidth, seamWidth.mul(1.7))
    const crazing = mx_fractal_noise_float(p.mul(74), 3, 2.3, 0.5)
    const crazed = crazing.abs().smoothstep(0, footprint.mul(2).add(0.01)).oneMinus().mul(near).mul(0.55)
// Shards are never quite true after firing: a hair of tilt, a hair of lift.
    const surface = normalLocal.normalize()
    const lift = vec3(identity.y.sub(0.5), identity.z.sub(0.5), identity.x.sub(0.5)).mul(0.22)
    const shardNormal = surface.add(lift.mul(resolved.mul(0.8).add(0.2))).normalize()
    const shoulderNormal = surface.add(cell.offset.normalize().mul(0.7)).normalize()
    const crazedNormal = surface.add(vec3(crazing.dFdx(), crazing.dFdy(), 0).mul(0.02)).normalize()
    const normal = mix(mix(crazedNormal, shoulderNormal, goldBand), shardNormal, glazeMask)
    this.normalNode = negateOnBackSide(transformNormalToView(normal))
    this.clearcoatNormalNode = this.normalNode
// ------------------------------------------------------------------
// Celadon glaze: pale, wet-looking, crazed with a fine crackle net.
// ------------------------------------------------------------------
    const glazeBase = mix(color(hsl.integer(178, 34, 20)), color(hsl.integer(178, 36, 47)), mx_fractal_noise_float(p.mul(3.4), 3, 2.05, 0.5).mul(0.5).add(0.5))
    const glaze = glazeBase.mul(crazed.mul(-0.3).add(1))
// ------------------------------------------------------------------
// Gold: hammered leaf pressed into the crack, pooling in the deep runs.
// ------------------------------------------------------------------
    const hammer = mx_fractal_noise_float(p.mul(44), 2, 2.1, 0.5).mul(0.5).add(0.5)
    const gold = mix(color(hsl.integer(74, 88, 63)), color(hsl.integer(93, 100, 92.4)), hammer.mul(0.7).add(0.3))
    const goldTint = mix(gold, color(hsl.integer(83, 85, 76)), identity2.y.mul(0.4))
    this.colorNode = mix(mix(glaze, goldTint, goldBand), glaze.mul(0.22), openCrack)
    this.metalnessNode = goldBand.mul(0.98).add(0.02)
    this.roughnessNode = mix(mix(float(0.3), float(0.2), goldBand), float(0.6), openCrack).add(crazed.mul(0.12))
    this.clearcoatNode = goldBand.oneMinus().mul(0.6)
    this.clearcoatRoughnessNode = mix(float(0.03), float(0.35), openCrack)
    this.ior = 1.5
// The gold stands above the glaze, so the silhouette itself is repaired.
    const liftProfile = cell.edge.smoothstep(0.012, 0.03)
    this.positionNode = positionGeometry.add(normalLocal.mul(liftProfile.mul(0.0035).sub(liftProfile.oneMinus().mul(0.0012))))
    this.emissiveNode = goldTint.mul(goldBand).mul(grazing.pow(2.2)).mul(intimate.mul(0.5).add(0.15)).mul(0.4)
      .add(color(hsl.integer(94, 100, 95.6)).mul(openCrack).mul(facing.pow(5)).mul(0.06))
      .add(goldTint.mul(goldBand).mul(facing.pow(3)).mul(near).mul(0.1))
  }
}
