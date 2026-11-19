import type {RoofPoint} from './forgeRoof.ts'
import type {Vec3} from './types.ts'
import type {BufferGeometry} from 'three/webgpu'

import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {BoxGeometry, CylinderGeometry, TorusGeometry, Vector3} from 'three/webgpu'

import {colliderGeometry} from './architecture.ts'
import forge, {forgeVestibule} from './forge.ts'
import {betweenRoofPoints, forgeCupola, forgeCupolaHeight, forgeCupolaNormal, forgeRoof, forgeRoofBays} from './forgeRoof.ts'
import TriangleSoup from './TriangleSoup.ts'

const at = ([y, z]: RoofPoint, x: number) => new Vector3(x, y, z)
const distance = (a: RoofPoint, b: RoofPoint) => Math.hypot(b[0] - a[0], b[1] - a[1])
const face = (soup: TriangleSoup, [a, b, c, d]: readonly [Vector3, Vector3, Vector3, Vector3], width = 1, length = 1) => {
  const diagonal = c.clone().sub(a)
  const normal = b.clone().sub(a).cross(diagonal)
  // Gable wedges become triangles where one end touches the eave.
  if (normal.lengthSq() < 1e-14) {
    normal.crossVectors(diagonal, d.clone().sub(a))
  }
  normal.normalize()
  soup.quad(soup.add(a, normal, [0, 0]), soup.add(b, normal, [width, 0]), soup.add(c, normal, [width, length]), soup.add(d, normal, [0, length]))
}
const sheet = (soup: TriangleSoup, a: RoofPoint, b: RoofPoint, left: number, right: number) => face(soup, [at(a, left), at(a, right), at(b, right), at(b, left)], right - left, distance(a, b))
/** Rectangular member in the xy or yz plane, with its depth perpendicular to that plane. */
function beam(a: Vector3, b: Vector3, width: number, depth: number, plane: 'xy' | 'yz' = 'xy') {
  const direction = b.clone().sub(a)
  const rotation = plane === 'xy' ? Math.atan2(-direction.x, direction.y) : Math.atan2(direction.z, direction.y)
  const length = direction.length()
  const geometry = plane === 'xy' ? new BoxGeometry(width, length, depth) : new BoxGeometry(depth, length, width)
  if (plane === 'xy') {
    geometry.rotateZ(rotation)
  } else {
    geometry.rotateX(rotation)
  }
  return geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
}
const block = (size: Vec3, position: Vec3) => {
  const geometry = new BoxGeometry(...size)
  return geometry.translate(...position)
}
const rivet = (x: number, y: number, z: number) => {
  const geometry = new CylinderGeometry(0.025, 0.029, 0.023, 8, 1)
  return geometry.rotateX(Math.PI / 2).translate(x, y, z)
}
const ribPoint = (r: number, drop: number) => {
  const [radial, down] = forgeCupolaNormal(r)
  return new Vector3(r + radial * drop, forgeCupolaHeight(r) + down * drop, 0)
}
const takeParts = (parts: ReadonlyArray<BufferGeometry>) => {
  const geometry = mergeGeometries([...parts])
  for (const part of parts) {
    part.dispose()
  }
  return geometry
}
const collisionOf = (parts: ReadonlyArray<BufferGeometry>) => {
  const geometry = mergeGeometries([...parts])
  try {
    return colliderGeometry(geometry)
  } finally {
    geometry.dispose()
  }
}

/** Tooth profiles and structure, all in the same room-local frame for both rendering and Rapier. */
export default class ForgeRoofGeometry {
  readonly collision: ReturnType<typeof colliderGeometry>
  readonly copper: BufferGeometry
  readonly decking: BufferGeometry
  readonly glass: BufferGeometry
  readonly iron: BufferGeometry
  readonly masonry: BufferGeometry

