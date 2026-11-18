import type PendantBody from './base/PendantBody.ts'
import type {PendantMount} from './CeilingProbe.ts'
import type {BufferGeometry} from 'three/webgpu'

import {CylinderGeometry, Quaternion, Vector3} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'

export const canopyRadius = 0.065
export const canopyHeight = 0.03
/** How far the canopy’s top face sinks into the ceiling, hiding faceting and slope rounding; deeper than the probe’s plane tolerance. */
export const canopyEmbed = 0.008
export const rodRadius = 0.006

/** A light fixture on a vertical rod, with a ceiling canopy following the ceiling’s slope. Local origin is the light source. */
export default class PendantGeometry {
  readonly frame: BufferGeometry
  readonly glow: BufferGeometry

  constructor(body: PendantBody, mount: Pick<PendantMount, 'canopyRadius' | 'drop' | 'normal'>) {
    const {canopyRadius: radius = canopyRadius, drop, normal} = mount
    if (!(drop > body.hook + canopyHeight) || !Number.isFinite(drop) || Math.abs(Math.hypot(...normal) - 1) > 1e-6 || normal[1] >= 0) {
      throw new RangeError('A pendant needs a downward-facing ceiling above its fixture.')
    }
    const down = new Vector3(...normal)
    const canopyCenter = new Vector3(0, drop, 0)
    canopyCenter.addScaledVector(down, canopyHeight / 2 - canopyEmbed)
    // The rod ends inside the canopy, however steep the ceiling.
    const rodTop = canopyCenter.y
    const rod = new CylinderGeometry(rodRadius, rodRadius, rodTop - body.hook, 6)
    rod.translate(0, (rodTop + body.hook) / 2, 0)
    const tilt = new Quaternion
    tilt.setFromUnitVectors(new Vector3(0, 1, 0), down.clone().negate())
    const canopy = new CylinderGeometry(radius, radius * 0.75, canopyHeight, 16)
    canopy.applyQuaternion(tilt).translate(canopyCenter.x, canopyCenter.y, canopyCenter.z)
    this.frame = mergeParts([...body.frame(), rod, canopy])
    try {
      this.glow = mergeParts(body.glow())
    } catch (error) {
      this.frame.dispose()
      throw error
    }
  }

  dispose() {
    this.frame.dispose()
    this.glow.dispose()
  }
}
