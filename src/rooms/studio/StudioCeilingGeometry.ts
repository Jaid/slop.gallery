import type {StudioSkylight} from './skylights.ts'
import type {BufferGeometry} from 'three/webgpu'

import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {CircleGeometry, ExtrudeGeometry, LatheGeometry, Path, Shape, SphereGeometry, TorusGeometry, Vector2} from 'three/webgpu'

import {mergeParts} from '#src/lib/geometry.ts'

import {skylightBars, studioSkylightTrim} from './skylights.ts'

const roundSegments = 128
/** how far in from an opening’s plaster reveal the casing’s lining and the sash stand, so their faces never meet the reveal’s */
const clearance = 0.006

/** A point of a section to turn round the y axis, out from the axis and up, and whether the surface runs on smoothly through it rather than turning a crisp edge there. */
type SectionPoint = readonly [across: number, up: number, smooth?: boolean]

/** The section turned round the y axis, crisp at every point inside it but the smooth ones: LatheGeometry averages the faces’ normals at each point, which a doubled point keeps apart. */
function lathe(section: ReadonlyArray<SectionPoint>) {
  const points = section.flatMap(([across, up, smooth], index) => {
    const point = new Vector2(across, up)
    return smooth || index === 0 || index === section.length - 1 ? [point] : [point, point.clone()]
  })
  return new LatheGeometry(points, roundSegments)
}

/**
 * The Studio’s ceiling, relative to the room’s origin, by material: a level plaster slab over the walls pierced by round skylights, each opening in a round recess, with a walnut casing round it and a walnut sash glazed in it, trimmed in gilt.
 *
 * The sash’s bars running along z are laid along x, so a material whose grain follows each mesh’s x follows them too once their mesh turns them a quarter about y, which carries local x to −z and local z to x.
 */
export default class StudioCeilingGeometry {
  /** the casings round the openings under the recesses and the rings and bars along x of their sashes */
  readonly casings: BufferGeometry
  /** the beads along the recesses’ edges and in the casings’ grooves and the bosses where the sashes’ bars cross */
  readonly gilt: BufferGeometry
  /** the panes in the sashes, facing down into the room */
  readonly glass: BufferGeometry
  /** the slab, its underside at the ceiling’s height, its recesses and the openings’ reveals */
  readonly slab: BufferGeometry
  /** the sashes’ bars running along z, laid along x */
  readonly stiles: BufferGeometry

