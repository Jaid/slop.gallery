import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, hash, max, min, mix, mx_noise_float, mx_worley_noise_vec2, normalWorldGeometry, positionWorld, select, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, line, visibleDetail} from './filters.ts'

type Float = Node<'float'>

/** height of a form board, in meters */
const board = 0.15
/** form boards per lift, the height concrete was poured in one go */
const boardsPerLift = 8
/** spacing of the form ties along and up the walls, in meters */
const ties = [0.6, 0.6] as const
/** spacing of the saw-cut joints in the floors, in meters */
const sawCut = 3
/** the plywood sheets that formed the ceilings, in meters */
const sheet = [2.44, 1.22] as const
const unit = (node: Float) => node.mul(0.5).add(0.5)

/**
 * Dark cast-in-place concrete for the Oculus and the Exhibition: walls, tower, ramps, balcony, displays, floors and ceilings.
 *
 * The walls were cast against rough-sawn boards: every 15 cm course carries the grain of its board, a tone of its own and a hairline fin where two boards met, the boards butt end to end along the course, and every eight courses a lift line marks where one pour ended and the next began, each lift a shade apart. Form-tie holes sit in a 60 cm grid, recessed cones in the face, and bug holes – small air voids – pock the surface, crowding toward the bottom of each lift. Broad hydration clouds and the odd water stain mottle it all.
 * The floors are power-troweled: dense, smooth and faintly burnished in overlapping arcs where the trowel blades swept, cut into 3 m fields by saw joints. The ceilings show the plywood sheets they were cast on, a seam at every sheet’s edge.
 *
 * Mapped by world position and the face’s direction, so one material covers every surface of both rooms. Fine detail fades to its average before it could shimmer.
 */
