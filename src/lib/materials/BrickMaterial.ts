import type {Node} from 'three/webgpu'

import {acos, atan, color, float, hash, max, min, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, uint, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, insideBy, visibleDetail} from './filters.ts'

/**
 * How the courses are laid out over the surfaces the material covers:
 * - `planar`: walls along the world axes, their reveals and gables, in courses up from the floor, laid flat on faces looking up or down;
 * - `ring`: a round wall round `center`, the courses following its curve from `seam`, the angle (from world x toward world z) where its ends meet, and its arches’ reveals running straight back from it;
 * - `dome`: a spherical vault round `center` with the given radius, in rings round its crown, as many whole bricks to a course as fit.
 */
export type BrickMapping = {
  center: readonly [x: number, y: number, z: number]
  kind: 'dome'
  radius: number
} | {
  center: readonly [x: number, z: number]
  kind: 'ring'
  /** the radius of the wall’s face, along which the courses are measured */
  radius: number
  seam: number
} | {
  kind: 'planar'
}

/** a band of glazed bricks round the foot of the walls, under a course of another glaze */
export type BrickDado = {
  /** the cap course’s glaze, as sRGB hex */
  cap: string
  /** how many courses high the dado is, its cap course included */
  courses: number
  /** the dado’s glaze, as sRGB hex */
  glaze: string
}
export type BrickOptions = {
  dado?: BrickDado
  mapping: BrickMapping
  /** from where to where up the walls the smoke of the workshop has darkened them, in meters over the floor */
  soot?: readonly [number, number]
}
type Float = Node<'float'>

/** A brick’s length, its header’s and its height, each with a joint, in meters: 215 × 102.5 × 65 mm bricks in 10 mm joints. */
const brick = {
  stretcher: 0.225,
  header: 0.1125,
  course: 0.075,
  joint: 0.005,
} as const
/** a stretcher and a header, the length after which every course of Flemish bond repeats */
const period = brick.stretcher + brick.header
const unit = (node: Float) => node.mul(0.5).add(0.5)
/** the share of a wall the joints cover: one along every course and one between every two bricks, a stretcher and a header each period */
const mortarShare = brick.joint * 2 / brick.course + brick.joint * 2 * 2 / period
/**
 * Where a point lies in the courses: `u` along its course and `v` up across the courses, in meters, or for a dome, `u` the share of a turn round its crown and `v` the meters down from it, with `ringBricks` the number of bricks in the point’s course.
 */
function courseCoordinates(mapping: BrickMapping): {
  ringBricks?: Float
  u: Float
  v: Float
} {
  const p = positionWorld
  const n = normalWorldGeometry
  switch (mapping.kind) {
    case 'planar': {
      const [ax, ay, az] = [n.x.abs(), n.y.abs(), n.z.abs()]
      const flat = ay.greaterThan(max(ax, az))
      const facingX = ax.greaterThan(az)
      return {
        u: select(flat, p.x, select(facingX, p.z, p.x)).toVar('brickU'),
        v: select(flat, p.z, p.y).toVar('brickV'),
      }
    }
    case 'ring': {
      const offset = p.xz.sub(vec2(...mapping.center)).toVar('brickRingOffset')
      const distance = offset.length()
      const radial = offset.div(distance.max(1e-6))
      // Turned so that the angle runs from the wall’s seam, where its ends meet, all the way round: measured from across the seam, it jumps there.
      const across = mapping.seam + Math.PI
      const turned = vec2(radial.x.mul(Math.cos(across)).add(radial.y.mul(Math.sin(across))), radial.y.mul(Math.cos(across)).sub(radial.x.mul(Math.sin(across))))
      const angle = atan(turned.y, turned.x).add(Math.PI)
      const along = angle.mul(mapping.radius)
      const facing = n.xz.dot(radial).abs()
      const sideways = n.xz.dot(vec2(radial.y.negate(), radial.x)).abs()
      const flat = n.y.abs().greaterThan(max(facing, sideways))
      // The jambs of an arch through the wall run straight back from its face, its soffit overhead.
      const jamb = sideways.greaterThan(facing)
      return {
        u: select(flat, along, select(jamb, distance, along)).toVar('brickU'),
        v: select(flat, distance, p.y).toVar('brickV'),
      }
    }
    case 'dome': {
      const [x, y, z] = mapping.center
      const offset = p.sub(vec3(x, y, z)).toVar('brickDomeOffset')
      const polar = acos(offset.y.div(offset.length().max(1e-6)).clamp(-1, 1))
      const v = polar.mul(mapping.radius).toVar('brickV')
      // Each course is a ring of whole bricks about a stretcher long round the middle of its height.
      const courseMiddle = v.div(brick.course).floor().add(0.5).mul(brick.course)
      const ringBricks = float(Math.PI * 2 * mapping.radius).mul(courseMiddle.div(mapping.radius).sin()).div(brick.stretcher).round().max(6).toVar('brickRing')
      return {
        u: atan(offset.z, offset.x).div(Math.PI * 2).add(0.5).toVar('brickU'),
        v,
        ringBricks,
      }
    }
  }
}
/** The radius of the dome’s ring at `v` meters down from its crown, or 1 for the other mappings, whose `u` is in meters already. */
function ringRadius(mapping: BrickMapping, v: Float): Float {
  return mapping.kind === 'dome' ? v.div(mapping.radius).sin().mul(mapping.radius) : float(1)
}
/**
 * Hand-made red brick in Flemish bond, struck with lime mortar, as Victorian workshops were built: in every course, stretchers alternate with headers, each header centered over the stretcher below, and many of the headers are burnt a darker purple, which chequers the wall from a distance.
 * Every brick has a tone of its own between orange-red and plum, a sandy face with the odd pit and iron spot, slightly pillowed and rounded at its arrises; the mortar lies a few millimeters back. Optionally, a glazed dado runs round the foot of the walls and smoke darkens them toward the roof.
 *
 * Mapped by world position, so walls, reveals and gables in a plane continue each other’s courses; see {@link BrickMapping} for curved walls and domes. Joints and grain fade to their average before they could shimmer.
 */
