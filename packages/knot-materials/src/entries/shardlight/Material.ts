import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_vec3, negateOnBackSide, normalLocal, positionGeometry, transformNormalToView, vec3} from 'three/tsl'

import {voronoi3} from '../../candidates/deepseek/lib/voronoi.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Saturates a spectral sample into the narrow, electric band a dichroic coating produces. */
const vivid = (tint: ReturnType<typeof spectralColor>) => {
  const gray = tint.dot(vec3(0.2126, 0.7152, 0.0722))
  return gray.add(tint.sub(gray).mul(2.6)).clamp()
}
/** A mosaic of mirror shards, each cut at its own angle. Most of the knot is smoked obsidian, so the polished minority reads as a constellation that re-arranges itself as the viewer walks around. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const {p, facing, grazing, near} = viewerFrame()
    const scale = 12
    const tubeRadius = 0.132
// A gentle warp gives the shards the uneven sizes of a real fracture without bending their seams.
    const warp = mx_fractal_noise_vec3(p.mul(2.2), 2, 2.05, 0.5).mul(0.24)
    const q = p.mul(scale).add(warp)
    const cell = voronoi3(q)
    const footprint = q.fwidth().length().max(0.0001)
// Shards that fall below a pixel stop tilting and blur into one soft mirror instead of aliasing.
    const resolved = footprint.smoothstep(0.16, 0.85).oneMinus()
    const identity = cellNoiseVec3(cell.key)
    const identity2 = cellNoiseVec3(cell.key.add(vec3(13.7, 5.1, 8.3)))
    const surface = normalLocal.normalize()
// A shard is glued tangent at its centre, so its plane normal is the tube normal at the feature
// point, not at the shaded sample. Offsetting by the curvature removes all highlight bleed.
    const toward = cell.offset.div(scale)
    const centreNormal = surface.add(toward.sub(surface.mul(toward.dot(surface))).div(tubeRadius)).normalize()
    const tilt = identity.mul(2).sub(1).add(vec3(0.017, 0.031, 0.011)).normalize()
    const shardNormal = centreNormal.add(tilt.mul(resolved.mul(0.5).add(0.06))).normalize()
// Three zones across every seam: a hairline cavity, a razor chamfer, then the dead-flat shard.
    const grooveWidth = footprint.mul(0.4).max(0.006)
    const chamferWidth = grooveWidth.mul(2.2)
    const groove = cell.edge.smoothstep(0, grooveWidth)
    const chamfer = cell.edge.smoothstep(grooveWidth, chamferWidth)
    const chamferNormal = surface.add(toward.normalize().mul(1.05)).normalize()
    const normal = mix(mix(surface, chamferNormal, groove), shardNormal, chamfer)
    this.normalNode = negateOnBackSide(transformNormalToView(normal))
    this.clearcoatNormalNode = this.normalNode
// A minority of shards are polished silver; a rarer set is dichroic, its hue sliding with the view.
    const polish = identity2.z.smoothstep(0.74, 0.93)
    const dichroic = identity2.y.smoothstep(0.6, 0.85)
    const tint = vivid(spectralColor(identity2.x.mul(4.2).add(facing.mul(2.4)).add(grazing.mul(3.4))))
    const metal = mix(color(hsl.integer(255, 31, 85)), tint, dichroic)
// Hairline fractures inside a shard only resolve up close.
    const crack = mx_fractal_noise_vec3(p.mul(34), 2, 2, 0.5).x.abs().sub(0.02)
    const crackLine = crack.smoothstep(0, footprint.mul(2.2).add(0.006)).oneMinus().mul(near).mul(polish.oneMinus())
    const shardColor = mix(color(hsl.integer(260, 19, 6)), metal, polish).mul(crackLine.mul(-0.45).add(1))
    this.colorNode = mix(color(hsl.integer(259, 25, 4)), shardColor, chamfer)
    this.metalness = 1
    this.roughnessNode = mix(float(0.6), mix(float(0.2), float(0.03), polish), chamfer).add(resolved.oneMinus().mul(0.35))
    this.clearcoat = 0.35
    this.clearcoatRoughness = 0.06
// The shards are prisms: each one lifts off the tube, so the silhouette is cut glass, not a pipe.
// The vertex stage has no screen-space derivatives, so the lift uses a fixed chamfer profile.
    const liftProfile = cell.edge.smoothstep(0.007, 0.018)
    this.positionNode = positionGeometry.add(normalLocal.mul(liftProfile.mul(identity.z.mul(0.003).add(0.0018))))
    this.emissiveNode = tint.mul(dichroic).mul(chamfer).mul(grazing.pow(4)).mul(near.mul(0.5).add(0.06)).mul(0.6)
      .add(color(hsl.integer(260, 37, 67)).mul(grazing.pow(3)).mul(facing.pow(3)).mul(0.05))
  }
}
