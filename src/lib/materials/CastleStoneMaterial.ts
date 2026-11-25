import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, hash, max, min, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, visibleDetail} from './filters.ts'

type Float = Node<'float'>

/** half the width of a mortar joint in the walls, in meters */
const joint = 0.0055
/** width of the chiseled margin around every face, in meters */
const margin = 0.028
const unit = (node: Float) => node.mul(0.5).add(0.5)

/**
 * Dressed ashlar for the Bastion, its passages’ vaults and flags, and the masonry that shows through to the Forge and the Oculus.
 *
 * Walls are laid in 38 cm courses whose blocks each have a length and offset of their own; the floors in broader, squarer flags. Each block is one of four stones – buff and gray limestone, a warm sandstone and the odd rusty, iron-rich block – in a tone of its own, and dressed the way a mason dresses ashlar: a margin chiseled flat around the face in fine strokes square to the arris, and a field boasted in parallel diagonal strokes, slightly pillowed and tilted. The arrises are rounded and chipped, with the odd larger spall, and the lime mortar sits back between them, sandy and pale, shadowed under the block above. Water has seeped down the walls from some of the joints in dark, faintly glossy streaks, and the vaults are darkened by lantern smoke. The flags underfoot are trodden smooth and dull-polished in patches, their joints filled with grime.
 *
 * Mapped by world position and the face’s direction, so one material dresses every wall, vault and floor of the passages. Tool marks, chips and joints fade to their average before they could shimmer.
 */
