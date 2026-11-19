import type {Node} from 'three/webgpu'

import {atan, color, float, hash, max, min, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, uint, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, insideBy, line, visibleDetail} from './filters.ts'

export type EndGrainFloorOptions = {
  /** how long each block is along world x, in meters */
  length?: number
  seed?: number
  /** how wide each course of blocks is along world z, in meters */
  width?: number
}

type Float = Node<'float'>

const unit = (node: Float) => node.mul(0.5).add(0.5)

/**
 * End-grain wood blocks, the floor of 19th century workshops and foundries, which took dropped tools and hot sparks better than boards: oak blocks stood on end in courses along world x, each course shifted by half a block, set in dark pitch.
 * Every block shows the rings of its own log, most of them as arcs round a pith outside the block, now and then round one inside it. Late wood draws darker, rays cross the rings, and a few blocks have split along a ray as they dried. The blocks differ in tone and are worn a little proud and dull in the middle, glossier where oil has soaked the late wood.
 *
 * Mapped by world position, so the floors of a room and its vestibule continue each other’s courses. Rings and joints fade to their average before they could shimmer.
 */
export default class EndGrainFloorMaterial extends MeshStandardNodeMaterial {
  constructor({length = 0.2, seed = 0, width = 0.1}: EndGrainFloorOptions = {}) {
    super({
      roughness: 0.62,
      metalness: 0,
      envMapIntensity: 0.5,
    })
    const point = positionWorld.xz.toVar('blockPoint')
    const footprint = max(positionWorld.x.fwidth(), positionWorld.z.fwidth()).toVar('blockFootprint')
    const courseCoordinate = point.y.div(width)
    const course = courseCoordinate.floor().toVar('blockCourse')
    const shifted = point.x.div(length).add(course.mod(2).mul(0.5))
    const column = shifted.floor()
    const local = vec2(shifted.fract().sub(0.5).mul(length), courseCoordinate.fract().sub(0.5).mul(width)).toVar('blockLocal')
    // Unsigned integers keep every block’s key exact, which floats past 2²⁴ wouldn’t; the offset keeps a ±400 m floor’s courses positive.
    const key = course.add(4096).toUint().mul(uint(65_537)).add(column.add(4096).toUint()).add(uint(seed * 7919)).toVar('blockKey')
    const random = (stream: number) => hash(key.add(uint(stream * 1_048_573)))
    // Joints show while they span a pixel or more; beyond, they blend into the floor’s tone as the share of it they cover, before they could shimmer, and the blocks’ own tones soon after.
    const detail = visibleDetail(footprint, 0.016)
    const blockDetail = visibleDetail(footprint, width)
    const ringDetail = visibleDetail(footprint, 0.008)
    const edge = min(float(length / 2).sub(local.x.abs()), float(width / 2).sub(local.y.abs())).toVar('blockEdge')
    // The pith of the block’s log: mostly well outside it, so its rings run across as arcs.
    const angle = random(1).mul(Math.PI * 2)
    const reach = random(2).pow(1.6).mul(0.32).add(0.015)
    const pith = vec2(angle.cos(), angle.sin()).mul(reach)
    const fromPith = local.sub(pith).toVar('blockFromPith')
    const radius = fromPith.length().toVar('blockRingRadius')
    const around = atan(fromPith.y, fromPith.x)
    // Rings of 4 to 8 mm, as fast-grown oak lays them down, wandering a little round the log.
    const density = random(3).mul(130).add(125)
    const wander = mx_noise_float(vec3(fromPith.mul(9), random(4).mul(50))).mul(0.9)
    const phase = radius.mul(density).add(wander).fract()
    const lateWood = phase.smoothstep(0.55, 0.85).mul(phase.smoothstep(0.97, 1).oneMinus())
    // Rays cross the rings, a fine light streak every few millimeters round the log.
    const arc = around.mul(radius)
    const rays = unit(mx_noise_float(vec2(arc.mul(320), radius.mul(14).add(random(5).mul(30))))).smoothstep(0.78, 0.9)
    // A drying check along a ray in a fifth of the blocks, from the side nearest the pith inward.
    const crackAround = random(6).sub(0.5).mul(0.9).add(angle.add(Math.PI))
    const crackOffset = around.sub(crackAround).mul(radius)
    const cracked = select(random(7).lessThan(0.2), float(1), float(0))
    const crack = line(crackOffset, 0.00035).mul(radius.smoothstep(reach.sub(0.02), reach.add(0.05)).oneMinus()).mul(cracked)
    // Oak of several trees, from honey to brown, darkened by years of oil and grime.
    const pick = random(8)
    const average = color('#86603a')
    const tone = mix(average, mix(mix(color('#93663c'), color('#744c2f'), pick.smoothstep(0.2, 0.7)), color('#ad7f4b'), pick.smoothstep(0.85, 1)).mul(random(9).sub(0.5).mul(0.22).add(1)), blockDetail)
    const grain = mix(float(0.3), lateWood, ringDetail)
    const rayShare = mix(float(0.12), rays, ringDetail)
    // Late wood draws darker, sapwood lighter toward the bark, the pith’s heart a shade darker.
    const heart = radius.div(reach.add(0.08)).clamp(0, 1)
    const wood = tone.mul(grain.mul(-0.4).add(1)).mul(rayShare.mul(0.16).add(1)).mul(crack.mul(ringDetail).mul(-0.6).add(1)).mul(mix(float(1), heart.mul(0.16).add(0.92), blockDetail))
    // Oil and grime have soaked in in broad patches; boots have scuffed others pale.
    const grime = unit(mx_noise_float(vec3(point.mul(0.9), seed + 3))).smoothstep(0.3, 0.8).mul(0.2)
    const stains = unit(mx_noise_float(vec3(point.mul(3.3), seed + 9))).smoothstep(0.62, 0.8).mul(0.14)
    const scuff = unit(mx_noise_float(vec3(point.mul(14), seed + 5))).smoothstep(0.6, 0.85).mul(0.08)
    const worn = wood.mul(grime.add(stains).oneMinus()).mul(scuff.add(1))
    // Pitch fills the joints, which wear into a soft groove at every block’s edge.
    const joint = mix(float(1 - 0.0028 * (1 / length + 1 / width)), insideBy(float(0.0014).sub(edge), footprint), detail)
    const pitch = color('#1e140e')
    const top = normalWorldGeometry.y.step(0.5)
    const surface = mix(pitch, worn, joint)
    this.colorNode = mix(tone.mul(0.6), surface, top)
    this.roughnessNode = mix(float(0.8), float(0.66).sub(lateWood.mul(ringDetail).mul(0.1)).sub(stains.mul(1.2)).add(scuff.mul(1.2)).sub(random(10).mul(0.08).mul(blockDetail)), joint)
    const shoulder = edge.sub(0.0014).div(0.006).clamp(0, 1).smoothstep(0, 1)
    // Some blocks stand a hair prouder than their neighbors, rounded off into the joint all the same.
    const crown = shoulder.mul(random(11).mul(0.0006).add(0.0008))
    const relief = lateWood.mul(0.00008).mul(ringDetail).sub(crack.mul(0.0004))
    this.normalNode = heightNormal(mix(float(-0.0012), crown.add(relief), joint).mul(visibleDetail(footprint, 0.02)).mul(top))
  }
}
