import type {Box3, BufferGeometry, Matrix4, Object3D} from 'three/webgpu'

/** an object that may draw a geometry, with the bounds instanced and batched meshes keep of all of their instances */
export type Drawable = Object3D & {
  boundingBox?: Box3 | null
  computeBoundingBox?: () => void
  geometry?: BufferGeometry
}
type Placement = {
  bounds: Box3
  matrix: Matrix4
  world: Box3
}

const placements = new WeakMap<Object3D, Placement>

/** The drawable’s bounds in world space, by its world matrix as it stands, kept until it moves or its bounds change. Don’t change the box it returns. */
export default function worldBounds(drawable: Drawable, geometry: BufferGeometry) {
  // Instanced and batched meshes bound all of their instances themselves.
  if (drawable.computeBoundingBox && drawable.boundingBox === null) {
    drawable.computeBoundingBox()
  }
  if (!drawable.boundingBox && !geometry.boundingBox) {
    geometry.computeBoundingBox()
  }
  const bounds = drawable.boundingBox ?? geometry.boundingBox!
  const cached = placements.get(drawable)
  if (cached?.matrix.equals(drawable.matrixWorld) && cached.bounds.equals(bounds)) {
    return cached.world
  }
  const placement = {
    bounds: bounds.clone(),
    matrix: drawable.matrixWorld.clone(),
    world: bounds.clone().applyMatrix4(drawable.matrixWorld),
  }
  placements.set(drawable, placement)
  return placement.world
}
