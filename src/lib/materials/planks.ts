import type {Node} from 'three/webgpu'

import {color, exp, float, hash, max, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, vec2, vec3} from 'three/tsl'

import {line, visibleDetail} from './filters.ts'

/** How boards are cut and laid, independent of the finish on top of them. */
export type PlankLayout = {
  /** world axis the boards run along */
  axis: 'x' | 'z'
  /** eased edge of every board, in meters */
  bevel: number
  colors: {
    dark: string
    light: string
    ring: string
    seam: string
  }
  /** how the growth rings run: `meander` is how far they wander across a board, `rings` how many cross a meter; flat-sawn boards wander more than quarter-sawn ones. Defaults to rustic flat-sawn boards. */
  figure?: {
    meander: number
    rings: number
  }
  /** share of boards with a knot */
  knots: number
  /** shortest and longest board in a course, in meters */
  length: readonly [number, number]
  /** half-width of the dark joint between boards, in meters */
  seam: number
  /** decorrelates two surfaces that share a layout */
  seed: number
  /** board width, in meters */
  width: number
}

/** Flat-sawn boards from knotty timber, whose rings wander widely. */
const rusticFigure = {
  meander: 9,
  rings: 80,
}

/**
 * Boards laid in staggered courses, mapped by world position so separate meshes continue each other’s joints and grain.
 *
 * Every course has its own board length and offset, every board its own tone, figure and occasional knot. Joints are filtered against the pixel footprint and the eased edges flatten in the distance, so long floors stay calm at grazing angles.
 *
 * Returns the albedo, a roughness around `roughness`, the world-space shading normal (faces pointing up and down both read correctly), the joint coverage and a per-board random stream for finishes that vary by board.
 */
export function plankBoards(layout: PlankLayout, roughness: number) {
  const {axis, bevel, colors, figure: grainFigure = rusticFigure, knots, length: [shortest, longest], seam, seed, width} = layout
  const {meander: wander, rings: ringDensity} = grainFigure
  const alongAxis = axis === 'x' ? vec3(1, 0, 0) : vec3(0, 0, 1)
  const acrossAxis = axis === 'x' ? vec3(0, 0, 1) : vec3(1, 0, 0)
  const a = (axis === 'x' ? positionWorld.x : positionWorld.z).toVar('plankAlong')
  const b = (axis === 'x' ? positionWorld.z : positionWorld.x).toVar('plankAcross')
  // Hashes need non-negative seeds; the offset keeps every course index positive for ±10 km.
  const offset = 1_000_003 + seed * 7919
  const courseCoordinate = b.div(width)
  const course = courseCoordinate.floor().toVar('plankCourse')
  const v = courseCoordinate.fract().sub(0.5).mul(width).toVar('plankV')
  const courseLength = mix(float(shortest), float(longest), hash(course.add(offset)))
  const shifted = a.add(hash(course.add(offset + 104_729)).mul(longest))
  const boardCoordinate = shifted.div(courseLength)
  const board = boardCoordinate.floor()
  const u = boardCoordinate.fract().sub(0.5).mul(courseLength).toVar('plankU')
  const boardId = course.mul(4099).add(board).add(offset * 3)
  // Streams stay below 2²⁴, where floats still hold every integer.
  const random = (stream: number) => hash(boardId.add(stream * 1_048_573))
  const footprint = max(a.fwidth(), b.fwidth()).toVar('plankFootprint')
  // Distance to the nearest joint: long edges between courses, butt joints between boards.
  const edgeV = float(width / 2).sub(v.abs())
  const edgeU = courseLength.mul(0.5).sub(u.abs())
  // Butt joints are tighter than the long joints between courses.
  const joint = max(line(edgeV, seam), line(edgeU, seam).mul(0.85))
  // An occasional knot, with the growth rings swirling around it.
  const knotted = random(1).lessThan(knots)
  const knotCenter = vec2(random(2).sub(0.5).mul(courseLength.mul(0.7)), random(3).sub(0.5).mul(width * 0.55))
  const knotRadius = random(4).mul(0.012).add(0.009)
  const knotDistance = vec2(u, v).sub(knotCenter).mul(vec2(0.55, 1)).length()
  const knotField = select(knotted, exp(knotDistance.div(knotRadius.mul(3.2)).pow(2).negate()), float(0))
  const knot = select(knotted, float(1).sub(knotDistance.div(knotRadius)).smoothstep(0, 0.35), float(0))
  // Flat-sawn figure: the rings wander along the board and bunch into cathedrals.
  const boardSeed = random(5).mul(97)
  const meander = mx_noise_float(vec3(u.mul(0.7), v.mul(5), boardSeed)).mul(wander).add(mx_noise_float(vec3(u.mul(4), v.mul(16), boardSeed.add(3))).mul(wander * 1.6 / 9))
  const ringPhase = v.mul(ringDensity).add(meander).add(knotField.mul(7)).toVar('plankRings')
  const rings = mix(ringPhase.sin().mul(0.5).add(0.5).pow(5), float(0.15), ringPhase.fwidth().smoothstep(0.8, 2.4))
  const figure = mx_noise_float(vec3(u.mul(0.9), v.mul(10), boardSeed.add(5))).mul(0.5).add(0.5)
  const porePhase = v.mul(380)
  const pores = mix(mx_noise_float(vec3(u.mul(6), porePhase, boardSeed.add(11))).mul(0.5).add(0.5), float(0.5), porePhase.fwidth().smoothstep(0.6, 2))
  const tone = random(6).mul(0.32).add(0.82)
  const hue = random(7)
  // Large, soft patches of sun and wear across the whole surface.
  const patina = mx_noise_float(vec3(positionWorld.x.mul(0.35), positionWorld.z.mul(0.35), seed)).mul(0.07).add(1)
  const timber = mix(color(colors.dark), color(colors.light), figure.mul(0.6).add(hue.mul(0.4)))
  const grained = mix(timber, color(colors.ring), rings.mul(0.45)).mul(pores.mul(0.16).add(0.92)).mul(tone).mul(patina)
  const withKnot = mix(grained, color(colors.ring).mul(0.55), knot.mul(0.9))
  // Eased edges tilt the normal toward each joint; they flatten before they shrink below a few pixels.
  const relief = visibleDetail(footprint, bevel * 2)
  const tiltV = v.sign().mul(v.abs().smoothstep(width / 2 - bevel, width / 2)).mul(0.45)
  const tiltU = u.sign().mul(u.abs().smoothstep(courseLength.mul(0.5).sub(bevel), courseLength.mul(0.5))).mul(0.45)
  const normal: Node<'vec3'> = normalWorldGeometry.add(acrossAxis.mul(tiltV.mul(relief))).add(alongAxis.mul(tiltU.mul(relief))).normalize()
  return {
    color: mix(withKnot, color(colors.seam), joint),
    roughness: float(roughness).add(pores.mul(0.08)).sub(rings.mul(0.06)).add(joint.mul(0.1)).add(random(8).sub(0.5).mul(0.08)),
    normal,
    joint,
    random,
  }
}
