import type {Node} from 'three/webgpu'

import {color, float, hash, max, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, uint, vec3} from 'three/tsl'
import {Color, MeshStandardNodeMaterial} from 'three/webgpu'

import {daylight} from '../rendering/daylight.ts'
import {heightNormal, insideBy, visibleDetail} from './filters.ts'

type Float = Node<'float'>

const unit = (node: Float) => node.mul(0.5).add(0.5)
/** the boards’ width across the slope, in meters */
const boardWidth = 0.13
/** how far down the slope each course of slates shows, and how wide a slate is */
const slate = [0.24, 0.3] as const

/**
 * The Forge’s roof, its faces told apart by which way they look: underneath, tongue-and-groove boards limewashed white, so the daylight carries down into the workshop; on top, Welsh slates in courses down the slopes and lead on the flat gutters.
 *
 * The boards run along world x, across the slopes, and are mapped on any face along x, so the slopes, the valleys and the flat strip continue their courses. Without indirect light, boarding that faces down would only get the fill’s olive ground light and turn khaki; it adds the daylight the glazing lets in and the sunlit floor bounces up, which follows the sun.
 */
export default class ForgeRoofMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0.6,
    })
    const p = positionWorld
    const n = normalWorldGeometry
    const footprint = max(p.x.fwidth(), p.y.fwidth(), p.z.fwidth()).toVar('roofFootprint')
    // Across the boards, square to x in every face’s plane: up a slope, along z on a flat soffit.
    const across = p.y.mul(n.z).sub(p.z.mul(n.y)).toVar('roofAcross')
    const outside = n.y.greaterThan(0.3).toVar('roofOutside')
    const flat = n.y.greaterThan(0.97)
    // Joints show while they span a pixel or more; beyond, they blend in as the share they cover, before they could shimmer.
    const detail = visibleDetail(footprint, 0.03)
    const fine = visibleDetail(footprint, 0.01)
    // Boards of random lengths, butted end to end, each with a tone of its own under the wash. Unsigned integers keep every board’s key exact, which floats past 2²⁴ wouldn’t.
    const row = across.div(boardWidth).floor().toVar('roofBoardRow')
    const rowKey = row.add(16_384).toUint().mul(uint(2)).add(select(outside, uint(1), uint(0))).toVar('roofRowKey')
    const boardLength = hash(rowKey).mul(2).add(2.5)
    const shifted = p.x.add(hash(rowKey.add(uint(1_048_573))).mul(boardLength))
    const board = shifted.div(boardLength).floor()
    const boardKey = rowKey.mul(uint(65_537)).add(board.add(16_384).toUint()).add(uint(500_000_000))
    const lv = across.div(boardWidth).fract().sub(0.5).mul(boardWidth)
    const lu = shifted.div(boardLength).fract().sub(0.5).mul(boardLength)
    const edge = float(boardWidth / 2).sub(lv.abs()).min(boardLength.div(2).sub(lu.abs())).toVar('roofBoardEdge')
    const groove = mix(float(0.005 / boardWidth), insideBy(float(0.0025).sub(edge), footprint), detail)
    // The grain shows faintly through the limewash, which lies thicker in places and has worn thin in others.
    const grain = mix(float(0.5), unit(mx_noise_float(vec3(p.x.mul(3), across.mul(90), hash(boardKey).mul(40)))), fine)
    const wash = unit(mx_noise_float(p.mul(1.7))).mul(0.6).add(unit(mx_noise_float(p.mul(11))).mul(0.4))
    const boardTone = hash(boardKey.add(uint(1_048_573))).sub(0.5).mul(0.08).add(1)
    const limewash = color('#ebe5d8').mul(boardTone).mul(grain.sub(0.5).mul(0.07).add(wash.sub(0.5).mul(0.05)).add(1))
    const boarding = mix(limewash, color('#9c9586'), groove)
    // Slates in courses down the slope, each course’s joints halfway along the one below; lead on the flats.
    const course = across.div(slate[0]).floor()
    const slateShift = p.x.add(course.mod(2).mul(slate[1] / 2))
    const slateKey = course.add(16_384).toUint().mul(uint(65_537)).add(slateShift.div(slate[1]).floor().add(16_384).toUint()).add(uint(1_500_000_000))
    const slateEdge = float(slate[1] / 2).sub(slateShift.div(slate[1]).fract().sub(0.5).abs().mul(slate[1])).min(across.div(slate[0]).fract().mul(slate[0]))
    const slateJoint = mix(float(0.008 / slate[1] + 0.004 / slate[0]), insideBy(float(0.004).sub(slateEdge), footprint), visibleDetail(footprint, 0.04))
    const slateTone = mix(color('#454b55'), color('#585a63'), hash(slateKey)).mul(unit(mx_noise_float(p.mul(25))).mul(0.12).add(0.94))
    const slates = mix(slateTone, color('#262a30'), slateJoint)
    const lead = color('#7c807f').mul(unit(mx_noise_float(p.mul(2.3))).mul(0.12).add(0.92))
    const roofing = select(flat, lead, slates)
    this.colorNode = select(outside, roofing, boarding)
    this.roughnessNode = select(outside, select(flat, float(0.5), mix(float(0.62), float(0.85), slateJoint)), mix(float(0.88), float(0.95), groove))
    this.normalNode = heightNormal(select(outside, slateJoint.mul(-0.003), groove.mul(-0.002).add(grain.mul(0.0002))).mul(fine))
    // The daylight the glazing lets in and the floor bounces up, cool from the sky and warm from the sunlit floor, as the boarding scatters it back.
    const bounce = daylight.mul(vec3(...new Color('#e4ecff')).mul(0.06).add(vec3(...new Color('#fff0dc')).mul(0.035)))
    this.emissiveNode = select(outside, vec3(0), boarding.mul(bounce))
  }
}
