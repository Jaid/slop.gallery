import type {LayerOptions} from './layer.ts'
import type {BufferGeometry, ColorRepresentation, Mesh} from 'three/webgpu'

import {DoubleSide, Group, InstancedMesh, MeshBasicNodeMaterial} from 'three/webgpu'

import createStroke from './stroke.ts'

export type OverlayMesh = Mesh<BufferGeometry, MeshBasicNodeMaterial>

/** Three sorts a group's priority before its children's renderOrder. Only nonempty groups join the overlay scene. */
export default class OverlayLayer extends Group {
  declare children: Array<OverlayMesh>
  readonly material: MeshBasicNodeMaterial
  readonly needsDepth: boolean
  constructor(readonly options: LayerOptions) {
    super()
    this.needsDepth = (options.obstructedOpacityFactor ?? 1) < 1
    this.name = options.id
    this.renderOrder = options.priority ?? 0
    this.material = new MeshBasicNodeMaterial({
      ...createStroke(options),
      color: options.color ?? '#ffffff',
      depthTest: false,
      depthWrite: false,
      forceSinglePass: true,
      side: DoubleSide,
      toneMapped: false,
      transparent: true,
    })
  }
  detach(mesh: OverlayMesh) {
    mesh.removeFromParent()
    if (mesh.material !== this.material) {
      mesh.material.dispose()
    }
    if (!this.children.length) {
      this.removeFromParent()
      this.material.dispose()
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
  /** Use the shared layer material unless this drawing supplies its own color. */
  materialFor(color?: ColorRepresentation) {
    if (color === undefined) {
      return this.material
    }
    const material = this.material.clone()
    material.color.set(color)
    return material
  }
  release(mesh: OverlayMesh) {
    this.detach(mesh)
    mesh.geometry.dispose()
    if (mesh instanceof InstancedMesh) {
      mesh.dispose()
    }
  }
}
