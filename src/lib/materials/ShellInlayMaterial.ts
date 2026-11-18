import type {Node} from 'three/webgpu'

import {atan, attribute, color, cos, float, floor, fract, hash, max, mix, normalView, positionViewDirection, select, sqrt, uv, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, insideBy, visibleDetail} from './filters.ts'
import {goldReflectance} from './GoldMaterial.ts'

type Float = Node<'float'>
type Vector = Node<'vec2'>

/** the names of the attributes that lay the shells out, see `SalonLanternGeometry` */
export const shellAttributes = {
  /** the course’s start up the sail and its height, the width of its shells and how many there are, none outside the courses */
  course: 'shellCourse',
  /** whether the course is staggered by half a shell, a number of its own for the course on its sail, and the sail’s half width there, from its middle to the crease */
  sail: 'shellSail',
} as const

/** the deep crimson lacquer the shells are set in, a little bluer and darker than the cinnabar walls below */
const lacquerColor = '#7a101a'
/** the nacre’s ground, a warm cream */
const pearlColor = '#f1e8db'
/** half the angle of a shell’s fan, from straight down to its outermost ribs */
const fanAngle = 1.2
/** how many ribs fan out across a shell */
const ribs = 17
/** how far below the course’s top a shell’s hinge lies, and how far its rim reaches from it, per meter of the course’s height */
const hinge = 0.06
const reach = 0.9
/** the half size of the ears beside the hinge, per meter of the rim’s reach, and how far below the hinge they lie */
const ear = [0.34, 0.1, 0.1] as const
/** the half width of the gilt fillets */
const filletHalfWidth = 0.007
/** The signed distance from the point to a box of the half size around the origin. */
function boxDistance(point: Vector, half: Vector) {
  const outside = point.abs().sub(half)
  return outside.max(0).length().add(outside.x.max(outside.y).min(0))
}

/**
 * Mother-of-pearl shells inlaid in red lacquer, after the shell-encrusted dome of the Tribuna of the Uffizi: courses of scallop shells, each a fan of ribs with a scalloped rim and ears at its hinge, staggered course by course, framed by gilt fillets along the creases and above and below the courses.
 * The nacre is a creamy dielectric whose tint shifts a little with the view, every shell tinted, tilted and filmed a little differently, under a thin coat; the lacquer is glossier, under a full clear coat.
 * Laid out by the attributes of {@link shellAttributes} and `uv`, in meters across and up the sail. The shells’ relief fades to flat before it gets small enough to shimmer.
 */
