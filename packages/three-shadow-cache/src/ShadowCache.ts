import type {BufferGeometry, Light, LightShadow, Matrix4, Object3D, PerspectiveCamera} from 'three/webgpu'

import {Sphere, Vector3} from 'three/webgpu'

export type ShadowCacheOptions = {
  /** how far a caster or a light may move, in world units and in rotation matrix elements, before it counts as changed, by default 0.001; what stays below it, like a settling physics body wobbling by fractions of a millimeter, adds up until it counts */
  tolerance?: number
}
export type ShadowCacheUpdate = {
  /** whether the light’s shadows matter right now, by default always; a light they don’t matter for keeps its pending update until they do */
  active?: (light: Light) => boolean
  /** the subtrees left out of this frame, like culled rooms, by default none; they count as absent for all but directional lights */
  hidden?: ReadonlySet<Object3D>
}
type ShadowLight = Light & {
  distance?: number
  isDirectionalLight?: boolean
  isPointLight?: boolean
  shadow: LightShadow<PerspectiveCamera>
}
type Caster = Object3D & {
  boundingSphere?: Sphere | null
  computeBoundingSphere?: () => void
  geometry: BufferGeometry
  instanceMatrix?: {version: number}
}
type CasterState = {
  frame: number
  geometry: BufferGeometry
  hidden: boolean
  instances: number
  matrix: Matrix4
  sphere: Sphere
}
type Change = {
  /** whether the caster was hidden before and after, where lamps don’t draw it */
  hidden: boolean
  /** whether only its hiding changed, which directional lights don’t see */
  hiding: boolean
  sphere: Sphere
}
type LightState = {
  /** whether a caster changed while hidden since the map last rendered, which shows once something shows again */
  deferred: boolean
  dirty: boolean
  frame: number
  matrix: Matrix4
}

const lightPosition = new Vector3
const nothingHidden: ReadonlySet<Object3D> = new Set
const alwaysActive = () => true
const worldSphere = (caster: Caster, target: Sphere) => {
  // Instanced meshes bound all of their instances themselves.
  if (caster.computeBoundingSphere && caster.instanceMatrix) {
    caster.computeBoundingSphere()
  }
  if (!caster.boundingSphere && !caster.geometry.boundingSphere) {
    caster.geometry.computeBoundingSphere()
  }
  return target.copy(caster.boundingSphere ?? caster.geometry.boundingSphere!).applyMatrix4(caster.matrixWorld)
}

/**
 * Keeps shadow maps until something changes in their light’s reach: a shadow caster that moves, appears or disappears, or the light itself moving.
 * Where almost everything stands still, most lights then render their shadow map once instead of every frame.
 * Directional lights are taken to shine from outside of whatever is hidden and to draw hidden casters too, so hiding or showing a caster leaves their shadow maps alone. A caster changing while hidden only changes shadows nobody sees, so it waits until anything hidden shows again or something in sight changes.
 * All other lights leave hidden casters out of their maps, so they only notice them getting hidden or shown.
 */
export default class ShadowCache {
  private readonly casters = new Map<Caster, CasterState>
  private readonly changes: Array<Change> = []
  private frame = 0
  private readonly lights = new Map<ShadowLight, LightState>
  private readonly tolerance: number

  constructor({tolerance = 0.001}: ShadowCacheOptions = {}) {
    this.tolerance = tolerance
  }

  /** Restores three’s default of updating every shadow map every frame. */
  dispose() {
    for (const light of this.lights.keys()) {
      light.shadow.autoUpdate = true
    }
    this.lights.clear()
    this.casters.clear()
  }