export default class BrickMaterial extends MeshStandardNodeMaterial {
  constructor({dado, mapping, soot}: BrickOptions) {
    super({
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.6,
    })
    const p = positionWorld
    const n = normalWorldGeometry
    const footprint = max(p.x.fwidth(), p.y.fwidth(), p.z.fwidth()).toVar('brickFootprint')
    const {u, v, ringBricks} = courseCoordinates(mapping)
    const course = v.div(brick.course).floor().toVar('brickCourse')
    const lv = v.div(brick.course).fract().sub(0.5).mul(brick.course).toVar('brickLocalV')
    // Flemish bond, or in a dome’s rings a whole number of stretchers to the course.
    const odd = course.mod(2)
    let lu: Float
    let halfLength: Float
    let header: Float
    let key: Float
    if (ringBricks) {
      const along = u.mul(ringBricks).add(odd.mul(0.5))
      const index = along.floor().mod(ringBricks)
      const length = float(Math.PI * 2).div(ringBricks)
      lu = along.fract().sub(0.5).mul(length).mul(ringRadius(mapping, v))
      halfLength = length.mul(ringRadius(mapping, v)).mul(0.5)
      header = float(0)
      key = index
    } else {
      const shifted = u.add(odd.mul(period / 2))
      const cell = shifted.div(period).floor()
      const offset = shifted.sub(cell.mul(period))
      const isHeader = offset.greaterThanEqual(brick.stretcher)
      lu = select(isHeader, offset.sub(brick.stretcher + brick.header / 2), offset.sub(brick.stretcher / 2))
      halfLength = select(isHeader, float(brick.header / 2), float(brick.stretcher / 2))
      header = select(isHeader, float(1), float(0))
      key = cell.mul(2).add(header)
    }
    lu = lu.toVar('brickLocalU')
    // Unsigned integers keep every brick’s key exact, which floats past 2²⁴ wouldn’t; the offsets keep the courses and bricks of a ±1 km wall positive.
    const brickKey = course.add(16_384).toUint().mul(uint(65_537)).add(key.add(16_384).toUint()).toVar('brickKey')
    const random = (stream: number) => hash(brickKey.add(uint(stream * 1_048_573)))
    // Joints show while they span a pixel or more; beyond, they blend into the wall’s tone as the share of it they cover, before they could shimmer.
    const detail = visibleDetail(footprint, brick.joint * 6)
    const fine = visibleDetail(footprint, 0.004)
    const edge = min(halfLength.sub(lu.abs()), float(brick.course / 2).sub(lv.abs())).toVar('brickEdge')
    // Hand-made bricks are never quite square: their arrises wander and chip.
    const wobble = mx_noise_float(p.mul(60).add(random(1).mul(40))).mul(0.0012).mul(fine)
    const face = mix(float(1 - mortarShare), insideBy(float(brick.joint).sub(edge).add(wobble), footprint), detail).toVar('brickFace')
    // Tones from orange-red to plum, with the odd overburnt one; Flemish headers often came from the hotter end of the kiln.
    const pick = random(2)
    const shade = random(3).sub(0.5).mul(0.16).add(1)
    const common = select(pick.lessThan(0.4), color('#9a4430'), select(pick.lessThan(0.75), color('#8a3a29'), select(pick.lessThan(0.93), color('#a3532f'), color('#5e2f2c'))))
    const burnt = header.mul(select(random(4).lessThan(0.55), float(0.55), float(0.15)))
    const tone = mix(common, color('#47282a'), burnt).mul(shade)
    const seed = random(5).mul(60)
    const mottle = unit(mx_noise_float(p.mul(9).add(seed)))
    const sand = mix(float(0.5), unit(mx_noise_float(p.mul(220).add(seed))), fine)
    const spots = mix(float(0), unit(mx_noise_float(p.mul(70).add(seed.add(3)))).smoothstep(0.78, 0.88), fine)
    const pits = mix(float(0), unit(mx_noise_float(p.mul(110).add(seed.add(7)))).smoothstep(0.8, 0.9), fine)
    const fired = tone.mul(mottle.sub(0.5).mul(0.22).add(sand.sub(0.5).mul(0.16)).add(1)).mul(spots.mul(-0.45).add(1)).mul(pits.mul(-0.25).add(1))
    // Lime mortar, sandy and pale, struck back from the arrises.
    const mortarSand = mix(float(0.5), unit(mx_noise_float(p.mul(300))), fine)
    const mortar = mix(color('#8c8472'), color('#aaa18d'), mortarSand).mul(unit(mx_noise_float(p.mul(2.2).add(31))).mul(0.16).add(0.92))
    let surface: Node<'vec3'> = mix(mortar, fired, face)
    let roughness: Float = mix(float(0.95), float(0.84).add(sand.sub(0.5).mul(0.1)).add(random(8).sub(0.5).mul(0.1)), face)
    // A pillowed face, rounded off into the joint.
    const shoulder = edge.sub(brick.joint).div(0.01).clamp(0, 1).smoothstep(0, 1)
    // Each brick sits a little proud or shy of its neighbors and leans a little, as hand-laid bricks do.
    const lean = lu.mul(random(9).sub(0.5).mul(0.02)).add(random(10).sub(0.5).mul(0.0015))
    let height: Float = mix(float(-0.005).add(mortarSand.mul(0.0008)), shoulder.mul(0.0018).add(lean).add(sand.mul(0.0003)).sub(pits.mul(0.001)), face)
    if (dado) {
      // Glazed bricks: thin white joints, a glassy face, the glaze pooling darker toward the arrises and crazed in fine lines.
      const dadoCourse = course.lessThan(dado.courses).and(p.y.greaterThan(0)).and(n.y.abs().lessThan(0.5))
      const isCap = course.equal(dado.courses - 1)
      const glazeTone = mix(color(dado.glaze), color(dado.cap), select(isCap, float(1), float(0))).mul(random(6).sub(0.5).mul(0.1).add(1))
      const pooled = edge.div(0.012).clamp(0, 1).smoothstep(0, 1)
      const crazing = mix(float(0), unit(mx_noise_float(p.mul(45).add(seed.add(11)))).sub(0.5).abs().smoothstep(0, 0.02).oneMinus().mul(0.06), fine)
      const glazed = glazeTone.mul(pooled.mul(0.22).add(0.78)).mul(crazing.oneMinus())
      const glazedFace = mix(float(1 - mortarShare / 2), insideBy(float(0.0025).sub(edge), footprint), detail)
      const glazedSurface = mix(color('#d8d2c4'), glazed, glazedFace)
      surface = select(dadoCourse, glazedSurface, surface)
      roughness = select(dadoCourse, mix(float(0.7), float(0.12).add(random(7).mul(0.06)), glazedFace), roughness)
      height = select(dadoCourse, mix(float(-0.002), shoulder.mul(0.0015), glazedFace), height)
    }
    if (soot) {
      const smoke = p.y.smoothstep(...soot).mul(unit(mx_noise_float(p.mul(0.7))).mul(0.5).add(0.5)).mul(0.22)
      surface = surface.mul(smoke.oneMinus())
    }
    // Far off, the joints blend into the wall’s tone.
    this.colorNode = surface
    this.roughnessNode = roughness
    this.normalNode = heightNormal(height.mul(visibleDetail(footprint, brick.joint * 4)))
  }
}
