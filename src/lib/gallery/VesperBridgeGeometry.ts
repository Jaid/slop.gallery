import type {BufferGeometry} from 'three/webgpu'

import {BoxGeometry, ExtrudeGeometry, Shape, Vector3} from 'three/webgpu'

import {circleSegments, mergeParts} from '../geometry.ts'
import {colliderGeometry} from './architecture.ts'
import ArcSlabGeometry from './ArcSlabGeometry.ts'
import {curveSegments} from './CurvedBoxGeometry.ts'
import PolylineTubeGeometry from './railings/PolylineTubeGeometry.ts'
import rosette from './rosette.ts'
import TriangleSoup from './TriangleSoup.ts'
import vesperCeiling, {vesperCoveTopY, vesperLanternEavesY, vesperLanternHalf, vesperLanternRidgeY, vesperLanternSillY} from './vesperCeiling.ts'
import {member, slopeNormal} from './VesperCeilingGeometry.ts'

/** a circle in the plane across the lantern, x along the bridge and y up, centered over the bridge’s middle */
export type BridgeArc = {
  /** the height of its center */
  center: number
  radius: number
}
/** a circle in the plane across the lantern, like a gilt ring in a spandrel out to the outside of its bar */
export type BridgeCircle = {
  radius: number
  x: number
  y: number
}

type Size = readonly [width: number, depth: number]
type Range = readonly [number, number]

/** how far the arcs’ facets stray from their circles at most, in meters */
const tolerance = 0.001
/** how far the rings’ facets stray from their circles at most */
const ringTolerance = 0.001

