import type {Wall} from './wallGeometry.ts'
import type {WallPatch} from './wallOverlayGeometry.ts'
import type {BufferGeometry, InstancedMesh, Mesh, Object3D} from 'three/webgpu'

import {MeshBVH} from 'three-mesh-bvh'
import {Box3, DoubleSide, Matrix4, Ray, Raycaster, Vector3} from 'three/webgpu'

import {frameBack} from '../frames/base/PortraitFrame.ts'
import {hangingMargins, hangingOffset, nearCutout, wallPosition} from './wallGeometry.ts'

/** how far out of its wall’s center line a hung frame’s back lies: anything standing out less leaves it room behind */
export const frameClearance = hangingOffset + frameBack
/** how far out of its wall’s center line a hung frame reaches at most, with room to spare: anything standing further out leaves it room in front */
export const frameDepth = hangingOffset + 0.2

type Candidate = {
  box: Box3
  mesh: Mesh
}

/** how a wall’s own surface, trim, cornice and glazing are named, which never stand in the way of what hangs on it */
const ownParts = (wall: Wall) => new Set(['wall', 'trim', 'cornice', 'glass'].map(part => `${part}-${wall.id}`))

/**
 * Finds what stands in the way of works hanging on the sticky walls without the walls knowing: anything in the scene, beyond each wall’s own architecture, hung works and loose props, standing out of a wall further than a hung frame’s back, but not as far as its front, wherever the wall lets works reach, outside its openings and reservations and their margins.
 *
 * It casts a ray toward the wall every `step` meters across and up, against the meshes as they are when a pass begins, so whatever the scene adds or moves shows up with the next pass.
 */
export default class WallObstructionScan {
  /** the patches of every scanned wall where something stands in the way, by wall id, merged up each column of rays */
  readonly patches = new Map<string, ReadonlyArray<WallPatch>>
  /** counts up whenever a wall’s patches change */
  version = 0
  private readonly bvhs = new WeakMap<BufferGeometry, MeshBVH | null>
  private readonly inverse = new Matrix4
  private readonly localRay = new Ray
  private readonly point = new Vector3
  private readonly ray = new Ray
  private readonly raycaster = new Raycaster

  constructor(readonly walls: ReadonlyArray<Wall>, private readonly scene: Object3D, readonly step = 0.05) {}

  /** Scans every sticky wall once, yielding after each column of rays, so a caller can spread it over frames. */
  *pass(): Generator<void, void, void> {
    const meshes = this.collect()
    for (const wall of this.walls) {
      if (wall.sticky === false) {
        continue
      }
      const patches: Array<WallPatch> = []
      const candidates = this.candidates(wall, meshes)
      const columns = Math.floor((wall.width - hangingMargins.side * 2) / this.step)
      const rows = Math.floor((wall.height - hangingMargins.bottom - hangingMargins.top) / this.step)
      for (let column = 0; column < columns && candidates.length > 0; column++) {
        const u = -columns * this.step / 2 + (column + 0.5) * this.step
        let run: WallPatch | null = null
        for (let row = 0; row < rows; row++) {
          const y = hangingMargins.bottom + (row + 0.5) * this.step
          if (!this.blocked(wall, candidates, u, y)) {
            run = null
            continue
          }
          if (run) {
            run.top = y + this.step / 2
            continue
          }
          run = {
            from: u - this.step / 2,
            to: u + this.step / 2,
            bottom: y - this.step / 2,
            top: y + this.step / 2,
          }
          patches.push(run)
        }
        yield
      }
      this.store(wall, patches)
    }
  }

  private blocked(wall: Wall, candidates: ReadonlyArray<Candidate>, u: number, y: number) {
    const height = wall.center[1] + y
    if ([...wall.holes ?? [], ...wall.reservations ?? []].some(cutout => nearCutout(wall, cutout, u, 0, height, height))) {
      return false
    }
    const raked = height + u * (wall.slope ?? 0)
    const origin = this.ray.origin.set(...wallPosition(wall, u, raked, frameDepth))
    const length = this.ray.direction.set(...wallPosition(wall, u, raked, frameClearance)).sub(origin).length()
    this.ray.direction.divideScalar(length)
    return candidates.some(({box, mesh}) => this.ray.intersectsBox(box) && this.hits(mesh, length))
  }

