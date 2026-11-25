import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, tangentLocal, time, transformNormalToView, vec2, vec3} from 'three/tsl'

import {environmentHighlight, studioSheen} from '../../candidates/claude_fable/lib/environmentHighlight.ts'
import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {knotLength, tubeCircumference, tubeCoordinates} from '../../candidates/claude_fable/lib/tubeCoordinates.ts'
import {voronoi} from '../../candidates/claude_fable/lib/voronoiCells.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Shards: Voronoi cells over the unwrapped tube, wrapped so the break pattern closes on itself. */
const shardsAlong = 22
const shardsAround = 4
const shardAlong = knotLength / shardsAlong
const shardAround = tubeCircumference / shardsAround
/** A shattered stoneware vessel mended with gold: lacquer seams in relief, each shard a little tilted, the gold still liquid. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {grazing, near, intimate} = viewerFrame()
    const {along, around} = tubeCoordinates()
    const p = positionGeometry
    const n = normalLocal.normalize()
    const alongDirection = tangentLocal.normalize()
    const aroundDirection = n.cross(alongDirection).normalize()
// Break lines: Voronoi borders, warped so they wander like real fractures rather than straight polygon edges.
    const wobble = mx_noise_float(p.mul(9).add(vec3(3.1, 7.7, 1.3))).mul(0.14)
    const wobble2 = mx_noise_float(p.mul(9).add(vec3(-5.2, 2.4, 8.8))).mul(0.14)
    const coord = vec2(along.mul(shardsAlong).add(wobble), around.mul(shardsAround).add(wobble2))
    const shards = voronoi(coord, [shardsAlong, shardsAround], 0.9)
// Distance to the seam in object units (lattice units × the smaller physical cell size keeps seams of even width).
    const seamDistance = shards.second.sub(shards.distance).mul(Math.min(shardAlong, shardAround) * 0.5)
// Not every crack is mended: a few hairline fractures stay dark, and some borders are no crack at all.
    const borderRandom = cellNoiseVec3(vec3(shards.id, 5))
    const seamWidth = float(0.0055).add(mx_noise_float(p.mul(30)).mul(0.002))
    const footprint = seamDistance.fwidth().max(1e-5)
    const seam = seamDistance.smoothstep(seamWidth.add(footprint), seamWidth.sub(footprint))
    const seamProfile = seamDistance.div(seamWidth).clamp().pow2().oneMinus().sqrt()
// Fine hairline cracks radiating from the seams, resolved only up close.
    const crackField = mx_noise_float(p.mul(60).add(shards.id.x.mul(0.3)))
    const hairline = crackField.abs().smoothstep(0.02, 0.004).mul(seamDistance.smoothstep(0.06, 0.012)).mul(near).mul(borderRandom.x.smoothstep(0.5, 0.6))
// Stoneware: an ash glaze with crazing, speckles of iron and a soft tenmoku bloom toward the shard edges.
    const shardRandom = cellNoiseVec3(vec3(shards.id, 1))
    const glazeNoise = mx_fractal_noise_float(p.mul(5).add(shardRandom.xyz.mul(3)), 4, 2.1, 0.5).mul(0.5).add(0.5)
    const crazing = mx_noise_float(p.mul(45)).abs().smoothstep(0.03, 0.012).mul(near).mul(0.5)
    const speckle = cellNoiseVec3(p.mul(180)).x.smoothstep(0.93, 0.97).mul(near)
    const celadon = mix(rgb(hsl.integer(175, 21, 48)), rgb(hsl.integer(184, 31, 29)), glazeNoise)
    const tenmoku = rgb(hsl.integer(41, 33, 13))
    const bloom = seamDistance.smoothstep(0.05, 0.012).mul(0.6).mul(borderRandom.y.smoothstep(0.3, 0.7))
    let glaze = mix(celadon, tenmoku, bloom)
    glaze = mix(glaze, rgb(hsl.integer(67, 12, 12)), speckle.mul(0.8))
    glaze = mix(glaze, rgb(hsl.integer(160, 6, 27)), crazing.mul(0.4))
    glaze = mix(glaze, rgb(hsl.integer(67, 16, 8)), hairline.mul(0.9))
// Gold: the lacquer never quite set. Light swims along the seams and a slow current flows through them.
    const flow = time.mul(0.35)
    const seamPhase = shards.point.x.mul(0.7).add(shards.point.y.mul(1.9))
    const ripple = mx_noise_float(vec3(seamDistance.mul(80), along.mul(140).sub(flow.mul(3)), seamPhase)).mul(0.5).add(0.5)
    const molten = mx_noise_float(vec3(along.mul(40).add(flow), around.mul(12), 2.2)).mul(0.5).add(0.5)
    const goldColor = mix(rgb(hsl.integer(76, 86, 62)), rgb(hsl.integer(91, 100, 89)), ripple.mul(0.5).add(molten.mul(0.5)))
    this.colorNode = mix(glaze, goldColor, seam)
    this.metalnessNode = seam
    this.roughnessNode = mix(float(0.42).sub(glazeNoise.mul(0.12)).add(crazing.mul(0.2)), float(0.12).add(ripple.mul(0.06)), seam)
    this.clearcoatNode = seam.oneMinus().mul(0.8)
    this.clearcoatRoughness = 0.12
// Relief: each shard sits at a slightly different tilt, the seams swell as a rounded bead of gold.
    const tilt = shardRandom.xy.sub(0.5).mul(0.06)
    const shardNormal = n.add(alongDirection.mul(tilt.x)).add(aroundDirection.mul(tilt.y)).normalize()
    const beadHeight = seamProfile.mul(seam).mul(0.004).add(ripple.mul(seam).mul(0.0008)).sub(hairline.mul(0.0015)).sub(crazing.mul(0.0004))
    const surfaceNormal = proceduralNormal(beadHeight, 1).add(transformNormalToView(shardNormal).sub(transformNormalToView(n))).normalize()
    this.normalNode = surfaceNormal
// Gold in a soft room needs its own contrast: crisp images of the lights, and a slow liquid shimmer.
    const goldFlash = environmentHighlight(environment, shardNormal, 0.15).mul(goldColor).mul(seam).mul(0.9)
    const sheen = goldColor.mul(studioSheen(shardNormal)).mul(seam).mul(0.55)
    const shimmer = glints(surfaceNormal, 90).mul(seam).mul(ripple.smoothstep(0.4, 0.9)).mul(near.mul(0.6).add(0.4))
    const warmth = rgb(hsl.integer(62, 100, 74)).mul(seam).mul(molten.pow(2)).mul(intimate.mul(0.6).add(0.15)).mul(0.5)
    const edgeLight = rgb(hsl.integer(170, 16, 84)).mul(grazing.pow(4)).mul(seam.oneMinus()).mul(0.04)
    this.emissiveNode = goldFlash.add(sheen).add(rgb(hsl.integer(92, 100, 94.7)).mul(shimmer).mul(0.6)).add(warmth).add(edgeLight)
  }
}
