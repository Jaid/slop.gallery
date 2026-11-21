import type {PortraitSlot} from '#src/lib/gallery/types.ts'

import {attribute, float, min, mix, uv, vec3} from 'three/tsl'
import {Color, Euler, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, PlaneGeometry, Quaternion, Vector3} from 'three/webgpu'

import {slotBorder, slotPanels} from '#src/lib/gallery/portraitSlotVisuals.ts'

/** A frame and its placard each take one instance. Shade the border and fill on the same plane so their alphas never stack behind a wall. */
export default class SlotPanels extends InstancedMesh<PlaneGeometry, MeshBasicNodeMaterial> {
  private readonly angles = new Euler
  private readonly center = new Vector3
  private readonly frame = new Matrix4
  private readonly metrics: InstancedBufferAttribute
  private readonly part = new Matrix4
  private readonly tint = new Color
  private readonly tints: InstancedBufferAttribute
  private readonly turn = new Quaternion
  private readonly unit = new Vector3(1, 1, 1)
  constructor(capacity: number, ghost: boolean) {
    const panel = attribute<'vec3'>('panelMetrics', 'vec3')
    const inset = min(uv(), uv().oneMinus()).mul(panel.xy)
    const d = min(inset.x, inset.y)
    const border = float(slotBorder).sub(d).div(d.fwidth().max(1e-6)).add(0.5).saturate()
    const geometry = new PlaneGeometry
    const material = new MeshBasicNodeMaterial({
      colorNode: mix(attribute<'vec3'>('panelTint', 'vec3'), vec3(1), border.mul(panel.z)),
      opacityNode: mix(ghost ? 0.18 : 0.35, ghost ? 0.7 : 1, border),
    })
    super(geometry, material, capacity * 2)
    this.name = ghost ? 'portrait-slot-preview' : 'portrait-slots'
    this.renderOrder = Number(ghost)
    this.count = 0
    this.frustumCulled = false
    this.metrics = new InstancedBufferAttribute(new Float32Array(capacity * 2 * 3), 3)
    this.tints = new InstancedBufferAttribute(new Float32Array(capacity * 2 * 3), 3)
    geometry.setAttribute('panelMetrics', this.metrics)
    geometry.setAttribute('panelTint', this.tints)
  }
  setSlot(index: number, slot: PortraitSlot, color: string, aimed = false) {
    this.frame.compose(this.center.fromArray(slot.position), this.turn.setFromEuler(this.angles.set(0, slot.rotation, 0)), this.unit)
    this.tint.set(color)
    let i = index * 2
    for (const [x, y, width, height] of slotPanels(slot)) {
      this.metrics.setXYZ(i, width, height, Number(aimed))
      this.tints.setXYZ(i, this.tint.r, this.tint.g, this.tint.b)
      this.setMatrixAt(i++, this.part.makeScale(width, height, 1).setPosition(x, y, 0).premultiply(this.frame))
    }
  }
  showSlots(count: number) {
    this.count = count * 2
    if (count) {
      this.metrics.needsUpdate = true
      this.tints.needsUpdate = true
      this.instanceMatrix.needsUpdate = true
    }
  }
}