export default class CastleStoneMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.9,
      envMapIntensity: 0.15,
    })
    const n = normalWorldGeometry
    // Floors, ramps included, are laid out in plan; walls along their run and up; the vaults like walls until they turn flat at the crown.
    const floor = n.y.greaterThan(0.6).toVar('ashlarFloor')
    const flat = floor.or(n.y.lessThan(-0.99))
    const u = select(flat, positionWorld.x, positionWorld.x.add(positionWorld.z)).toVar('ashlarU')
    const v = select(flat, positionWorld.z, positionWorld.y).toVar('ashlarV')
    const footprint = max(u.fwidth(), v.fwidth()).toVar('ashlarFootprint')
    const course = select(floor, float(0.52), float(0.38))
    const rowCoordinate = v.div(course)
    const row = rowCoordinate.floor().toVar('ashlarRow')
    // Hashes need non-negative seeds below 2²⁴; the offsets keep every row and block of a ±400 m stretch positive.
    const rowKey = row.add(1000).mul(7919).add(select(flat, float(3_000_017), float(0)))
    const length = select(floor, mix(float(0.5), float(0.82), hash(rowKey)), mix(float(0.58), float(0.98), hash(rowKey)))
    const shifted = u.add(hash(rowKey.add(1_048_573)).mul(length))
    const columnCoordinate = shifted.div(length)
    const column = columnCoordinate.floor()
    const lu = columnCoordinate.fract().sub(0.5).mul(length).toVar('ashlarLocalU')
    const lv = rowCoordinate.fract().sub(0.5).mul(course).toVar('ashlarLocalV')
    const blockKey = rowKey.mul(4).add(column.add(4000)).toVar('ashlarBlock')
    const random = (stream: number) => hash(blockKey.add(stream * 2_097_143))
    const detail = visibleDetail(footprint, 0.03)
    const fine = visibleDetail(footprint, 0.01)
    const toolDetail = visibleDetail(footprint, 0.006)
    // Distance to the arris in meters, eaten into by small chips everywhere and the odd deep spall.
    const edgeU = length.mul(0.5).sub(lu.abs())
    const edgeV = course.mul(0.5).sub(lv.abs())
    const raw = min(edgeU, edgeV).toVar('ashlarEdge')
    const chipNoise = unit(mx_noise_float(vec3(u.mul(23), v.mul(23), random(1).mul(50))))
    const spallNoise = unit(mx_noise_float(vec3(u.mul(4.5), v.mul(4.5), random(2).mul(50))))
    const spalled = select(random(3).lessThan(0.45), float(1), float(0))
    const chips = chipNoise.smoothstep(0.55, 0.85).mul(0.006).add(spallNoise.smoothstep(0.74, 0.92).mul(0.025).mul(spalled))
    const edge = raw.sub(chips.mul(detail)).toVar('ashlarChippedEdge')
    // Floors have wider, worn joints.
    const halfJoint = select(floor, float(joint * 1.5), float(joint)).add(mx_noise_float(vec2(u, v).mul(3.1)).mul(0.0015))
    const stone = mix(float(1), inside(halfJoint.sub(edge)), detail).toVar('ashlarStone')
    // Four stones from one quarry face, close enough in tone that the courses read as one wall: mostly buff and gray limestone, some warmer sandstone, the odd rusty block.
    const pick = random(4)
    const shade = random(5).sub(0.5).mul(0.12).add(1)
    const isSandstone = pick.greaterThanEqual(0.78).and(pick.lessThan(0.96))
    const tone = select(pick.lessThan(0.5), color(hsl.integer(85, 14, 53)), select(pick.lessThan(0.78), color(hsl.integer(90, 7, 52)), select(isSandstone, color(hsl.integer(71, 15, 52)), color(hsl.integer(64, 21, 46))))).mul(shade)
    // Bedding and mottling inside the stone, sandstone’s most marked; a weathering wash runs across the joints.
    const seed = random(6).mul(80)
    const bedding = mix(float(0.5), unit(mx_noise_float(vec3(lu.mul(1.5), lv.mul(26), seed))), fine)
    const mottle = unit(mx_noise_float(vec3(u.mul(3.2), v.mul(3.2), seed.add(1)))).mul(0.6).add(unit(mx_noise_float(vec3(u.mul(9), v.mul(9), seed.add(4)))).mul(0.4))
    const wash = unit(mx_noise_float(vec3(u.mul(0.7), v.mul(0.9), 5.7)))
    const grain = mix(float(0.5), unit(mx_noise_float(vec3(u.mul(70), v.mul(70), seed.add(2)))), fine)
    const pits = mix(float(0), unit(mx_noise_float(vec3(u.mul(140), v.mul(140), seed.add(5)))).smoothstep(0.72, 0.85), fine)
    const beddingStrength = select(isSandstone, float(0.24), float(0.1))
    const body = tone.mul(bedding.sub(0.5).mul(beddingStrength).add(mottle.sub(0.5).mul(0.45)).add(wash.sub(0.5).mul(0.3)).add(grain.sub(0.5).mul(0.22)).sub(pits.mul(0.3)).add(1))
    // Dressing: a flat, finely chiseled margin and a boasted field, its diagonal strokes set at an angle of the block’s own. Flags are rubbed flat instead.
    const inMargin = edge.smoothstep(margin - 0.003, margin + 0.003).oneMinus()
    const alongArris = select(edgeU.lessThan(edgeV), lv, lu)
    const marginStrokes = unit(alongArris.div(0.005).add(mx_noise_float(vec2(u, v).mul(40)).mul(0.6)).mul(Math.PI * 2).sin())
    const angle = random(7).sub(0.5).mul(0.5).add(select(random(8).greaterThan(0.5), float(0.75), float(-0.75)))
    const strokeAxis = lu.mul(angle.cos()).add(lv.mul(angle.sin()))
    const strokeWobble = mx_noise_float(vec3(lu.mul(6), lv.mul(6), seed.add(3))).mul(0.8)
    const strokes = unit(strokeAxis.div(0.011).add(strokeWobble).mul(Math.PI * 2).sin()).pow(1.5)
    const tooling = mix(strokes, marginStrokes, inMargin).mul(toolDetail).mul(select(floor, float(0.25), float(1)))
    // Pillowed toward the middle, tilted per block, pocked by the boaster and rounded off into the joint.
    const pillow = edge.div(0.15).clamp(0, 1).smoothstep(0, 1)
    const pocks = mix(float(0.5), unit(mx_noise_float(vec3(u.mul(28), v.mul(28), seed.add(7)))), fine)
    const tilt = lu.mul(random(9).sub(0.5).mul(0.012)).add(lv.mul(random(10).sub(0.5).mul(0.012)))
    const shoulder = edge.sub(halfJoint).div(select(floor, float(0.022), float(0.016))).clamp(0, 1).smoothstep(0, 1)
    const faceHeight = pillow.mul(select(floor, float(0.0012), float(0.0025))).add(tilt).add(tooling.mul(0.0005)).add(pocks.mul(select(floor, float(0.0004), float(0.0012)))).sub(chips.mul(0.15))
    // Lime mortar: sandy and pale, shadowed under the block above where the joint runs level.
    const sand = mix(float(0.5), unit(mx_noise_float(positionWorld.mul(150))), fine)
    const underBlock = select(flat, float(0.75), select(lv.greaterThan(0), float(0.62), float(0.86)))
    const mortar = mix(color(hsl.integer(88, 16, 47)), color(hsl.integer(89, 13, 54)), sand).mul(underBlock)
    let surface: Node<'vec3'> = mix(mortar, body.mul(shoulder.mul(0.2).add(0.8)).mul(tooling.sub(0.5).mul(0.06).add(1)), stone)
    // Seepage: dark streaks running down from some of the joints, glossy while still damp.
    const wall = select(flat, float(0), float(1))
    const streakField = unit(mx_noise_float(vec3(u.mul(4), v.mul(0.3), 7.3))).mul(unit(mx_noise_float(vec3(u.mul(0.9), v.mul(0.15), 9.1))))
    const seep = streakField.smoothstep(0.34, 0.52).mul(wall).toVar('ashlarSeep')
    surface = surface.mul(seep.mul(-0.28).add(1))
    // Lantern smoke has darkened what faces down, the crown of the vaults most.
    const smoke = n.y.negate().smoothstep(0.2, 1).mul(unit(mx_noise_float(positionWorld.mul(0.8))).mul(0.2).add(0.15))
    surface = surface.mul(smoke.oneMinus())
    // Underfoot, grime gathers in the joints and the flags are trodden into dull-polished patches.
    const trodden = unit(mx_noise_float(vec3(positionWorld.x.mul(0.7), positionWorld.z.mul(0.7), 3.3))).smoothstep(0.35, 0.75).mul(select(floor, float(1), float(0)))
    surface = select(floor, surface.mul(stone.mul(0.3).add(0.7)).mul(trodden.mul(-0.05).add(1)), surface)
    // Far off, the dressing blends into the tone of the stone.
    this.colorNode = mix(body.mul(0.92), surface, detail.mul(0.8).add(0.2))
    const stoneRoughness = float(0.9).add(grain.sub(0.5).mul(0.06)).sub(seep.mul(0.3))
    const floorRoughness = float(0.8).sub(trodden.mul(0.25))
    this.roughnessNode = mix(float(0.97), select(floor, floorRoughness, stoneRoughness), stone)
    const mortarHeight = sand.mul(0.0008).sub(0.008)
    const height = mix(mortarHeight, faceHeight.add(shoulder.mul(0.0025)), shoulder).mul(detail)
    this.normalNode = heightNormal(height)
  }
}