  constructor() {
    const {eaveY, glassHalfWidth, paneColumns, tieY} = forgeRoof
    const wallX = forge.size[0] / 2
    const halfX = wallX - forgeRoof.ledge
    const halfZ = forge.size[1] / 2
    const deck = new TriangleSoup
    const gables = new TriangleSoup
    const glass = new TriangleSoup
    const iron: Array<BufferGeometry> = []
    const copper: Array<BufferGeometry> = []
    const first = forgeRoofBays[0].foot
    const last = forgeRoofBays.at(-1)!.sill
    const deckAcross = (a: RoofPoint, b: RoofPoint) => {
      sheet(deck, a, b, -halfX, -glassHalfWidth)
      sheet(deck, a, b, -glassHalfWidth, glassHalfWidth)
      sheet(deck, a, b, glassHalfWidth, halfX)
    }
    deckAcross([eaveY, -halfZ], first)
    deckAcross(last, [eaveY, halfZ])
    // Keep the vault’s projecting stone behind a low eave. The gables rise from the inside of these two shelves.
    for (const [left, right] of [[-wallX + 0.045, -halfX], [halfX, wallX - 0.045]]) {
      const ledge = (from: RoofPoint, to: RoofPoint) => sheet(deck, [eaveY, from[1]], [eaveY, to[1]], left, right)
      ledge([eaveY, -halfZ], first)
      ledge(last, [eaveY, halfZ])
      for (const {foot, ridge, sill, glassTop: upper, glassBottom: lower} of forgeRoofBays) {
        // Subdivide so the ledge and gable share the same edges.
        ledge(foot, ridge)
        ledge(ridge, upper)
        ledge(upper, lower)
        ledge(lower, sill)
      }
    }
    for (const {foot, ridge, sill, glassTop: upper, glassBottom: lower} of forgeRoofBays) {
      deckAcross(foot, ridge)
      // Opaque reveals on all four sides of the glass; the panes and decking have shared edges, not overlapping decals.
      deckAcross(ridge, upper)
      deckAcross(lower, sill)
      sheet(deck, upper, lower, -halfX, -glassHalfWidth)
      sheet(deck, upper, lower, glassHalfWidth, halfX)
      sheet(glass, upper, lower, -glassHalfWidth, glassHalfWidth)
      // Side walls close the wedges above the existing cornice and overlap the top of the masonry.
      for (const x of [-halfX, halfX]) {
        for (const [a, b] of [[foot, ridge], [ridge, upper], [upper, lower], [lower, sill]]) {
          const quad = [at(a, x), at(b, x), at([eaveY, b[1]], x), at([eaveY, a[1]], x)] as const
          face(gables, x < 0 ? quad : [quad[1], quad[0], quad[3], quad[2]])
        }
      }
      // Metal sash: one horizontal division and equal panes across each tooth.
      for (let i = 0; i <= paneColumns; i++) {
        const edge = i === 0 || i === paneColumns
        const x = -glassHalfWidth + 2 * glassHalfWidth * i / paneColumns
        iron.push(beam(at(upper, x), at(lower, x), 0.09, edge ? 0.11 : 0.054, 'yz'))
      }
      for (const t of [0, 0.5, 1]) {
        const p = betweenRoofPoints(upper, lower, t)
        iron.push(block([2 * glassHalfWidth + 0.09, t === 0.5 ? 0.055 : 0.11, 0.105], at(p, 0).toArray()))
      }
      // Purlins under the long timber slope. The raised bearing plates sit on a continuous wall plate.
      for (const t of [0.32, 0.68]) {
        const [y, z] = betweenRoofPoints(foot, ridge, t)
        iron.push(block([2 * halfX, 0.16, 0.13], [0, y - 0.08, z]))
      }
      const span = wallX - 0.265
      const [ridgeY, ridgeZ] = ridge
      const z = ridgeZ - 0.12
      const lowerNode = (x: number) => new Vector3(x, tieY, z)
      const topNode = (x: number) => new Vector3(x, tieY + (ridgeY - tieY - 0.32) * (1 - (x / span) ** 2), z)
      const panels = 8
      const bottomNodes = Array.from({length: panels + 1}, (_, i) => lowerNode(span * (2 * i / panels - 1)))
      const topNodes = [bottomNodes[0], ...Array.from({length: panels}, (_, i) => topNode(span * (2 * (i + 0.5) / panels - 1))), bottomNodes.at(-1)!]
      iron.push(beam(bottomNodes[0], bottomNodes.at(-1)!, 0.16, 0.19))
      // Paired strips give the tie the silhouette of a rolled I-section.
      for (const y of [tieY - 0.078, tieY + 0.078]) {
        iron.push(block([2 * span, 0.033, 0.29], [0, y, z]))
      }
      for (let i = 1; i < topNodes.length; i++) {
        iron.push(beam(topNodes[i - 1], topNodes[i], 0.135, 0.2))
        if (i > panels) {
          continue
        }
        if (i > 1) {
          iron.push(beam(bottomNodes[i - 1], topNodes[i], 0.094, 0.13))
        }
        if (i < panels) {
          iron.push(beam(bottomNodes[i], topNodes[i], 0.094, 0.13))
        }
        // A shallow cast gusset with four raised copper rivet heads at each web joint.
        const {x, y} = topNodes[i]
        iron.push(block([0.29, 0.26, 0.244], [x, y - 0.036, z]))
        for (const side of [-1, 1]) {
          for (const [dx, dy] of [[-0.09, 0.018], [0.09, 0.018], [-0.062, -0.105], [0.062, -0.105]]) {
            copper.push(rivet(x + dx, y + dy, z + side * 0.127))
          }
        }
      }
      for (const side of [-1, 1]) {
        const x = side * (wallX - 0.185)
        iron.push(block([0.38, 0.44, 0.47], [x, tieY - 0.05, z]))
        copper.push(block([0.38, 0.028, 0.49], [x, tieY + 0.178, z]))
      }
    }
    for (const x of [-wallX + 0.165, wallX - 0.165]) {
      iron.push(block([0.25, 0.16, 2 * halfZ], [x, tieY - 0.26, 0]))
    }
    this.decking = deck.toGeometry()
    this.masonry = gables.toGeometry()
    this.glass = glass.toGeometry()
    this.iron = takeParts(iron)
    this.collision = collisionOf([this.decking, this.masonry, this.glass, this.iron])
    this.copper = takeParts(copper)
  }