  private bvh(geometry: BufferGeometry) {
    let bvh = this.bvhs.get(geometry)
    if (bvh === undefined) {
      const position = geometry.getAttribute('position') as BufferGeometry['attributes'][string] | undefined
      bvh = position?.count ? new MeshBVH(geometry, {indirect: true}) : null
      this.bvhs.set(geometry, bvh)
    }
    return bvh
  }

  /** the meshes whose bounds reach into the slab in front of the wall where frames hang */
  private candidates(wall: Wall, meshes: ReadonlyArray<Candidate>) {
    const slab = new Box3
    const steps = Math.max(1, Math.ceil(wall.width / 0.5))
    for (let index = 0; index <= steps; index++) {
      const u = -wall.width / 2 + wall.width * index / steps
      for (const y of [hangingMargins.bottom, wall.height - hangingMargins.top]) {
        const height = wall.center[1] + y + u * (wall.slope ?? 0)
        for (const offset of [frameClearance, frameDepth]) {
          slab.expandByPoint(this.point.set(...wallPosition(wall, u, height, offset)))
        }
      }
    }
    slab.expandByScalar(0.01)
    const own = ownParts(wall)
    return meshes.filter(({box, mesh}) => !own.has(mesh.name) && box.intersectsBox(slab))
  }

  /** every mesh in the scene with its world bounds, apart from hung works and loose props */
  private collect() {
    const meshes: Array<Candidate> = []
    const walk = (object: Object3D) => {
      if (object.userData.pickup) {
        return
      }
      const mesh = object as Partial<InstancedMesh> & Object3D
      if (mesh.isMesh && mesh.geometry) {
        const instanced = mesh.isInstancedMesh ? mesh as InstancedMesh : null
        if (instanced) {
          instanced.computeBoundingBox()
        } else {
          mesh.geometry.boundingBox ?? mesh.geometry.computeBoundingBox()
        }
        const bounds = instanced ? instanced.boundingBox : mesh.geometry.boundingBox
        if (bounds && !bounds.isEmpty()) {
          meshes.push({
            mesh: mesh as Mesh,
            box: bounds.clone().applyMatrix4(mesh.matrixWorld),
          })
        }
      }
      for (const child of object.children) {
        walk(child)
      }
    }
    this.scene.updateMatrixWorld()
    walk(this.scene)
    return meshes
  }

  /** whether the scan’s ray meets the mesh within `length` meters */
  private hits(mesh: Mesh, length: number) {
    // A mesh with a raycast of its own, like the markers that never take one, or whose triangles move apart from its geometry, casts itself.
    const {isBatchedMesh, isInstancedMesh, isSkinnedMesh} = mesh as Partial<Record<'isBatchedMesh' | 'isInstancedMesh' | 'isSkinnedMesh', boolean>>
    const plain = !Object.hasOwn(mesh, 'raycast') && !isBatchedMesh && !isInstancedMesh && !isSkinnedMesh
    if (!plain) {
      this.raycaster.set(this.ray.origin, this.ray.direction)
      this.raycaster.far = length
      return this.raycaster.intersectObject(mesh, false).length > 0
    }
    const bvh = this.bvh(mesh.geometry)
    if (!bvh) {
      return false
    }
    this.localRay.copy(this.ray).applyMatrix4(this.inverse.copy(mesh.matrixWorld).invert())
    const hit = bvh.raycastFirst(this.localRay, DoubleSide)
    return Boolean(hit) && this.point.copy(hit!.point).applyMatrix4(mesh.matrixWorld).distanceTo(this.ray.origin) <= length
  }

  private store(wall: Wall, patches: ReadonlyArray<WallPatch>) {
    const previous = this.patches.get(wall.id)
    if (previous && JSON.stringify(previous) === JSON.stringify(patches)) {
      return
    }
    if (!previous && patches.length === 0) {
      this.patches.set(wall.id, patches)
      return
    }
    this.patches.set(wall.id, patches)
    this.version++
  }
}