export default class ArchitecturalConcreteMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.85,
      envMapIntensity: 0,
    })
    const n = normalWorldGeometry
    const floor = n.y.greaterThan(0.6).toVar('concreteFloor')
    const ceiling = n.y.lessThan(-0.6).toVar('concreteCeiling')
    const wall = floor.or(ceiling).not()
    const flat = floor.or(ceiling)
    const u = select(flat, positionWorld.x, positionWorld.x.add(positionWorld.z)).toVar('concreteU')
    const v = select(flat, positionWorld.z, positionWorld.y).toVar('concreteV')
    const footprint = max(u.fwidth(), v.fwidth()).toVar('concreteFootprint')
    const detail = visibleDetail(footprint, 0.03)
    const fine = visibleDetail(footprint, 0.01)
    // Broad hydration clouds and stains, shared by every face.
    const clouds = unit(mx_noise_float(positionWorld.mul(0.35))).mul(0.6).add(unit(mx_noise_float(positionWorld.mul(1.3).add(7))).mul(0.4))
    const grain = mix(float(0.5), unit(mx_noise_float(positionWorld.mul(90))), fine)
    // Walls: board courses, lifts, ties and bug holes.
    const courseCoordinate = v.div(board)
    const course = courseCoordinate.floor().toVar('concreteCourse')
    const courseKey = course.add(2000).mul(7919)
    const boardLength = mix(float(1.8), float(3.6), hash(courseKey))
    const along = u.add(hash(courseKey.add(1_048_573)).mul(boardLength))
    const boardIndex = along.div(boardLength).floor()
    const boardKey = courseKey.add(boardIndex.add(500)).toVar('concreteBoard')
    const boardTone = hash(boardKey.add(2_097_143)).sub(0.5).mul(0.1)
    const lift = course.div(boardsPerLift).floor()
    const liftTone = hash(lift.add(300).mul(104_729)).sub(0.5).mul(0.08)
    const withinCourse = courseCoordinate.fract().sub(0.5).mul(board)
    const fin = line(float(board / 2).sub(withinCourse.abs()), 0.0012).mul(detail)
    const butt = line(along.div(boardLength).fract().sub(0.5).abs().sub(0.5).mul(boardLength), 0.001).mul(detail)
    // The board’s sawn grain, printed into the face: long streaks along the course that wander a little.
    const boardSeed = hash(boardKey.add(3_145_739)).mul(60)
    const imprint = mix(float(0.5), unit(mx_noise_float(vec3(u.mul(2.5), withinCourse.mul(55).add(mx_noise_float(vec2(u.mul(0.8), boardSeed)).mul(1.5)), boardSeed))), fine)
    const liftLine = line(courseCoordinate.div(boardsPerLift).fract().sub(0.5).abs().sub(0.5).mul(board * boardsPerLift), 0.004).mul(detail)
    const tieCell = vec2(u.div(ties[0]).add(0.5), v.div(ties[1]).add(0.25))
    const tieOffset = tieCell.fract().sub(0.5).mul(vec2(...ties)).length()
    const tieHole = inside(tieOffset.sub(0.013)).mul(detail).mul(select(wall, float(1), float(0)))
    const tieCone = tieOffset.div(0.013).clamp(0, 1)
    const liftDepth = courseCoordinate.div(boardsPerLift).fract()
    const voidCells = mx_worley_noise_vec2(vec2(u, v).mul(38))
    // Most cells hold no void; they crowd toward the bottom of each lift, where air rose against the form.
    const voidPresence = unit(mx_noise_float(vec2(u, v).mul(4).add(13))).add(liftDepth.oneMinus().mul(0.35)).smoothstep(0.7, 1.05)
    const voidSize = unit(mx_noise_float(vec2(u, v).mul(31).add(5))).mul(0.06).add(0.03).mul(voidPresence)
    const bugHoles = inside(voidCells.x.sub(voidSize).div(38)).mul(fine).mul(select(wall, float(1), float(0.2)))
    const wallTone = boardTone.add(liftTone).add(imprint.sub(0.5).mul(0.26)).add(fin.mul(0.25)).sub(butt.mul(0.3)).sub(liftLine.mul(0.25))
    // Floors: troweled smooth, burnished in overlapping arcs, cut into fields.
    const swirlCells = mx_worley_noise_vec2(vec2(u, v).mul(0.9))
    const swirl = unit(swirlCells.x.mul(26).add(mx_noise_float(vec2(u, v).mul(2)).mul(2)).sin()).mul(unit(mx_noise_float(vec2(u, v).mul(0.6).add(4))))
    const burnish = mix(float(0.5), swirl, detail)
    const cutDistance = min(float(0.5).sub(u.div(sawCut).fract().sub(0.5).abs()), float(0.5).sub(v.div(sawCut).fract().sub(0.5).abs())).mul(sawCut)
    const cut = line(cutDistance, 0.0016).mul(detail)
    const floorTone = burnish.sub(0.5).mul(0.06).sub(cut.mul(0.6))
    // Ceilings: the plywood sheets, with a seam at each edge and the faint print of their veneer.
    const sheetCoordinate = vec2(u.div(sheet[0]), v.div(sheet[1]))
    const sheetEdge = min(sheetCoordinate.x.fract().sub(0.5).abs().sub(0.5).mul(sheet[0]).abs(), sheetCoordinate.y.fract().sub(0.5).abs().sub(0.5).mul(sheet[1]).abs())
    const sheetSeam = line(sheetEdge, 0.0012).mul(detail)
    const sheetKey = sheetCoordinate.floor().add(500)
    const sheetTone = hash(sheetKey.x.mul(1009).add(sheetKey.y)).sub(0.5).mul(0.05)
    const veneer = mix(float(0.5), unit(mx_noise_float(vec3(u.mul(1.5), v.mul(25), 3.1))), fine)
    const ceilingTone = sheetTone.add(veneer.sub(0.5).mul(0.06)).sub(sheetSeam.mul(0.2))
    const tone = select(floor, floorTone, select(ceiling, ceilingTone, wallTone))
    const base = select(floor, color(hsl.integer(197, 3, 33)), color(hsl.integer(180, 3, 40)))
    let surface: Node<'vec3'> = base.mul(clouds.sub(0.5).mul(0.22).add(grain.sub(0.5).mul(0.1)).add(tone).add(1))
    // Holes fall into shadow toward their back.
    surface = surface.mul(tieHole.mul(tieCone.oneMinus().mul(0.55).add(0.25)).oneMinus())
    surface = surface.mul(bugHoles.mul(-0.6).add(1))
    this.colorNode = surface
    const floorRoughness = float(0.62).sub(burnish.sub(0.5).mul(0.2)).add(cut.mul(0.3))
    this.roughnessNode = select(floor, floorRoughness, float(0.86).add(grain.sub(0.5).mul(0.06))).add(bugHoles.mul(0.1)).min(1)
    const wallHeight = imprint.mul(0.0006).add(fin.mul(0.0008)).sub(liftLine.mul(0.0015)).add(withinCourse.div(board).mul(hash(boardKey.add(4_194_301)).sub(0.5)).mul(0.0012))
    const floorHeight = burnish.mul(0.00015).sub(cut.mul(0.003))
    const ceilingHeight = veneer.mul(0.0002).sub(sheetSeam.mul(0.0006))
    const height = select(floor, floorHeight, select(ceiling, ceilingHeight, wallHeight)).sub(tieHole.mul(tieCone.oneMinus().mul(0.012))).sub(bugHoles.mul(0.002))
    this.normalNode = heightNormal(height.mul(detail))
  }
}