  constructor({height, size: [width, depth], skylights}: {
    /** how high the ceiling’s underside hangs over the floor */
    height: number
    /** the floor plan the slab covers, centered on the origin */
    size: readonly [width: number, depth: number]
    skylights: ReadonlyArray<StudioSkylight>
  }) {
    const {casing, recess, sash, slab} = studioSkylightTrim
    // The slab’s outline with a hole for every recess; the shape’s y runs along z and its extrusion down from the slab’s top.
    const outline = new Shape
    outline.moveTo(-width / 2, -depth / 2)
    outline.lineTo(width / 2, -depth / 2)
    outline.lineTo(width / 2, depth / 2)
    outline.lineTo(-width / 2, depth / 2)
    outline.closePath()
    for (const {center: [x, z], radius} of skylights) {
      const opening = new Path
      opening.absarc(x, z, radius + recess.reach, 0, Math.PI * 2, true)
      outline.holes.push(opening)
    }
    const extruded = new ExtrudeGeometry(outline, {
      depth: slab,
      bevelEnabled: false,
      curveSegments: roundSegments / 2,
    })
    const sashY = slab - sash.top - sash.depth / 2
    /** Carries a part laid round the y axis, its y up from the ceiling’s underside, to the skylight. */
    const onto = (part: BufferGeometry, {center: [x, z]}: StudioSkylight) => part.translate(x, height, z)
    this.slab = mergeParts([
      extruded.rotateX(Math.PI / 2).translate(0, height + slab, 0),
      ...skylights.map(skylight => {
        const edge = skylight.radius + recess.reach
        // Its section, out from the axis and up from the ceiling’s underside: down the opening’s reveal from the slab’s top, out along the recess’s level ceiling and down round the cove to its edge in the ceiling, so it faces the axis and the room.
        const cove = Array.from({length: 12}, (_, index): SectionPoint => {
          const angle = (index + 1) / 12 * Math.PI / 2
          return [edge - recess.cove + recess.cove * Math.sin(angle), recess.rise - recess.cove + recess.cove * Math.cos(angle), index < 11]
        })
        return onto(lathe([
          [skylight.radius, slab],
          [skylight.radius, recess.rise],
          [edge - recess.cove, recess.rise, true],
          ...cove,
        ]), skylight)
      }),
    ])
    /** A ring lying level round the y axis, `y` meters over the ceiling’s underside. */
    const level = (radius: number, tube: number, y: number) => {
      const torus = new TorusGeometry(radius, tube, 10, roundSegments)
      return torus.rotateX(Math.PI / 2).translate(0, y, 0)
    }
    /** A bar `length` meters long along x, its middle at `[x, z]`. */
    const bar = (length: number, x: number, z: number) => {
      const piece = new RoundedBoxGeometry(length, sash.depth, sash.bar, 1, sash.radius)
      return piece.translate(x, sashY, z)
    }
    this.casings = mergeParts(skylights.flatMap(skylight => {
      const {radius} = skylight
      const lining = radius - clearance
      const fascia = radius + casing.width - 0.07
      // Its section, out from the axis and up from the ceiling’s underside: down the lining from a little up the reveal, out over a chamfer into the bead’s groove, down to the broad fascia and round an ovolo up into the ceiling, so it faces the axis and the room.
      const ovolo = Array.from({length: 7}, (_, index): SectionPoint => {
        const angle = (index + 1) / 7 * Math.PI / 2
        return [fascia + 0.07 * Math.sin(angle), -casing.drop * (0.3 + 0.7 * Math.cos(angle)), true]
      })
      const section = ([
        [lining, 0.08],
        [lining, -casing.drop * 0.2],
        [radius + 0.03, -casing.drop * 0.6],
        [radius + 0.085, -casing.drop * 0.6],
        [radius + 0.085, -casing.drop],
        [fascia, -casing.drop, true],
        ...ovolo,
        [radius + casing.width, 0.005],
      ] satisfies Array<SectionPoint>).map(([across, up, smooth]): SectionPoint => [across, recess.rise + up, smooth])
      // A closed ring of rectangular section, its edges chamfered, round the panes.
      const outer = lining
      const inner = lining - sash.frame
      const [bottom, top] = [sashY - sash.depth / 2, sashY + sash.depth / 2]
      const chamfer = sash.radius
      const frame: Array<SectionPoint> = [
        [outer, bottom + chamfer],
        [outer, top - chamfer],
        [outer - chamfer, top],
        [inner + chamfer, top],
        [inner, top - chamfer],
        [inner, bottom + chamfer],
        [inner + chamfer, bottom],
        [outer - chamfer, bottom],
        [outer, bottom + chamfer],
      ]
      // The rails run across the panes from ring to ring, into it a little.
      const rails = skylightBars(radius).map(along => bar(2 * Math.sqrt(inner ** 2 - along ** 2) + 0.02, 0, along))
      return [lathe(section), lathe(frame), ...rails].map(part => onto(part, skylight))
    }))
    // The stiles butt against the rails, from the ring to the first, on to the second and on to the ring, in their frame turned back a quarter about y.
    this.stiles = mergeParts(skylights.flatMap(({center: [x, z], radius}) => {
      const inner = radius - clearance - sash.frame
      const [first, second] = skylightBars(radius)
      return skylightBars(radius).flatMap(across => {
        const reach = Math.sqrt(inner ** 2 - across ** 2) + 0.01
        const stops = [[-reach, first - sash.bar / 2], [first + sash.bar / 2, second - sash.bar / 2], [second + sash.bar / 2, reach]] as const
        return stops.map(([from, to]) => bar(to - from, -(z + (from + to) / 2), x + across).translate(0, height, 0))
      })
    }))
    this.gilt = mergeParts(skylights.flatMap(skylight => {
      const {radius} = skylight
      const bars = skylightBars(radius)
      const bosses = bars.flatMap(x => bars.map(z => {
        // A flattened dome, its upper half in the bars.
        const boss = new SphereGeometry(sash.boss, 24, 12)
        return boss.scale(1, 0.5, 1).translate(x, sashY - sash.depth / 2, z)
      }))
      return [
        level(radius + 0.0575, casing.bead, recess.rise - casing.drop * 0.6 - casing.bead * 0.4),
        level(radius + recess.reach, recess.bead, 0),
        ...bosses,
      ].map(part => onto(part, skylight))
    }))
    this.glass = mergeParts(skylights.map(skylight => {
      // Facing down, its edge in the ring.
      const pane = new CircleGeometry(skylight.radius - clearance - sash.frame + 0.01, roundSegments)
      return onto(pane.rotateX(Math.PI / 2).translate(0, sashY, 0), skylight)
    }))
  }

  dispose() {
    for (const geometry of [this.casings, this.gilt, this.glass, this.slab, this.stiles]) {
      geometry.dispose()
    }
  }
}
