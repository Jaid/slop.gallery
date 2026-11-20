import type {SloperatorMaterial} from './SloperatorRig.ts'
import type {Bone, BufferAttribute, BufferGeometry} from 'three/webgpu'

import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {Box3, Matrix3, Sphere} from 'three/webgpu'

import SloperatorMotion from './SloperatorMotion.ts'
import SloperatorRig, {lap} from './SloperatorRig.ts'

/** what the Sloperator sits on, in its own frame: the origin on the floor under where he sits, the seat facing +z */
export type SloperatorSeat = {
  /** the rolls on the seat’s arms, which his forearms lie on: how high their middles lie over the floor, how thick they are and how far from his middle they lie on either side; on a seat without arms, his hands lie on his cane */
  arms?: {
    height: number
    radius: number
    x: number
  }
  /** how high over the floor the top of the seat lies, which he sits on */
  height: number
  /** how far he leans back into the seat’s back, in radians; he sits upright on a seat without one */
  lean?: number
}
/** a part of him in the geometry of its material: the bone it moves with, its corners and their normals in the bone’s frame, and where its run of corners starts in the geometry */
type Run = {
  bone: Bone
  normals: ArrayLike<number>
  positions: ArrayLike<number>
  start: number
}

const materials = ['cane', 'cloth', 'skin', 'slime'] as const satisfies ReadonlyArray<SloperatorMaterial>
const normalMatrix = new Matrix3

/**
 * The Sloperator, the bowler-hatted gentleman of the gallery’s icon, in a dark overcoat, a slop of slime in front of his face and a cane in his hands, posed by his {@link SloperatorRig}: sitting on a seat, his feet on the floor in front of it, or standing without one, where he would have sat; and anywhere on his way from there into his sight pose, see {@link SloperatorMotion}.
 * Every part of him moves with one bone, so moving him only moves the corners of each part along with its bone, written into the geometry he already has; standing still, he costs nothing.
 *
 * In his frame, the origin on the floor under where he sits or stands, facing +z. Upright on a seat, he sits {@link SloperatorGeometry.height} tall on it, and his knees reach {@link SloperatorGeometry.lap} in front of where he sits. Geometry is merged per material: `cane` for his cane, `cloth` for his coat, his trousers, his shoes, his hat and his hair, as dark as they, `skin` for his head and his hands and `slime` for the slop in front of his face.
 */
export default class SloperatorGeometry {
  /** how tall he sits upright, from the seat under him to the crown of his hat, in meters */
  static readonly height = 1
  /** how far in front of where he sits the front edge of his seat should lie, which his thighs reach to and his shins hang down in front of, in meters */
  static readonly lap = lap
  readonly cane: BufferGeometry
  readonly cloth: BufferGeometry
  /** how long he takes to move from his neutral pose into his sight pose, in seconds */
  readonly duration: number
  readonly skin: BufferGeometry
  readonly slime: BufferGeometry
  private readonly motion: SloperatorMotion
  /** how far he is on his way into his sight pose */
  private progress = 0
  private readonly rig = new SloperatorRig
  private readonly runs: Record<SloperatorMaterial, ReadonlyArray<Run>>

  /** He sits on the `seat`, or stands without one, in his neutral pose. */
  constructor(seat?: SloperatorSeat) {
    const {rig} = this
    this.motion = new SloperatorMotion(rig, seat)
    this.duration = this.motion.duration
    const geometries = {} as Record<SloperatorMaterial, BufferGeometry>
    const runs = {} as Record<SloperatorMaterial, Array<Run>>
    for (const material of materials) {
      const parts = rig.parts.filter(part => part.material === material)
      geometries[material] = mergeGeometries(parts.map(({geometry}) => geometry))
      let start = 0
      runs[material] = parts.map(({bone, geometry}) => {
        const run = {
          bone,
          normals: geometry.getAttribute('normal').array,
          positions: geometry.getAttribute('position').array,
          start,
        }
        start += geometry.getAttribute('position').count
        return run
      })
    }
    this.cane = geometries.cane
    this.cloth = geometries.cloth
    this.skin = geometries.skin
    this.slime = geometries.slime
    this.runs = runs
    this.write()
  }

  dispose() {
    for (const material of materials) {
      this[material].dispose()
    }
    this.rig.dispose()
  }

  /** Poses him `progress` of the way from his neutral pose, at 0, into his sight pose, at 1, see {@link SloperatorMotion}. */
  pose(progress: number) {
    if (progress === this.progress) {
      return
    }
    this.progress = progress
    this.motion.pose(progress)
    this.write()
  }

  /** Writes every part where its bone has it now, into the geometry of its material, and fits their bounds round him: a box round every corner and the sphere round the box. */
  private write() {
    this.rig.root.updateMatrixWorld(true)
    for (const material of materials) {
      const geometry = this[material]
      const position = geometry.getAttribute('position') as BufferAttribute
      const normal = geometry.getAttribute('normal') as BufferAttribute
      const {array: written} = position
      const {array: turned} = normal
      let [maxX, maxY, maxZ, minX, minY, minZ] = [-Infinity, -Infinity, -Infinity, Infinity, Infinity, Infinity]
      for (const {bone, normals, positions, start} of this.runs[material]) {
        const m = bone.matrixWorld.elements
        // Bones only turn and move, so normals turn like the corners do.
        const n = normalMatrix.setFromMatrix4(bone.matrixWorld).elements
        for (let at = start * 3, corner = 0; corner < positions.length; at += 3, corner += 3) {
          const x = positions[corner]
          const y = positions[corner + 1]
          const z = positions[corner + 2]
          const px = m[0] * x + m[4] * y + m[8] * z + m[12]
          const py = m[1] * x + m[5] * y + m[9] * z + m[13]
          const pz = m[2] * x + m[6] * y + m[10] * z + m[14]
          written[at] = px
          written[at + 1] = py
          written[at + 2] = pz
          minX = Math.min(minX, px)
          minY = Math.min(minY, py)
          minZ = Math.min(minZ, pz)
          maxX = Math.max(maxX, px)
          maxY = Math.max(maxY, py)
          maxZ = Math.max(maxZ, pz)
          const a = normals[corner]
          const b = normals[corner + 1]
          const c = normals[corner + 2]
          turned[at] = n[0] * a + n[3] * b + n[6] * c
          turned[at + 1] = n[1] * a + n[4] * b + n[7] * c
          turned[at + 2] = n[2] * a + n[5] * b + n[8] * c
        }
      }
      position.needsUpdate = true
      normal.needsUpdate = true
      const box = geometry.boundingBox ?? new Box3
      box.min.set(minX, minY, minZ)
      box.max.set(maxX, maxY, maxZ)
      geometry.boundingBox = box
      geometry.boundingSphere = box.getBoundingSphere(geometry.boundingSphere ?? new Sphere)
    }
  }
}
