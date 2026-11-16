import type Passage from './Passage.ts'

import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js'
import {BufferGeometry, ExtrudeGeometry, Shape} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {vaultShellThickness, wallFace} from '../architectureDimensions.ts'
import {routeArchSegments, routeBackSegments} from './RoutedPassage.ts'

/** how far a barrel vault reaches into an elbow, burying the ends of the walls’ cornices that stop where it would otherwise end */
const junctionOverlap = 0.01
const ribDepth = 0.22
/** how far a vault’s spandrels reach into an elbow, 1 cm past the walls’ faces so the cornice and wall ends there stay buried */
const spandrelDepth = wallFace + 0.01
/** its arch’s faces bend smoothly round it, but break at sharper turns than this, like those to its ends and its springs */
const archCrease = Math.PI / 6
/** The shape’s normals smoothed round its arch and creased at its edges; smoothed in centimeters, as the utility welds positions closer than 0.01 units. */
const smoothed = (geometry: BufferGeometry) => {
  const result = toCreasedNormals(geometry.scale(100, 100, 100), archCrease).scale(0.01, 0.01, 0.01)
  geometry.dispose()
  return result
}

/**
 * Barrel vaults stop short of elbows, where the continuous roof closes the turn.
 *
 * Toward an elbow, a vault ends in a flat stone face that fills its spandrels up to the elbow’s ceiling, so the turn shows arches
 * cut into stone instead of the open space beside the vault.
 */
export default class VaultGeometry {
  readonly ribs: BufferGeometry
  readonly shell: BufferGeometry

  /** `ribFreeEnd` keeps the final meters free of stone ribs, e.g. for a timber transition. `detail` cuts its arches more finely, like the routed passages’ vaults, see `routeArchSegments` and `routeBackSegments`. */
  constructor(passage: Passage, ribFreeEnd = 0, detail = 1) {
    if (!Number.isFinite(ribFreeEnd) || ribFreeEnd < 0) {
      throw new RangeError('The rib-free end of a vault needs a finite, nonnegative length.')
    }
    if (!Number.isInteger(detail) || detail < 1) {
      throw new RangeError('A vault’s detail is a whole number from 1 up.')
    }
    const shells: Array<BufferGeometry> = []
    const ribs: Array<BufferGeometry> = []
    const radius = passage.width / 2
    const spring = passage.height - radius
    // As many pieces as the routed passages’ vaults take, an odd count, which leaves a level facet along the crown for a lantern’s canopy; its back, hidden in the rock, far fewer.
    const [segments, back] = [routeArchSegments(detail), routeBackSegments(detail)]
    /** The arch’s points round the spring, `r` meters out, at the vault’s facets from `from` to `to` radians, those two included, counterclockwise or back, or at `pieces` pieces across. */
    const arc = (shape: Shape, r: number, from: number, to: number, pieces = segments) => {
      const step = Math.PI / pieces
      const inner = Array.from({length: pieces - 1}, (_, index) => (index + 1) * step).filter(angle => angle > Math.min(from, to) + 1e-9 && angle < Math.max(from, to) - 1e-9)
      for (const angle of [...from < to ? inner : inner.toReversed(), to]) {
        shape.lineTo(Math.cos(angle) * r, spring + Math.sin(angle) * r)
      }
    }
    // A rib’s back lies on the vault’s inside, cut as finely.
    const ribSegments = segments
    for (const [i, {start, end, length, from, to}] of passage.spans.entries()) {
      if (to <= from) {
        continue
      }
      const dx = end[0] - start[0]
      const dz = end[1] - start[1]
      const shellFrom = from - (i > 0 ? junctionOverlap : 0)
      const shellTo = to + (i < passage.spans.length - 1 ? junctionOverlap : 0)
      const rotation = Math.atan2(dx, dz)
      /** An arch band `r` meters out round the spring and `thickness` thick, its back in `pieces` pieces across. */
      const part = (r: number, depth: number, thickness: number, distance: number, pieces = back) => {
        const shape = new Shape
        shape.moveTo(-r, spring)
        arc(shape, r, Math.PI, 0)
        shape.lineTo(r + thickness, spring)
        arc(shape, r + thickness, 0, Math.PI, pieces)
        shape.closePath()
        const archBand = smoothed(new ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: false,
        }))
        return archBand
          .translate(0, 0, -depth / 2)
          .rotateY(rotation)
          .translate(start[0] + dx / length * distance, passage.floorY, start[1] + dz / length * distance)
      }
      shells.push(part(radius, shellTo - shellFrom, vaultShellThickness, (shellTo + shellFrom) / 2))
      const spandrel = (distance: number) => {
        // Its sides stay buried in the walls, between their faces and backs.
        const halfWidth = radius - wallFace / 2
        const shoulder = Math.acos(halfWidth / radius)
        const shape = new Shape
        shape.moveTo(-halfWidth, spring + Math.sin(shoulder) * radius)
        // Along the same facets as the shell’s, so its edge follows them.
        arc(shape, radius, Math.PI - shoulder, shoulder)
        shape.lineTo(halfWidth, passage.height)
        shape.lineTo(-halfWidth, passage.height)
        shape.closePath()
        const face = new ExtrudeGeometry(shape, {
          depth: spandrelDepth,
          bevelEnabled: false,
        })
        return face
          .translate(0, 0, -spandrelDepth / 2)
          .rotateY(rotation)
          .translate(start[0] + dx / length * distance, passage.floorY, start[1] + dz / length * distance)
      }
      if (i > 0) {
        shells.push(spandrel(shellFrom - spandrelDepth / 2))
      }
      if (i < passage.spans.length - 1) {
        shells.push(spandrel(shellTo + spandrelDepth / 2))
      }
      const ribTo = to - (i === passage.spans.length - 1 ? ribFreeEnd : 0)
      if (ribTo - from < 0.3) {
        continue
      }
      const span = ribTo - from - 0.3
      // On a short run, the ribs at both ends would overlap and share their faces; a single rib in the middle takes their place.
      if (span < ribDepth) {
        ribs.push(part(radius - 0.085, ribDepth, 0.085, (from + ribTo) / 2, ribSegments))
        continue
      }
      const count = Math.max(1, Math.ceil((ribTo - from) / 3.2))
      for (let rib = 0; rib <= count; rib++) {
        const distance = from + 0.15 + span * rib / count
        ribs.push(part(radius - 0.085, ribDepth, 0.085, distance, ribSegments))
      }
    }
    this.shell = mergeParts(shells)
    // A run too short for a rib, like one that is all but timber, has none.
    this.ribs = ribs.length ? mergeParts(ribs) : new BufferGeometry
  }

  dispose() {
    this.shell.dispose()
    this.ribs.dispose()
  }
}
