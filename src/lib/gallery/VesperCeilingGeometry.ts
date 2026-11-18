import type {CeilingSection} from './vesperCeiling.ts'
import type {BufferGeometry} from 'three/webgpu'

import {BoxGeometry, CatmullRomCurve3, Matrix4, SphereGeometry, TubeGeometry, Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {colliderGeometry, wallFace} from './architecture.ts'
import TriangleSoup from './TriangleSoup.ts'
import vesperCeiling, {vesperCoveEnd, vesperCoveSection, vesperCoveTopY, vesperLanternEavesY, vesperLanternHalf, vesperLanternRidgeY, vesperLanternSillY, vesperOpeningInset} from './vesperCeiling.ts'

/** a stretch of a section with its normals toward the outside of the solid as [inward, up], one for each point or one for all */
type SectionRun = {
  normals: ReadonlyArray<CeilingSection>
  points: ReadonlyArray<CeilingSection>
}
type Size = readonly [width: number, depth: number]

const down: CeilingSection = [0, -1]
const up: CeilingSection = [0, 1]
const inward: CeilingSection = [1, 0]
const outward: CeilingSection = [-1, 0]
/** the four sides of the room: the axis each runs along and on which side of the middle it lies */
const sides = [
  ['x', -1],
  ['x', 1],
  ['z', -1],
  ['z', 1],
] as const
/**
 * A surface along the ceiling’s faces toward the room and the lantern’s glass, so thrown things bounce off the cove and the lantern instead of disappearing into them.
 * Returned as vertices and indices for a triangle mesh collider.
 */
export function vesperCeilingCollision(size: Size) {
  const half = wallFaces(size)
  const surface = mergeParts([sectionLoft(half, innerRuns()), lanternGlass(vesperLanternHalf(size))])
  try {
    return colliderGeometry(surface)
  } finally {
    surface.dispose()
  }
}
/** The normal into the lantern of the roof slope that falls toward the side at `side` along `axis`. */
export function slopeNormal(axis: 'x' | 'z', side: number, run: number, rise: number) {
  const normal = axis === 'x' ? new Vector3(-side * rise, -run, 0) : new Vector3(0, -run, -side * rise)
  return normal.normalize()
}
/**
 * A straight member from `from` to `to` of the cross-section `[width, depth]`, standing `gap` off the line toward `toward` and reaching `depth` beyond it, like a glazing bar behind its glass.
 * `extend` lengthens it at both ends, so members meet in corners without gaps.
 */
export function member(from: Vector3, to: Vector3, [width, depth]: readonly [number, number], toward: Vector3, {extend = 0, gap = vesperCeiling.lantern.gap}: {
  extend?: number
  gap?: number
} = {}) {
  const axis = to.clone().sub(from)
  const length = axis.length() + extend * 2
  axis.normalize()
  const depthAxis = toward.clone().addScaledVector(axis, -toward.dot(axis)).normalize()
  const widthAxis = axis.clone().cross(depthAxis)
  const center = from.clone().add(to).multiplyScalar(0.5).addScaledVector(depthAxis, depth / 2 + gap)
  const placement = new Matrix4
  placement.makeBasis(axis, depthAxis, widthAxis).setPosition(center)
  const box = new BoxGeometry(length, depth, width)
  return box.applyMatrix4(placement)
}
/**
 * A band around the room that follows a section: every point of the section traces the rectangle that far inside the walls’ faces, so the four sides meet on the diagonals.
 * Each run of the section gets vertices of its own, which keeps the edges between runs hard, while a run with a normal for every point shades smooth across them.
 */
function sectionLoft(half: Size, runs: ReadonlyArray<SectionRun>) {
  const soup = new TriangleSoup
  for (const [axis, side] of sides) {
    // The half length of the side’s wall and the distance of its face from the middle.
    const [length, distance] = axis === 'x' ? half : [half[1], half[0]]
    for (const {normals, points} of runs) {
      let travel = 0
      const rows = points.map(([offset, y], index) => {
        if (index > 0) {
          travel += Math.hypot(offset - points[index - 1][0], y - points[index - 1][1])
        }
        const [normalIn, normalUp] = normals[Math.min(index, normals.length - 1)]
        const across = side * (distance - offset)
        const normal = axis === 'x' ? new Vector3(0, normalUp, -side * normalIn) : new Vector3(-side * normalIn, normalUp, 0)
        return [-1, 1].map(end => {
          const along = end * (length - offset)
          const position = axis === 'x' ? new Vector3(along, y, across) : new Vector3(across, y, along)
          return soup.add(position, normal, [along, travel])
        })
      })
      for (let index = 1; index < rows.length; index++) {
        const [a, b] = rows[index - 1]
        const [d, c] = rows[index]
        soup.triangle(a, b, c)
        soup.triangle(a, c, d)
      }
    }
  }
  return soup.toGeometry()
}
/** The closed section of a molding around the room: the rectangle between two distances in from the walls’ faces and two heights. */
function moldingRuns([inner, outer]: readonly [number, number], [bottom, top]: readonly [number, number]): Array<SectionRun> {
  return [
    {
      points: [[inner, bottom], [outer, bottom]],
      normals: [down],
    },
    {
      points: [[outer, bottom], [outer, top]],
      normals: [inward],
    },
    {
      points: [[outer, top], [inner, top]],
      normals: [up],
    },
    {
      points: [[inner, top], [inner, bottom]],
      normals: [outward],
    },
  ]
}
/** The cove’s section from the ledge up to the band, with its smooth normals. */
function coveRun(): SectionRun {
  const {segments} = vesperCeiling.cove
  const sections = Array.from({length: segments + 1}, (_, index) => vesperCoveSection(index / segments * Math.PI / 2))
  return {
    points: sections.map(({point}) => point),
    normals: sections.map(({normal}) => normal),
  }
}
/** The faces of the ceiling toward the room, from the ledge to the top of the curb. */
function innerRuns(): Array<SectionRun> {
  const {springY} = vesperCeiling
  return [
    {
      points: [[0, springY], [vesperCeiling.ledge, springY]],
      normals: [down],
    },
    coveRun(),
    {
      points: [[vesperCoveEnd, vesperCoveTopY], [vesperOpeningInset, vesperCoveTopY]],
      normals: [down],
    },
    {
      points: [[vesperOpeningInset, vesperCoveTopY], [vesperOpeningInset, vesperLanternSillY]],
      normals: [inward],
    },
  ]
}
/** A convex polygon of glass facing `normal`, with the given UVs at its corners. */
function addPane(soup: TriangleSoup, corners: ReadonlyArray<Vector3>, uvs: ReadonlyArray<readonly [number, number]>, normal: Vector3) {
  const indices = corners.map((corner, index) => soup.add(corner, normal, uvs[index]))
  for (let index = 2; index < indices.length; index++) {
    soup.triangle(indices[0], indices[index - 1], indices[index])
  }
}
/**
 * The lantern’s glass facing into it: four upright sides and a hipped roof. UVs count the panes of the bars in front of them: u in meters along the sides and eaves from the corners, v in meters up the sides and in rows up the slopes.
 */
function lanternGlass([halfX, halfZ]: Size) {
  const {rise, rows} = vesperCeiling.lantern
  const soup = new TriangleSoup
  const sill = vesperLanternSillY
  const eaves = vesperLanternEavesY
  const ridge = vesperLanternRidgeY
  const ridgeEnd = halfZ - halfX
  for (const side of [-1, 1]) {
    // Upright sides along z and along x, under the slopes of the roof.
    addPane(soup, [new Vector3(side * halfX, sill, -halfZ), new Vector3(side * halfX, sill, halfZ), new Vector3(side * halfX, eaves, halfZ), new Vector3(side * halfX, eaves, -halfZ)], [[0, 0], [halfZ * 2, 0], [halfZ * 2, eaves - sill], [0, eaves - sill]], new Vector3(-side, 0, 0))
    addPane(soup, [new Vector3(-halfX, sill, side * halfZ), new Vector3(halfX, sill, side * halfZ), new Vector3(halfX, eaves, side * halfZ), new Vector3(-halfX, eaves, side * halfZ)], [[0, 0], [halfX * 2, 0], [halfX * 2, eaves - sill], [0, eaves - sill]], new Vector3(0, 0, -side))
    // The long slopes run up from the sides along z to the ridge, the hipped ends from the sides along x.
    addPane(soup, [new Vector3(side * halfX, eaves, -halfZ), new Vector3(side * halfX, eaves, halfZ), new Vector3(0, ridge, ridgeEnd), new Vector3(0, ridge, -ridgeEnd)], [[0, 0], [halfZ * 2, 0], [halfZ + ridgeEnd, rows], [halfZ - ridgeEnd, rows]], slopeNormal('x', side, halfX, rise))
    addPane(soup, [new Vector3(-halfX, eaves, side * halfZ), new Vector3(halfX, eaves, side * halfZ), new Vector3(0, ridge, side * ridgeEnd)], [[0, 0], [halfX * 2, 0], [halfX, rows]], slopeNormal('z', side, halfX, rise))
  }
  return soup.toGeometry()
}
/** The lantern’s bronze: sill and eaves plate around it, corner posts, ridge and hips, and the bars dividing its glass into panes. */
function lanternBars([halfX, halfZ]: Size) {
  const {bar, frame, gap, pane, rise, rows} = vesperCeiling.lantern
  const parts: Array<BufferGeometry> = []
  const sill = vesperLanternSillY
  const eaves = vesperLanternEavesY
  const ridge = vesperLanternRidgeY
  const ridgeEnd = halfZ - halfX
  /** height on a slope `distance` up from the eaves, measured on the plan */
  const slopeY = (distance: number) => eaves + rise * distance / halfX
  /** positions of the bars between panes along a run of the given half length */
  const divisions = (half: number) => Array.from({length: Math.round(half * 2 / pane) - 1}, (_, index) => -half + (index + 1) * pane)
  const corners = [-1, 1].flatMap(x => [-1, 1].map(z => [x, z] as const))
  // The slopes fall away from the hips and the ridge, so their members hang lower than the bars to stay clear of the glass on both sides.
  const crestGap = frame[0] / 2 * rise / halfX + gap
  /** `end` pulled back toward `start` by half a hip’s width on the plan, where a bar runs into a hip or the ridge, so its corners stay clear of the slope beyond */
  const crestEnd = (start: Vector3, end: Vector3) => start.clone().lerp(end, 1 - frame[0] / 2 / Math.hypot(end.x - start.x, end.z - start.z))
  for (const side of [-1, 1]) {
    const intoX = new Vector3(-side, 0, 0)
    const intoZ = new Vector3(0, 0, -side)
    // The sill sits on the curb, flush with its face, and the eaves plate right under the roof’s edge. Both stop short of the glass of the sides they meet in the corners.
    for (const [y, offset] of [[sill + frame[0] / 2, 0], [eaves - frame[0] / 2, gap]] as const) {
      parts.push(member(new Vector3(side * halfX, y, -halfZ), new Vector3(side * halfX, y, halfZ), frame, intoX, {
        extend: -gap,
        gap: offset,
      }))
      parts.push(member(new Vector3(-halfX, y, side * halfZ), new Vector3(halfX, y, side * halfZ), frame, intoZ, {
        extend: -gap,
        gap: offset,
      }))
    }
    for (const z of divisions(halfZ)) {
      parts.push(member(new Vector3(side * halfX, sill, z), new Vector3(side * halfX, eaves, z), bar, intoX))
      // Rafters run up the long slope, those near its ends only as far as the hips.
      const reach = Math.min(halfX, halfZ - Math.abs(z))
      const foot = new Vector3(side * halfX, eaves, z)
      parts.push(member(foot, crestEnd(foot, new Vector3(side * (halfX - reach), slopeY(reach), z)), bar, slopeNormal('x', side, halfX, rise)))
    }
    for (const x of divisions(halfX)) {
      parts.push(member(new Vector3(x, sill, side * halfZ), new Vector3(x, eaves, side * halfZ), bar, intoZ))
      const reach = halfX - Math.abs(x)
      const foot = new Vector3(x, eaves, side * halfZ)
      parts.push(member(foot, crestEnd(foot, new Vector3(x, slopeY(reach), side * (halfZ - reach))), bar, slopeNormal('z', side, halfX, rise)))
    }
    // Purlins cross every slope between the rows of panes, from hip to hip.
    for (let row = 1; row < rows; row++) {
      const distance = row * halfX / rows
      const y = slopeY(distance)
      for (const [start, end, axis] of [
        [new Vector3(side * (halfX - distance), y, -(halfZ - distance)), new Vector3(side * (halfX - distance), y, halfZ - distance), 'x'],
        [new Vector3(-(halfX - distance), y, side * (halfZ - distance)), new Vector3(halfX - distance, y, side * (halfZ - distance)), 'z'],
      ] as const) {
        parts.push(member(crestEnd(end, start), crestEnd(start, end), bar, slopeNormal(axis, side, halfX, rise)))
      }
    }
  }
  for (const [x, z] of corners) {
    // A square post inside the corner, clear of the glass on both sides.
    const postZ = z * (halfZ - gap - frame[0] / 2)
    parts.push(member(new Vector3(x * halfX, sill, postZ), new Vector3(x * halfX, eaves, postZ), [frame[0], frame[0]], new Vector3(-x, 0, 0)))
    // Each hip runs between its two slopes.
    const hipInto = slopeNormal('x', x, halfX, rise).add(slopeNormal('z', z, halfX, rise))
    // It starts a little up the slope, where the corner post and the eaves plates meet below it, so its end stays inside the glass.
    const head = new Vector3(0, ridge, z * ridgeEnd)
    const foot = new Vector3(x * halfX, eaves, z * halfZ)
    parts.push(member(foot.lerp(head, frame[1] / foot.distanceTo(head)), head, frame, hipInto, {gap: crestGap}))
  }
  parts.push(member(new Vector3(0, ridge, -ridgeEnd), new Vector3(0, ridge, ridgeEnd), frame, new Vector3(0, -1, 0), {gap: crestGap}))
  return parts
}
/** The gilding: fillets along the edge of the ledge, the top of the cove and the edge of the opening, and a bead with a ball at either end in every crease of the cove. */
function gilding(half: Size, curveDetail: number) {
  const {gilt, ledge, springY} = vesperCeiling
  const {bead, fillet} = gilt
  const parts: Array<BufferGeometry> = [
    // Each fillet wraps an edge, except the one at the top of the cove, where it lies flat on the curve’s level end.
    sectionLoft(half, moldingRuns([ledge - fillet * 0.7, ledge + fillet * 0.3], [springY - fillet * 0.35, springY + fillet])),
    sectionLoft(half, moldingRuns([vesperCoveEnd - fillet / 2, vesperCoveEnd + fillet / 2], [vesperCoveTopY - fillet * 0.3, vesperCoveTopY + 0.01])),
    sectionLoft(half, moldingRuns([vesperOpeningInset - fillet * 0.7, vesperOpeningInset + fillet * 0.3], [vesperCoveTopY - fillet * 0.35, vesperCoveTopY + fillet])),
  ]
  const {segments} = vesperCeiling.cove
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const points = Array.from({length: segments / 2 + 1}, (_, index) => {
        const [offset, y] = vesperCoveSection(index / (segments / 2) * Math.PI / 2).point
        return new Vector3(x * (half[0] - offset), y, z * (half[1] - offset))
      })
      const curve = new CatmullRomCurve3(points)
      parts.push(new TubeGeometry(curve, segments * curveDetail, bead, 8 * curveDetail, false))
      for (const end of [points[0], points.at(-1)!]) {
        const ball = new SphereGeometry(bead * 1.6, 12 * curveDetail, 8 * curveDetail)
        parts.push(ball.translate(end.x, end.y, end.z))
      }
    }
  }
  return parts
}
/** Half the room’s extent along x and z, measured to the walls’ faces. */
function wallFaces([width, depth]: Size): Size {
  return [width / 2 - wallFace, depth / 2 - wallFace]
}