  /**
   * Compares the scene with the last call and requests an update of every shadow map whose light can reach a change.
   * Call it once per frame, after the world matrices are up to date and before the renderer draws.
   */
  update(scene: Object3D, {active = alwaysActive, hidden = nothingHidden}: ShadowCacheUpdate = {}) {
    const frame = ++this.frame
    this.changes.length = 0
    const visit = (object: Object3D, isHidden: boolean) => {
      if (!object.visible) {
        return
      }
      const objectHidden = isHidden || hidden.has(object)
      const light = object as ShadowLight
      if (light.isLight) {
        if (light.castShadow) {
          this.trackLight(light, frame)
        }
      } else if (object.castShadow && 'geometry' in object) {
        this.trackCaster(object as Caster, frame, objectHidden)
      }
      for (const child of object.children) {
        visit(child, objectHidden)
      }
    }
    visit(scene, false)
    for (const [caster, state] of this.casters) {
      if (state.frame === frame) {
        continue
      }
      this.changes.push({
        hidden: state.hidden,
        hiding: false,
        sphere: state.sphere,
      })
      this.casters.delete(caster)
    }
    for (const [light, state] of this.lights) {
      if (state.frame !== frame) {
        light.shadow.autoUpdate = true
        this.lights.delete(light)
        continue
      }
      for (const change of this.changes) {
        if (state.dirty || !this.reaches(light, change.sphere)) {
          continue
        }
        if (!light.isDirectionalLight) {
          state.dirty = !change.hidden
        } else if (change.hiding) {
          // Something showing again brings into view what changed while it was hidden.
          state.dirty = state.deferred
        } else if (change.hidden) {
          state.deferred = true
        } else {
          state.dirty = true
        }
      }
      state.deferred &&= !state.dirty
      if (!(state.dirty && active(light))) {
        continue
      }
      light.shadow.needsUpdate = true
      state.dirty = false
    }
  }

  private moved(from: Matrix4, to: Matrix4) {
    return from.elements.some((value, i) => Math.abs(value - to.elements[i]) > this.tolerance)
  }

  private reaches(light: ShadowLight, sphere: Sphere) {
    if (light.isPointLight) {
      const range = light.distance || light.shadow.camera.far
      return lightPosition.setFromMatrixPosition(light.matrixWorld).distanceTo(sphere.center) <= range + sphere.radius
    }
    light.shadow.updateMatrices(light)
    return light.shadow.getFrustum().intersectsSphere(sphere)
  }

  private trackCaster(caster: Caster, frame: number, hidden: boolean) {
    const instances = caster.instanceMatrix?.version ?? 0
    let state = this.casters.get(caster)
    if (!state) {
      state = {
        frame,
        geometry: caster.geometry,
        hidden,
        instances,
        matrix: caster.matrixWorld.clone(),
        sphere: worldSphere(caster, new Sphere),
      }
      this.casters.set(caster, state)
      this.changes.push({
        hidden,
        hiding: false,
        sphere: state.sphere,
      })
      return
    }
    state.frame = frame
    if (state.geometry === caster.geometry && state.instances === instances && !this.moved(state.matrix, caster.matrixWorld)) {
      if (state.hidden !== hidden) {
        state.hidden = hidden
        this.changes.push({
          hidden: false,
          hiding: true,
          sphere: state.sphere,
        })
      }
      return
    }
    // Both where it was and where it is now changed.
    this.changes.push({
      hidden: state.hidden,
      hiding: false,
      sphere: state.sphere.clone(),
    })
    state.geometry = caster.geometry
    state.hidden = hidden
    state.instances = instances
    state.matrix.copy(caster.matrixWorld)
    this.changes.push({
      hidden,
      hiding: false,
      sphere: worldSphere(caster, state.sphere),
    })
  }

  private trackLight(light: ShadowLight, frame: number) {
    const state = this.lights.get(light)
    if (!state) {
      // Its map has nothing to keep yet, so it renders right away, even while its shadows don’t matter.
      light.shadow.autoUpdate = false
      light.shadow.needsUpdate = true
      this.lights.set(light, {
        deferred: false,
        dirty: false,
        frame,
        matrix: light.matrixWorld.clone(),
      })
      return
    }
    state.frame = frame
    if (this.moved(state.matrix, light.matrixWorld)) {
      state.matrix.copy(light.matrixWorld)
      state.dirty = true
    }
  }
}
