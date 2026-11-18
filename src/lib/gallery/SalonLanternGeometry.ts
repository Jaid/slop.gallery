import type {LanternSection} from './salonLantern.ts'
import type {BufferGeometry} from 'three/webgpu'

import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js'
import {BoxGeometry, ExtrudeGeometry, Matrix4, Path, Shape, ShapeGeometry, SphereGeometry, Vector2, Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {shellAttributes} from '../materials/ShellInlayMaterial.ts'
import {colliderGeometry, wallFace} from './architecture.ts'
import {salonCeiling} from './salon.ts'
import salonLantern, {domeSection, halfSide, octagon, octagonSide, salonDomeEyeY, salonDomeSpringY, salonDomeTopY, salonDrumOuterApothem, salonLanternApexY, salonLanternBase, salonLanternGlassY, salonWindowSpringY} from './salonLantern.ts'
import TriangleSoup from './TriangleSoup.ts'

/** a course of shells across a sail: where it starts up the sail, how high it is, how wide each of its shells is and how many there are, and whether it is staggered by half a shell */
export type ShellCourse = {
  count: number
  height: number
  stagger: boolean
  start: number
  width: number
}
type Plan = readonly [x: number, z: number]
type Size = readonly [width: number, depth: number]
/** a band of the sail between two distances up from its springing, with the course of shells it holds, if any */
type SailBand = {
  course?: ShellCourse
  from: number
  to: number
}

const {apothem, drum} = salonLantern
const up = new Vector3(0, 1, 0)
const down = new Vector3(0, -1, 0)
/** segments of the windows’ arches */
const archSegments = 24
/** samples of the dome’s profile for measuring along it */
const profileSamples = 4096
/** the foot of the drum’s inner cornice */
const corniceBottom = drum.top - salonLantern.cornice[0][0] - salonLantern.cornice[1][0]
/** where a point of a side’s own frame lies in the room: `s` along the side from its middle, `y` up and `d` out from the drum’s inner face; s spreads with d, so the sides meet in their corners however far out */
function sideFrame(index: number) {
  const [nx, nz] = octagonSide(index)
  // along the side, from its corner `index` to the next
  const [ex, ez] = [nz, -nx]
  return (s: number, y: number, d: number) => {
    const scale = (apothem + d) / apothem
    return new Vector3(nx * (apothem + d) + ex * s * scale, y, nz * (apothem + d) + ez * s * scale)
  }
}
/** the largest angle between faces that still shade smoothly into each other, like the facets of an arch */
const creaseAngle = Math.PI / 6
/** Moves every vertex of the geometry, made in a side’s own frame (x along the side, y up, z out), into the room, and shades it smoothly across the facets of its curves, hard across its edges. */
function placeOnSide(geometry: BufferGeometry, index: number) {
  const frame = sideFrame(index)
  const position = geometry.getAttribute('position')
  for (let vertex = 0; vertex < position.count; vertex++) {
    const point = frame(position.getX(vertex), position.getY(vertex), position.getZ(vertex))
    position.setXYZ(vertex, point.x, point.y, point.z)
  }
  const shaded = toCreasedNormals(geometry, creaseAngle)
  if (shaded !== geometry) {
    geometry.dispose()
  }
  return shaded
}
/** A solid standing upright over the plan polygon from `bottom` to `top`, with holes through it. */
function prism(outline: ReadonlyArray<Plan>, bottom: number, top: number, holes: ReadonlyArray<ReadonlyArray<Plan>> = []) {
  const toShape = (points: ReadonlyArray<Plan>) => points.map(([x, z]) => new Vector2(x, -z))
  const shape = new Shape(toShape(outline))
  for (const hole of holes) {
    shape.holes.push(new Path(toShape(hole)))
  }
  const geometry = new ExtrudeGeometry(shape, {
    depth: top - bottom,
    bevelEnabled: false,
    curveSegments: 1,
  })
  return geometry.rotateX(-Math.PI / 2).translate(0, bottom, 0)
}
/** An octagonal ring between two apothems, from `bottom` to `top`. */
function octagonRing(inner: number, outer: number, bottom: number, top: number) {
  return prism(octagon(outer), bottom, top, [octagon(inner)])
}
/** A rectangle round the middle, as a plan polygon. */
function rectangle([halfX, halfZ]: Size): Array<Plan> {
  return [[-halfX, -halfZ], [halfX, -halfZ], [halfX, halfZ], [-halfX, halfZ]]
}
const box = ([x, y, z]: readonly [number, number, number], [width, height, depth]: readonly [number, number, number]) => {
  const geometry = new BoxGeometry(width, height, depth)
  return geometry.translate(x, y, z)
}
/** The outline of a window in its side’s frame, counterclockwise: upright jambs from the sill to the springing and a round head. */
function windowOutline<T extends Path>(path: T): T {
  const {sill, width} = salonLantern.window
  const half = width / 2
  path.moveTo(half, sill)
  path.lineTo(half, salonWindowSpringY)
  path.absarc(0, salonWindowSpringY, half, 0, Math.PI, false)
  path.lineTo(-half, sill)
  path.closePath()
  return path
}
/** One side of the drum: a panel between its corners, pierced by its window, mitered into its neighbors. */
function drumSide(index: number) {
  const length = apothem * halfSide * 2
  const shape = new Shape([new Vector2(-length / 2, salonLanternBase), new Vector2(length / 2, salonLanternBase), new Vector2(length / 2, drum.top), new Vector2(-length / 2, drum.top)])
  shape.holes.push(windowOutline(new Path))
  const panel = new ExtrudeGeometry(shape, {
    depth: drum.thickness,
    bevelEnabled: false,
    curveSegments: archSegments,
  })
  return placeOnSide(panel, index)
}
/** The architrave round a window on the drum’s inner face, from the sill band up round its head. */
function architrave(index: number) {
  const [width, projection] = salonLantern.architrave
  const {sill} = salonLantern.window
  const half = salonLantern.window.width / 2
  const shape = new Shape
  shape.moveTo(half + width, sill)
  shape.lineTo(half + width, salonWindowSpringY)
  shape.absarc(0, salonWindowSpringY, half + width, 0, Math.PI, false)
  shape.lineTo(-half - width, sill)
  shape.lineTo(-half, sill)
  shape.lineTo(-half, salonWindowSpringY)
  shape.absarc(0, salonWindowSpringY, half, Math.PI, 0, true)
  shape.lineTo(half, sill)
  shape.closePath()
  const molding = new ExtrudeGeometry(shape, {
    depth: projection,
    bevelEnabled: false,
    curveSegments: archSegments,
  })
  return placeOnSide(molding.translate(0, 0, -projection), index)
}
/** A glazing bar in a side’s frame: centered on `from` to `to` in the plane of the window, behind the glass. */
function glazingBar(from: Vector2, to: Vector2, index: number) {
  const {bar: [width, depth], glassInset} = salonLantern.window
  const glass = drum.thickness - glassInset
  const along = to.clone().sub(from)
  const length = along.length()
  const bar = new BoxGeometry(length, width, depth)
  const turn = new Matrix4
  bar.applyMatrix4(turn.makeRotationZ(Math.atan2(along.y, along.x)))
  bar.translate((from.x + to.x) / 2, (from.y + to.y) / 2, glass - 0.004 - depth / 2)
  return placeOnSide(bar, index)
}
/** Every window’s bars: a mullion from the sill to the crown, a transom at the springing and two radial bars in the fanlight, each reaching into the reveal. */
function windowBars(index: number) {
  const {crown, sill, width} = salonLantern.window
  const half = width / 2
  const reach = 0.012
  const spring = new Vector2(0, salonWindowSpringY)
  const radial = (angle: number) => spring.clone().add(new Vector2(Math.cos(angle) * (half + reach), Math.sin(angle) * (half + reach)))
  return [
    glazingBar(new Vector2(0, sill - reach), new Vector2(0, crown + reach), index),
    glazingBar(new Vector2(-half - reach, salonWindowSpringY), new Vector2(half + reach, salonWindowSpringY), index),
    glazingBar(spring, radial(Math.PI / 4), index),
    glazingBar(spring, radial(Math.PI * 3 / 4), index),
  ]
}
/** Every window’s glass near the drum’s outer face, facing into the drum, with UVs across the rectangle round it, from its sill’s left end to the right end of its crown. */
function windowGlass(index: number) {
  const {crown, glassInset, sill, width} = salonLantern.window
  const glass = new ShapeGeometry(windowOutline(new Shape), archSegments)
  glass.translate(0, 0, drum.thickness - glassInset)
  const uv = glass.getAttribute('uv')
  const position = glass.getAttribute('position')
  for (let vertex = 0; vertex < uv.count; vertex++) {
    uv.setXY(vertex, position.getX(vertex) / width + 0.5, (position.getY(vertex) - sill) / (crown - sill))
  }
  // ShapeGeometry faces out of the drum; the glass faces in.
  const triangles = glass.index!
  for (let i = 0; i < triangles.count; i += 3) {
    const b = triangles.getX(i + 1)
    triangles.setX(i + 1, triangles.getX(i + 2))
    triangles.setX(i + 2, b)
  }
  return placeOnSide(glass, index)
}
/** The folded strip in the drum’s corner `index`, between the side before it and its own, from the opening up to the cornice. */
function cornerStrip(index: number) {
  const [width, projection] = salonLantern.strip
  const corner = new Vector2(...octagon(apothem)[index])
  const side = (offset: number) => {
    const [nx, nz] = octagonSide((index + offset + 8) % 8)
    return {
      along: new Vector2(nz, -nx),
      normal: new Vector2(nx, nz),
    }
  }
  const before = side(-1)
  const after = side(0)
  const outward = before.normal.clone().add(after.normal).normalize()
  const points = [
    corner.clone().addScaledVector(before.along, -width),
    corner.clone(),
    corner.clone().addScaledVector(after.along, width),
    corner.clone().addScaledVector(after.along, width).addScaledVector(after.normal, -projection),
    corner.clone().addScaledVector(outward, -projection / Math.cos(Math.PI / 8)),
    corner.clone().addScaledVector(before.along, -width).addScaledVector(before.normal, -projection),
  ]
  return prism(points.map(({x, y}) => [x, y] as const), salonLanternBase, corniceBottom)
}
/** the dome’s profile measured along a sail’s middle: angles and the distance up from the springing at each */
const profile = (() => {
  const angles = Array.from({length: profileSamples + 1}, (_, index) => index / profileSamples * Math.PI / 2)
  const distances = [0]
  for (let index = 1; index < angles.length; index++) {
    const [out0, y0] = domeSection(angles[index - 1])
    const [out1, y1] = domeSection(angles[index])
    distances.push(distances[index - 1] + Math.hypot(out1 - out0, y1 - y0))
  }
  return {
    angles,
    distances,
    length: distances.at(-1)!,
  }
})()
/** The angle of the dome’s profile `distance` up a sail’s middle from its springing. */
function angleAt(distance: number) {
  const {angles, distances} = profile
  let low = 0
  let high = distances.length - 1
  while (high - low > 1) {
    const middle = low + high >> 1
    if (distances[middle] <= distance) {
      low = middle
    } else {
      high = middle
    }
  }
  const share = (distance - distances[low]) / Math.max(1e-12, distances[high] - distances[low])
  return angles[low] + (angles[high] - angles[low]) * Math.min(1, Math.max(0, share))
}
/** Half the width of a sail `distance` up from its springing, from its middle to the crease on either side. */
function sailHalfWidth(distance: number) {
  return domeSection(angleAt(distance))[0] * halfSide
}
/** the length of a sail’s middle from the springing to the eye */
export const salonSailLength = profile.length

/**
 * The courses of shells up every sail, between the plain lacquer at its foot and round the eye: each fits a whole number of shells of about the target width between the margins along the ribs, measured across the middle of the course, and is half as high as they are wide, so the shells keep their shape as the sail narrows. Courses alternate between staggered and not.
 */
export function shellCourses(): Array<ShellCourse> {
  const {course, margins, width: target} = salonLantern.shells
  const end = profile.length - margins.eye
  const courses: Array<ShellCourse> = []
  let start = margins.foot
  for (;;) {
    let height = target * course
    let count = 1
    let width = target
    // The width depends on where the course’s middle lies, which depends on its height.
    for (let pass = 0; pass < 3; pass++) {
      const span = 2 * (sailHalfWidth(start + height / 2) - margins.ribs)
      count = Math.round(span / target)
      width = span / Math.max(1, count)
      height = width * course
    }
    if (count < 1 || start + height > end) {
      break
    }
    courses.push({
      count,
      height,
      stagger: courses.length % 2 === 1,
      start,
      width,
    })
    start += height
  }
  return courses
}
/** where the gilt fillets run across every sail: a little below its first course of shells and above its last */
export function shellFilletLines() {
  const courses = shellCourses()
  const last = courses.at(-1)!
  return [courses[0].start - salonLantern.shells.fillet, last.start + last.height + salonLantern.shells.fillet]
}
/** The bands of every sail from its springing to the eye: the plain foot, every course and the plain band round the eye. */
function sailBands(): Array<SailBand> {
  const courses = shellCourses()
  const bands: Array<SailBand> = [{
    from: 0,
    to: courses[0].start,
  }]
  for (const course of courses) {
    bands.push({
      course,
      from: course.start,
      to: course.start + course.height,
    })
  }
  bands.push({
    from: bands.at(-1)!.to,
    to: profile.length,
  })
  return bands
}
/** The normal of a section through a sail at `angle`, of the inner or the outer face, pointing out of the shell’s solid: into the room for the inner face, to the sky for the outer. */
function sectionNormal(angle: number, outer: boolean): LanternSection {
  const step = 1e-4
  const [out0, y0] = domeSection(Math.max(0, angle - step), outer)
  const [out1, y1] = domeSection(Math.min(Math.PI / 2, angle + step), outer)
  // The tangent up the profile, turned a quarter toward the middle and down for the inner face, away for the outer one.
  const [dOut, dY] = [out1 - out0, y1 - y0]
  const length = Math.hypot(dOut, dY)
  const sign = outer ? 1 : -1
  return [sign * dY / length, -sign * dOut / length]
}
/** A point on a sail of side `index` at the section point, `along` from the sail’s middle toward its corner `index + 1`. */
function sailPoint(index: number, [out, y]: LanternSection, along: number) {
  const [nx, nz] = octagonSide(index)
  return new Vector3(nx * out + nz * along, y, nz * out - nx * along)
}
/** The normal of a sail of side `index` from a section normal. */
function sailNormal(index: number, [out, upward]: LanternSection) {
  const [nx, nz] = octagonSide(index)
  const normal = new Vector3(nx * out, upward, nz * out)
  return normal.normalize()
}
/**
 * The dome’s inner face, the eight sails toward the room, which the shells are laid out on. Every band of every sail has vertices of its own, carrying its course of shells:
 * `uv` is the distance from the sail’s middle toward its next corner and up its middle from the springing in meters, and the attributes of {@link shellAttributes} lay out the course.
 */
function sails(segments: number = salonLantern.dome.segments) {
  const soup = new TriangleSoup({
    [shellAttributes.course]: 4,
    [shellAttributes.sail]: 3,
  })
  const bands = sailBands()
  const step = Math.PI / 2 / segments
  for (let side = 0; side < 8; side++) {
    for (const [bandIndex, {course, from, to}] of bands.entries()) {
      const levels = Math.max(1, Math.ceil((angleAt(to) - angleAt(from)) / step))
      const layout = course ? [course.start, course.height, course.width, course.count] : [0, 1, 1, 0]
      const rows = Array.from({length: levels + 1}, (_, level) => {
        const distance = from + (to - from) * level / levels
        const angle = angleAt(distance)
        const section = domeSection(angle)
        const normal = sailNormal(side, sectionNormal(angle, false))
        const half = section[0] * halfSide
        const extras = {
          [shellAttributes.course]: layout,
          [shellAttributes.sail]: [course?.stagger ? 1 : 0, side * 97 + bandIndex, half],
        }
        return [-half, half].map(along => soup.add(sailPoint(side, section, along), normal, [along, distance], extras))
      })
      for (let level = 1; level < rows.length; level++) {
        const [a, b] = rows[level - 1]
        const [d, c] = rows[level]
        soup.quad(a, b, c, d)
      }
    }
  }
  return soup.toGeometry()
}
/** The rest of the dome’s solid, its back to the sky: the outer face over the sails, the ring it stands on over the drum and the eye’s rim and top. */
function domeBack(segments = 24) {
  const soup = new TriangleSoup
  const {oculus, shell} = salonLantern.dome
  for (let side = 0; side < 8; side++) {
    const rows = Array.from({length: segments + 1}, (_, level) => {
      const angle = level / segments * Math.PI / 2
      const section = domeSection(angle, true)
      const normal = sailNormal(side, sectionNormal(angle, true))
      const half = section[0] * halfSide
      return [-half, half].map(along => soup.add(sailPoint(side, section, along), normal, [along, level / segments]))
    })
    for (let level = 1; level < rows.length; level++) {
      const [a, b] = rows[level - 1]
      const [d, c] = rows[level]
      soup.quad(a, b, c, d)
    }
    /** a flat band across the side between two section points, facing `normal` */
    const band = (from: LanternSection, to: LanternSection, normal: Vector3) => {
      const corners = [[from, -1], [from, 1], [to, 1], [to, -1]] as const
      const ids = corners.map(([section, end]) => soup.add(sailPoint(side, section, end * section[0] * halfSide), normal, [end, section[1]]))
      soup.quad(ids[0], ids[1], ids[2], ids[3])
    }
    const [nx, nz] = octagonSide(side)
    band([apothem, salonDomeSpringY], [salonDrumOuterApothem, salonDomeSpringY], down)
    band([oculus, salonDomeEyeY], [oculus, salonDomeTopY], new Vector3(-nx, 0, -nz))
    band([oculus, salonDomeTopY], [oculus + shell[1], salonDomeTopY], up)
  }
  return soup.toGeometry()
}
/**
 * A rib of rectangular section swept along the points, `width` across and from `back` behind them to `front` in front of them along the normals, which point out of the surface it lies on, with its ends closed.
 */
function sweptRib(points: ReadonlyArray<Vector3>, normals: ReadonlyArray<Vector3>, [width, front]: readonly [number, number], back: number) {
  const soup = new TriangleSoup
  const frames = points.map((point, index) => {
    const tangent = points[Math.min(points.length - 1, index + 1)].clone().sub(points[Math.max(0, index - 1)]).normalize()
    const normal = normals[index].clone().addScaledVector(tangent, -normals[index].dot(tangent)).normalize()
    const across = tangent.clone().cross(normal).normalize()
    return {
      across,
      normal,
      point,
      tangent,
    }
  })
  const corner = ({across, normal, point}: typeof frames[number], side: number, depth: number) => point.clone().addScaledVector(across, side * width / 2).addScaledVector(normal, depth)
  /** the rib’s four faces along it: front, back and both sides, each with the corners it runs between */
  const faces = [
    [[-1, front], [1, front], (frame: typeof frames[number]) => frame.normal],
    [[1, -back], [-1, -back], (frame: typeof frames[number]) => frame.normal.clone().negate()],
    [[1, front], [1, -back], (frame: typeof frames[number]) => frame.across],
    [[-1, -back], [-1, front], (frame: typeof frames[number]) => frame.across.clone().negate()],
  ] as const
  for (const [[sideA, depthA], [sideB, depthB], normalOf] of faces) {
    const rows = frames.map(frame => [soup.add(corner(frame, sideA, depthA), normalOf(frame), [0, 0]), soup.add(corner(frame, sideB, depthB), normalOf(frame), [1, 0])])
    for (let index = 1; index < rows.length; index++) {
      soup.quad(rows[index - 1][0], rows[index - 1][1], rows[index][1], rows[index][0])
    }
  }
  for (const [frame, sign] of [[frames[0], -1], [frames.at(-1)!, 1]] as const) {
    const normal = frame.tangent.clone().multiplyScalar(sign)
    const ids = [[-1, -back], [1, -back], [1, front], [-1, front]].map(([side, depth]) => soup.add(corner(frame, side, depth), normal, [0, 0]))
    soup.quad(ids[0], ids[1], ids[2], ids[3])
  }
  return soup.toGeometry()
}
/** The gilt rib along the dome’s crease in corner `index`, from the cornice to the eye. */
function creaseRib(index: number, segments: number = salonLantern.dome.segments) {
  const [width, proud] = salonLantern.dome.rib
  const points: Array<Vector3> = []
  const normals: Array<Vector3> = []
  for (let level = 0; level <= segments; level++) {
    const angle = level / segments * Math.PI / 2
    const [out, y] = domeSection(angle)
    const [x, z] = octagon(out)[index]
    points.push(new Vector3(x, y, z))
    const section = sectionNormal(angle, false)
    normals.push(sailNormal((index + 7) % 8, section).add(sailNormal(index, section)).normalize())
  }
  return sweptRib(points, normals, [width, proud], proud)
}
/** A gilt rosette under the ceiling at the plan point: a domed boss in a ring of eight veined petals, flush with the ceiling at its rim. */
function rosette([x, z]: Plan, radius: number) {
  const rings = 10
  const spokes = 64
  const bossShare = 0.3
  /** how far below the ceiling its face lies, at a share of its reach toward the angle */
  const depth = (share: number, angle: number) => {
    if (share < bossShare) {
      return 0.024 + 0.05 * Math.sqrt(1 - (share / bossShare) ** 2)
    }
    const petal = (share - bossShare) / (1 - bossShare)
    const vein = 0.5 + 0.5 * Math.cos(angle * 16)
    return (0.026 + 0.006 * vein) * (1 - petal ** 1.6)
  }
  /** how far it reaches toward the angle: farthest at the tips of its petals */
  const reach = (angle: number) => radius * (0.8 + 0.2 * Math.abs(Math.cos(angle * 4)) ** 0.6)
  const soup = new TriangleSoup
  const center = soup.add(new Vector3(x, salonLanternBase - depth(0, 0), z), down, [0, 0])
  const grid = Array.from({length: rings}, (_ring, ring) => Array.from({length: spokes}, (_spoke, spoke) => {
    const angle = spoke / spokes * Math.PI * 2
    const share = (ring + 1) / rings
    const distance = share * reach(angle)
    return soup.add(new Vector3(x + Math.cos(angle) * distance, salonLanternBase - depth(share, angle), z + Math.sin(angle) * distance), down, [share, spoke / spokes])
  }))
  for (let spoke = 0; spoke < spokes; spoke++) {
    const next = (spoke + 1) % spokes
    soup.triangle(center, grid[0][spoke], grid[0][next])
    for (let ring = 1; ring < rings; ring++) {
      soup.quad(grid[ring - 1][spoke], grid[ring - 1][next], grid[ring][next], grid[ring][spoke])
    }
  }
  const geometry = soup.toGeometry()
  geometry.deleteAttribute('normal')
  geometry.computeVertexNormals()
  return geometry
}
/** A straight member of the cross-section from `from` to `to`, its depth toward `toward`, with `gap` between the line and its face. */
function member(from: Vector3, to: Vector3, [width, depth]: readonly [number, number], toward: Vector3, gap: number) {
  const axis = to.clone().sub(from)
  const length = axis.length()
  axis.normalize()
  const depthAxis = toward.clone().addScaledVector(axis, -toward.dot(axis)).normalize()
  const widthAxis = axis.clone().cross(depthAxis)
  const center = from.clone().add(to).multiplyScalar(0.5).addScaledVector(depthAxis, depth / 2 + gap)
  const placement = new Matrix4
  placement.makeBasis(axis, depthAxis, widthAxis).setPosition(center)
  const geometry = new BoxGeometry(length, depth, width)
  return geometry.applyMatrix4(placement)
}
/** the lantern’s glass in its UVs: every triangle is one pane, as wide as its foot and as high as its slant */
export const lanternPaneSize = (() => {
  const [foot, rise] = salonLantern.lantern.glass
  return [foot * halfSide * 2, Math.hypot(foot, rise)] as const
})()
/**
 * A surface along the ceiling’s faces toward the room, the drum’s and the dome’s, and the lantern’s glass, so thrown things bounce off them instead of disappearing into them, and the windows count as closed.
 * Returned as vertices and indices for a triangle mesh collider.
 */
export function salonLanternCollision(size: Size) {
  const [faceX, faceZ] = [size[0] / 2 - wallFace, size[1] / 2 - wallFace]
  const field = new Shape(rectangle([faceX, faceZ]).map(([x, z]) => new Vector2(x, z)))
  field.holes.push(new Path(octagon(apothem).map(([x, z]) => new Vector2(x, z))))
  const ceiling = new ShapeGeometry(field)
  ceiling.rotateX(Math.PI / 2).translate(0, salonLanternBase, 0)
  const soup = new TriangleSoup
  const corners = octagon(apothem)
  const eye = octagon(salonLantern.dome.oculus)
  for (let side = 0; side < 8; side++) {
    const [nx, nz] = octagonSide(side)
    const inward = new Vector3(-nx, 0, -nz)
    const band = ([from, to]: readonly [Plan, Plan], bottom: number, top: number) => {
      const ids = ([[from, bottom], [to, bottom], [to, top], [from, top]] as const).map(([[x, z], y]) => soup.add(new Vector3(x, y, z), inward, [0, 0]))
      soup.quad(ids[0], ids[1], ids[2], ids[3])
    }
    band([corners[side], corners[(side + 1) % 8]], salonLanternBase, salonDomeSpringY)
    band([eye[side], eye[(side + 1) % 8]], salonDomeEyeY, salonLanternGlassY)
  }
  const surface = mergeParts([ceiling, soup.toGeometry(), stripExtras(sails(8)), lanternGlass()])
  try {
    return colliderGeometry(surface)
  } finally {
    surface.dispose()
  }
}
/** the corners of the lantern’s glass at its foot, and its apex */
function lanternCorners() {
  const [foot] = salonLantern.lantern.glass
  return {
    apex: new Vector3(0, salonLanternApexY, 0),
    corners: octagon(foot).map(([x, z]) => new Vector3(x, salonLanternGlassY, z)),
  }
}
/** The lantern’s glass: eight triangles rising to its apex, facing in, with UVs in meters along the foot and up the slope. */
function lanternGlass() {
  const soup = new TriangleSoup
  const {apex, corners} = lanternCorners()
  for (let side = 0; side < 8; side++) {
    const a = corners[side]
    const b = corners[(side + 1) % 8]
    const base = a.distanceTo(b)
    const middle = a.clone().add(b).multiplyScalar(0.5)
    const slant = middle.distanceTo(apex)
    const normal = b.clone().sub(a).cross(apex.clone().sub(a)).normalize()
    // Toward the lantern’s axis.
    if (normal.dot(middle.clone().negate().setY(0)) < 0) {
      normal.negate()
    }
    soup.triangle(soup.add(a, normal, [0, 0]), soup.add(b, normal, [base, 0]), soup.add(apex, normal, [base / 2, slant]))
  }
  return soup.toGeometry()
}
/** The lantern’s bronze: its curb round the eye and the hips under the glass, rising to the apex. */
function lanternBronze() {
  const [inner, outer, height] = salonLantern.lantern.curb
  const {apex, corners} = lanternCorners()
  return [
    octagonRing(inner, outer, salonDomeTopY, salonDomeTopY + height),
    ...corners.map(corner => member(corner, apex, salonLantern.lantern.hip, new Vector3(-corner.x, -0.5, -corner.z), 0.004)),
  ]
}
/** The geometry with only position, normal and uv, so it merges with plain parts. */
function stripExtras(geometry: BufferGeometry) {
  for (const name of Object.keys(geometry.attributes)) {
    if (!['normal', 'position', 'uv'].includes(name)) {
      geometry.deleteAttribute(name)
    }
  }
  return geometry
}
/**
 * Merged meshes of the Salon’s ceiling and its lantern for a room of the size, relative to its middle at floor level, by material: the stucco of the ceiling, the drum and the dome’s back, the sails inlaid with shells, the gilding, the bronze and the glass of the windows and of the lantern.
 * The drum, the dome and the slab are closed solids that shade the sun everywhere but through the glass.
 */
export default class SalonLanternGeometry {
  readonly bronze: BufferGeometry
  readonly gilt: BufferGeometry
  /** the lantern’s glass over the eye, facing in */
  readonly lanternGlass: BufferGeometry
  /** the dome’s inner face, with the layout of its shells, see `sails` */
  readonly sails: BufferGeometry
  readonly stucco: BufferGeometry
  /** the windows’ glass, facing into the drum */
  readonly windowGlass: BufferGeometry

  constructor(size: Size) {
    const [halfX, halfZ] = [size[0] / 2, size[1] / 2]
    const [faceX, faceZ] = [halfX - wallFace, halfZ - wallFace]
    const [ringWidth, ringDepth] = salonLantern.ring
    const {bead} = salonLantern
    const ringBottom = salonLanternBase - ringDepth
    const {band: [bandWidth, bandDepth], half: bayHalf} = salonLantern.bay
    const [borderInset, borderWidth, borderDepth] = salonLantern.border
    const [borderX, borderZ] = [faceX - borderInset, faceZ - borderInset]
    const [[giltHeight, giltProjection], [, upperProjection]] = salonLantern.cornice
    const [sillHeight, sillProjection] = salonLantern.sillBand
    const {sill} = salonLantern.window
    const sides = Array.from({length: 8}, (_, index) => index)
    const [rosetteRadius, endRosetteRadius] = salonLantern.rosettes
    // Halfway along the diagonal from the ring round the opening, whose diagonal sides face it, to the square bay’s corner, and in the middle of either end bay.
    const rosetteReach = (apothem + ringWidth + bayHalf * Math.SQRT2) / 2
    const endRosetteZ = (bayHalf + bandWidth / 2 + borderZ - borderWidth) / 2
    this.stucco = mergeParts([
      // The slab, cut round the opening halfway into the drum, so its edge stays hidden in the drum’s foot.
      prism(rectangle([halfX, halfZ]), salonCeiling.y - salonCeiling.thickness / 2, salonCeiling.y + salonCeiling.thickness / 2, [octagon(apothem + drum.thickness / 2)]),
      // The ring round the opening in two steps, the inner one deeper.
      octagonRing(apothem, apothem + ringWidth * 0.55, ringBottom, salonLanternBase),
      octagonRing(apothem + ringWidth * 0.35, apothem + ringWidth, salonLanternBase - ringDepth * 0.6, salonLanternBase),
      // The bands across the room at the square bay’s ends, the ones along it between them, and the border along the walls.
      ...[-1, 1].map(side => box([0, salonLanternBase - bandDepth / 2, side * bayHalf], [borderX * 2 - borderWidth * 2, bandDepth, bandWidth])),
      ...[-1, 1].map(side => box([side * bayHalf, salonLanternBase - bandDepth / 2, 0], [bandWidth, bandDepth, bayHalf * 2 - bandWidth])),
      prism(rectangle([borderX, borderZ]), salonLanternBase - borderDepth, salonLanternBase, [rectangle([borderX - borderWidth, borderZ - borderWidth])]),
      ...sides.map(drumSide),
      ...sides.map(cornerStrip),
      ...sides.map(architrave),
      octagonRing(apothem - sillProjection, apothem, sill - sillHeight, sill),
      octagonRing(apothem - upperProjection, apothem, corniceBottom + giltHeight, drum.top),
      // A plain cornice round the drum’s outside, under the dome.
      octagonRing(salonDrumOuterApothem, salonDrumOuterApothem + 0.1, drum.top - 0.15, drum.top),
      domeBack(),
    ])
    const [ribWidth] = salonLantern.dome.rib
    const finial = new SphereGeometry(salonLantern.lantern.finial, 16, 12)
    finial.translate(0, salonLanternApexY + salonLantern.lantern.finial * 0.9, 0)
    this.gilt = mergeParts([
      octagonRing(apothem - bead * 0.4, apothem + bead * 0.6, ringBottom - bead * 0.7, ringBottom + bead * 0.3),
      octagonRing(apothem - giltProjection, apothem, corniceBottom, corniceBottom + giltHeight),
      ...sides.map(index => creaseRib(index)),
      octagonRing(salonLantern.dome.oculus - ribWidth / 2, salonLantern.dome.oculus + ribWidth / 2, salonDomeEyeY - 0.08, salonDomeEyeY),
      ...[-1, 1].flatMap(x => [-1, 1].map(z => rosette([x * rosetteReach / Math.SQRT2, z * rosetteReach / Math.SQRT2], rosetteRadius))),
      ...[-1, 1].map(z => rosette([0, z * endRosetteZ], endRosetteRadius)),
      finial,
    ])
    this.bronze = mergeParts([...sides.flatMap(windowBars), ...lanternBronze()])
    this.sails = sails()
    this.windowGlass = mergeParts(sides.map(windowGlass))
    this.lanternGlass = lanternGlass()
    for (const geometry of [this.sails, this.lanternGlass]) {
      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()
    }
  }

  dispose() {
    for (const geometry of [this.bronze, this.gilt, this.lanternGlass, this.sails, this.stucco, this.windowGlass]) {
      geometry.dispose()
    }
  }
}