/**
 * Merged meshes of the Vesper’s coved ceiling and its lantern for a room of the size, relative to its middle at floor level, by material: the plaster shell, the gilding, the lantern’s bronze and its glass.
 * The shell is a closed solid resting on the walls, inside their faces, and flat on top at the height of the curb. It keeps out of the coffers of the Lobby’s vault, which reach into the wall the two rooms share. `curveDetail` multiplies the segments of the gilt beads.
 */
export default class VesperCeilingGeometry {
  readonly bars: BufferGeometry
  readonly gilt: BufferGeometry
  /** the lantern’s glass, its faces toward the room, with UVs in panes */
  readonly glass: BufferGeometry
  readonly plaster: BufferGeometry

  constructor(size: Size, curveDetail = 1) {
    const half = wallFaces(size)
    const lantern = vesperLanternHalf(size)
    this.plaster = sectionLoft(half, [
      ...innerRuns(),
      {
        points: [[vesperOpeningInset, vesperLanternSillY], [0, vesperLanternSillY]],
        normals: [up],
      },
      {
        points: [[0, vesperLanternSillY], [0, vesperCeiling.springY]],
        normals: [outward],
      },
    ])
    this.plaster.computeBoundingBox()
    this.plaster.computeBoundingSphere()
    this.gilt = mergeParts(gilding(half, curveDetail))
    this.bars = mergeParts(lanternBars(lantern))
    this.glass = lanternGlass(lantern)
    this.glass.computeBoundingBox()
    this.glass.computeBoundingSphere()
  }

  dispose() {
    for (const geometry of [this.bars, this.gilt, this.glass, this.plaster]) {
      geometry.dispose()
    }
  }
}
