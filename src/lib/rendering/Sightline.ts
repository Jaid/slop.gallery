import type {TransmittingEmission} from './AlbedoRenderPipeline.ts'
import type {Camera, Intersection, Material, Object3D} from 'three/webgpu'

import {Mesh, Raycaster, Vector2} from 'three/webgpu'

/** how much nearer than what is aimed at something has to lie to stand in front of it, in meters, so nothing it touches hides it */
const margin = 0.01
/** Whether the eye looks through the material: an invisible one, a transparent one or glass that shows what lies behind it as its own glow. */
function seesThrough(material: Material & Partial<TransmittingEmission>) {
  return !material.visible || material.transparent || material.emissionIsTransmission === true
}
/** The material of the face of the mesh the ray met. */
function materialAt({face, object}: Intersection) {
  const {material} = object as Mesh
  // A geometry group can name a material index that the mesh’s material array does not have.
  return Array.isArray(material) ? material[face?.materialIndex ?? 0] as Material | undefined : material
}

/**
 * Tells whether the middle of a camera’s view meets something, the way the crosshair aims, with nothing but glass in between: first how far away it meets it, see {@link Sightline.distanceTo}, which is cheap to ask every frame, and then whether anything stands in the way, see {@link Sightline.blocked}, which looks at every mesh in sight.
 * It goes by the meshes as they are drawn, independent of pointer lock, the HUD and physics.
 */
export default class Sightline {
  private readonly middle = new Vector2(0, 0)
  private readonly raycaster = new Raycaster

  /**
   * Whether anything of the scene that is drawn stands nearer along the line last aimed with {@link Sightline.distanceTo} than `distance` meters, other than `target` itself and whatever the eye looks through, like the panes of a window.
   */
  blocked(scene: Object3D, target: Object3D, distance: number) {
    const {raycaster} = this
    const visit = (object: Object3D): boolean => {
      if (!object.visible || object === target) {
        return false
      }
      if (object instanceof Mesh && raycaster.intersectObject(object, false).some(hit => {
        const material = materialAt(hit)
        return material !== undefined && !seesThrough(material)
      })) {
        return true
      }
      return object.children.some(visit)
    }
    raycaster.far = distance - margin
    try {
      return visit(scene)
    } finally {
      raycaster.far = Infinity
    }
  }

  /** How far along the middle of the camera’s view the nearest surface of `target` lies, in meters, or undefined where the view’s middle misses it, whatever lies in between. */
  distanceTo(target: Object3D, camera: Camera) {
    const {middle, raycaster} = this
    // Neither may have been drawn since it last moved, or ever.
    camera.updateWorldMatrix(true, false)
    target.updateWorldMatrix(true, true)
    raycaster.layers.mask = camera.layers.mask
    raycaster.setFromCamera(middle, camera)
    return raycaster.intersectObject(target, true).at(0)?.distance
  }
}