  dispose() {
    for (const geometry of [this.decking, this.masonry, this.glass, this.iron, this.copper]) {
      geometry.dispose()
    }
  }
}

const {glassTop, glassBottom} = forgeRoofBays[0]
export const forgePaneSize = [2 * forgeRoof.glassHalfWidth / forgeRoof.paneColumns, distance(glassTop, glassBottom) / 2] as const

/** The vestibule’s solid segmental vault, with eight pressed steel ribs and a circular hub for the pendant. */
export class ForgeCupolaGeometry {
  readonly collision: ReturnType<typeof colliderGeometry>
  readonly copper: BufferGeometry
  readonly iron: BufferGeometry
  readonly masonry: BufferGeometry

  constructor() {
    const {hubRadius, ribs} = forgeCupola
    const {radius} = forgeVestibule
    const masonry = new TriangleSoup
    const rings = 24
    const segments = 96
    const course = (r: number) => Array.from({length: segments + 1}, (_, i) => {
      const angle = 2 * Math.PI * i / segments
      const y = forgeCupolaHeight(r)
      const x = r * Math.cos(angle)
      const z = r * Math.sin(angle)
      const [radial, down] = forgeCupolaNormal(r)
      return masonry.add(new Vector3(x, y, z), new Vector3(radial * Math.cos(angle), down, radial * Math.sin(angle)), [i / segments, r])
    })
    let outer = course(radius)
    for (let ring = 1; ring <= rings; ring++) {
      const inner = course(radius * (1 - ring / rings))
      for (let i = 0; i < segments; i++) {
        masonry.quad(outer[i], outer[i + 1], inner[i + 1], inner[i])
      }
      outer = inner
    }
    const iron: Array<BufferGeometry> = []
    const copper: Array<BufferGeometry> = []
    for (let rib = 0; rib < ribs; rib++) {
      const angle = 2 * Math.PI * rib / ribs
      const count = 18
      for (let i = 0; i < count; i++) {
        const a = hubRadius + (radius - hubRadius) * i / count
        const b = hubRadius + (radius - hubRadius) * (i + 1) / count
        iron.push(beam(ribPoint(a, 0.032), ribPoint(b, 0.032), 0.096, 0.095).rotateY(angle))
        copper.push(beam(ribPoint(a, 0.086), ribPoint(b, 0.086), 0.021, 0.031).rotateY(angle))
      }
    }
    const hubY = forgeCupolaHeight(hubRadius) - 0.04
    const hub = new CylinderGeometry(hubRadius + 0.045, hubRadius + 0.045, 0.16, 48)
    const lip = new CylinderGeometry(hubRadius + 0.052, hubRadius + 0.052, 0.031, 48)
    iron.push(hub.translate(0, hubY, 0))
    copper.push(lip.translate(0, hubY - 0.07, 0))
    // The ribs seat on a bearing ring where the vault springs, above the wall’s faience cornice.
    const bearingRadius = radius - 0.12
    const bearingY = forgeCupolaHeight(bearingRadius) - 0.086
    const bearing = new TorusGeometry(bearingRadius, 0.07, 8, segments)
    const bead = new TorusGeometry(bearingRadius - 0.06, 0.016, 6, segments)
    iron.push(bearing.rotateX(Math.PI / 2).translate(0, bearingY, 0))
    copper.push(bead.rotateX(Math.PI / 2).translate(0, bearingY - 0.03, 0))
    this.masonry = masonry.toGeometry()
    this.collision = collisionOf([this.masonry, ...iron])
    this.iron = takeParts(iron)
    this.copper = takeParts(copper)
  }

  dispose() {
    for (const geometry of [this.masonry, this.iron, this.copper]) {
      geometry.dispose()
    }
  }
}
