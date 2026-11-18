import type {CeilingSection} from './vesperCeiling.ts'

import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js'
import {BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Matrix4, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {colliderGeometry, wallFace} from './architecture.ts'
import rosette from './rosette.ts'
import vesperCeiling, {vesperCoveEnd, vesperCoveSection, vesperCoveTopY, vesperLanternEavesY, vesperLanternHalf, vesperLanternRidgeY, vesperLanterns, vesperLanternSillY, vesperOpeningInset} from './vesperCeiling.ts'

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
 * A surface along the ceiling’s faces toward the room, the bridge and both lanterns’ glass, so thrown things bounce off the cove, the bridge and the lanterns instead of disappearing into them.
 * Returned as vertices and indices for a triangle mesh collider.
 */
export function vesperCeilingCollision(size: Size) {
  const half = wallFaces(size)
  const lanterns = vesperLanterns(size)
  const surface = mergeParts([
    sectionLoft(half, innerRuns()),
    ...bridgePlaster(size),
    ...lanterns.map(({centerZ, half: lanternHalf}) => lanternGlass(lanternHalf).translate(0, 0, centerZ)),
  ])
  try {
    return colliderGeometry(surface)
  } finally {
    surface.dispose()
  }
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
/** A band around an arbitrary `[x0, x1] × [z0, z1]` rectangle in room space, built as closed molding loops. */
function rectMolding([x0, x1]: readonly [number, number], [z0, z1]: readonly [number, number], width: number, [bottom, top]: readonly [number, number]) {
  const soup = new TriangleSoup
  const out = width * 0.7
  const inn = -width * 0.3
  const rectSides = [
    {
      axis: 'z' as const,
      along: [z0, z1] as const,
      coord: x0,
      dir: 1,
    },
    {
      axis: 'z' as const,
      along: [z0, z1] as const,
      coord: x1,
      dir: -1,
    },
    {
      axis: 'x' as const,
      along: [x0, x1] as const,
      coord: z0,
      dir: 1,
    },
    {
      axis: 'x' as const,
      along: [x0, x1] as const,
      coord: z1,
      dir: -1,
    },
  ]
  const loopRuns = moldingRuns([-out, -inn], [bottom, top])
  for (const {axis, along, coord, dir} of rectSides) {
    for (const {normals, points} of loopRuns) {
      let travel = 0
      const rows = points.map(([offset, y], index) => {
        if (index > 0) {
          travel += Math.hypot(offset - points[index - 1][0], y - points[index - 1][1])
        }
        const [normalIn, normalUp] = normals[Math.min(index, normals.length - 1)]
        const across = coord + dir * offset
        const normal = axis === 'x' ? new Vector3(0, normalUp, dir * normalIn) : new Vector3(dir * normalIn, normalUp, 0)
        return [-1, 1].map(end => {
          const span = (end < 0 ? along[0] : along[1]) + end * offset
          const position = axis === 'x' ? new Vector3(span, y, across) : new Vector3(across, y, span)
          return soup.add(position, normal, [span, travel])
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
/** Extrudes a 2D XY shape along z from `z0` to `z1` as an indexed closed manifold solid. */
function extrudeSolid(shape: Shape, z0: number, z1: number, curveSegments = 16) {
  const raw = new ExtrudeGeometry(shape, {
    depth: z1 - z0,
    bevelEnabled: false,
    curveSegments,
  })
  raw.translate(0, 0, z0)
  const indexed = mergeVertices(raw, 1e-6)
  raw.dispose()
  return indexed
}
/** Arch circular arc parameters for a given half-span. */
function archMetrics(spanHalf: number) {
  const {crownY, springY, thickness} = vesperCeiling.bridge.arch
  const rise = crownY - springY
  const radius = (spanHalf * spanHalf + rise * rise) / (2 * rise)
  const centerY = crownY - radius
  const extradosRadius = radius + thickness
  const intrados = (x: number) => centerY + Math.sqrt(Math.max(0, radius * radius - x * x))
  const extrados = (x: number) => intrados(x) + thickness
  return {
    centerY,
    extrados,
    extradosRadius,
    intrados,
    radius,
  }
}
/** Builds a curved arch-band shape from `x0` to `x1` between `bottom(x)` and `top(x)`. */
function archBandShape(x0: number, x1: number, segments: number, bottom: (x: number) => number, top: (x: number) => number) {
  const shape = new Shape
  for (let i = 0; i <= segments; i++) {
    const x = x0 + (x1 - x0) * i / segments
    const y = bottom(x)
    if (i === 0) {
      shape.moveTo(x, y)
    } else {
      shape.lineTo(x, y)
    }
  }
  for (let i = segments; i >= 0; i--) {
    const x = x0 + (x1 - x0) * i / segments
    shape.lineTo(x, top(x))
  }
  shape.closePath()
  return shape
}
/** The plaster solids forming the central bridge: sculpted scrolled abutment brackets on the flat ceiling band, twin-ribbed coffered arch, sculpted keystone and corniced deck. */
function bridgePlaster(size: Size, curveDetail = 1): Array<BufferGeometry> {
  const [halfX] = vesperLanternHalf(size)
  const {arch, deck, halfWidth, keystone, pier} = vesperCeiling.bridge
  const spanHalf = halfX + 0.02
  const {extrados, intrados} = archMetrics(spanHalf)
  const archSegments = arch.segments * curveDetail
  const parts: Array<BufferGeometry> = []
  // 1. Bridge deck spanning the opening; its ends embed 5 cm into the solid perimeter curb, stepped down 3 cm there to avoid coplanar faces.
  const deckShape = new Shape
  const deckOuterX = halfX + 0.05
  deckShape.moveTo(-deckOuterX, deck.bottomY)
  deckShape.lineTo(deckOuterX, deck.bottomY)
  deckShape.lineTo(deckOuterX, vesperLanternSillY - 0.03)
  deckShape.lineTo(halfX, vesperLanternSillY - 0.03)
  deckShape.lineTo(halfX, vesperLanternSillY)
  deckShape.lineTo(-halfX, vesperLanternSillY)
  deckShape.lineTo(-halfX, vesperLanternSillY - 0.03)
  deckShape.lineTo(-deckOuterX, vesperLanternSillY - 0.03)
  deckShape.closePath()
  parts.push(extrudeSolid(deckShape, -halfWidth, halfWidth))
  // Low stepped saddle coping along the center of the deck top, keeping the outer sill seats at exact sillY.
  const copingShape = new Shape
  copingShape.moveTo(-halfX, vesperLanternSillY)
  copingShape.lineTo(halfX, vesperLanternSillY)
  copingShape.lineTo(halfX - 0.06, vesperLanternSillY + 0.05)
  copingShape.lineTo(-halfX + 0.06, vesperLanternSillY + 0.05)
  copingShape.closePath()
  parts.push(extrudeSolid(copingShape, -halfWidth + 0.14, halfWidth - 0.14))
  // Projecting deck cornice molding along north and south edges, meeting the lantern sill cleanly.
  const corniceShape = new Shape
  const corniceTop = vesperLanternSillY - 0.005
  const corniceBottom = corniceTop - deck.corniceHeight
  corniceShape.moveTo(-halfX - 0.03, corniceBottom)
  corniceShape.lineTo(halfX + 0.03, corniceBottom)
  corniceShape.lineTo(halfX + 0.03, corniceTop)
  corniceShape.lineTo(-halfX - 0.03, corniceTop)
  corniceShape.closePath()
  parts.push(extrudeSolid(corniceShape, -halfWidth - deck.corniceOverhang, halfWidth + deck.corniceOverhang))
  // 2. Main segmental arch: outer longitudinal ribs, upper recessed barrel above the coffers and transverse soffit ribs.
  const outerRibShape = archBandShape(-spanHalf, spanHalf, archSegments, intrados, extrados)
  for (const side of [-1, 1]) {
    const z0 = side < 0 ? -arch.halfWidth : arch.halfWidth - arch.ribWidth
    const z1 = side < 0 ? -arch.halfWidth + arch.ribWidth : arch.halfWidth
    parts.push(extrudeSolid(outerRibShape, z0, z1))
  }
  const innerHalfZ = arch.halfWidth - arch.ribWidth
  const upperBarrelShape = archBandShape(-spanHalf, spanHalf, archSegments, x => intrados(x) + arch.cofferDepth, x => extrados(x) - 0.005)
  parts.push(extrudeSolid(upperBarrelShape, -innerHalfZ - 0.005, innerHalfZ + 0.005))
  // Transverse ribs framing the four coffers under the arch (central keystone rib, two intermediate ribs and two abutment ribs).
  const transverseRibs = [
    [-0.36, 0.36, 8],
    [-1.7, -1.48, 5],
    [1.48, 1.7, 5],
    [-spanHalf, -2.8, 5],
    [2.8, spanHalf, 5],
  ] as const
  for (const [x0, x1, segs] of transverseRibs) {
    const ribShape = archBandShape(x0, x1, segs * curveDetail, intrados, x => intrados(x) + arch.cofferDepth + 0.01)
    parts.push(extrudeSolid(ribShape, -innerHalfZ - 0.005, innerHalfZ + 0.005))
  }
  // 3. Sculpted trapezoidal keystone at the crown.
  const keystoneShape = new Shape
  const kBottom = arch.crownY - keystone.drop
  const kTop = vesperLanternSillY - 0.04
  keystoneShape.moveTo(-keystone.halfWidth * 0.82, kBottom)
  keystoneShape.lineTo(keystone.halfWidth * 0.82, kBottom)
  keystoneShape.lineTo(keystone.halfWidth * 1.15, kTop)
  keystoneShape.lineTo(-keystone.halfWidth * 1.15, kTop)
  keystoneShape.closePath()
  parts.push(extrudeSolid(keystoneShape, -arch.halfWidth - keystone.overhangZ, arch.halfWidth + keystone.overhangZ))
  // 4. Sculpted abutment piers and scrolled corbel brackets tucked cleanly inside the flat ceiling band (between the opening and the cove-top fillet).
  const pierInnerX = halfX - 0.01
  const pierShape = new Shape
  pierShape.moveTo(pierInnerX, pier.baseY)
  pierShape.lineTo(pier.faceX, pier.baseY)
  // Graceful cyma reversa / ogee scroll curve rising from the impost foot cleanly up to the flat ceiling band before the cove-top fillet.
  const scrollSteps = 16 * curveDetail
  for (let i = 1; i <= scrollSteps; i++) {
    const t = i / scrollSteps
    const x = pier.faceX + (pier.tailX - pier.faceX) * t
    const y = pier.baseY + (vesperCoveTopY - pier.baseY) * (t * t * (3 - 2 * t))
    pierShape.lineTo(x, y)
  }
  pierShape.lineTo(pier.tailX, deck.bottomY + 0.03)
  pierShape.lineTo(pierInnerX, deck.bottomY + 0.03)
  pierShape.closePath()
  const eastPier = extrudeSolid(pierShape, -pier.halfWidth, pier.halfWidth)
  const westPier = eastPier.clone().rotateY(Math.PI)
  parts.push(eastPier, westPier)
  // Stepped impost capitals where the arch springs from each pier, seated cleanly under the arch ribs.
  const impostShape = new Shape
  impostShape.moveTo(pierInnerX - 0.02, pier.baseY + 0.02)
  impostShape.lineTo(pier.faceX + 0.04, pier.baseY + 0.02)
  impostShape.lineTo(pier.faceX + 0.04, arch.springY + 0.04)
  impostShape.lineTo(pierInnerX - 0.02, arch.springY + 0.04)
  impostShape.closePath()
  const eastImpost = extrudeSolid(impostShape, -pier.halfWidth - 0.03, pier.halfWidth + 0.03)
  const westImpost = eastImpost.clone().rotateY(Math.PI)
  parts.push(eastImpost, westImpost)
  return parts
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
/** The normal into the lantern of the roof slope that falls toward the side at `side` along `axis`. */
function slopeNormal(axis: 'x' | 'z', side: number, run: number, rise: number) {
  const normal = axis === 'x' ? new Vector3(-side * rise, -run, 0) : new Vector3(0, -run, -side * rise)
  return normal.normalize()
}
/**
 * A straight member from `from` to `to` of the cross-section `[width, depth]`, standing `gap` off the line toward `toward` and reaching `depth` beyond it, like a glazing bar behind its glass.
 * `extend` lengthens it at both ends, so members meet in corners without gaps.
 */
function member(from: Vector3, to: Vector3, [width, depth]: readonly [number, number], toward: Vector3, {extend = 0, gap = vesperCeiling.lantern.gap}: {
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
/** Positions along x of the two graduated spandrel oculi and the two colonnettes framing them. */
const spandrelRingXs = [1.84, 2.5] as const
const spandrelColonnetteXs = [2.13, 2.86] as const
const spandrelZ = 0.9
/** The bridge’s painted-bronze metalwork: pierced spandrel colonnettes framing the open spandrels. */
function bridgeBronze(size: Size, curveDetail: number): Array<BufferGeometry> {
  const [halfX] = vesperLanternHalf(size)
  const {deck} = vesperCeiling.bridge
  const {extrados} = archMetrics(halfX + 0.02)
  const parts: Array<BufferGeometry> = []
  const radial = 6 * curveDetail
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      for (const offsetX of spandrelColonnetteXs) {
        const x = sideX * offsetX
        // Embed base 2.5 cm into the sloping arch extrados so there is never an angled gap.
        const bottom = extrados(x) - 0.025
        const top = deck.bottomY + 0.01
        const height = top - bottom
        const shaft = new CylinderGeometry(0.019, 0.019, height, radial)
        parts.push(shaft.translate(x, (bottom + top) / 2, sideZ * spandrelZ))
      }
    }
  }
  return parts
}
/** The bridge’s water-gilt ornament: archivolts, coffer moldings and rosettes, keystone rosette and medallions, pier impost and ceiling collars and spandrel oculi rings. */
function bridgeGilt(size: Size, curveDetail: number): Array<BufferGeometry> {
  const [halfX] = vesperLanternHalf(size)
  const {arch, deck, keystone, pier} = vesperCeiling.bridge
  const spanHalf = halfX + 0.02
  const archSegments = arch.segments * curveDetail
  const {centerY, extrados, extradosRadius, intrados, radius} = archMetrics(spanHalf)
  const parts: Array<BufferGeometry> = []
  // 1. Curved archivolts on the north and south faces of the arch, ending cleanly on the impost top.
  const innerArchivolt = archBandShape(-spanHalf, spanHalf, archSegments, intrados, x => intrados(x) + 0.036)
  const outerArchivolt = archBandShape(-spanHalf, spanHalf, archSegments, x => extrados(x) - 0.036, extrados)
  for (const sideZ of [-1, 1]) {
    const z0 = sideZ < 0 ? -arch.halfWidth - 0.022 : arch.halfWidth
    const z1 = sideZ < 0 ? -arch.halfWidth : arch.halfWidth + 0.022
    parts.push(extrudeSolid(innerArchivolt, z0, z1))
    parts.push(extrudeSolid(outerArchivolt, z0, z1))
  }
  // 2. Coffer molding frames and smooth rosettes inside the four recessed soffit coffers.
  const coffers = [
    [-2.8, -1.7],
    [-1.48, -0.36],
    [0.36, 1.48],
    [1.7, 2.8],
  ] as const
  const cofferInnerZ = arch.halfWidth - arch.ribWidth
  const inset = 0.055
  const moldingWidth = 0.038
  const templateRosette = rosette(0.36, {detail: 1.5 * curveDetail})
  for (const [cx0, cx1] of coffers) {
    const mx0 = cx0 + inset
    const mx1 = cx1 - inset
    const mz = cofferInnerZ - inset
    // Curved longitudinal gilt strips along the north and south edges of each coffer.
    const stripShape = archBandShape(mx0, mx1, 12 * curveDetail, x => intrados(x) + arch.cofferDepth - 0.022, x => intrados(x) + arch.cofferDepth + 0.005)
    parts.push(extrudeSolid(stripShape, -mz, -mz + moldingWidth))
    parts.push(extrudeSolid(stripShape, mz - moldingWidth, mz))
    // Transverse gilt strips along the inner and outer ends of each coffer.
    for (const [tx0, tx1] of [[mx0, mx0 + moldingWidth], [mx1 - moldingWidth, mx1]] as const) {
      const tShape = archBandShape(tx0, tx1, 2, x => intrados(x) + arch.cofferDepth - 0.022, x => intrados(x) + arch.cofferDepth + 0.005)
      parts.push(extrudeSolid(tShape, -mz + moldingWidth, mz - moldingWidth))
    }
    // Rosette centered in the coffer, facing down along the local arch normal.
    const midX = (cx0 + cx1) / 2
    const slopeAngle = Math.atan2(-midX, Math.sqrt(Math.max(1e-6, radius * radius - midX * midX)))
    const flower = templateRosette.clone()
    flower.rotateZ(Math.PI + slopeAngle).translate(midX, intrados(midX) + arch.cofferDepth - 0.006, 0)
    parts.push(flower)
  }
  templateRosette.dispose()
  // 3. Keystone underside boss rosette and north/south face medallions.
  const kBottom = arch.crownY - keystone.drop
  const filletBottomY = vesperCoveTopY - vesperCeiling.gilt.fillet * 0.35
  const keystoneBoss = rosette(0.16, {detail: curveDetail})
  parts.push(keystoneBoss.rotateZ(Math.PI).translate(0, kBottom + 0.004, 0))
  for (const sideZ of [-1, 1]) {
    const faceRing = new TorusGeometry(0.082, 0.016, 5 * curveDetail, 14 * curveDetail)
    parts.push(faceRing.translate(0, (kBottom + filletBottomY) / 2, sideZ * (arch.halfWidth + keystone.overhangZ)))
  }
  // 4. Pier impost gilt bands and ceiling trim framing where the abutment scroll meets the flat ceiling band.
  for (const sideX of [-1, 1]) {
    const xCenter = sideX * (halfX + pier.faceX) / 2
    const xWidth = pier.faceX - halfX + 0.1
    const impostBand = new BoxGeometry(xWidth, 0.028, (pier.halfWidth + 0.045) * 2)
    parts.push(impostBand.translate(xCenter, arch.springY + 0.04, 0))
    const borderRange = sideX < 0 ? [-pier.tailX, -halfX] as const : [halfX, pier.tailX] as const
    parts.push(rectMolding(borderRange, [-pier.halfWidth, pier.halfWidth], 0.045, [vesperCoveTopY - 0.025, vesperCoveTopY + 0.01]))
  }
  // 5. Graduated pierced gilt oculi rings centered with equal clearance below the opening fillet and above the arch extrados, plus colonnette collars.
  const ringTube = 0.016
  const ringClearance = 0.045
  const ceilingLine = filletBottomY - ringClearance
  const clearExtrados = extradosRadius + ringClearance
  const ringDrop = ceilingLine - centerY
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      for (const offsetX of spandrelRingXs) {
        const x = sideX * offsetX
        const outerRadius = (offsetX * offsetX + ringDrop * ringDrop - clearExtrados * clearExtrados) / (2 * (clearExtrados + ringDrop))
        const ring = new TorusGeometry(outerRadius - ringTube, ringTube, 5 * curveDetail, 16 * curveDetail)
        parts.push(ring.translate(x, ceilingLine - outerRadius, sideZ * spandrelZ))
      }
      for (const offsetX of spandrelColonnetteXs) {
        const x = sideX * offsetX
        const bottom = extrados(x) - 0.008
        const baseCollar = new CylinderGeometry(0.032, 0.028, 0.036, 6 * curveDetail)
        const capitalCollar = new CylinderGeometry(0.026, 0.03, 0.032, 6 * curveDetail)
        parts.push(baseCollar.translate(x, bottom + 0.012, sideZ * spandrelZ))
        parts.push(capitalCollar.translate(x, deck.bottomY - 0.016, sideZ * spandrelZ))
      }
    }
  }
  // 6. Central gilt ridge fillet along the top coping of the bridge deck.
  const ridgeFillet = new BoxGeometry(halfX * 2 - 0.12, 0.032, 0.08)
  parts.push(ridgeFillet.translate(0, vesperLanternSillY + 0.058, 0))
  return parts
}
/** The gilding: fillets along the edge of the ledge, the top of the cove and both openings, beads with balls in the cove creases, and the bridge’s gilt ornament. */
function gilding(half: Size, size: Size, curveDetail: number) {
  const {gilt, ledge, springY} = vesperCeiling
  const {bead, fillet} = gilt
  const lanterns = vesperLanterns(size)
  const parts: Array<BufferGeometry> = [
    // Outer perimeter fillets at the wall ledge and at the top of the cove.
    sectionLoft(half, moldingRuns([ledge - fillet * 0.7, ledge + fillet * 0.3], [springY - fillet * 0.35, springY + fillet])),
    sectionLoft(half, moldingRuns([vesperCoveEnd - fillet / 2, vesperCoveEnd + fillet / 2], [vesperCoveTopY - fillet * 0.3, vesperCoveTopY + 0.01])),
    // Opening fillet wrapping each of the two skylight openings and the bridge’s deck edges.
    ...lanterns.map(({centerZ, half: [lHalfX, lHalfZ]}) => rectMolding([-lHalfX, lHalfX], [centerZ - lHalfZ, centerZ + lHalfZ], fillet, [vesperCoveTopY - fillet * 0.35, vesperCoveTopY + fillet])),
    ...bridgeGilt(size, curveDetail),
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
 * Merged meshes of the Vesper’s coved ceiling, its central bridge and its two lanterns for a room of the size, relative to its middle at floor level, by material: the plaster shell, the gilding, the bronze bars and metalwork, and the glass.
 * The shell is a closed solid resting on the walls, inside their faces, and flat on top at the height of the curb. It keeps out of the coffers of the Lobby’s vault, which reach into the wall the two rooms share. `curveDetail` multiplies the segments of the curved tubes and ornaments.
 */
export default class VesperCeilingGeometry {
  readonly bars: BufferGeometry
  readonly gilt: BufferGeometry
  /** the two lanterns’ glass, their faces toward each lantern’s interior, with UVs in panes */
  readonly glass: BufferGeometry
  readonly plaster: BufferGeometry

  constructor(size: Size, curveDetail = 1) {
    const half = wallFaces(size)
    const lanterns = vesperLanterns(size)
    const perimeter = sectionLoft(half, [
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
    this.plaster = mergeParts([perimeter, ...bridgePlaster(size, curveDetail)])
    this.plaster.computeBoundingBox()
    this.plaster.computeBoundingSphere()
    this.gilt = mergeParts(gilding(half, size, curveDetail))
    this.bars = mergeParts([
      ...lanterns.flatMap(({centerZ, half: lanternHalf}) => lanternBars(lanternHalf).map(part => part.translate(0, 0, centerZ))),
      ...bridgeBronze(size, curveDetail),
    ])
    this.glass = mergeParts(lanterns.map(({centerZ, half: lanternHalf}) => lanternGlass(lanternHalf).translate(0, 0, centerZ)))
    this.glass.computeBoundingBox()
    this.glass.computeBoundingSphere()
  }

  dispose() {
    for (const geometry of [this.bars, this.gilt, this.glass, this.plaster]) {
      geometry.dispose()
    }
  }
}

/** Collects triangles and winds each of them to face along the normals of its corners. */
class TriangleSoup {
  readonly indices: Array<number> = []
  readonly normals: Array<number> = []
  readonly positions: Array<number> = []
  readonly uvs: Array<number> = []

  /** Adds a vertex and returns its index. */
  add(position: Vector3, normal: Vector3, uv: readonly [number, number]) {
    this.positions.push(position.x, position.y, position.z)
    this.normals.push(normal.x, normal.y, normal.z)
    this.uvs.push(...uv)
    return this.positions.length / 3 - 1
  }

  toGeometry() {
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2))
    geometry.setIndex(this.indices)
    return geometry
  }

  /** Adds a triangle, skipping it if it has no area. */
  triangle(a: number, b: number, c: number) {
    const corner = (index: number) => new Vector3(this.positions[index * 3], this.positions[index * 3 + 1], this.positions[index * 3 + 2])
    const [pa, pb, pc] = [corner(a), corner(b), corner(c)]
    const face = pb.sub(pa).cross(pc.sub(pa))
    if (face.lengthSq() < 1e-14) {
      return
    }
    const normal = [a, b, c].reduce((sum, index) => sum.add(new Vector3(this.normals[index * 3], this.normals[index * 3 + 1], this.normals[index * 3 + 2])), new Vector3)
    if (face.dot(normal) >= 0) {
      this.indices.push(a, b, c)
    } else {
      this.indices.push(a, c, b)
    }
  }
}
