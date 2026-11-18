import {BufferGeometry, Float32BufferAttribute, Vector2} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {colliderGeometry} from './architecture.ts'
import salonRoof, {salonGlassY, salonRoofTopY} from './salonRoof.ts'

type Size = readonly [x: number, z: number]
type Ring = (cosine: number, sine: number, angle: number) => readonly [x: number, y: number, z: number]
type Course = readonly [point: Ring, finish?: typeof salonRoofFinish[keyof typeof salonRoofFinish], flute?: (angle: number) => number]

/** Material slots of the plaster shell. */
export const salonRoofFinish = {
  plaster: 0,
  clay: 1,
  gilt: 2,
} as const
const {plaster, clay, gilt} = salonRoofFinish
const turn = 2 * Math.PI
const divisions = salonRoof.flutes * 6
const {spring, springY, opening, rise, petals, border} = salonRoof
const crownY = springY + rise
const lipWidth = 0.15
const around = (count: number) => Array.from({length: count}, (_, index) => index * turn / count)
const oval = ([x, z]: Size, y: number): Ring => (cosine, sine) => [cosine * x, y, sine * z]
const curb = (offset: number, y: number) => oval([opening[0] + offset, opening[1] + offset], y)
const coveSpan = (t: number): Size => [
  spring[0] + (opening[0] + lipWidth - spring[0]) * t,
  spring[1] + (opening[1] + lipWidth - spring[1]) * t,
]
const coveY = (t: number) => springY + rise * (1 - Math.cos(Math.PI * t)) / 2
const springRing = (offset: number, height: number) => oval([spring[0] + offset, spring[1] + offset], springY + height)
/** The 4 angles that reach the corners are added so no facet bridges across a corner of the rectangle. */
function roofAngles([width, depth]: Size) {
  const corner = Math.atan2(depth / spring[1], width / spring[0])
  return [...around(divisions), corner, Math.PI - corner, Math.PI + corner, turn - corner].toSorted((a, b) => a - b)
}
/** Loft successive rings, ordered from outside to inside for the ceiling’s downward-facing surface. */
function loft(angles: ReadonlyArray<number>, courses: ReadonlyArray<Course>) {
  const positions = courses.flatMap(([ring]) => angles.flatMap(angle => ring(Math.cos(angle), Math.sin(angle), angle)))
  const grooves = courses.flatMap(([, , flute]) => angles.map(angle => flute?.(angle) ?? 0))
  const geometry = new BufferGeometry
  const indices: Array<number> = []
  const n = angles.length
  let start = 0
  for (let row = 1; row < courses.length; row++) {
    const outer = (row - 1) * n
    const inner = row * n
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n
      indices.push(outer + i, outer + next, inner + i, outer + next, inner + next, inner + i)
    }
    const finish = courses[row][1] ?? plaster
    if (row + 1 < courses.length && finish === (courses[row + 1][1] ?? plaster)) {
      continue
    }
    geometry.addGroup(start, indices.length - start, finish)
    start = indices.length
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('flute', new Float32BufferAttribute(grooves, 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
function ceiling(angles: ReadonlyArray<number>, [width, depth]: Size) {
  const edge: Ring = (cosine, sine) => {
    const x = cosine * spring[0]
    const z = sine * spring[1]
    const scale = Math.min(width / 2 / Math.abs(x), depth / 2 / Math.abs(z))
    return [x * scale, springY, z * scale]
  }
  // Plaster cove: each flute dies into the two level beads, rather than cutting into their silhouettes.
  const steps = 18
  const cove = Array.from({length: steps}, (_, index): Course => {
    const t = (index + 1) / steps
    const [x, z] = coveSpan(t)
    const y = coveY(t)
    const fade = Math.sin(Math.PI * t) ** 2
    const flute = (angle: number) => fade * (0.5 + 0.5 * Math.cos(salonRoof.flutes * angle)) ** 2
    return [(cosine, sine, angle) => [x * cosine, y + 0.112 * flute(angle), z * sine], plaster, flute]
  })
  const seat = curb(0, salonGlassY)
  const underside: Array<Course> = [
    [edge],
    [springRing(0.26, 0)],
    [springRing(0.23, 0), gilt],
    [springRing(0.195, -0.028)],
    [springRing(0.158, -0.028), clay],
    [springRing(0.1, -0.021), clay],
    [springRing(0.055, -0.003)],
    [springRing(0, 0)],
    ...cove,
    // A small rolled lip terminates the plaster, under the metal sash.
    [curb(0.118, crownY - 0.031)],
    [curb(0.081, crownY - 0.031), gilt],
    [curb(0.042, crownY - 0.018)],
    [curb(0, crownY + 0.038)],
    [seat],
  ]
  // A weathering skin above the relief closes the shell. The spring is buried inside the walls.
  const outside: Array<Course> = [
    [curb(0, salonRoofTopY)],
    [curb(lipWidth, salonRoofTopY)],
    ...Array.from({length: 8}, (_, index): Course => {
      const t = (7 - index) / 8
      return [oval(coveSpan(t), coveY(t) + 0.215 - 0.115 * (1 - t) ** 4)]
    }),
    [(cosine, sine, angle) => {
      const [x, y, z] = edge(cosine, sine, angle)
      return [x, y + 0.1, z]
    }],
    [edge],
  ]
  const geometry = loft(angles, [...underside, ...outside])
  const interior = new BufferGeometry
  interior.setAttribute('position', new Float32BufferAttribute(geometry.getAttribute('position').array.slice(0, underside.length * angles.length * 3), 3))
  interior.setIndex([...geometry.index!.array.subarray(0, (underside.length - 1) * angles.length * 6)])
  return {
    geometry,
    interior,
  }
}
/** The single glazed skin closes the hole for physics. It is not a sun occluder. */
function glazing(angles: ReadonlyArray<number>) {
  const loop = angles.map(angle => [opening[0] * Math.cos(angle), salonGlassY, opening[1] * Math.sin(angle)])
  const pane = new BufferGeometry
  pane.setAttribute('position', new Float32BufferAttribute([0, salonGlassY, 0, ...loop.flat()], 3))
  pane.setIndex(angles.flatMap((_, index) => [0, index + 1, (index + 1) % angles.length + 1]))
  pane.computeVertexNormals()
  return pane
}
/** Angle and distance in the elliptical plan of the rooflight. */
function windowPoint(angle: number, radius: number) {
  return new Vector2(opening[0] * radius * Math.cos(angle), opening[1] * radius * Math.sin(angle))
}
/** A curved glazing bar with a broad web and a smaller rolled bead underneath it. */
function bar(points: ReadonlyArray<Vector2>, width: number, bottom: number, top: number, closed = false) {
  const half = width / 2
  // Pairs of [offset across the cut, height], ordered around the bar.
  const section = [
    [-half, top],
    [-half, bottom + 0.033],
    [-half * 0.7, bottom + 0.01],
    [-half * 0.4, bottom],
    [half * 0.4, bottom],
    [half * 0.7, bottom + 0.01],
    [half, bottom + 0.033],
    [half, top],
  ] as const
  const count = points.length
  const across = points.map((_, i) => {
    const from = points[closed ? (i + count - 1) % count : Math.max(i - 1, 0)]
    const to = points[closed ? (i + 1) % count : Math.min(i + 1, count - 1)]
    const perpendicular = new Vector2(from.y - to.y, to.x - from.x)
    return perpendicular.normalize()
  })
  const positions = points.flatMap(({x, y: z}, i) => section.flatMap(([offset, y]) => [x + across[i].x * offset, y, z + across[i].y * offset]))
  const indices: Array<number> = []
  const n = section.length
  for (let i = 0; i < (closed ? count : count - 1); i++) {
    const a = i * n
    const b = (i + 1) % count * n
    for (let j = 0; j < n; j++) {
      const next = (j + 1) % n
      indices.push(a + j, b + j, a + next, b + j, b + next, a + next)
    }
  }
  // The open runs terminate inside the sash and petal tips; only closed loops need the wrap above.
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
function tracery() {
  const tip = 0.43
  const parts = [
    bar(around(96).map(angle => windowPoint(angle, 0.992)), 0.19, salonGlassY - 0.112, salonGlassY + 0.026, true),
    bar(around(96).map(angle => windowPoint(angle, border)), 0.083, salonGlassY - 0.078, salonGlassY + 0.006, true),
    bar(around(petals * 12).map(angle => windowPoint(angle, tip - 0.135 * (0.5 - 0.5 * Math.cos(petals * angle)))), 0.104, salonGlassY - 0.106, salonGlassY + 0.018, true),
  ]
  // Pairs spring from each leaf tip and open out to the rim, like the ribs of a fanlight.
  for (const angle of around(petals)) {
    for (const side of [-1, 1]) {
      const steps = 14
      const points = Array.from({length: steps + 1}, (_, i) => {
        const t = i / steps
        return windowPoint(angle + side * 0.278 * t ** 0.82, tip - 0.011 + (0.995 - tip + 0.011) * t)
      })
      // The two branches meet at the rosette, with slightly staggered faces so they don’t flicker at the joint.
      const lap = side * 0.001
      parts.push(bar(points, 0.09, salonGlassY - 0.087 + lap, salonGlassY + 0.012 + lap))
    }
  }
  return mergeParts(parts)
}

/** Render and collision share the very same outline around the oval. The bars sit just under the continuous pane. */
export default class SalonRoofGeometry {
  readonly bars: BufferGeometry
  readonly collision: [Float32Array, Uint32Array]
  readonly glass: BufferGeometry
  readonly plaster: BufferGeometry

  constructor(size: Size) {
    const angles = roofAngles(size)
    const {geometry, interior} = ceiling(angles, size)
    this.plaster = geometry
    this.bars = tracery()
    this.glass = glazing(angles)
    const pane = new BufferGeometry
    pane.setAttribute('position', this.glass.getAttribute('position'))
    pane.setIndex(this.glass.index)
    // The bronze projects only a few centimeters into the interior. Use the continuous glazed
    // skin behind it for contact, so props can’t catch on overlapping ends of small glazing bars.
    const surface = mergeParts([interior, pane])
    try {
      this.collision = colliderGeometry(surface)
    } finally {
      surface.dispose()
    }
  }

  dispose() {
    this.plaster.dispose()
    this.bars.dispose()
    this.glass.dispose()
  }
}