type Layout = ReturnType<typeof vesperBridgeLayout>
type SlabOptions = {
  /** the radii of the slab, from the arc’s center */
  radii: Range
  /** how far out from the middle it reaches on its outer face */
  reach: number
  z: Range
}
/** The circle through (±`x`, `y`) whose top lies at `crown`. */
export function arcThrough(x: number, y: number, crown: number): BridgeArc {
  const rise = crown - y
  if (!(rise > 0) || !(x > 0)) {
    throw new RangeError('A bridge arc needs a crown above its ends and ends apart.')
  }
  const radius = (x ** 2 + rise ** 2) / (2 * rise)
  return {
    center: crown - radius,
    radius,
  }
}
/** the height of the arc `x` out from the middle */
export function arcHeight({center, radius}: BridgeArc, x: number) {
  return center + Math.sqrt(radius ** 2 - x ** 2)
}
/** The circle `x` out from the middle that rests on `below` and touches `above` from under it, both arcs about centers on the middle line. */
export function inscribedCircle(below: BridgeArc, above: BridgeArc, x: number): BridgeCircle {
  // Its center (x, y) lies r outside the lower arc and r inside the upper one: x² + (y − c₁)² = (R₁ + r)² and x² + (y − c₂)² = (R₂ − r)².
  const {center: c1, radius: r1} = below
  const {center: c2, radius: r2} = above
  if (Math.abs(c2 - c1) < 1e-9) {
    const radius = (r2 - r1) / 2
    return {
      radius,
      x,
      y: arcHeight(offsetArc(below, radius), x),
    }
  }
  // Their difference makes y linear in r, y = α + βr, which turns the first into a quadratic in r.
  const alpha = (c1 + c2) / 2 + (r1 + r2) * (r1 - r2) / (2 * (c2 - c1))
  const beta = (r1 + r2) / (c2 - c1)
  const d = alpha - c1
  const a = beta ** 2 - 1
  const b = 2 * (d * beta - r1)
  const c = d ** 2 + x ** 2 - r1 ** 2
  const root = Math.sqrt(b ** 2 - 4 * a * c)
  const radius = [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter(candidate => candidate > 0).reduce((smallest, candidate) => Math.min(smallest, candidate), Infinity)
  if (!Number.isFinite(radius)) {
    throw new RangeError('No circle fits between the bridge’s arcs there.')
  }
  return {
    radius,
    x,
    y: alpha + beta * radius,
  }
}
/**
 * The rings of one spandrel, on its +x side from the end toward the crown: each one rests on the arch and touches the deck girders from under it, so they shrink as the spandrel narrows, and as many as fit with at least `gap` between neighbors and between the first one and the end, and `medallionGaps` times that between the last one and the medallion at the crown. The gaps are all equal.
 */
export function spandrelRings(below: BridgeArc, above: BridgeArc, end: number, medallion: BridgeCircle, gap: number, medallionGaps = 1) {
  const at = (x: number) => inscribedCircle(below, above, x)
  /** the chain of `count` rings `spacing` apart, starting from the end */
  const chain = (spacing: number, count: number) => {
    // The first one keeps the spacing from the end.
    const rings = [at(bisect(x => x + at(x).radius - (end - spacing), [medallion.x, end]))]
    while (rings.length < count) {
      const previous = rings.at(-1)!
      /** how far the circle at x stays apart from the previous one, beyond the spacing, which shrinks as it comes closer */
      const apart = (x: number) => {
        const next = at(x)
        return Math.hypot(previous.x - next.x, previous.y - next.y) - previous.radius - next.radius - spacing
      }
      rings.push(at(bisect(x => -apart(x), [medallion.x, previous.x])))
    }
    return rings
  }
  /** how much room the chain leaves before the medallion, beyond the spacing */
  const slack = (spacing: number, count: number) => {
    const last = chain(spacing, count).at(-1)!
    return Math.hypot(last.x - medallion.x, last.y - medallion.y) - last.radius - medallion.radius - spacing * medallionGaps
  }
  let count = 1
  while (slack(gap, count + 1) > 0) {
    count++
  }
  if (!(slack(gap, count) > 0)) {
    return []
  }
  // Wider spacing leaves less room, so the spacing that leaves none spreads the rings evenly.
  const spacing = bisect(candidate => -slack(candidate, count), [gap, end])
  return chain(spacing, count)
}
/**
 * The layout of the bridge across the middle of the Vesper’s lantern, in a room of the size, relative to the room’s middle at floor level: x runs along the bridge, across the lantern, and the bridge is symmetric about x = 0 and about z = 0.
 */
export function vesperBridgeLayout(size: Size) {
  const {bridge, gilt, lantern} = vesperCeiling
  const [halfX] = vesperLanternHalf(size)
  const sill = vesperLanternSillY
  /** the pylons’ faces toward the middle, where the deck ends; they stand inside the upright glass like its posts */
  const deckEnd = halfX - lantern.gap - bridge.pylon
  /** the top of the deck girders */
  const deck = arcThrough(deckEnd, sill + bridge.deck[0], sill + bridge.deck[1])
  const girderBottom = offsetArc(deck, -bridge.girder[0])
  /** the arch springs from the gilt fillet on the opening’s edge, and its back stays the crown gap under the girders */
  const springY = vesperCoveTopY + gilt.fillet
  const arch = arcThrough(halfX, springY, arcHeight(girderBottom, 0) - bridge.crownGap - bridge.rib[1])
  const extrados = offsetArc(arch, bridge.rib[1])
  /** the corbels’ faces toward the middle, from which the arch leaves them */
  const corbelFace = halfX - bridge.shoe[0]
  const corbelTop = springY + bridge.shoe[1]
  // The medallion breaks over the arch and the girders at the crown, the rings fill the rest of the spandrel out to the pylons.
  const fitting = inscribedCircle(extrados, girderBottom, 0)
  const medallion = {
    ...fitting,
    radius: fitting.radius * bridge.medallion[0],
  }
  const rings = spandrelRings(extrados, girderBottom, deckEnd, medallion, bridge.rings.gap, bridge.rings.medallionGaps)
  const {bays, inset} = bridge.railing
  return {
    arch,
    corbelFace,
    corbelTop,
    deck,
    deckEnd,
    extrados,
    girderBottom,
    halfX,
    medallion,
    /** the posts of the railings between the pylons, which the ties under the deck line up with */
    posts: Array.from({length: bays - 1}, (_, index) => -deckEnd + (index + 1) * deckEnd * 2 / bays),
    railingZ: bridge.halfWidth - inset,
    rings,
    springY,
  }
}

/** the concentric arc `by` meters further out, or further in for a negative distance */
function offsetArc({center, radius}: BridgeArc, by: number): BridgeArc {
  return {
    center,
    radius: radius + by,
  }
}
/** the arc moved `by` meters up */
function raisedArc({center, radius}: BridgeArc, by: number): BridgeArc {
  return {
    center: center + by,
    radius,
  }
}
/** Finds where the increasing function crosses zero between the bounds. */
function bisect(f: (value: number) => number, [low, high]: Range) {
  let [a, b] = [low, high]
  for (let step = 0; step < 80; step++) {
    const middle = (a + b) / 2
    if (f(middle) < 0) {
      a = middle
    } else {
      b = middle
    }
  }
  return (a + b) / 2
}
/** A slab bent along an arc of the bridge, between ±`reach` on its outer face, cut so its facets stay within a millimeter of the circle. */
function arcSlab(arc: BridgeArc, {radii: [inner, outer], reach, z}: SlabOptions, curveDetail: number) {
  const start = Math.acos(reach / outer)
  const sweep = Math.PI - start * 2
  const slab = new ArcSlabGeometry({
    angles: [start, Math.PI - start],
    radii: [inner, outer],
    segments: curveSegments(sweep * outer, outer, tolerance) * curveDetail,
    z,
  })
  return slab.translate(0, arc.center, 0)
}
/** a ring in the plane across the lantern around the circle, the bar inside its radius */
function ring({radius, x, y}: BridgeCircle, bar: number, z: Range, curveDetail: number) {
  const slab = new ArcSlabGeometry({
    angles: [0, Math.PI * 2],
    radii: [radius - bar, radius],
    segments: circleSegments(radius, ringTolerance) * curveDetail,
    z,
  })
  return slab.translate(x, y, 0)
}
/** the slab on both faces of the bridge, the one on its −z face mirrored */
function bothFaces(make: (z: Range) => BufferGeometry, [near, far]: Range) {
  return [make([near, far]), make([-far, -near])]
}
/** A box between the corners. */
function block([x0, x1]: Range, [y0, y1]: Range, [z0, z1]: Range) {
  const box = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
  return box.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
}
/** both ends of the range mirrored across the middle */
const mirrored = ([from, to]: Range): Range => [-to, -from]
/** how far the gilt fillet along the edge of the opening stands out of the curb, see `gilding` of `VesperCeilingGeometry` */
const filletOverhang = vesperCeiling.gilt.fillet * 0.3
/** how far the medallion’s disc stands out of the girders’ faces, under its gilding */
const medallionDisc = 0.006

/**
 * The colliders’ solids: the bridge from its arch’s soffit up to the deck between the girders, out to the glass, and a thin wall under each handrail, so what flies into the lantern bounces off it and what lands on the deck stays on it.
 * Returned as vertices and indices for a triangle mesh collider.
 */
export function vesperBridgeCollision(size: Size) {
  const layout = vesperBridgeLayout(size)
  const {bridge, lantern} = vesperCeiling
  const {arch, deck, deckEnd, halfX, railingZ} = layout
  const deckTop = (x: number) => arcHeight(deck, Math.min(Math.abs(x), deckEnd)) - bridge.plate[0]
  const soup = new TriangleSoup
  /** a solid between two heights along the span, between ±`reach` and the two depths, cut within 2 mm of its arcs and wherever the deck ends */
  const solid = (reach: number, bottom: (x: number) => number, top: (x: number) => number, [front, back]: Range) => {
    const count = curveSegments(reach * 2, arch.radius, 0.002)
    const xs = [...Array.from({length: count + 1}, (_, index) => -reach + reach * 2 * index / count), ...[-deckEnd, deckEnd].filter(x => Math.abs(x) < reach - 1e-6)].toSorted((a, b) => a - b)
    const sections = xs.map(x => [new Vector3(x, bottom(x), front), new Vector3(x, bottom(x), back), new Vector3(x, top(x), back), new Vector3(x, top(x), front)])
    // Every face gets corners of its own, with a normal out of the solid, along which the soup winds it.
    const quad = (corners: ReadonlyArray<Vector3>, normal: Vector3) => {
      const indices = corners.map(point => soup.add(point, normal, [0, 0]))
      soup.triangle(indices[0], indices[1], indices[2])
      soup.triangle(indices[0], indices[2], indices[3])
    }
    for (let index = 1; index < sections.length; index++) {
      const [a, b] = [sections[index - 1], sections[index]]
      quad([a[0], a[1], b[1], b[0]], new Vector3(0, -1, 0))
      quad([a[3], a[2], b[2], b[3]], new Vector3(0, 1, 0))
      quad([a[0], a[3], b[3], b[0]], new Vector3(0, 0, -1))
      quad([a[1], a[2], b[2], b[1]], new Vector3(0, 0, 1))
    }
    quad(sections[0], new Vector3(-1, 0, 0))
    quad(sections.at(-1)!, new Vector3(1, 0, 0))
  }
  solid(halfX - lantern.gap, x => arcHeight(arch, x), deckTop, [-bridge.halfWidth, bridge.halfWidth])
  for (const z of [-railingZ, railingZ]) {
    solid(deckEnd, deckTop, x => deckTop(x) + bridge.plate[0] + bridge.railing.height + bridge.railing.handrail, [z - 0.012, z + 0.012])
  }
  const surface = soup.toGeometry()
  try {
    return colliderGeometry(surface)
  } finally {
    surface.dispose()
  }
}

/** the depth between two distances in from the girders’ faces on the side of `face`, the nearer one first, negative ones out in front */
function faceDepth(face: number, [near, far]: Range): Range {
  const {halfWidth} = vesperCeiling.bridge
  return face > 0 ? [halfWidth - far, halfWidth - near] : [-(halfWidth - near), -(halfWidth - far)]
}
/**
 * A corbel on the +x edge of the opening, which the arch springs from: flat on top, its underside a cavetto that rises from its seat on the gilt fillet and turns out into the soffit of the arch.
 */
function corbel(layout: Layout, z: Range, curveDetail: number) {
  const {arch, corbelFace: face, corbelTop, halfX, springY} = layout
  const seat = halfX - filletOverhang
  const soffit = arcHeight(arch, face)
  const shape = new Shape
  shape.moveTo(halfX, springY)
  shape.lineTo(halfX, corbelTop)
  shape.lineTo(face, corbelTop)
  shape.lineTo(face, soffit)
  // A quarter ellipse from the arch’s soffit down to its seat.
  const steps = 16 * curveDetail
  for (let step = 1; step <= steps; step++) {
    const angle = step / steps * Math.PI / 2
    shape.lineTo(face + (seat - face) * Math.sin(angle), springY + (soffit - springY) * Math.cos(angle))
  }
  const solid = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: z[1] - z[0],
  })
  return solid.translate(0, 0, z[0])
}
/** Every part on the +x half of the bridge, also on the −x half. */
function bothEnds(parts: Array<BufferGeometry>) {
  return parts.flatMap(part => [part, part.clone().rotateY(Math.PI)])
}
/** The bronze: the corbels, the pylons, three arch ribs with ties between them, the deck girders and the deck between them, the medallion’s disc, the railings’ posts, balusters, bottom and top rails, and over the pylons the principal rafters, which carry on the bridge’s frame up to the ridge. */
function bronze(layout: Layout, size: Size, curveDetail: number) {
  const {bridge, lantern} = vesperCeiling
  const {arch, corbelFace, corbelTop, deck, deckEnd, girderBottom, halfX, posts, railingZ} = layout
  const {halfWidth, ribInset} = bridge
  const [, girderThickness] = bridge.girder
  const [ribThickness, ribDepth] = bridge.rib
  const parts: Array<BufferGeometry> = []
  /** the ribs run into the corbels */
  const ribSlab = (z: Range) => arcSlab(arch, {
    radii: [arch.radius, arch.radius + ribDepth],
    reach: corbelFace + 0.01,
    z,
  }, curveDetail)
  parts.push(...bothFaces(ribSlab, [halfWidth - ribInset - ribThickness, halfWidth - ribInset]), ribSlab([-ribThickness / 2, ribThickness / 2]))
  // The girders run into the pylons.
  parts.push(...bothFaces(z => arcSlab(deck, {
    radii: [girderBottom.radius, deck.radius],
    reach: deckEnd + bridge.pylon / 2,
    z,
  }, curveDetail), [halfWidth - girderThickness, halfWidth]))
  // The deck between the girders, a little into them so its edges never show beside them.
  const [below, thickness] = bridge.plate
  const inside = halfWidth - girderThickness + 0.005
  parts.push(arcSlab(deck, {
    radii: [deck.radius - below - thickness, deck.radius - below],
    reach: deckEnd + 0.005,
    z: [-inside, inside],
  }, curveDetail))
  // Ties between the ribs under every post and at the crown, each square to the arch.
  for (const x of [...posts, 0]) {
    if (Math.abs(x) >= corbelFace) {
      continue
    }
    const angle = Math.acos(x / arch.radius)
    const middle = arch.radius + ribDepth / 2
    const tie = new BoxGeometry(0.035, ribDepth * 0.6, (halfWidth - ribInset - ribThickness / 2) * 2)
    tie.rotateZ(angle - Math.PI / 2)
    parts.push(tie.translate(middle * Math.cos(angle), arch.center + middle * Math.sin(angle), 0))
  }
  // The corbels and the pylons on them, which reach up to the eaves plate.
  const eavesPlate = vesperLanternEavesY - lantern.frame[0]
  const pylonX: Range = [deckEnd, deckEnd + bridge.pylon]
  const pylonZ: Range = [halfWidth - bridge.pylon, halfWidth]
  parts.push(...bothEnds([
    corbel(layout, [-halfWidth - 0.012, halfWidth + 0.012], curveDetail),
    block(pylonX, [corbelTop - 0.01, eavesPlate], pylonZ),
    block(pylonX, [corbelTop - 0.01, eavesPlate], mirrored(pylonZ)),
    // A cross-beam ties each pair of pylons together under the eaves plate.
    block(pylonX, [eavesPlate - 0.05, eavesPlate], [-halfWidth, halfWidth]),
  ]))
  // The medallion’s disc, in front of the girders and the ribs it breaks over.
  const {medallion} = layout
  for (const face of [-1, 1]) {
    const disc = new ArcSlabGeometry({
      angles: [0, Math.PI * 2],
      radii: [0, medallion.radius - bridge.rings.bar[1] + 0.002],
      segments: circleSegments(medallion.radius, ringTolerance) * curveDetail,
      z: faceDepth(face, [-medallionDisc, bridge.rings.inset[1]]),
    })
    parts.push(disc.translate(0, medallion.y, 0))
  }
  const {baluster, handrail, height, post, spacing} = bridge.railing
  const rail = (x: number) => arcHeight(deck, x) + height
  /** an upright bar standing at (x, z) from a little into the girders up to the handrail */
  const upright = (x: number, z: number, width: number) => block([x - width / 2, x + width / 2], [arcHeight(deck, x) - 0.01, rail(x)], [z - width / 2, z + width / 2])
  for (const z of [-railingZ, railingZ]) {
    const stops = [-deckEnd, ...posts, deckEnd]
    for (const [index, x] of stops.entries()) {
      if (index > 0 && index < stops.length - 1) {
        parts.push(upright(x, z, post))
      }
      if (index === 0) {
        continue
      }
      const from = stops[index - 1]
      const count = Math.ceil((x - from) / spacing) - 1
      for (let step = 1; step <= count; step++) {
        parts.push(upright(from + (x - from) * step / (count + 1), z, baluster))
      }
    }
    // The bottom rail follows the deck a little above it, the top rail runs under the handrail, both between the pylons.
    parts.push(arcSlab(raisedArc(deck, 0.03), {
      radii: [deck.radius, deck.radius + 0.02],
      reach: deckEnd + 0.005,
      z: [z - 0.009, z + 0.009],
    }, curveDetail))
    parts.push(arcSlab(raisedArc(deck, height - handrail * 0.5), {
      radii: [deck.radius - 0.022, deck.radius],
      reach: deckEnd + 0.005,
      z: [z - 0.011, z + 0.011],
    }, curveDetail))
  }
  // The principal rafters over the pylons, up the long slopes to the ridge.
  const [lanternHalfX] = vesperLanternHalf(size)
  for (const side of [-1, 1]) {
    for (const z of [-1, 1]) {
      const at = z * (halfWidth - lantern.frame[0] / 2)
      const foot = new Vector3(side * halfX, vesperLanternEavesY, at)
      const head = new Vector3(side * lantern.frame[0] / 2, vesperLanternRidgeY - lantern.rise * lantern.frame[0] / 2 / lanternHalfX, at)
      parts.push(member(foot, head, lantern.frame, slopeNormal('x', side, lanternHalfX, lantern.rise)))
    }
  }
  return parts
}
/** The gilding: the rings in the spandrels, the medallion at the crown, caps on the corbels, beads along the arch’s soffit and the girders’ tops, and the handrails. */
function gilding(layout: Layout, curveDetail: number) {
  const {bridge} = vesperCeiling
  const {arch, corbelFace, corbelTop, deck, deckEnd, halfX, medallion, railingZ, rings} = layout
  const {halfWidth, ribInset} = bridge
  const parts: Array<BufferGeometry> = []
  const {bar: [thinnest, thickest], barShare, inset} = bridge.rings
  const barOf = (radius: number) => Math.min(thickest, Math.max(thinnest, radius * barShare))
  for (const face of [-1, 1]) {
    const depth = faceDepth(face, inset)
    for (const circle of rings) {
      for (const side of [-1, 1]) {
        parts.push(ring({
          ...circle,
          x: side * circle.x,
        }, barOf(circle.radius), depth, curveDetail))
      }
    }
    // The medallion: a heavy ring standing proud of the girders around its disc, a bead ring on the disc and a rosette in the middle.
    parts.push(ring(medallion, thickest, faceDepth(face, [-bridge.medallion[1], inset[1]]), curveDetail))
    parts.push(ring({
      ...medallion,
      radius: medallion.radius * 0.72,
    }, thinnest, faceDepth(face, [-medallionDisc - 0.006, 0]), curveDetail))
    const flower = rosette(medallion.radius * 0.72 / 0.95)
    flower.rotateX(face * Math.PI / 2)
    parts.push(flower.translate(0, medallion.y, face * (halfWidth + medallionDisc - 0.002)))
  }
  // A cap along the top of each corbel, which the pylons stand on.
  parts.push(...bothEnds([block([corbelFace - 0.012, halfX], [corbelTop - 0.024, corbelTop + 0.004], [-halfWidth - 0.024, halfWidth + 0.024])]))
  // A bead under each face of the arch, which catches the light along its soffit.
  parts.push(...bothFaces(z => arcSlab(arch, {
    radii: [arch.radius - 0.014, arch.radius + 0.004],
    reach: corbelFace,
    z,
  }, curveDetail), [halfWidth - ribInset - 0.012, halfWidth - ribInset + 0.006]))
  // A fillet along the top edge of each girder.
  parts.push(...bothFaces(z => arcSlab(deck, {
    radii: [deck.radius - 0.03, deck.radius + 0.01],
    reach: deckEnd,
    z,
  }, curveDetail), [halfWidth - 0.012, halfWidth + 0.012]))
  const {handrail, height} = bridge.railing
  const samples = Math.max(8, curveSegments(deckEnd * 2, deck.radius, tolerance) * curveDetail)
  for (const z of [-railingZ, railingZ]) {
    // Into the pylons a little at both ends.
    const reach = deckEnd + handrail
    const points = Array.from({length: samples + 1}, (_, index) => {
      const x = -reach + reach * 2 * index / samples
      return new Vector3(x, arcHeight(deck, Math.min(Math.abs(x), deckEnd)) + height, z)
    })
    parts.push(new PolylineTubeGeometry(points, handrail, 8 * curveDetail))
  }
  return parts
}

/**
 * Merged meshes of the bridge across the middle of the Vesper’s lantern for a room of the size, relative to its middle at floor level, by material: its bronze and its gilding.
 * `curveDetail` multiplies the facets of its arcs, rings and handrails.
 */
export default class VesperBridgeGeometry {
  readonly bronze: BufferGeometry
  readonly gilt: BufferGeometry

  constructor(size: Size, curveDetail = 1) {
    const layout = vesperBridgeLayout(size)
    this.bronze = mergeParts(bronze(layout, size, curveDetail))
    this.gilt = mergeParts(gilding(layout, curveDetail))
  }

  dispose() {
    this.bronze.dispose()
    this.gilt.dispose()
  }
}