export default class ShellInlayMaterial extends MeshPhysicalNodeMaterial {
  constructor({bounce, crease, heavy = true, lines = []}: {
    /** light the inlay gets from its surroundings beyond the scene’s lights, which the nacre and the lacquer scatter back in their own colors */
    bounce?: Node<'vec3'>
    /** how far from the crease the fillets along it run */
    crease: number
    /** whether the shells have relief and the nacre its film */
    heavy?: boolean
    /** distances up the sail where gilt fillets run across it */
    lines?: ReadonlyArray<number>
  }) {
    super({
      metalness: 0,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      ior: 1.6,
      envMapIntensity: 1.3,
    })
    this.name = 'Shell inlay'
    const course = attribute<'vec4'>(shellAttributes.course, 'vec4')
    const sail = attribute<'vec3'>(shellAttributes.sail, 'vec3')
    const metric = uv()
    const along = metric.x
    const distance = metric.y
    const start = course.x
    const height = course.y
    const width = course.z
    const count = course.w
    const stagger = sail.x
    const footprint = max(along.fwidth(), distance.fwidth()).max(1e-5).toVar('shellFootprint')
    const filter = footprint.mul(1.5)
    // The cells of the course: whole shells between the margins along the creases, offset by half a shell in staggered courses, which hold one fewer.
    const cellX = along.div(width).add(count.mul(0.5)).sub(stagger.mul(0.5)).toVar('shellCellX')
    const cell = floor(cellX)
    const inCourse = count.greaterThan(0.5).and(cell.greaterThanEqual(0)).and(cell.lessThanEqual(count.sub(1).sub(stagger)))
    // From the hinge, near the cell’s top, down toward the rim.
    const q = vec2(fract(cellX).sub(0.5).mul(width), distance.sub(start).sub(height.mul(1 - hinge))).toVar('shellPoint')
    const radius = q.length()
    const rim = height.mul(reach)
    const phase = atan(q.x, q.y.negate()).div(fanAngle * 2).add(0.5).mul(ribs * Math.PI * 2).toVar('shellPhase')
    const ribCrest = cos(phase).mul(0.5).add(0.5)
    // The rim dips between the ribs, and the fan’s outermost ribs close it toward the hinge.
    const fan = radius.sub(rim.mul(ribCrest.oneMinus().mul(-0.03).add(1))).max(q.x.abs().mul(Math.cos(fanAngle)).add(q.y.mul(Math.sin(fanAngle))))
    const ears = boxDistance(q.add(vec2(0, rim.mul(ear[2]))), vec2(rim.mul(ear[0]), rim.mul(ear[1])))
    const shell = select(inCourse, insideBy(fan.min(ears), filter), float(0)).toVar('shellCover')
    const seed = hash(cell.add(sail.y.mul(131)).add(17)).toVar('shellSeed')
    // Gilt fillets along the creases and across the sail.
    let fillets: Float = sail.z.sub(along.abs()).sub(crease).abs()
    for (const line of lines) {
      fillets = fillets.min(distance.sub(line).abs())
    }
    const gilt = insideBy(fillets.sub(filletHalfWidth), filter).mul(visibleDetail(footprint, filletHalfWidth * 6)).mul(shell.oneMinus()).toVar('shellGilt')
    // The nacre’s colors shift with the view and from shell to shell, but stay pale, and it darkens a little toward its rim.
    const facing = normalView.dot(positionViewDirection).abs()
    const tone = seed.add(facing.mul(0.7)).mul(Math.PI * 2)
    const iridescent = vec3(cos(tone), cos(tone.sub(2.1)), cos(tone.sub(4.2))).mul(0.5).add(0.5)
    const pearl = mix(color(pearlColor), iridescent, 0.2).mul(seed.mul(0.1).add(0.92)).mul(radius.div(rim).min(1).mul(-0.14).add(1)).mul(ribCrest.mul(0.06).add(0.94))
    const albedo = mix(mix(color(lacquerColor), vec3(...goldReflectance), gilt), pearl, shell)
    this.colorNode = albedo
    if (bounce) {
      // The gilt is a metal, which scatters nothing; the nacre sends back a pale sheen of its own colors toward grazing views.
      const sheen = iridescent.mul(facing.oneMinus().mul(0.6).add(0.4)).mul(shell).mul(0.5)
      this.emissiveNode = albedo.add(sheen).mul(bounce).mul(gilt.oneMinus())
    }
    this.metalnessNode = gilt
    this.roughnessNode = mix(mix(float(0.22), float(0.2), gilt), seed.mul(0.1).add(0.24), shell)
    this.clearcoatNode = mix(float(1), float(0.3), shell.max(gilt))
    if (!heavy) {
      return
    }
    // Every shell domes up from its rim, its ribs standing out of it, each set at a slight tilt of its own; the ribs fade with distance before the shells do.
    const ribFade = visibleDetail(footprint.div(rim.mul(fanAngle * 2 / ribs)), 1)
    const shellFade = visibleDetail(footprint.div(rim), 0.4)
    const dome = sqrt(float(1).sub(radius.div(rim).min(1).pow(2))).mul(rim).mul(0.08)
    const ribbing = ribCrest.pow(2).mul(radius.div(rim).smoothstep(0.12, 0.45)).mul(rim).mul(0.022).mul(ribFade)
    const tilt = vec2(hash(seed.mul(7.1)).sub(0.5), hash(seed.mul(3.7)).sub(0.5)).mul(0.1).dot(q)
    this.normalNode = heightNormal(dome.add(ribbing).add(tilt).mul(shell).mul(shellFade))
    // A thin film over the nacre, thicker or thinner from shell to shell.
    this.iridescenceNode = shell.mul(0.8)
    this.iridescenceIORNode = float(1.38)
    this.iridescenceThicknessNode = seed.mul(320).add(260)
  }
}
