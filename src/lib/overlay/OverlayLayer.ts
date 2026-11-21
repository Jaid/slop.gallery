import type {LayerOptions} from './layer.ts'
import type {StrokeSpace} from './stroke.ts'
import type {BufferGeometry, ColorRepresentation, Mesh} from 'three/webgpu'

import {DoubleSide, Group, InstancedMesh, MeshBasicNodeMaterial} from 'three/webgpu'

import createStroke from './stroke.ts'

export type OverlayMesh = Mesh<BufferGeometry, MeshBasicNodeMaterial>

/** Three sorts a group's priority before its children's renderOrder. Only nonempty groups join the overlay scene. */
export default class OverlayLayer extends Group {
  declare children: Array<OverlayMesh>
  private readonly materials = new Map<StrokeSpace, MeshBasicNodeMaterial>
  constructor(readonly options: LayerOptions) {
    super()
    this.name = options.id
    this.renderOrder = options.priority ?? 0
  }
  get needsDepth() {
    return (this.options.obstructedOpacityFactor ?? 1) < 1 && this.children.some(mesh => !mesh.userData.viewportStroke)
  }
  detach(mesh: OverlayMesh) {
    mesh.removeFromParent()
    if (!this.isShared(mesh.material)) {
      mesh.material.dispose()
    }
    if (!this.children.length) {
      this.removeFromParent()
      for (const material of this.materials.values()) {
        material.dispose()
      }
      this.materials.clear()
    }
  }
  empty() {
    const count = this.children.length
    while (this.children.length) {
      const mesh = this.children[this.children.length - 1]
      this.release(mesh)
    }
    return count
  }
  isShared(material: MeshBasicNodeMaterial) {
    return material === this.materials.get('world') || material === this.materials.get('viewport')
  }
  /** Each coordinate space needs a different vertex shader. Create it on first use. */
  materialFor(color: ColorRepresentation | undefined, space: StrokeSpace) {
    let material = this.materials.get(space)
    if (!material) {
      material = new MeshBasicNodeMaterial({
        ...createStroke(this.options, space),
        color: this.options.color ?? '#ffffff',
        depthTest: false,
        depthWrite: false,
        forceSinglePass: true,
        side: DoubleSide,
        toneMapped: false,
        transparent: true,
      })
      this.materials.set(space, material)
    }
    if (color === undefined) {
      return material
    }
    const tinted = material.clone()
    tinted.color.set(color)
    return tinted
  }
  release(mesh: OverlayMesh) {
    this.detach(mesh)
    mesh.geometry.dispose()
    if (mesh instanceof InstancedMesh) {
      mesh.dispose()
    }
  }
}
