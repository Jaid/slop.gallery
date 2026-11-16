import type Passage from './Passage.ts'

import {BufferGeometry, ExtrudeGeometry, Shape} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {vaultShellThickness, wallFace} from '../architectureDimensions.ts'

/** how far a barrel vault reaches into an elbow, burying the ends of the walls’ cornices that stop where it would otherwise end */
const junctionOverlap = 0.01
const ribDepth = 0.22
/** how far a vault’s spandrels reach into an elbow, 1 cm past the walls’ faces so the cornice and wall ends there stay buried */
const spandrelDepth = wallFace + 0.01

/**
 * Barrel vaults stop short of elbows, where the continuous roof closes the turn.
 *
 * Toward an elbow, a vault ends in a flat stone face that fills its spandrels up to the elbow’s ceiling, so the turn shows arches
 * cut into stone instead of the open space beside the vault.
 */
export default class VaultGeometry {
  readonly ribs: BufferGeometry
  /** the ribs’ collision mesh at the canonical fidelity, like `RouteVaultGeometry`’s: the very geometry `ribs` draws in realtime graphics modes, a coarser one of its own beside Cinematic’s finer ribs, so Rapier meets the same triangles in every mode */
  readonly ribsCollision: BufferGeometry
  readonly shell: BufferGeometry
  /** the shell’s collision mesh, like {@link ribsCollision} beside `shell` */
  readonly shellCollision: BufferGeometry

  /**
   * `ribFreeEnd` keeps the final meters free of stone ribs, e.g. for a timber transition.
   * `curveDetail` multiplies the chords of the render shell’s and ribs’ arches from their canonical 32 at 1, which realtime graphics draw and every mode collides with, to the 64 Cinematic draws at 2. The canonical count is no lower than it ever was: an extrusion’s crown is a vertex, never a level facet like a routed vault’s, so its chords have to stay fine enough for a pendant’s canopy to sit flush across that ridge, see `CeilingProbe`.
   */
  constructor(passage: Passage, ribFreeEnd = 0, curveDetail = 1) {
    if (!Number.isFinite(ribFreeEnd) || ribFreeEnd < 0) {
      throw new RangeError('The rib-free end of a vault needs a finite, nonnegative length.')
    }
    if (!Number.isInteger(curveDetail) || curveDetail < 1) {
      throw new RangeError('A vault’s curve detail is a whole multiplier of its canonical fidelity, at least 1.')
    }
    const build = (detail: number) => {
      const curveSegments = 32 * detail
      const shells: Array<BufferGeometry> = []
      const ribs: Array<BufferGeometry> = []
      const radius = passage.width / 2
      const spring = passage.height - radius
      for (const [i, {start, end, length, from, to}] of passage.spans.entries()) {
        if (to <= from) {
          continue
        }
        const dx = end[0] - start[0]
        const dz = end[1] - start[1]
        const shellFrom = from - (i > 0 ? junctionOverlap : 0)
        const shellTo = to + (i < passage.spans.length - 1 ? junctionOverlap : 0)
        const rotation = Math.atan2(dx, dz)
        const part = (r: number, depth: number, thickness: number, distance: number) => {
          const shape = new Shape
          shape.moveTo(-r, spring)
          shape.absarc(0, spring, r, Math.PI, 0, true)
          shape.lineTo(r + thickness, spring)
          shape.absarc(0, spring, r + thickness, 0, Math.PI, false)
          shape.closePath()
          const archBand = new ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: false,
            curveSegments,
          })
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
          shape.absarc(0, spring, radius, Math.PI - shoulder, shoulder, true)
          shape.lineTo(halfWidth, passage.height)
          shape.lineTo(-halfWidth, passage.height)
          shape.closePath()
          const face = new ExtrudeGeometry(shape, {
            depth: spandrelDepth,
            bevelEnabled: false,
            curveSegments,
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
          ribs.push(part(radius - 0.085, ribDepth, 0.085, (from + ribTo) / 2))
          continue
        }
        const count = Math.max(1, Math.ceil((ribTo - from) / 3.2))
        for (let rib = 0; rib <= count; rib++) {
          const distance = from + 0.15 + span * rib / count
          ribs.push(part(radius - 0.085, ribDepth, 0.085, distance))
        }
      }
      return {
        shell: mergeParts(shells),
        // A run too short for a rib, like one that is all but timber, has none.
        ribs: ribs.length ? mergeParts(ribs) : new BufferGeometry,
      }
    }
    const drawn = build(curveDetail)
    const canonical = curveDetail === 1 ? drawn : build(1)
    this.shell = drawn.shell
    this.ribs = drawn.ribs
    this.shellCollision = canonical.shell
    this.ribsCollision = canonical.ribs
  }

  dispose() {
    this.shell.dispose()
    this.ribs.dispose()
    if (this.shellCollision !== this.shell) {
      this.shellCollision.dispose()
    }
    if (this.ribsCollision !== this.ribs) {
      this.ribsCollision.dispose()
    }
  }
}
